import { z } from "zod";

const trimmed = z.string().trim();

const CONTRACT_STATUS = [
  "draft",
  "signed",
  "active",
  "completed",
  "cancelled",
] as const;

/**
 * One service line in a contract. Pricing fields (unit_price/quantity) live
 * in the DB with safe defaults but are intentionally not collected in the
 * form — cost control is a separate, future feature.
 *
 * `template_id` (optional) lets the admin pick a service-template so that
 * when the contract is saved the system auto-forks the template into a
 * real project. PRD §4.2 step 3.
 */
export const contractServiceLineSchema = z.object({
  service_id: z.string().uuid("Chọn dịch vụ"),
  template_id: z.string().uuid().nullable(),
  starts_at: trimmed.max(20),
  ends_at: trimmed.max(20),
  notes: trimmed.max(500),
});

export type ContractServiceLineInput = z.infer<typeof contractServiceLineSchema>;

/**
 * Form schema for the contract.  All optional text fields default to ""
 * to match React Hook Form expectations; date fields are ISO-8601 strings
 * (yyyy-MM-dd) coming from <input type="date">.
 */
export const createContractSchema = z.object({
  name: trimmed.min(2, "Tên hợp đồng tối thiểu 2 ký tự").max(255),
  code: trimmed.max(255),
  company_id: z.string().uuid("Chọn khách hàng"),
  status: z.enum(CONTRACT_STATUS),
  signed_at: trimmed.max(20),
  starts_at: trimmed.max(20),
  ends_at: trimmed.max(20),
  notes: trimmed.max(2000),
  attachment_url: trimmed.max(2048),
  attachment_filename: trimmed.max(255),
  services: z.array(contractServiceLineSchema),
});

export const updateContractSchema = createContractSchema.partial();

export type CreateContractInput = z.infer<typeof createContractSchema>;
export type UpdateContractInput = z.infer<typeof updateContractSchema>;

const NULLABLE_TEXT_FIELDS = [
  "code",
  "notes",
  "attachment_url",
  "attachment_filename",
] as const;

const NULLABLE_DATE_FIELDS = ["signed_at", "starts_at", "ends_at"] as const;

/**
 * Coerce empty strings to null + drop services from the contract payload
 * (services live in their own table). Returns the contract row payload only.
 */
export function normalizeContractInput<T extends Partial<CreateContractInput>>(
  input: T,
): Omit<T, "services"> {
  const { services: _drop, ...rest } = input as T & {
    services?: ContractServiceLineInput[];
  };
  void _drop;
  const out: Record<string, unknown> = { ...(rest as Record<string, unknown>) };
  for (const key of NULLABLE_TEXT_FIELDS) {
    if (key in out) {
      const v = out[key];
      out[key] = typeof v === "string" && v.length > 0 ? v : null;
    }
  }
  for (const key of NULLABLE_DATE_FIELDS) {
    if (key in out) {
      const v = out[key];
      out[key] = typeof v === "string" && v.length > 0 ? v : null;
    }
  }
  return out as Omit<T, "services">;
}

export const CONTRACT_STATUS_OPTIONS: {
  value: (typeof CONTRACT_STATUS)[number];
  label: string;
  tone: "blue" | "amber" | "emerald" | "slate" | "rose";
}[] = [
  { value: "draft", label: "Nháp", tone: "slate" },
  { value: "signed", label: "Đã ký", tone: "blue" },
  { value: "active", label: "Đang triển khai", tone: "emerald" },
  { value: "completed", label: "Hoàn thành", tone: "emerald" },
  { value: "cancelled", label: "Đã huỷ", tone: "rose" },
];
