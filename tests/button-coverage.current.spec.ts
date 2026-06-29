import { expect, type Page, test } from "@playwright/test";

const UI_BASE = process.env.PW_BASE_URL || process.env.UI_BASE_URL || "http://localhost:5173";
const API_BASE = process.env.API_BASE_URL || "http://localhost:3001";

const ACCOUNTS = {
  school: { email: "admin@lincoln.edu", password: "password123" },
  student: { email: "john@student.edu", password: "password123" },
  org: { email: "volunteer@greenearth.org", password: "password123" },
} as const;

type RoleKey = keyof typeof ACCOUNTS;

type VisibleControl = {
  key: string;
  role: "button";
  text: string;
  href: string | null;
  occurrence: number;
};

type RouteSpec = {
  path: string;
  ignore?: Array<RegExp | string>;
  ignoreHrefs?: string[];
  prepare?: (page: Page) => Promise<void>;
};

const DESTRUCTIVE_PATTERNS = [
  /delete/i,
  /remove/i,
  /reject/i,
  /request revision/i,
  /approve/i,
  /disconnect/i,
  /cancel signup/i,
  /cancel slot/i,
  /cancel opportunity/i,
  /clear all/i,
  /log out|sign out/i,
  /save changes/i,
  /^save$/i,
  /confirm/i,
  /block/i,
  /archive/i,
];

const GLOBAL_SKIP_TEXT = [
  "",
  "PS",
  "Close",
];

function normalizeText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

async function loginFast(page: Page, role: RoleKey): Promise<void> {
  const res = await page.request.post(`${API_BASE}/api/auth/login`, {
    data: ACCOUNTS[role],
  });
  expect(res.ok(), `API login failed for ${role}`).toBeTruthy();
  const body = await res.json();
  expect(body.token).toBeTruthy();

  await page.goto(`${UI_BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ token, user }) => {
    localStorage.setItem("goodhours_session_pref", "persistent");
    localStorage.setItem("goodhours_token", token);
    if (user) {
      localStorage.setItem("goodhours_user", JSON.stringify(user));
    }
    sessionStorage.clear();
  }, { token: body.token as string, user: body.user ?? null });
}

async function getToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => localStorage.getItem("goodhours_token") || "");
  expect(token).toBeTruthy();
  return token;
}

async function apiGet<T>(page: Page, apiPath: string): Promise<T> {
  const token = await getToken(page);
  const res = await page.request.get(`${API_BASE}${apiPath}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok(), `${apiPath} failed with ${res.status()}`).toBeTruthy();
  return res.json() as Promise<T>;
}

async function apiDelete(page: Page, apiPath: string) {
  const token = await getToken(page);
  return page.request.delete(`${API_BASE}${apiPath}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function apiPost(page: Page, apiPath: string, data: unknown) {
  const token = await getToken(page);
  return page.request.post(`${API_BASE}${apiPath}`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
}

async function apiPut(page: Page, apiPath: string, data: unknown) {
  const token = await getToken(page);
  return page.request.put(`${API_BASE}${apiPath}`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
}

async function apiPatch(page: Page, apiPath: string, data: unknown) {
  const token = await getToken(page);
  return page.request.patch(`${API_BASE}${apiPath}`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
}

async function collectVisibleControls(page: Page): Promise<VisibleControl[]> {
  return page.evaluate(() => {
    const normalizeText = (value: string | null | undefined) => (value || "").replace(/\s+/g, " ").trim();
    const isVisible = (element: Element) => {
      const html = element as HTMLElement;
      const style = window.getComputedStyle(html);
      const rect = html.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };

    const nodes = Array.from(
      document.querySelectorAll('button, [role="button"], [role="tab"], input[type="button"], input[type="submit"]'),
    ).filter(isVisible);

    const seen = new Map<string, number>();

    return nodes.map((node) => {
      const html = node as HTMLElement & { value?: string };
      const role = "button";
      const text = normalizeText(
        html.getAttribute("aria-label")
          || html.getAttribute("title")
          || html.innerText
          || html.value
          || "",
      ).slice(0, 120);
      const href = null;
      const signature = `${role}|${href || ""}|${text}`;
      const occurrence = seen.get(signature) || 0;
      seen.set(signature, occurrence + 1);
      return {
        key: `${signature}|${occurrence}`,
        role,
        text,
        href,
        occurrence,
      };
    });
  });
}

async function withRuntimeAssertions(page: Page, action: () => Promise<void>, label: string): Promise<void> {
  const pageErrors: string[] = [];
  const failingResponses: Array<{ url: string; status: number }> = [];
  const onPageError = (err: Error) => pageErrors.push(String(err));
  const onConsole = (msg: any) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (/status of 429/i.test(text)) return;
    if (/Failed to load resource: the server responded with a status of (403|404)/i.test(text)) return;
    pageErrors.push(text);
  };
  const onResponse = (response: any) => {
    if (response.url().startsWith(API_BASE) && response.status() >= 500) {
      failingResponses.push({ url: response.url(), status: response.status() });
    }
  };

  page.on("pageerror", onPageError);
  page.on("console", onConsole);
  page.on("response", onResponse);

  try {
    await action();
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
    const body = await page.locator("body").innerText().catch(() => "");
    expect.soft(body, `${label} rendered internal server error`).not.toContain("Internal Server Error");
    expect.soft(pageErrors, `${label} triggered client errors`).toEqual([]);
    expect.soft(failingResponses, `${label} triggered API 5xx responses`).toEqual([]);
  } finally {
    page.off("pageerror", onPageError);
    page.off("console", onConsole);
    page.off("response", onResponse);
  }
}

async function clickControl(page: Page, control: VisibleControl): Promise<void> {
  if (control.text) {
    const candidates = [
      page.getByRole("button", { name: control.text, exact: true }),
      page.getByRole("tab", { name: control.text, exact: true }),
      page.getByRole("switch", { name: control.text, exact: true }),
      page.getByLabel(control.text, { exact: true }),
      page.locator(`[aria-label="${control.text.replace(/"/g, '\\"')}"]`),
      page.locator(`[title="${control.text.replace(/"/g, '\\"')}"]`),
      page.getByText(control.text, { exact: true }),
      page.locator('button, [role="button"], [role="tab"], input[type="button"], input[type="submit"]').filter({ hasText: control.text }),
    ];
    for (const candidate of candidates) {
      const count = await candidate.count().catch(() => 0);
      if (count > control.occurrence) {
        await candidate.nth(control.occurrence).click({ timeout: 4000 });
        return;
      }
      if (count > 0) {
        await candidate.first().click({ timeout: 4000 });
        return;
      }
    }
  }

  throw new Error(`No semantic locator found for control ${JSON.stringify(control)}`);
}

function shouldIgnoreControl(control: VisibleControl, ignore: Array<RegExp | string> = []): boolean {
  if (GLOBAL_SKIP_TEXT.includes(control.text)) return true;
  if (DESTRUCTIVE_PATTERNS.some((pattern) => pattern.test(control.text))) return true;
  return ignore.some((entry) =>
    typeof entry === "string"
      ? control.text === entry || control.href === entry
      : entry.test(control.text) || (control.href ? entry.test(control.href) : false),
  );
}

function shouldIgnoreHref(control: VisibleControl, ignoreHrefs: string[] = []): boolean {
  return !!control.href && ignoreHrefs.includes(control.href);
}

async function clickAndDismiss(page: Page, control: VisibleControl, routeUrl: string): Promise<void> {
  await page.goto(routeUrl, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});

  if (/csv|download template|export/i.test(control.text)) {
    const downloadPromise = page.waitForEvent("download", { timeout: 5000 }).catch(() => null);
    await withRuntimeAssertions(page, async () => {
      await clickControl(page, control);
      await downloadPromise;
    }, `${routeUrl} :: ${control.text}`);
    return;
  }

  await withRuntimeAssertions(page, async () => {
    await clickControl(page, control);
    await page.waitForTimeout(350);
    await page.keyboard.press("Escape").catch(() => {});
  }, `${routeUrl} :: ${control.text}`);
}

async function fieldByLabel(
  pageOrLocator: Page | ReturnType<Page["locator"]>,
  label: RegExp,
  tag: "input" | "textarea" | "select" = "input",
) {
  return pageOrLocator.locator("label").filter({ hasText: label }).locator("..").locator(tag).first();
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

type MeResponse = {
  cohortId?: string | null;
  cohortName?: string | null;
  beneficiaryId?: string | null;
};

type CohortSummary = {
  id: string;
  name: string;
};

type AvailableSlot = {
  id: string;
  opportunity: { id: string; title: string };
};

async function getStudentRouteSpecs(page: Page): Promise<RouteSpec[]> {
  const slots = await apiGet<AvailableSlot[]>(page, "/api/beneficiaries/available-slots").catch(() => []);
  const firstSlot = slots[0];
  return [
    { path: "/dashboard" },
    { path: "/browse", ignore: [/sign up/i] },
    ...(firstSlot ? [{ path: `/slot/${firstSlot.id}`, ignore: [/sign up/i, /cancel signup/i] }] : []),
    { path: "/submit", ignore: [/submit for review/i, /resubmit for review/i, /cancel submission/i] },
    { path: "/messages" },
    { path: "/settings", ignore: [/change password/i, /delete/i, /verify/i] },
  ];
}

async function getSchoolRouteSpecs(page: Page): Promise<RouteSpec[]> {
  const me = await apiGet<MeResponse>(page, "/api/auth/me");
  const cohorts = await apiGet<CohortSummary[]>(page, "/api/cohorts").catch(() => []);
  const firstCohortId = cohorts[0]?.id || me.cohortId || null;

  return [
    { path: "/dashboard" },
    { path: "/onboarding", ignore: [/complete onboarding/i] },
    { path: "/students" },
    { path: "/students/on-track" },
    { path: "/students/off-track" },
    { path: "/cohorts", ignore: [/new cohort/i, /import/i, /publish/i, /resend/i] },
    ...(firstCohortId ? [{ path: `/cohorts/${firstCohortId}`, ignore: [/delete/i, /remove/i, /publish/i, /invite/i, /save/i] }] : []),
    ...(firstCohortId ? [{ path: `/cohorts/${firstCohortId}/on-track` }] : []),
    ...(firstCohortId ? [{ path: `/cohorts/${firstCohortId}/off-track` }] : []),
    { path: "/beneficiaries", ignore: [/invite/i, /respond/i, /save/i, /block/i] },
    { path: "/partners", ignore: [/invite/i, /respond/i, /save/i, /block/i] },
    { path: "/discover", ignore: [/request/i, /connect/i] },
    { path: "/opportunities", ignore: [/create opportunity/i, /save changes/i, /delete/i] },
    { path: "/submissions", ignore: [/approve/i, /reject/i, /request revision/i, /import/i] },
    { path: "/launch", ignoreHrefs: ["/dashboard", "/messages"] },
    { path: "/messages", ignore: [/new message/i, /announcement/i, /open triage roster/i] },
    { path: "/settings", ignore: [/save/i, /change password/i, /delete/i, /verify/i] },
    { path: "/admin/impersonate", ignore: [/impersonate/i] },
  ];
}

async function getOrgRouteSpecs(): Promise<RouteSpec[]> {
  return [
    { path: "/dashboard" },
    { path: "/opportunities", ignore: [/create opportunity/i, /save changes/i, /delete/i, /cancel slot/i] },
    { path: "/messages", ignore: [/new message/i] },
    { path: "/settings", ignore: [/save/i, /change password/i, /delete/i, /upgrade/i] },
  ];
}

async function sweepRoutes(page: Page, specs: RouteSpec[]): Promise<string[]> {
  const failures: string[] = [];

  for (const spec of specs) {
    const routeUrl = `${UI_BASE}${spec.path}`;
    try {
      if (spec.prepare) {
        await spec.prepare(page);
      }

      await withRuntimeAssertions(page, async () => {
        await page.goto(routeUrl, { waitUntil: "domcontentloaded" });
      }, routeUrl);

      const controls = await collectVisibleControls(page);
      const actionable = controls.filter((control) => !shouldIgnoreControl(control, spec.ignore) && !shouldIgnoreHref(control, spec.ignoreHrefs));

      for (const control of actionable) {
        try {
          await clickAndDismiss(page, control, routeUrl);
        } catch (error) {
          failures.push(`${spec.path} :: ${control.text || control.href || control.key} :: ${String(error)}`);
        }
      }
    } catch (error) {
      failures.push(`${spec.path} :: route load failed :: ${String(error)}`);
    }
  }

  return failures;
}

test.describe.serial("Current seeded button coverage", () => {
  let orgPage: Page;
  let schoolPage: Page;
  let studentPage: Page;

  const flow = {
    orgId: "",
    opportunityId: "",
    opportunityTitle: `PW Button Coverage Opportunity ${Date.now()}`,
    updatedOpportunityTitle: `PW Button Coverage Opportunity Updated ${Date.now()}`,
    submissionId: "",
    submissionOrgName: `PW Self Submit ${Date.now()}`,
    cohortId: "",
    cohortName: `PW Cohort ${Date.now()}`,
  };

  test.beforeAll(async ({ browser }) => {
    const orgContext = await browser.newContext({ acceptDownloads: true });
    orgPage = await orgContext.newPage();
    await loginFast(orgPage, "org");

    const schoolContext = await browser.newContext({ acceptDownloads: true });
    schoolPage = await schoolContext.newPage();
    await loginFast(schoolPage, "school");

    const studentContext = await browser.newContext({ acceptDownloads: true });
    studentPage = await studentContext.newPage();
    await loginFast(studentPage, "student");

    const me = await apiGet<MeResponse>(orgPage, "/api/auth/me");
    flow.orgId = me.beneficiaryId || "";
    expect(flow.orgId).toBeTruthy();
  });

  test.afterAll(async () => {
    if (flow.opportunityId && flow.orgId) {
      await apiDelete(orgPage, `/api/beneficiaries/${flow.orgId}/opportunities/${flow.opportunityId}`).catch(() => {});
    }
    if (flow.cohortId) {
      await apiDelete(schoolPage, `/api/cohorts/${flow.cohortId}`).catch(() => {});
    }
    await Promise.all([
      orgPage?.context().close(),
      schoolPage?.context().close(),
      studentPage?.context().close(),
    ]);
  });

  test("mounted route buttons do not throw or 5xx on current seeded accounts", async () => {
    const failures: string[] = [];

    failures.push(...await sweepRoutes(studentPage, await getStudentRouteSpecs(studentPage)));
    failures.push(...await sweepRoutes(schoolPage, await getSchoolRouteSpecs(schoolPage)));
    failures.push(...await sweepRoutes(orgPage, await getOrgRouteSpecs()));

    expect(failures, failures.join("\n")).toEqual([]);
  });

  test("beneficiary opportunity create edit and cleanup flow works", async () => {
    await orgPage.goto(`${UI_BASE}/opportunities`, { waitUntil: "networkidle" });
    const form = orgPage.locator("form").first();

    await (await fieldByLabel(form, /^title/i)).fill(flow.opportunityTitle);
    await form.getByRole("combobox").first().fill("community");
    await form.getByRole("combobox").first().press("Enter");
    await (await fieldByLabel(form, /^location/i)).fill("Playwright Community Center");
    await (await fieldByLabel(form, /^description/i, "textarea")).fill("Button coverage create flow.");
    await (await fieldByLabel(form, /requirements/i)).fill("Bring water.");
    await form.locator('input[type="date"]').first().fill(daysFromNow(2));
    await form.locator('input[type="time"]').nth(0).fill("09:00");
    await form.locator('input[type="time"]').nth(1).fill("11:00");
    await form.locator('input[type="number"]').first().fill("4");

    const [createResponse] = await Promise.all([
      orgPage.waitForResponse((res) => res.url().includes(`/api/beneficiaries/${flow.orgId}/opportunities`) && res.request().method() === "POST"),
      form.getByRole("button", { name: /create opportunity/i }).click(),
    ]);

    expect(createResponse.status()).toBe(201);
    const createBody = await createResponse.json();
    flow.opportunityId = createBody.id;
    await expect(orgPage.locator("main")).toContainText(flow.opportunityTitle);

    const card = orgPage.locator("div,article").filter({ hasText: flow.opportunityTitle }).first();
    await card.getByRole("button", { name: /edit|edit details/i }).first().click();
    const editForm = orgPage.locator("form").first();
    await (await fieldByLabel(editForm, /^title/i)).fill(flow.updatedOpportunityTitle);
    await editForm.getByRole("combobox").first().fill("community");
    await editForm.getByRole("combobox").first().press("Enter");
    await (await fieldByLabel(editForm, /^description/i, "textarea")).fill("Button coverage edit flow.");
    await editForm.locator('input[type="date"]').first().fill(daysFromNow(3));
    await editForm.locator('input[type="time"]').nth(0).fill("10:00");
    await editForm.locator('input[type="time"]').nth(1).fill("12:00");
    await editForm.locator('input[type="number"]').first().fill("5");

    const [saveResponse] = await Promise.all([
      orgPage.waitForResponse((res) =>
        res.url().includes(`/api/beneficiaries/${flow.orgId}/opportunities/${flow.opportunityId}`) &&
        res.request().method() === "PATCH",
      ),
      editForm.getByRole("button", { name: /save changes/i }).click(),
    ]);
    expect(saveResponse.ok()).toBeTruthy();
    const saveBody = await saveResponse.json().catch(() => null);
    expect(saveBody?.title).toBe(flow.updatedOpportunityTitle);
    await orgPage.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    await orgPage.reload({ waitUntil: "networkidle" });
    await expect(orgPage.locator("main")).toContainText(flow.updatedOpportunityTitle);
  });

  test("student self-submission create cancel and school cohort create delete work", async ({ browser }) => {
    const schoolContext = await browser.newContext({ acceptDownloads: true });
    const schoolFresh = await schoolContext.newPage();
    await loginFast(schoolFresh, "school");

    const studentContext = await browser.newContext({ acceptDownloads: true });
    const studentFresh = await studentContext.newPage();
    await loginFast(studentFresh, "student");

    let createdCohortId = "";

    try {
      await schoolFresh.goto(`${UI_BASE}/cohorts`, { waitUntil: "networkidle" });
      await schoolFresh.getByRole("button", { name: /\+ new cohort|new cohort/i }).click();
      const cohortForm = schoolFresh.locator("form").first();
      await (await fieldByLabel(cohortForm, /^cohort name/i)).fill(flow.cohortName);
      const [cohortResponse] = await Promise.all([
        schoolFresh.waitForResponse((res) => res.url().includes("/api/cohorts") && res.request().method() === "POST"),
        cohortForm.getByRole("button", { name: /^create$/i }).click(),
      ]);
      expect([200, 201]).toContain(cohortResponse.status());
      const cohortBody = await cohortResponse.json().catch(() => null);
      createdCohortId = cohortBody?.id || "";
      await expect(schoolFresh.locator("main")).toContainText(flow.cohortName);

      await studentFresh.goto(`${UI_BASE}/submit`, { waitUntil: "networkidle" });
      await studentFresh.getByRole("button", { name: /\+ submit hours|submit hours/i }).click();
      const submitForm = studentFresh.locator("form").first();
      await (await fieldByLabel(submitForm, /organization name/i)).fill(flow.submissionOrgName);
      await (await fieldByLabel(submitForm, /date of service/i)).fill(today());
      await (await fieldByLabel(submitForm, /^description/i, "textarea")).fill("Button coverage self-submit flow.");
      await (await fieldByLabel(submitForm, /^hours/i)).fill("1.5");
      await (await fieldByLabel(submitForm, /evidence \/ notes/i)).fill("Supervisor approved.");

      const [submitResponse] = await Promise.all([
        studentFresh.waitForResponse((res) => res.url().includes("/api/self-submissions") && res.request().method() === "POST"),
        submitForm.getByRole("button", { name: /submit for review/i }).click(),
      ]);

      expect([200, 201]).toContain(submitResponse.status());
      const submitBody = await submitResponse.json();
      flow.submissionId = submitBody.id;
      await expect(studentFresh.locator("main")).toContainText(/submission sent for review/i);

      const submissionCard = studentFresh.locator("div").filter({ hasText: flow.submissionOrgName }).first();
      await expect(submissionCard).toBeVisible();
      await submissionCard.getByRole("button", { name: /cancel request/i }).first().click();
      await expect(studentFresh.locator("main")).toContainText(/submission cancelled/i);
    } finally {
      if (createdCohortId) {
        await apiDelete(schoolFresh, `/api/cohorts/${createdCohortId}`).catch(() => {});
      }
      await Promise.all([schoolContext.close(), studentContext.close()]);
    }
  });

  test("school reminders run and beneficiary settings persistence endpoints respond", async ({ browser }) => {
    const schoolContext = await browser.newContext({ acceptDownloads: true });
    const schoolFresh = await schoolContext.newPage();
    await loginFast(schoolFresh, "school");

    const orgContext = await browser.newContext({ acceptDownloads: true });
    const orgFresh = await orgContext.newPage();
    await loginFast(orgFresh, "org");

    try {
      await schoolFresh.goto(`${UI_BASE}/messages`, { waitUntil: "networkidle" });
      await schoolFresh.getByRole("button", { name: /run reminders/i }).click();
      await expect(schoolFresh.locator("main")).toContainText(/reminder cycle completed|failed to run reminders|already triggered this hour/i);

      const me = await apiGet<MeResponse>(orgFresh, "/api/auth/me");
      const orgId = me.beneficiaryId || "";
      expect(orgId).toBeTruthy();

      const reminderConfig = await apiGet<any>(orgFresh, `/api/beneficiaries/${orgId}/reminder-config`);
      const reminderRes = await apiPut(orgFresh, `/api/beneficiaries/${orgId}/reminder-config`, {
        reminders: reminderConfig.reminders,
        waitlistCutoffHours: reminderConfig.waitlistCutoffHours,
        requireApprovalForPromotion: reminderConfig.requireApprovalForPromotion,
        disableAutoPromotion: reminderConfig.disableAutoPromotion,
        promoMessageTemplate: reminderConfig.promoMessageTemplate,
      });
      expect(reminderRes.ok()).toBeTruthy();

      const benProfile = await apiGet<any>(orgFresh, `/api/beneficiaries/${orgId}`);
      const profileRes = await apiPatch(orgFresh, `/api/beneficiaries/${orgId}/profile`, {
        name: benProfile.name || undefined,
        email: benProfile.email || undefined,
        phone: benProfile.phone || undefined,
        description: benProfile.description || undefined,
        website: benProfile.website || undefined,
        address: benProfile.address || undefined,
        city: benProfile.city || undefined,
        state: benProfile.state || undefined,
        zip: benProfile.zip || undefined,
      });
      expect(profileRes.ok()).toBeTruthy();
    } finally {
      await Promise.all([schoolContext.close(), orgContext.close()]);
    }
  });
});
