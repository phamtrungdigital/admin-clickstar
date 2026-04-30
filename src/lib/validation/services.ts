import { z } from "zod";

const trimmed = z.string().trim();

/**
 * Service catalog form schema. Pricing/billing-cycle live on the contract,
 * not the catalog — see `contract_services.unit_price`.
 */
export const createServiceSchema = z.object({
  name: trimmed.min(2, "Tên dịch vụ tối thiểu 2 ký tự").max(255),
  code: trimmed.max(255),
  category: trimmed.max(255),
  description: trimmed.max(1000),
  is_active: z.boolean(),
});

export const updateServiceSchema = createServiceSchema.partial();

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;

const NULLABLE_FIELDS = ["code", "category", "description"] as const;

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
