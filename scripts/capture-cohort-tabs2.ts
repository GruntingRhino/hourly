import { chromium } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const BASE = "http://localhost:5173";
const OUT = path.join(__dirname, "../design");
// PW Cohort A belongs to PW School Admin A (test account)
const COHORT_ID = "cmo2yzkx7000dmubfp4owmtwz";

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Login
  await page.goto(`${BASE}/login`);
  await page.waitForTimeout(500);
  await page.fill('input[type="email"]', "school-admin@test.goodhours.app");
  await page.fill('input[type="password"]', "Playwright1!");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2000);
  console.log("URL after login:", page.url());

  // Navigate to cohort detail
  await page.goto(`${BASE}/cohorts/${COHORT_ID}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1000);

  const buttons = await page.$$eval("button", bs => bs.map(b => b.textContent?.trim()));
  console.log("Tab buttons:", buttons.filter(b => b && b.length < 30));

  // Enrolled tab (default)
  await page.screenshot({ path: path.join(OUT, "school-cohort-detail-enrolled.png"), fullPage: true });
  console.log("✓ school-cohort-detail-enrolled.png");

  // Analytics tab
  await page.locator("button").filter({ hasText: /^Analytics$/ }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, "school-cohort-detail-analytics.png"), fullPage: true });
  console.log("✓ school-cohort-detail-analytics.png");

  // Pending Invites tab
  await page.locator("button").filter({ hasText: /Pending Invites/ }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, "school-cohort-detail-pending-invites.png"), fullPage: true });
  console.log("✓ school-cohort-detail-pending-invites.png");

  // Import tab
  await page.locator("button").filter({ hasText: /^Import$/ }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, "school-cohort-detail-import.png"), fullPage: true });
  console.log("✓ school-cohort-detail-import.png");

  await browser.close();
  console.log("Done.");
}

main().catch(console.error);
