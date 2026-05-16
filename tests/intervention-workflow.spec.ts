import { expect, test } from "@playwright/test";

type LoginResponse = {
  token: string;
  user?: {
    id: string;
    email?: string;
    schoolId?: string | null;
  };
};

type SchoolStudent = {
  id: string;
  name: string;
  email: string;
};

const BASE = process.env.PW_BASE_URL || "http://localhost:5173";
const ADMIN_EMAIL = process.env.PW_SCHOOL_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PW_SCHOOL_ADMIN_PASSWORD;
const STUDENT_EMAIL = process.env.PW_STUDENT_EMAIL;
const STUDENT_PASSWORD = process.env.PW_STUDENT_PASSWORD;

async function loginViaApi(page: import("@playwright/test").Page, email: string, password: string): Promise<LoginResponse> {
  const res = await page.request.post(`${BASE}/api/auth/login`, {
    data: { email, password },
  });
  expect(res.ok()).toBeTruthy();
  return res.json() as Promise<LoginResponse>;
}

async function installToken(page: import("@playwright/test").Page, token: string): Promise<void> {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate((jwt) => {
    localStorage.setItem("goodhours_token", jwt);
    localStorage.removeItem("goodhours_user");
  }, token);
}

async function authGet<T>(page: import("@playwright/test").Page, token: string, path: string): Promise<T> {
  const res = await page.request.get(`${BASE}/api${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok(), `GET ${path} failed with ${res.status()}`).toBeTruthy();
  return res.json() as Promise<T>;
}

async function authPut<T>(page: import("@playwright/test").Page, token: string, path: string, body: unknown): Promise<T> {
  const res = await page.request.put(`${BASE}/api${path}`, {
    data: body,
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok(), `PUT ${path} failed with ${res.status()}`).toBeTruthy();
  return res.json() as Promise<T>;
}

test("school intervention workflow is visible to staff and student", async ({ page, browser }) => {
  test.skip(
    !ADMIN_EMAIL || !ADMIN_PASSWORD || !STUDENT_EMAIL || !STUDENT_PASSWORD,
    "Set PW_SCHOOL_ADMIN_EMAIL, PW_SCHOOL_ADMIN_PASSWORD, PW_STUDENT_EMAIL, and PW_STUDENT_PASSWORD to run this workflow.",
  );

  const adminLogin = await loginViaApi(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
  const adminToken = adminLogin.token;
  const adminMe = await authGet<{ id: string; email: string; schoolId?: string | null }>(page, adminToken, "/auth/me");
  const schoolStudents = await authGet<SchoolStudent[]>(page, adminToken, "/cohorts/school-students");
  const targetStudent = schoolStudents.find((student) => student.email === STUDENT_EMAIL);

  expect(targetStudent, `Configured student ${STUDENT_EMAIL} was not found in the admin school roster`).toBeTruthy();

  const dueDate = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const caseSummary = `Pilot intervention ${Date.now()}`;
  const studentMessage = "Please reply with your plan to finish remaining service hours this week.";
  const nextStepForStudent = "Send your plan and confirm your next volunteer session.";

  await authPut(page, adminToken, `/messages/interventions/cases/${targetStudent.id}`, {
    status: "WAITING_ON_STUDENT",
    priority: "HIGH",
    summary: caseSummary,
    reason: "Student still has remaining hours close to the deadline.",
    nextStepForStudent,
    nextStepForStaff: "Check for response and verify whether another outreach round is needed.",
    studentMessage,
    staffNote: "Created by automated pilot-readiness test.",
    dueDate,
    ownerId: adminMe.id,
  });

  const studentContext = await browser.newContext();
  const studentPage = await studentContext.newPage();

  try {
    await installToken(page, adminToken);
    await page.goto(`${BASE}/messages`, { waitUntil: "networkidle" });
    await expect(page.getByText("Open Intervention Queue")).toBeVisible();
    await expect(page.getByText(caseSummary)).toBeVisible();
    await expect(page.getByText(targetStudent.name)).toBeVisible();

    const studentLogin = await loginViaApi(studentPage, STUDENT_EMAIL!, STUDENT_PASSWORD!);
    await installToken(studentPage, studentLogin.token);
    await studentPage.goto(`${BASE}/messages`, { waitUntil: "networkidle" });
    await expect(studentPage.getByText("School Follow-Up Active")).toBeVisible();
    await expect(studentPage.getByText(caseSummary)).toBeVisible();
    await expect(studentPage.getByText(studentMessage)).toBeVisible();
    await expect(studentPage.getByText(/Follow up by/i)).toBeVisible();
    await expect(studentPage.getByRole("button", { name: "Message School Now" })).toBeVisible();
  } finally {
    await authPut(page, adminToken, `/messages/interventions/cases/${targetStudent.id}`, {
      status: "RESOLVED",
      priority: "LOW",
      summary: caseSummary,
      reason: "Cleaned up after automated intervention workflow test.",
      nextStepForStudent: "",
      nextStepForStaff: "",
      studentMessage: "",
      staffNote: "Resolved by automated intervention workflow cleanup.",
      dueDate: "",
      ownerId: adminMe.id,
    });
    await studentContext.close();
  }
});
