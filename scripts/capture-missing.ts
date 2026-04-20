import { chromium } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const BASE = "http://localhost:5173";
const OUT = path.join(__dirname, "../design");

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  // ── STUDENT opportunity detail ──────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    // Login as student
    await page.goto(`${BASE}/login`);
    await page.fill('input[type="email"]', "john@student.edu");
    await page.fill('input[type="password"]', "password123");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(2000);
    console.log("Student URL after login:", page.url());

    // Browse
    await page.goto(`${BASE}/browse`);
    await page.waitForTimeout(2000);

    // Log all links to debug
    const links = await page.$$eval("a", els =>
      els.map(a => ({ text: a.textContent?.trim().slice(0, 40), href: a.getAttribute("href") }))
        .filter(l => l.href)
    );
    console.log("Browse page links:", JSON.stringify(links.slice(0, 20), null, 2));

    // Log page text to see what's rendered
    const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500));
    console.log("Browse page content:", bodyText);

    // Try clicking any card or button that looks like an opportunity
    const anyCard = page.locator(".cursor-pointer, [class*='card'], [class*='opportunity']").first();
    if (await anyCard.isVisible().catch(() => false)) {
      await anyCard.click();
      await page.waitForTimeout(1500);
      console.log("After card click URL:", page.url());
      await page.screenshot({ path: path.join(OUT, "student-opportunity-detail.png"), fullPage: true });
      console.log("✓ student-opportunity-detail.png");
    }

    // Also capture the browse page with some text rendered
    await page.goto(`${BASE}/browse`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUT, "student-browse-opportunities.png"), fullPage: true });
    console.log("✓ student-browse-opportunities.png (refreshed)");

    await ctx.close();
  }

  // ── ORG opportunity detail ──────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    await page.goto(`${BASE}/login`);
    await page.fill('input[type="email"]', "volunteer@greenearth.org");
    await page.fill('input[type="password"]', "password123");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(2000);

    await page.goto(`${BASE}/opportunities`);
    await page.waitForTimeout(2000);

    const links = await page.$$eval("a", els =>
      els.map(a => ({ text: a.textContent?.trim().slice(0, 40), href: a.getAttribute("href") }))
        .filter(l => l.href && l.href.includes("/opportunities/") && !l.href.includes("create"))
    );
    console.log("Org opportunity links:", links);

    if (links.length > 0 && links[0].href) {
      await page.goto(`${BASE}${links[0].href}`);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(OUT, "organization-opportunity-detail.png"), fullPage: true });
      console.log("✓ organization-opportunity-detail.png");
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT, "organization-opportunity-detail-scrolled.png"), fullPage: true });
      console.log("✓ organization-opportunity-detail-scrolled.png");
    } else {
      // No links, try clicking any opportunity card
      const oppPage = await page.evaluate(() => document.body.innerText.slice(0, 300));
      console.log("Org opportunities page text:", oppPage);
    }

    await ctx.close();
  }

  await browser.close();
  console.log("\nDone. Total:", fs.readdirSync(OUT).filter(f => f.endsWith(".png")).length, "screenshots");
}

main().catch(console.error);
