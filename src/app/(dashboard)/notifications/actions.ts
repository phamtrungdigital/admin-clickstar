"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";

/**
 * Đánh dấu tất cả thông báo của user hiện tại là đã đọc.
 *
 * Gọi từ /notifications page khi user mở (server component) — sau khi gọi
 * sẽ revalidate root layout để header bell badge cập nhật ngay khi user
 * điều hướng tiếp theo.
 *
 * Idempotent: chỉ UPDATE rows có read_at IS NULL → an toàn khi gọi nhiều lần.
 */
export async function markAllNotificationsAsReadAction(): Promise<{
  ok: boolean;
  updated: number;
}> {
  const { id: userId } = await getCurrentUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null)
    .select("id");

  if (error) {
    return { ok: false, updated: 0 };
  }

  // Invalidate layout cache → next render sẽ refetch unread count = 0
  revalidatePath("/", "layout");

  return { ok: true, updated: data?.length ?? 0 };
}

/**
 * Đánh dấu 1 thông báo là đã đọc — dùng khi user click vào 1 noti cụ thể.
 */
export async function markNotificationAsReadAction(
  notificationId: string,
): Promise<{ ok: boolean }> {
  const { id: userId } = await getCurrentUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) return { ok: false };

  revalidatePath("/", "layout");
  return { ok: true };
}
