"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isInternal } from "@/lib/auth/guards";

export type MentionStaffOption = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  internal_role: string | null;
};

/**
 * Trả về danh sách internal staff để autocomplete @mention. Customer
 * không gọi được (return []). Không gồm super_admin/admin tier filter
 * — autocomplete cho phép tag bất kỳ ai trong team. Nhân viên ít (<200)
 * nên load 1 lần là OK, không cần search server-side.
 */
export async function listInternalStaffForMention(): Promise<
  MentionStaffOption[]
> {
  const { profile } = await getCurrentUser();
  if (!isInternal(profile)) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, internal_role")
    .eq("audience", "internal")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("full_name");

  if (error) {
    console.error("[mention-staff] list failed", error);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id as string,
    full_name: (r.full_name as string | null) ?? "(chưa đặt tên)",
    avatar_url: (r.avatar_url as string | null) ?? null,
    internal_role: (r.internal_role as string | null) ?? null,
  }));
}
