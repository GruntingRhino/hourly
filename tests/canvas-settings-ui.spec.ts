import { test, expect } from "@playwright/test";

const UI_BASE = process.env.UI_BASE_URL || "http://127.0.0.1:5174";

test("school settings integrations tab hides the session banner and runs Canvas mock sync", async ({ page }) => {
  await page.goto(`${UI_BASE}/login`, { waitUntil: "networkidle" });
  await page.locator('input[type="email"]').first().fill("school-admin@test.goodhours.app");
  await page.locator('input[type="password"]').fill("Playwright1!");
  await page.getByRole("button", { name: /sign in/i }).click();

  await page.waitForURL(/\/(dashboard|cohorts|opportunities|browse)$/, { timeout: 20000 });
  await page.goto(`${UI_BASE}/settings?tab=integrations`, { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "Canvas Integration" })).toBeVisible();
  await expect(page.getByText("Stay signed in across sessions?")).toHaveCount(0);
  await expect(page.getByText("Each GoodHours school connects to one Canvas school tenant.")).toBeVisible();
  await expect(page.getByPlaceholder("https://schoolname.instructure.com")).toBeVisible();

  await page.getByTestId("canvas-mode").selectOption("MOCK");
  await page.getByTestId("canvas-scenario").selectOption("default");
  await page.getByTestId("canvas-connect").click();
  await expect(page.getByText("Canvas mock connection created.")).toBeVisible();

  await page.getByTestId("canvas-preview").click();
  await expect(page.getByText("Canvas preview complete.")).toBeVisible();

  await page.getByTestId("canvas-apply").click();
  await expect(page.getByText("Canvas sync applied.")).toBeVisible();
});
