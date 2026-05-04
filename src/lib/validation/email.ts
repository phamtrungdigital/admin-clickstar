import { z } from "zod";

const trimmed = z.string().trim();

/**
 * Email template — Resend transactional/marketing template stored in DB.
 * Body uses simple Handlebars-like `{{var}}` placeholders (rendered by
 * src/lib/email/render.ts).
 *
 * `code` là khoá unique để code khác (trigger ticket update / report
 * approved / customer onboarding) gọi lại template theo tên: ví dụ
 * "ticket_assigned", "report_approved", "customer_welcome".
 */
export const upsertEmailTemplateSchema = z.object({
  code: trimmed
    .min(2, "Mã tối thiểu 2 ký tự")
    .max(64)
    .regex(
      /^[a-z0-9_]+$/i,
      "Chỉ chữ/số/_ — không khoảng trắng (vd: ticket_assigned)",
    ),
  name: trimmed.min(2, "Tên tối thiểu 2 ký tự").max(255),
  subject: trimmed.min(2, "Tiêu đề tối thiểu 2 ký tự").max(255),
  html_body: trimmed.min(10, "Nội dung HTML quá ngắn").max(50000),
  text_body: trimmed.max(50000),
  variables: trimmed.max(2000),
  is_active: z.boolean(),
});
export type UpsertEmailTemplateInput = z.infer<typeof upsertEmailTemplateSchema>;
