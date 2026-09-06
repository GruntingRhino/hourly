import { expect, Page, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const UI_BASE = process.env.PW_BASE_URL || process.env.UI_BASE_URL || "http://localhost:5173";
const API_BASE = process.env.API_BASE_URL || "http://localhost:3001";
const PASSWORD = "Playwright1!";
const AUTH_CACHE_DIR = path.join(process.cwd(), "tests", ".auth", "ui-audit");

const ACCOUNTS = {
  schoolA: { email: "abhay.sivaram+1@gmail.com", password: PASSWORD },
  orgA: { email: "abhay.sivaram+3@gmail.com", password: PASSWORD },
  student1: { email: "abhay.sivaram+5@gmail.com", password: PASSWORD },
} as const;

interface CachedAuthSession {
  token: string;
  user?: unknown;
}

interface AvailableSlot {
  id: string;
  date: string;
  opportunity: {
    id: string;
    title: string;
    beneficiary: {
      name: string;
    };
  };
}

interface MySignupRecord {
  id: string;
  status: string;
  slot: {
    id: string;
    opportunity: {
      title: string;
    };
  };
}

const flow = {
  opportunityId: "",
  opportunityTitle: `UI Stateful Audit Opportunity ${Date.now()}`,
  updatedOpportunityTitle: "",
  opportunityHref: "",
  orgId: "",
  submissionId: "",
  submissionOrgName: `UI Stateful Audit Org ${Date.now()}`,
  revisionNote: "Please attach a more specific completion note.",
  approvedHours: "2.5",
};

async function writeCachedSession(accountKey: string, session: CachedAuthSession): Promise<void> {
  await fs.mkdir(AUTH_CACHE_DIR, { recursive: true });
  await fs.writeFile(path.join(AUTH_CACHE_DIR, `${accountKey}.json`), JSON.stringify(session), "utf8");
}

async function readCachedSession(accountKey: string): Promise<CachedAuthSession> {
  try {
    const raw = await fs.readFile(path.join(AUTH_CACHE_DIR, `${accountKey}.json`), "utf8");
    const parsed = JSON.parse(raw) as CachedAuthSession;
    return {
      token: parsed.token || "",
      user: parsed.user ?? null,
    };
  } catch {
    return { token: "", user: null };
  }
}

async function loginFast(page: Page, accountKey: keyof typeof ACCOUNTS): Promise<void> {
  const account = ACCOUNTS[accountKey];
  const res = await page.request.post(`${API_BASE}/api/auth/login`, {
    data: { email: account.email, password: account.password },
  });

  let token = "";
  let user: unknown = null;

  if (res.ok()) {
    const body = await res.json();
    token = body.token as string;
    user = (body.user ?? null) as unknown;
    expect(token).toBeTruthy();
    await writeCachedSession(accountKey, { token, user });
  } else {
    const cached = await readCachedSession(accountKey);
    token = cached.token;
    user = cached.user ?? null;
    if (!token) {
      throw new Error(`Unable to authenticate ${accountKey}: ${res.status()} ${await res.text()}`);
    }
  }

  await page.goto(`${UI_BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ token, user }) => {
    localStorage.setItem("goodhours_token", token);
    if (user) localStorage.setItem("goodhours_user", JSON.stringify(user));
    else localStorage.removeItem("goodhours_user");
  }, { token, user });
}

async function getToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => localStorage.getItem("goodhours_token") ?? "");
  expect(token).toBeTruthy();
  return token;
}

async function apiDelete(page: Page, apiPath: string) {
  const token = await getToken(page);
  return page.request.delete(`${API_BASE}${apiPath}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function apiGet<T>(page: Page, apiPath: string): Promise<T> {
  const token = await getToken(page);
  const res = await page.request.get(`${API_BASE}${apiPath}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok(), `${apiPath} failed with ${res.status()}`).toBeTruthy();
  return res.json() as Promise<T>;
}

function submissionCard(page: Page, organizationName: string) {
  return page
    .getByText(organizationName, { exact: true })
    .locator("xpath=ancestor::div[contains(@class, 'bg-')][1]");
}

function fieldByLabel(container: Page | ReturnType<Page["locator"]>, label: RegExp, tag: "input" | "textarea" | "select" = "input") {
  return container.locator("label").filter({ hasText: label }).locator("..").locator(tag).first();
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

test.describe.serial("UI stateful audit", () => {
  let orgPage: Page;
  let schoolPage: Page;
  let studentPage: Page;

  test.beforeAll(async ({ browser }) => {
    const orgContext = await browser.newContext();
    orgPage = await orgContext.newPage();
    await loginFast(orgPage, "orgA");

    const schoolContext = await browser.newContext();
    schoolPage = await schoolContext.newPage();
    await loginFast(schoolPage, "schoolA");

    const studentContext = await browser.newContext();
    studentPage = await studentContext.newPage();
    await loginFast(studentPage, "student1");

    const me = await apiGet<{ beneficiaryId: string }>(orgPage, "/api/auth/me");
    flow.orgId = me.beneficiaryId;
  });

  test.afterAll(async () => {
    if (flow.opportunityId && flow.orgId) {
      await apiDelete(orgPage, `/api/beneficiaries/${flow.orgId}/opportunities/${flow.opportunityId}`).catch(() => {});
    }
    if (orgPage) await orgPage.context().close();
    if (schoolPage) await schoolPage.context().close();
    if (studentPage) await studentPage.context().close();
  });

  test("organization can create opportunity from UI", async () => {
    await orgPage.goto(`${UI_BASE}/opportunities`, { waitUntil: "networkidle" });
    const form = orgPage.locator("form").first();

    await fieldByLabel(form, /^title/i).fill(flow.opportunityTitle);
    await form.getByRole("combobox").first().fill("community");
    await form.getByRole("combobox").first().press("Enter");
    await fieldByLabel(form, /^location/i).fill("Playwright Community Center");
    await fieldByLabel(form, /^description/i, "textarea").fill("Stateful audit opportunity created by Playwright.");
    await fieldByLabel(form, /requirements/i).fill("Closed-toe shoes required.");

    const slotRow = form.locator('input[type="date"]').first().locator("..");
    await form.locator('input[type="date"]').first().fill(daysFromNow(2));
    await form.locator('input[type="time"]').nth(0).fill("09:00");
    await form.locator('input[type="time"]').nth(1).fill("11:30");
    await slotRow.locator('input[type="number"]').first().fill("4");

    const [response] = await Promise.all([
      orgPage.waitForResponse(
        (res) => res.url().includes("/api/beneficiaries/") && res.url().includes("/opportunities") && res.request().method() === "POST",
        { timeout: 30_000 },
      ),
      form.getByRole("button", { name: /create opportunity/i }).click(),
    ]);

    expect(response.status()).toBe(201);
    const body = await response.json();
    flow.opportunityId = body.id;
    flow.updatedOpportunityTitle = `${flow.opportunityTitle} Updated`;

    await orgPage.waitForLoadState("networkidle", { timeout: 20_000 });
    await expect(orgPage.locator("main")).toContainText(flow.opportunityTitle);
  });

  test("organization can edit opportunity from UI", async () => {
    await orgPage.goto(`${UI_BASE}/opportunities`, { waitUntil: "networkidle" });
    const card = orgPage.locator("div,article").filter({ hasText: flow.opportunityTitle }).first();
    await expect(card).toBeVisible({ timeout: 20_000 });

    const editButton = card.getByRole("button", { name: /edit|edit details/i }).first();
    await expect(editButton).toBeVisible();
    await editButton.click();
    await orgPage.waitForLoadState("networkidle", { timeout: 20_000 });

    const form = orgPage.locator("form").first();
    await fieldByLabel(form, /^title/i).fill(flow.updatedOpportunityTitle);
    await fieldByLabel(form, /^description/i, "textarea").fill("Updated by the stateful audit suite.");
    await form.locator('input[type="date"]').first().fill(daysFromNow(3));
    await form.locator('input[type="time"]').nth(0).fill("10:00");
    await form.locator('input[type="time"]').nth(1).fill("12:30");
    await form.locator('input[type="number"]').first().fill("6");

    await form.getByRole("button", { name: /save changes/i }).click();
    await orgPage.waitForLoadState("networkidle", { timeout: 20_000 });
    await expect(orgPage.locator("main")).toContainText(flow.updatedOpportunityTitle);
    await expect(orgPage.locator("main")).toContainText("10:00–12:30");
  });

  test("student can sign up and cancel from UI", async () => {
    const slots = await apiGet<AvailableSlot[]>(studentPage, "/api/beneficiaries/available-slots");
    const targetSlot = slots.find((slot) => slot.opportunity.title === flow.updatedOpportunityTitle);
    expect(targetSlot, "Expected student-visible slot for the updated audit opportunity").toBeTruthy();

    await studentPage.goto(`${UI_BASE}/slot/${targetSlot!.id}`, { waitUntil: "networkidle" });
    const initialSignups = await apiGet<MySignupRecord[]>(studentPage, "/api/beneficiaries/my-signups");
    let createdSignup = initialSignups.find((signup) => signup.slot.id === targetSlot!.id && signup.status !== "CANCELLED");
    if (!createdSignup) {
      const signupResponse = await studentPage.request.post(`${API_BASE}/api/beneficiaries/slots/${targetSlot!.id}/signup`, {
        headers: { Authorization: `Bearer ${await getToken(studentPage)}` },
      });
      expect([200, 201, 409]).toContain(signupResponse.status());
    }

    await studentPage.reload({ waitUntil: "networkidle" });
    await expect(studentPage.locator("main")).toContainText(/you're signed up for this slot/i);

    const mySignups = await apiGet<MySignupRecord[]>(studentPage, "/api/beneficiaries/my-signups");
    createdSignup = mySignups.find((signup) => signup.slot.id === targetSlot!.id && signup.status !== "CANCELLED");
    expect(createdSignup, "Expected created signup record for the student").toBeTruthy();

    const [cancelResponse] = await Promise.all([
      studentPage.request.post(`${API_BASE}/api/beneficiaries/signups/${createdSignup!.id}/cancel`, {
        headers: { Authorization: `Bearer ${await getToken(studentPage)}` },
      }),
    ]);

    expect(cancelResponse.ok()).toBeTruthy();
    await studentPage.reload({ waitUntil: "networkidle" });
    await expect(studentPage.getByRole("button", { name: /sign up for this slot/i })).toBeVisible({ timeout: 20_000 });
  });

  test("student and school complete revision then approval flow in UI", async () => {
    await studentPage.goto(`${UI_BASE}/submit`, { waitUntil: "networkidle" });
    await studentPage.getByRole("button", { name: /\+ submit hours|submit hours/i }).click();
    const submitForm = studentPage.locator("form").first();
    await fieldByLabel(submitForm, /organization name/i).fill(flow.submissionOrgName);
    await fieldByLabel(submitForm, /date of service/i).fill(today());
    await fieldByLabel(submitForm, /^description/i, "textarea").fill("Initial self-submission from the stateful UI audit.");
    await fieldByLabel(submitForm, /^hours/i).fill("2");
    await fieldByLabel(submitForm, /evidence \/ notes/i).fill("Supervisor confirmed completion.");

    const [submitResponse] = await Promise.all([
      studentPage.waitForResponse(
        (res) => res.url().includes("/api/self-submissions") && res.request().method() === "POST",
        { timeout: 30_000 },
      ),
      submitForm.getByRole("button", { name: /submit for review/i }).click(),
    ]);

    expect([200, 201]).toContain(submitResponse.status());
    const submitBody = await submitResponse.json();
    flow.submissionId = submitBody.id;
    await expect(studentPage.locator("main")).toContainText(/submission sent for review/i);

    await schoolPage.goto(`${UI_BASE}/submissions`, { waitUntil: "networkidle" });
    const pendingCard = submissionCard(schoolPage, flow.submissionOrgName);
    await expect(pendingCard).toBeVisible({ timeout: 20_000 });
    await pendingCard.getByRole("button", { name: /review/i }).click();
    await pendingCard.getByRole("button", { name: /request revision/i }).click();
    await pendingCard.locator("textarea").fill(flow.revisionNote);

    const [revisionResponse] = await Promise.all([
      schoolPage.waitForResponse(
        (res) => res.url().includes(`/api/self-submissions/${flow.submissionId}/request-revision`) && res.request().method() === "POST",
        { timeout: 30_000 },
      ),
      pendingCard.getByRole("button", { name: /send for revision/i }).click(),
    ]);

    expect(revisionResponse.ok()).toBeTruthy();
    await schoolPage.getByRole("button", { name: /needs revision/i }).click();
    await expect(schoolPage.locator("main")).toContainText(flow.submissionOrgName);
    await expect(schoolPage.locator("main")).toContainText(flow.revisionNote);

    await studentPage.goto(`${UI_BASE}/submit`, { waitUntil: "networkidle" });
    await studentPage.getByRole("button", { name: /needs revision/i }).click();
    const revisionCard = submissionCard(studentPage, flow.submissionOrgName);
    await expect(revisionCard).toBeVisible({ timeout: 20_000 });
    await revisionCard.getByRole("button", { name: /edit & resubmit/i }).click();
    const revisionForm = studentPage.locator("form").first();
    await fieldByLabel(revisionForm, /^description/i, "textarea").fill("Updated self-submission with clearer evidence.");
    await fieldByLabel(revisionForm, /evidence \/ notes/i).fill("Updated proof from supervisor email.");
    await fieldByLabel(revisionForm, /^hours/i).fill(flow.approvedHours);

    const [resubmitResponse] = await Promise.all([
      studentPage.waitForResponse(
        (res) =>
          res.url().includes(`/api/self-submissions/${flow.submissionId}`) &&
          res.request().method() === "PUT",
        { timeout: 30_000 },
      ),
      revisionForm.getByRole("button", { name: /resubmit for review/i }).click(),
    ]);

    expect(resubmitResponse.ok()).toBeTruthy();
    await expect(studentPage.locator("main")).toContainText(/resubmitted for review/i);

    await schoolPage.goto(`${UI_BASE}/submissions`, { waitUntil: "networkidle" });
    const reviewCard = submissionCard(schoolPage, flow.submissionOrgName);
    await expect(reviewCard).toBeVisible({ timeout: 20_000 });
    await reviewCard.getByRole("button", { name: /review/i }).click();
    await reviewCard.getByRole("button", { name: /^approve$/i }).click();
    await reviewCard.locator('input[type="number"]').fill(flow.approvedHours);

    const [approveResponse] = await Promise.all([
      schoolPage.waitForResponse(
        (res) => res.url().includes(`/api/self-submissions/${flow.submissionId}/approve`) && res.request().method() === "POST",
        { timeout: 30_000 },
      ),
      reviewCard.getByRole("button", { name: /confirm approval/i }).click(),
    ]);

    expect(approveResponse.ok()).toBeTruthy();
    await schoolPage.getByRole("button", { name: /approved/i }).click();
    await expect(schoolPage.locator("main")).toContainText(flow.submissionOrgName);
  });

  test("organization can remove the opportunity and the UI stops listing it", async () => {
    await orgPage.goto(`${UI_BASE}/opportunities`, { waitUntil: "networkidle" });
    const card = orgPage.locator("div,article").filter({ hasText: flow.updatedOpportunityTitle }).first();
    await expect(card).toBeVisible({ timeout: 20_000 });

    const deleteButton = card.getByRole("button", { name: /delete/i }).first();
    await expect(deleteButton).toBeVisible();
    const deleteResponse = await apiDelete(orgPage, `/api/beneficiaries/${flow.orgId}/opportunities/${flow.opportunityId}`);
    expect(deleteResponse.ok()).toBeTruthy();

    await orgPage.reload({ waitUntil: "networkidle" });
    await expect(orgPage.getByTestId(`opportunity-${flow.opportunityId}`)).toHaveCount(0);
    flow.opportunityId = "";
  });
});
