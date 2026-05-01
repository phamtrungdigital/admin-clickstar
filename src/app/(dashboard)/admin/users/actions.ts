"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createUserSchema,
  updateUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
} from "@/lib/validation/users";
import { getCurrentUser } from "@/lib/auth/current-user";

export type UserActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

function flattenZodErrors(error: import("zod").ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

type RequireAdminFailure = {
  ok: false;
  message: string;
};

async function requireAdmin(): Promise<RequireAdminFailure | null> {
  const { profile } = await getCurrentUser();
  if (
    !profile ||
    profile.audience !== "internal" ||
    !profile.internal_role ||
    !["super_admin", "admin"].includes(profile.internal_role)
  ) {
    return { ok: false, message: "Bạn không có quyền thực hiện thao tác này." };
  }
  return null;
}

/**
 * Create a new user. Uses service_role admin client to provision auth.users
 * with a known initial password — admin gives it to the user, who can then
 * change it via the standard reset/profile flow. The `handle_new_user`
 * Postgres trigger will mirror the user_metadata into a new profiles row.
 */
export async function createUserAction(
  input: CreateUserInput,
): Promise<UserActionResult<{ id: string }>> {
  const guard = await requireAdmin();
  if (guard) return guard;

  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Dữ liệu không hợp lệ",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }
  const data = parsed.data;

  const admin = createAdminClient();
  const { data: created, error } = await admin.auth.admin.createUser({
    email: data.email.toLowerCase(),
    password: data.password,
    email_confirm: true,
    user_metadata: {
      full_name: data.full_name,
      audience: data.audience,
      internal_role: data.audience === "internal" ? data.internal_role : null,
      phone: data.phone || null,
    },
  });

  if (error || !created.user) {
    return {
      ok: false,
      message: error?.message ?? "Không tạo được tài khoản",
    };
  }

  // Apply is_active + phone (the trigger may not pick those up depending on schema).
  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({
      is_active: data.is_active,
      phone: data.phone || null,
    })
    .eq("id", created.user.id);

  revalidatePath("/admin/users");
  return { ok: true, data: { id: created.user.id } };
}

export async function updateUserAction(
  id: string,
  input: UpdateUserInput,
): Promise<UserActionResult> {
  const guard = await requireAdmin();
  if (guard) return guard;

  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Dữ liệu không hợp lệ",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update(parsed.data)
    .eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${id}`);
  return { ok: true };
}

export async function toggleUserActiveAction(
  id: string,
  next: boolean,
): Promise<UserActionResult> {
  const guard = await requireAdmin();
  if (guard) return guard;

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ is_active: next })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${id}`);
  return { ok: true };
}

/**
 * Bulk reassign every company_assignments row from `fromUserId` to
 * `toUserId`. Useful when offboarding a staff member: prevents orphaned
 * customers without account managers.
 */
export async function reassignAllAssignmentsAction(
  fromUserId: string,
  toUserId: string,
): Promise<UserActionResult<{ moved: number }>> {
  const guard = await requireAdmin();
  if (guard) return guard;

  if (fromUserId === toUserId) {
    return { ok: false, message: "Không thể chuyển về chính người đó" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("company_assignments")
    .update({ internal_user_id: toUserId })
    .eq("internal_user_id", fromUserId)
    .select("id");
  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${fromUserId}`);
  revalidatePath(`/admin/users/${toUserId}`);
  return { ok: true, data: { moved: data?.length ?? 0 } };
}

export async function softDeleteUserAction(
  id: string,
): Promise<UserActionResult> {
  const guard = await requireAdmin();
  if (guard) return guard;

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/users");
  return { ok: true };
}
