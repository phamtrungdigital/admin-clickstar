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

// ────────────────────────────────────────────────────────────────────────────
// AI gen email — phía sub-batch AI 2026-05-04
// ────────────────────────────────────────────────────────────────────────────

import { callActiveAi } from "@/lib/ai/client";

export type AiEmailGenInput = {
  /** Prompt mô tả email muốn tạo. */
  prompt: string;
  /** Loại email — giúp AI chọn tone phù hợp. */
  kind:
    | "announcement"
    | "invitation"
    | "reminder"
    | "congrats"
    | "transactional"
    | "custom";
};

export type AiEmailGenResult = {
  subject: string;
  html: string;
  suggestedName: string;
  suggestedCode: string;
  suggestedVariables: Array<{ name: string; description: string }>;
};

const AI_EMAIL_SYSTEM_PROMPT = `Bạn là copywriter + email designer chuyên nghiệp cho Clickstar (agency dịch vụ marketing/website).

Output phải là JSON hợp lệ với cấu trúc CHÍNH XÁC:
{
  "subject": "Tiêu đề email <=70 ký tự, tiếng Việt có dấu",
  "html": "<HTML body inline-styled — KHÔNG bao bọc <html>/<body>/<head>>",
  "suggestedName": "Tên template ngắn gọn cho admin (<=50 ký tự)",
  "suggestedCode": "snake_case_code_<=64_chars",
  "suggestedVariables": [{"name":"variableName","description":"Mô tả ngắn"}]
}

QUY TẮC HTML:
- Inline CSS only (font-family, color, margin, padding, font-size). KHÔNG <style> tag.
- Font-family: -apple-system, 'Segoe UI', sans-serif
- Max-width container: 560px, margin auto
- Color palette: #0f172a (heading), #475569 (body), #2563eb (CTA blue), #f8fafc (background card)
- CTA button: <a> với background:#2563eb;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block
- Placeholder: dùng {{variableName}} cho biến động (vd {{name}}, {{ticket_code}}, {{link}}). Đặt vào suggestedVariables.
- Footer nhỏ font-size:12px;color:#94a3b8

QUY TẮC CONTENT:
- Tiếng Việt có dấu, lịch sự, ngắn gọn
- Mở đầu "Xin chào {{name}}," nếu có recipient
- Nội dung 2-4 đoạn, súc tích
- Có 1 CTA chính rõ ràng
- Không tạo subject lừa đảo / clickbait

CHỈ TRẢ JSON HỢP LỆ — không có text trước/sau JSON.`;

export async function aiGenEmailAction(
  input: AiEmailGenInput,
): Promise<{ ok: true; data: AiEmailGenResult } | { ok: false; message: string }> {
  const guard = await requireManagerPlus();
  if (!guard.ok) return { ok: false, message: guard.message };

  const userPrompt = `Loại email: ${input.kind}

Yêu cầu: ${input.prompt}`;

  const result = await callActiveAi({
    system: AI_EMAIL_SYSTEM_PROMPT,
    user: userPrompt,
    maxTokens: 4096,
  });
  if (!result.ok) {
    return { ok: false, message: result.reason };
  }

  // Parse JSON output. AI thỉnh thoảng wrap trong ```json ... ``` block —
  // strip markdown fences nếu có.
  let text = result.text.trim();
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
  if (jsonMatch) text = jsonMatch[1].trim();
  else if (text.startsWith("```")) text = text.replace(/^```\w*\n?|```$/g, "").trim();

  let parsed: AiEmailGenResult;
  try {
    parsed = JSON.parse(text) as AiEmailGenResult;
  } catch (err) {
    console.error("[ai-gen-email] parse JSON lỗi:", text.slice(0, 200));
    return {
      ok: false,
      message: `AI trả về không phải JSON: ${err instanceof Error ? err.message : "parse error"}`,
    };
  }

  // Validate shape tối thiểu
  if (!parsed.subject || !parsed.html || !parsed.suggestedName || !parsed.suggestedCode) {
    return {
      ok: false,
      message: "AI output thiếu field bắt buộc (subject / html / suggestedName / suggestedCode)",
    };
  }
  if (!Array.isArray(parsed.suggestedVariables)) {
    parsed.suggestedVariables = [];
  }

  return { ok: true, data: parsed };
}
