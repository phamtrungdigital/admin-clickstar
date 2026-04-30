import { z } from "zod";

export const loginSchema = z.object({
  identifier: z
    .string()
    .min(1, "Vui lòng nhập email hoặc số điện thoại")
    .max(255),
  password: z.string().min(1, "Vui lòng nhập mật khẩu").max(128),
  rememberMe: z.boolean(),
  audience: z.enum(["internal", "customer"]),
});

export type LoginInput = z.infer<typeof loginSchema>;
