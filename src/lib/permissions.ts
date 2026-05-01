import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { InternalRole } from "@/lib/database.types";

export type PermissionLevel = "none" | "view" | "scoped" | "manage" | "full";

export type PermissionScope =
  | "users"
  | "customers"
  | "contracts"
  | "services"
  | "tasks"
  | "tickets"
  | "documents"
  | "reports"
  | "settings";

export const SCOPES: Array<{ key: PermissionScope; label: string }> = [
  { key: "users", label: "Người dùng" },
  { key: "customers", label: "Khách hàng" },
  { key: "contracts", label: "Hợp đồng" },
  { key: "services", label: "Dịch vụ" },
  { key: "tasks", label: "Công việc" },
  { key: "tickets", label: "Ticket" },
  { key: "documents", label: "Tài liệu" },
  { key: "reports", label: "Báo cáo" },
  { key: "settings", label: "Cài đặt hệ thống" },
];

export const LEVELS: Array<{ key: PermissionLevel; label: string }> = [
  { key: "none", label: "Không có" },
  { key: "view", label: "Chỉ xem" },
  { key: "scoped", label: "Theo phân công" },
  { key: "manage", label: "Tạo / sửa / xoá" },
  { key: "full", label: "Toàn quyền" },
];

const LEVEL_RANK: Record<PermissionLevel, number> = {
  none: 0,
  view: 1,
  scoped: 2,
  manage: 3,
  full: 4,
};

export function levelMeetsMinimum(
  current: PermissionLevel,
  required: PermissionLevel,
): boolean {
  return LEVEL_RANK[current] >= LEVEL_RANK[required];
}

export type PermissionRow = {
  role: InternalRole;
  scope: PermissionScope;
  level: PermissionLevel;
};

/** Read all (role, scope) → level rows. Cached per request via React. */
export async function listRolePermissions(): Promise<PermissionRow[]> {
  // Use service role so admins viewing /admin/roles always get the full
  // matrix even if their role's "view" on settings is restricted later.
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("role_permissions")
    .select("role, scope, level");
  if (error) throw new Error(error.message);
  return (data ?? []) as PermissionRow[];
}

/**
 * Get the level a specific role has on a specific scope. Falls back to
 * 'none' if the row doesn't exist (so adding a new scope without seeding
 * locks it down by default — fail-closed).
 */
export async function getPermissionLevel(
  role: InternalRole,
  scope: PermissionScope,
): Promise<PermissionLevel> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("role_permissions")
    .select("level")
    .eq("role", role)
    .eq("scope", scope)
    .maybeSingle();
  if (error || !data) return "none";
  return (data.level ?? "none") as PermissionLevel;
}

/**
 * Server-side action gate. Returns true if the currently logged-in user's
 * role meets the minimum level on the given scope. Customer-side audience
 * always returns false here — customer permissions are handled separately.
 */
export async function currentUserCan(
  scope: PermissionScope,
  minLevel: PermissionLevel,
): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("audience, internal_role")
    .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "")
    .maybeSingle();
  if (error || !data) return false;
  if (data.audience !== "internal" || !data.internal_role) return false;
  const lvl = await getPermissionLevel(
    data.internal_role as InternalRole,
    scope,
  );
  return levelMeetsMinimum(lvl, minLevel);
}
