import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  TicketRow,
  TicketStatus,
  TicketPriority,
} from "@/lib/database.types";

export type TicketListItem = TicketRow & {
  company: { id: string; name: string; code: string | null } | null;
  assignee: { id: string; full_name: string } | null;
};

export type TicketListParams = {
  search?: string;
  status?: TicketStatus | "all" | "open";
  priority?: TicketPriority | "all";
  company_id?: string;
  /** Filter to tickets where this user is reporter (customer "my tickets"). */
  reporter_id?: string;
  page?: number;
  pageSize?: number;
};

export type TicketListResult = {
  rows: TicketListItem[];
  total: number;
  page: number;
  pageSize: number;
};

const DEFAULT_PAGE_SIZE = 20;
const OPEN_STATUSES: TicketStatus[] = [
  "new",
  "in_progress",
  "awaiting_customer",
];

export async function listTickets(
  params: TicketListParams = {},
): Promise<TicketListResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.max(1, Math.min(100, params.pageSize ?? DEFAULT_PAGE_SIZE));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createClient();

  let query = supabase
    .from("tickets")
    .select(
      `
      *,
      company:companies!tickets_company_id_fkey (id, name, code),
      assignee:profiles!tickets_assignee_id_fkey (id, full_name)
      `,
      { count: "exact" },
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.search?.trim()) {
    const term = `%${params.search.trim()}%`;
    query = query.or(`title.ilike.${term},code.ilike.${term}`);
  }

  if (params.status && params.status !== "all") {
    if (params.status === "open") {
      query = query.in("status", OPEN_STATUSES);
    } else {
      query = query.eq("status", params.status);
    }
  }

  if (params.priority && params.priority !== "all") {
    query = query.eq("priority", params.priority);
  }

  if (params.company_id) {
    query = query.eq("company_id", params.company_id);
  }

  if (params.reporter_id) {
    query = query.eq("reporter_id", params.reporter_id);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const rows: TicketListItem[] = (data ?? []) as TicketListItem[];
  return { rows, total: count ?? 0, page, pageSize };
}

export type TicketStats = {
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
};

export async function getTicketStats(): Promise<TicketStats> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tickets")
    .select("status")
    .is("deleted_at", null);
  if (error) throw new Error(error.message);

  const stats = { total: 0, open: 0, in_progress: 0, resolved: 0 };
  for (const row of data ?? []) {
    stats.total += 1;
    if (OPEN_STATUSES.includes(row.status as TicketStatus)) stats.open += 1;
    if (row.status === "in_progress") stats.in_progress += 1;
    if (row.status === "resolved") stats.resolved += 1;
  }
  return stats;
}

export type CustomerTicketStats = {
  total: number;
  in_progress: number;
  awaiting_customer: number;
  resolved: number;
  overdue: number;
};

/**
 * Per-user ticket counters for the customer dashboard. Scoped by
 * `reporter_id = userId` so a customer with no company link still sees
 * their own tickets only.
 */
export async function getCustomerTicketStats(
  userId: string,
): Promise<CustomerTicketStats> {
  const supabase = await createClient();

  // Bug fix 2026-05-02: trước đây SELECT `due_at` — nhưng bảng tickets
  // không có column này (due_at chỉ tồn tại ở bảng tasks). Query throw,
  // catch ở dashboard trả null → toàn bộ stats hiển thị "—". Bỏ due_at
  // ra; overdue dùng heuristic "ticket new/in_progress/awaiting_customer
  // mà tạo > 7 ngày chưa close" — đến khi có cơ chế SLA chính thức.
  const { data, error } = await supabase
    .from("tickets")
    .select("status, created_at, closed_at")
    .eq("reporter_id", userId)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);

  const stats: CustomerTicketStats = {
    total: 0,
    in_progress: 0,
    awaiting_customer: 0,
    resolved: 0,
    overdue: 0,
  };
  const overdueThreshold = Date.now() - 7 * 24 * 60 * 60 * 1000;
  for (const row of data ?? []) {
    stats.total += 1;
    if (row.status === "in_progress") stats.in_progress += 1;
    if (row.status === "awaiting_customer") stats.awaiting_customer += 1;
    if (row.status === "resolved" || row.status === "closed") {
      stats.resolved += 1;
    }
    const open =
      row.status === "new" ||
      row.status === "in_progress" ||
      row.status === "awaiting_customer";
    if (open && new Date(row.created_at).getTime() < overdueThreshold) {
      stats.overdue += 1;
    }
  }
  return stats;
}

export async function getTicketById(
  id: string,
): Promise<TicketListItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tickets")
    .select(
      `
      *,
      company:companies!tickets_company_id_fkey (id, name, code),
      assignee:profiles!tickets_assignee_id_fkey (id, full_name)
      `,
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as TicketListItem | null) ?? null;
}
