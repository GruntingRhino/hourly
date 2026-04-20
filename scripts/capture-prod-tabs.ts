import { chromium } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const PROD = "https://goodhours.app";
const OUT = path.join(__dirname, "../design");
const COHORT_ID = "cmo2yzkx7000dmubfp4owmtwz";

// Read token from a file if available, else prompt
// We'll use the stored token from the browser localStorage

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Login as PW School Admin using email/password if possible
  // From the seed data, the account is school-admin@test.goodhours.app but uses Google OAuth
  // Instead, let's use the API directly to get a token, then inject it

  // Try email/password login with the test account
  const loginRes = await page.request.post(`${PROD}/api/auth/login`, {
    data: { email: "school-admin@test.goodhours.app", password: "password123" },
  });

  if (!loginRes.ok()) {
    console.log("Login failed:", loginRes.status(), await loginRes.text());
    console.log("This account uses Google OAuth — need a different approach");
    await browser.close();
    return;
  }

  const { token } = await loginRes.json();
  console.log("Got token:", token.slice(0, 30) + "...");

  // Inject token into localStorage
  await page.goto(`${PROD}/`);
  await page.evaluate((t) => {
    localStorage.setItem("goodhours_token", t);
  }, token);

  // Now navigate to cohort detail
  await page.goto(`${PROD}/cohorts/${COHORT_ID}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1000);

  // Enrolled tab (default)
  await page.screenshot({ path: path.join(OUT, "school-cohort-detail-enrolled.png"), fullPage: true });
  console.log("✓ school-cohort-detail-enrolled.png");

  // Analytics tab
  await page.click("button:has-text('Analytics')");
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, "school-cohort-detail-analytics.png"), fullPage: true });
  console.log("✓ school-cohort-detail-analytics.png");

  // Pending Invites tab
  await page.click("button:has-text('Pending Invites')");
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, "school-cohort-detail-pending-invites.png"), fullPage: true });
  console.log("✓ school-cohort-detail-pending-invites.png");

  // Import tab
  await page.click("button:has-text('Import')");
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, "school-cohort-detail-import.png"), fullPage: true });
  console.log("✓ school-cohort-detail-import.png");

  await browser.close();
}

main().catch(console.error);
