import { expect, test } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.describe("authenticated learner", () => {
  test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD to run this suite.");

  test("sign in and reach the dashboard", async ({ page }) => {
    await page.goto("/auth");
    await page.locator(".auth-tab", { hasText: "Sign in" }).click();
    await page.locator('input[autocomplete="email"]').fill(email!);
    await page.locator('input[autocomplete="current-password"]').fill(password!);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: /Welcome back/i })).toBeVisible();
  });
});
