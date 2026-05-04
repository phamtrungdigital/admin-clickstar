"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import {
  changeMyPasswordSchema,
  updateMyProfileSchema,
  type ChangeMyPasswordInput,
  type UpdateMyProfileInput,
} from "@/lib/validation/account-settings";

export type SettingsActionResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

function flattenZodErrors(
  error: import("zod").ZodError,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export async function updateMyProfileAction(
  input: UpdateMyProfileInput,
): Promise<SettingsActionResult> {
  const parsed = updateMyProfileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Dữ liệu không hợp lệ",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Vui lòng đăng nhập lại" };

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      phone: parsed.data.phone || null,
      avatar_url: parsed.data.avatar_url || null,
    })
    .eq("id", user.id);
  if (error) return { ok: false, message: error.message };

  await logAudit({
    user_id: user.id,
    action: "update",
    entity_type: "profile",
    entity_id: user.id,
    new_value: {
      full_name: parsed.data.full_name,
      phone: parsed.data.phone || null,
    },
  });

  revalidatePath("/settings");
  return { ok: true };
}

/**
 * Change password using the user's authenticated session — Supabase
 * Auth verifies the current session is valid (so a stolen browser tab
 * still requires the original session). We don't ask for "current
 * password" again because Supabase JS doesn't expose a "verify-then-
 * update" primitive without a signed-in user; the session itself is
 * the verification. If the user is logged in, they can change pw.
 */
export async function changeMyPasswordAction(
  input: ChangeMyPasswordInput,
): Promise<SettingsActionResult> {
  const parsed = changeMyPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Mật khẩu chưa hợp lệ",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Vui lòng đăng nhập lại" };

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.new_password,
  });
  if (error) return { ok: false, message: error.message };

  await logAudit({
    user_id: user.id,
    action: "update",
    entity_type: "profile",
    entity_id: user.id,
    new_value: { kind: "password_changed" },
  });

  revalidatePath("/settings");
  return { ok: true };
}
