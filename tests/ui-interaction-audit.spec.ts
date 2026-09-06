import { expect, Page, test } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const UI_BASE = process.env.PW_BASE_URL || process.env.UI_BASE_URL || "http://localhost:5173";
const API_BASE = process.env.API_BASE_URL || "http://localhost:3001";
const PASSWORD = "Playwright1!";
const FIXTURES_DIR = `${process.cwd()}/tests/artifacts/fixtures`;
const AUTH_CACHE_DIR = path.join(process.cwd(), "tests", ".auth", "ui-audit");
const ACCOUNT_FILTER = process.env.UI_AUDIT_ACCOUNT || "";
const ROUTE_FILTER = process.env.UI_AUDIT_ROUTE || "";

type AccountKey =
  | "schoolA"
  | "schoolB"
  | "orgA"
  | "orgB"
  | "student1"
  | "student2"
  | "student3";

type RoleKind = "school" | "org" | "student";

interface AccountSpec {
  key: AccountKey;
  role: RoleKind;
  email: string;
  password: string;
  expectedTexts: string[];
}

interface CachedAuthSession {
  token: string;
  user?: unknown;
}

interface RouteSpec {
  id: string;
  path: string;
  role: RoleKind;
  prepare?: (page: Page) => Promise<void>;
  exercise?: (page: Page) => Promise<void>;
  skipControls?: RegExp[];
  skipFields?: RegExp[];
}

interface VisibleControl {
  key: string;
  role: "link" | "button";
  text: string;
  href: string | null;
}

interface VisibleField {
  key: string;
  tag: "input" | "select" | "textarea";
  type: string;
  label: string;
  placeholder: string;
  name: string;
  id: string;
  value: string;
  checked: boolean;
  accept: string;
}

const ACCOUNTS: AccountSpec[] = [
  {
    key: "schoolA",
    role: "school",
    email: "abhay.sivaram+1@gmail.com",
    password: PASSWORD,
    expectedTexts: ["PW School Admin A"],
  },
  {
    key: "schoolB",
    role: "school",
    email: "abhay.sivaram+2@gmail.com",
    password: PASSWORD,
    expectedTexts: ["PW School Admin B"],
  },
  {
    key: "orgA",
    role: "org",
    email: "abhay.sivaram+3@gmail.com",
    password: PASSWORD,
    expectedTexts: ["PW Org Admin A"],
  },
  {
    key: "orgB",
    role: "org",
    email: "abhay.sivaram+4@gmail.com",
    password: PASSWORD,
    expectedTexts: ["PW Org Admin B"],
  },
  {
    key: "student1",
    role: "student",
    email: "abhay.sivaram+5@gmail.com",
    password: PASSWORD,
    expectedTexts: ["PW Student 1"],
  },
  {
    key: "student2",
    role: "student",
    email: "abhay.sivaram+6@gmail.com",
    password: PASSWORD,
    expectedTexts: ["PW Student 2"],
  },
  {
    key: "student3",
    role: "student",
    email: "abhay.sivaram+7@gmail.com",
    password: PASSWORD,
    expectedTexts: ["PW Student 3"],
  },
];

const GLOBAL_SKIP_CONTROLS = [
  /delete/i,
  /remove/i,
  /reject/i,
  /approve/i,
  /disconnect/i,
  /no-show/i,
  /request revision/i,
  /sign out|log out/i,
  /leave classroom/i,
  /delete account/i,
  /transfer ownership/i,
  /^settings$/i,
  /^open notifications$/i,
  /^notifications$/i,
];

const GLOBAL_SKIP_FIELDS = [
  /^$/,
  /search/i,
];

const ROLE_ROUTES: Record<RoleKind, RouteSpec[]> = {
  school: [
    { id: "school-dashboard", path: "/dashboard", role: "school" },
    { id: "school-cohorts", path: "/cohorts", role: "school" },
    { id: "school-students", path: "/students", role: "school" },
    { id: "school-beneficiaries", path: "/beneficiaries", role: "school" },
    { id: "school-discover", path: "/discover", role: "school" },
    { id: "school-submissions", path: "/submissions", role: "school" },
    { id: "school-launch-monitoring", path: "/launch", role: "school", prepare: async (page) => clickIfVisible(page, "button:has-text('Monitoring')") },
    { id: "school-launch-onboarding", path: "/launch", role: "school", prepare: async (page) => clickIfVisible(page, "button:has-text('Onboarding')") },
    { id: "school-launch-support", path: "/launch", role: "school", prepare: async (page) => clickIfVisible(page, "button:has-text('Support')") },
    { id: "school-launch-rollback", path: "/launch", role: "school", prepare: async (page) => clickIfVisible(page, "button:has-text('Rollback')") },
    { id: "school-launch-bugs", path: "/launch", role: "school", prepare: async (page) => clickIfVisible(page, "button:has-text('Bug Triage')") },
    { id: "school-messages", path: "/messages", role: "school" },
    { id: "school-settings-profile", path: "/settings", role: "school", prepare: async (page) => clickIfVisible(page, "button:has-text('Profile')") },
    { id: "school-settings-rules", path: "/settings", role: "school", prepare: async (page) => clickIfVisible(page, "button:has-text('Rules')") },
    { id: "school-settings-security", path: "/settings", role: "school", prepare: async (page) => clickIfVisible(page, "button:has-text('Security')") },
    { id: "school-settings-notifications", path: "/settings", role: "school", prepare: async (page) => clickIfVisible(page, "button:has-text('Notifications')") },
    { id: "school-settings-privacy", path: "/settings", role: "school", prepare: async (page) => clickIfVisible(page, "button:has-text('Privacy')") },
    { id: "school-settings-integrations", path: "/settings?tab=integrations", role: "school" },
    { id: "school-settings-data", path: "/settings", role: "school", prepare: async (page) => clickIfVisible(page, "button:has-text('Data')") },
  ],
  org: [
    { id: "org-dashboard", path: "/dashboard", role: "org" },
    { id: "org-opportunities", path: "/opportunities", role: "org" },
    { id: "org-messages", path: "/messages", role: "org" },
    { id: "org-settings", path: "/settings", role: "org" },
  ],
  student: [
    { id: "student-dashboard", path: "/dashboard", role: "student" },
    { id: "student-browse", path: "/browse", role: "student" },
    { id: "student-submit", path: "/submit", role: "student", prepare: async (page) => clickIfVisible(page, "button:has-text('Submit Hours')") },
    { id: "student-messages", path: "/messages", role: "student" },
    { id: "student-settings-profile", path: "/settings", role: "student", prepare: async (page) => clickIfVisible(page, "button:has-text('Profile')") },
    { id: "student-settings-classroom", path: "/settings", role: "student", prepare: async (page) => clickIfVisible(page, "button:has-text('Classroom')") },
    { id: "student-settings-security", path: "/settings", role: "student", prepare: async (page) => clickIfVisible(page, "button:has-text('Security')") },
    { id: "student-settings-notifications", path: "/settings", role: "student", prepare: async (page) => clickIfVisible(page, "button:has-text('Notifications')") },
    { id: "student-settings-privacy", path: "/settings", role: "student", prepare: async (page) => clickIfVisible(page, "button:has-text('Privacy')") },
  ],
};

async function loginFast(page: Page, account: AccountSpec): Promise<void> {
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
    await writeCachedSession(account.key, { token, user });
  } else {
    const cached = await readCachedSession(account.key);
    token = cached.token;
    user = cached.user ?? null;
    if (!token) {
      const bodyText = await res.text();
      throw new Error(`API login failed for ${account.key}: ${res.status()} ${bodyText}`);
    }
  }

  await page.goto(`${UI_BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ token, user }) => {
    localStorage.setItem("goodhours_token", token);
    if (user) {
      localStorage.setItem("goodhours_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("goodhours_user");
    }
    sessionStorage.clear();
  }, { token, user });
}

async function writeCachedSession(accountKey: AccountKey, session: CachedAuthSession): Promise<void> {
  await fs.mkdir(AUTH_CACHE_DIR, { recursive: true });
  await fs.writeFile(path.join(AUTH_CACHE_DIR, `${accountKey}.json`), JSON.stringify(session), "utf8");
}

async function readCachedSession(accountKey: AccountKey): Promise<CachedAuthSession> {
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

async function clickIfVisible(page: Page, selector: string): Promise<void> {
  const locator = page.locator(selector).first();
  if (await locator.count().catch(() => 0)) {
    if (await locator.isVisible().catch(() => false)) {
      await locator.click({ timeout: 3000 }).catch(() => {});
    }
  }
}

async function withRuntimeAssertions(page: Page, label: string, action: () => Promise<void>): Promise<void> {
  const pageErrors: string[] = [];
  const failingResponses: Array<{ url: string; status: number }> = [];

  const onPageError = (err: Error) => {
    const text = String(err);
    if (/too many requests/i.test(text)) return;
    pageErrors.push(text);
  };
  const onConsole = (msg: any) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (/status of 429/i.test(text) || /too many requests/i.test(text)) return;
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
    expect.soft(body, `${label} rendered application error`).not.toContain("Something went wrong");
    expect.soft(pageErrors, `${label} triggered client errors`).toEqual([]);
    expect.soft(failingResponses, `${label} triggered API 5xx responses`).toEqual([]);
  } finally {
    page.off("pageerror", onPageError);
    page.off("console", onConsole);
    page.off("response", onResponse);
  }
}

async function collectVisibleControls(page: Page): Promise<VisibleControl[]> {
  return page.evaluate(() => {
    const hashKey = (value: string) => {
      let hash = 0;
      for (let i = 0; i < value.length; i += 1) {
        hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
      }
      return `k${Math.abs(hash)}`;
    };

    const isVisible = (node: Element) => {
      const el = node as HTMLElement;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };

    const seen = new Map<string, number>();
    const nodes = Array.from(
      document.querySelectorAll('a[href], button, [role="button"], [role="tab"], input[type="button"], input[type="submit"]'),
    ).filter((node) => {
      if (!isVisible(node)) return false;
      const el = node as HTMLButtonElement | HTMLInputElement | HTMLElement;
      if ("disabled" in el && el.disabled) return false;
      if (el.getAttribute("aria-disabled") === "true") return false;
      return true;
    });

    return nodes.map((node) => {
      const el = node as HTMLElement & { value?: string };
      const role = node.tagName.toLowerCase() === "a" ? "link" : "button";
      const text = (el.getAttribute("aria-label") || el.getAttribute("title") || el.innerText || el.value || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 160);
      const href = node.tagName.toLowerCase() === "a" ? node.getAttribute("href") : null;
      const signature = `${role}|${href || ""}|${text}`;
      const occurrence = seen.get(signature) || 0;
      seen.set(signature, occurrence + 1);
      const key = `${hashKey(signature)}_${occurrence}`;
      el.dataset.uiAuditKey = key;
      return { key, role, text, href };
    });
  });
}

async function collectVisibleFields(page: Page): Promise<VisibleField[]> {
  return page.evaluate(() => {
    const hashKey = (value: string) => {
      let hash = 0;
      for (let i = 0; i < value.length; i += 1) {
        hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
      }
      return `k${Math.abs(hash)}`;
    };

    const isVisible = (node: Element) => {
      const el = node as HTMLElement;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };

    const labelFor = (el: HTMLElement): string => {
      const id = el.getAttribute("id");
      if (id) {
        const explicit = document.querySelector(`label[for="${CSS.escape(id)}"]`);
        if (explicit?.textContent) return explicit.textContent.replace(/\s+/g, " ").trim();
      }
      const wrapped = el.closest("label");
      return wrapped?.textContent?.replace(/\s+/g, " ").trim() || "";
    };

    const seen = new Map<string, number>();
    const nodes = Array.from(document.querySelectorAll("input, select, textarea")).filter((node) => {
      const el = node as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      if (!isVisible(node)) return false;
      if (el.disabled || el.readOnly) return false;
      if (el instanceof HTMLInputElement && ["hidden"].includes(el.type)) return false;
      return true;
    });

    return nodes.map((node) => {
      const el = node as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      const tag = node.tagName.toLowerCase() as "input" | "select" | "textarea";
      const type = tag === "input" ? (el as HTMLInputElement).type || "text" : tag;
      const label = labelFor(el);
      const placeholder = "placeholder" in el ? (el.placeholder || "") : "";
      const name = el.getAttribute("name") || "";
      const id = el.getAttribute("id") || "";
      const value = "value" in el ? String(el.value ?? "") : "";
      const checked = "checked" in el ? Boolean((el as HTMLInputElement).checked) : false;
      const accept = "accept" in el ? ((el as HTMLInputElement).accept || "") : "";
      const signature = `${tag}|${type}|${label}|${placeholder}|${name}|${id}`;
      const occurrence = seen.get(signature) || 0;
      seen.set(signature, occurrence + 1);
      const key = `${hashKey(signature)}_${occurrence}`;
      (el as HTMLElement).dataset.uiAuditKey = key;
      return { key, tag, type, label, placeholder, name, id, value, checked, accept };
    });
  });
}

function shouldSkipByPattern(text: string, patterns: RegExp[]): boolean {
  const normalized = text.trim();
  return patterns.some((pattern) => pattern.test(normalized));
}

function fieldDescriptor(field: VisibleField): string {
  return field.label || field.placeholder || field.name || field.id || `${field.tag}:${field.type}`;
}

function fieldValue(field: VisibleField, index: number): string {
  if (field.type === "email") return `surface.audit+${index}@example.com`;
  if (field.type === "tel") return "2125550100";
  if (field.type === "url") return "https://example.com";
  if (field.type === "number") return "7";
  if (field.type === "date") return "2030-01-15";
  if (field.type === "time") return "09:30";
  if (field.type === "datetime-local") return "2030-01-15T09:30";
  if (/zip/i.test(fieldDescriptor(field))) return "10001";
  if (/state/i.test(fieldDescriptor(field))) return "NY";
  if (/invite code/i.test(fieldDescriptor(field))) return "invalidcode";
  if (/password/i.test(fieldDescriptor(field))) return "Playwright1!";
  return `Surface audit ${index}`;
}

async function mutateField(page: Page, field: VisibleField, index: number): Promise<void> {
  const locator = page.locator(`[data-ui-audit-key="${escapeForAttr(field.key)}"]`).first();
  await expect(locator, `field ${fieldDescriptor(field)} missing after prepare`).toBeVisible({ timeout: 5000 });

  if (field.tag === "select") {
    const values = await locator.evaluate((node) =>
      Array.from((node as HTMLSelectElement).options)
        .filter((option) => !option.disabled)
        .map((option) => option.value)
        .filter((value) => value !== ""),
    );
    if (values.length) {
      const next = values.find((value) => value !== field.value) || values[0];
      await locator.selectOption(next);
    }
    return;
  }

  if (field.type === "checkbox" || field.type === "radio") {
    await locator.click({ force: true });
    return;
  }

  if (field.type === "file") {
    const fixture = /image/i.test(field.accept) ? `${FIXTURES_DIR}/avatar.png` : `${FIXTURES_DIR}/proof.pdf`;
    await locator.setInputFiles(fixture);
    return;
  }

  const value = fieldValue(field, index);
  await locator.fill("");
  await locator.fill(value);
}

async function clickControl(page: Page, control: VisibleControl): Promise<void> {
  const locator = page.locator(`[data-ui-audit-key="${escapeForAttr(control.key)}"]`).first();
  await expect(locator, `control ${control.text || control.href} missing after prepare`).toBeVisible({ timeout: 5000 });

  if (/csv|pdf/i.test(control.text)) {
    const download = page.waitForEvent("download", { timeout: 6000 }).catch(() => null);
    await locator.click({ timeout: 4000 });
    await download;
    return;
  }

  await locator.click({ timeout: 4000 });
}

async function exerciseRoute(page: Page, route: RouteSpec): Promise<void> {
  const url = `${UI_BASE}${route.path}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => {});
  if (route.prepare) await route.prepare(page);
  if (route.exercise) await route.exercise(page);
}

async function auditFields(page: Page, route: RouteSpec): Promise<void> {
  await exerciseRoute(page, route);
  const fields = await collectVisibleFields(page);

  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index];
    if (shouldSkipByPattern(fieldDescriptor(field), [...GLOBAL_SKIP_FIELDS, ...(route.skipFields || [])])) continue;

    await exerciseRoute(page, route);
    const refreshed = await collectVisibleFields(page);
    const target = refreshed.find((entry) => entry.key === field.key);
    if (!target) continue;

    await withRuntimeAssertions(page, `${route.id} :: field :: ${fieldDescriptor(target)}`, async () => {
      await mutateField(page, target, index);
      await page.keyboard.press("Tab").catch(() => {});
      await page.waitForTimeout(200);
    });
  }
}

async function auditControls(page: Page, route: RouteSpec): Promise<void> {
  await exerciseRoute(page, route);
  const controls = await collectVisibleControls(page);

  for (const control of controls) {
    const text = control.text || control.href || "";
    if (shouldSkipByPattern(text, [...GLOBAL_SKIP_CONTROLS, ...(route.skipControls || [])])) continue;

    await exerciseRoute(page, route);
    const refreshed = await collectVisibleControls(page);
    const target = refreshed.find((entry) => entry.key === control.key);
    if (!target) continue;

    await withRuntimeAssertions(page, `${route.id} :: control :: ${text}`, async () => {
      await clickControl(page, target);
      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(250);
    });
  }
}

function routesFor(account: AccountSpec): RouteSpec[] {
  return ROLE_ROUTES[account.role].filter((route) => !ROUTE_FILTER || route.id === ROUTE_FILTER);
}

function accountsForAudit(): AccountSpec[] {
  return ACCOUNTS.filter((account) => !ACCOUNT_FILTER || account.key === ACCOUNT_FILTER);
}

function escapeForAttr(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

test.describe.serial("UI interaction audit", () => {
  for (const account of accountsForAudit()) {
    test(`${account.key} interactive routes stay healthy`, async ({ browser }) => {
      const ctx = await browser.newContext({ acceptDownloads: true });
      const page = await ctx.newPage();
      await loginFast(page, account);

      await page.goto(`${UI_BASE}/dashboard`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => {});
      const body = await page.locator("body").innerText();
      for (const expectedText of account.expectedTexts) {
        expect.soft(body).toContain(expectedText);
      }

      for (const route of routesFor(account)) {
        await test.step(`${account.key} ${route.id}`, async () => {
          const routePage = await ctx.newPage();
          try {
            await loginFast(routePage, account);
            await auditFields(routePage, route);
            await auditControls(routePage, route);
          } finally {
            await routePage.close();
          }
        });
      }

      await page.close();
      await ctx.close();
    });
  }
});
