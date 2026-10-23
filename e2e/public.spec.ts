import { expect, test } from "@playwright/test";

test("landing page renders with current counts", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.locator("h1")).toContainText("The IELTS is a system.");
  await expect(page.getByText("26,402", { exact: true }).first()).toBeVisible();
});

test("dashboard requires a session", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/auth$/);
  await expect(page.getByRole("heading", { name: /Start your band journey/i })).toBeVisible();
});

test("protected APIs reject anonymous requests", async ({ request }) => {
  const questions = await request.get("/api/questions?limit=1");
  expect(questions.status()).toBe(401);
  const ai = await request.post("/api/ai/evaluate", { data: { mode: "writing" } });
  expect(ai.status()).toBe(401);
});

test("health endpoint and security headers", async ({ request }) => {
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({ ok: true, service: "ieltshack" });

  const home = await request.get("/");
  const headers = home.headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
});
