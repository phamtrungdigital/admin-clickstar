import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  ContractRow,
  ContractServiceRow,
  ContractStatus,
  ServiceRow,
} from "@/lib/database.types";

export type ContractListItem = ContractRow & {
  company: { id: string; name: string } | null;
  service_count: number;
};

export type ContractListParams = {
  search?: string;
  status?: ContractStatus | "all";
  company_id?: string;
  page?: number;
  pageSize?: number;
};

export type ContractListResult = {
  rows: ContractListItem[];
  total: number;
  page: number;
  pageSize: number;
};

const DEFAULT_PAGE_SIZE = 20;

export async function listContracts(
  params: ContractListParams = {},
): Promise<ContractListResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.max(
    1,
    Math.min(100, params.pageSize ?? DEFAULT_PAGE_SIZE),
  );
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createClient();
  let query = supabase
    .from("contracts")
    .select(
      `
      *,
      company:companies!contracts_company_id_fkey ( id, name ),
      contract_services ( id )
      `,
      { count: "exact" },
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.search?.trim()) {
    const term = `%${params.search.trim()}%`;
    query = query.or(`name.ilike.${term},code.ilike.${term}`);
  }
  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }
  if (params.company_id) {
    query = query.eq("company_id", params.company_id);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const rows: ContractListItem[] = (data ?? []).map((row) => {
    const r = row as ContractRow & {
      company?: { id: string; name: string } | null;
      contract_services?: { id: string }[];
    };
    return {
      ...(r as ContractRow),
      company: r.company ?? null,
      service_count: r.contract_services?.length ?? 0,
    };
  });

  return { rows, total: count ?? 0, page, pageSize };
}

export type ContractStats = {
  total: number;
  active: number;
  draft: number;
  completed: number;
  total_value: number;
};

export async function getContractStats(): Promise<ContractStats> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contracts")
    .select("status, total_value")
    .is("deleted_at", null);
  if (error) throw new Error(error.message);

  const stats: ContractStats = {
    total: 0,
    active: 0,
    draft: 0,
    completed: 0,
    total_value: 0,
  };
  for (const row of data ?? []) {
    stats.total += 1;
    stats.total_value += Number(row.total_value ?? 0);
    if (row.status === "active") stats.active += 1;
    else if (row.status === "draft") stats.draft += 1;
    else if (row.status === "completed") stats.completed += 1;
  }
  return stats;
}

export type ContractDetail = ContractRow & {
  company: { id: string; name: string; code: string | null } | null;
  services: Array<
    ContractServiceRow & {
      service: ServiceRow | null;
    }
  >;
};

export async function getContractById(
  id: string,
): Promise<ContractDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contracts")
    .select(
      `
      *,
      company:companies!contracts_company_id_fkey ( id, name, code ),
      services:contract_services!contract_services_contract_id_fkey (
        *,
        service:services!contract_services_service_id_fkey ( * )
      )
      `,
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const r = data as ContractRow & {
    company?: ContractDetail["company"];
    services?: ContractDetail["services"];
  };
  return {
    ...(r as ContractRow),
    company: r.company ?? null,
    services: r.services ?? [],
  };
}

/** Lightweight company list for dropdowns. */
export async function listActiveCompaniesForSelect(): Promise<
  Array<{ id: string; name: string; code: string | null }>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, code")
    .is("deleted_at", null)
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{ id: string; name: string; code: string | null }>;
}

export type ServiceOption = {
  id: string;
  name: string;
  code: string | null;
  category: string | null;
  default_price: number;
  billing_cycle: string | null;
};

/** Active services available for adding to a contract. */
export async function listActiveServicesForSelect(): Promise<ServiceOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select("id, name, code, category, default_price, billing_cycle")
    .eq("is_active", true)
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as ServiceOption[];
}
