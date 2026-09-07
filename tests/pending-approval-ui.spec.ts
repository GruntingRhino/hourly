import { test, expect, type Page, type Request } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

/**
 * Real-browser verification of the pending school-approval screen.
 *
 * Runs against a production client build served on PW_BASE_URL with /api
 * proxied to a locally booted API on the disposable test database. The fixture
 * (a pending SCHOOL_ADMIN and its session token) is created by
 * server/tests/_seedPendingAdmin.ts and read from a local temp file; the token
 * is never printed.
 */

const FIXTURE = "/tmp/goodhours-qa-pending-admin.json";
const SERVER_DIR = path.resolve(__dirname, "../server");

// The resend control's accessible name changes with its state
// ("Send approval email" / "Sending…" / "Email sent — resend in 15 minutes"),
// so every lookup for it has to match all three rather than the idle label.
const RESEND = /send approval email|sending|resend in 15 minutes/i;
const CHECK = /check approval status|checking/i;

function fixture() {
  return JSON.parse(fs.readFileSync(FIXTURE, "utf8")) as { email: string; password: string };
}

/** Real login through the form, so the session is the real HttpOnly cookie. */
async function signIn(page: Page) {
  const { email, password } = fixture();
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/auth/login")),
    page.getByRole("button", { name: /sign in|log in/i }).click(),
  ]);
  await expect(page.getByRole("heading", { name: /awaiting approval/i })).toBeVisible({ timeout: 30000 });
}

/**
 * The 15-minute resend cooldown lives in the database, so it survives between
 * tests. Clear it before each test that needs a fresh window; this runs the
 * same fixture helper that created the account, against the disposable test
 * database only.
 */
test.beforeEach(() => {
  execFileSync(
    process.execPath,
    ["--env-file-if-exists=.env.test", "--import", "tsx", "tests/_seedPendingAdmin.ts", "--reset-cooldown"],
    { cwd: SERVER_DIR, stdio: "ignore" },
  );
});

function countResends(page: Page) {
  const calls: Request[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/auth/ownership-approval/resend") && r.method() === "POST") calls.push(r);
  });
  return calls;
}

test("the pending screen renders real buttons with accessible roles", async ({ page }) => {
  await signIn(page);
  for (const name of [RESEND, CHECK, /sign out/i]) {
    const button = page.getByRole("button", { name });
    await expect(button).toBeVisible();
    await expect(button).toHaveJSProperty("tagName", "BUTTON");
    await expect(button).toHaveAttribute("type", "button");
    await expect(button).toHaveCSS("cursor", "pointer");
  }
});

test("clicking send issues exactly one request and reports the result inline", async ({ page }) => {
  const calls = countResends(page);
  await signIn(page);

  const send = page.getByRole("button", { name: RESEND });
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/ownership-approval/resend")),
    send.click(),
  ]);
  expect(response.status()).toBe(200);
  const body = await response.json();
  // Local API => the development bypass branch; delivery must be reported honestly.
  expect(body.delivery).toBe("bypass");

  await expect(page.getByText(/approval email was not sent|resent to the goodhours business owner/i)).toBeVisible();
  await expect(send).toBeDisabled();
  await expect(send).toHaveText(/resend in 15 minutes/i);
  expect(calls.length).toBe(1);

  // A disabled control must not fire another request when clicked again.
  await send.click({ force: true }).catch(() => {});
  await page.waitForTimeout(500);
  expect(calls.length).toBe(1);
});

test("a 429 from the server drives the local cooldown", async ({ page }) => {
  await signIn(page);
  const send = page.getByRole("button", { name: RESEND });

  // First click consumes the server-side 15-minute window.
  await Promise.all([page.waitForResponse((r) => r.url().includes("/ownership-approval/resend")), send.click()]);
  await expect(send).toBeDisabled();

  // Reload clears local state; the server must still refuse and the UI must
  // adopt the server's remaining cooldown rather than re-enabling the button.
  await page.reload();
  await expect(page.getByRole("heading", { name: /awaiting approval/i })).toBeVisible();
  const sendAgain = page.getByRole("button", { name: RESEND });
  await expect(sendAgain).toBeEnabled();
  const [throttled] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/ownership-approval/resend")),
    sendAgain.click(),
  ]);
  expect(throttled.status()).toBe(429);
  const body = await throttled.json();
  expect(body.retryAfterSeconds).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: /resend in 15 minutes/i })).toBeDisabled();
});

test("check approval status refetches server state and shows a busy state", async ({ page }) => {
  await signIn(page);
  const check = page.getByRole("button", { name: CHECK });
  const [meResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/auth/me")),
    check.click(),
  ]);
  expect(meResponse.status()).toBe(200);
  const me = await meResponse.json();
  expect(me.school.ownershipStatus).toBe("PENDING");
  expect(me.requiresEligibilityAttestation).toBe(false);
  await expect(page.getByText(/approval status refreshed/i)).toBeVisible();
  // Still pending => still on the pending screen after the refresh.
  await expect(page.getByRole("heading", { name: /awaiting approval/i })).toBeVisible();
});

test("the pending screen stays pending across a reload", async ({ page }) => {
  await signIn(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: /awaiting approval/i })).toBeVisible();
  await expect(page.getByRole("button", { name: RESEND })).toBeVisible();
});

for (const width of [320, 375]) {
  test(`controls stay reachable and untruncated at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 720 });
    await signIn(page);
    for (const name of [RESEND, CHECK, /sign out/i]) {
      const button = page.getByRole("button", { name });
      await expect(button).toBeVisible();
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThan(0);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
      // Comfortably above the 24px minimum target size (WCAG 2.2 AA).
      expect(box!.height).toBeGreaterThanOrEqual(24);
    }
    // No horizontal overflow of the page itself.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("every control is keyboard reachable, focus-visible, and activates with Enter and Space", async ({ page }) => {
  const calls = countResends(page);
  await signIn(page);

  const order: string[] = [];
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press("Tab");
    const label = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return el && el.tagName === "BUTTON" ? (el.textContent || "").trim() : null;
    });
    if (label && !order.includes(label)) order.push(label);
    if (order.length === 3) break;
  }
  expect(order.length).toBe(3);

  // Focus ring is actually rendered (outline or ring shadow), not just cursor styling.
  await page.getByRole("button", { name: CHECK }).focus();
  const focusStyles = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const s = getComputedStyle(el);
    return { outlineWidth: s.outlineWidth, outlineStyle: s.outlineStyle, boxShadow: s.boxShadow };
  });
  const hasVisibleFocus =
    (focusStyles.outlineStyle !== "none" && parseFloat(focusStyles.outlineWidth) > 0) ||
    (focusStyles.boxShadow !== "none" && focusStyles.boxShadow !== "");
  expect(hasVisibleFocus, `no visible focus indicator: ${JSON.stringify(focusStyles)}`).toBe(true);

  // Enter activates the focused send button exactly once.
  await page.getByRole("button", { name: RESEND }).focus();
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/ownership-approval/resend")),
    page.keyboard.press("Enter"),
  ]);
  expect(calls.length).toBe(1);

  // Space on the (now enabled) check button also works.
  await page.reload();
  await page.getByRole("button", { name: CHECK }).focus();
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/auth/me")),
    page.keyboard.press("Space"),
  ]);
});

test("aria-busy is set while a request is in flight", async ({ page }) => {
  await signIn(page);
  await page.route("**/ownership-approval/resend", async (route) => {
    await new Promise((r) => setTimeout(r, 1200));
    await route.continue();
  });
  const send = page.getByRole("button", { name: RESEND });
  await send.click();
  await expect(send).toHaveAttribute("aria-busy", "true");
  await expect(send).toBeDisabled();
  await expect(page.getByRole("button", { name: /resend in 15 minutes/i })).toHaveAttribute("aria-busy", "false", { timeout: 15000 });
});

function setSchoolStatus(status: "PENDING" | "APPROVED") {
  execFileSync(
    process.execPath,
    ["--env-file-if-exists=.env.test", "--import", "tsx", "tests/_seedPendingAdmin.ts", "--set-status", status],
    { cwd: SERVER_DIR, stdio: "ignore" },
  );
}

test("once the owner approves, Check approval status routes off the pending screen and it stays off after a reload", async ({ page }) => {
  await signIn(page);
  try {
    setSchoolStatus("APPROVED");
    const [me] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/auth/me")),
      page.getByRole("button", { name: CHECK }).click(),
    ]);
    expect((await me.json()).school.ownershipStatus).toBe("APPROVED");
    await expect(page.getByRole("heading", { name: /awaiting approval/i })).toBeHidden({ timeout: 15000 });

    // The cached auth state was updated, so a reload must not bounce back.
    await page.reload();
    await expect(page.getByRole("heading", { name: /awaiting approval/i })).toBeHidden({ timeout: 15000 });
  } finally {
    setSchoolStatus("PENDING");
  }
});

test("sign out clears the session and returns to the public site", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page.getByRole("heading", { name: /awaiting approval/i })).toBeHidden();
  const cached = await page.evaluate(() => window.localStorage.getItem("goodhours_user"));
  expect(cached).toBeNull();
});
