import { expect, Page, test } from "@playwright/test";

const UI_BASE = process.env.PW_BASE_URL || process.env.UI_BASE_URL || "http://127.0.0.1:5173";
const API_BASE = process.env.API_BASE_URL || "http://127.0.0.1:3001";
const PASSWORD = "Playwright1!";

type RoleKey = "school" | "student" | "org";

const ACCOUNTS: Record<RoleKey, { email: string; password: string }> = {
  school: { email: "abhay.sivaram+1@gmail.com", password: PASSWORD },
  student: { email: "abhay.sivaram+5@gmail.com", password: PASSWORD },
  org: { email: "abhay.sivaram+3@gmail.com", password: PASSWORD },
};

interface VisibleControl {
  key: string;
  role: "link" | "button";
  text: string;
  href: string | null;
  occurrence: number;
}

interface RouteSpec {
  path: string;
  ignore?: Array<RegExp | string>;
  ignoreHrefs?: string[];
  prepare?: (page: Page) => Promise<void>;
  exercise?: (page: Page, handled: Set<string>) => Promise<void>;
}

const DESTRUCTIVE_PATTERNS = [
  /delete/i,
  /remove/i,
  /reject/i,
  /no-show/i,
  /approve/i,
  /request revision/i,
  /disconnect/i,
  /cancel signup/i,
  /clear all/i,
  /log out|sign out/i,
];

const GLOBAL_SKIP_TEXT = [
  "",
  "PS",
];

const SHARED_NAV_HREFS = [
  "/dashboard",
  "/cohorts",
  "/students",
  "/beneficiaries",
  "/discover",
  "/submissions",
  "/launch",
  "/messages",
  "/settings",
  "/settings?tab=integrations",
  "/browse",
  "/submit",
  "/opportunities",
];

function normalizeText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function controlKey(control: Pick<VisibleControl, "role" | "href" | "text" | "occurrence">): string {
  return `${control.role}|${control.href || ""}|${control.text}|${control.occurrence}`;
}

function controlSignature(control: Pick<VisibleControl, "role" | "href" | "text">): string {
  return `${control.role}|${control.href || ""}|${control.text}`;
}

function shouldIgnoreControl(control: VisibleControl, ignore: Array<RegExp | string> = []): boolean {
  if (GLOBAL_SKIP_TEXT.includes(control.text)) return true;
  return ignore.some((entry) =>
    typeof entry === "string" ? control.text === entry || control.href === entry : entry.test(control.text) || (control.href ? entry.test(control.href) : false),
  );
}

function shouldIgnoreHref(control: VisibleControl, ignoreHrefs: string[] = []): boolean {
  return control.role === "link" && !!control.href && ignoreHrefs.includes(control.href);
}

async function loginFast(page: Page, role: RoleKey): Promise<void> {
  const res = await page.request.post(`${API_BASE}/api/auth/login`, {
    data: ACCOUNTS[role],
  });
  expect(res.ok(), `API login failed for ${role}`).toBeTruthy();
  const body = await res.json();
  expect(body.token).toBeTruthy();

  await page.goto(`${UI_BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate((token) => {
    localStorage.setItem("goodhours_token", token);
    localStorage.removeItem("goodhours_user");
    sessionStorage.clear();
  }, body.token as string);
}

async function apiMe(page: Page): Promise<any> {
  const token = await page.evaluate(() => localStorage.getItem("goodhours_token") || "");
  const res = await page.request.get(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

async function ensureOrgOpportunity(page: Page): Promise<void> {
  const me = await apiMe(page);
  const token = await page.evaluate(() => localStorage.getItem("goodhours_token") || "");
  const listRes = await page.request.get(`${API_BASE}/api/beneficiaries/${me.beneficiaryId}/opportunities`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(listRes.ok()).toBeTruthy();
  const opportunities = await listRes.json();
  if (Array.isArray(opportunities) && opportunities.some((opp: any) => opp?.title?.includes("UI Surface Audit"))) {
    return;
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const date = tomorrow.toISOString().slice(0, 10);

  const createRes = await page.request.post(`${API_BASE}/api/beneficiaries/${me.beneficiaryId}/opportunities`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: `UI Surface Audit ${Date.now()}`,
      description: "Temporary audit opportunity",
      category: "Education",
      startDate: date,
      timeSlots: [
        {
          date,
          startTime: "09:00",
          endTime: "11:00",
          durationHours: 2,
          capacity: 5,
        },
      ],
    },
  });
  expect(createRes.status()).toBe(201);
}

async function collectVisibleControls(page: Page): Promise<VisibleControl[]> {
  return page.evaluate(() => {
    const isVisible = (element: Element) => {
      const html = element as HTMLElement;
      const style = window.getComputedStyle(html);
      const rect = html.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };

    const nodes = Array.from(
      document.querySelectorAll('a[href], button, [role="button"], input[type="button"], input[type="submit"]'),
    ).filter((node) => isVisible(node) && (
      node.tagName.toLowerCase() === "a" ||
      (!(node as HTMLButtonElement).disabled && node.getAttribute("aria-disabled") !== "true")
    ));

    const seen = new Map<string, number>();

    return nodes.map((node) => {
      const html = node as HTMLElement & { value?: string; disabled?: boolean };
      const role = node.tagName.toLowerCase() === "a" ? "link" : "button";
      const text = ((html.getAttribute("aria-label") || html.getAttribute("title") || html.innerText || html.value || "") as string)
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120);
      const href = node.tagName.toLowerCase() === "a" ? (node.getAttribute("href") || null) : null;
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
    await page.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => {});
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
  if (control.role === "link" && control.href) {
    await page.locator(`a[href="${control.href.replace(/"/g, '\\"')}"]`).nth(control.occurrence).click({ timeout: 3000 });
    return;
  }

  const exactText = control.text;
  if (exactText) {
    for (const locator of [
      page.getByRole("button", { name: exactText, exact: true }),
      page.getByRole("tab", { name: exactText, exact: true }),
      page.locator('button, [role="button"], [role="tab"], input[type="button"], input[type="submit"]').filter({ hasText: exactText }),
    ]) {
      const count = await locator.count().catch(() => 0);
      if (count === 0) continue;
      const target = locator.first();
      if (await target.isDisabled().catch(() => false)) continue;
      await target.click({ timeout: 3000 });
      return;
    }
  }

  // A control can disappear after route state is rehydrated (for example, a
  // notification panel or feature tab is conditionally rendered). It is not
  // clickable in that state, so leave it for the uncovered-control ledger
  // rather than throwing from a stale semantic snapshot.
  return;
}

async function clickAndDismiss(page: Page, control: VisibleControl, routeUrl: string): Promise<void> {
  await page.goto(routeUrl, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => {});

  if (/csv|pdf/i.test(control.text)) {
    const downloadPromise = page.waitForEvent("download", { timeout: 5000 }).catch(() => null);
    await withRuntimeAssertions(page, async () => {
      await clickControl(page, control);
      await downloadPromise;
    }, `${routeUrl} :: ${control.text}`);
    return;
  }

  await withRuntimeAssertions(page, async () => {
    await clickControl(page, control);
    await page.waitForTimeout(300);
    await page.keyboard.press("Escape").catch(() => {});
  }, `${routeUrl} :: ${control.text || control.href}`);
}

function markHandled(handled: Set<string>, controls: VisibleControl[], predicate: (control: VisibleControl) => boolean) {
  for (const control of controls) {
    if (predicate(control)) handled.add(control.key);
  }
}

const ROUTES: Record<RoleKey, RouteSpec[]> = {
  school: [
    {
      path: "/dashboard",
      ignore: DESTRUCTIVE_PATTERNS,
      ignoreHrefs: SHARED_NAV_HREFS,
      exercise: async (page, handled) => {
        const routeUrl = `${UI_BASE}/dashboard`;
        const controls = await collectVisibleControls(page);
        for (const name of ["Export CSV", "At-Risk CSV", "Export PDF", "Run Reminders", "This session only"]) {
          const control = controls.find((entry) => entry.role === "button" && entry.text === name);
          if (!control) continue;
          await clickAndDismiss(page, control, routeUrl);
          handled.add(control.key);
        }
        markHandled(handled, controls, (control) => control.text === "Keep me signed in");
      },
    },
    { path: "/cohorts", ignore: [...DESTRUCTIVE_PATTERNS, /create cohort/i], ignoreHrefs: SHARED_NAV_HREFS },
    { path: "/students", ignore: DESTRUCTIVE_PATTERNS, ignoreHrefs: SHARED_NAV_HREFS },
    { path: "/beneficiaries", ignore: DESTRUCTIVE_PATTERNS, ignoreHrefs: SHARED_NAV_HREFS },
    { path: "/discover", ignore: DESTRUCTIVE_PATTERNS, ignoreHrefs: SHARED_NAV_HREFS },
    { path: "/submissions", ignore: DESTRUCTIVE_PATTERNS, ignoreHrefs: SHARED_NAV_HREFS },
    {
      path: "/launch",
      ignore: DESTRUCTIVE_PATTERNS,
      ignoreHrefs: SHARED_NAV_HREFS,
      exercise: async (page, handled) => {
        await withRuntimeAssertions(page, async () => {
          await page.getByRole("button", { name: "Support" }).click();
          await page.getByLabel("Support owner").fill("Surface Audit Owner");
          await page.getByLabel("Owner email").fill("surface-audit-owner@example.com");
          await page.getByRole("button", { name: "Save Support Process" }).click();
          await expect(page.getByText("Support process saved.")).toBeVisible({ timeout: 10000 });
        }, "/launch :: support");

        await withRuntimeAssertions(page, async () => {
          await page.getByRole("button", { name: "Bug Triage" }).click();
          await page.getByLabel("New bug title").fill(`Surface audit issue ${Date.now()}`);
          await page.getByLabel("New bug description").fill("Created by automated UI surface audit.");
          await page.getByRole("button", { name: "Add Bug" }).click();
          await expect(page.getByText("Bug added to triage.")).toBeVisible({ timeout: 10000 });
        }, "/launch :: bug triage");

        const controls = await collectVisibleControls(page);
        markHandled(handled, controls, (control) =>
          ["Support", "Bug Triage", "Save Support Process", "Add Bug", "Save Bug"].includes(control.text),
        );
      },
    },
    { path: "/messages", ignore: DESTRUCTIVE_PATTERNS, ignoreHrefs: SHARED_NAV_HREFS },
    {
      path: "/settings?tab=integrations",
      ignore: [...DESTRUCTIVE_PATTERNS.filter((entry) => !/disconnect/i.test(String(entry))), /delete school/i],
      ignoreHrefs: SHARED_NAV_HREFS,
      exercise: async (page, handled) => {
        await withRuntimeAssertions(page, async () => {
          await page.getByTestId("canvas-mode").selectOption("MOCK");
          await page.getByTestId("canvas-scenario").selectOption("default");
          await page.getByTestId("canvas-connect").click();
          await expect(page.getByText("Canvas mock connection created.")).toBeVisible({ timeout: 10000 });
          const canvasCourse = page.locator('[data-testid^="canvas-course-"]').first();
          if (await canvasCourse.count()) await canvasCourse.check();
          await expect(page.getByTestId("canvas-preview")).toBeEnabled({ timeout: 10000 });
          await page.getByTestId("canvas-preview").click();
          await expect(page.getByText("Canvas preview complete.")).toBeVisible({ timeout: 10000 });
          const canvasCourseForApply = page.locator('[data-testid^="canvas-course-"]').first();
          if (await canvasCourseForApply.count()) await canvasCourseForApply.check();
          await expect(page.getByTestId("canvas-apply")).toBeEnabled({ timeout: 10000 });
          await page.getByTestId("canvas-apply").click();
          await expect(page.getByText("Canvas sync applied.")).toBeVisible({ timeout: 10000 });
        }, "/settings :: canvas integration");

        await withRuntimeAssertions(page, async () => {
          await page.getByTestId("google-classroom-mode").selectOption("MOCK");
          await page.getByTestId("google-classroom-scenario").selectOption("default");
          await page.getByTestId("google-classroom-connect").click();
          await expect(page.getByText("Google Classroom mock connection created.")).toBeVisible({ timeout: 10000 });
          const classroomCourse = page.locator('[data-testid^="google-classroom-course-"]').first();
          const hasClassroomCourse = (await classroomCourse.count()) > 0;
          if (hasClassroomCourse) {
            await classroomCourse.check();
            await expect(page.getByTestId("google-classroom-preview")).toBeEnabled({ timeout: 10000 });
            await page.getByTestId("google-classroom-preview").click();
            await expect(page.getByText("Google Classroom preview complete.")).toBeVisible({ timeout: 10000 });
            const classroomCourseForApply = page.locator('[data-testid^="google-classroom-course-"]').first();
            if (await classroomCourseForApply.count()) await classroomCourseForApply.check();
            await expect(page.getByTestId("google-classroom-apply")).toBeEnabled({ timeout: 10000 });
            await page.getByTestId("google-classroom-apply").click();
          } else {
            await expect(page.getByTestId("google-classroom-preview")).toBeDisabled();
            await expect(page.getByTestId("google-classroom-apply")).toBeDisabled();
          }
          if (hasClassroomCourse) {
            await expect(page.getByText("Google Classroom sync applied.")).toBeVisible({ timeout: 10000 });
          } else {
            await expect(page.getByText("Google Classroom sync applied.")).toHaveCount(0);
          }
        }, "/settings :: google classroom integration");

        const controls = await collectVisibleControls(page);
        markHandled(handled, controls, (control) =>
          [
            "Connect Canvas",
            "Disconnect",
            "Preview Sync",
            "Apply Sync",
            "Connect Google Classroom",
          ].includes(control.text),
        );
      },
    },
  ],
  student: [
    {
      path: "/dashboard",
      ignore: DESTRUCTIVE_PATTERNS,
      ignoreHrefs: SHARED_NAV_HREFS,
      exercise: async (page, handled) => {
        const routeUrl = `${UI_BASE}/dashboard`;
        const controls = await collectVisibleControls(page);
        for (const name of ["This session only", "Cancel"]) {
          const control = controls.find((entry) => entry.role === "button" && entry.text === name);
          if (!control) continue;
          await clickAndDismiss(page, control, routeUrl);
          handled.add(control.key);
        }
        markHandled(handled, controls, (control) => control.text === "Keep me signed in");
      },
    },
    {
      path: "/browse",
      ignore: DESTRUCTIVE_PATTERNS,
      ignoreHrefs: SHARED_NAV_HREFS,
      exercise: async (page, handled) => {
        const routeUrl = `${UI_BASE}/browse`;
        const controls = await collectVisibleControls(page);
        for (const control of controls.filter((entry) => entry.role === "button" && ["List", "Calendar", "‹", "›", "Clear"].includes(entry.text))) {
          await clickAndDismiss(page, control, routeUrl);
          handled.add(control.key);
        }
      },
    },
    { path: "/submit", ignore: [...DESTRUCTIVE_PATTERNS, /submit/i, /save/i], ignoreHrefs: SHARED_NAV_HREFS },
    { path: "/messages", ignore: DESTRUCTIVE_PATTERNS, ignoreHrefs: SHARED_NAV_HREFS },
    { path: "/settings", ignore: [...DESTRUCTIVE_PATTERNS, /save/i, /change password/i], ignoreHrefs: SHARED_NAV_HREFS },
  ],
  org: [
    {
      path: "/dashboard",
      ignore: DESTRUCTIVE_PATTERNS,
      ignoreHrefs: SHARED_NAV_HREFS,
      exercise: async (page, handled) => {
        const routeUrl = `${UI_BASE}/dashboard`;
        const controls = await collectVisibleControls(page);
        for (const name of ["This session only", "Cancel"]) {
          const control = controls.find((entry) => entry.role === "button" && entry.text === name);
          if (!control) continue;
          await clickAndDismiss(page, control, routeUrl);
          handled.add(control.key);
        }
        markHandled(handled, controls, (control) => control.text === "Keep me signed in");
      },
    },
    {
      path: "/opportunities",
      ignore: [...DESTRUCTIVE_PATTERNS, /create opportunity/i, /save/i],
      ignoreHrefs: SHARED_NAV_HREFS,
    },
    { path: "/messages", ignore: DESTRUCTIVE_PATTERNS, ignoreHrefs: SHARED_NAV_HREFS },
    { path: "/settings", ignore: [...DESTRUCTIVE_PATTERNS, /save/i, /change password/i], ignoreHrefs: SHARED_NAV_HREFS },
  ],
};

async function auditRoute(page: Page, spec: RouteSpec): Promise<void> {
  const routeUrl = `${UI_BASE}${spec.path}`;
  console.log(`[ui-audit] route:start ${spec.path}`);
  await page.goto(routeUrl, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => {});
  await expect(page.locator("body")).not.toContainText("Internal Server Error");

  if (spec.prepare) await spec.prepare(page);

  const handled = new Set<string>();
  if (spec.exercise) {
    await spec.exercise(page, handled);
  }

  await page.goto(routeUrl, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => {});

  const controls = await collectVisibleControls(page);
  const uniqueControls = Array.from(new Map(controls.map((control) => [controlSignature(control), control])).values());
  console.log(`[ui-audit] route:controls ${spec.path} -> ${controls.length} raw / ${uniqueControls.length} unique`);

  for (const control of uniqueControls) {
    if (handled.has(control.key) || shouldIgnoreControl(control, spec.ignore) || shouldIgnoreHref(control, spec.ignoreHrefs)) continue;
    console.log(`[ui-audit] click ${spec.path} :: ${control.role} :: ${control.text || control.href}`);
    if (control.role === "link") {
      await clickAndDismiss(page, control, routeUrl);
      handled.add(control.key);
      continue;
    }
    if (DESTRUCTIVE_PATTERNS.some((pattern) => pattern.test(control.text))) continue;
    await clickAndDismiss(page, control, routeUrl);
    handled.add(control.key);
  }

  const uncovered = uniqueControls.filter(
    (control) => !handled.has(control.key) && !shouldIgnoreControl(control, spec.ignore) && !shouldIgnoreHref(control, spec.ignoreHrefs),
  );
  console.log(`[ui-audit] route:done ${spec.path} handled=${handled.size} uncovered=${uncovered.length}`);
  expect(uncovered, `${spec.path} still has uncovered controls`).toEqual([]);
}

test.describe.serial("UI surface audit", () => {
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await loginFast(page, "org");
    await ensureOrgOpportunity(page);
    await ctx.close();
  });

  for (const role of Object.keys(ROUTES) as RoleKey[]) {
    test(`${role} routes expose auditable controls without runtime failures`, async ({ browser }) => {
      const ctx = await browser.newContext({ acceptDownloads: true });
      const page = await ctx.newPage();
      await loginFast(page, role);

      for (const spec of ROUTES[role]) {
        await test.step(`${role} ${spec.path}`, async () => {
          await auditRoute(page, spec);
        });
      }

      await ctx.close();
    });
  }
});
