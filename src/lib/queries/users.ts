import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Audience,
  InternalRole,
  ProfileRow,
} from "@/lib/database.types";

export type UserListItem = ProfileRow & {
  email: string | null;
  customers_count: number;
  open_tasks: number;
  open_tickets: number;
};

export type UserListParams = {
  search?: string;
  audience?: Audience | "all";
  role?: InternalRole | "all";
  active?: "all" | "active" | "inactive";
  page?: number;
  pageSize?: number;
};

export type UserListResult = {
  rows: UserListItem[];
  total: number;
  page: number;
  pageSize: number;
};

const DEFAULT_PAGE_SIZE = 20;
const OPEN_TASK_STATUSES = ["todo", "in_progress", "awaiting_customer", "awaiting_review"];
const OPEN_TICKET_STATUSES = ["new", "in_progress", "awaiting_customer"];

export async function listUsers(
  params: UserListParams = {},
): Promise<UserListResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.max(1, Math.min(100, params.pageSize ?? DEFAULT_PAGE_SIZE));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createClient();

  let query = supabase
    .from("profiles")
    .select("*", { count: "exact" })
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.search?.trim()) {
    const term = `%${params.search.trim()}%`;
    query = query.or(`full_name.ilike.${term}`);
  }

  if (params.audience && params.audience !== "all") {
    query = query.eq("audience", params.audience);
  }

  if (params.role && params.role !== "all") {
    query = query.eq("internal_role", params.role);
  }

  if (params.active === "active") query = query.eq("is_active", true);
  if (params.active === "inactive") query = query.eq("is_active", false);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const profiles = (data ?? []) as ProfileRow[];
  if (profiles.length === 0) {
    return { rows: [], total: count ?? 0, page, pageSize };
  }

  // Hydrate workload columns + email from auth.users via service role.
  const ids = profiles.map((p) => p.id);
  const admin = createAdminClient();

  const [emailsResult, customerCounts, taskCounts, ticketCounts] = await Promise.all([
    Promise.all(ids.map((id) => admin.auth.admin.getUserById(id))),
    countByUser(supabase, "company_assignments", "internal_user_id", ids),
    countByUser(supabase, "tasks", "assignee_id", ids, {
      column: "status",
      values: OPEN_TASK_STATUSES,
    }),
    countByUser(supabase, "tickets", "assignee_id", ids, {
      column: "status",
      values: OPEN_TICKET_STATUSES,
    }),
  ]);

  const emailById = new Map<string, string | null>();
  emailsResult.forEach((res, i) => {
    emailById.set(ids[i], res.data.user?.email ?? null);
  });

  const rows: UserListItem[] = profiles.map((p) => ({
    ...p,
    email: emailById.get(p.id) ?? null,
    customers_count: customerCounts.get(p.id) ?? 0,
    open_tasks: taskCounts.get(p.id) ?? 0,
    open_tickets: ticketCounts.get(p.id) ?? 0,
  }));

  return { rows, total: count ?? 0, page, pageSize };
}

async function countByUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: "company_assignments" | "tasks" | "tickets",
  column: "internal_user_id" | "assignee_id",
  ids: string[],
  filter?: { column: string; values: string[] },
): Promise<Map<string, number>> {
  let q = supabase.from(table).select(column).in(column, ids);
  if (filter) q = q.in(filter.column, filter.values);
  // tasks + tickets have soft-delete; company_assignments doesn't.
  if (table !== "company_assignments") q = q.is("deleted_at", null);
  const { data, error } = await q;
  if (error) return new Map();
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const k = (row as Record<string, string | null>)[column];
    if (typeof k === "string") counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

export type UserStats = {
  total: number;
  active: number;
  internal: number;
  customer: number;
};

export async function getUserStats(): Promise<UserStats> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("audience, is_active")
    .is("deleted_at", null);
  if (error) throw new Error(error.message);

  const stats = { total: 0, active: 0, internal: 0, customer: 0 };
  for (const r of data ?? []) {
    stats.total += 1;
    if (r.is_active) stats.active += 1;
    if (r.audience === "internal") stats.internal += 1;
    if (r.audience === "customer") stats.customer += 1;
  }
  return stats;
}

export type UserDetail = ProfileRow & {
  email: string | null;
  assignments: Array<{
    id: string;
    role: string;
    is_primary: boolean;
    company: { id: string; name: string; code: string | null } | null;
  }>;
  open_tasks_count: number;
  open_tickets_count: number;
};

export async function getUserById(id: string): Promise<UserDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      `
      *,
      assignments:company_assignments!company_assignments_internal_user_id_fkey (
        id,
        role,
        is_primary,
        company:companies!company_assignments_company_id_fkey (id, name, code)
      )
      `,
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  type Assignment = UserDetail["assignments"][number];
  const assignments: Assignment[] =
    (data as { assignments?: Assignment[] }).assignments ?? [];

  const admin = createAdminClient();
  const [authResult, taskCounts, ticketCounts] = await Promise.all([
    admin.auth.admin.getUserById(id),
    countByUser(supabase, "tasks", "assignee_id", [id], {
      column: "status",
      values: OPEN_TASK_STATUSES,
    }),
    countByUser(supabase, "tickets", "assignee_id", [id], {
      column: "status",
      values: OPEN_TICKET_STATUSES,
    }),
  ]);

  const { assignments: _drop, ...rest } = data as ProfileRow & {
    assignments?: Assignment[];
  };
  void _drop;

  return {
    ...(rest as ProfileRow),
    email: authResult.data.user?.email ?? null,
    assignments,
    open_tasks_count: taskCounts.get(id) ?? 0,
    open_tickets_count: ticketCounts.get(id) ?? 0,
  };
}
