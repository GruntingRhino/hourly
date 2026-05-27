import { test, expect } from "@playwright/test";

const UI_BASE = process.env.PW_BASE_URL || process.env.UI_BASE_URL || "http://127.0.0.1:5173";

test("school settings integrations tab hides the session banner and runs Google Classroom mock sync", async ({ page }) => {
  await page.goto(`${UI_BASE}/login`, { waitUntil: "networkidle" });
  await page.locator('input[type="email"]').first().fill("school-admin@test.goodhours.app");
  await page.locator('input[type="password"]').fill("Playwright1!");
  await page.getByRole("button", { name: /sign in/i }).click();

  await page.waitForURL(/\/(dashboard|cohorts|opportunities|browse)$/, { timeout: 20000 });
  await page.goto(`${UI_BASE}/settings?tab=integrations`, { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "Google Classroom Integration" })).toBeVisible();
  await expect(page.getByText("Stay signed in across sessions?")).toHaveCount(0);
  await expect(page.getByText("Each GoodHours school connects to one Google Classroom school tenant.")).toBeVisible();
  await expect(page.getByPlaceholder("https://classroom.googleapis.com")).toBeVisible();

  await page.getByTestId("google-classroom-mode").selectOption("MOCK");
  await page.getByTestId("google-classroom-scenario").selectOption("default");
  await page.getByTestId("google-classroom-connect").click();
  await expect(page.getByText("Google Classroom mock connection created.")).toBeVisible();

  await page.getByTestId("google-classroom-preview").click();
  await expect(page.getByText("Google Classroom preview complete.")).toBeVisible({ timeout: 10000 });

  await page.getByTestId("google-classroom-apply").click();
  await expect(page.getByText("Google Classroom sync applied.")).toBeVisible({ timeout: 10000 });
});
