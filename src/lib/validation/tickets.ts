import { z } from "zod";

const TICKET_STATUS = [
  "new",
  "in_progress",
  "awaiting_customer",
  "resolved",
  "closed",
] as const;

const TICKET_PRIORITY = ["low", "medium", "high", "urgent"] as const;

const trimmed = z.string().trim();

/**
 * Form schema. Free-text fields default to "" rather than null so the
 * field types stay aligned with React Hook Form. Use `normalizeTicketInput()`
 * before persisting to coerce empty strings to null.
 */
export const createTicketSchema = z.object({
  title: trimmed.min(2, "Tiêu đề tối thiểu 2 ký tự").max(255),
  code: trimmed.max(255),
  company_id: z.string().uuid("Vui lòng chọn khách hàng"),
  description: trimmed.max(5000),
  priority: z.enum(TICKET_PRIORITY),
  status: z.enum(TICKET_STATUS),
  assignee_id: z.string().uuid().nullable(),
});

export const updateTicketSchema = createTicketSchema.partial();

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;

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
