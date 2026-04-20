import { chromium, Browser, Page } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const BASE_URL = "https://goodhours.app";
const OUT_DIR = path.join(__dirname, "../design");

const SCHOOL_EMAIL = "admin@lincoln.edu";
const SCHOOL_PASS = "password123";
const STUDENT_EMAIL = "john@student.edu";
const STUDENT_PASS = "password123";
const ORG_EMAIL = "volunteer@greenearth.org";
const ORG_PASS = "password123";

async function shot(page: Page, name: string) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(800);
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`✓ ${name}.png`);
}

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(500);

  // Fill login form — try common selectors
  const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
  const passInput = page.locator('input[type="password"]').first();
  await emailInput.fill(email);
  await passInput.fill(password);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1500);
}

async function capturePublicPages(page: Page) {
  // Landing page
  await page.goto(BASE_URL);
  await shot(page, "landing-page");

  // Scroll hero preview (school tab already active)
  await page.evaluate(() => window.scrollTo(0, 300));
  await shot(page, "landing-page-demo-school-tab");

  // Click Student tab
  const studentTab = page.getByRole("button", { name: /student/i }).first();
  if (await studentTab.isVisible()) {
    await studentTab.click();
    await page.waitForTimeout(400);
    await shot(page, "landing-page-demo-student-tab");
  }

  // Click Partner tab
  const partnerTab = page.getByRole("button", { name: /partner/i }).first();
  if (await partnerTab.isVisible()) {
    await partnerTab.click();
    await page.waitForTimeout(400);
    await shot(page, "landing-page-demo-partner-tab");
  }

  // Scroll to stats + features
  await page.evaluate(() => window.scrollTo(0, 0));

  // Login page
  await page.goto(`${BASE_URL}/login`);
  await shot(page, "login-page");

  // Signup page
  await page.goto(`${BASE_URL}/signup`);
  await shot(page, "signup-page");

  // School registration
  await page.goto(`${BASE_URL}/school/register`);
  await shot(page, "school-registration-page");
}

async function captureSchoolPages(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await login(page, SCHOOL_EMAIL, SCHOOL_PASS);

  // Dashboard
  await page.goto(`${BASE_URL}/`);
  await shot(page, "school-dashboard");

  // Full scroll of dashboard
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  await shot(page, "school-dashboard-bottom");

  // Cohorts list
  await page.goto(`${BASE_URL}/cohorts`);
  await shot(page, "school-cohorts-list");

  // Individual cohort — click first one
  const firstCohort = page.locator("a[href*='/cohorts/']").first();
  if (await firstCohort.isVisible()) {
    const href = await firstCohort.getAttribute("href");
    if (href) {
      await page.goto(`${BASE_URL}${href}`);
      await shot(page, "school-cohort-detail");
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(300);
      await shot(page, "school-cohort-detail-bottom");
    }
  }

  // Beneficiaries / Partners
  await page.goto(`${BASE_URL}/beneficiaries`);
  await shot(page, "school-partners-page");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  await shot(page, "school-partners-page-bottom");

  // Beneficiary directory (if it exists)
  const dirLink = page.getByRole("link", { name: /directory/i }).first();
  if (await dirLink.isVisible().catch(() => false)) {
    await dirLink.click();
    await shot(page, "school-beneficiary-directory");
  }

  // Students roster
  await page.goto(`${BASE_URL}/students`);
  await shot(page, "school-students-roster");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await shot(page, "school-students-roster-bottom");

  // On-track students
  await page.goto(`${BASE_URL}/students/on-track`);
  await shot(page, "school-students-on-track");

  // Off-track students
  await page.goto(`${BASE_URL}/students/off-track`);
  await shot(page, "school-students-off-track");

  // Submissions
  await page.goto(`${BASE_URL}/submissions`);
  await shot(page, "school-submissions-page");

  // Launch center
  await page.goto(`${BASE_URL}/launch`);
  await shot(page, "school-launch-center");

  // Messages
  await page.goto(`${BASE_URL}/messages`);
  await shot(page, "school-messages-page");

  // Settings
  await page.goto(`${BASE_URL}/settings`);
  await shot(page, "school-settings-page");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await shot(page, "school-settings-page-bottom");

  await ctx.close();
}

async function captureStudentPages(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await login(page, STUDENT_EMAIL, STUDENT_PASS);

  // Student dashboard / browse
  await page.goto(`${BASE_URL}/`);
  await shot(page, "student-dashboard");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  await shot(page, "student-dashboard-bottom");

  // Browse opportunities
  await page.goto(`${BASE_URL}/browse`);
  await shot(page, "student-browse-opportunities");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await shot(page, "student-browse-opportunities-bottom");

  // Opportunity detail — click first visible
  const firstOpp = page.locator("a[href*='/opportunities/'], a[href*='/browse/']").first();
  if (await firstOpp.isVisible().catch(() => false)) {
    const href = await firstOpp.getAttribute("href");
    if (href) {
      await page.goto(`${BASE_URL}${href}`);
      await shot(page, "student-opportunity-detail");
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await shot(page, "student-opportunity-detail-bottom");
    }
  }

  // Submit hours / self-submit page
  await page.goto(`${BASE_URL}/submit`);
  await shot(page, "student-submit-hours");

  // Messages
  await page.goto(`${BASE_URL}/messages`);
  await shot(page, "student-messages-page");

  // Settings
  await page.goto(`${BASE_URL}/settings`);
  await shot(page, "student-settings-page");

  await ctx.close();
}

async function captureOrgPages(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await login(page, ORG_EMAIL, ORG_PASS);

  // Org dashboard
  await page.goto(`${BASE_URL}/`);
  await shot(page, "organization-dashboard");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  await shot(page, "organization-dashboard-bottom");

  // Opportunities list
  await page.goto(`${BASE_URL}/opportunities`);
  await shot(page, "organization-opportunities-list");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await shot(page, "organization-opportunities-list-bottom");

  // Create opportunity
  await page.goto(`${BASE_URL}/opportunities/create`);
  await shot(page, "organization-create-opportunity");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await shot(page, "organization-create-opportunity-bottom");

  // Opportunity detail (click first)
  const firstOpp = page.locator("a[href*='/opportunities/']").first();
  if (await firstOpp.isVisible().catch(() => false)) {
    const href = await firstOpp.getAttribute("href");
    if (href && !href.includes("create")) {
      await page.goto(`${BASE_URL}${href}`);
      await shot(page, "organization-opportunity-detail");
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await shot(page, "organization-opportunity-detail-bottom");
    }
  }

  // Sessions / check-in
  await page.goto(`${BASE_URL}/sessions`);
  await shot(page, "organization-sessions-page");

  // Messages
  await page.goto(`${BASE_URL}/messages`);
  await shot(page, "organization-messages-page");

  // Settings / profile
  await page.goto(`${BASE_URL}/settings`);
  await shot(page, "organization-settings-page");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await shot(page, "organization-settings-page-bottom");

  await ctx.close();
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  try {
    // Public pages (no auth)
    const pubCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const pubPage = await pubCtx.newPage();
    await capturePublicPages(pubPage);
    await pubCtx.close();

    // School admin
    await captureSchoolPages(browser);

    // Student
    await captureStudentPages(browser);

    // Organization
    await captureOrgPages(browser);
  } finally {
    await browser.close();
  }

  console.log(`\nAll screenshots saved to: ${OUT_DIR}`);
  console.log(`Total: ${fs.readdirSync(OUT_DIR).filter(f => f.endsWith(".png")).length} screenshots`);
}

main().catch(console.error);
