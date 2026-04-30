import { z } from "zod";

const trimmed = z.string().trim();

/**
 * Form schema. Free-text fields default to "" rather than null so the
 * field types stay aligned with React Hook Form. Use `normalizeServiceInput()`
 * before persisting to coerce empty strings to null and parse the price.
 */
export const createServiceSchema = z.object({
  name: trimmed.min(2, "Tên dịch vụ tối thiểu 2 ký tự").max(255),
  code: trimmed.max(255),
  category: trimmed.max(255),
  description: trimmed.max(1000),
  default_price: z.number().min(0, "Giá phải >= 0").max(99_999_999_999),
  billing_cycle: trimmed.max(64),
  is_active: z.boolean(),
});

export const updateServiceSchema = createServiceSchema.partial();

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;

const NULLABLE_FIELDS = ["code", "category", "description", "billing_cycle"] as const;

export function normalizeServiceInput<T extends Partial<CreateServiceInput>>(
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

/**
 * Common Clickstar service categories suggested in the UI; users can still
 * type a custom one. Display order intentionally groups related work.
 */
export const SERVICE_CATEGORY_SUGGESTIONS = [
  "Digital Marketing",
  "Thiết kế & Website",
  "Quảng cáo",
  "Phần mềm & Automation",
  "Chăm sóc & CRM",
  "SEO",
  "Email Marketing",
  "ZNS",
  "Khác",
];

/**
 * Common billing cycles. Free-text in DB so each service can override.
 */
export const BILLING_CYCLE_SUGGESTIONS = [
  "1 lần",
  "Hàng tháng",
  "Hàng quý",
  "Hàng năm",
  "Theo dự án",
];
