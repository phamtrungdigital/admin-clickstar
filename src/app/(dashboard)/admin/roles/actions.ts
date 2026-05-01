"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/current-user";
import { INTERNAL_ROLES } from "@/lib/validation/users";

const LEVELS = ["none", "view", "scoped", "manage", "full"] as const;
const SCOPES = [
  "users",
  "customers",
  "contracts",
  "services",
  "tasks",
  "tickets",
  "documents",
  "reports",
  "settings",
] as const;

const updatePermissionsSchema = z.object({
  changes: z.array(
    z.object({
      role: z.enum(INTERNAL_ROLES),
      scope: z.enum(SCOPES),
      level: z.enum(LEVELS),
    }),
  ),
});

export type RolesActionResult =
  | { ok: true; data?: { applied: number } }
  | { ok: false; message: string };

async function requireSuperAdmin(): Promise<{ id: string } | RolesActionResult> {
  const { id, profile } = await getCurrentUser();
  if (
    !profile ||
    profile.audience !== "internal" ||
    profile.internal_role !== "super_admin"
  ) {
    return {
      ok: false,
      message: "Chỉ Super Admin được sửa phân quyền.",
    };
  }
  return { id };
}

/**
 * Bulk update permissions matrix. Only changed cells need to be sent —
 * we'll fetch current state, diff, write changes, and audit each one.
 */
export async function updateRolePermissionsAction(
  changes: Array<{ role: string; scope: string; level: string }>,
): Promise<RolesActionResult> {
  const guard = await requireSuperAdmin();
  if ("ok" in guard) return guard;

  const parsed = updatePermissionsSchema.safeParse({ changes });
  if (!parsed.success) {
    return { ok: false, message: "Dữ liệu không hợp lệ" };
  }
  if (parsed.data.changes.length === 0) {
    return { ok: true, data: { applied: 0 } };
  }

  const admin = createAdminClient();

  // Read current state for the affected (role, scope) pairs so we can
  // record old → new in audit_logs.
  const { data: existing } = await admin
    .from("role_permissions")
    .select("role, scope, level")
    .in(
      "role",
      Array.from(new Set(parsed.data.changes.map((c) => c.role))),
    )
    .in(
      "scope",
      Array.from(new Set(parsed.data.changes.map((c) => c.scope))),
    );

  const oldMap = new Map<string, string>();
  for (const row of (existing ?? []) as Array<{
    role: string;
    scope: string;
    level: string;
  }>) {
    oldMap.set(`${row.role}|${row.scope}`, row.level);
  }

  // Filter to actual diffs (don't write no-ops).
  const diffs = parsed.data.changes.filter((c) => {
    const k = `${c.role}|${c.scope}`;
    return oldMap.get(k) !== c.level;
  });
  if (diffs.length === 0) return { ok: true, data: { applied: 0 } };

  const { error: upsertErr } = await admin.from("role_permissions").upsert(
    diffs.map((d) => ({
      role: d.role,
      scope: d.scope,
      level: d.level,
      updated_by: guard.id,
    })),
    { onConflict: "role,scope" },
  );
  if (upsertErr) return { ok: false, message: upsertErr.message };

  // Audit log (one row per changed cell, fire-and-forget).
  await admin.from("audit_logs").insert(
    diffs.map((d) => ({
      user_id: guard.id,
      action: "update",
      entity_type: "role_permission",
      entity_id: null,
      old_value: { level: oldMap.get(`${d.role}|${d.scope}`) ?? null },
      new_value: { role: d.role, scope: d.scope, level: d.level },
    })),
  );

  // Permissions are read in many places; clear the relevant pages.
  revalidatePath("/admin/roles");
  revalidatePath("/admin");
  // Listing pages render different actions depending on permissions —
  // bust their caches too so toggles take effect immediately for everyone.
  revalidatePath("/customers");
  revalidatePath("/contracts");
  revalidatePath("/services");
  revalidatePath("/tickets");
  revalidatePath("/admin/users");

  return { ok: true, data: { applied: diffs.length } };
}

const DEFAULTS: Record<string, Record<string, string>> = {
  super_admin: {
    users: "full",
    customers: "full",
    contracts: "full",
    services: "full",
    tasks: "full",
    tickets: "full",
    documents: "full",
    reports: "full",
    settings: "full",
  },
  admin: {
    users: "manage",
    customers: "manage",
    contracts: "manage",
    services: "manage",
    tasks: "manage",
    tickets: "manage",
    documents: "manage",
    reports: "view",
    settings: "manage",
  },
  manager: {
    users: "view",
    customers: "scoped",
    contracts: "scoped",
    services: "view",
    tasks: "scoped",
    tickets: "scoped",
    documents: "scoped",
    reports: "view",
    settings: "none",
  },
  staff: {
    users: "none",
    customers: "scoped",
    contracts: "scoped",
    services: "view",
    tasks: "scoped",
    tickets: "scoped",
    documents: "scoped",
    reports: "none",
    settings: "none",
  },
  support: {
    users: "none",
    customers: "scoped",
    contracts: "view",
    services: "view",
    tasks: "view",
    tickets: "scoped",
    documents: "scoped",
    reports: "none",
    settings: "none",
  },
  accountant: {
    users: "none",
    customers: "view",
    contracts: "manage",
    services: "view",
    tasks: "none",
    tickets: "none",
    documents: "scoped",
    reports: "view",
    settings: "none",
  },
};

export async function resetPermissionsToDefaultsAction(): Promise<RolesActionResult> {
  const guard = await requireSuperAdmin();
  if ("ok" in guard) return guard;

  const changes: Array<{ role: string; scope: string; level: string }> = [];
  for (const [role, scopes] of Object.entries(DEFAULTS)) {
    for (const [scope, level] of Object.entries(scopes)) {
      changes.push({ role, scope, level });
    }
  }
  return updateRolePermissionsAction(changes);
}
