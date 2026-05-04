import { z } from "zod";

const trimmed = z.string().trim();

export const updateMyProfileSchema = z.object({
  full_name: trimmed.min(1, "Họ tên không được để trống").max(255),
  phone: trimmed.max(50),
  avatar_url: trimmed.max(2048),
});
export type UpdateMyProfileInput = z.infer<typeof updateMyProfileSchema>;

export const changeMyPasswordSchema = z
  .object({
    new_password: z
      .string()
      .min(6, "Mật khẩu tối thiểu 6 ký tự")
      .max(72, "Mật khẩu tối đa 72 ký tự"),
    confirm_password: z.string(),
  })
  .refine((v) => v.new_password === v.confirm_password, {
    path: ["confirm_password"],
    message: "Mật khẩu xác nhận không khớp",
  });
export type ChangeMyPasswordInput = z.input<typeof changeMyPasswordSchema>;
