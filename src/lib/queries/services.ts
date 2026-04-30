import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ServiceRow } from "@/lib/database.types";

export type ServiceListItem = ServiceRow & {
  customers_using: number;
};

export type ServiceListParams = {
  search?: string;
  category?: string | "all";
  status?: "active" | "paused" | "all";
  page?: number;
  pageSize?: number;
};

export type ServiceListResult = {
  rows: ServiceListItem[];
  total: number;
  page: number;
  pageSize: number;
};

const DEFAULT_PAGE_SIZE = 20;

export async function listServices(
  params: ServiceListParams = {},
): Promise<ServiceListResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.max(
    1,
    Math.min(100, params.pageSize ?? DEFAULT_PAGE_SIZE),
  );
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createClient();

  let query = supabase
    .from("services")
    .select(
      `
      *,
      contract_services_aggregate:contract_services!contract_services_service_id_fkey (
        contract_id
      )
      `,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.search?.trim()) {
    const term = `%${params.search.trim()}%`;
    query = query.or(`name.ilike.${term},code.ilike.${term},category.ilike.${term}`);
  }

  if (params.category && params.category !== "all") {
    query = query.eq("category", params.category);
  }

  if (params.status === "active") query = query.eq("is_active", true);
  if (params.status === "paused") query = query.eq("is_active", false);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  type Aggregate = { contract_id: string }[];
  const rows: ServiceListItem[] = (data ?? []).map((row) => {
    const aggregate =
      ((row as { contract_services_aggregate?: Aggregate })
        .contract_services_aggregate ?? []) as Aggregate;
    const uniqueContracts = new Set(aggregate.map((r) => r.contract_id));
    const { contract_services_aggregate: _drop, ...rest } = row as ServiceRow & {
      contract_services_aggregate?: Aggregate;
    };
    void _drop;
    return {
      ...(rest as ServiceRow),
      customers_using: uniqueContracts.size,
    };
  });

  return { rows, total: count ?? 0, page, pageSize };
}

export type ServiceStats = {
  total: number;
  active: number;
  paused: number;
};

export async function getServiceStats(): Promise<ServiceStats> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("services").select("is_active");
  if (error) throw new Error(error.message);

  const stats = { total: 0, active: 0, paused: 0 };
  for (const row of data ?? []) {
    stats.total += 1;
    if (row.is_active) stats.active += 1;
    else stats.paused += 1;
  }
  return stats;
}

export async function getServiceById(id: string): Promise<ServiceRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ServiceRow | null) ?? null;
}

export async function listDistinctServiceCategories(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select("category")
    .not("category", "is", null);
  if (error) throw new Error(error.message);
  const set = new Set<string>();
  for (const row of data ?? []) {
    if (row.category) set.add(row.category);
  }
  return Array.from(set).sort();
}
