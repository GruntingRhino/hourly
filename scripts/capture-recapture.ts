import { chromium, Browser, Page } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const BASE = "http://localhost:5173";
const OUT = path.join(__dirname, "../design");

async function shot(page: Page, name: string) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(800);
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
  if (page.url().includes("/login")) throw new Error(`Login failed for ${email}`);
  console.log(`  Logged in as ${email}`);
}

async function capturePublic(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // Login page
  await page.goto(`${BASE}/login`);
  await shot(page, "login-page");

  // New landing page sections — full-page screenshot captures all sections
  await page.goto(`${BASE}/`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, "new-landing-page.png"), fullPage: true });
  console.log("✓ new-landing-page.png");

  // Capture landing sections by scrolling to each
  // Stats bar section
  await page.evaluate(() => {
    const el = document.querySelector(".bg-gradient-to-r, [class*='stats'], section:nth-of-type(2)");
    el?.scrollIntoView();
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "landing-page-stats-bar.png") });
  console.log("✓ landing-page-stats-bar.png");

  // Demo section — click Student tab
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const studentBtn = buttons.find(b => b.textContent?.trim() === "Student");
    studentBtn?.scrollIntoView({ behavior: "instant", block: "center" });
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, "landing-page-demo-section.png") });
  console.log("✓ landing-page-demo-section.png");

  // Click Student tab
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const studentBtn = buttons.find(b => b.textContent?.trim() === "Student");
    studentBtn?.click();
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "landing-page-demo-student.png") });
  console.log("✓ landing-page-demo-student.png");

  // Click Partner tab
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const partnerBtn = buttons.find(b => b.textContent?.includes("Partner") || b.textContent?.includes("Org"));
    partnerBtn?.click();
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "landing-page-demo-partner.png") });
  console.log("✓ landing-page-demo-partner.png");

  // Click School tab back
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const schoolBtn = buttons.find(b => b.textContent?.trim() === "School Admin" || b.textContent?.trim() === "School");
    schoolBtn?.click();
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "landing-page-demo-school.png") });
  console.log("✓ landing-page-demo-school.png");

  // How It Works section
  await page.evaluate(() => {
    const el = document.getElementById("how") || document.querySelector("[id='how'], h2[class*='How'], section");
    el?.scrollIntoView({ behavior: "instant", block: "start" });
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "landing-page-how-it-works.png") });
  console.log("✓ landing-page-how-it-works.png");

  // Features section
  await page.evaluate(() => {
    const el = document.getElementById("features");
    el?.scrollIntoView({ behavior: "instant", block: "start" });
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "landing-page-features.png") });
  console.log("✓ landing-page-features.png");

  // CTA + Footer
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "landing-page-cta-footer.png") });
  console.log("✓ landing-page-cta-footer.png");

  await ctx.close();
}

async function captureOrg(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await login(page, "volunteer@greenearth.org", "password123");

  // Opportunity detail — click first opportunity from opportunities list
  await page.goto(`${BASE}/opportunities`);
  await page.waitForTimeout(1000);

  // Find a link to an opportunity
  const oppLinks = page.locator("a[href*='/opportunities/']");
  const count = await oppLinks.count();
  console.log(`  Found ${count} opportunity links`);

  if (count > 0) {
    for (let i = 0; i < count; i++) {
      const href = await oppLinks.nth(i).getAttribute("href");
      if (href && !href.includes("create")) {
        await page.goto(`${BASE}${href}`);
        await shot(page, "organization-opportunity-detail");
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(400);
        await shot(page, "organization-opportunity-detail-scrolled");
        break;
      }
    }
  } else {
    // Try clicking the title of the first opportunity card
    const firstCard = page.locator("h3, .font-semibold, [class*='card']").first();
    if (await firstCard.isVisible().catch(() => false)) {
      await firstCard.click();
      await page.waitForTimeout(1500);
      await shot(page, "organization-opportunity-detail");
    }
  }

  // Student signups tab
  await page.goto(`${BASE}/opportunities`);
  await page.waitForTimeout(800);
  const signupsTab = page.getByRole("tab", { name: /signups/i })
    .or(page.getByText(/Student Signups/i).first());
  if (await signupsTab.isVisible().catch(() => false)) {
    await signupsTab.click();
    await page.waitForTimeout(600);
    await shot(page, "organization-student-signups");
  }

  // Messages — BENEFICIARY_ADMIN doesn't have /messages route; skip
  // Settings
  await page.goto(`${BASE}/settings`);
  await shot(page, "organization-settings-page");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await shot(page, "organization-settings-page-scrolled");

  await ctx.close();
}

async function captureSchool(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await login(page, "admin@lincoln.edu", "password123");

  // Launch center
  await page.goto(`${BASE}/launch`);
  await shot(page, "school-launch-center");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  await shot(page, "school-launch-center-scrolled");

  // Cohort detail with tabs
  await page.goto(`${BASE}/cohorts`);
  await page.waitForTimeout(800);

  // Find manage link
  const manageLink = page.getByRole("link", { name: /manage/i }).first();
  if (await manageLink.isVisible().catch(() => false)) {
    const href = await manageLink.getAttribute("href");
    if (href) {
      await page.goto(`${BASE}${href}`);
      await page.waitForTimeout(800);

      // Analytics tab
      const analyticsTab = page.getByRole("button", { name: /analytics/i })
        .or(page.getByText("Analytics").first());
      if (await analyticsTab.isVisible().catch(() => false)) {
        await analyticsTab.click();
        await page.waitForTimeout(600);
        await shot(page, "school-cohort-detail-analytics");
      }

      // Pending Invites tab
      const pendingTab = page.getByRole("button", { name: /pending/i })
        .or(page.getByText(/Pending Invites/i).first());
      if (await pendingTab.isVisible().catch(() => false)) {
        await pendingTab.click();
        await page.waitForTimeout(600);
        await shot(page, "school-cohort-detail-pending-invites");
      }

      // Import tab
      const importTab = page.getByRole("button", { name: /import/i })
        .or(page.getByText("Import").first());
      if (await importTab.isVisible().catch(() => false)) {
        await importTab.click();
        await page.waitForTimeout(600);
        await shot(page, "school-cohort-detail-import");
      }
    }
  }

  await ctx.close();
}

async function captureStudent(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await login(page, "john@student.edu", "password123");

  // Try to find an opportunity to view
  await page.goto(`${BASE}/browse`);
  await page.waitForTimeout(1500);

  const oppLinks = page.locator("a[href*='/browse/'], a[href*='/opportunity/']");
  const count = await oppLinks.count();
  console.log(`  Student found ${count} opportunity links`);

  if (count > 0) {
    const href = await oppLinks.first().getAttribute("href");
    if (href) {
      await page.goto(`${BASE}${href}`);
      await shot(page, "student-opportunity-detail");
    }
  } else {
    // Log what's on the page for diagnosis
    const text = await page.evaluate(() => document.body.innerText.slice(0, 300));
    console.log("  Browse page content:", text);
    await page.screenshot({ path: path.join(OUT, "student-opportunity-detail-empty.png"), fullPage: true });
    console.log("✓ student-opportunity-detail-empty.png (no opportunities available for this student)");
  }

  await ctx.close();
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  try {
    console.log("\n=== PUBLIC PAGES ===");
    await capturePublic(browser).catch(e => console.error("Public capture failed:", e.message));

    console.log("\n=== ORGANIZATION PAGES ===");
    await captureOrg(browser).catch(e => console.error("Org capture failed:", e.message));

    console.log("\n=== SCHOOL PAGES ===");
    await captureSchool(browser).catch(e => console.error("School capture failed:", e.message));

    console.log("\n=== STUDENT PAGES ===");
    await captureStudent(browser).catch(e => console.error("Student capture failed:", e.message));
  } finally {
    await browser.close();
  }

  const all = fs.readdirSync(OUT).filter(f => f.endsWith(".png"));
  console.log(`\nTotal screenshots: ${all.length}`);
  console.log(all.sort().join("\n"));
}

main().catch(console.error);
