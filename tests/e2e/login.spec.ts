import { test, expect } from "@playwright/test";

test.describe("Login page", () => {
  test("renders login form", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByRole("textbox", { name: /email|số điện thoại|identifier/i }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /đăng nhập|sign in/i }),
    ).toBeVisible();
  });

  test("shows validation when submitting empty form", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /đăng nhập|sign in/i }).click();
    await expect(page.getByText(/email hoặc số điện thoại|mật khẩu/i).first()).toBeVisible();
  });
});
