import { z } from "zod";

export const INTERNAL_ROLES = [
  "super_admin",
  "admin",
  "manager",
  "staff",
  "support",
  "accountant",
] as const;

export const AUDIENCES = ["internal", "customer"] as const;

const trimmed = z.string().trim();

export const createUserSchema = z.object({
  email: trimmed
    .min(1, "Email không được để trống")
    .max(255)
    .email("Email không hợp lệ"),
  full_name: trimmed.min(2, "Tên tối thiểu 2 ký tự").max(255),
  phone: trimmed.max(64),
  audience: z.enum(AUDIENCES),
  internal_role: z.enum(INTERNAL_ROLES).nullable(),
  is_active: z.boolean(),
  password: trimmed.min(6, "Mật khẩu tối thiểu 6 ký tự").max(72),
});

// On edit: email + password not changed via this form (separate flows).
export const updateUserSchema = z.object({
  full_name: trimmed.min(2).max(255).optional(),
  phone: trimmed.max(64).optional(),
  audience: z.enum(AUDIENCES).optional(),
  internal_role: z.enum(INTERNAL_ROLES).nullable().optional(),
  is_active: z.boolean().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const INTERNAL_ROLE_OPTIONS: {
  value: (typeof INTERNAL_ROLES)[number];
  label: string;
  description: string;
}[] = [
  {
    value: "super_admin",
    label: "Super Admin",
    description: "Toàn quyền hệ thống — quản trị, dữ liệu, người dùng.",
  },
  {
    value: "admin",
    label: "Admin",
    description: "Quản trị hệ thống, người dùng và dữ liệu.",
  },
  {
    value: "manager",
    label: "Manager",
    description: "Xem KH/dự án được phân quyền, báo cáo, giao việc.",
  },
  {
    value: "staff",
    label: "Nhân viên triển khai",
    description: "Xem và cập nhật công việc được giao.",
  },
  {
    value: "support",
    label: "CSKH",
    description: "Xem khách hàng, ticket, tương tác chăm sóc.",
  },
  {
    value: "accountant",
    label: "Kế toán",
    description: "Xem hợp đồng, thanh toán, công nợ, file liên quan.",
  },
];

export const AUDIENCE_OPTIONS: {
  value: (typeof AUDIENCES)[number];
  label: string;
}[] = [
  { value: "internal", label: "Nội bộ" },
  { value: "customer", label: "Khách hàng" },
];

export function roleLabel(role: string | null | undefined): string {
  if (!role) return "—";
  return INTERNAL_ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role;
}
