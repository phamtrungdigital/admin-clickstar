import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { headers } from "next/headers";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "activate"
  | "deactivate"
  | "login"
  | "logout"
  | "send_email"
  | "send_zns";

export type AuditEntityType =
  | "profile"
  | "company"
  | "contract"
  | "service"
  | "task"
  | "ticket"
  | "document"
  | "role_permission";

export type AuditInput = {
  user_id: string | null;
  company_id?: string | null;
  action: AuditAction;
  entity_type: AuditEntityType;
  entity_id?: string | null;
  old_value?: unknown;
  new_value?: unknown;
};

/**
 * Append-only audit logger. Uses service-role to bypass RLS — the
 * audit_logs table is read-only for end users (super_admin reviews via
 * /admin/activity). Failure is non-fatal: we log to the server console
 * but never throw, because the user's primary action shouldn't be
 * blocked by an audit write.
 */
export async function logAudit(input: AuditInput): Promise<void> {
  try {
    const admin = createAdminClient();

    // Best-effort capture of request metadata. headers() works in any
    // server function inside the Next App Router request scope.
    let ip: string | null = null;
    let ua: string | null = null;
    try {
      const h = await headers();
      ip =
        h.get("x-forwarded-for")?.split(",")[0].trim() ??
        h.get("x-real-ip") ??
        null;
      ua = h.get("user-agent");
    } catch {
      // Outside request context — fine.
    }

    const { error } = await admin.from("audit_logs").insert({
      user_id: input.user_id,
      company_id: input.company_id ?? null,
      action: input.action,
      entity_type: input.entity_type,
      entity_id: input.entity_id ?? null,
      old_value: input.old_value ?? null,
      new_value: input.new_value ?? null,
      ip_address: ip,
      user_agent: ua,
    });
    if (error) {
      console.error("[audit] insert failed", error);
    }
  } catch (err) {
    console.error("[audit] unexpected error", err);
  }
}

export type AuditLogRow = {
  id: number;
  user_id: string | null;
  company_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_value: unknown;
  new_value: unknown;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

export type AuditListItem = AuditLogRow & {
  user: { id: string; full_name: string } | null;
  company: { id: string; name: string } | null;
};

export type AuditListParams = {
  search?: string;
  action?: string;
  entity_type?: string;
  user_id?: string;
  page?: number;
  pageSize?: number;
};

const DEFAULT_PAGE_SIZE = 30;

export async function listAuditLogs(
  params: AuditListParams = {},
): Promise<{
  rows: AuditListItem[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.max(
    1,
    Math.min(100, params.pageSize ?? DEFAULT_PAGE_SIZE),
  );
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const admin = createAdminClient();

  let query = admin
    .from("audit_logs")
    .select(
      `
      *,
      user:profiles!audit_logs_user_id_fkey (id, full_name),
      company:companies!audit_logs_company_id_fkey (id, name)
      `,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.action && params.action !== "all") {
    query = query.eq("action", params.action);
  }
  if (params.entity_type && params.entity_type !== "all") {
    query = query.eq("entity_type", params.entity_type);
  }
  if (params.user_id) {
    query = query.eq("user_id", params.user_id);
  }
  if (params.search?.trim()) {
    const term = `%${params.search.trim()}%`;
    query = query.or(`entity_type.ilike.${term},action.ilike.${term}`);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  return {
    rows: (data ?? []) as unknown as AuditListItem[],
    total: count ?? 0,
    page,
    pageSize,
  };
}
