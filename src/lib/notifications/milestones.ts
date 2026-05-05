import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { stripMentionsToPlain } from "@/lib/mentions";
import { notifyMentions } from "@/lib/notifications/mentions";

type Recipient = {
  user_id: string;
  full_name: string | null;
  role: "pm" | "account_manager" | "admin" | "super_admin";
};

type MilestoneNotificationContext = {
  milestoneId: string;
  milestoneTitle: string;
  projectId: string;
  projectName: string;
  companyId: string | null;
  companyName: string | null;
  pmId: string | null;
  accountManagerId: string | null;
  /** Người vừa thực hiện (báo hoàn thành / mở lại) — không gửi noti
   *  cho chính họ. */
  actorId: string;
  actorName: string;
};

type CompletionPayload = {
  summary: string;
  attachmentsCount: number;
  linksCount: number;
};

/**
 * Tìm tất cả người cần nhận thông báo khi 1 milestone được báo hoàn thành:
 * - PM của project (project.pm_id)
 * - Account Manager của khách hàng (companies.primary_account_manager_id)
 * - Tất cả super_admin + admin trong hệ thống
 *
 * Dedup theo user_id, loại actor khỏi list (không gửi cho chính mình).
 */
async function resolveRecipients(
  ctx: MilestoneNotificationContext,
): Promise<Recipient[]> {
  const admin = createAdminClient();

  const { data: adminRows } = await admin
    .from("profiles")
    .select("id, full_name, internal_role")
    .eq("audience", "internal")
    .eq("is_active", true)
    .is("deleted_at", null)
    .in("internal_role", ["super_admin", "admin"]);

  const recipients = new Map<string, Recipient>();

  for (const r of adminRows ?? []) {
    if (r.id === ctx.actorId) continue;
    recipients.set(r.id as string, {
      user_id: r.id as string,
      full_name: (r.full_name as string | null) ?? null,
      role: r.internal_role === "super_admin" ? "super_admin" : "admin",
    });
  }

  // PM của project
  if (ctx.pmId && ctx.pmId !== ctx.actorId && !recipients.has(ctx.pmId)) {
    const { data: pm } = await admin
      .from("profiles")
      .select("id, full_name")
      .eq("id", ctx.pmId)
      .maybeSingle();
    if (pm) {
      recipients.set(ctx.pmId, {
        user_id: ctx.pmId,
        full_name: (pm.full_name as string | null) ?? null,
        role: "pm",
      });
    }
  }

  // Account Manager của company
  if (
    ctx.accountManagerId &&
    ctx.accountManagerId !== ctx.actorId &&
    !recipients.has(ctx.accountManagerId)
  ) {
    const { data: am } = await admin
      .from("profiles")
      .select("id, full_name")
      .eq("id", ctx.accountManagerId)
      .maybeSingle();
    if (am) {
      recipients.set(ctx.accountManagerId, {
        user_id: ctx.accountManagerId,
        full_name: (am.full_name as string | null) ?? null,
        role: "account_manager",
      });
    }
  }

  return Array.from(recipients.values());
}

const milestoneUrl = (projectId: string, milestoneId: string) =>
  `/projects/${projectId}#milestone-${milestoneId}`;

/**
 * Bắn cả in-app notification + email cho PM/AM/Admin khi 1 milestone
 * vừa được báo hoàn thành. Failure-tolerant: lỗi email không block flow.
 */
export async function notifyMilestoneCompleted(
  ctx: MilestoneNotificationContext,
  payload: CompletionPayload,
): Promise<void> {
  const recipients = await resolveRecipients(ctx);
  if (recipients.length === 0) return;

  const admin = createAdminClient();
  const link = milestoneUrl(ctx.projectId, ctx.milestoneId);

  // 1) In-app notifications (1 batch insert)
  const inApp = recipients.map((r) => ({
    user_id: r.user_id,
    company_id: ctx.companyId,
    channel: "in_app" as const,
    title: `Milestone hoàn thành: ${ctx.milestoneTitle}`,
    body: `${ctx.actorName} đã báo hoàn thành "${ctx.milestoneTitle}" — ${ctx.projectName}.`,
    link_url: link,
    entity_type: "milestone",
    entity_id: ctx.milestoneId,
  }));
  try {
    const { error } = await admin.from("notifications").insert(inApp);
    if (error) console.error("[notifications/milestone] insert failed", error);
  } catch (err) {
    console.error("[notifications/milestone] unexpected", err);
  }

  // 2) Email — gửi tuần tự cho ổn định, mỗi recipient 1 email.
  // sendEmail() tự lookup auth.users để resolve email từ user_id và là
  // non-fatal khi thiếu RESEND_API_KEY hoặc template inactive.
  for (const r of recipients) {
    await sendEmail({
      templateCode: "milestone_completed",
      recipientUserId: r.user_id,
      companyId: ctx.companyId,
      vars: {
        actor_name: ctx.actorName,
        milestone_title: ctx.milestoneTitle,
        project_name: ctx.projectName,
        company_name: ctx.companyName ?? "",
        summary: payload.summary,
        attachments_count: payload.attachmentsCount,
        links_count: payload.linksCount,
        milestone_url: link,
      },
    });
  }
}

/**
 * Bắn in-app notification cho thành viên liên quan khi có comment mới
 * trong milestone:
 * - Người báo hoàn thành milestone (nếu có active completion) — quan
 *   trọng nhất, vì có thể admin yêu cầu chỉnh
 * - PM của project
 * - Account Manager của company
 * - Tất cả người đã comment trong thread trước đó (trừ actor)
 *
 * Dedup tự động qua Map. Không bắn email (comment có thể nhiều, dễ
 * spam) — chỉ in-app noti.
 */
export async function notifyMilestoneCommented(
  ctx: MilestoneNotificationContext,
  commentBody: string,
): Promise<void> {
  const admin = createAdminClient();
  const link = milestoneUrl(ctx.projectId, ctx.milestoneId);

  // Bước 1: notify riêng cho người được @mention với title "tag bạn".
  // Trả về set userId đã noti — recipient list mặc định sẽ skip những
  // user này để tránh nhận 2 noti cho cùng 1 comment.
  const mentionedIds = await notifyMentions({
    actorId: ctx.actorId,
    actorName: ctx.actorName,
    entityLabel: `công việc "${ctx.milestoneTitle}"`,
    entityType: "milestone",
    entityId: ctx.milestoneId,
    linkUrl: link,
    companyId: ctx.companyId,
    body: commentBody,
    alreadyNotifiedUserIds: new Set(),
  });

  const recipients = new Map<string, { user_id: string }>();

  // 1) super_admin + admin (và manager) — bug fix 2026-05-05: trước đây
  //    chỉ noti khi admin tình cờ là PM/AM. Giờ luôn loop in admin tier
  //    để bất kỳ comment nào trong milestone admin cũng nhận được.
  const { data: adminRows } = await admin
    .from("profiles")
    .select("id")
    .eq("audience", "internal")
    .eq("is_active", true)
    .is("deleted_at", null)
    .in("internal_role", ["super_admin", "admin", "manager"]);
  for (const r of adminRows ?? []) {
    const uid = r.id as string;
    if (uid && uid !== ctx.actorId) {
      recipients.set(uid, { user_id: uid });
    }
  }

  // 2) Người báo hoàn thành milestone (active completion)
  const { data: completion } = await admin
    .from("milestone_completions")
    .select("completed_by")
    .eq("milestone_id", ctx.milestoneId)
    .is("undone_at", null)
    .is("reopened_at", null)
    .maybeSingle();
  if (completion?.completed_by && completion.completed_by !== ctx.actorId) {
    recipients.set(completion.completed_by as string, {
      user_id: completion.completed_by as string,
    });
  }

  // 3) PM của project
  if (ctx.pmId && ctx.pmId !== ctx.actorId) {
    recipients.set(ctx.pmId, { user_id: ctx.pmId });
  }

  // 4) Account Manager của company
  if (ctx.accountManagerId && ctx.accountManagerId !== ctx.actorId) {
    recipients.set(ctx.accountManagerId, { user_id: ctx.accountManagerId });
  }

  // 5) Thread participants — tất cả người đã comment trong milestone này
  const { data: participants } = await admin
    .from("milestone_comments")
    .select("author_id")
    .eq("milestone_id", ctx.milestoneId)
    .is("deleted_at", null);
  for (const p of participants ?? []) {
    const uid = p.author_id as string;
    if (uid && uid !== ctx.actorId) {
      recipients.set(uid, { user_id: uid });
    }
  }

  // 6) Task assignees + reviewers — staff đang làm các đầu việc trong
  // milestone này (cover trường hợp staff chưa báo xong + chưa comment
  // nhưng đang phụ trách phần việc của milestone đó).
  const { data: tasks } = await admin
    .from("tasks")
    .select("assignee_id, reviewer_id")
    .eq("milestone_id", ctx.milestoneId)
    .is("deleted_at", null);
  for (const t of tasks ?? []) {
    for (const uid of [t.assignee_id, t.reviewer_id] as Array<string | null>) {
      if (uid && uid !== ctx.actorId) {
        recipients.set(uid, { user_id: uid });
      }
    }
  }

  // Loại bỏ những user đã nhận noti @mention — tránh duplicate.
  for (const uid of mentionedIds) recipients.delete(uid);

  if (recipients.size === 0) return;

  // Truncate body cho noti (giữ 120 ký tự đầu) — strip mention markup.
  const plain = stripMentionsToPlain(commentBody);
  const preview = plain.length > 120 ? plain.slice(0, 117) + "..." : plain;

  const rows = Array.from(recipients.values()).map((r) => ({
    user_id: r.user_id,
    company_id: ctx.companyId,
    channel: "in_app" as const,
    title: `${ctx.actorName} đã bình luận: ${ctx.milestoneTitle}`,
    body: preview,
    link_url: link,
    entity_type: "milestone",
    entity_id: ctx.milestoneId,
  }));

  try {
    const { error } = await admin.from("notifications").insert(rows);
    if (error) console.error("[notifications/milestone-comment] insert failed", error);
  } catch (err) {
    console.error("[notifications/milestone-comment] unexpected", err);
  }
}

/**
 * Notify cho người báo hoàn thành ban đầu khi admin mở lại milestone của họ.
 */
export async function notifyMilestoneReopened(
  ctx: MilestoneNotificationContext & { originalCompleterId: string | null },
  reason: string,
): Promise<void> {
  if (!ctx.originalCompleterId || ctx.originalCompleterId === ctx.actorId) {
    return;
  }
  const admin = createAdminClient();
  const link = milestoneUrl(ctx.projectId, ctx.milestoneId);

  try {
    const { error } = await admin.from("notifications").insert({
      user_id: ctx.originalCompleterId,
      company_id: ctx.companyId,
      channel: "in_app" as const,
      title: `Milestone bị mở lại: ${ctx.milestoneTitle}`,
      body: `${ctx.actorName} đã mở lại milestone bạn báo xong. Lý do: ${reason}`,
      link_url: link,
      entity_type: "milestone",
      entity_id: ctx.milestoneId,
    });
    if (error)
      console.error("[notifications/milestone-reopen] insert failed", error);
  } catch (err) {
    console.error("[notifications/milestone-reopen] unexpected", err);
  }
}
