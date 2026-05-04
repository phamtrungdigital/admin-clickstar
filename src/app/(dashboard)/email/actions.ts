"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requireInternalAction, canManageCustomers } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import {
  upsertEmailTemplateSchema,
  type UpsertEmailTemplateInput,
} from "@/lib/validation/email";
import { sendEmail } from "@/lib/email/send";

export type EmailActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

function flattenZodErrors(
  error: import("zod").ZodError,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Manager+ only — settings hệ thống không cho staff edit. */
async function requireManagerPlus() {
  const guard = await requireInternalAction();
  if (!guard.ok) return guard;
  if (!canManageCustomers(guard.profile)) {
    return {
      ok: false as const,
      message: "Chỉ Manager / Admin / Super Admin được quản lý template email.",
    };
  }
  return guard;
}

export async function createEmailTemplateAction(
  input: UpsertEmailTemplateInput,
): Promise<EmailActionResult<{ id: string }>> {
  const guard = await requireManagerPlus();
  if (!guard.ok) return { ok: false, message: guard.message };

  const parsed = upsertEmailTemplateSchema.safeParse(input);
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

  const { data, error } = await supabase
    .from("email_templates")
    .insert({
      code: parsed.data.code.toLowerCase(),
      name: parsed.data.name,
      subject: parsed.data.subject,
      html_body: parsed.data.html_body,
      text_body: parsed.data.text_body || null,
      variables: parsed.data.variables
        ? { hint: parsed.data.variables }
        : {},
      is_active: parsed.data.is_active,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, message: error?.message ?? "Không tạo được template" };
  }

  await logAudit({
    user_id: user.id,
    action: "create",
    entity_type: "system_settings",
    entity_id: data.id,
    new_value: {
      kind: "email_template",
      code: parsed.data.code,
      name: parsed.data.name,
    },
  });

  revalidatePath("/email");
  return { ok: true, data: { id: data.id as string } };
}

export async function updateEmailTemplateAction(
  id: string,
  input: UpsertEmailTemplateInput,
): Promise<EmailActionResult> {
  const guard = await requireManagerPlus();
  if (!guard.ok) return { ok: false, message: guard.message };

  const parsed = upsertEmailTemplateSchema.safeParse(input);
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

  const { error } = await supabase
    .from("email_templates")
    .update({
      code: parsed.data.code.toLowerCase(),
      name: parsed.data.name,
      subject: parsed.data.subject,
      html_body: parsed.data.html_body,
      text_body: parsed.data.text_body || null,
      variables: parsed.data.variables
        ? { hint: parsed.data.variables }
        : {},
      is_active: parsed.data.is_active,
    })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };

  await logAudit({
    user_id: user.id,
    action: "update",
    entity_type: "system_settings",
    entity_id: id,
    new_value: {
      kind: "email_template",
      code: parsed.data.code,
      name: parsed.data.name,
    },
  });

  revalidatePath("/email");
  revalidatePath(`/email/templates/${id}`);
  return { ok: true };
}

export async function createEmailTemplateAndRedirect(
  input: UpsertEmailTemplateInput,
): Promise<EmailActionResult> {
  const result = await createEmailTemplateAction(input);
  if (!result.ok) return result;
  redirect(`/email`);
}

/** Test-send 1 email với template hiện tại + dummy vars để admin
 *  preview thực tế trên Resend. Sample vars để tránh placeholder thừa
 *  trong nội dung gửi đi. */
export async function testSendEmailTemplateAction(input: {
  templateCode: string;
  recipientEmail: string;
  vars: Record<string, string>;
}): Promise<EmailActionResult> {
  const guard = await requireManagerPlus();
  if (!guard.ok) return { ok: false, message: guard.message };

  const result = await sendEmail({
    templateCode: input.templateCode,
    recipientEmail: input.recipientEmail,
    vars: input.vars,
  });
  if (!result.ok) return { ok: false, message: result.reason };
  return { ok: true };
}
