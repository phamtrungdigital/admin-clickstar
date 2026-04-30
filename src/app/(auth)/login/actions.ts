"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, type LoginInput } from "@/lib/auth/schemas";

export type LoginActionResult =
  | { ok: true }
  | { ok: false; message: string };

export async function loginAction(input: LoginInput): Promise<LoginActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
  }

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return {
      ok: false,
      message: "Hệ thống chưa cấu hình Supabase. Liên hệ quản trị viên.",
    };
  }

  const { identifier, password } = parsed.data;
  const isEmail = identifier.includes("@");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(
    isEmail
      ? { email: identifier, password }
      : { phone: identifier, password },
  );

  if (error) {
    return { ok: false, message: "Email/SĐT hoặc mật khẩu không đúng" };
  }

  redirect("/dashboard");
}
