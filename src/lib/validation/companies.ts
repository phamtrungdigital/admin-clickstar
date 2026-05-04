import { z } from "zod";

const COMPANY_STATUS = ["new", "active", "paused", "ended"] as const;

const trimmedString = z.string().trim();

/**
 * Form schema — what the user types. All optional fields are strings (use ""
 * for empty). Use `normalizeCompanyInput()` before persisting to convert empty
 * strings to null for the database.
 */
export const createCompanySchema = z.object({
  name: trimmedString.min(2, "Tên doanh nghiệp tối thiểu 2 ký tự").max(255),
  code: trimmedString.max(255),
  status: z.enum(COMPANY_STATUS),
  industry: trimmedString.max(255),
  website: trimmedString
    .max(255)
    .refine(
      (v) => !v || /^https?:\/\//.test(v) || /^[\w.-]+\.[a-z]{2,}/i.test(v),
      "Website không hợp lệ",
    ),
  representative: trimmedString.max(255),
  email: trimmedString
    .min(1, "Email là bắt buộc — dùng để tạo tài khoản đăng nhập cho khách")
    .max(255)
    .refine(
      (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      "Email không hợp lệ",
    ),
  phone: trimmedString.max(255),
  address: trimmedString.max(1000),
  tax_code: trimmedString.max(255),
  primary_account_manager_id: z.string().uuid().nullable(),
  service_ids: z.array(z.string().uuid()),
});

export const updateCompanySchema = createCompanySchema.partial();

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;

export const COMPANY_STATUS_OPTIONS: {
  value: (typeof COMPANY_STATUS)[number];
  label: string;
}[] = [
  { value: "new", label: "Mới" },
  { value: "active", label: "Đang triển khai" },
  { value: "paused", label: "Tạm dừng" },
  { value: "ended", label: "Kết thúc" },
];

const NULLABLE_FIELDS = [
  "code",
  "industry",
  "representative",
  // email không nullable nữa — bắt buộc để tạo tài khoản đăng nhập cho KH
  "phone",
  "address",
  "tax_code",
] as const;

const URL_FIELDS = ["website"] as const;

/**
 * Convert form values into the shape we persist:
 * - Empty strings → null for nullable text fields.
 * - Email lowercased.
 * - Website auto-prefixed with https:// if no scheme.
 */
export function normalizeCompanyInput<T extends Partial<CreateCompanyInput>>(
  input: T,
): T {
  const out: Record<string, unknown> = { ...input };

  for (const key of NULLABLE_FIELDS) {
    if (key in out) {
      const v = out[key];
      out[key] = typeof v === "string" && v.length > 0 ? v : null;
    }
  }

  if (typeof out.email === "string" && out.email) {
    out.email = out.email.toLowerCase();
  }

  for (const key of URL_FIELDS) {
    if (key in out) {
      const v = out[key];
      if (typeof v === "string" && v.length > 0) {
        out[key] = /^https?:\/\//.test(v) ? v : `https://${v}`;
      } else {
        out[key] = null;
      }
    }
  }

  return out as T;
}
