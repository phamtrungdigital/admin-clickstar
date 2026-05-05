"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireInternalAction } from "@/lib/auth/guards";
import {
  createTicketSchema,
  normalizeTicketInput,
  updateTicketSchema,
  type CreateTicketInput,
  type UpdateTicketInput,
} from "@/lib/validation/tickets";
import {
  filterInternalActiveIds,
  listTicketSupportRecipientIds,
  notify,
  type NotifyArgs,
} from "@/lib/notifications";
import { logError } from "@/lib/logging";
import { stripMentionsToPlain } from "@/lib/mentions";
import { notifyMentions } from "@/lib/notifications/mentions";
import { sendEmail } from "@/lib/email/send";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TicketStatus } from "@/lib/database.types";
import {
  TICKET_PRIORITY_OPTIONS,
  TICKET_STATUS_OPTIONS,
} from "@/lib/validation/tickets";

export type TicketActionResult<T = void> =
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

function statusLabel(status: TicketStatus): string {
  return (
    TICKET_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status
  );
}

/** Build the recipient set for ticket events: admin tier + support
 *  (CSKH) + assignee, minus the actor. Reporter có thể thêm vào tuỳ
 *  ngữ cảnh (vd: staff reply public → notify reporter là KH). */
async function ticketRecipients(opts: {
  actorId: string;
  assigneeId?: string | null;
  reporterId?: string | null;
}): Promise<string[]> {
  const supportIds = await listTicketSupportRecipientIds();
  const set = new Set<string>(supportIds);
  if (opts.assigneeId) set.add(opts.assigneeId);
  if (opts.reporterId) set.add(opts.reporterId);
  set.delete(opts.actorId);
  return [...set];
}

/** Helper: lookup profile + email cho 1 batch user_ids. Trả map
 *  user_id → { full_name, email } để build vars cho email. */
async function loadProfilesForEmail(
  userIds: string[],
): Promise<Map<string, { full_name: string; email: string | null }>> {
  if (userIds.length === 0) return new Map();
  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name")
    .in("id", userIds);
  const result = new Map<
    string,
    { full_name: string; email: string | null }
  >();
  // Profile rows don't carry email (auth.users does). Resolve via auth admin.
  for (const p of profiles ?? []) {
    result.set(p.id as string, {
      full_name: (p.full_name as string) || "Bạn",
      email: null,
    });
  }
  for (const id of userIds) {
    if (!result.has(id)) {
      result.set(id, { full_name: "Bạn", email: null });
    }
    const { data: userResp } = await admin.auth.admin.getUserById(id);
    const email = userResp?.user?.email ?? null;
    const existing = result.get(id)!;
    result.set(id, { ...existing, email });
  }
  return result;
}

/** App URL — dùng trong link tới /tickets/<id> trong email template. */
function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")
    ?? "https://portal.clickstar.vn"
  );
}

export async function createTicketAction(
  input: CreateTicketInput,
): Promise<TicketActionResult<{ id: string }>> {
  const parsed = createTicketSchema.safeParse(input);
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

  // Determine the caller's audience to apply customer-side guardrails.
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("audience")
    .eq("id", user.id)
    .maybeSingle();
  const isCustomer = callerProfile?.audience === "customer";

  const normalized = normalizeTicketInput(parsed.data);
  // Use a loose record shape from here on so customer overrides can null
  // out the `code` field (zod schema types it as string for the form).
  let payload: Record<string, unknown> = { ...normalized };

  if (isCustomer) {
    // Defence in depth: customer cannot pick assignee, status, or company.
    // Resolve their company from company_members + auto-assign to the
    // primary Account Manager if available; admins phân công thủ công sau
    // nếu KH chưa có AM.
    const { data: membership } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (!membership?.company_id) {
      return {
        ok: false,
        message:
          "Tài khoản của bạn chưa được gắn vào doanh nghiệp nào. Liên hệ Clickstar để được hỗ trợ.",
      };
    }

    const companyId = membership.company_id as string;
    let primaryAm: string | null = null;
    const { data: assignment } = await supabase
      .from("company_assignments")
      .select("internal_user_id")
      .eq("company_id", companyId)
      .eq("role", "account_manager")
      .eq("is_primary", true)
      .limit(1)
      .maybeSingle();
    if (assignment?.internal_user_id) {
      primaryAm = assignment.internal_user_id as string;
    }

    payload = {
      ...payload,
      company_id: companyId,
      status: "new",
      assignee_id: primaryAm,
      // Mã ticket: để DB tự sinh (server side), bỏ mọi value khách post lên.
      code: null,
    };
  }

  const { data, error } = await supabase
    .from("tickets")
    .insert({
      ...payload,
      created_by: user.id,
      reporter_id: user.id,
    })
    .select("id, title, company_id, assignee_id")
    .single();

  if (error || !data) {
    return { ok: false, message: error?.message ?? "Không tạo được ticket" };
  }

  // Fan out in-app notifications to admin tier + support + assignee.
  const recipients = await ticketRecipients({
    actorId: user.id,
    assigneeId: data.assignee_id,
  });
  const items: NotifyArgs[] = recipients.map((rid) => ({
    user_id: rid,
    company_id: data.company_id,
    title: `Ticket mới: ${data.title}`,
    body:
      typeof payload.description === "string"
        ? payload.description.slice(0, 200)
        : null,
    link_url: `/tickets/${data.id}`,
    entity_type: "ticket",
    entity_id: data.id,
  }));
  await notify(items);

  // Email — gửi song song với in-app cho nội bộ. Mỗi recipient được render
  // với name riêng. Khách (reporter) không nhận email "ticket_created"
  // (họ vừa tự tạo, không cần email lại). Failure non-fatal — chỉ log.
  try {
    const profiles = await loadProfilesForEmail(recipients);
    const adminTicketCode = await fetchTicketCode(data.id);
    const customerName = await fetchCompanyName(data.company_id as string);
    const link = `${appUrl()}/tickets/${data.id}`;
    const priorityLabel =
      TICKET_PRIORITY_OPTIONS.find((p) => p.value === payload.priority)
        ?.label ?? (payload.priority as string);
    for (const rid of recipients) {
      const profile = profiles.get(rid);
      if (!profile?.email) continue;
      void sendEmail({
        templateCode: "ticket_created",
        recipientEmail: profile.email,
        recipientUserId: rid,
        companyId: data.company_id as string,
        vars: {
          name: profile.full_name,
          customer_name: customerName ?? "Khách hàng",
          ticket_code: adminTicketCode ?? data.id.slice(0, 8),
          ticket_title: data.title as string,
          priority: priorityLabel,
          link,
        },
      });
    }
  } catch (err) {
    await logError("email.ticket_created", err);
  }

  revalidatePath("/tickets");
  revalidatePath("/dashboard");
  return { ok: true, data: { id: data.id } };
}

async function fetchTicketCode(ticketId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("tickets")
    .select("code")
    .eq("id", ticketId)
    .maybeSingle();
  return (data?.code as string | null) ?? null;
}

async function fetchCompanyName(companyId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("companies")
    .select("name")
    .eq("id", companyId)
    .maybeSingle();
  return (data?.name as string | null) ?? null;
}

export async function updateTicketAction(
  id: string,
  input: UpdateTicketInput,
): Promise<TicketActionResult> {
  const guard = await requireInternalAction();
  if (!guard.ok) return { ok: false, message: guard.message };
  const parsed = updateTicketSchema.safeParse(input);
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

  const payload = normalizeTicketInput(parsed.data);

  if (Object.keys(payload).length > 0) {
    const { error } = await supabase
      .from("tickets")
      .update(payload)
      .eq("id", id);
    if (error) return { ok: false, message: error.message };
  }

  // Notify watchers about the update (fetch the latest row to know who).
  const { data: row } = await supabase
    .from("tickets")
    .select("title, company_id, assignee_id, reporter_id")
    .eq("id", id)
    .maybeSingle();
  if (row) {
    const recipients = await ticketRecipients({
      actorId: user.id,
      assigneeId: row.assignee_id,
      reporterId: row.reporter_id,
    });
    await notify(
      recipients.map((rid) => ({
        user_id: rid,
        company_id: row.company_id,
        title: `Ticket cập nhật: ${row.title}`,
        link_url: `/tickets/${id}`,
        entity_type: "ticket",
        entity_id: id,
      })),
    );
  }

  revalidatePath("/tickets");
  revalidatePath(`/tickets/${id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function changeTicketStatusAction(
  id: string,
  status: TicketStatus,
): Promise<TicketActionResult> {
  const guard = await requireInternalAction();
  if (!guard.ok) return { ok: false, message: guard.message };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Vui lòng đăng nhập lại" };

  const patch: { status: TicketStatus; closed_at?: string | null } = { status };
  if (status === "closed") {
    patch.closed_at = new Date().toISOString();
  } else {
    patch.closed_at = null;
  }
  const { error } = await supabase.from("tickets").update(patch).eq("id", id);
  if (error) return { ok: false, message: error.message };

  const { data: row } = await supabase
    .from("tickets")
    .select("title, company_id, assignee_id, reporter_id")
    .eq("id", id)
    .maybeSingle();
  if (row) {
    const recipients = await ticketRecipients({
      actorId: user.id,
      assigneeId: row.assignee_id,
      reporterId: row.reporter_id,
    });
    await notify(
      recipients.map((rid) => ({
        user_id: rid,
        company_id: row.company_id,
        title: `Ticket đổi trạng thái → ${statusLabel(status)}: ${row.title}`,
        link_url: `/tickets/${id}`,
        entity_type: "ticket",
        entity_id: id,
      })),
    );

    // Email — gửi cho tất cả recipients (bao gồm reporter là KH) để KH
    // biết tiến độ. Status label tiếng Việt từ TICKET_STATUS_OPTIONS.
    try {
      const profiles = await loadProfilesForEmail(recipients);
      const ticketCode = await fetchTicketCode(id);
      const link = `${appUrl()}/tickets/${id}`;
      for (const rid of recipients) {
        const profile = profiles.get(rid);
        if (!profile?.email) continue;
        void sendEmail({
          templateCode: "ticket_status_changed",
          recipientEmail: profile.email,
          recipientUserId: rid,
          companyId: row.company_id as string,
          vars: {
            name: profile.full_name,
            ticket_code: ticketCode ?? id.slice(0, 8),
            ticket_title: row.title as string,
            status: statusLabel(status),
            link,
          },
        });
      }
    } catch (err) {
      await logError("email.ticket_status_changed", err);
    }
  }

  revalidatePath("/tickets");
  revalidatePath(`/tickets/${id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function softDeleteTicketAction(
  id: string,
): Promise<TicketActionResult> {
  const guard = await requireInternalAction();
  if (!guard.ok) return { ok: false, message: guard.message };
  const supabase = await createClient();
  const { error } = await supabase
    .from("tickets")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/tickets");
  revalidatePath("/dashboard");
  return { ok: true };
}

// ────────────────────────────────────────────────────────────────────────────
// Comments — add + auto-update ticket status when customer replies.
// ────────────────────────────────────────────────────────────────────────────

import { ticketCommentSchema, type TicketCommentInput } from "@/lib/validation/tickets";
import { logAudit } from "@/lib/audit";

export async function addTicketCommentAction(
  ticketId: string,
  input: TicketCommentInput,
): Promise<TicketActionResult<{ id: string }>> {
  const parsed = ticketCommentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Nội dung không hợp lệ",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Vui lòng đăng nhập lại" };

  // Determine caller audience to enforce internal-note guardrail.
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("audience, internal_role")
    .eq("id", user.id)
    .maybeSingle();
  const isCustomerCaller = callerProfile?.audience === "customer";

  // Customer can never post an "internal note" — server forces false.
  const isInternalNote = isCustomerCaller ? false : parsed.data.is_internal;

  // Fetch ticket for audit + auto-status logic + notification recipients.
  const { data: ticket, error: tErr } = await supabase
    .from("tickets")
    .select("id, status, company_id, reporter_id, assignee_id, title")
    .eq("id", ticketId)
    .is("deleted_at", null)
    .maybeSingle();
  if (tErr) return { ok: false, message: tErr.message };
  if (!ticket) return { ok: false, message: "Ticket không tồn tại" };

  const { data: comment, error } = await supabase
    .from("ticket_comments")
    .insert({
      ticket_id: ticketId,
      author_id: user.id,
      body: parsed.data.body,
      is_internal: isInternalNote,
      attachments: parsed.data.attachments,
    })
    .select("id")
    .single();
  if (error || !comment) {
    return { ok: false, message: error?.message ?? "Không gửi được bình luận" };
  }

  // Auto status transition: customer reply on a ticket waiting for them →
  // bring it back to "in_progress" so internal sees it needs attention.
  // Don't auto-transition for internal replies — staff manage status via
  // the row menu / edit form.
  if (
    isCustomerCaller
    && !isInternalNote
    && ticket.status === "awaiting_customer"
  ) {
    const { error: stErr } = await supabase
      .from("tickets")
      .update({ status: "in_progress" })
      .eq("id", ticketId);
    if (stErr) {
      await logError("action.ticket_comment.auto_status", stErr, {
        ticketId,
      });
    }
  }

  await logAudit({
    user_id: user.id,
    company_id: ticket.company_id as string,
    action: "create",
    entity_type: "ticket",
    entity_id: ticketId,
    new_value: {
      kind: "comment",
      is_internal: isInternalNote,
      length: parsed.data.body.length,
    },
  });

  // Mention noti riêng (chỉ cho internal user — customer không tag được).
  // Trả về set userId đã noti để skip noti chung tránh duplicate.
  const actorProfileForName = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  const actorName =
    (actorProfileForName.data?.full_name as string | null) ?? "Người dùng";
  const mentionedIds = isCustomerCaller
    ? new Set<string>()
    : await notifyMentions({
        actorId: user.id,
        actorName,
        entityLabel: `ticket "${ticket.title}"`,
        entityType: "ticket",
        entityId: ticketId,
        linkUrl: `/tickets/${ticketId}`,
        companyId: ticket.company_id as string,
        body: parsed.data.body,
        alreadyNotifiedUserIds: new Set(),
      });

  // Recipients chung (gồm reporter là KH khi internal reply public) —
  // dùng cho EMAIL phía dưới để KH vẫn nhận thông báo qua hộp thư.
  const recipients = (
    await ticketRecipients({
      actorId: user.id,
      assigneeId: ticket.assignee_id as string | null,
      reporterId:
        isInternalNote || isCustomerCaller
          ? null
          : (ticket.reporter_id as string | null),
    })
  ).filter((rid) => !mentionedIds.has(rid));

  // Chuông in-app:
  // - Internal note (Lock icon): CHỈ internal user nhận → filter
  // - Public reply: tất cả recipients nhận chuông, kể cả KH reporter
  //   (anh chốt 2026-05-05: KH cần biết khi internal reply công khai;
  //   trước đây chỉ email không đủ vì KH không check thường xuyên)
  // - Customer reply: recipients đã loại reporter (chính KH) → còn lại
  //   internal stakeholders, OK ship cả chuông
  const chuongRecipients = isInternalNote
    ? await filterInternalActiveIds(recipients)
    : recipients;
  const previewPlain = stripMentionsToPlain(parsed.data.body).slice(0, 200);
  const notifyArgs: NotifyArgs[] = chuongRecipients.map((rid) => ({
    user_id: rid,
    company_id: ticket.company_id as string,
    title: isCustomerCaller
      ? `KH phản hồi: ${ticket.title}`
      : isInternalNote
        ? `Note nội bộ: ${ticket.title}`
        : `Phản hồi mới: ${ticket.title}`,
    body: previewPlain,
    link_url: `/tickets/${ticketId}`,
    entity_type: "ticket",
    entity_id: ticketId,
  }));
  await notify(notifyArgs);

  // Email — note nội bộ thì KHÔNG email cho ai (tránh leak ra KH nếu họ
  // vô tình ở recipient list); reply public thì email cho recipients.
  if (!isInternalNote) {
    try {
      const profiles = await loadProfilesForEmail(recipients);
      const ticketCode = await fetchTicketCode(ticketId);
      const link = `${appUrl()}/tickets/${ticketId}`;
      const actorProfile = await loadProfilesForEmail([user.id]);
      const actorName =
        actorProfile.get(user.id)?.full_name ?? "Người dùng";
      const replyExcerpt = stripMentionsToPlain(parsed.data.body).slice(0, 200);
      for (const rid of recipients) {
        const profile = profiles.get(rid);
        if (!profile?.email) continue;
        void sendEmail({
          templateCode: "ticket_replied",
          recipientEmail: profile.email,
          recipientUserId: rid,
          companyId: ticket.company_id as string,
          vars: {
            name: profile.full_name,
            actor_name: actorName,
            ticket_code: ticketCode ?? ticketId.slice(0, 8),
            ticket_title: ticket.title as string,
            reply_excerpt: replyExcerpt,
            link,
          },
        });
      }
    } catch (err) {
      await logError("email.ticket_replied", err, { ticketId });
    }
  }

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  return { ok: true, data: { id: comment.id as string } };
}

export async function softDeleteTicketCommentAction(
  commentId: string,
  ticketId: string,
): Promise<TicketActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Vui lòng đăng nhập lại" };

  const { data: existing } = await supabase
    .from("ticket_comments")
    .select("author_id")
    .eq("id", commentId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!existing) return { ok: false, message: "Bình luận không tồn tại" };
  if (existing.author_id !== user.id) {
    return {
      ok: false,
      message: "Chỉ tác giả mới xoá được bình luận của chính mình.",
    };
  }

  const { error } = await supabase
    .from("ticket_comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", commentId);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/tickets/${ticketId}`);
  return { ok: true };
}
