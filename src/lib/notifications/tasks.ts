import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

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
