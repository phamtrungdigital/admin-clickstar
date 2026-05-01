import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ReportRow } from "@/lib/database.types";

export type ReportListItem = ReportRow & {
  project: { id: string; name: string } | null;
  created_by_profile: { id: string; full_name: string } | null;
  approved_by_profile: { id: string; full_name: string } | null;
};

export type ReportListParams = {
  search?: string;
  status?: string;
  project_id?: string;
  page?: number;
  pageSize?: number;
};

export type ReportListResult = {
  rows: ReportListItem[];
  total: number;
  page: number;
  pageSize: number;
};

const DEFAULT_PAGE_SIZE = 20;

export async function listReports(
  params: ReportListParams = {},
): Promise<ReportListResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.max(
    1,
    Math.min(100, params.pageSize ?? DEFAULT_PAGE_SIZE),
  );
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createClient();
  let query = supabase
    .from("reports")
    .select(
      `
      *,
      project:projects!reports_project_id_fkey ( id, name ),
      created_by_profile:profiles!reports_created_by_fkey ( id, full_name ),
      approved_by_profile:profiles!reports_approved_by_fkey ( id, full_name )
      `,
      { count: "exact" },
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.search?.trim()) {
    query = query.ilike("title", `%${params.search.trim()}%`);
  }
  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }
  if (params.project_id) {
    query = query.eq("project_id", params.project_id);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  return {
    rows: ((data ?? []) as unknown) as ReportListItem[],
    total: count ?? 0,
    page,
    pageSize,
  };
}

export async function getReportById(id: string): Promise<ReportListItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reports")
    .select(
      `
      *,
      project:projects!reports_project_id_fkey ( id, name ),
      created_by_profile:profiles!reports_created_by_fkey ( id, full_name ),
      approved_by_profile:profiles!reports_approved_by_fkey ( id, full_name )
      `,
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return ((data as unknown) as ReportListItem | null) ?? null;
}

export async function listReportsForProject(
  projectId: string,
): Promise<ReportListItem[]> {
  const result = await listReports({ project_id: projectId, pageSize: 50 });
  return result.rows;
}

/** Latest approved report a customer can read. RLS enforces; this is convenience. */
export async function getLatestApprovedReport(
  projectId: string,
): Promise<ReportRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .eq("project_id", projectId)
    .eq("status", "approved")
    .eq("is_published", true)
    .is("deleted_at", null)
    .order("approved_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ReportRow | null) ?? null;
}
