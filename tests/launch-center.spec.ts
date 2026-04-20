import { expect, test } from "@playwright/test";

const BASE = process.env.PW_BASE_URL || "http://localhost:5173";
const ACCOUNT = {
  email: "abhay.sivaram+1@gmail.com",
  password: "Playwright1!",
};

async function loginAsSchoolAdmin(page: import("@playwright/test").Page): Promise<void> {
  const res = await page.request.post(`${BASE}/api/auth/login`, {
    data: ACCOUNT,
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  const token = body.token as string;

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate((jwt) => {
    localStorage.setItem("goodhours_token", jwt);
    localStorage.removeItem("goodhours_user");
  }, token);
}

test("school admin can manage the launch center", async ({ page }) => {
  await loginAsSchoolAdmin(page);
  await page.goto(`${BASE}/launch`, { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "Launch Center" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Monitoring" })).toBeVisible();

  await page.getByRole("button", { name: "Support" }).click();
  await page.getByLabel("Support owner").fill("Launch Owner");
  await page.getByLabel("Owner email").fill("launch-owner@example.com");
  await page.getByRole("button", { name: "Save Support Process" }).click();
  await expect(page.getByText("Support process saved.")).toBeVisible();

  await page.getByRole("button", { name: "Bug Triage" }).click();
  await page.getByLabel("New bug title").fill(`Launch issue ${Date.now()}`);
  await page.getByLabel("New bug description").fill("Students cannot confirm the first invite batch.");
  await page.getByRole("button", { name: "Add Bug" }).click();
  await expect(page.getByText("Bug added to triage.")).toBeVisible();

  await page.getByLabel("Selected bug status").selectOption("MONITORING");
  await page.getByRole("button", { name: "Save Bug" }).click();
  await expect(page.getByText("Bug triage entry saved.")).toBeVisible();
});
