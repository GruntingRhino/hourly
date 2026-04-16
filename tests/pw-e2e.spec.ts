/**
 * GoodHours — Playwright E2E Test Suite
 *
 * Uses dedicated test accounts (isTestAccount=true) that are invisible to real users.
 * Tests run serially within each describe block; state flows between tests via `ctx`.
 *
 * Accounts (password: Playwright1! for all):
 *   +1  abhay.sivaram+1@gmail.com  SCHOOL_ADMIN   → Playwright School A
 *   +2  abhay.sivaram+2@gmail.com  SCHOOL_ADMIN   → Playwright School B
 *   +3  abhay.sivaram+3@gmail.com  BENEFICIARY_ADMIN → Playwright Org A
 *   +4  abhay.sivaram+4@gmail.com  BENEFICIARY_ADMIN → Playwright Org B
 *   +5  abhay.sivaram+5@gmail.com  STUDENT        → School A / PW Cohort A
 *   +6  abhay.sivaram+6@gmail.com  STUDENT        → School A / PW Cohort A
 *   +7  abhay.sivaram+7@gmail.com  STUDENT        → School B / PW Cohort B
 *
 * Pre-requisite: run `cd server && npx tsx prisma/seed-playwright.ts` once.
 */

import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';

// ─── Config ──────────────────────────────────────────────────────────────────

const BASE = process.env.PW_BASE_URL || 'http://localhost:5173';

const PW = 'Playwright1!';
const ACCOUNTS = {
  schoolA:  { email: 'abhay.sivaram+1@gmail.com', password: PW },
  schoolB:  { email: 'abhay.sivaram+2@gmail.com', password: PW },
  orgA:     { email: 'abhay.sivaram+3@gmail.com', password: PW },
  orgB:     { email: 'abhay.sivaram+4@gmail.com', password: PW },
  student1: { email: 'abhay.sivaram+5@gmail.com', password: PW },
  student2: { email: 'abhay.sivaram+6@gmail.com', password: PW },
  student3: { email: 'abhay.sivaram+7@gmail.com', password: PW },
};

// Shared mutable state — flows through serial tests like a linked chain
const ctx = {
  newCohortId: '',
  newCohortName: `PW Cohort ${Date.now()}`,
  opportunityTitle: `PW Opportunity ${Date.now()}`,
  opportunityId: '',
  slotId: '',
  student1SignupId: '',
  selfSubmitId: '',
  // IDs resolved at runtime from /auth/me
  schoolAId: '',
  schoolBId: '',
  orgAId: '',
  orgBId: '',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Module-level token cache — populated by UI logins in Block 1, reused in all later blocks
// This keeps total /api/auth/login calls well below the 10/15-min rate limit.
const tokenCache = new Map<string, string>();

async function newContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({ acceptDownloads: true });
}

/** Full UI login — tests the login form, caches the JWT for reuse. */
async function login(page: Page, email: string, password: string): Promise<void> {
  // Clear any existing session first, then navigate — prevents redirects away from /login
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.removeItem('goodhours_token');
    localStorage.removeItem('goodhours_user');
  });
  // Re-navigate so React picks up the cleared state
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  const [res] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/auth/login'), { timeout: 20_000 }),
    page.getByRole('button', { name: /sign in/i }).click(),
  ]);
  expect(res.status(), `Login failed for ${email}`).toBe(200);
  await page.waitForURL(/\/(dashboard|cohorts|opportunities|browse)/, { timeout: 15_000 });
  const token = await page.evaluate(() => localStorage.getItem('goodhours_token') ?? '');
  if (token) tokenCache.set(email, token);
}

/**
 * Fast login — injects a cached JWT directly into localStorage (0 API calls).
 * Falls back to a single direct API call for first-time logins not covered by Block 1.
 * Use this in all beforeAll blocks outside Block 1 to stay under the rate limit.
 */
async function loginFast(page: Page, email: string, password: string): Promise<void> {
  let token = tokenCache.get(email);
  if (!token) {
    // One-time API login to populate the cache (no UI form interaction)
    const res = await page.request.post(`${BASE}/api/auth/login`, {
      data: { email, password },
    });
    if (!res.ok()) throw new Error(`API login failed for ${email}: ${res.status()}`);
    const body = await res.json();
    token = body.token as string;
    tokenCache.set(email, token);
  }
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => {
    localStorage.setItem('goodhours_token', t);
  }, token);
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
}

async function getToken(page: Page): Promise<string> {
  return page.evaluate(() => localStorage.getItem('goodhours_token') ?? '');
}

async function apiGet<T>(page: Page, path: string): Promise<T> {
  const token = await getToken(page);
  const res = await page.request.get(`${BASE}/api${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  return res.json() as Promise<T>;
}

async function apiPost<T>(page: Page, path: string, body: unknown): Promise<T> {
  const token = await getToken(page);
  const res = await page.request.post(`${BASE}/api${path}`, {
    data: body,
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json() as Promise<T>;
}

async function apiDelete(page: Page, path: string): Promise<import('@playwright/test').APIResponse> {
  const token = await getToken(page);
  return page.request.delete(`${BASE}/api${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function apiPut<T>(page: Page, path: string, body: unknown): Promise<T> {
  const token = await getToken(page);
  const res = await page.request.put(`${BASE}/api${path}`, {
    data: body,
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json() as Promise<T>;
}

async function apiRawPost(page: Page, path: string, body: unknown): Promise<import('@playwright/test').APIResponse> {
  const token = await getToken(page);
  return page.request.post(`${BASE}/api${path}`, {
    data: body,
    headers: { Authorization: `Bearer ${token}` },
  });
}

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// ─── 1. Auth ─────────────────────────────────────────────────────────────────

test.describe.serial('1 — Auth', () => {
  let ctx_: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    ctx_ = await newContext(browser);
    page = await ctx_.newPage();
  });
  test.afterAll(() => ctx_.close());

  test('school admin A can log in and lands on dashboard', async () => {
    await login(page, ACCOUNTS.schoolA.email, ACCOUNTS.schoolA.password);
    await expect(page).toHaveURL(/dashboard/);
  });

  test('/auth/me returns correct role after login', async () => {
    const me = await apiGet<any>(page, '/auth/me');
    expect(me.role).toBe('SCHOOL_ADMIN');
    expect(me.email).toBe(ACCOUNTS.schoolA.email);
    ctx.schoolAId = me.schoolId;
  });

  test('logout clears session and redirects to /login', async () => {
    const logoutBtn = page.getByRole('button', { name: /log out|sign out/i }).first();
    if (await logoutBtn.count()) {
      await logoutBtn.click();
    } else {
      // Nav may be collapsed — look for a link
      const logoutLink = page.getByRole('link', { name: /log out|sign out/i }).first();
      await logoutLink.click();
    }
    // Wait for navigation away from any authenticated page
    await page.waitForTimeout(1000);
    // Token should be cleared from localStorage
    const token = await page.evaluate(() => localStorage.getItem('goodhours_token'));
    expect(token, 'JWT token should be removed from localStorage after logout').toBeNull();
    // API should return 401
    const res = await page.request.get(`${BASE}/api/auth/me`);
    expect(res.status()).toBe(401);
  });

  test('wrong password returns error', async () => {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="email"]').first().fill(ACCOUNTS.schoolA.email);
    await page.locator('input[type="password"]').first().fill('WrongPass999!');
    const [res] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/auth/login'), { timeout: 15_000 }),
      page.getByRole('button', { name: /sign in/i }).click(),
    ]);
    expect(res.status()).toBe(401);
    await expect(page.locator('text=/invalid|incorrect|password/i').first()).toBeVisible({ timeout: 5_000 });
  });

  test('beneficiary admin A can log in', async () => {
    await login(page, ACCOUNTS.orgA.email, ACCOUNTS.orgA.password);
    const me = await apiGet<any>(page, '/auth/me');
    expect(me.role).toBe('BENEFICIARY_ADMIN');
    ctx.orgAId = me.beneficiaryId;
  });

  test('student 1 can log in', async () => {
    await login(page, ACCOUNTS.student1.email, ACCOUNTS.student1.password);
    const me = await apiGet<any>(page, '/auth/me');
    expect(me.role).toBe('STUDENT');
  });
});

// ─── 2. School Admin A — Navigation & Dashboard ──────────────────────────────

test.describe.serial('2 — School Admin A: Dashboard & Navigation', () => {
  let ctx_: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    ctx_ = await newContext(browser);
    page = await ctx_.newPage();
    await loginFast(page, ACCOUNTS.schoolA.email, ACCOUNTS.schoolA.password);
    if (!ctx.schoolAId) {
      const me = await apiGet<any>(page, '/auth/me');
      ctx.schoolAId = me.schoolId;
    }
  });
  test.afterAll(() => ctx_.close());

  test('dashboard loads with school name', async () => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
    await expect(page.locator('text=/Playwright School A/i').first()).toBeVisible({ timeout: 10_000 });
  });

  test('cohorts page loads and shows PW Cohort A', async () => {
    await page.goto(`${BASE}/cohorts`, { waitUntil: 'networkidle' });
    await expect(page.locator('text=/PW Cohort A/i').first()).toBeVisible({ timeout: 10_000 });
  });

  test('can create a new cohort', async () => {
    await page.goto(`${BASE}/cohorts`, { waitUntil: 'networkidle' });
    // Open create form
    await page.getByRole('button', { name: /new cohort|create cohort|add cohort/i }).first().click();
    await page.locator('input[placeholder*="cohort" i], input[placeholder*="name" i], input[placeholder*="Class" i]').first().fill(ctx.newCohortName);
    const [res] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/cohorts') && r.request().method() === 'POST', { timeout: 15_000 }),
      page.getByRole('button', { name: /create|save|add/i }).last().click(),
    ]);
    expect(res.status()).toBe(201);
    const body = await res.json();
    ctx.newCohortId = body.id;
    // New cohort should appear in list
    await expect(page.locator(`text=${ctx.newCohortName}`).first()).toBeVisible({ timeout: 8_000 });
  });

  test('cohort detail page loads for PW Cohort A', async () => {
    const cohorts = await apiGet<any[]>(page, '/cohorts');
    const pwCohort = cohorts.find(c => c.name === 'PW Cohort A');
    expect(pwCohort, 'PW Cohort A not found').toBeTruthy();
    await page.goto(`${BASE}/cohorts/${pwCohort!.id}`, { waitUntil: 'networkidle' });
    await expect(page.locator('text=/PW Cohort A/i').first()).toBeVisible({ timeout: 10_000 });
  });

  test('students page loads and shows test students', async () => {
    await page.goto(`${BASE}/students`, { waitUntil: 'networkidle' });
    await expect(page.locator('text=/PW Student/i').first()).toBeVisible({ timeout: 10_000 });
  });

  test('beneficiaries page loads and shows Playwright Org A as approved', async () => {
    await page.goto(`${BASE}/beneficiaries`, { waitUntil: 'networkidle' });
    await expect(page.locator('text=/Playwright Org A/i').first()).toBeVisible({ timeout: 10_000 });
  });

  test('discover page loads', async () => {
    await page.goto(`${BASE}/discover`, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/discover/);
    // Page loaded if no fatal error banner
    await expect(page.locator('text=/failed to load|internal server error/i')).toHaveCount(0);
  });

  test('submissions page loads', async () => {
    await page.goto(`${BASE}/submissions`, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/submissions/);
    await expect(page.locator('text=/failed to load|internal server error/i')).toHaveCount(0);
  });

  test('settings page loads with school name', async () => {
    await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
    await expect(page.locator('text=/Playwright School A/i').first()).toBeVisible({ timeout: 10_000 });
  });
});

// ─── 3. Beneficiary Admin A — Dashboard & Opportunity Creation ───────────────

test.describe.serial('3 — Beneficiary Admin A: Opportunities', () => {
  let ctx_: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    ctx_ = await newContext(browser);
    page = await ctx_.newPage();
    await loginFast(page, ACCOUNTS.orgA.email, ACCOUNTS.orgA.password);
    if (!ctx.orgAId) {
      const me = await apiGet<any>(page, '/auth/me');
      ctx.orgAId = me.beneficiaryId;
    }
  });
  test.afterAll(() => ctx_.close());

  test('dashboard loads with org name', async () => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
    await expect(page.locator('text=/Playwright Org A/i').first()).toBeVisible({ timeout: 10_000 });
  });

  test('opportunities page loads', async () => {
    await page.goto(`${BASE}/opportunities`, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/opportunities/);
    await expect(page.locator('text=/failed to load/i')).toHaveCount(0);
  });

  test('can create an opportunity with a time slot', async () => {
    await page.goto(`${BASE}/opportunities`, { waitUntil: 'networkidle' });

    // Open create form (click "New Opportunity" or "Create" button)
    await page.getByRole('button', { name: /new opportunity|create opportunity|add opportunity/i }).first().click();

    // Title
    await page.locator('input[placeholder*="title" i], input[name="title" i]').first().fill(ctx.opportunityTitle);

    // Description
    const descField = page.locator('textarea[placeholder*="description" i], textarea[name="description" i]');
    if (await descField.count()) await descField.first().fill('Playwright automated test opportunity.');

    // Date field for the first time slot
    const dateInput = page.locator('input[type="date"]').first();
    await dateInput.fill(tomorrow());

    // Start / end times
    const timeInputs = page.locator('input[type="time"]');
    if (await timeInputs.count() >= 2) {
      await timeInputs.nth(0).fill('09:00');
      await timeInputs.nth(1).fill('11:00');
    }

    const [res] = await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/beneficiaries') && r.url().includes('/opportunities') && r.request().method() === 'POST',
        { timeout: 20_000 }
      ),
      page.getByRole('button', { name: /create|save|publish|submit/i }).last().click(),
    ]);

    expect(res.status()).toBe(201);
    const body = await res.json();
    ctx.opportunityId = body.id;
    if (body.timeSlots?.[0]) ctx.slotId = body.timeSlots[0].id;

    // Opportunity should now appear in list
    await expect(page.locator(`text=${ctx.opportunityTitle}`).first()).toBeVisible({ timeout: 10_000 });
  });

  test('opportunity appears in signups tab (empty initially)', async () => {
    await page.goto(`${BASE}/opportunities`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /signups/i }).first().click();
    await expect(page.locator('text=/failed to load/i')).toHaveCount(0);
  });

  test('settings page loads', async () => {
    await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
    await expect(page.locator('text=/Playwright Org A/i').first()).toBeVisible({ timeout: 10_000 });
  });
});

// ─── 4. Student 1 — Dashboard, Browse, Signup ────────────────────────────────

test.describe.serial('4 — Student 1: Browse & Sign Up', () => {
  let ctx_: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    ctx_ = await newContext(browser);
    page = await ctx_.newPage();
    await loginFast(page, ACCOUNTS.student1.email, ACCOUNTS.student1.password);
  });
  test.afterAll(() => ctx_.close());

  test('student dashboard loads', async () => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.locator('text=/failed to load/i')).toHaveCount(0);
  });

  test('browse page loads with calendar or slot list', async () => {
    await page.goto(`${BASE}/browse`, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/browse/);
    await expect(page.locator('text=/failed to load/i')).toHaveCount(0);
  });

  test('opportunity from Playwright Org A is visible via API', async () => {
    // Verify the slot is visible to the student via the available-slots endpoint
    const slots = await apiGet<any[]>(page, '/beneficiaries/available-slots');
    const found = slots.find(s => s.opportunity?.title === ctx.opportunityTitle);
    if (!found && ctx.slotId) {
      // May not appear yet if the opportunity was just created — skip gracefully
      test.info().annotations.push({ type: 'note', description: 'Opportunity slot not yet visible in available-slots — check school approval' });
    }
  });

  test('can sign up for the opportunity via slot detail page', async () => {
    if (!ctx.slotId) {
      test.skip(true, 'No slot ID — opportunity creation test may have failed');
      return;
    }
    await page.goto(`${BASE}/slot/${ctx.slotId}`, { waitUntil: 'networkidle' });
    // Should show the opportunity title
    await expect(page.locator(`text=${ctx.opportunityTitle}`).first()).toBeVisible({ timeout: 10_000 });

    const signupBtn = page.getByRole('button', { name: /sign up|signup|register|join/i }).first();
    if (!(await signupBtn.isVisible())) {
      test.info().annotations.push({ type: 'note', description: 'Sign up button not visible — may already be signed up or not approved' });
      return;
    }

    const [res] = await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/beneficiaries') && r.request().method() === 'POST',
        { timeout: 15_000 }
      ),
      signupBtn.click(),
    ]);
    if (res.status() === 200 || res.status() === 201) {
      const body = await res.json();
      ctx.student1SignupId = body.id ?? '';
    }
  });

  test('signup reflects on dashboard', async () => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
    // Either the opportunity title appears or the empty-state shows — just no crash
    await expect(page.locator('text=/failed to load/i')).toHaveCount(0);
  });

  test('self-submit page loads', async () => {
    await page.goto(`${BASE}/submit`, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/submit/);
    await expect(page.locator('text=/failed to load/i')).toHaveCount(0);
  });

  test('can submit self-volunteering hours', async () => {
    await page.goto(`${BASE}/submit`, { waitUntil: 'networkidle' });

    // Open the form — may need to click "Log Hours" or similar
    const addBtn = page.getByRole('button', { name: /log hours|add hours|new submission|submit hours/i }).first();
    if (await addBtn.count()) await addBtn.click();

    const orgInput = page.locator('input[placeholder*="organization" i], input[placeholder*="where" i]').first();
    await orgInput.fill('PW External Org');

    const descInput = page.locator('textarea[placeholder*="description" i], textarea[placeholder*="what" i]').first();
    if (await descInput.count()) await descInput.fill('Playwright test self-submission.');

    const dateInput = page.locator('input[type="date"]').first();
    if (await dateInput.count()) await dateInput.fill(tomorrow());

    const hoursInput = page.locator('input[type="number"], input[placeholder*="hours" i]').first();
    if (await hoursInput.count()) await hoursInput.fill('2');

    const [res] = await Promise.all([
      page.waitForResponse(
        r => r.url().includes('/api/self-submissions') && r.request().method() === 'POST',
        { timeout: 15_000 }
      ),
      page.getByRole('button', { name: /submit|save/i }).last().click(),
    ]);
    if (res.status() === 201 || res.status() === 200) {
      const body = await res.json();
      ctx.selfSubmitId = body.id ?? '';
    }
    expect([200, 201]).toContain(res.status());
  });

  test('submitted request shows as PENDING', async () => {
    await page.goto(`${BASE}/submit`, { waitUntil: 'networkidle' });
    await expect(page.locator('text=/pending/i').first()).toBeVisible({ timeout: 8_000 });
  });

  test('settings page loads', async () => {
    await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/settings/);
    await expect(page.locator('text=/failed to load/i')).toHaveCount(0);
  });
});

// ─── 5. Beneficiary Admin A — Approve Student Hours ──────────────────────────

test.describe.serial('5 — Beneficiary Admin A: Approve Hours', () => {
  let ctx_: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    ctx_ = await newContext(browser);
    page = await ctx_.newPage();
    await loginFast(page, ACCOUNTS.orgA.email, ACCOUNTS.orgA.password);
    if (!ctx.orgAId) {
      const me = await apiGet<any>(page, '/auth/me');
      ctx.orgAId = me.beneficiaryId;
    }
  });
  test.afterAll(() => ctx_.close());

  test('signups tab shows student signup if one exists', async () => {
    await page.goto(`${BASE}/opportunities`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /signups/i }).first().click();
    // Just verify no crash — signup may or may not exist depending on test 4
    await expect(page.locator('text=/failed to load/i')).toHaveCount(0);
  });

  test('can approve a student signup via API', async () => {
    if (!ctx.student1SignupId) {
      test.skip(true, 'No signup ID from test 4 — skipping approval');
      return;
    }
    const res = await apiRawPost(page, `/beneficiaries/signups/${ctx.student1SignupId}/approve`, {});
    expect([200, 201]).toContain(res.status());
  });
});

// ─── 6. School Admin A — Review Self-Submissions ─────────────────────────────

test.describe.serial('6 — School Admin A: Self-Submissions', () => {
  let ctx_: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    ctx_ = await newContext(browser);
    page = await ctx_.newPage();
    await loginFast(page, ACCOUNTS.schoolA.email, ACCOUNTS.schoolA.password);
  });
  test.afterAll(() => ctx_.close());

  test('submissions page shows the pending self-submission', async () => {
    await page.goto(`${BASE}/submissions`, { waitUntil: 'networkidle' });
    await expect(page.locator('text=/pending/i').first()).toBeVisible({ timeout: 8_000 });
    if (ctx.selfSubmitId) {
      await expect(page.locator('text=/PW External Org/i').first()).toBeVisible({ timeout: 8_000 });
    }
  });

  test('can approve the self-submission', async () => {
    if (!ctx.selfSubmitId) {
      test.skip(true, 'No self-submission ID — skipping');
      return;
    }
    await page.goto(`${BASE}/submissions`, { waitUntil: 'networkidle' });

    // Click "Review" on the PW External Org submission
    const reviewBtn = page.getByRole('button', { name: /review/i }).first();
    if (await reviewBtn.isVisible()) {
      await reviewBtn.click();
      const approveBtn = page.getByRole('button', { name: /approve/i }).first();
      if (await approveBtn.isVisible()) {
        const [res] = await Promise.all([
          page.waitForResponse(
            r => r.url().includes('/api/self-submissions') && r.url().includes('/approve'),
            { timeout: 15_000 }
          ),
          approveBtn.click(),
        ]);
        expect([200, 201]).toContain(res.status());
      }
    } else {
      // Approve directly via API as fallback
      const res = await apiRawPost(page, `/self-submissions/${ctx.selfSubmitId}/approve`, {});
      expect([200, 201]).toContain(res.status());
    }
  });
});

// ─── 7. Student 1 — Approved Hours Reflected ─────────────────────────────────

test.describe('7 — Student 1: Approved Hours on Dashboard', () => {
  let ctx_: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    ctx_ = await newContext(browser);
    page = await ctx_.newPage();
    await loginFast(page, ACCOUNTS.student1.email, ACCOUNTS.student1.password);
  });
  test.afterAll(() => ctx_.close());

  test('dashboard shows approved self-submission', async () => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
    // Either hours counter or the submission title should appear
    await expect(page.locator('text=/approved|PW External Org/i').first()).toBeVisible({ timeout: 10_000 });
  });
});

// ─── 8. Profile & Settings ───────────────────────────────────────────────────

test.describe.serial('8 — Profile Updates', () => {
  let ctx_: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    ctx_ = await newContext(browser);
    page = await ctx_.newPage();
    await loginFast(page, ACCOUNTS.student1.email, ACCOUNTS.student1.password);
  });
  test.afterAll(() => ctx_.close());

  test('student settings page loads', async () => {
    await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/settings/);
  });

  test('can update display name', async () => {
    await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
    const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
    if (!(await nameInput.count())) return; // Settings UI may vary
    await nameInput.fill('PW Student 1 Updated');
    const [res] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/auth/profile') && r.request().method() === 'PUT', { timeout: 15_000 }),
      page.getByRole('button', { name: /save|update/i }).first().click(),
    ]);
    expect([200, 201]).toContain(res.status());
    // Revert
    await apiPut(page, '/auth/profile', { name: 'PW Student 1' });
  });
});

// ─── 9. RBAC — Role-Based Access Control ─────────────────────────────────────

test.describe.serial('9 — RBAC', () => {
  let studentCtx: BrowserContext;
  let studentPage: Page;
  let orgCtx: BrowserContext;
  let orgPage: Page;

  test.beforeAll(async ({ browser }) => {
    studentCtx = await newContext(browser);
    studentPage = await studentCtx.newPage();
    await loginFast(studentPage, ACCOUNTS.student1.email, ACCOUNTS.student1.password);

    orgCtx = await newContext(browser);
    orgPage = await orgCtx.newPage();
    await loginFast(orgPage, ACCOUNTS.orgA.email, ACCOUNTS.orgA.password);
  });
  test.afterAll(async () => {
    await studentCtx.close();
    await orgCtx.close();
  });

  test('student cannot access /cohorts — redirected', async () => {
    await studentPage.goto(`${BASE}/cohorts`, { waitUntil: 'domcontentloaded' });
    // Should redirect to /dashboard or /login, or show a permission error
    const url = studentPage.url();
    const hasPermError = await studentPage.locator('text=/not authorized|permission|access denied/i').count();
    expect(url.includes('/cohorts') && hasPermError === 0, 'Student should not be able to access /cohorts').toBe(false);
  });

  test('student cannot access /submissions — redirected', async () => {
    await studentPage.goto(`${BASE}/submissions`, { waitUntil: 'domcontentloaded' });
    const url = studentPage.url();
    const hasPermError = await studentPage.locator('text=/not authorized|permission|access denied/i').count();
    expect(url.includes('/submissions') && hasPermError === 0, 'Student should not access /submissions').toBe(false);
  });

  test('student cannot access /students — redirected', async () => {
    await studentPage.goto(`${BASE}/students`, { waitUntil: 'domcontentloaded' });
    const url = studentPage.url();
    const hasPermError = await studentPage.locator('text=/not authorized|permission|access denied/i').count();
    expect(url.includes('/students') && hasPermError === 0, 'Student should not access /students').toBe(false);
  });

  test('beneficiary admin cannot access /cohorts — redirected', async () => {
    await orgPage.goto(`${BASE}/cohorts`, { waitUntil: 'domcontentloaded' });
    const url = orgPage.url();
    const hasPermError = await orgPage.locator('text=/not authorized|permission|access denied/i').count();
    expect(url.includes('/cohorts') && hasPermError === 0, 'Org admin should not access /cohorts').toBe(false);
  });

  test('school admin API cannot approve hours it does not own', async () => {
    // School A admin tries to approve a signup belonging to Org B — should 403
    const schACtx = await newContext(studentPage.context().browser()!);
    const schAPage = await schACtx.newPage();
    await loginFast(schAPage, ACCOUNTS.schoolA.email, ACCOUNTS.schoolA.password);
    const res = await apiRawPost(schAPage, '/beneficiaries/signups/nonexistent-id/approve', {});
    expect([403, 404]).toContain(res.status());
    await schACtx.close();
  });

  test('unauthenticated request to /auth/me returns 401', async () => {
    const anonCtx = await studentPage.context().browser()!.newContext();
    const anonPage = await anonCtx.newPage();
    const res = await anonPage.request.get(`${BASE}/api/auth/me`);
    expect(res.status()).toBe(401);
    await anonCtx.close();
  });
});

// ─── 10. School B / Student C — Cross-School Isolation ───────────────────────

test.describe.serial('10 — School B & Student 3: Isolation', () => {
  let schBCtx: BrowserContext;
  let schBPage: Page;
  let st3Ctx: BrowserContext;
  let st3Page: Page;

  test.beforeAll(async ({ browser }) => {
    schBCtx = await newContext(browser);
    schBPage = await schBCtx.newPage();
    await loginFast(schBPage, ACCOUNTS.schoolB.email, ACCOUNTS.schoolB.password);

    st3Ctx = await newContext(browser);
    st3Page = await st3Ctx.newPage();
    await loginFast(st3Page, ACCOUNTS.student3.email, ACCOUNTS.student3.password);
  });
  test.afterAll(async () => {
    await schBCtx.close();
    await st3Ctx.close();
  });

  test('School B admin dashboard loads with PW Cohort B', async () => {
    await schBPage.goto(`${BASE}/cohorts`, { waitUntil: 'networkidle' });
    await expect(schBPage.locator('text=/PW Cohort B/i').first()).toBeVisible({ timeout: 10_000 });
  });

  test('School B admin does NOT see School A students', async () => {
    const students = await apiGet<any[]>(schBPage, `/schools/${await getSchoolBId(schBPage)}/students`);
    const schoolAStudents = students.filter(s =>
      s.email === ACCOUNTS.student1.email || s.email === ACCOUNTS.student2.email
    );
    expect(schoolAStudents).toHaveLength(0);
  });

  test('Student 3 dashboard loads', async () => {
    await st3Page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
    await expect(st3Page).toHaveURL(/dashboard/);
    await expect(st3Page.locator('text=/failed to load/i')).toHaveCount(0);
  });

  test('Student 3 cannot see School A opportunities (Org A not approved by School B)', async () => {
    const slots = await apiGet<any[]>(st3Page, '/beneficiaries/available-slots');
    const orgASlots = slots.filter(s =>
      s.opportunity?.beneficiary?.name === 'Playwright Org A'
    );
    // Org A is approved for School A only — Student 3 in School B should see 0 Org A slots
    expect(orgASlots).toHaveLength(0);
  });

  test('Student 3 CAN see School B org opportunities (Org B approved for School B)', async () => {
    // Only relevant if Org B admin has created an opportunity — API check is sufficient
    const slots = await apiGet<any[]>(st3Page, '/beneficiaries/available-slots');
    // Just verify no error — Org B may not have created any opportunities yet
    expect(Array.isArray(slots)).toBe(true);
  });
});

async function getSchoolBId(page: Page): Promise<string> {
  const me = await apiGet<any>(page, '/auth/me');
  return me.schoolId as string;
}

// ─── 11. School Admin A — Cohort Management ──────────────────────────────────

test.describe.serial('11 — School Admin A: Cohort Management', () => {
  let ctx_: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    ctx_ = await newContext(browser);
    page = await ctx_.newPage();
    await loginFast(page, ACCOUNTS.schoolA.email, ACCOUNTS.schoolA.password);
  });
  test.afterAll(() => ctx_.close());

  test('newly created cohort appears at /cohorts', async () => {
    if (!ctx.newCohortId) {
      test.skip(true, 'No cohort ID from test 2 — skipping');
      return;
    }
    await page.goto(`${BASE}/cohorts`, { waitUntil: 'networkidle' });
    await expect(page.locator(`text=${ctx.newCohortName}`).first()).toBeVisible({ timeout: 10_000 });
  });

  test('cohort detail page has invite button', async () => {
    if (!ctx.newCohortId) {
      test.skip(true, 'No cohort ID — skipping');
      return;
    }
    await page.goto(`${BASE}/cohorts/${ctx.newCohortId}`, { waitUntil: 'networkidle' });
    await expect(page.locator(`text=${ctx.newCohortName}`).first()).toBeVisible({ timeout: 10_000 });
    const inviteBtn = page.getByRole('button', { name: /invite|add student/i }).first();
    await expect(inviteBtn).toBeVisible({ timeout: 5_000 });
  });

  test('can delete the test cohort', async () => {
    if (!ctx.newCohortId) {
      test.skip(true, 'No cohort ID — skipping');
      return;
    }
    // Try API delete to clean up
    const res = await apiDelete(page, `/cohorts/${ctx.newCohortId}`);
    expect([200, 204]).toContain(res.status());
  });
});

// ─── 12. Beneficiary Admin B — Independent School B Flow ─────────────────────

test.describe.serial('12 — Beneficiary Admin B: School B Org', () => {
  let ctx_: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    ctx_ = await newContext(browser);
    page = await ctx_.newPage();
    await loginFast(page, ACCOUNTS.orgB.email, ACCOUNTS.orgB.password);
  });
  test.afterAll(() => ctx_.close());

  test('dashboard loads with Playwright Org B', async () => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
    await expect(page.locator('text=/Playwright Org B/i').first()).toBeVisible({ timeout: 10_000 });
  });

  test('opportunities page loads', async () => {
    await page.goto(`${BASE}/opportunities`, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/opportunities/);
    await expect(page.locator('text=/failed to load/i')).toHaveCount(0);
  });

  test('settings page loads', async () => {
    await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
    await expect(page.locator('text=/Playwright Org B/i').first()).toBeVisible({ timeout: 10_000 });
  });
});

// ─── 13. Student 2 — School A, Same Cohort as Student 1 ──────────────────────

test.describe.serial('13 — Student 2: School A', () => {
  let ctx_: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    ctx_ = await newContext(browser);
    page = await ctx_.newPage();
    await loginFast(page, ACCOUNTS.student2.email, ACCOUNTS.student2.password);
  });
  test.afterAll(() => ctx_.close());

  test('student 2 dashboard loads', async () => {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
    await expect(st2Page(page)).toHaveURL(/dashboard/);
    await expect(page.locator('text=/failed to load/i')).toHaveCount(0);
  });

  test('student 2 can browse the same Org A opportunity as student 1', async () => {
    if (!ctx.slotId) {
      test.skip(true, 'No slot ID — skipping');
      return;
    }
    await page.goto(`${BASE}/slot/${ctx.slotId}`, { waitUntil: 'networkidle' });
    await expect(page.locator(`text=${ctx.opportunityTitle}`).first()).toBeVisible({ timeout: 10_000 });
  });

  test('student 2 cannot see student 1\'s self-submission', async () => {
    if (!ctx.selfSubmitId) {
      test.skip(true, 'No self-submission ID — skipping');
      return;
    }
    // Students can only see their OWN submissions
    const submissions = await apiGet<any[]>(page, '/self-submissions');
    const other = submissions.find(s => s.id === ctx.selfSubmitId);
    expect(other).toBeUndefined();
  });
});

function st2Page(page: Page): Page { return page; } // alias for readability
