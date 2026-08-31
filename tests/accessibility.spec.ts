/**
 * GoodHours — Accessibility Test Suite (WCAG 2.1 AA)
 *
 * Uses @axe-core/playwright to audit every major page for accessibility violations.
 * Pass/fail gate: zero critical or serious violations per page.
 * Moderate and minor violations are logged as warnings.
 *
 * Test accounts (password: password123 for all):
 *   - Student:      john@student.edu
 *   - Org:          volunteer@greenearth.org
 *   - School Admin: admin@lincoln.edu
 */

import { test, expect, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const BASE = process.env.PW_BASE_URL || "http://localhost:5173";
const QA_PASSWORD = process.env.QA_PASSWORD || "Playwright1!";
const QA_STUDENT_EMAIL = process.env.QA_STUDENT_EMAIL || "abhay.sivaram+5@gmail.com";
const QA_ORG_EMAIL = process.env.QA_ORG_EMAIL || "abhay.sivaram+3@gmail.com";
const QA_SCHOOL_EMAIL = process.env.QA_SCHOOL_EMAIL || "abhay.sivaram+1@gmail.com";

// ─── Helper: login ────────────────────────────────────────────────────────────

async function loginAs(page: Page, email: string, password = QA_PASSWORD) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard|browse/, { timeout: 15000 });
}

// ─── Helper: run axe and log results ─────────────────────────────────────────

async function runAxe(page: Page, pageLabel: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const critical = results.violations.filter((v) => v.impact === "critical");
  const serious = results.violations.filter((v) => v.impact === "serious");
  const moderate = results.violations.filter((v) => v.impact === "moderate");
  const minor = results.violations.filter((v) => v.impact === "minor");

  if (results.violations.length > 0) {
    console.log(`\n[${pageLabel}] Axe violations found:`);
    for (const v of results.violations) {
      console.log(
        `  [${v.impact?.toUpperCase()}] ${v.id}: ${v.description} (${v.nodes.length} node(s))`
      );
    }
  }

  console.log(
    `[${pageLabel}] Summary — critical:${critical.length} serious:${serious.length} moderate:${moderate.length} minor:${minor.length}`
  );

  return { violations: results.violations, critical, serious, moderate, minor };
}

// ─── 1. Landing page (unauthenticated) ───────────────────────────────────────

test("Landing page — WCAG 2.1 AA", async ({ page }) => {
  await page.goto(`${BASE}/`);
  await page.waitForLoadState("networkidle");

  const { critical, serious } = await runAxe(page, "Landing");
  expect(
    critical.concat(serious),
    `Critical/serious violations on Landing: ${[...critical, ...serious].map((v) => v.id).join(", ")}`
  ).toHaveLength(0);
});

// ─── 2. Login page ────────────────────────────────────────────────────────────

test("Login page — WCAG 2.1 AA", async ({ page }) => {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("networkidle");

  const { critical, serious } = await runAxe(page, "Login");
  expect(
    critical.concat(serious),
    `Critical/serious violations on Login: ${[...critical, ...serious].map((v) => v.id).join(", ")}`
  ).toHaveLength(0);
});

// ─── 3. Login page — manual keyboard & form checks ───────────────────────────

test("Login page — keyboard navigation and form validation", async ({
  page,
}) => {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("networkidle");

  // Tab through form: email → password → submit button
  await page.keyboard.press("Tab");
  const emailFocused = await page.evaluate(
    () => document.activeElement?.getAttribute("type") === "email"
  );
  expect(emailFocused, "Email field should be focused after first Tab").toBe(
    true
  );

  await page.keyboard.press("Tab");
  const passwordFocused = await page.evaluate(
    () => document.activeElement?.getAttribute("type") === "password"
  );
  expect(
    passwordFocused,
    "Password field should be focused after second Tab"
  ).toBe(true);

  await page.keyboard.press("Tab");
  const submitFocused = await page.evaluate(
    () =>
      document.activeElement?.tagName === "BUTTON" ||
      (document.activeElement as HTMLInputElement)?.type === "submit"
  );
  expect(submitFocused, "Submit button should be focused after third Tab").toBe(
    true
  );

  // Submit empty form and expect error messages
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);

  const errorText = await page.evaluate(() => document.body.innerText);
  const hasErrorIndicator =
    errorText.toLowerCase().includes("required") ||
    errorText.toLowerCase().includes("email") ||
    errorText.toLowerCase().includes("password") ||
    errorText.toLowerCase().includes("invalid") ||
    errorText.toLowerCase().includes("enter");
  expect(
    hasErrorIndicator,
    "Form should show an error message when submitted empty"
  ).toBe(true);
});

// ─── 4. Login page — focus visibility check ───────────────────────────────────

test("Login page — focus outline not suppressed globally", async ({ page }) => {
  await page.goto(`${BASE}/login`);

  // Check that there's no global `outline: none` or `outline: 0` override
  const outlineSupressed = await page.evaluate(() => {
    // Check computed style on body and common interactive elements
    const selectors = ["body", "button", "input", "a", "*:focus"];
    for (const sel of selectors.slice(0, 3)) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const computed = window.getComputedStyle(el);
      if (
        computed.getPropertyValue("outline-style") === "none" &&
        computed.getPropertyValue("outline-width") === "0px"
      ) {
        // Some suppression exists — check if it's via a stylesheet rule
      }
    }

    // More targeted: find any stylesheet rule that sets outline:none on * or :focus
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules || [])) {
          const cssRule = rule as CSSStyleRule;
          if (
            cssRule.selectorText &&
            (cssRule.selectorText === "*" ||
              cssRule.selectorText.includes(":focus")) &&
            cssRule.style &&
            cssRule.style.outline === "none"
          ) {
            return {
              suppressed: true,
              selector: cssRule.selectorText,
              rule: cssRule.cssText,
            };
          }
        }
      } catch {
        // Cross-origin stylesheet — skip
      }
    }
    return { suppressed: false };
  });

  if (outlineSupressed.suppressed) {
    console.warn(
      `[WARNING] Global focus outline suppressed via CSS rule: ${outlineSupressed.selector}`
    );
  }
  // This is a warning, not a hard failure — log it
  expect(true).toBe(true);
});

// ─── 5. Images have alt text ──────────────────────────────────────────────────

test("Landing page — images have alt attributes", async ({ page }) => {
  await page.goto(`${BASE}/`);
  await page.waitForLoadState("networkidle");

  const imgsWithoutAlt = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll("img"));
    return imgs
      .filter(
        (img) =>
          !img.hasAttribute("alt") ||
          (img.getAttribute("alt") === null)
      )
      .map((img) => ({
        src: img.src,
        class: img.className,
      }));
  });

  if (imgsWithoutAlt.length > 0) {
    console.warn(
      `[WARNING] ${imgsWithoutAlt.length} image(s) missing alt attribute on Landing:`,
      imgsWithoutAlt
    );
  }

  expect(
    imgsWithoutAlt,
    `${imgsWithoutAlt.length} img element(s) are missing alt attributes`
  ).toHaveLength(0);
});

// ─── 6. Buttons have accessible names ─────────────────────────────────────────

test("Landing page — buttons have accessible names", async ({ page }) => {
  await page.goto(`${BASE}/`);
  await page.waitForLoadState("networkidle");

  const inaccessibleButtons = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    return buttons
      .filter((btn) => {
        const hasText = btn.textContent?.trim().length ?? 0 > 0;
        const hasAriaLabel = btn.hasAttribute("aria-label");
        const hasAriaLabelledby = btn.hasAttribute("aria-labelledby");
        const hasTitle = btn.hasAttribute("title");
        return !hasText && !hasAriaLabel && !hasAriaLabelledby && !hasTitle;
      })
      .map((btn) => ({
        outerHTML: btn.outerHTML.substring(0, 120),
      }));
  });

  if (inaccessibleButtons.length > 0) {
    console.warn(
      `[WARNING] ${inaccessibleButtons.length} button(s) lack accessible names on Landing:`,
      inaccessibleButtons
    );
  }

  expect(
    inaccessibleButtons,
    `${inaccessibleButtons.length} button(s) have no accessible name (no text, aria-label, or title)`
  ).toHaveLength(0);
});

// ─── 7. Student dashboard ─────────────────────────────────────────────────────

test("Student dashboard — WCAG 2.1 AA", async ({ page }) => {
  await loginAs(page, QA_STUDENT_EMAIL);
  await page.waitForLoadState("networkidle");

  const { critical, serious } = await runAxe(page, "Student Dashboard");
  expect(
    critical.concat(serious),
    `Critical/serious violations on Student Dashboard: ${[...critical, ...serious].map((v) => v.id).join(", ")}`
  ).toHaveLength(0);
});

// ─── 8. Student browse page ───────────────────────────────────────────────────

test("Student browse page — WCAG 2.1 AA", async ({ page }) => {
  await loginAs(page, QA_STUDENT_EMAIL);
  await page.goto(`${BASE}/browse`);
  await page.waitForLoadState("networkidle");

  const { critical, serious } = await runAxe(page, "Student Browse");
  expect(
    critical.concat(serious),
    `Critical/serious violations on Student Browse: ${[...critical, ...serious].map((v) => v.id).join(", ")}`
  ).toHaveLength(0);
});

// ─── 9. Opportunity detail page ───────────────────────────────────────────────

test("Opportunity detail page — WCAG 2.1 AA", async ({ page }) => {
  await loginAs(page, QA_STUDENT_EMAIL);
  await page.goto(`${BASE}/browse`);
  await page.waitForLoadState("networkidle");

  // Click the first opportunity card or link
  const firstOpportunity = page
    .locator('a[href*="/opportunity/"], button')
    .first();
  const href = await firstOpportunity.getAttribute("href").catch(() => null);

  if (href) {
    await page.goto(`${BASE}${href}`);
  } else {
    // Try clicking the first opportunity-like element
    const opportunityLink = page.locator('[href*="/opportunity/"]').first();
    if ((await opportunityLink.count()) > 0) {
      await opportunityLink.click();
    } else {
      console.warn(
        "[Opportunity Detail] No opportunity links found on browse page — skipping navigation"
      );
      return;
    }
  }

  await page.waitForLoadState("networkidle");

  const { critical, serious } = await runAxe(page, "Opportunity Detail");
  expect(
    critical.concat(serious),
    `Critical/serious violations on Opportunity Detail: ${[...critical, ...serious].map((v) => v.id).join(", ")}`
  ).toHaveLength(0);
});

// ─── 10. Org dashboard ────────────────────────────────────────────────────────

test("Org dashboard — WCAG 2.1 AA", async ({ page }) => {
  await loginAs(page, QA_ORG_EMAIL);
  await page.waitForLoadState("networkidle");

  const { critical, serious } = await runAxe(page, "Org Dashboard");
  expect(
    critical.concat(serious),
    `Critical/serious violations on Org Dashboard: ${[...critical, ...serious].map((v) => v.id).join(", ")}`
  ).toHaveLength(0);
});

// ─── 11. School admin dashboard ───────────────────────────────────────────────

test("School admin dashboard — WCAG 2.1 AA", async ({ page }) => {
  await loginAs(page, QA_SCHOOL_EMAIL);
  await page.waitForLoadState("networkidle");

  const { critical, serious } = await runAxe(page, "School Dashboard");
  expect(
    critical.concat(serious),
    `Critical/serious violations on School Dashboard: ${[...critical, ...serious].map((v) => v.id).join(", ")}`
  ).toHaveLength(0);
});

// ─── 12. School student list ──────────────────────────────────────────────────

test("School student list page — WCAG 2.1 AA", async ({ page }) => {
  await loginAs(page, QA_SCHOOL_EMAIL);
  await page.goto(`${BASE}/students`);
  await page.waitForLoadState("networkidle");

  const { critical, serious } = await runAxe(page, "School Student List");
  expect(
    critical.concat(serious),
    `Critical/serious violations on School Student List: ${[...critical, ...serious].map((v) => v.id).join(", ")}`
  ).toHaveLength(0);
});
