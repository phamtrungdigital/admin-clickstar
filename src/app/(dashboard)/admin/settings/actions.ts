"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  KEY_MAP,
  settingsSchema,
  type SettingsInput,
} from "@/lib/validation/settings";
import { logAudit } from "@/lib/audit";

export type SettingsActionResult =
  | { ok: true; data?: { applied: number } }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

function flattenZodErrors(error: import("zod").ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

async function requireSuperAdmin(): Promise<{ id: string } | SettingsActionResult> {
  const { id, profile } = await getCurrentUser();
  if (
    !profile ||
    profile.audience !== "internal" ||
    profile.internal_role !== "super_admin"
  ) {
    return {
      ok: false,
      message: "Chỉ Super Admin được sửa cài đặt hệ thống.",
    };
  }
  return { id };
}

export async function updateSystemSettingsAction(
  input: SettingsInput,
): Promise<SettingsActionResult> {
  const guard = await requireSuperAdmin();
  if ("ok" in guard) return guard;

  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Dữ liệu không hợp lệ",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }

  const admin = createAdminClient();

  const dbKeys = Object.values(KEY_MAP);
  const { data: existing } = await admin
    .from("system_settings")
    .select("key, value")
    .in("key", dbKeys);

  const oldMap = new Map<string, unknown>();
  for (const row of (existing ?? []) as Array<{ key: string; value: unknown }>) {
    oldMap.set(row.key, row.value);
  }

  const rows = (Object.entries(KEY_MAP) as Array<
    [keyof SettingsInput, string]
  >).map(([formKey, dbKey]) => ({
    key: dbKey,
    value: parsed.data[formKey] as unknown,
    updated_by: guard.id,
  }));

  const diffs = rows.filter(
    (r) => JSON.stringify(oldMap.get(r.key)) !== JSON.stringify(r.value),
  );
  if (diffs.length === 0) return { ok: true, data: { applied: 0 } };

  const { error } = await admin.from("system_settings").upsert(diffs, {
    onConflict: "key",
  });
  if (error) return { ok: false, message: error.message };

  await Promise.all(
    diffs.map((d) =>
      logAudit({
        user_id: guard.id,
        action: "update",
        entity_type: "system_settings",
        entity_id: null,
        old_value: { key: d.key, value: oldMap.get(d.key) ?? null },
        new_value: { key: d.key, value: d.value },
      }),
    ),
  );

  revalidatePath("/admin/settings");
  return { ok: true, data: { applied: diffs.length } };
}
