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

  const payload = normalizeTicketInput(parsed.data);

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
    body: payload.description?.slice(0, 200) ?? null,
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
