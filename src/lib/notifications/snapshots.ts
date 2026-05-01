import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type SnapshotNotificationContext = {
  snapshotId: string;
  projectId: string;
  projectName: string;
  companyId: string;
  createdBy: string;
};

type NotificationRow = {
  user_id: string;
  company_id: string | null;
  channel: "in_app" | "email" | "zns";
  title: string;
  body: string;
  link_url: string;
  entity_type: string;
  entity_id: string;
};

/**
 * Insert in-app notifications via the service-role admin client.
 * The notifications table only allows service-role writes by design
 * (RLS in 0011), so we bypass user RLS here on purpose.
 */
async function insertNotifications(rows: NotificationRow[]): Promise<void> {
  if (rows.length === 0) return;
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("notifications").insert(rows);
    if (error) console.error("[notifications/snapshot] insert failed", error);
  } catch (err) {
    console.error("[notifications/snapshot] unexpected error", err);
  }
}

async function listAdmins(): Promise<string[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("audience", "internal")
    .eq("is_active", true)
    .is("deleted_at", null)
    .in("internal_role", ["super_admin", "admin"]);
  if (error) {
    console.error("[notifications/snapshot] listAdmins failed", error);
    return [];
  }
  return ((data ?? []) as { id: string }[]).map((r) => r.id);
}

async function listCustomersOfCompany(companyId: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("company_members")
    .select("user_id")
    .eq("company_id", companyId);
  if (error) {
    console.error("[notifications/snapshot] listCustomers failed", error);
    return [];
  }
  return ((data ?? []) as { user_id: string }[]).map((r) => r.user_id);
}

/**
 * Snapshot was just created and is pending approval. Notify every
 * super_admin / admin so someone reviews it. Excludes the creator
 * (they don't need to notify themselves).
 */
export async function notifySnapshotCreated(
  ctx: SnapshotNotificationContext,
  type: string,
): Promise<void> {
  const adminIds = (await listAdmins()).filter((id) => id !== ctx.createdBy);
  const link = `/projects/${ctx.projectId}`;
  const title = "Snapshot mới chờ duyệt";
  const body = `Dự án "${ctx.projectName}" có snapshot ${type} mới. Bấm để xem và duyệt.`;
  await insertNotifications(
    adminIds.map((user_id) => ({
      user_id,
      company_id: ctx.companyId,
      channel: "in_app",
      title,
      body,
      link_url: link,
      entity_type: "snapshot",
      entity_id: ctx.snapshotId,
    })),
  );
}

/**
 * Snapshot was just approved (manually). Notify every customer linked to
 * the project's company so they know there's new content to look at.
 * Also notify the PM who created it.
 */
export async function notifySnapshotApproved(
  ctx: SnapshotNotificationContext,
): Promise<void> {
  const customerIds = await listCustomersOfCompany(ctx.companyId);
  const link = `/projects/${ctx.projectId}`;
  const customerNotis: NotificationRow[] = customerIds.map((user_id) => ({
    user_id,
    company_id: ctx.companyId,
    channel: "in_app",
    title: `Có cập nhật mới: ${ctx.projectName}`,
    body: "Clickstar vừa công bố tiến độ mới. Bấm để xem chi tiết.",
    link_url: link,
    entity_type: "snapshot",
    entity_id: ctx.snapshotId,
  }));
  const creatorNoti: NotificationRow = {
    user_id: ctx.createdBy,
    company_id: ctx.companyId,
    channel: "in_app",
    title: "Snapshot đã được duyệt",
    body: `Snapshot dự án "${ctx.projectName}" đã được admin duyệt và publish cho khách.`,
    link_url: link,
    entity_type: "snapshot",
    entity_id: ctx.snapshotId,
  };
  await insertNotifications([...customerNotis, creatorNoti]);
}

export async function notifySnapshotRejected(
  ctx: SnapshotNotificationContext,
  reason: string,
): Promise<void> {
  const link = `/projects/${ctx.projectId}`;
  await insertNotifications([
    {
      user_id: ctx.createdBy,
      company_id: ctx.companyId,
      channel: "in_app",
      title: "Snapshot bị từ chối",
      body: `Admin đã từ chối snapshot dự án "${ctx.projectName}". Lý do: ${reason}`,
      link_url: link,
      entity_type: "snapshot",
      entity_id: ctx.snapshotId,
    },
  ]);
}

export async function notifySnapshotRolledBack(
  ctx: SnapshotNotificationContext,
  reason: string,
): Promise<void> {
  const customerIds = await listCustomersOfCompany(ctx.companyId);
  const link = `/projects/${ctx.projectId}`;
  await insertNotifications([
    {
      user_id: ctx.createdBy,
      company_id: ctx.companyId,
      channel: "in_app",
      title: "Snapshot đã bị rollback",
      body: `Admin đã rollback snapshot dự án "${ctx.projectName}". Lý do: ${reason}`,
      link_url: link,
      entity_type: "snapshot",
      entity_id: ctx.snapshotId,
    },
    ...customerIds.map<NotificationRow>((user_id) => ({
      user_id,
      company_id: ctx.companyId,
      channel: "in_app",
      title: `Cập nhật trên dự án "${ctx.projectName}" đã được thu hồi`,
      body: "Bản tổng hợp gần nhất đã được rút lại — bản tiếp theo sẽ sớm có.",
      link_url: link,
      entity_type: "snapshot",
      entity_id: ctx.snapshotId,
    })),
  ]);
}
