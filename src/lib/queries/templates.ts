import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  ServiceTemplateRow,
  TemplateMilestoneRow,
  TemplateTaskRow,
  TemplateChecklistItemRow,
} from "@/lib/database.types";

export type TemplateListItem = ServiceTemplateRow & {
  milestone_count: number;
  task_count: number;
};

export type TemplateListParams = {
  search?: string;
  industry?: string | "all";
  is_active?: boolean | "all";
  page?: number;
  pageSize?: number;
};

export type TemplateListResult = {
  rows: TemplateListItem[];
  total: number;
  page: number;
  pageSize: number;
};

const DEFAULT_PAGE_SIZE = 20;

export async function listTemplates(
  params: TemplateListParams = {},
): Promise<TemplateListResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.max(
    1,
    Math.min(100, params.pageSize ?? DEFAULT_PAGE_SIZE),
  );
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createClient();
  let query = supabase
    .from("service_templates")
    .select(
      `
      *,
      template_milestones ( id ),
      template_tasks ( id )
      `,
      { count: "exact" },
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.search?.trim()) {
    const term = `%${params.search.trim()}%`;
    query = query.or(`name.ilike.${term},industry.ilike.${term}`);
  }
  if (params.industry && params.industry !== "all") {
    query = query.eq("industry", params.industry);
  }
  if (params.is_active === true) query = query.eq("is_active", true);
  if (params.is_active === false) query = query.eq("is_active", false);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const rows: TemplateListItem[] = (data ?? []).map((row) => {
    const r = row as ServiceTemplateRow & {
      template_milestones?: { id: string }[];
      template_tasks?: { id: string }[];
    };
    return {
      ...(r as ServiceTemplateRow),
      milestone_count: r.template_milestones?.length ?? 0,
      task_count: r.template_tasks?.length ?? 0,
    };
  });

  return { rows, total: count ?? 0, page, pageSize };
}

export type TemplateDetail = ServiceTemplateRow & {
  milestones: TemplateMilestoneRow[];
  tasks: Array<TemplateTaskRow & { checklist: TemplateChecklistItemRow[] }>;
};

export async function getTemplateById(
  id: string,
): Promise<TemplateDetail | null> {
  const supabase = await createClient();

  const { data: template, error } = await supabase
    .from("service_templates")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!template) return null;

  const { data: milestones, error: msErr } = await supabase
    .from("template_milestones")
    .select("*")
    .eq("template_id", id)
    .order("sort_order", { ascending: true });
  if (msErr) throw new Error(msErr.message);

  const { data: tasks, error: tErr } = await supabase
    .from("template_tasks")
    .select("*")
    .eq("template_id", id)
    .order("sort_order", { ascending: true });
  if (tErr) throw new Error(tErr.message);

  const taskIds = (tasks ?? []).map((t) => t.id);
  let checklist: TemplateChecklistItemRow[] = [];
  if (taskIds.length > 0) {
    const { data: cl, error: clErr } = await supabase
      .from("template_checklist_items")
      .select("*")
      .in("template_task_id", taskIds)
      .order("sort_order", { ascending: true });
    if (clErr) throw new Error(clErr.message);
    checklist = cl ?? [];
  }

  const tasksWithChecklist = (tasks ?? []).map((t) => ({
    ...(t as TemplateTaskRow),
    checklist: checklist.filter((c) => c.template_task_id === t.id),
  }));

  return {
    ...(template as ServiceTemplateRow),
    milestones: (milestones ?? []) as TemplateMilestoneRow[],
    tasks: tasksWithChecklist,
  };
}

export async function listDistinctTemplateIndustries(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_templates")
    .select("industry")
    .is("deleted_at", null)
    .not("industry", "is", null);
  if (error) throw new Error(error.message);
  const set = new Set<string>();
  for (const row of data ?? []) {
    if (row.industry) set.add(row.industry as string);
  }
  return Array.from(set).sort();
}
