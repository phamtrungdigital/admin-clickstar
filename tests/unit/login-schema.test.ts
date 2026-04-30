import { describe, it, expect } from "vitest";
import { loginSchema } from "@/lib/auth/schemas";

describe("loginSchema", () => {
  const valid = {
    identifier: "user@clickstar.vn",
    password: "secret123",
    rememberMe: false,
    audience: "internal" as const,
  };

  it("accepts valid input", () => {
    const result = loginSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects empty identifier", () => {
    const result = loginSchema.safeParse({ ...valid, identifier: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("email hoặc số điện thoại");
    }
  });

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({ ...valid, password: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid audience", () => {
    const result = loginSchema.safeParse({ ...valid, audience: "admin" });
    expect(result.success).toBe(false);
  });
});
