import { chromium } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const BASE = "http://localhost:5173";
const OUT = path.join(__dirname, "../design");

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Login as student
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', "john@student.edu");
  await page.fill('input[type="password"]', "password123");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2000);

  // Opportunity detail
  const oppId = "cmo1v5zdy000kmunbql02b7we"; // Park Cleanup Day
  await page.goto(`${BASE}/opportunity/${oppId}`);
  await page.waitForTimeout(2000);
  const text = await page.evaluate(() => document.body.innerText.slice(0, 200));
  console.log("Opp detail page:", text);
  await page.screenshot({ path: path.join(OUT, "student-opportunity-detail.png"), fullPage: true });
  console.log("✓ student-opportunity-detail.png");

  // Try slot detail — get a slot ID from the DB via API
  await page.goto(`${BASE}/browse`);
  await page.waitForTimeout(1500);
  const browseText = await page.evaluate(() => document.body.innerText.slice(0, 300));
  console.log("Browse:", browseText);
  await page.screenshot({ path: path.join(OUT, "student-browse-opportunities.png"), fullPage: true });
  console.log("✓ student-browse-opportunities.png");

  // Student dashboard full view
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, "student-dashboard.png"), fullPage: true });
  console.log("✓ student-dashboard.png");

  await ctx.close();

  // Org opportunity detail
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page2 = await ctx2.newPage();
  await page2.goto(`${BASE}/login`);
  await page2.fill('input[type="email"]', "volunteer@greenearth.org");
  await page2.fill('input[type="password"]', "password123");
  await page2.keyboard.press("Enter");
  await page2.waitForTimeout(2000);

  // Try navigating to opportunity detail for org
  await page2.goto(`${BASE}/opportunities/${oppId}`);
  await page2.waitForTimeout(1500);
  const orgOppText = await page2.evaluate(() => document.body.innerText.slice(0, 200));
  console.log("Org opp detail:", orgOppText);
  await page2.screenshot({ path: path.join(OUT, "organization-opportunity-detail.png"), fullPage: true });
  console.log("✓ organization-opportunity-detail.png");

  // Org dashboard fresh
  await page2.goto(`${BASE}/dashboard`);
  await page2.waitForTimeout(1500);
  await page2.screenshot({ path: path.join(OUT, "organization-dashboard.png"), fullPage: true });
  console.log("✓ organization-dashboard.png");

  await page2.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page2.waitForTimeout(400);
  await page2.screenshot({ path: path.join(OUT, "organization-dashboard-scrolled.png"), fullPage: true });
  console.log("✓ organization-dashboard-scrolled.png");

  await ctx2.close();
  await browser.close();

  console.log("\nTotal:", fs.readdirSync(OUT).filter(f => f.endsWith(".png")).length);
}

main().catch(console.error);
