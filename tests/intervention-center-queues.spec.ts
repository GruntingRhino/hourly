import { expect, test } from "@playwright/test";

type LoginResponse = {
  token: string;
};

type SchoolStudent = {
  id: string;
  name: string;
  email: string;
  approvedHours: number;
  pendingHours?: number;
  requiredHours: number;
  remainingHours?: number;
  percentComplete?: number;
  status?: "COMPLETED" | "ON_TRACK" | "AT_RISK" | "NOT_STARTED";
  riskLevel?: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  riskReasons?: string[];
  noShowCount?: number;
  daysToDeadline?: number | null;
};

type QueueId = "DEADLINE_ESCALATIONS" | "APPROVAL_BOTTLENECKS" | "ATTENDANCE_WATCH";

const BASE = process.env.PW_BASE_URL || "http://localhost:5173";
const ADMIN_EMAIL = process.env.PW_SCHOOL_ADMIN_EMAIL || "abhay.sivaram+1@gmail.com";
const ADMIN_PASSWORD = process.env.PW_SCHOOL_ADMIN_PASSWORD || "Playwright1!";

function riskLevelWeight(level?: "NONE" | "LOW" | "MEDIUM" | "HIGH"): number {
  switch (level) {
    case "HIGH":
      return 3;
    case "MEDIUM":
      return 2;
    case "LOW":
      return 1;
    default:
      return 0;
  }
}

function triageScore(student: SchoolStudent): number {
  let score = 0;
  score += riskLevelWeight(student.riskLevel) * 100;
  if (student.status === "AT_RISK") score += 80;
  if ((student.daysToDeadline ?? 9999) < 0) score += 90;
  else if ((student.daysToDeadline ?? 9999) <= 7) score += 60;
  else if ((student.daysToDeadline ?? 9999) <= 14) score += 40;
  score += Math.min(40, (student.noShowCount ?? 0) * 15);
  score += Math.min(30, Math.round(student.pendingHours ?? 0));
  score += Math.min(25, (student.riskReasons?.length ?? 0) * 5);
  score += Math.max(0, 20 - Math.round((student.percentComplete ?? 0) / 5));
  return score;
}

function matchesQueue(student: SchoolStudent, queueId: QueueId): boolean {
  switch (queueId) {
    case "DEADLINE_ESCALATIONS":
      return (student.daysToDeadline ?? 9999) < 0;
    case "APPROVAL_BOTTLENECKS":
      return (student.pendingHours ?? 0) > 0;
    case "ATTENDANCE_WATCH":
      return (student.noShowCount ?? 0) > 0;
  }
}

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

test("dashboard intervention center links open the matching triage lists", async ({ page }) => {
  const login = await loginViaApi(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  const token = login.token;
  const me = await authGet<{ schoolId?: string | null }>(page, token, "/auth/me");
  expect(me.schoolId).toBeTruthy();

  const students = await authGet<SchoolStudent[]>(page, token, `/schools/${me.schoolId}/students`);
  await installToken(page, token);
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });

  await expect(page.getByText("Administrator Intervention Center")).toBeVisible();

  const queues: Array<{
    label: string;
    queueId: QueueId;
    urlFragment: string;
    description: RegExp;
  }> = [
    {
      label: "Deadline Escalations",
      queueId: "DEADLINE_ESCALATIONS",
      urlFragment: "view=DEADLINE_ESCALATIONS",
      description: /deadline has already passed/i,
    },
    {
      label: "Approval Bottlenecks",
      queueId: "APPROVAL_BOTTLENECKS",
      urlFragment: "view=APPROVAL_BOTTLENECKS",
      description: /approval backlog/i,
    },
    {
      label: "Attendance Watch",
      queueId: "ATTENDANCE_WATCH",
      urlFragment: "view=ATTENDANCE_WATCH",
      description: /recorded no-shows/i,
    },
  ];

  for (const queue of queues) {
    const expectedStudents = [...students]
      .filter((student) => matchesQueue(student, queue.queueId))
      .sort((a, b) => {
        const scoreDiff = triageScore(b) - triageScore(a);
        if (scoreDiff !== 0) return scoreDiff;
        const deadlineA = a.daysToDeadline ?? Number.POSITIVE_INFINITY;
        const deadlineB = b.daysToDeadline ?? Number.POSITIVE_INFINITY;
        if (deadlineA !== deadlineB) return deadlineA - deadlineB;
        return a.name.localeCompare(b.name);
      });

    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
    await page.getByRole("link", { name: queue.label }).click();
    await expect(page).toHaveURL(new RegExp(queue.urlFragment));
    await expect(page.getByText(queue.description)).toBeVisible();

    if (expectedStudents.length === 0) {
      await expect(page.getByText("No students found.")).toBeVisible();
      continue;
    }

    await expect(page.getByText("Students in queue")).toBeVisible();
    await expect(page.getByRole("button", { name: new RegExp(expectedStudents[0].name, "i") }).first()).toBeVisible();
  }
});
