import { chromium, Browser, Page } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const BASE = "http://localhost:5173";
const OUT = path.join(__dirname, "../design");

async function shot(page: Page, name: string) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
  console.log(`✓ ${name}.png`);
}

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`);
  await page.waitForTimeout(600);
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2000);
  const url = page.url();
  if (url.includes("/login")) throw new Error(`Login failed for ${email}`);
  console.log(`  Logged in as ${email} → ${url}`);
}

async function captureStudent(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await login(page, "john@student.edu", "password123");

  // Dashboard/home
  await page.goto(`${BASE}/`);
  await shot(page, "student-dashboard");

  // Browse opportunities
  await page.goto(`${BASE}/browse`);
  await shot(page, "student-browse-opportunities");

  // Click first opportunity for detail view
  const oppLinks = page.locator("a[href*='/browse/'], a[href*='/opportunities/']");
  const count = await oppLinks.count();
  if (count > 0) {
    const href = await oppLinks.first().getAttribute("href");
    if (href) {
      await page.goto(`${BASE}${href}`);
      await shot(page, "student-opportunity-detail");
    }
  }

  // Self-submit hours
  await page.goto(`${BASE}/submit`);
  await shot(page, "student-submit-hours");

  // Messages
  await page.goto(`${BASE}/messages`);
  await shot(page, "student-messages-page");

  // Settings
  await page.goto(`${BASE}/settings`);
  await shot(page, "student-settings-page");

  await ctx.close();
}

async function captureOrg(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await login(page, "volunteer@greenearth.org", "password123");

  // Dashboard
  await page.goto(`${BASE}/`);
  await shot(page, "organization-dashboard");

  // Scroll dashboard
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  await shot(page, "organization-dashboard-scrolled");

  // Opportunities list
  await page.goto(`${BASE}/opportunities`);
  await shot(page, "organization-opportunities-list");

  // Create opportunity
  await page.goto(`${BASE}/opportunities/create`);
  await shot(page, "organization-create-opportunity");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  await shot(page, "organization-create-opportunity-scrolled");

  // Opportunity detail — click first
  await page.goto(`${BASE}/opportunities`);
  await page.waitForTimeout(800);
  const firstLink = page.locator("a[href*='/opportunities/']").first();
  if (await firstLink.isVisible().catch(() => false)) {
    const href = await firstLink.getAttribute("href");
    if (href && !href.includes("create")) {
      await page.goto(`${BASE}${href}`);
      await shot(page, "organization-opportunity-detail");
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await shot(page, "organization-opportunity-detail-scrolled");
    }
  }

  // Sessions
  await page.goto(`${BASE}/sessions`);
  await shot(page, "organization-sessions-page");

  // Messages
  await page.goto(`${BASE}/messages`);
  await shot(page, "organization-messages-page");

  // Settings
  await page.goto(`${BASE}/settings`);
  await shot(page, "organization-settings-page");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await shot(page, "organization-settings-page-scrolled");

  await ctx.close();
}

async function captureSchoolLocal(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await login(page, "admin@lincoln.edu", "password123");

  // School onboarding (fresh school view)
  await page.goto(`${BASE}/`);
  await shot(page, "school-dashboard-local");

  // Scroll dashboard
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  await shot(page, "school-dashboard-local-scrolled");

  // Cohorts with more data
  await page.goto(`${BASE}/cohorts`);
  await shot(page, "school-cohorts-list-local");

  // First cohort detail
  const manageBtn = page.getByRole("link", { name: /manage/i }).first();
  if (await manageBtn.isVisible().catch(() => false)) {
    await manageBtn.click();
    await shot(page, "school-cohort-detail-local");
    // Analytics tab
    const analyticsTab = page.getByText("Analytics").first();
    if (await analyticsTab.isVisible().catch(() => false)) {
      await analyticsTab.click();
      await page.waitForTimeout(500);
      await shot(page, "school-cohort-analytics-local");
    }
    // Pending Invites tab
    const pendingTab = page.getByText(/Pending Invites/i).first();
    if (await pendingTab.isVisible().catch(() => false)) {
      await pendingTab.click();
      await page.waitForTimeout(500);
      await shot(page, "school-cohort-pending-invites-local");
    }
    // Import tab
    const importTab = page.getByText("Import").first();
    if (await importTab.isVisible().catch(() => false)) {
      await importTab.click();
      await page.waitForTimeout(500);
      await shot(page, "school-cohort-import-local");
    }
  }

  await ctx.close();
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  try {
    console.log("\n=== STUDENT PAGES ===");
    await captureStudent(browser).catch(e => console.error("Student capture failed:", e.message));

    console.log("\n=== ORGANIZATION PAGES ===");
    await captureOrg(browser).catch(e => console.error("Org capture failed:", e.message));

    console.log("\n=== SCHOOL (LOCAL - more seeded data) ===");
    await captureSchoolLocal(browser).catch(e => console.error("School local capture failed:", e.message));
  } finally {
    await browser.close();
  }

  const all = fs.readdirSync(OUT).filter(f => f.endsWith(".png"));
  console.log(`\nTotal screenshots: ${all.length}`);
}

main().catch(console.error);
