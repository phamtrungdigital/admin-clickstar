import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { stripMentionsToPlain } from "@/lib/mentions";
import { filterInternalActiveIds } from "@/lib/notifications";
import { notifyMentions } from "@/lib/notifications/mentions";

type TaskNotificationContext = {
  taskId: string;
  taskTitle: string;
  projectId: string | null;
  projectName: string | null;
  companyId: string;
  // Required for routing notifications:
  assigneeId: string | null;
  reviewerId: string | null;
  reporterId: string | null;
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

async function insertNotifications(rows: NotificationRow[]): Promise<void> {
  if (rows.length === 0) return;
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("notifications").insert(rows);
    if (error) console.error("[notifications/task] insert failed", error);
  } catch (err) {
    console.error("[notifications/task] unexpected error", err);
  }
}

const link = (taskId: string) => `/tasks/${taskId}`;

/** Task vừa được giao cho assignee. */
export async function notifyTaskAssigned(
  ctx: TaskNotificationContext,
  actorId: string,
): Promise<void> {
  if (!ctx.assigneeId || ctx.assigneeId === actorId) return;
  await insertNotifications([
    {
      user_id: ctx.assigneeId,
      company_id: ctx.companyId,
      channel: "in_app",
      title: "Anh/chị có task mới",
      body: `Task "${ctx.taskTitle}"${ctx.projectName ? ` (${ctx.projectName})` : ""}.`,
      link_url: link(ctx.taskId),
      entity_type: "task",
      entity_id: ctx.taskId,
    },
  ]);
}

/** NV submit task chờ duyệt → notify reviewer. */
export async function notifyTaskSubmittedForReview(
  ctx: TaskNotificationContext,
  actorId: string,
): Promise<void> {
  if (!ctx.reviewerId || ctx.reviewerId === actorId) return;
  await insertNotifications([
    {
      user_id: ctx.reviewerId,
      company_id: ctx.companyId,
      channel: "in_app",
      title: "Task chờ anh/chị duyệt",
      body: `"${ctx.taskTitle}"${ctx.projectName ? ` (${ctx.projectName})` : ""} đã được submit.`,
      link_url: link(ctx.taskId),
      entity_type: "task",
      entity_id: ctx.taskId,
    },
  ]);
}

/** Reviewer duyệt task → notify assignee. */
export async function notifyTaskApproved(
  ctx: TaskNotificationContext,
  actorId: string,
): Promise<void> {
  if (!ctx.assigneeId || ctx.assigneeId === actorId) return;
  await insertNotifications([
    {
      user_id: ctx.assigneeId,
      company_id: ctx.companyId,
      channel: "in_app",
      title: "Task đã được duyệt",
      body: `"${ctx.taskTitle}" đã được duyệt — task hoàn thành.`,
      link_url: link(ctx.taskId),
      entity_type: "task",
      entity_id: ctx.taskId,
    },
  ]);
}

/** Reviewer trả về task → notify assignee với reason. */
export async function notifyTaskReturned(
  ctx: TaskNotificationContext,
  actorId: string,
  reason: string,
): Promise<void> {
  if (!ctx.assigneeId || ctx.assigneeId === actorId) return;
  await insertNotifications([
    {
      user_id: ctx.assigneeId,
      company_id: ctx.companyId,
      channel: "in_app",
      title: "Task bị trả về",
      body: `"${ctx.taskTitle}" cần sửa lại. Lý do: ${reason}`,
      link_url: link(ctx.taskId),
      entity_type: "task",
      entity_id: ctx.taskId,
    },
  ]);
}

/**
 * Comment mới trong task → notify cho assignee + reviewer + reporter
 * + admin/manager tier. Người được @mention nhận noti riêng (title "tag bạn").
 */
export async function notifyTaskCommented(
  ctx: TaskNotificationContext,
  actorId: string,
  actorName: string,
  body: string,
): Promise<void> {
  const linkUrl = link(ctx.taskId);

  // 1) Mention noti riêng — return set userId đã noti để skip bên dưới
  const mentionedIds = await notifyMentions({
    actorId,
    actorName,
    entityLabel: `công việc "${ctx.taskTitle}"`,
    entityType: "task",
    entityId: ctx.taskId,
    linkUrl,
    companyId: ctx.companyId,
    body,
    alreadyNotifiedUserIds: new Set(),
  });

  const recipients = new Set<string>();

  // 2) Stakeholders trực tiếp của task
  for (const uid of [ctx.assigneeId, ctx.reviewerId, ctx.reporterId]) {
    if (uid && uid !== actorId) recipients.add(uid);
  }

  // 3) Thread participants — tất cả người đã comment trong task
  try {
    const admin = createAdminClient();
    const { data: participants } = await admin
      .from("task_comments")
      .select("author_id")
      .eq("task_id", ctx.taskId);
    for (const p of participants ?? []) {
      const uid = p.author_id as string;
      if (uid && uid !== actorId) recipients.add(uid);
    }

    // 4) Admin tier — luôn gồm super_admin + admin + manager
    const { data: adminRows } = await admin
      .from("profiles")
      .select("id")
      .eq("audience", "internal")
      .eq("is_active", true)
      .is("deleted_at", null)
      .in("internal_role", ["super_admin", "admin", "manager"]);
    for (const r of adminRows ?? []) {
      const uid = r.id as string;
      if (uid && uid !== actorId) recipients.add(uid);
    }
  } catch (err) {
    console.error("[notifyTaskCommented] load recipients failed", err);
  }

  // Loại bỏ user đã nhận noti @mention
  for (const uid of mentionedIds) recipients.delete(uid);

  if (recipients.size === 0) return;

  // Policy: chỉ internal nhận chuông in-app cho task comment. Reporter
  // có thể là KH (KH report task), thread participants có thể bao gồm
  // KH (KH bình luận trước đó). Filter để KH không bị spam chuông.
  const internalOnlyIds = await filterInternalActiveIds(
    Array.from(recipients),
  );
  if (internalOnlyIds.length === 0) return;

  const plain = stripMentionsToPlain(body);
  const preview = plain.length > 120 ? plain.slice(0, 117) + "..." : plain;

  await insertNotifications(
    internalOnlyIds.map((uid) => ({
      user_id: uid,
      company_id: ctx.companyId,
      channel: "in_app" as const,
      title: `${actorName} đã bình luận: ${ctx.taskTitle}`,
      body: preview,
      link_url: linkUrl,
      entity_type: "task",
      entity_id: ctx.taskId,
    })),
  );
}

/** NV báo bị chặn → notify reviewer (hoặc reporter nếu không có reviewer). */
export async function notifyTaskBlocked(
  ctx: TaskNotificationContext,
  actorId: string,
  reason: string,
): Promise<void> {
  const target = ctx.reviewerId ?? ctx.reporterId;
  if (!target || target === actorId) return;
  await insertNotifications([
    {
      user_id: target,
      company_id: ctx.companyId,
      channel: "in_app",
      title: "Task bị chặn",
      body: `"${ctx.taskTitle}" cần xử lý. Lý do: ${reason}`,
      link_url: link(ctx.taskId),
      entity_type: "task",
      entity_id: ctx.taskId,
    },
  ]);
}
