import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { CompanyRow, CompanyStatus } from "@/lib/database.types";

export type CustomerListItem = CompanyRow & {
  primary_account_manager: { id: string; full_name: string } | null;
};

export type CustomerListParams = {
  search?: string;
  status?: CompanyStatus | "all";
  page?: number;
  pageSize?: number;
};

export type CustomerListResult = {
  rows: CustomerListItem[];
  total: number;
  page: number;
  pageSize: number;
};

const DEFAULT_PAGE_SIZE = 20;

export async function listCustomers(
  params: CustomerListParams = {},
): Promise<CustomerListResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.max(1, Math.min(100, params.pageSize ?? DEFAULT_PAGE_SIZE));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createClient();

  let query = supabase
    .from("companies")
    .select(
      `
      *,
      assignments:company_assignments!company_assignments_company_id_fkey (
        is_primary,
        role,
        manager:profiles!company_assignments_internal_user_id_fkey (
          id,
          full_name
        )
      )
      `,
      { count: "exact" },
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.search?.trim()) {
    const term = `%${params.search.trim()}%`;
    query = query.or(
      `name.ilike.${term},code.ilike.${term},email.ilike.${term},phone.ilike.${term}`,
    );
  }

  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  type AssignmentJoin = {
    is_primary: boolean;
    role: string;
    manager: { id: string; full_name: string } | null;
  };

  const rows: CustomerListItem[] = (data ?? []).map((row) => {
    const assignments = (row as { assignments?: AssignmentJoin[] }).assignments ?? [];
    const primary =
      assignments.find((a) => a.is_primary && a.role === "account_manager") ??
      assignments.find((a) => a.role === "account_manager") ??
      null;
    const { assignments: _drop, ...rest } = row as CompanyRow & {
      assignments?: AssignmentJoin[];
    };
    void _drop;
    return {
      ...(rest as CompanyRow),
      primary_account_manager: primary?.manager ?? null,
    };
  });

  return { rows, total: count ?? 0, page, pageSize };
}

export type CustomerStats = {
  total: number;
  active: number;
  paused: number;
  ended: number;
};

export async function getCustomerStats(): Promise<CustomerStats> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select("status")
    .is("deleted_at", null);

  if (error) throw new Error(error.message);

  const stats = { total: 0, active: 0, paused: 0, ended: 0 };
  for (const row of data ?? []) {
    stats.total += 1;
    if (row.status === "active") stats.active += 1;
    else if (row.status === "paused") stats.paused += 1;
    else if (row.status === "ended") stats.ended += 1;
  }
  return stats;
}

export type CustomerDetail = CompanyRow & {
  primary_account_manager: { id: string; full_name: string } | null;
  assignments: Array<{
    id: string;
    role: string;
    is_primary: boolean;
    manager: { id: string; full_name: string } | null;
  }>;
};

export async function getCustomerById(id: string): Promise<CustomerDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select(
      `
      *,
      assignments:company_assignments!company_assignments_company_id_fkey (
        id,
        role,
        is_primary,
        manager:profiles!company_assignments_internal_user_id_fkey (
          id,
          full_name
        )
      )
      `,
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  type Assignment = {
    id: string;
    role: string;
    is_primary: boolean;
    manager: { id: string; full_name: string } | null;
  };
  const assignments: Assignment[] =
    (data as { assignments?: Assignment[] }).assignments ?? [];
  const primary =
    assignments.find((a) => a.is_primary && a.role === "account_manager") ??
    assignments.find((a) => a.role === "account_manager") ??
    null;

  const { assignments: _drop, ...rest } = data as CompanyRow & {
    assignments?: Assignment[];
  };
  void _drop;
  return {
    ...(rest as CompanyRow),
    primary_account_manager: primary?.manager ?? null,
    assignments,
  };
}

export async function listInternalStaff(): Promise<
  Array<{ id: string; full_name: string; internal_role: string | null }>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, internal_role")
    .eq("audience", "internal")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("full_name");
  if (error) throw new Error(error.message);
  return data ?? [];
}
