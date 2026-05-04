import "server-only";

import { Resend } from "resend";

import { createAdminClient } from "@/lib/supabase/admin";
import { renderEmailTemplate } from "./render";

let _client: Resend | null = null;
function getClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!_client) _client = new Resend(apiKey);
  return _client;
}

export type SendEmailArgs = {
  /** Email template code (vd: "ticket_assigned"). Looked up trong
   *  email_templates table; nếu không tìm thấy hoặc inactive → log
   *  failure và return non-fatal. */
  templateCode: string;
  /** Người nhận. Bắt buộc có ít nhất 1 trong recipientEmail /
   *  recipientUserId. Nếu cả 2 đều có, dùng recipientEmail làm địa chỉ
   *  thực và lưu user_id để truy vết. */
  recipientEmail?: string | null;
  recipientUserId?: string | null;
  /** Variables điền vào template — name, link, ticket_code, ... */
  vars?: Record<string, string | number | null | undefined>;
  /** Optional context để gắn email_logs row vào: company / campaign. */
  companyId?: string | null;
  campaignId?: string | null;
};

export type SendEmailResult =
  | { ok: true; logId: string; providerMessageId: string | null }
  | { ok: false; reason: string };

/**
 * Render + send + log một email transactional qua Resend.
 *
 * Non-fatal by design: trả về `{ ok: false, reason }` khi thiếu API
 * key / template / recipient. Caller (trigger) nên log warning rồi
 * tiếp tục — không throw để khỏi block ticket update / report
 * approve thực tế.
 *
 * Mọi attempt (kể cả fail) đều insert 1 row vào email_logs với
 * status tương ứng để admin xem được ở /email tab "Lịch sử gửi".
 */
export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const admin = createAdminClient();

  // 1. Resolve recipient email (lookup từ user_id nếu cần)
  let recipientEmail = args.recipientEmail ?? null;
  if (!recipientEmail && args.recipientUserId) {
    const { data: profile } = await admin.auth.admin.getUserById(
      args.recipientUserId,
    );
    recipientEmail = profile?.user?.email ?? null;
  }
  if (!recipientEmail) {
    return { ok: false, reason: "no recipient email" };
  }

  // 2. Lookup template
  const { data: template, error: tplErr } = await admin
    .from("email_templates")
    .select("id, subject, html_body, text_body, is_active")
    .eq("code", args.templateCode)
    .maybeSingle();
  if (tplErr || !template) {
    return { ok: false, reason: `template "${args.templateCode}" not found` };
  }
  if (!template.is_active) {
    return { ok: false, reason: `template "${args.templateCode}" is inactive` };
  }

  // 3. Render
  const vars = args.vars ?? {};
  const subject = renderEmailTemplate(template.subject as string, vars);
  const html = renderEmailTemplate(template.html_body as string, vars);
  const text = template.text_body
    ? renderEmailTemplate(template.text_body as string, vars)
    : undefined;

  // 4. Prepare log row (status=pending) — luôn ghi để có audit
  const { data: logRow, error: logErr } = await admin
    .from("email_logs")
    .insert({
      campaign_id: args.campaignId ?? null,
      template_id: template.id,
      company_id: args.companyId ?? null,
      recipient_user_id: args.recipientUserId ?? null,
      recipient_email: recipientEmail,
      subject,
      payload: { vars },
      status: "pending",
    })
    .select("id")
    .single();
  if (logErr || !logRow) {
    return { ok: false, reason: `log insert failed: ${logErr?.message}` };
  }
  const logId = logRow.id as string;

  // 5. Check Resend client
  const client = getClient();
  if (!client) {
    await admin
      .from("email_logs")
      .update({ status: "failed", error_message: "RESEND_API_KEY not set" })
      .eq("id", logId);
    return { ok: false, reason: "RESEND_API_KEY missing" };
  }

  // 6. Send
  const from =
    process.env.RESEND_FROM_EMAIL ?? "Clickstar <no-reply@clickstar.vn>";
  try {
    const { data, error } = await client.emails.send({
      from,
      to: [recipientEmail],
      subject,
      html,
      text,
    });
    if (error || !data) {
      const msg = error?.message ?? "unknown Resend error";
      await admin
        .from("email_logs")
        .update({ status: "failed", error_message: msg })
        .eq("id", logId);
      return { ok: false, reason: msg };
    }
    await admin
      .from("email_logs")
      .update({
        status: "sent",
        provider_message_id: data.id,
        sent_at: new Date().toISOString(),
      })
      .eq("id", logId);
    return { ok: true, logId, providerMessageId: data.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "send threw";
    await admin
      .from("email_logs")
      .update({ status: "failed", error_message: msg })
      .eq("id", logId);
    return { ok: false, reason: msg };
  }
}
