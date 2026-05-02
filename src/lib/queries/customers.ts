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
  /** Profile of the user who initially inserted the customer row. */
  creator: { id: string; full_name: string } | null;
  assignments: Array<{
    id: string;
    role: string;
    is_primary: boolean;
    manager: { id: string; full_name: string } | null;
  }>;
  service_ids: string[];
  services: Array<{ id: string; name: string; category: string | null }>;
};

export async function getCustomerById(id: string): Promise<CustomerDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select(
      `
      *,
      creator:profiles!companies_created_by_fkey (
        id,
        full_name
      ),
      assignments:company_assignments!company_assignments_company_id_fkey (
        id,
        role,
        is_primary,
        manager:profiles!company_assignments_internal_user_id_fkey (
          id,
          full_name
        )
      ),
      company_services!company_services_company_id_fkey (
        service:services!company_services_service_id_fkey (
          id,
          name,
          category
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
  type ServiceLink = {
    service: { id: string; name: string; category: string | null } | null;
  };
  const assignments: Assignment[] =
    (data as { assignments?: Assignment[] }).assignments ?? [];
  const primary =
    assignments.find((a) => a.is_primary && a.role === "account_manager") ??
    assignments.find((a) => a.role === "account_manager") ??
    null;
  const serviceLinks: ServiceLink[] =
    (data as { company_services?: ServiceLink[] }).company_services ?? [];
  const services = serviceLinks
    .map((l) => l.service)
    .filter((s): s is { id: string; name: string; category: string | null } => !!s);

  const creator =
    (data as { creator?: { id: string; full_name: string } | null }).creator ??
    null;

  const {
    assignments: _drop1,
    company_services: _drop2,
    creator: _drop3,
    ...rest
  } = data as CompanyRow & {
    assignments?: Assignment[];
    company_services?: ServiceLink[];
    creator?: { id: string; full_name: string } | null;
  };
  void _drop1;
  void _drop2;
  void _drop3;
  return {
    ...(rest as CompanyRow),
    primary_account_manager: primary?.manager ?? null,
    creator,
    assignments,
    service_ids: services.map((s) => s.id),
    services,
  };
}

export async function listActiveServicesGrouped(): Promise<
  Array<{ id: string; name: string; category: string | null; code: string | null }>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select("id, name, category, code")
    .eq("is_active", true)
    .order("category", { ascending: true, nullsFirst: false })
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{
    id: string;
    name: string;
    category: string | null;
    code: string | null;
  }>;
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

export type CompanyMember = {
  user_id: string;
  role: "owner" | "marketing_manager" | "viewer";
  created_at: string;
  profile: {
    id: string;
    full_name: string;
    email: string | null;
    is_active: boolean;
  };
};

/** Customer profiles linked to a company via `company_members`. */
export async function listCompanyMembers(
  companyId: string,
): Promise<CompanyMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("company_members")
    .select(
      `
      user_id,
      role,
      created_at,
      profile:profiles!company_members_user_id_fkey (
        id,
        full_name,
        email,
        is_active
      )
      `,
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  type Row = {
    user_id: string;
    role: CompanyMember["role"];
    created_at: string;
    profile: CompanyMember["profile"] | null;
  };

  return ((data ?? []) as unknown as Row[])
    .filter((r): r is Row & { profile: CompanyMember["profile"] } => !!r.profile)
    .map((r) => ({
      user_id: r.user_id,
      role: r.role,
      created_at: r.created_at,
      profile: r.profile,
    }));
}
