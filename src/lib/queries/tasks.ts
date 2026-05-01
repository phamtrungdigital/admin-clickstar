import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { TaskRow, TaskStatus, TaskPriority } from "@/lib/database.types";

export type TaskListItem = TaskRow & {
  project: { id: string; name: string } | null;
  milestone: { id: string; code: string | null; title: string } | null;
  assignee: { id: string; full_name: string } | null;
  reviewer: { id: string; full_name: string } | null;
};

export type TaskListParams = {
  search?: string;
  status?: TaskStatus | "all" | "open" | "overdue" | "review" | "blocked";
  priority?: TaskPriority | "all";
  project_id?: string;
  assignee_id?: string;
  reviewer_id?: string;
  is_extra?: boolean;
  page?: number;
  pageSize?: number;
};

export type TaskListResult = {
  rows: TaskListItem[];
  total: number;
  page: number;
  pageSize: number;
};

const DEFAULT_PAGE_SIZE = 20;
const OPEN_STATUSES: TaskStatus[] = [
  "todo",
  "assigned",
  "in_progress",
  "blocked",
  "awaiting_customer",
  "awaiting_review",
  "returned",
];

export async function listTasks(
  params: TaskListParams = {},
): Promise<TaskListResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.max(1, Math.min(100, params.pageSize ?? DEFAULT_PAGE_SIZE));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createClient();
  let query = supabase
    .from("tasks")
    .select(
      `
      *,
      project:projects!tasks_project_id_fkey ( id, name ),
      milestone:milestones!tasks_milestone_id_fkey ( id, code, title ),
      assignee:profiles!tasks_assignee_id_fkey ( id, full_name ),
      reviewer:profiles!tasks_reviewer_id_fkey ( id, full_name )
      `,
      { count: "exact" },
    )
    .is("deleted_at", null)
    .order("due_at", { ascending: true, nullsFirst: false })
    .range(from, to);

  if (params.search?.trim()) {
    const term = `%${params.search.trim()}%`;
    query = query.ilike("title", term);
  }
  if (params.status && params.status !== "all") {
    if (params.status === "open") {
      query = query.in("status", OPEN_STATUSES);
    } else if (params.status === "review") {
      query = query.eq("status", "awaiting_review");
    } else if (params.status === "blocked") {
      query = query.eq("status", "blocked");
    } else if (params.status === "overdue") {
      query = query
        .in("status", OPEN_STATUSES)
        .lt("due_at", new Date().toISOString());
    } else {
      query = query.eq("status", params.status);
    }
  }
  if (params.priority && params.priority !== "all") {
    query = query.eq("priority", params.priority);
  }
  if (params.project_id) {
    query = query.eq("project_id", params.project_id);
  }
  if (params.assignee_id) {
    query = query.eq("assignee_id", params.assignee_id);
  }
  if (params.reviewer_id) {
    query = query.eq("reviewer_id", params.reviewer_id);
  }
  if (params.is_extra !== undefined) {
    query = query.eq("is_extra", params.is_extra);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as TaskListItem[];
  return { rows, total: count ?? 0, page, pageSize };
}

export type TaskStats = {
  total: number;
  open: number;
  overdue: number;
  awaiting_review: number;
  blocked: number;
  done: number;
};

/**
 * Stats for the tasks page header — totals across the visible scope (RLS
 * already filters by audience). Optionally narrow to a single assignee for
 * the "Của tôi" widget.
 */
export async function getTaskStats(
  scope: { assignee_id?: string } = {},
): Promise<TaskStats> {
  const supabase = await createClient();
  let query = supabase
    .from("tasks")
    .select("status, due_at")
    .is("deleted_at", null);
  if (scope.assignee_id) {
    query = query.eq("assignee_id", scope.assignee_id);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const stats: TaskStats = {
    total: 0,
    open: 0,
    overdue: 0,
    awaiting_review: 0,
    blocked: 0,
    done: 0,
  };
  const nowIso = new Date().toISOString();
  for (const row of data ?? []) {
    stats.total += 1;
    const status = row.status as TaskStatus;
    if (OPEN_STATUSES.includes(status)) stats.open += 1;
    if (status === "awaiting_review") stats.awaiting_review += 1;
    if (status === "blocked") stats.blocked += 1;
    if (status === "done") stats.done += 1;
    if (
      OPEN_STATUSES.includes(status) &&
      row.due_at &&
      (row.due_at as string) < nowIso
    ) {
      stats.overdue += 1;
    }
  }
  return stats;
}
