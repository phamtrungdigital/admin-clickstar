import { z } from "zod";

const TICKET_STATUS = [
  "new",
  "in_progress",
  "awaiting_customer",
  "resolved",
  "closed",
] as const;

const TICKET_PRIORITY = ["low", "medium", "high", "urgent"] as const;

const TICKET_CATEGORY = ["technical", "content", "account", "other"] as const;

const trimmed = z.string().trim();

/**
 * Form schema. Free-text fields default to "" rather than null so the
 * field types stay aligned with React Hook Form. Use `normalizeTicketInput()`
 * before persisting to coerce empty strings to null.
 */
export const ticketAttachmentSchema = z.object({
  path: z.string().min(1),
  filename: z.string().min(1),
  content_type: z.string().min(1),
  size: z.number().int().nonnegative(),
  uploaded_at: z.string(),
});

export type TicketAttachmentInput = z.infer<typeof ticketAttachmentSchema>;

export const createTicketSchema = z.object({
  title: trimmed.min(2, "Tiêu đề tối thiểu 2 ký tự").max(255),
  code: trimmed.max(255),
  company_id: z.string().uuid("Vui lòng chọn khách hàng"),
  description: trimmed.max(5000),
  priority: z.enum(TICKET_PRIORITY),
  status: z.enum(TICKET_STATUS),
  category: z.enum(TICKET_CATEGORY, {
    message: "Vui lòng chọn phân loại",
  }),
  assignee_id: z.string().uuid().nullable(),
  attachments: z.array(ticketAttachmentSchema),
});

export const updateTicketSchema = createTicketSchema.partial();

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;

export const ticketCommentSchema = z.object({
  body: trimmed.min(1, "Nội dung không được để trống").max(5000),
  /** Internal note — chỉ staff thấy. Khách hàng post luôn = false. */
  is_internal: z.boolean().default(false),
  attachments: z.array(ticketAttachmentSchema).default([]),
});
export type TicketCommentInput = z.infer<typeof ticketCommentSchema>;

export const TICKET_STATUS_OPTIONS: {
  value: (typeof TICKET_STATUS)[number];
  label: string;
}[] = [
  { value: "new", label: "Mới" },
  { value: "in_progress", label: "Đang xử lý" },
  { value: "awaiting_customer", label: "Chờ khách hàng" },
  { value: "resolved", label: "Đã giải quyết" },
  { value: "closed", label: "Đã đóng" },
];

export const TICKET_PRIORITY_OPTIONS: {
  value: (typeof TICKET_PRIORITY)[number];
  label: string;
}[] = [
  { value: "low", label: "Thấp" },
  { value: "medium", label: "Trung bình" },
  { value: "high", label: "Cao" },
  { value: "urgent", label: "Khẩn cấp" },
];

export const TICKET_CATEGORY_OPTIONS: {
  value: (typeof TICKET_CATEGORY)[number];
  label: string;
  description: string;
}[] = [
  {
    value: "technical",
    label: "Kỹ thuật",
    description: "Lỗi website, hosting, SSL, tốc độ tải...",
  },
  {
    value: "content",
    label: "Nội dung / SEO",
    description: "Bài viết, hình ảnh, on-page, từ khoá...",
  },
  {
    value: "account",
    label: "Tài khoản",
    description: "Đăng nhập, phân quyền, thông tin cá nhân...",
  },
  {
    value: "other",
    label: "Khác",
    description: "Yêu cầu không nằm trong các nhóm trên",
  },
];

const NULLABLE_FIELDS = ["code", "description"] as const;

export function normalizeTicketInput<T extends Partial<CreateTicketInput>>(
  input: T,
): T {
  const out: Record<string, unknown> = { ...input };
  for (const key of NULLABLE_FIELDS) {
    if (key in out) {
      const v = out[key];
      out[key] = typeof v === "string" && v.length > 0 ? v : null;
    }
  }
  return out as T;
}
