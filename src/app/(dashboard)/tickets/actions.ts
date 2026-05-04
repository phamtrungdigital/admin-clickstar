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
  listAdminRecipientIds,
  notify,
  type NotifyArgs,
} from "@/lib/notifications";
import type { TicketStatus } from "@/lib/database.types";
import { TICKET_STATUS_OPTIONS } from "@/lib/validation/tickets";

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

/** Build the recipient set for ticket events: admins + assignee, minus the actor. */
async function ticketRecipients(opts: {
  actorId: string;
  assigneeId?: string | null;
  reporterId?: string | null;
}): Promise<string[]> {
  const adminIds = await listAdminRecipientIds();
  const set = new Set<string>(adminIds);
  if (opts.assigneeId) set.add(opts.assigneeId);
  if (opts.reporterId) set.add(opts.reporterId);
  set.delete(opts.actorId);
  return [...set];
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

  // Fan out in-app notifications to admins + assignee.
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

  revalidatePath("/tickets");
  revalidatePath("/dashboard");
  return { ok: true, data: { id: data.id } };
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
      console.error("[ticket-comment] auto-status update failed", stErr);
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

  // Notify the "other side": customer reply → notify assignee + admins.
  // Internal public reply → notify reporter (the customer who filed it).
  // Internal note → notify only assignee + admins, never customer.
  const recipients = await ticketRecipients({
    actorId: user.id,
    assigneeId: ticket.assignee_id as string | null,
    reporterId:
      isInternalNote || isCustomerCaller
        ? null
        : (ticket.reporter_id as string | null),
  });
  const notifyArgs: NotifyArgs[] = recipients.map((rid) => ({
    user_id: rid,
    company_id: ticket.company_id as string,
    title: isCustomerCaller
      ? `KH phản hồi: ${ticket.title}`
      : isInternalNote
        ? `Note nội bộ: ${ticket.title}`
        : `Phản hồi mới: ${ticket.title}`,
    body: parsed.data.body.slice(0, 200),
    link_url: `/tickets/${ticketId}`,
    entity_type: "ticket",
    entity_id: ticketId,
  }));
  await notify(notifyArgs);

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
