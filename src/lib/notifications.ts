import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { NotificationChannel } from "@/lib/database.types";

export type NotifyArgs = {
  user_id: string;
  company_id?: string | null;
  channel?: NotificationChannel;
  title: string;
  body?: string | null;
  link_url?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
};

/**
 * Bulk insert in-app notifications. Uses service-role to bypass RLS, since
 * notifications are written on behalf of the system, not a specific user.
 * Failure is non-fatal — we log to the server console but never throw,
 * because losing a notification should not break the user-facing action.
 */
export async function notify(items: NotifyArgs[]): Promise<void> {
  if (items.length === 0) return;
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("notifications").insert(
      items.map((it) => ({
        user_id: it.user_id,
        company_id: it.company_id ?? null,
        channel: it.channel ?? "in_app",
        title: it.title,
        body: it.body ?? null,
        link_url: it.link_url ?? null,
        entity_type: it.entity_type ?? null,
        entity_id: it.entity_id ?? null,
        read_at: null,
        metadata: {},
      })),
    );
    if (error) {
      console.error("[notifications] insert failed", error);
    }
  } catch (err) {
    console.error("[notifications] unexpected error", err);
  }
}

/** Active super_admin / admin / manager — admin tier broadly. Mở rộng
 *  từ 2 → 3 role 2026-05-04 vì manager cũng cần biết khi có sự kiện
 *  vận hành quan trọng (ticket, báo cáo, KH mới...). */
export async function listAdminRecipientIds(): Promise<string[]> {
  return listInternalRecipientIdsByRoles([
    "super_admin",
    "admin",
    "manager",
  ]);
}

/** Audience cho ticket events: admin tier + support (CSKH). PRD §3:
 *  Support là người xử lý ticket đầu tiên — phải nhận notification ngay
 *  khi KH tạo ticket. */
export async function listTicketSupportRecipientIds(): Promise<string[]> {
  return listInternalRecipientIdsByRoles([
    "super_admin",
    "admin",
    "manager",
    "support",
  ]);
}

/**
 * Lọc danh sách userId, chỉ giữ lại những user có audience='internal'
 * + is_active + chưa soft-delete. Dùng cho chuông in-app: theo policy
 * nội bộ, KH không bao giờ nhận chuông từ comment (chỉ nhận email cho
 * ticket public reply). Internal-only ngăn KH bị spam chuông và tránh
 * leak metadata internal-only.
 */
export async function filterInternalActiveIds(
  ids: string[],
): Promise<string[]> {
  if (ids.length === 0) return [];
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .select("id")
      .in("id", ids)
      .eq("audience", "internal")
      .eq("is_active", true)
      .is("deleted_at", null);
    if (error) {
      console.error("[notifications] filterInternalActiveIds failed", error);
      return [];
    }
    const allowed = new Set((data ?? []).map((r) => r.id as string));
    return ids.filter((id) => allowed.has(id));
  } catch (err) {
    console.error("[notifications] filterInternalActiveIds unexpected", err);
    return [];
  }
}

async function listInternalRecipientIdsByRoles(
  roles: string[],
): Promise<string[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .select("id")
      .eq("audience", "internal")
      .in("internal_role", roles)
      .eq("is_active", true)
      .is("deleted_at", null);
    if (error) {
      console.error("[notifications] failed to list recipients", error);
      return [];
    }
    return (data ?? []).map((r) => r.id);
  } catch (err) {
    console.error("[notifications] unexpected error", err);
    return [];
  }
}
