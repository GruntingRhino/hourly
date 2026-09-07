/**
 * Sign-in in a real browser.
 *
 * `tests/security/09-signin.spec.ts` proves the API contract. This file proves
 * the thing a person actually does: type into the real Login page of a
 * PRODUCTION client build (`vite build`, not the dev server), press the button,
 * and end up signed in. The session it gets is the real HttpOnly cookie.
 *
 * Requires:
 *   PW_BASE_URL   built client, with /api proxied to the QA API
 *   API_BASE_URL  the same QA API, for direct assertions
 *
 * Google: this drives the "Continue with Google" button and asserts where it
 * sends the browser. It stops at accounts.google.com. It does NOT sign in to
 * Google — that needs a real account, password and consent, which is out of
 * scope for an automated run.
 */
import { test, expect, Page } from "@playwright/test";

const API = process.env.API_BASE_URL ?? "http://127.0.0.1:3211";
const PW = "Playwright1!";
const STUDENT = "abhay.sivaram+5@gmail.com";
const SCHOOL_ADMIN = "abhay.sivaram+1@gmail.com";

async function fillLogin(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
}

const submit = (page: Page) => page.getByRole("button", { name: "Sign In", exact: true });

test("BR-01: a student signs in through the real form and lands in the app", async ({ page }) => {
  await fillLogin(page, STUDENT, PW);

  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/auth/login") && r.request().method() === "POST"),
    submit(page).click(),
  ]);

  expect(response.status()).toBe(200);
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
  expect(new URL(page.url()).pathname).not.toBe("/login");
});

test("BR-02: the browser holds a real HttpOnly session cookie afterwards", async ({ page, context }) => {
  await fillLogin(page, STUDENT, PW);
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/auth/login")),
    submit(page).click(),
  ]);
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });

  const cookies = await context.cookies();
  const session = cookies.find((c) => c.httpOnly);
  expect(session, `no HttpOnly cookie; saw ${cookies.map((c) => c.name).join(",")}`).toBeTruthy();
  expect(session!.value.length).toBeGreaterThan(20);
});

test("BR-03: the session survives a full page reload", async ({ page }) => {
  await fillLogin(page, STUDENT, PW);
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/auth/login")),
    submit(page).click(),
  ]);
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
  const afterLogin = new URL(page.url()).pathname;

  await page.reload({ waitUntil: "networkidle" });
  expect(new URL(page.url()).pathname).toBe(afterLogin);
  // Still authenticated, from the browser's own cookie jar.
  const me = await page.request.get(`${API}/api/auth/me`);
  expect(me.status()).toBe(200);
});

test("BR-04: a wrong password shows an error and does not navigate away", async ({ page }) => {
  await fillLogin(page, STUDENT, "this-is-not-the-password");

  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/auth/login")),
    submit(page).click(),
  ]);
  expect(response.status()).toBe(401);

  await expect(page.getByText(/invalid email or password/i)).toBeVisible({ timeout: 10_000 });
  expect(new URL(page.url()).pathname).toBe("/login");
});

test("BR-05: the error message never reveals whether the account exists", async ({ page }) => {
  await fillLogin(page, STUDENT, "wrong-password-for-a-real-account");
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/auth/login")),
    submit(page).click(),
  ]);
  const realAccountError = (await page.getByText(/invalid email or password/i).textContent())?.trim();

  await fillLogin(page, "nobody-at-all-3f81@example.invalid", "wrong-password-for-a-real-account");
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/auth/login")),
    submit(page).click(),
  ]);
  const unknownAccountError = (await page.getByText(/invalid email or password/i).textContent())?.trim();

  expect(unknownAccountError).toBe(realAccountError);
});

test("BR-06: the password is masked by default and only revealed on request", async ({ page }) => {
  await fillLogin(page, STUDENT, PW);
  const field = page.locator("#login-password");
  await expect(field).toHaveAttribute("type", "password");

  await page.getByRole("button", { name: /show password/i }).click();
  await expect(field).toHaveAttribute("type", "text");

  await page.getByRole("button", { name: /hide password/i }).click();
  await expect(field).toHaveAttribute("type", "password");
});

test("BR-07: the form is operable by keyboard alone", async ({ page }) => {
  await page.goto("/login");

  const focused = () => page.evaluate(() => {
    const a = document.activeElement as HTMLElement;
    return a.id || a.getAttribute("aria-label") || (a.textContent || "").trim();
  });

  await page.locator("#login-email").focus();
  await page.keyboard.type(STUDENT);

  // The "Forgot password?" link sits between the two fields in DOM order, so
  // reaching the password field takes two tabs. Asserting the whole order keeps
  // this honest: a regression that strands a control is a real accessibility bug.
  await page.keyboard.press("Tab");
  expect(await focused()).toBe("Forgot password?");
  await page.keyboard.press("Tab");
  expect(await focused()).toBe("login-password");

  await page.keyboard.type(PW);
  await page.keyboard.press("Tab");
  expect(await focused()).toBe("Show password");
  await page.keyboard.press("Tab");
  expect(await focused()).toBe("Sign In");

  // Enter on the focused submit button — no mouse involved anywhere.
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/auth/login")),
    page.keyboard.press("Enter"),
  ]);
  expect(response.status()).toBe(200);
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
});

test("BR-08: a school admin signs in and is not shown the student age screen", async ({ page }) => {
  await fillLogin(page, SCHOOL_ADMIN, PW);
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/auth/login")),
    submit(page).click(),
  ]);
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });

  // The 13+ attestation is students-only.
  expect(new URL(page.url()).pathname).not.toContain("eligibility");
  await expect(page.getByText(/13 or older|age eligibility/i)).toHaveCount(0);
});

test("BR-09: signing out clears the session", async ({ page, context }) => {
  await fillLogin(page, STUDENT, PW);
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/auth/login")),
    submit(page).click(),
  ]);
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });

  await context.clearCookies();
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const me = await page.request.get(`${API}/api/auth/me`);
  expect(me.status()).toBe(401);
});

test("BR-10: 'Continue with Google' sends the browser to a correct Google consent URL", async ({ page }) => {
  await page.goto("/login");

  const googleButton = page.getByRole("button", { name: /continue with google/i });
  await expect(googleButton).toBeVisible();
  await expect(googleButton).toBeEnabled({ timeout: 15_000 });

  // Stop at Google's door: assert the destination, do not load it. Loading
  // accounts.google.com would put a real consent screen in front of an
  // automated agent, which this run must never drive.
  let destination = "";
  await page.route("https://accounts.google.com/**", async (route) => {
    destination = route.request().url();
    await route.abort();
  });
  await googleButton.click();
  await page.waitForTimeout(2000);

  expect(destination, "the Google button did not navigate to accounts.google.com").toBeTruthy();
  const url = new URL(destination);
  expect(url.pathname).toBe("/o/oauth2/v2/auth");
  expect(url.searchParams.get("response_type")).toBe("code");
  expect(url.searchParams.get("client_id")).toBeTruthy();
  expect(url.searchParams.get("scope")!.split(" ").sort()).toEqual(["email", "openid", "profile"]);
  // Bound to this browser via the state nonce (see GO-02).
  expect(url.searchParams.get("state")).toMatch(/^login\.[0-9a-f]{32}$/);
});

test("BR-11: the login page has no horizontal overflow at 320px and 375px", async ({ page }) => {
  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 720 });
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(1);
    await expect(page.locator("#login-email")).toBeVisible();
    await expect(page.locator("#login-password")).toBeVisible();
    await expect(submit(page)).toBeVisible();
  }
});
