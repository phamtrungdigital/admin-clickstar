import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  MilestoneRow,
  ProjectRow,
  ServiceStatus,
  TaskRow,
} from "@/lib/database.types";

export type ProjectListItem = ProjectRow & {
  company: { id: string; name: string } | null;
  contract: { id: string; code: string | null; name: string } | null;
  template: { id: string; name: string; version: number } | null;
  pm: { id: string; full_name: string } | null;
  milestone_count: number;
  task_count: number;
};

export type ProjectListParams = {
  search?: string;
  status?: ServiceStatus | "all";
  pm_id?: string;
  company_id?: string;
  page?: number;
  pageSize?: number;
};

export type ProjectListResult = {
  rows: ProjectListItem[];
  total: number;
  page: number;
  pageSize: number;
};

const DEFAULT_PAGE_SIZE = 20;

export async function listProjects(
  params: ProjectListParams = {},
): Promise<ProjectListResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.max(
    1,
    Math.min(100, params.pageSize ?? DEFAULT_PAGE_SIZE),
  );
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createClient();
  let query = supabase
    .from("projects")
    .select(
      `
      *,
      company:companies!projects_company_id_fkey ( id, name ),
      contract:contracts!projects_contract_id_fkey ( id, code, name ),
      template:service_templates!projects_template_id_fkey ( id, name, version ),
      pm:profiles!projects_pm_id_fkey ( id, full_name ),
      milestones ( id ),
      tasks ( id )
      `,
      { count: "exact" },
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.search?.trim()) {
    const term = `%${params.search.trim()}%`;
    query = query.or(`name.ilike.${term}`);
  }
  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }
  if (params.pm_id) {
    query = query.eq("pm_id", params.pm_id);
  }
  if (params.company_id) {
    query = query.eq("company_id", params.company_id);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const rows: ProjectListItem[] = (data ?? []).map((row) => {
    const r = row as ProjectRow & {
      company: { id: string; name: string } | null;
      contract: { id: string; code: string | null; name: string } | null;
      template: { id: string; name: string; version: number } | null;
      pm: { id: string; full_name: string } | null;
      milestones?: { id: string }[];
      tasks?: { id: string }[];
    };
    return {
      ...(r as ProjectRow),
      company: r.company,
      contract: r.contract,
      template: r.template,
      pm: r.pm,
      milestone_count: r.milestones?.length ?? 0,
      task_count: r.tasks?.length ?? 0,
    };
  });

  return { rows, total: count ?? 0, page, pageSize };
}

export type ProjectDetail = ProjectRow & {
  company: { id: string; name: string; code: string | null } | null;
  contract: { id: string; code: string | null; name: string } | null;
  template: { id: string; name: string; version: number } | null;
  pm: { id: string; full_name: string } | null;
  milestones: MilestoneRow[];
  tasks: TaskRow[];
};

export async function getProjectById(id: string): Promise<ProjectDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select(
      `
      *,
      company:companies!projects_company_id_fkey ( id, name, code ),
      contract:contracts!projects_contract_id_fkey ( id, code, name ),
      template:service_templates!projects_template_id_fkey ( id, name, version ),
      pm:profiles!projects_pm_id_fkey ( id, full_name )
      `,
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const { data: ms, error: mErr } = await supabase
    .from("milestones")
    .select("*")
    .eq("project_id", id)
    .order("sort_order", { ascending: true });
  if (mErr) throw new Error(mErr.message);

  const { data: tasks, error: tErr } = await supabase
    .from("tasks")
    .select("*")
    .eq("project_id", id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (tErr) throw new Error(tErr.message);

  return {
    ...(data as ProjectRow),
    company: (data as { company: ProjectDetail["company"] }).company ?? null,
    contract: (data as { contract: ProjectDetail["contract"] }).contract ?? null,
    template: (data as { template: ProjectDetail["template"] }).template ?? null,
    pm: (data as { pm: ProjectDetail["pm"] }).pm ?? null,
    milestones: (ms ?? []) as MilestoneRow[],
    tasks: (tasks ?? []) as TaskRow[],
  };
}

export async function listProjectsForContract(
  contractId: string,
): Promise<ProjectListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select(
      `
      *,
      company:companies!projects_company_id_fkey ( id, name ),
      contract:contracts!projects_contract_id_fkey ( id, code, name ),
      template:service_templates!projects_template_id_fkey ( id, name, version ),
      pm:profiles!projects_pm_id_fkey ( id, full_name ),
      milestones ( id ),
      tasks ( id )
      `,
    )
    .eq("contract_id", contractId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const rows: ProjectListItem[] = (data ?? []).map((row) => {
    const r = row as ProjectRow & {
      company: { id: string; name: string } | null;
      contract: { id: string; code: string | null; name: string } | null;
      template: { id: string; name: string; version: number } | null;
      pm: { id: string; full_name: string } | null;
      milestones?: { id: string }[];
      tasks?: { id: string }[];
    };
    return {
      ...(r as ProjectRow),
      company: r.company,
      contract: r.contract,
      template: r.template,
      pm: r.pm,
      milestone_count: r.milestones?.length ?? 0,
      task_count: r.tasks?.length ?? 0,
    };
  });
  return rows;
}
