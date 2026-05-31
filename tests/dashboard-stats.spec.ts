import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PW_BASE_URL || 'http://localhost:5173';
const ADMIN_EMAIL = process.env.GOODHOURS_ADMIN_EMAIL || 'admin@lincoln.edu';
const ADMIN_PASSWORD = process.env.GOODHOURS_ADMIN_PASSWORD || 'password123';

test('school dashboard summary cards stay consistent with the visible student roster', async ({ page }) => {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').first().fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);

  const [loginResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/auth/login'), { timeout: 60_000 }),
    page.getByRole('button', { name: /sign in/i }).click(),
  ]);

  expect(loginResponse.status()).toBe(200);
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

  const sessionOnly = page.getByRole('button', { name: /this session only/i });
  if (await sessionOnly.count()) {
    await sessionOnly.click();
  }

  const continueButton = page.getByRole('button', { name: /continue to dashboard/i });
  if (await continueButton.count()) {
    await continueButton.click();
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  }

  await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();

  const totalStudentsCard = page.locator('div').filter({ hasText: /^Total Students/ }).first();
  await expect(totalStudentsCard).toBeVisible();
  const totalStudentsText = await totalStudentsCard.textContent();
  const totalStudents = Number(totalStudentsText?.match(/Total Students\s*(\d+)/i)?.[1] ?? NaN);

  const rosterRows = page.locator('table tr').filter({ has: page.locator('td') });
  const rosterCount = await rosterRows.count();

  expect(Number.isFinite(totalStudents)).toBe(true);
  expect(totalStudents).toBe(rosterCount);
});
