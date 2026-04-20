import { chromium } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const BASE = "http://localhost:5173";
const OUT = path.join(__dirname, "../design");

async function shot(page: any, name: string) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
  console.log(`✓ ${name}.png`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Public auth/flow pages
  await page.goto(`${BASE}/forgot-password`);
  await shot(page, "forgot-password-page");

  await page.goto(`${BASE}/reset-password`);
  await shot(page, "reset-password-page");

  await page.goto(`${BASE}/verify-email`);
  await shot(page, "verify-email-page");

  await page.goto(`${BASE}/join/student`);
  await shot(page, "join-student-invitation-page");

  await page.goto(`${BASE}/join/beneficiary`);
  await shot(page, "join-beneficiary-invitation-page");

  await page.goto(`${BASE}/parent-progress`);
  await shot(page, "parent-progress-page");

  await page.goto(`${BASE}/school/verify-registration`);
  await shot(page, "school-verify-registration-page");

  // School onboarding (login as fresh school — use lincoln which may trigger onboarding)
  // Actually just capture the onboarding route directly after logging in as school admin
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', "admin@lincoln.edu");
  await page.fill('input[type="password"]', "password123");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2000);
  if (!page.url().includes("/login")) {
    await page.goto(`${BASE}/onboarding`);
    await shot(page, "school-onboarding-page");

    // Also get the school cohort detail (local with real data)
    await page.goto(`${BASE}/cohorts`);
    await page.waitForTimeout(1000);
    const manageLinks = await page.$$eval("a[href*='/cohorts/'], button", (els: any[]) =>
      els.map((e: any) => ({ text: e.textContent?.trim(), href: e.getAttribute?.("href") }))
         .filter((e: any) => e.href?.match(/\/cohorts\/[a-z0-9]+$/))
    );
    if (manageLinks.length > 0) {
      await page.goto(`${BASE}${manageLinks[0].href}`);
      await shot(page, "school-cohort-detail-local");
    }
  }

  // Org — capture opportunity list with real seed data
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', "volunteer@greenearth.org");
  await page.fill('input[type="password"]', "password123");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2000);
  if (!page.url().includes("/login")) {
    // Opportunity create form — full scroll
    await page.goto(`${BASE}/opportunities/create`);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT, "organization-create-opportunity.png"), fullPage: true });
    console.log("✓ organization-create-opportunity.png (refreshed)");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, "organization-create-opportunity-scrolled.png"), fullPage: true });
    console.log("✓ organization-create-opportunity-scrolled.png (refreshed)");
  }

  await ctx.close();
  await browser.close();

  const all = fs.readdirSync(OUT).filter(f => f.endsWith(".png"));
  console.log(`\nTotal screenshots: ${all.length}`);
  console.log("Files:\n" + all.sort().join("\n"));
}

main().catch(console.error);
