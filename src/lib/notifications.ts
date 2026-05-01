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

/** Returns profile IDs of all active internal admins / super_admins. */
export async function listAdminRecipientIds(): Promise<string[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .select("id")
      .eq("audience", "internal")
      .in("internal_role", ["super_admin", "admin"])
      .eq("is_active", true)
      .is("deleted_at", null);
    if (error) {
      console.error("[notifications] failed to list admins", error);
      return [];
    }
    return (data ?? []).map((r) => r.id);
  } catch (err) {
    console.error("[notifications] unexpected error", err);
    return [];
  }
}
