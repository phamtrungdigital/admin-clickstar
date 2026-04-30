# E2E tests (Playwright)

## Run

```bash
# Install browsers (first time only)
npx playwright install chromium

# Run against local dev server (auto-spawned)
npm run test:e2e

# Run against a specific URL (e.g. Vercel preview)
PLAYWRIGHT_BASE_URL=https://admin-clickstar-xxx.vercel.app npm run test:e2e
```

## Authenticated tests (next step)

Tests touching dashboard pages need auth. Save a logged-in session once:

```ts
// tests/e2e/auth.setup.ts
import { test as setup } from "@playwright/test";

setup("authenticate", async ({ page }) => {
  await page.goto("/login");
  await page.fill('[name="identifier"]', process.env.E2E_USER!);
  await page.fill('[name="password"]', process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: /đăng nhập/i }).click();
  await page.waitForURL("/dashboard");
  await page.context().storageState({ path: "tests/e2e/.auth/user.json" });
});
```

Then add to `playwright.config.ts` projects:

```ts
{
  name: "auth-setup",
  testMatch: /auth\.setup\.ts/,
},
{
  name: "chromium-auth",
  use: { ...devices["Desktop Chrome"], storageState: "tests/e2e/.auth/user.json" },
  dependencies: ["auth-setup"],
}
```

Set `E2E_USER` and `E2E_PASSWORD` in a local `.env.test` file (gitignored).
