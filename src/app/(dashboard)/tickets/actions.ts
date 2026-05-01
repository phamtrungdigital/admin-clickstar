"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  createTicketSchema,
  normalizeTicketInput,
  updateTicketSchema,
  type CreateTicketInput,
  type UpdateTicketInput,
} from "@/lib/validation/tickets";
import type { TicketStatus } from "@/lib/database.types";

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
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, message: error?.message ?? "Không tạo được ticket" };
  }

  revalidatePath("/tickets");
  revalidatePath("/dashboard");
  return { ok: true, data: { id: data.id } };
}

export async function updateTicketAction(
  id: string,
  input: UpdateTicketInput,
): Promise<TicketActionResult> {
  const parsed = updateTicketSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Dữ liệu không hợp lệ",
      fieldErrors: flattenZodErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const payload = normalizeTicketInput(parsed.data);

  if (Object.keys(payload).length > 0) {
    const { error } = await supabase
      .from("tickets")
      .update(payload)
      .eq("id", id);
    if (error) return { ok: false, message: error.message };
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
  const supabase = await createClient();
  const patch: { status: TicketStatus; closed_at?: string | null } = { status };
  if (status === "closed") {
    patch.closed_at = new Date().toISOString();
  } else {
    patch.closed_at = null;
  }
  const { error } = await supabase.from("tickets").update(patch).eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/tickets");
  revalidatePath(`/tickets/${id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function softDeleteTicketAction(
  id: string,
): Promise<TicketActionResult> {
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
