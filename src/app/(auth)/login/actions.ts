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

  const { identifier, password, audience } = parsed.data;
  const isEmail = identifier.includes("@");

  const supabase = await createClient();
  const { data: signIn, error } = await supabase.auth.signInWithPassword(
    isEmail
      ? { email: identifier, password }
      : { phone: identifier, password },
  );

  if (error || !signIn.user) {
    return { ok: false, message: "Email/SĐT hoặc mật khẩu không đúng" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("audience, is_active")
    .eq("id", signIn.user.id)
    .maybeSingle();

  if (!profile) {
    await supabase.auth.signOut();
    return {
      ok: false,
      message: "Tài khoản chưa có hồ sơ. Liên hệ quản trị viên Clickstar.",
    };
  }

  if (!profile.is_active) {
    await supabase.auth.signOut();
    return {
      ok: false,
      message: "Tài khoản đã bị tạm khoá. Liên hệ quản trị viên Clickstar.",
    };
  }

  if (profile.audience !== audience) {
    await supabase.auth.signOut();
    const correctTab =
      profile.audience === "internal" ? "Nội bộ" : "Khách hàng";
    const wrongTab = audience === "internal" ? "Nội bộ" : "Khách hàng";
    return {
      ok: false,
      message: `Email này là tài khoản ${correctTab.toLowerCase()} — vui lòng chuyển sang tab ${correctTab} thay vì ${wrongTab}.`,
    };
  }

  redirect("/dashboard");
}
