import { chromium } from "@playwright/test";
import * as path from "path";

const BASE = "http://localhost:5173";
const OUT = path.join(__dirname, "../design");

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Login as school admin
  await page.goto(`${BASE}/login`);
  await page.waitForTimeout(600);
  await page.fill('input[type="email"]', "admin@lincoln.edu");
  await page.fill('input[type="password"]', "password123");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2000);
  console.log("URL after login:", page.url());

  // Find cohort
  await page.goto(`${BASE}/cohorts`);
  await page.waitForTimeout(1000);

  const manageLink = page.getByRole("link", { name: /manage/i }).first();
  const isVisible = await manageLink.isVisible().catch(() => false);
  console.log("Manage link visible:", isVisible);

  if (isVisible) {
    const href = await manageLink.getAttribute("href");
    console.log("Cohort href:", href);
    if (href) {
      await page.goto(`${BASE}${href}`);
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(1000);

      // Log all tab buttons
      const allButtons = await page.$$eval("button", bs => bs.map(b => b.textContent?.trim()));
      console.log("Buttons:", allButtons);

      // Enrolled tab (should be default)
      await page.screenshot({ path: path.join(OUT, "school-cohort-detail-enrolled.png"), fullPage: true });
      console.log("✓ school-cohort-detail-enrolled.png");

      // Analytics tab
      const analyticsBtn = page.locator("button").filter({ hasText: /^Analytics$/ });
      if (await analyticsBtn.isVisible().catch(() => false)) {
        await analyticsBtn.click();
        await page.waitForTimeout(800);
        await page.screenshot({ path: path.join(OUT, "school-cohort-detail-analytics.png"), fullPage: true });
        console.log("✓ school-cohort-detail-analytics.png");
      } else {
        console.log("Analytics tab not found");
      }

      // Pending Invites tab
      const pendingBtn = page.locator("button").filter({ hasText: /Pending Invites/ });
      if (await pendingBtn.isVisible().catch(() => false)) {
        await pendingBtn.click();
        await page.waitForTimeout(800);
        await page.screenshot({ path: path.join(OUT, "school-cohort-detail-pending-invites.png"), fullPage: true });
        console.log("✓ school-cohort-detail-pending-invites.png");
      } else {
        console.log("Pending Invites tab not found");
      }

      // Import tab
      const importBtn = page.locator("button").filter({ hasText: /^Import$/ });
      if (await importBtn.isVisible().catch(() => false)) {
        await importBtn.click();
        await page.waitForTimeout(800);
        await page.screenshot({ path: path.join(OUT, "school-cohort-detail-import.png"), fullPage: true });
        console.log("✓ school-cohort-detail-import.png");
      } else {
        console.log("Import tab not found");
      }
    }
  } else {
    // List all links to debug
    const links = await page.$$eval("a", as => as.map(a => ({ text: a.textContent?.trim(), href: a.getAttribute("href") })));
    console.log("All links on cohorts page:", JSON.stringify(links, null, 2));
  }

  await browser.close();
}

main().catch(console.error);
