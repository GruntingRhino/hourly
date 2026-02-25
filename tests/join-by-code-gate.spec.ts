import { test, expect, APIRequestContext, Page } from '@playwright/test';

const WEB_BASE_URL = process.env.QA_BASE_URL || 'http://localhost:5173';
const API_BASE_URL = process.env.QA_API_BASE || 'http://localhost:3001/api';

const SCHOOL_ADMIN = {
  email: 'admin@lincoln.edu',
  password: 'password123',
};

const STUDENT = {
  email: 'john@student.edu',
  password: 'password123',
};

const DISABLED_MESSAGE = 'Joining by code is currently disabled by your school.';

interface LoginResponse {
  token: string;
}

interface ClassroomSummary {
  id: string;
  inviteCode: string;
  isActive: boolean;
}

interface AuthMeResponse {
  classroomId: string | null;
}

async function apiLogin(request: APIRequestContext, email: string, password: string): Promise<string> {
  const response = await request.post(`${API_BASE_URL}/auth/login`, {
    data: { email, password },
  });
  expect(response.status()).toBe(200);

  const body = (await response.json()) as LoginResponse;
  expect(body.token).toBeTruthy();
  return body.token;
}

async function getActiveInviteCode(request: APIRequestContext, token: string): Promise<string> {
  const listResponse = await request.get(`${API_BASE_URL}/classrooms`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(listResponse.status()).toBe(200);

  const classrooms = (await listResponse.json()) as ClassroomSummary[];
  const activeClassroom = classrooms.find((classroom) => classroom.isActive);
  if (activeClassroom?.inviteCode) {
    return activeClassroom.inviteCode;
  }

  const createResponse = await request.post(`${API_BASE_URL}/classrooms`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: `QA Join Gate ${Date.now()}` },
  });
  expect(createResponse.status()).toBe(201);

  const created = (await createResponse.json()) as ClassroomSummary;
  expect(created.inviteCode).toBeTruthy();
  return created.inviteCode;
}

async function setAllowJoinByCode(request: APIRequestContext, token: string, allowJoinByCode: boolean): Promise<void> {
  const response = await request.patch(`${API_BASE_URL}/schools/settings`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { allowJoinByCode },
  });
  expect(response.status()).toBe(200);

  const body = (await response.json()) as { allowJoinByCode: boolean };
  expect(body.allowJoinByCode).toBe(allowJoinByCode);
}

async function leaveClassroomIfNeeded(request: APIRequestContext, token: string): Promise<void> {
  const response = await request.post(`${API_BASE_URL}/classrooms/leave`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  // 200 => left classroom, 400 => already not in classroom
  expect([200, 400]).toContain(response.status());
}

async function getStudentClassroomId(request: APIRequestContext): Promise<string | null> {
  const token = await apiLogin(request, STUDENT.email, STUDENT.password);
  const meResponse = await request.get(`${API_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(meResponse.status()).toBe(200);

  const me = (await meResponse.json()) as AuthMeResponse;
  return me.classroomId;
}

async function loginViaUi(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${WEB_BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);

  const [loginResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().includes('/api/auth/login')),
    page.getByRole('button', { name: /sign in/i }).click(),
  ]);

  expect(loginResponse.status(), `UI login failed for ${email}`).toBe(200);

  await page.waitForLoadState('networkidle').catch(() => {});

  const continueButton = page.getByRole('button', { name: /continue to dashboard/i });
  if (await continueButton.count()) {
    await continueButton.first().click();
    await page.waitForLoadState('networkidle').catch(() => {});
  }
}

test.describe.serial('School join-by-code gate', () => {
  let adminToken: string;
  let inviteCode: string;

  test.beforeAll(async ({ request }) => {
    adminToken = await apiLogin(request, SCHOOL_ADMIN.email, SCHOOL_ADMIN.password);
    inviteCode = await getActiveInviteCode(request, adminToken);
  });

  test.afterAll(async ({ request }) => {
    const freshAdminToken = await apiLogin(request, SCHOOL_ADMIN.email, SCHOOL_ADMIN.password);
    await setAllowJoinByCode(request, freshAdminToken, false);

    const studentToken = await apiLogin(request, STUDENT.email, STUDENT.password);
    await leaveClassroomIfNeeded(request, studentToken);
  });

  test('Case A: toggle OFF blocks student join by code with exact message', async ({ page, request }) => {
    await setAllowJoinByCode(request, adminToken, false);

    const studentToken = await apiLogin(request, STUDENT.email, STUDENT.password);
    await leaveClassroomIfNeeded(request, studentToken);

    await loginViaUi(page, STUDENT.email, STUDENT.password);
    await expect(page.getByRole('heading', { name: 'Join a Classroom' })).toBeVisible();

    await page.locator('input[maxlength="8"]').first().fill(inviteCode.toLowerCase());

    const [joinResponse] = await Promise.all([
      page.waitForResponse((response) => response.url().includes('/api/classrooms/join')),
      page.getByRole('button', { name: /join classroom/i }).click(),
    ]);

    expect(joinResponse.status()).toBe(403);
    await expect(page.getByText(DISABLED_MESSAGE)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Join a Classroom' })).toBeVisible();

    const classroomId = await getStudentClassroomId(request);
    expect(classroomId).toBeNull();
  });

  test('Case B: toggle ON allows student join by code and dashboard loads', async ({ page, request }) => {
    await setAllowJoinByCode(request, adminToken, true);

    const studentToken = await apiLogin(request, STUDENT.email, STUDENT.password);
    await leaveClassroomIfNeeded(request, studentToken);

    await loginViaUi(page, STUDENT.email, STUDENT.password);
    await expect(page.getByRole('heading', { name: 'Join a Classroom' })).toBeVisible();

    await page.locator('input[maxlength="8"]').first().fill(inviteCode.toLowerCase());

    const [joinResponse] = await Promise.all([
      page.waitForResponse((response) => response.url().includes('/api/classrooms/join')),
      page.getByRole('button', { name: /join classroom/i }).click(),
    ]);

    expect(joinResponse.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    const classroomId = await getStudentClassroomId(request);
    expect(classroomId).toBeTruthy();
  });
});
