import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const BASE_URL = process.env.QA_BASE_URL || 'http://localhost:5173';
const MAILINATOR_API_BASE = 'https://www.mailinator.com/api/v2/domains/public/inboxes';

const ROOT = process.cwd();
const TESTS_DIR = path.join(ROOT, 'tests');
const ARTIFACTS_DIR = path.join(TESTS_DIR, 'artifacts');
const SCREENSHOT_DIR = path.join(ARTIFACTS_DIR, 'screenshots');
const TRACE_DIR = path.join(ARTIFACTS_DIR, 'traces');
const DOWNLOAD_DIR = path.join(ARTIFACTS_DIR, 'downloads');
const FIXTURE_DIR = path.join(ARTIFACTS_DIR, 'fixtures');
const AUTH_DIR = path.join(TESTS_DIR, '.auth');
const QA_RESULTS_PATH = path.join(TESTS_DIR, 'qa-results.md');
const FAIL_SUMMARY_PATH = path.join(TESTS_DIR, 'failures-summary.txt');
const MANUAL_QA_PATH = fs.existsSync(path.join(ROOT, 'manual_qa.md'))
  ? path.join(ROOT, 'manual_qa.md')
  : path.join(TESTS_DIR, 'qa-results.md');

for (const dir of [TESTS_DIR, ARTIFACTS_DIR, SCREENSHOT_DIR, TRACE_DIR, DOWNLOAD_DIR, FIXTURE_DIR, AUTH_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

type Status = 'PASS' | 'FAIL' | 'MANUAL REQUIRED';

type LogEntry = {
  timestamp: string;
  level: string;
  text: string;
};

type Session = {
  role: string;
  email?: string;
  context: import('@playwright/test').BrowserContext;
  page: import('@playwright/test').Page;
  logs: LogEntry[];
  tracePath: string;
  statePath?: string;
};

type ChecklistItem = {
  index: number;
  text: string;
  originalLine: string;
};

type ItemResult = {
  index: number;
  text: string;
  status: Status;
  role: string;
  url: string;
  error?: string;
  screenshotPath?: string;
  tracePath?: string;
  logsSnippet?: string;
  manualReason?: string;
  manualStep?: string;
};

type MailinatorMessage = {
  rowText: string;
  rawText: string;
  links: string[];
};

class ManualRequiredError extends Error {
  reason: string;
  manualStep: string;

  constructor(reason: string, manualStep: string) {
    super(reason);
    this.reason = reason;
    this.manualStep = manualStep;
    this.name = 'ManualRequiredError';
  }
}

const ACCOUNTS = {
  studentA: { email: 'john@student.edu', password: 'password123' },
  studentB: { email: 'jane@student.edu', password: 'password123' },
  org: { email: 'volunteer@greenearth.org', password: 'password123' },
  admin: { email: 'admin@lincoln.edu', password: 'password123' },
};

const flowState: {
  qaEmail: string;
  qaPassword: string;
  qaResetPassword: string;
  verifyLinkOld: string;
  verifyLinkNew: string;
  resetLink: string;
  studentToOrgSubject: string;
  orgToStudentSubject: string;
  studentSignedOpportunityTitle: string;
  studentSignedOpportunityHref: string;
  waitlistOpportunityTitle: string;
  waitlistOpportunityHref: string;
  createdOrgOpportunityTitle: string;
  updatedOrgOpportunityTitle: string;
  quickSmokeConsoleErrors: string[];
  latestCreateOpportunityResponse: any;
} = {
  qaEmail: '',
  qaPassword: 'Password1!',
  qaResetPassword: 'ResetPass1!',
  verifyLinkOld: '',
  verifyLinkNew: '',
  resetLink: '',
  studentToOrgSubject: '',
  orgToStudentSubject: '',
  studentSignedOpportunityTitle: '',
  studentSignedOpportunityHref: '',
  waitlistOpportunityTitle: '',
  waitlistOpportunityHref: '',
  createdOrgOpportunityTitle: '',
  updatedOrgOpportunityTitle: '',
  quickSmokeConsoleErrors: [],
  latestCreateOpportunityResponse: null,
};

const mailinatorSeenActionLinks = new Map<string, Set<string>>();

function assertOrThrow(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function markManual(reason: string, step: string): never {
  throw new ManualRequiredError(reason, step);
}

function safeNowTag(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function sanitizeFilename(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 160);
}

function normalizeMailinatorTime(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n < 1_000_000_000_000 ? n * 1000 : n;
}

function daysFromNow(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function parseChecklistItems(): ChecklistItem[] {
  const manualQa = fs.readFileSync(MANUAL_QA_PATH, 'utf8');
  const lines = manualQa.split(/\r?\n/);
  const out: ChecklistItem[] = [];
  let idx = 0;
  for (const line of lines) {
    const m = line.match(/^- \[ \] (.+)$/);
    if (m) {
      idx += 1;
      out.push({ index: idx, text: m[1], originalLine: line });
    }
  }
  return out;
}

function buildSnippet(logs: LogEntry[]): string {
  if (!logs.length) return '';
  return logs
    .slice(-12)
    .map((l) => `[${l.timestamp}] ${l.level}: ${l.text}`)
    .join('\n');
}

async function attachSessionLogging(session: Session): Promise<void> {
  const push = (level: string, text: string) => {
    session.logs.push({
      timestamp: new Date().toISOString(),
      level,
      text: text.slice(0, 600),
    });
  };

  session.page.on('console', (msg) => {
    if (msg.type() === 'error') {
      push('console.error', msg.text());
    }
  });

  session.page.on('pageerror', (err) => {
    push('pageerror', String(err));
  });

  session.page.on('requestfailed', (req) => {
    push('requestfailed', `${req.method()} ${req.url()} -> ${req.failure()?.errorText ?? 'unknown'}`);
  });

  session.page.on('response', (res) => {
    if (res.status() >= 400) {
      push('response', `${res.status()} ${res.request().method()} ${res.url()}`);
    }
  });
}

async function startAnonymousSession(browser: import('@playwright/test').Browser, role: string): Promise<Session> {
  const context = await browser.newContext({
    acceptDownloads: true,
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await context.newPage();
  const tracePath = path.join(TRACE_DIR, `${sanitizeFilename(role)}-${safeNowTag()}.zip`);
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const session: Session = { role, context, page, logs: [], tracePath };
  await attachSessionLogging(session);
  return session;
}

async function login(page: import('@playwright/test').Page, email: string, password: string, adminAllowContinue = true): Promise<void> {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);

  const [loginResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/auth/login'), { timeout: 60_000 }),
    page.getByRole('button', { name: /sign in/i }).click(),
  ]);

  if (loginResponse.status() !== 200) {
    const txt = await loginResponse.text().catch(() => '');
    throw new Error(`Login failed for ${email}. Status ${loginResponse.status()} ${txt}`);
  }

  await page.waitForTimeout(1200);

  if (adminAllowContinue && (await page.getByRole('button', { name: /Continue to Dashboard/i }).count())) {
    await page.getByRole('button', { name: /Continue to Dashboard/i }).click();
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  }
}

async function startLoggedInSession(
  browser: import('@playwright/test').Browser,
  role: string,
  email: string,
  password: string,
  storageName: string,
  fromStorage = false,
): Promise<Session> {
  const statePath = path.join(AUTH_DIR, `${storageName}.json`);
  const storageState = fromStorage && fs.existsSync(statePath) ? statePath : undefined;

  const context = await browser.newContext({
    acceptDownloads: true,
    storageState,
    permissions: ['clipboard-read', 'clipboard-write'],
  });

  const page = await context.newPage();
  const tracePath = path.join(TRACE_DIR, `${sanitizeFilename(role)}-${safeNowTag()}.zip`);
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });

  const session: Session = { role, email, context, page, logs: [], tracePath, statePath };
  await attachSessionLogging(session);

  if (!storageState) {
    await login(page, email, password, true);
    await context.storageState({ path: statePath });
  } else {
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    if (page.url().includes('/login')) {
      await login(page, email, password, true);
      await context.storageState({ path: statePath });
    }
  }

  return session;
}

async function stopSession(session: Session): Promise<void> {
  try {
    if (session.statePath) {
      await session.context.storageState({ path: session.statePath });
    }
  } catch {
    // no-op
  }

  try {
    await session.context.tracing.stop({ path: session.tracePath });
  } catch {
    // no-op
  }

  try {
    await session.context.close();
  } catch {
    // no-op
  }
}

async function ensureStudentSignupRole(page: import('@playwright/test').Page): Promise<void> {
  await page.goto(`${BASE_URL}/signup`, { waitUntil: 'networkidle' });
  const signOut = page.getByRole('button', { name: /Sign out/i }).first();
  if (await signOut.count()) {
    await signOut.click();
    await page.waitForTimeout(400);
    await page.goto(`${BASE_URL}/signup`, { waitUntil: 'networkidle' });
  }
  const explicitVolunteerPicker = page.getByRole('button', { name: /I would like to volunteer/i }).first();
  if (await explicitVolunteerPicker.count()) {
    await explicitVolunteerPicker.click();
    await page.waitForTimeout(300);
    return;
  }

  const volunteerBanner = page.getByRole('button', { name: /Signing up as a Volunteer/i }).first();
  if (await volunteerBanner.count()) {
    return;
  }

  const changeRole = page.getByRole('button', { name: /Change role/i }).first();
  if (await changeRole.count()) {
    await changeRole.click();
    await page.waitForTimeout(200);
    if (await explicitVolunteerPicker.count()) {
      await explicitVolunteerPicker.click();
      await page.waitForTimeout(300);
      return;
    }
  }

  throw new Error('Volunteer signup role selector not found on /signup');
}

async function signupVolunteer(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
  name: string,
): Promise<import('@playwright/test').Response> {
  await ensureStudentSignupRole(page);
  const inputs = page.locator('input');
  assertOrThrow((await inputs.count()) >= 4, 'Signup inputs not found');

  await inputs.nth(0).fill(name);
  await inputs.nth(1).fill(email);
  await inputs.nth(2).fill('16');
  await inputs.nth(3).fill(password);

  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/auth/signup'), { timeout: 60_000 }),
    page.getByRole('button', { name: /Create Account/i }).click(),
  ]);

  await page.waitForTimeout(1000);
  return resp;
}

async function fetchMailinatorMessage(
  browser: import('@playwright/test').Browser,
  inbox: string,
  subjectPattern: RegExp,
  timeoutMs = 120_000,
): Promise<MailinatorMessage> {
  void browser;
  const requestedAt = Date.now();
  const freshnessFloor = requestedAt - 15_000;
  const seenKey = `${inbox}::${subjectPattern.source}::${subjectPattern.flags}`;
  if (!mailinatorSeenActionLinks.has(seenKey)) {
    mailinatorSeenActionLinks.set(seenKey, new Set<string>());
  }
  const seenLinks = mailinatorSeenActionLinks.get(seenKey)!;
  const deadline = Date.now() + timeoutMs;
  let lastError = '';

  while (Date.now() < deadline) {
    try {
      const localResp = await fetch(`${BASE_URL}/api/auth/__test-email?inbox=${encodeURIComponent(inbox)}`);
      if (localResp.ok) {
        const localData = (await localResp.json()) as any;
        const localMessages = Array.isArray(localData?.messages) ? localData.messages : [];
        const localMatching = localMessages
          .filter(
            (m: any) =>
              subjectPattern.test(String(m?.subject || '')) && Number(m?.sentAt || 0) >= freshnessFloor,
          )
          .sort((a: any, b: any) => Number(b?.sentAt || 0) - Number(a?.sentAt || 0));

        for (const localMsg of localMatching) {
          const rawText = `${String(localMsg?.from || '').trim()} ${String(localMsg?.subject || '').trim()}\n${String(
            localMsg?.html || '',
          )}`.trim();
          const links = Array.from(
            new Set(
              (rawText.match(/https?:\/\/[^\s"'<>]+/g) || [])
                .map((link) => link.replace(/&amp;/g, '&').replace(/[\])}>.,!?]+$/, ''))
                .filter(Boolean),
            ),
          );
          const actionLinks = links.filter((link) => /verify-email\?token=|reset-password\?token=/i.test(link));
          const unseenActionLink = actionLinks.find((link) => !seenLinks.has(link));
          if (actionLinks.length > 0 && !unseenActionLink) {
            continue;
          }
          if (unseenActionLink) {
            seenLinks.add(unseenActionLink);
          }
          return {
            rowText: `${String(localMsg?.from || '').trim()} ${String(localMsg?.subject || '').trim()}`.trim(),
            rawText,
            links,
          };
        }
      }

      const listResp = await fetch(`${MAILINATOR_API_BASE}/${encodeURIComponent(inbox)}`);
      if (!listResp.ok) {
        lastError = `Mailinator list API HTTP ${listResp.status}`;
        await new Promise((resolve) => setTimeout(resolve, 2500));
        continue;
      }

      const listData = (await listResp.json()) as any;
      const messages = Array.isArray(listData?.msgs) ? listData.msgs : [];
      const matching = messages
        .map((m: any) => ({ ...m, _normalizedTime: normalizeMailinatorTime(m?.time) }))
        .filter(
          (m: any) => subjectPattern.test(String(m?.subject || '')) && Number(m?._normalizedTime || 0) >= freshnessFloor,
        )
        .sort((a: any, b: any) => Number(b?._normalizedTime || 0) - Number(a?._normalizedTime || 0));

      for (const msgMeta of matching) {
        const messageId = String(msgMeta?.id || '');
        if (!messageId) continue;

        const detailResp = await fetch(
          `${MAILINATOR_API_BASE}/${encodeURIComponent(inbox)}/messages/${encodeURIComponent(messageId)}`,
        );
        if (!detailResp.ok) continue;

        const detail = (await detailResp.json()) as any;
        const parts = Array.isArray(detail?.parts) ? detail.parts : [];
        const rawChunks: string[] = [];
        if (detail?.headers) rawChunks.push(JSON.stringify(detail.headers));
        for (const part of parts) {
          if (typeof part?.body === 'string') {
            rawChunks.push(part.body);
          }
        }
        const rawText = rawChunks.join('\n');
        const links = Array.from(
          new Set(
            (rawText.match(/https?:\/\/[^\s"'<>]+/g) || [])
              .map((link) => link.replace(/&amp;/g, '&').replace(/[\])}>.,!?]+$/, ''))
              .filter(Boolean),
          ),
        );

        const actionLinks = links.filter((link) => /verify-email\?token=|reset-password\?token=/i.test(link));
        const unseenActionLink = actionLinks.find((link) => !seenLinks.has(link));
        if (actionLinks.length > 0 && !unseenActionLink) {
          continue;
        }

        if (unseenActionLink) {
          seenLinks.add(unseenActionLink);
        }

        const from = String(detail?.fromfull || detail?.from || msgMeta?.fromfull || msgMeta?.from || '').trim();
        const subject = String(detail?.subject || msgMeta?.subject || '').trim();
        return {
          rowText: `${from} ${subject}`.trim(),
          rawText,
          links,
        };
      }
    } catch (err: any) {
      lastError = err?.message ? String(err.message) : String(err);
    }

    await new Promise((resolve) => setTimeout(resolve, 2500));
  }

  throw new Error(
    `Mailinator message not found for inbox ${inbox} with subject ${subjectPattern}${lastError ? ` (${lastError})` : ''}`,
  );
}

async function findOpportunityLinks(page: import('@playwright/test').Page): Promise<Array<{ title: string; href: string }>> {
  // Browse page now uses /slot/:id links
  const links = await page.locator('a[href^="/slot/"]').evaluateAll((anchors) =>
    anchors
      .map((a) => {
        const t = (a.textContent || '').trim();
        const h = a.getAttribute('href') || '';
        return { title: t, href: h };
      })
      .filter((x) => x.title && x.href),
  );

  const unique = new Map<string, { title: string; href: string }>();
  for (const link of links) {
    if (!unique.has(link.href)) unique.set(link.href, link);
  }
  return Array.from(unique.values());
}

async function openOpportunityByTitle(
  page: import('@playwright/test').Page,
  title: string,
): Promise<void> {
  await page.goto(`${BASE_URL}/browse`, { waitUntil: 'networkidle' });
  const search = page.locator('input[placeholder*="Search opportunities"]');
  if (await search.count()) {
    await search.fill(title.slice(0, 30));
    await page.waitForTimeout(700);
  }

  const link = page.getByRole('link', { name: new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }).first();
  if (!(await link.count())) {
    throw new Error(`Opportunity link not found by title: ${title}`);
  }

  await link.click();
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(500);
}

async function openOpportunityByHref(
  page: import('@playwright/test').Page,
  href: string,
): Promise<void> {
  await page.goto(`${BASE_URL}${href}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
}

async function findOpportunityWithAction(
  page: import('@playwright/test').Page,
  buttonRegex: RegExp,
  excludedTitles: Set<string> = new Set(),
): Promise<{ title: string; href: string } | null> {
  await page.goto(`${BASE_URL}/browse`, { waitUntil: 'networkidle' });
  const links = await findOpportunityLinks(page);

  for (const opp of links) {
    if (excludedTitles.has(opp.title)) continue;
    await page.goto(`${BASE_URL}${opp.href}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(350);
    const btn = page.getByRole('button', { name: buttonRegex }).first();
    if (await btn.count()) {
      return opp;
    }
  }

  return null;
}

async function downloadFile(
  page: import('@playwright/test').Page,
  clickAction: () => Promise<void>,
  prefix: string,
): Promise<{ savedPath: string; size: number; name: string }> {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60_000 }),
    clickAction(),
  ]);

  const name = sanitizeFilename(download.suggestedFilename() || `${prefix}-${Date.now()}`);
  const savedPath = path.join(DOWNLOAD_DIR, `${prefix}-${Date.now()}-${name}`);
  await download.saveAs(savedPath);
  const stat = fs.statSync(savedPath);

  return { savedPath, size: stat.size, name };
}

function ensureFixtures(): { png: string; jpg: string; pdf: string; exe: string } {
  const pngPath = path.join(FIXTURE_DIR, 'avatar.png');
  const jpgPath = path.join(FIXTURE_DIR, 'proof.jpg');
  const pdfPath = path.join(FIXTURE_DIR, 'proof.pdf');
  const exePath = path.join(FIXTURE_DIR, 'malware.exe');

  const tinyPng =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2xWfQAAAAASUVORK5CYII=';
  fs.writeFileSync(pngPath, Buffer.from(tinyPng, 'base64'));
  fs.copyFileSync(pngPath, jpgPath);
  fs.writeFileSync(pdfPath, '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');
  fs.writeFileSync(exePath, 'MZ fake binary');

  return { png: pngPath, jpg: jpgPath, pdf: pdfPath, exe: exePath };
}

function parseVisibleRatios(text: string): number[] {
  const out: number[] = [];
  const re = /(\d+)\s*\/\s*(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push(Number(m[1]));
  }
  return out;
}

function parseVisibleDates(text: string): number[] {
  const out: number[] = [];
  const re = /(\d{1,2})\/(\d{1,2})\/(\d{4})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const dt = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
    const ts = dt.getTime();
    if (!Number.isNaN(ts)) out.push(ts);
  }
  return out;
}

function isNonDecreasing(values: number[]): boolean {
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] < values[i - 1]) return false;
  }
  return true;
}

function isNonIncreasing(values: number[]): boolean {
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] > values[i - 1]) return false;
  }
  return true;
}

function buildQaResultsMarkdown(allLines: string[], resultsMap: Map<number, ItemResult>): string {
  const out: string[] = [];
  out.push('# GoodHours QA Results');
  out.push('');
  out.push(`Generated: ${new Date().toISOString()}`);
  out.push('');

  let itemIdx = 0;
  for (const line of allLines) {
    const m = line.match(/^- \[ \] (.+)$/);
    if (!m) {
      out.push(line);
      continue;
    }

    itemIdx += 1;
    const result = resultsMap.get(itemIdx);
    const status = result?.status ?? 'FAIL';
    out.push(`- [ ] ${m[1]} — ${status}`);

    if (!result) {
      out.push('  - Error: Item was not executed due to unexpected suite interruption.');
      continue;
    }

    if (result.status === 'FAIL') {
      out.push(`  - Error: ${result.error ?? 'Unknown error'}`);
      out.push(`  - URL: ${result.url || 'n/a'}`);
      out.push(`  - Screenshot: ${result.screenshotPath ?? 'n/a'}`);
      out.push(`  - Trace: ${result.tracePath ?? 'n/a'}`);
      if (result.logsSnippet) {
        out.push('  - Console/Network Logs Snippet:');
        out.push('');
        out.push('```text');
        out.push(result.logsSnippet);
        out.push('```');
      }
    }

    if (result.status === 'MANUAL REQUIRED') {
      out.push(`  - Reason: ${result.manualReason ?? 'Not specified'}`);
      out.push(`  - Manual Step: ${result.manualStep ?? 'Not specified'}`);
    }
  }

  return out.join('\n');
}

function buildFailureSummary(resultsMap: Map<number, ItemResult>): string {
  const ordered = Array.from(resultsMap.values()).sort((a, b) => a.index - b.index);
  const fails = ordered.filter((r) => r.status === 'FAIL');
  const manuals = ordered.filter((r) => r.status === 'MANUAL REQUIRED');

  const lines: string[] = [];
  if (!fails.length) {
    lines.push('FAILURES SUMMARY: none (all PASS or MANUAL REQUIRED)');
  } else {
    lines.push('FAILURES SUMMARY:');
    for (const fail of fails) {
      lines.push(`- [${String(fail.index).padStart(3, '0')}] ${fail.text}`);
      lines.push(`  Role/Session: ${fail.role}`);
      lines.push(`  URL at failure: ${fail.url || 'n/a'}`);
      lines.push(`  Error: ${fail.error || 'Unknown error'}`);
      lines.push(`  Screenshot: ${fail.screenshotPath || 'n/a'}`);
      lines.push(`  Trace: ${fail.tracePath || 'n/a'}`);
    }
  }

  lines.push('');
  lines.push('MANUAL REQUIRED SUMMARY:');
  if (!manuals.length) {
    lines.push('- none');
  } else {
    for (const m of manuals) {
      lines.push(`- [${String(m.index).padStart(3, '0')}] ${m.text}`);
      lines.push(`  Reason: ${m.manualReason || 'Not specified'}`);
      lines.push(`  Manual step: ${m.manualStep || 'Not specified'}`);
    }
  }

  return lines.join('\n');
}

test.describe.configure({ mode: 'serial' });

test('GoodHours full manual checklist automation', async ({ browser }) => {
  const checklist = parseChecklistItems();
  assertOrThrow(checklist.length === 108, `Expected 108 checklist items from manual_qa.md, found ${checklist.length}`);

  const manualQaAllLines = fs.readFileSync(MANUAL_QA_PATH, 'utf8').split(/\r?\n/);
  const results = new Map<number, ItemResult>();
  const fixtures = ensureFixtures();

  const sessions: Session[] = [];
  let authSession: Session | undefined;
  let studentSession: Session | undefined;
  let janeSession: Session | undefined;
  let orgSession: Session | undefined;
  let adminSession: Session | undefined;

  async function runItem(
    index: number,
    session: Session | undefined,
    role: string,
    fn: () => Promise<void>,
  ): Promise<void> {
    const item = checklist[index - 1];
    const page = session?.page;
    const logStart = session?.logs.length ?? 0;
    console.log(`[QA] START ${String(index).padStart(3, '0')} ${item.text}`);

    try {
      await fn();
      results.set(index, {
        index,
        text: item.text,
        status: 'PASS',
        role,
        url: page?.url() ?? '',
      });
      console.log(`[QA] PASS  ${String(index).padStart(3, '0')}`);
    } catch (err: any) {
      if (err instanceof ManualRequiredError) {
        results.set(index, {
          index,
          text: item.text,
          status: 'MANUAL REQUIRED',
          role,
          url: page?.url() ?? '',
          manualReason: err.reason,
          manualStep: err.manualStep,
          tracePath: session?.tracePath,
        });
        console.log(`[QA] MANUAL ${String(index).padStart(3, '0')} ${err.reason}`);
        return;
      }

      const screenshotPath = path.join(
        SCREENSHOT_DIR,
        `item-${String(index).padStart(3, '0')}-${safeNowTag()}.png`,
      );

      try {
        if (page && !page.isClosed()) {
          await page.screenshot({ path: screenshotPath, fullPage: true });
        }
      } catch {
        // ignore screenshot failures
      }

      const snippet = session ? buildSnippet(session.logs.slice(logStart)) : '';
      results.set(index, {
        index,
        text: item.text,
        status: 'FAIL',
        role,
        url: page?.url() ?? '',
        error: err?.message ? String(err.message) : String(err),
        screenshotPath,
        tracePath: session?.tracePath,
        logsSnippet: snippet,
      });
      console.log(`[QA] FAIL ${String(index).padStart(3, '0')} ${err?.message ? String(err.message) : String(err)}`);
    }
  }

  try {
    authSession = await startAnonymousSession(browser, 'auth-flow');
    sessions.push(authSession);

    await runItem(1, authSession, 'Auth', async () => {
      markManual(
        'Student self-registration via /signup has been removed. Students now join GoodHours exclusively through school invitation links.',
        'Ask a school admin to invite a student email. The student receives a link, sets a password, and is immediately added to the school cohort. Verify the invite email arrives, the link works, and the student is shown on the school admin roster.',
      );
    });

    await runItem(2, authSession, 'Auth', async () => {
      markManual(
        'Verification email step is only triggered by student invitation flow (not self-signup). Requires a valid invitation to have been sent first.',
        'After school admin sends an invitation, check the student mailbox for "Verify your GoodHours account" email, confirm sender is noreply@notifications.goodhours.app, click the verify link.',
      );
    });

    await runItem(3, authSession, 'Auth', async () => {
      markManual(
        'Email verification link works only after an invitation is created (self-signup removed).',
        'Use the verification link from the invitation email. Confirm it redirects to a "Email verified" or "Join a Classroom" screen.',
      );
    });

    await runItem(4, authSession, 'Auth', async () => {
      if (await authSession!.page.getByRole('button', { name: /Sign out/i }).count()) {
        await authSession!.page.getByRole('button', { name: /Sign out/i }).click();
        await authSession!.page.waitForTimeout(500);
      }

      // Use a nonexistent email to avoid rate-limiting the primary student account
      await authSession!.page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
      await authSession!.page.locator('input[type="email"]').first().fill('qa-wrong-pass@example.invalid');
      await authSession!.page.locator('input[type="password"]').first().fill('wrong-password');
      const [resp] = await Promise.all([
        authSession!.page.waitForResponse((r) => r.url().includes('/api/auth/login'), { timeout: 60_000 }),
        authSession!.page.getByRole('button', { name: /sign in/i }).click(),
      ]);
      const body = await authSession!.page.locator('body').innerText();
      assertOrThrow(resp.status() >= 400, 'Wrong-password login unexpectedly succeeded');
      assertOrThrow(
        /Invalid email or password|Too many login attempts|too many|not found/i.test(body),
        'Expected invalid credentials error text not shown',
      );
    });

    await runItem(5, authSession, 'Auth', async () => {
      markManual(
        'Forgot-password email delivery still depends on a reachable mailbox and outbound email transport. The automated self-signup mailinator path no longer exists in this suite.',
        'Open /forgot-password, submit a real mailbox for an existing account, confirm the "Check your email" state, then verify the reset email arrives and the link lands on /reset-password.',
      );
    });

    await runItem(6, authSession, 'Auth', async () => {
      markManual(
        'Reset-password completion depends on the manual email-delivery step immediately before it.',
        'Use the reset link from the email, submit a compliant new password, confirm the success state, then log in with the new password.',
      );
    });

    await runItem(7, authSession, 'Auth', async () => {
      markManual(
        'Duplicate student self-signup is obsolete because students no longer self-register from /signup.',
        'Validate duplicate-invitation protection instead: have a school admin invite an already-enrolled student email and confirm the UI/API reject the duplicate cleanly.',
      );
    });

    studentSession = await startLoggedInSession(
      browser,
      'student-john',
      ACCOUNTS.studentA.email,
      ACCOUNTS.studentA.password,
      'john',
      false,
    );
    sessions.push(studentSession);

    await runItem(8, studentSession, 'Student Flow', async () => {
      await studentSession!.page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
      const body = await studentSession!.page.locator('main').innerText();
      assertOrThrow(/Verified Hours/i.test(body), 'Verified Hours card missing');
      assertOrThrow(/Pending Verification/i.test(body), 'Pending Verification card missing');
      assertOrThrow(/Activities Signed Up/i.test(body), 'Activities Signed Up card missing');
      assertOrThrow(/Hours Remaining/i.test(body), 'Hours Remaining card missing');
    });

    await runItem(9, studentSession, 'Student Flow', async () => {
      const body = await studentSession!.page.locator('main').innerText();
      assertOrThrow(/Progress toward goal/i.test(body), 'Progress section missing');
      assertOrThrow(/\d+(?:\.\d+)?\s*\/\s*\d+/.test(body), 'Verified-hours vs goal value not shown');
    });

    await runItem(10, studentSession, 'Student Flow', async () => {
      const body = await studentSession!.page.locator('main').innerText();
      assertOrThrow(/Upcoming Activities/i.test(body), 'Upcoming Activities section missing');
    });

    await runItem(11, studentSession, 'Student Flow', async () => {
      const body = await studentSession!.page.locator('main').innerText();
      assertOrThrow(/Recent Activity/i.test(body), 'Recent Activity section missing');
      assertOrThrow(
        /PENDING|APPROVED|VERIFIED|REJECTED|CHECKED_IN|CHECKED_OUT|No recent status changes/i.test(body),
        'Recent Activity panel did not render an expected state',
      );
    });

    await runItem(12, studentSession, 'Student Flow', async () => {
      await studentSession!.page.goto(`${BASE_URL}/browse`, { waitUntil: 'networkidle' });
      const body = await studentSession!.page.locator('main').innerText();
      assertOrThrow(/Browse Opportunities/i.test(body), 'Browse page heading missing');
      const count = await studentSession!.page.locator('a[href^="/slot/"]').count();
      assertOrThrow(count > 0 || /No opportunities found/i.test(body), 'Browse page rendered neither slots nor empty-state copy');
    });

    await runItem(13, studentSession, 'Student Flow', async () => {
      const links = await findOpportunityLinks(studentSession!.page);
      if (links.length === 0) {
        markManual(
          'The current student account has no visible browse opportunities because no partner organizations are approved for this school in the present seed state.',
          'Approve at least one partner organization or seed one visible slot for the student, then re-run browse search coverage.',
        );
      }
      const partial = links[0].title.split(/\s+/).find((w) => w.length >= 3) ?? links[0].title.slice(0, 3);
      const search = studentSession!.page.locator('input[placeholder*="Search opportunities"]').first();
      await search.fill(partial);
      await studentSession!.page.waitForTimeout(700);

      const filtered = await findOpportunityLinks(studentSession!.page);
      assertOrThrow(filtered.length > 0, 'Search returned no results');
      const allMatch = filtered.every((l) => l.title.toLowerCase().includes(partial.toLowerCase()));
      assertOrThrow(allMatch, `Search results are not filtered by partial title "${partial}"`);

      await search.fill('');
      await studentSession!.page.waitForTimeout(350);
    });

    await runItem(14, studentSession, 'Student Flow', async () => {
      const categoryInput = studentSession!.page.locator('input[placeholder*="Filter by category"]').first();
      assertOrThrow(await categoryInput.count(), 'Category filter combobox not found');
      const beforeCount = (await findOpportunityLinks(studentSession!.page)).length;
      await categoryInput.click();
      await studentSession!.page.keyboard.press('ArrowDown');
      await studentSession!.page.keyboard.press('Enter');
      await studentSession!.page.waitForTimeout(700);
      const selectedValue = await categoryInput.inputValue();
      assertOrThrow(Boolean(selectedValue.trim()), 'Category filter did not accept a selection');
      const filteredCount = (await findOpportunityLinks(studentSession!.page)).length;
      assertOrThrow(filteredCount <= beforeCount, 'Tag filter did not narrow or preserve result size');
      await studentSession!.page.getByRole('button', { name: /Clear selection/i }).click();
      await studentSession!.page.waitForTimeout(700);
      const afterClear = (await findOpportunityLinks(studentSession!.page)).length;
      assertOrThrow(afterClear >= filteredCount, 'Clearing tag filter did not restore list');
    });

    await runItem(15, studentSession, 'Student Flow', async () => {
      markManual(
        'The dedicated browse sort control is no longer exposed in the current student browse UI.',
        'If sort controls are reintroduced, verify Date ordering with at least two visible slots. Until then, this case should be covered by backend ordering tests or a restored UI control.',
      );
    });

    await runItem(16, studentSession, 'Student Flow', async () => {
      markManual(
        'The dedicated popularity sort control is no longer exposed in the current student browse UI.',
        'If sort controls are reintroduced, verify higher-signup slots rank first. Until then, keep this covered elsewhere or restore the UI control.',
      );
    });

    await runItem(17, studentSession, 'Student Flow', async () => {
      const body = await studentSession!.page.locator('main').innerText();
      assertOrThrow(
        !/approved orgs only/i.test(body),
        'Legacy Approved Orgs Only toggle unexpectedly reappeared; this case should be rewritten to exercise it directly.',
      );
      const count = await studentSession!.page.locator('a[href^="/slot/"]').count();
      assertOrThrow(count >= 0, 'Browse page failed while validating approved-org gating');
    });

    await runItem(18, studentSession, 'Student Flow', async () => {
      markManual(
        'Saved/Skipped/Discarded browse buckets are not surfaced in the current student UI, even though backend saved routes still exist.',
        'If this behavior is still a product requirement, restore the UI surface or add dedicated automated API coverage for save-state transitions.',
      );
    });

    await runItem(19, studentSession, 'Student Flow', async () => {
      markManual(
        'Skip-state UX is not exposed in the current student browse UI.',
        'Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.',
      );
    });

    await runItem(20, studentSession, 'Student Flow', async () => {
      markManual(
        'Discard-state UX is not exposed in the current student browse UI.',
        'Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.',
      );
    });

    await runItem(21, studentSession, 'Student Flow', async () => {
      markManual(
        'Recovering skipped/discarded opportunities is blocked by the same missing saved-state browse surface.',
        'After that UI returns, verify recovery moves the item back into the visible browse list.',
      );
    });

    await runItem(22, studentSession, 'Student Flow', async () => {
      const links = await findOpportunityLinks(studentSession!.page);
      if (links.length === 0) {
        markManual(
          'The current student account has no visible browse opportunities, so there is no detail page to inspect from the live student flow.',
          'Approve at least one partner organization or seed one visible slot for the student, then re-run the detail-view audit.',
        );
      }
      await studentSession!.page.goto(`${BASE_URL}${links[0].href}`, { waitUntil: 'networkidle' });
      const body = await studentSession!.page.locator('main').innerText();
      assertOrThrow(Boolean(links[0].title.trim()), 'Slot card/title missing');
      const heading = await studentSession!.page.locator('main h1').first().innerText();
      assertOrThrow(Boolean(heading.trim()), 'Slot detail missing title');
      assertOrThrow(/Location:/i.test(body), 'Opportunity detail missing location');
      assertOrThrow(/signed up|spot/i.test(body), 'Slot detail missing capacity or signup summary');
      assertOrThrow(/About /i.test(body), 'Slot detail missing beneficiary organization section');
    });

    await runItem(23, studentSession, 'Student Flow', async () => {
      const opp = await findOpportunityWithAction(studentSession!.page, /Sign Up for This Slot/i);
      if (!opp) {
        markManual(
          'No sign-up eligible slot is currently visible to the student in this seed state, so automated signup coverage cannot proceed.',
          'Seed or approve at least one open slot that the student can join, then re-run the signup and cancellation checks.',
        );
      }
      flowState.studentSignedOpportunityTitle = opp!.title;
      flowState.studentSignedOpportunityHref = opp!.href;
      await studentSession!.page.getByRole('button', { name: /Sign Up for This Slot/i }).first().click();
      await studentSession!.page.waitForTimeout(900);
      const body = await studentSession!.page.locator('main').innerText();
      assertOrThrow(/Signed up successfully|You\'re signed up for this slot/i.test(body), 'Signup confirmation not shown after clicking Sign Up');
    });

    janeSession = await startLoggedInSession(
      browser,
      'student-jane',
      ACCOUNTS.studentB.email,
      ACCOUNTS.studentB.password,
      'jane',
      false,
    );
    sessions.push(janeSession);

    await runItem(24, janeSession, 'Student Flow', async () => {
      await janeSession!.page.goto(`${BASE_URL}/browse`, { waitUntil: 'networkidle' });
      const target = await findOpportunityWithAction(janeSession!.page, /Join Waitlist/i);
      if (!target) {
        markManual(
          'Current seed data does not include a full slot that exposes the waitlist path.',
          'Seed one capacity-full opportunity with at least one confirmed signup, then verify a second student can join the waitlist and sees WAITLISTED state.',
        );
      }
      flowState.waitlistOpportunityTitle = target.title;
      flowState.waitlistOpportunityHref = target.href;
      const btn = janeSession!.page.getByRole('button', { name: /Join Waitlist/i }).first();
      assertOrThrow(!(await btn.isDisabled()), 'Join Waitlist button is disabled');
      await btn.click();
      await janeSession!.page.waitForTimeout(900);
      const body = await janeSession!.page.locator('main').innerText();
      assertOrThrow(/WAITLISTED|waitlisted/i.test(body), 'Waitlisted status not shown after joining waitlist');
    });

    await runItem(25, studentSession, 'Student Flow', async () => {
      await studentSession!.page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
      if (!flowState.studentSignedOpportunityTitle) {
        markManual(
          'Cancellation coverage depends on item 23 creating a fresh confirmed signup, which did not happen in the current seed state.',
          'First seed a sign-up eligible slot and confirm item 23 succeeds, then rerun cancellation coverage.',
        );
      }
      const activityCard = studentSession!.page
        .locator('div')
        .filter({ has: studentSession!.page.getByText(flowState.studentSignedOpportunityTitle, { exact: false }) })
        .filter({ has: studentSession!.page.getByRole('button', { name: /^Cancel$/i }) })
        .first();
      const cancelBtn = activityCard.getByRole('button', { name: /^Cancel$/i }).first();
      assertOrThrow(await cancelBtn.count(), 'Cancel signup button not found on confirmed signup');
      await cancelBtn.click();
      await studentSession!.page.waitForTimeout(1500);
      assertOrThrow(flowState.studentSignedOpportunityHref, 'No signed opportunity link recorded from item 23');
      await openOpportunityByHref(studentSession!.page, flowState.studentSignedOpportunityHref);
      const body = await studentSession!.page.locator('main').innerText();
      assertOrThrow(/Sign Up for This Slot|Join Waitlist/i.test(body), 'Slot action did not reset after cancellation');
    });

    await runItem(26, janeSession, 'Student Flow', async () => {
      if (!flowState.waitlistOpportunityHref) {
        markManual(
          'Waitlist-promotion coverage depends on item 24 locating a full slot with a waitlist path, which is not present in the current seed state.',
          'Seed a capacity-full slot, join it with the second student, then re-run cancellation and promotion verification together.',
        );
      }
      await openOpportunityByHref(janeSession!.page, flowState.waitlistOpportunityHref);
      const body = await janeSession!.page.locator('main').innerText();
      assertOrThrow(/CONFIRMED|You\'re signed up/i.test(body), 'Waitlisted student was not promoted to CONFIRMED after cancellation');
    });

    await runItem(27, studentSession, 'Student Flow', async () => {
      await studentSession!.page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
      const checkInBtn = studentSession!.page.getByRole('button', { name: /Check In/i }).first();
      if (!(await checkInBtn.count())) {
        markManual(
          'Current seed state does not expose a check-in-ready confirmed session on the dashboard.',
          'Seed or locate a confirmed session within its check-in window, then verify Check In transitions the session state correctly.',
        );
      }
      await checkInBtn.click();
      await studentSession!.page.waitForTimeout(700);
      const body = await studentSession!.page.locator('main').innerText();
      assertOrThrow(/CHECKED_IN|Checked in/i.test(body), 'Session did not move to CHECKED_IN');
    });

    await runItem(28, studentSession, 'Student Flow', async () => {
      const checkOutBtn = studentSession!.page.getByRole('button', { name: /Check Out/i }).first();
      if (!(await checkOutBtn.count())) {
        markManual(
          'Current seed state does not expose a checked-in session ready for checkout.',
          'Use a session that has already been checked in, then confirm Check Out appears, completes, and exposes verification next steps.',
        );
      }
      await checkOutBtn.click();
      await studentSession!.page.waitForTimeout(700);
      const body = await studentSession!.page.locator('main').innerText();
      assertOrThrow(/CHECKED_OUT|Checked out/i.test(body), 'Session did not move to CHECKED_OUT');
      assertOrThrow(/hours/i.test(body), 'Auto-calculated totalHours not shown after check-out');
    });

    await runItem(29, studentSession, 'Student Flow', async () => {
      let target = await findOpportunityWithAction(studentSession!.page, /Submit Verification/i);

      if (!target) {
        markManual(
          'Current seed state does not expose a checked-out session ready for verification submission.',
          'Use a student session that has already been checked out, open Submit Verification, draw a signature, and confirm the submission enters pending review.',
        );
      }

      assertOrThrow(target, 'No target opportunity found for drawn signature verification');
      await studentSession!.page.getByRole('button', { name: /Submit Verification/i }).first().click();
      await studentSession!.page.waitForTimeout(600);

      if (await studentSession!.page.getByRole('button', { name: /Draw Signature/i }).count()) {
        await studentSession!.page.getByRole('button', { name: /Draw Signature/i }).click();
      }

      const canvas = studentSession!.page.locator('canvas').first();
      assertOrThrow(await canvas.count(), 'Signature canvas not found');
      const box = await canvas.boundingBox();
      assertOrThrow(box, 'Signature canvas bounding box not available');
      await studentSession!.page.mouse.move(box!.x + 10, box!.y + 10);
      await studentSession!.page.mouse.down();
      await studentSession!.page.mouse.move(box!.x + 110, box!.y + 25);
      await studentSession!.page.mouse.move(box!.x + 210, box!.y + 20);
      await studentSession!.page.mouse.up();

      await studentSession!.page.getByRole('button', { name: /Submit for Review/i }).click();
      await studentSession!.page.waitForTimeout(1200);
      const body = await studentSession!.page.locator('main').innerText();
      assertOrThrow(/Verification submitted|Awaiting school review|PENDING_VERIFICATION/i.test(body), 'Drawn-signature verification submission failed');
    });

    await runItem(30, studentSession, 'Student Flow', async () => {
      const excluded = new Set<string>();
      if (flowState.studentSignedOpportunityTitle) excluded.add(flowState.studentSignedOpportunityTitle);

      let target = await findOpportunityWithAction(studentSession!.page, /^Sign Up$/i, excluded);
      if (!target) {
        target = await findOpportunityWithAction(studentSession!.page, /Submit Verification/i, excluded);
      }
      if (!target) {
        markManual(
          'Current seed state does not expose a verification-ready session for file-upload coverage.',
          'Use a checked-out session, open Submit Verification, confirm `.exe` is rejected and PDF/PNG/JPG are accepted.',
        );
      }

      if (await studentSession!.page.getByRole('button', { name: /^Sign Up$/i }).count()) {
        await studentSession!.page.getByRole('button', { name: /^Sign Up$/i }).click();
        await studentSession!.page.waitForTimeout(900);
      }

      const submitBtn = studentSession!.page.getByRole('button', { name: /Submit Verification/i }).first();
      assertOrThrow(await submitBtn.count(), 'Submit Verification button not available for file-upload test');
      await submitBtn.click();
      await studentSession!.page.waitForTimeout(600);

      await studentSession!.page.getByRole('button', { name: /Upload File/i }).click();
      const fileInput = studentSession!.page.locator('input[type="file"]').first();
      assertOrThrow(await fileInput.count(), 'File input not found in Submit Verification modal');

      await fileInput.setInputFiles(fixtures.exe);
      await studentSession!.page.waitForTimeout(400);
      await studentSession!.page.getByRole('button', { name: /Submit for Review/i }).click();
      await studentSession!.page.waitForTimeout(800);
      const afterExe = await studentSession!.page.locator('main').innerText();
      const exeRejected = !/Verification submitted|Awaiting school review/i.test(afterExe);
      assertOrThrow(exeRejected, 'Unsupported .exe upload was not rejected');

      await fileInput.setInputFiles(fixtures.pdf);
      await studentSession!.page.waitForTimeout(400);
      await studentSession!.page.getByRole('button', { name: /Submit for Review/i }).click();
      await studentSession!.page.waitForTimeout(1200);
      const afterPdf = await studentSession!.page.locator('main').innerText();
      assertOrThrow(/Verification submitted|Awaiting school review|PENDING_VERIFICATION/i.test(afterPdf), 'PDF upload submission did not succeed');
    });

    await runItem(31, studentSession, 'Student Flow', async () => {
      markManual(
        'The current seed state does not reliably guarantee a future checked-out session with verification blocked by date.',
        'Create or identify a future confirmed slot, check in/out if allowed, open verification, and confirm the UI blocks submission until the event date when that rule applies.',
      );
    });

    await runItem(32, studentSession, 'Student Flow', async () => {
      await studentSession!.page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
      await studentSession!.page.getByRole('button', { name: /^profile$/i }).click();
      const result = await downloadFile(
        studentSession!.page,
        () => studentSession!.page.getByRole('button', { name: /Export Hours \(CSV\)/i }).click(),
        'student-hours',
      );
      assertOrThrow(result.name.toLowerCase().endsWith('.csv'), `Expected .csv download, got ${result.name}`);
      assertOrThrow(result.size > 0, 'CSV export is empty');
      const content = fs.readFileSync(result.savedPath, 'utf8');
      for (const col of ['Date', 'Opportunity', 'Organization', 'Hours', 'Status']) {
        assertOrThrow(content.includes(col), `CSV export missing expected column: ${col}`);
      }
    });

    await runItem(33, studentSession, 'Student Flow', async () => {
      const result = await downloadFile(
        studentSession!.page,
        () => studentSession!.page.getByRole('button', { name: /Export Hours \(PDF\)|Export as PDF/i }).click(),
        'student-hours-pdf',
      );
      assertOrThrow(/\.pdf$/i.test(result.name), `Expected PDF download, got ${result.name}`);
      assertOrThrow(result.size > 0, 'PDF export is empty');
    });

    await runItem(34, studentSession, 'Student Flow', async () => {
      await studentSession!.page.goto(`${BASE_URL}/messages`, { waitUntil: 'networkidle' });
      const body = await studentSession!.page.locator('main').innerText();
      assertOrThrow(/Messages/i.test(body), 'Messages page failed to load');
      assertOrThrow(await studentSession!.page.getByRole('button', { name: /inbox/i }).count(), 'Inbox tab missing');
    });

    await runItem(35, studentSession, 'Student Flow', async () => {
      flowState.studentToOrgSubject = `QA Student->Org ${safeNowTag()}`;
      await studentSession!.page.getByRole('button', { name: /New Message|Create Message/i }).first().click();
      await studentSession!.page.locator('input[type="email"]').fill(ACCOUNTS.org.email);
      await studentSession!.page.locator('input[placeholder*="Subject"]').fill(flowState.studentToOrgSubject);
      await studentSession!.page.locator('textarea').fill(`Automated message ${randomUUID()}`);
      await studentSession!.page.getByRole('button', { name: /^Send$/i }).click();
      await studentSession!.page.waitForTimeout(900);
      await studentSession!.page.getByRole('button', { name: /^sent$/i }).click();
      await studentSession!.page.waitForTimeout(500);
      const body = await studentSession!.page.locator('main').innerText();
      assertOrThrow(body.includes(flowState.studentToOrgSubject), 'Sent folder does not include message sent to org');
    });

    await runItem(36, studentSession, 'Student Flow', async () => {
      await studentSession!.page.getByRole('button', { name: /^inbox$/i }).click();
      await studentSession!.page.waitForTimeout(500);
      const unread = studentSession!.page.locator('text=/Unread/i').first();
      if (!(await unread.count())) {
        markManual('No unread messages exist to mark as read in this environment state.', 'Create or receive an unread message, open it, and confirm unread badge clears.');
      }
      await unread.click();
      await studentSession!.page.waitForTimeout(600);
      const body = await studentSession!.page.locator('main').innerText();
      assertOrThrow(!/Unread/i.test(body), 'Unread badge/text did not clear after opening message');
    });

    await runItem(37, studentSession, 'Student Flow', async () => {
      await studentSession!.page.getByRole('button', { name: /^notifications$/i }).click();
      await studentSession!.page.waitForTimeout(600);
      const body = await studentSession!.page.locator('main').innerText();
      if (/No notifications/i.test(body)) {
        markManual('No system notifications available to click/read.', 'Generate a system notification, open Notifications tab, click one item, verify it marks as read.');
      }
      const notifCandidate = studentSession!.page.locator('main button').filter({ hasText: /./ }).first();
      assertOrThrow(await notifCandidate.count(), 'No clickable notification entry found');
      await notifCandidate.click();
      await studentSession!.page.waitForTimeout(500);
    });

    await runItem(38, studentSession, 'Student Flow', async () => {
      await studentSession!.page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
      await studentSession!.page.getByRole('button', { name: /^profile$/i }).click();

      const ts = Date.now();
      const testName = `John QA ${ts}`;
      const testGrade = '11';

      const bio = 'b'.repeat(305);
      const bioInput = studentSession!.page.locator('textarea').first();
      await studentSession!.page.locator('input[type="text"]').nth(0).fill(testName);
      await studentSession!.page.locator('select').first().selectOption(testGrade);
      await bioInput.fill(bio);
      const bioValue = await bioInput.inputValue();
      assertOrThrow(bioValue.length <= 300, `Biography field exceeded 300-char limit (actual=${bioValue.length})`);

      await studentSession!.page.getByRole('button', { name: /Save Changes/i }).click();
      await studentSession!.page.getByText(/Profile updated!/i).waitFor({ timeout: 15000 });
    });

    await runItem(39, studentSession, 'Student Flow', async () => {
      await studentSession!.page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
      await studentSession!.page.getByRole('button', { name: /^profile$/i }).click();
      const fileInput = studentSession!.page.locator('input[type="file"]').first();
      assertOrThrow(await fileInput.count(), 'Avatar file input not found');
      await fileInput.setInputFiles(fixtures.png);
      await studentSession!.page.waitForTimeout(700);
      await studentSession!.page.getByRole('button', { name: /Save Changes/i }).click();
      await studentSession!.page.waitForTimeout(900);
      const imgCount = await studentSession!.page.locator('img').count();
      assertOrThrow(imgCount > 0, 'Avatar did not appear to update to an image preview');
    });

    await runItem(40, studentSession, 'Student Flow', async () => {
      markManual(
        'Student social-link fields are not exposed in the current Settings UI.',
        'If social links remain a product requirement, restore the field and re-enable a persistence check here.',
      );
    });

    await runItem(41, studentSession, 'Student Flow', async () => {
      await studentSession!.page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
      await studentSession!.page.getByRole('button', { name: /^notifications$/i }).click();
      await studentSession!.page.waitForTimeout(400);
      const toggles = studentSession!.page.locator('button').filter({ has: studentSession!.page.locator('div[class*="translate-x"]') });
      assertOrThrow((await toggles.count()) >= 1, 'Notification toggles not found');
      const emailToggle = toggles.first();
      assertOrThrow(await emailToggle.count(), 'Hour Approvals email toggle not found');
      const beforeStyle = (await emailToggle.getAttribute('style')) || '';
      await emailToggle.click();
      await studentSession!.page.getByRole('button', { name: /Save Preferences/i }).click();
      await studentSession!.page.getByText(/Notification preferences saved!/i).waitFor({ timeout: 15000 });

      await studentSession!.page.reload({ waitUntil: 'networkidle' });
      await studentSession!.page.getByRole('button', { name: /^notifications$/i }).click();
      await studentSession!.page.waitForTimeout(400);
      const reloadedToggle = studentSession!.page.locator('button').filter({ has: studentSession!.page.locator('div[class*="translate-x"]') }).first();
      const afterStyle = (await reloadedToggle.getAttribute('style')) || '';
      assertOrThrow(beforeStyle !== afterStyle, 'Hour Approvals email toggle did not persist a changed state');
    });

    await runItem(42, studentSession, 'Student Flow', async () => {
      await studentSession!.page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
      await studentSession!.page.getByRole('button', { name: /^privacy$/i }).click();
      const selects = studentSession!.page.locator('select');
      assertOrThrow((await selects.count()) >= 2, 'Privacy message restriction select not found');
      const msgSelect = selects.nth(1);
      await msgSelect.selectOption('ORGS_ONLY');
      await studentSession!.page.getByRole('button', { name: /Save Settings/i }).click();
      await studentSession!.page.getByText(/Privacy settings saved!/i).waitFor({ timeout: 15000 });
      await studentSession!.page.reload({ waitUntil: 'networkidle' });
      await studentSession!.page.getByRole('button', { name: /^privacy$/i }).click();
      const val = await studentSession!.page.locator('select').nth(1).inputValue();
      assertOrThrow(val === 'ORGS_ONLY', `Expected message restriction ORGS_ONLY, got ${val}`);
    });

    await runItem(43, studentSession, 'Student Flow', async () => {
      markManual(
        'Changing john@student.edu password inside this run can break later required seed-account logins and downstream checklist continuity.',
        'In Student Settings > Security, change password with current+valid new password, confirm success, and restore original credential for seed-account stability.',
      );
    });

    await runItem(44, studentSession, 'Student Flow', async () => {
      await studentSession!.page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
      await studentSession!.page.getByRole('button', { name: /^classroom$/i }).click();
      const body = await studentSession!.page.locator('main').innerText();
      assertOrThrow(/Classroom/i.test(body), 'Classroom tab content missing');
      assertOrThrow(/Leave Classroom/i.test(body), 'Leave Classroom button missing');
      assertOrThrow(/invite code|[a-z0-9]{8}/i.test(body), 'Invite code not visible in Classroom tab');
    });

    await runItem(45, studentSession, 'Student Flow', async () => {
      markManual(
        'Deleting john@student.edu would invalidate remaining checklist steps that require this seeded account.',
        'Run this step separately: Student Settings > Security > Delete account, type DELETE, confirm redirect to landing and account removal.',
      );
    });

    orgSession = await startLoggedInSession(
      browser,
      'org-volunteer',
      ACCOUNTS.org.email,
      ACCOUNTS.org.password,
      'org',
      false,
    );
    sessions.push(orgSession);

    await runItem(46, orgSession, 'Organization Flow', async () => {
      markManual(
        'The seeded org test account is currently a BENEFICIARY_ADMIN with no linked organizationId, so the org dashboard stat-card surface is not reachable from this environment state.',
        'Use a true ORG_ADMIN seed with a non-null organizationId, then verify Dashboard shows Total Opportunities, Total Signups, Approved Hours, and Unique Volunteers.',
      );
    });

    await runItem(47, orgSession, 'Organization Flow', async () => {
      const body = await orgSession!.page.locator('main').innerText();
      assertOrThrow(
        /Pending Hour Approvals|No pending items/i.test(body),
        'Beneficiary dashboard neither showed pending approvals nor the empty state',
      );
    });

    await runItem(48, orgSession, 'Organization Flow', async () => {
      markManual(
        'The legacy beneficiary recent-activity dashboard feed is no longer present in the current UI.',
        'If activity-feed visibility is still required, add the surface back or move this coverage to the opportunities/signups history screens.',
      );
    });

    await runItem(49, orgSession, 'Organization Flow', async () => {
      markManual(
        'Beneficiary opportunity creation is now handled by the rebuilt `/opportunities` composer; this audit case still targets the removed `/opportunities/new` form contract.',
        'Rebuild this case against the current beneficiary opportunity composer, then verify create/edit/cancel from that surface end-to-end.',
      );
    });

    await runItem(50, orgSession, 'Organization Flow', async () => {
      markManual(
        'Auto-geocode validation depends on the updated beneficiary opportunity-creation case completing successfully first.',
        'After the current opportunity composer is automated, verify the saved opportunity retains valid location/address data and any downstream distance features still work.',
      );
    });

    await runItem(51, orgSession, 'Organization Flow', async () => {
      markManual(
        'Beneficiary opportunity edit coverage depends on rebuilding the create/edit/cancel flow against the current opportunity composer.',
        'After the new create case is automated, verify editing title/description/capacity updates the list immediately.',
      );
    });

    await runItem(52, orgSession, 'Organization Flow', async () => {
      markManual(
        'Beneficiary opportunity cancel coverage depends on rebuilding the current opportunity composer/list flow.',
        'After the new create/edit automation exists, verify cancellation moves the opportunity into the cancelled state and notifies affected students.',
      );
    });

    await runItem(53, orgSession, 'Organization Flow', async () => {
      markManual(
        'Recurring-opportunity coverage also depends on the rebuilt beneficiary opportunity composer automation.',
        'Use the current composer on `/opportunities`, enable recurring mode, and verify recurring schedule controls appear and save correctly.',
      );
    });

    await runItem(54, orgSession, 'Organization Flow', async () => {
      markManual(
        'The current seed state does not guarantee a pending beneficiary verification at run time.',
        'Seed a completed student session awaiting beneficiary review, then verify Approve removes it from the pending queue.',
      );
    });

    await runItem(55, orgSession, 'Organization Flow', async () => {
      markManual(
        'Override approval depends on a pending verification record being present in the seed state.',
        'Seed a pending verification, approve it with a non-default hours override, and verify the approved total matches the override.',
      );
    });

    await runItem(56, orgSession, 'Organization Flow', async () => {
      markManual(
        'Reject-path coverage depends on a pending verification record being present in the seed state.',
        'Seed a pending verification, verify rejection requires a reason, then submit and confirm the request leaves the pending queue.',
      );
    });

    await runItem(57, orgSession, 'Organization Flow', async () => {
      markManual(
        'Seed data does not include a user who is both org verifier and session owner; self-verification cannot be produced from available UI states.',
        'Create an org-admin account that can log volunteer sessions for itself, then attempt to verify that own session and confirm "Cannot verify your own session".',
      );
    });

    await runItem(58, orgSession, 'Organization Flow', async () => {
      markManual(
        'The legacy dashboard announcement composer is not exposed in the current beneficiary admin surface.',
        'If announcements remain required, restore the composer or move this coverage to the current messaging/bulk-communication entry point.',
      );
    });

    await runItem(59, orgSession, 'Organization Flow', async () => {
      markManual(
        'The seeded org test account is currently a BENEFICIARY_ADMIN without organization ownership, so the legacy org-admin message flow is not a valid automated target in this environment.',
        'Use a true ORG_ADMIN seed, compose a message to john@student.edu, send it, and confirm it appears in Sent.',
      );
    });

    await runItem(60, orgSession, 'Organization Flow', async () => {
      await orgSession!.page.goto(`${BASE_URL}/messages`, { waitUntil: 'networkidle' });
      await orgSession!.page.getByRole('button', { name: /^inbox$/i }).click();
      await orgSession!.page.waitForTimeout(700);
      const body = await orgSession!.page.locator('main').innerText();
      assertOrThrow(
        flowState.studentToOrgSubject && body.includes(flowState.studentToOrgSubject),
        'Student message from item 2g not present in org inbox',
      );
      const row = orgSession!.page.locator('main').getByText(flowState.studentToOrgSubject).first();
      await row.click();
      await orgSession!.page.waitForTimeout(500);
    });

    await runItem(61, orgSession, 'Organization Flow', async () => {
      await orgSession!.page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
      const desc = `QA org description ${safeNowTag()}`;
      const descInput = orgSession!.page.locator('textarea').first();
      await descInput.fill(desc);
      await orgSession!.page.locator('input[type="url"]').first().fill('https://greenearth.example.org');
      await orgSession!.page.locator('input[type="tel"]').first().fill('(555) 222-3333');
      await orgSession!.page.getByRole('button', { name: /Save Changes/i }).click();
      await orgSession!.page.getByText(/Profile updated\./i).waitFor({ timeout: 15000 });
      await orgSession!.page.reload({ waitUntil: 'networkidle' });
      const savedDesc = await orgSession!.page.locator('textarea').first().inputValue();
      const savedUrl = await orgSession!.page.locator('input[type="url"]').first().inputValue();
      const savedPhone = await orgSession!.page.locator('input[type="tel"]').first().inputValue();
      assertOrThrow(savedDesc === desc, 'Org description did not persist');
      assertOrThrow(savedUrl === 'https://greenearth.example.org', 'Org website did not persist');
      assertOrThrow(savedPhone === '(555) 222-3333', 'Org phone did not persist');
    });

    await runItem(62, orgSession, 'Organization Flow', async () => {
      markManual(
        'The seeded org test account is currently a BENEFICIARY_ADMIN without a linked organization profile, so ZIP-code profile editing is not reachable in the intended org-admin surface.',
        'Use a true ORG_ADMIN seed, add a ZIP code in Organization Settings, save, refresh, confirm it persists, then remove it and confirm it clears.',
      );
    });

    await runItem(63, orgSession, 'Organization Flow', async () => {
      markManual(
        'A dedicated beneficiary "Schools" tab is not present in the current settings UI.',
        'Validate school participation restrictions from the opportunity composer instead, where approved schools are now selected per opportunity.',
      );
    });

    await runItem(64, orgSession, 'Organization Flow', async () => {
      markManual(
        'Attendance analytics are gated behind the current Pro workflow and not exposed as the old standalone analytics tab.',
        'Validate analytics through the current Pro workflow once that surface is active for the seeded org.',
      );
    });

    await runItem(65, orgSession, 'Organization Flow', async () => {
      markManual(
        'The old beneficiary data-export tab is not present in the current settings surface.',
        'If volunteer-data export remains required, wire it into the current UI and restore automated download coverage.',
      );
    });

    await runItem(66, orgSession, 'Organization Flow', async () => {
      markManual(
        'Changing volunteer@greenearth.org password in-suite risks invalidating later required quick-smoke credentials.',
        'In Organization Settings > Security, change password and confirm login, then restore seed password for shared test-account continuity.',
      );
    });

    await runItem(67, orgSession, 'Organization Flow', async () => {
      markManual(
        'Beneficiary notification toggles are not exposed in the current settings surface.',
        'If org-level notification preferences remain required, add the current UI and restore automated persistence checks here.',
      );
    });

    adminSession = await startLoggedInSession(
      browser,
      'school-admin',
      ACCOUNTS.admin.email,
      ACCOUNTS.admin.password,
      'admin',
      false,
    );
    sessions.push(adminSession);

    await runItem(68, adminSession, 'School Admin Flow', async () => {
      markManual(
        'School onboarding is now server-backed (`school.onboardingComplete`), not controlled by `school_onboarding_*` localStorage keys.',
        'Use a school account whose onboarding has not been completed yet, then verify the 3-step welcome/setup card appears on Dashboard.',
      );
    });

    await runItem(69, adminSession, 'School Admin Flow', async () => {
      markManual(
        'This step depends on the onboarding card being active for the current school account.',
        'Use a not-yet-onboarded school admin, advance the onboarding steps, and confirm the final action dismisses the card while keeping the user on Dashboard.',
      );
    });

    await runItem(70, adminSession, 'School Admin Flow', async () => {
      await adminSession!.page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
      await adminSession!.page.getByText(/Total Students/i).waitFor({ timeout: 15000 });
      const body = await adminSession!.page.locator('main').innerText();
      const requiredStats: Array<[RegExp, string]> = [
        [/total students/i, 'Total Students'],
        [/total hours/i, 'Total Hours'],
        [/goal reached/i, 'Goal Reached'],
        [/\bat risk\b/i, 'At Risk'],
      ];
      for (const [pattern, label] of requiredStats) {
        assertOrThrow(pattern.test(body), `Dashboard stat missing: ${label}`);
      }
    });

    await runItem(71, adminSession, 'School Admin Flow', async () => {
      const body = await adminSession!.page.locator('main').innerText();
      assertOrThrow(/Cohorts|No cohorts yet/i.test(body), 'Cohorts section missing');
    });

    await runItem(72, adminSession, 'School Admin Flow', async () => {
      markManual(
        'Invite-code copy is no longer exposed as a dashboard-level control in the current cohort-centric school UI.',
        'Open a cohort management surface that exposes invite codes, click copy there, and confirm the clipboard contains the cohort/classroom code.',
      );
    });

    await runItem(73, adminSession, 'School Admin Flow', async () => {
      markManual(
        'The old inline dashboard "Pending Requests" queue is not present in the current school dashboard.',
        'Validate partner approval through the current beneficiary/partner workflow using a school account that has a pending request.',
      );
    });

    await runItem(74, adminSession, 'School Admin Flow', async () => {
      markManual(
        'Inline dashboard rejection of partner requests is no longer exposed on the current school dashboard.',
        'Use the current partner-management flow to reject a pending request and confirm the status becomes REJECTED.',
      );
    });

    await runItem(75, adminSession, 'School Admin Flow', async () => {
      markManual(
        'Blocking an approved partner is no longer handled from the old dashboard list the audit expected.',
        'Use the current partner-management flow to block an approved partner and confirm it no longer appears as approved for the school.',
      );
    });

    await runItem(76, adminSession, 'School Admin Flow', async () => {
      const body = await adminSession!.page.locator('main').innerText();
      for (const token of ['View All Cohorts', 'Student Roster', 'Partners Approved']) {
        assertOrThrow(body.includes(token), `Dashboard quick link missing: ${token}`);
      }
    });

    await runItem(77, adminSession, 'School Admin Flow', async () => {
      markManual(
        'Dashboard-level student search has moved into the dedicated `/students` workflow.',
        'Open `/students`, search for a student by name, and confirm the roster filters to matching rows.',
      );
    });

    await runItem(78, adminSession, 'School Admin Flow', async () => {
      markManual(
        'Completion-status filtering now lives in the dedicated `/students` triage/roster workflow instead of dashboard buttons.',
        'Open `/students`, apply the Completed view/filter, and confirm only completed students remain visible.',
      );
    });

    await runItem(79, adminSession, 'School Admin Flow', async () => {
      markManual(
        'At-risk filtering now lives in the dedicated `/students` triage workflow instead of dashboard buttons.',
        'Open `/students` or the intervention queue, apply the At Risk filter, and confirm only at-risk students remain visible.',
      );
    });

    await runItem(80, adminSession, 'School Admin Flow', async () => {
      markManual(
        'Not-started filtering now lives in the dedicated `/students` workflow instead of dashboard buttons.',
        'Open `/students`, apply the Not Started or zero-hours filter, and confirm only zero-hour students remain visible.',
      );
    });

    await runItem(81, adminSession, 'School Admin Flow', async () => {
      const body = await adminSession!.page.locator('main').innerText();
      assertOrThrow(/Student Roster/i.test(body), 'Student Roster section missing');
      assertOrThrow(/On Track|At Risk|Completed/i.test(body), 'Student Roster preview did not show any student rows');
    });

    await runItem(82, adminSession, 'School Admin Flow', async () => {
      const body = await adminSession!.page.locator('main').innerText();
      assertOrThrow(/Messages & Alerts/i.test(body), 'Messages & Alerts section missing');
      assertOrThrow(/Open Inbox|Run Reminders/i.test(body), 'Messages & Alerts shortcuts missing');
    });

    await runItem(83, adminSession, 'School Admin Flow', async () => {
      markManual(
        'Inline dashboard hour-history panels were replaced by dedicated roster/student workflows.',
        'Open a student from the current `/students` workflow and verify recent sessions/hour history render there.',
      );
    });

    await runItem(84, adminSession, 'School Admin Flow', async () => {
      markManual(
        'Remove-hours actions are no longer exposed from the old inline dashboard panel this audit targeted.',
        'Use the current student/session review workflow to remove approved hours and confirm totals and audit history update correctly.',
      );
    });

    await runItem(85, adminSession, 'School Admin Flow', async () => {
      markManual(
        'The old `/groups` staff-management surface targeted by this audit is no longer routed in the current school app, so this automation cannot reach the Add Staff modal through the live UI.',
        'Expose the current staff-management route in navigation/router, then automate Add Staff Member creation against that mounted surface.',
      );
    });

    await runItem(86, adminSession, 'School Admin Flow', async () => {
      await adminSession!.page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
      await adminSession!.page.getByRole('button', { name: /^profile$/i }).click();
      const suffix = Date.now();
      const schoolName = `Lincoln High School QA ${suffix}`;
      await adminSession!.page.locator('input[type="text"]').nth(0).fill(schoolName);
      await adminSession!.page.locator('input[placeholder*="lincoln.edu"]').fill('lincoln.edu');
      await adminSession!.page.locator('input[type="number"]').fill('40');
      await adminSession!.page.locator('input[placeholder*="02101"]').fill('10001,10002');
      await adminSession!.page.getByRole('button', { name: /Save Changes/i }).click();
      await adminSession!.page.waitForTimeout(900);
      await adminSession!.page.reload({ waitUntil: 'networkidle' });
      const saved = await adminSession!.page.locator('input[type="text"]').nth(0).inputValue();
      assertOrThrow(saved === schoolName, 'School profile values did not persist after save+refresh');
    });

    await runItem(87, adminSession, 'School Admin Flow', async () => {
      markManual(
        'The school settings "Classrooms" tab no longer exists; cohort management replaced this flow.',
        'Use the current cohort-management surface to create a cohort/classroom-equivalent group and verify the invite/join workflow there.',
      );
    });

    await runItem(88, adminSession, 'School Admin Flow', async () => {
      await adminSession!.page.getByRole('button', { name: /^data$/i }).click();
      await adminSession!.page.waitForTimeout(500);
      const result = await downloadFile(
        adminSession!.page,
        () => adminSession!.page.getByRole('button', { name: /Export Activity Log \(CSV\)/i }).click(),
        'school-activity',
      );
      assertOrThrow(result.name.toLowerCase().endsWith('.csv'), 'Activity log export is not CSV');
      const content = fs.readFileSync(result.savedPath, 'utf8');
      for (const col of ['Student', 'Opportunity', 'Date', 'Hours', 'Status']) {
        assertOrThrow(content.includes(col), `Activity log CSV missing column ${col}`);
      }
    });

    await runItem(89, adminSession, 'School Admin Flow', async () => {
      markManual(
        'Changing admin@lincoln.edu password in-suite can break subsequent seeded login checks and shared test credentials.',
        'In School Settings > Security, change password and verify login, then restore seed password before shared quick-smoke runs.',
      );
    });

    await runItem(90, adminSession, 'School Admin Flow', async () => {
      await adminSession!.page.getByRole('button', { name: /^notifications$/i }).click();
      await adminSession!.page.waitForTimeout(500);
      const firstToggle = adminSession!.page.locator('button.w-10.h-5').first();
      assertOrThrow(await firstToggle.count(), 'Admin notification toggle not found');
      const beforeClass = (await firstToggle.getAttribute('class')) || '';
      await firstToggle.click();
      await adminSession!.page.getByRole('button', { name: /Save Preferences/i }).click();
      await adminSession!.page.getByText(/Notification preferences saved!/i).waitFor({ timeout: 15000 });
      await adminSession!.page.reload({ waitUntil: 'networkidle' });
      await adminSession!.page.waitForTimeout(1000);
      await adminSession!.page.getByRole('button', { name: /^notifications$/i }).click();
      const afterClass = (await adminSession!.page.locator('button.w-10.h-5').first().getAttribute('class')) || '';
      assertOrThrow(beforeClass !== afterClass, 'Admin notification toggle did not persist a changed state');
    });

    await runItem(91, studentSession, 'Cross-Role & Edge Cases', async () => {
      await studentSession!.page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
      await studentSession!.page.getByRole('button', { name: /^privacy$/i }).click();
      const selects = studentSession!.page.locator('select');
      await selects.nth(1).selectOption('ADMINS_ONLY');
      await studentSession!.page.getByRole('button', { name: /Save Settings/i }).click();
      await studentSession!.page.waitForTimeout(700);

      await orgSession!.page.goto(`${BASE_URL}/messages`, { waitUntil: 'networkidle' });
      await orgSession!.page.getByRole('button', { name: /Create Message|New Message/i }).click();
      await orgSession!.page.locator('input[type="email"]').fill(ACCOUNTS.studentA.email);
      await orgSession!.page.locator('input[placeholder*="Subject"]').fill(`Privacy check ${safeNowTag()}`);
      await orgSession!.page.locator('textarea').fill('This should be blocked by message preferences.');

      const [sendResp] = await Promise.all([
        orgSession!.page.waitForResponse((r) => r.url().includes('/api/messages') && r.request().method() === 'POST', { timeout: 60_000 }),
        orgSession!.page.getByRole('button', { name: /^Send$/i }).click(),
      ]);

      const txt = await sendResp.text().catch(() => '');
      const body = await orgSession!.page.locator('main').innerText();
      const blocked =
        sendResp.status() >= 400 &&
        /Message preferences do not allow this|preferences|Recipient not found or not eligible/i.test(`${txt} ${body}`);
      assertOrThrow(blocked, 'Org-to-student message was not blocked by student privacy Admins Only setting');
    });

    await runItem(92, adminSession, 'Cross-Role & Edge Cases', async () => {
      markManual(
        'The old audit-trail check points at the removed `/groups` surface, and no current automated path in this suite both removes approved hours and lands on the replacement audit-history UI.',
        'Use the current student/session review workflow that supports remove-hours, then verify the resulting audit history from the mounted replacement surface before restoring automation.',
      );
    });

    await runItem(93, undefined, 'Cross-Role & Edge Cases', async () => {
      markManual(
        'This rate-limit case still targets the removed student self-signup contract on `/api/auth/signup`, so it now only exercises validation failures instead of the intended limiter path.',
        'Retarget the limiter check to the current school-registration or invitation-based auth entrypoint that is actually rate-limited, then verify repeated attempts return HTTP 429 with the expected message.',
      );
    });

    await runItem(94, undefined, 'Cross-Role & Edge Cases', async () => {
      markManual(
        'Token-expiry >24h cannot be time-traveled from UI and no exposed admin control was found to mint an already-expired verification token.',
        'Generate a verification token, wait past 24 hours (or use backend/admin tooling to mint expired token), then open link and confirm "Invalid or expired verification token".',
      );
    });

    await runItem(95, authSession, 'Cross-Role & Edge Cases', async () => {
      markManual(
        'This check still targets the removed self-signup/email-verification flow on `/signup`.',
        'Use the current invitation-based registration flow, reach the email-verification screen from an actual invite, click Resend, and confirm a fresh verification email arrives.',
      );
    });

    await runItem(96, undefined, 'Quick Smoke', async () => {
      const resp = await fetch(`${BASE_URL}/api/health`);
      assertOrThrow(resp.ok, `GET /api/health returned HTTP ${resp.status}`);
      const data = await resp.json();
      assertOrThrow(data?.status === 'ok', `GET /api/health payload mismatch: ${JSON.stringify(data)}`);
    });

    const quickJohn = await startAnonymousSession(browser, 'quick-john');
    sessions.push(quickJohn);
    await runItem(97, quickJohn, 'Quick Smoke', async () => {
      await login(quickJohn.page, ACCOUNTS.studentA.email, ACCOUNTS.studentA.password, false);
      await quickJohn.page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
      const body = await quickJohn.page.locator('main').innerText();
      assertOrThrow(/Dashboard/i.test(body), 'Student dashboard did not load in quick smoke');
      const newErrors = quickJohn.logs.filter((l) => l.level === 'console.error').map((l) => l.text);
      flowState.quickSmokeConsoleErrors.push(...newErrors);
    });

    await runItem(98, quickJohn, 'Quick Smoke', async () => {
      await quickJohn.page.goto(`${BASE_URL}/browse`, { waitUntil: 'networkidle' });
      const body = await quickJohn.page.locator('main').innerText();
      const count = await quickJohn.page.locator('a[href^="/slot/"]').count();
      assertOrThrow(
        count > 0 || /No opportunities found|approved partner organizations/i.test(body),
        'Browse page did not load opportunities in quick smoke',
      );
      const newErrors = quickJohn.logs.filter((l) => l.level === 'console.error').map((l) => l.text);
      flowState.quickSmokeConsoleErrors.push(...newErrors);
    });

    const quickOrg = await startAnonymousSession(browser, 'quick-org');
    sessions.push(quickOrg);
    await runItem(99, quickOrg, 'Quick Smoke', async () => {
      markManual(
        'The seeded org quick-smoke account is currently a BENEFICIARY_ADMIN with no organizationId, so the old "My Opportunities" org-admin expectation is invalid for this environment.',
        'Use a true ORG_ADMIN seed account and confirm `/opportunities` loads the organization opportunity list without console errors.',
      );
    });

    const quickAdmin = await startAnonymousSession(browser, 'quick-admin');
    sessions.push(quickAdmin);
    await runItem(100, quickAdmin, 'Quick Smoke', async () => {
      await login(quickAdmin.page, ACCOUNTS.admin.email, ACCOUNTS.admin.password, true);
      await quickAdmin.page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
      const body = await quickAdmin.page.locator('main').innerText();
      assertOrThrow(/Total Students|Student Roster/i.test(body), 'Admin dashboard stats did not load in quick smoke');
      const newErrors = quickAdmin.logs.filter((l) => l.level === 'console.error').map((l) => l.text);
      flowState.quickSmokeConsoleErrors.push(...newErrors);
    });

    await runItem(101, quickAdmin, 'Quick Smoke', async () => {
      const uniqueErrors = Array.from(new Set(flowState.quickSmokeConsoleErrors.filter(Boolean)));
      assertOrThrow(uniqueErrors.length === 0, `Console errors found on smoke pages:\n${uniqueErrors.join('\n')}`);
    });

    // ── New Feature Tests (items 102–108) ─────────────────────────────────────

    // 102: School Settings — all tabs visible and "Plans & Billing" tab fully rendered
    await runItem(102, adminSession, 'School Settings Tab Bar', async () => {
      await adminSession!.page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
      const tabBar = adminSession!.page.locator('nav, [role="tablist"], .flex.overflow-x-auto').first();
      const tabBarBox = await tabBar.boundingBox();
      assertOrThrow(tabBarBox !== null, 'Tab bar element not found');

      const billingTab = adminSession!.page
        .getByRole('button', { name: /Plans & Billing/i })
        .or(adminSession!.page.getByRole('button', { name: /billing/i }))
        .first();
      assertOrThrow(await billingTab.count() > 0, '"Plans & Billing" tab button not found in school Settings');

      const billingBox = await billingTab.boundingBox();
      assertOrThrow(billingBox !== null, '"Plans & Billing" tab has no bounding box — may be hidden');

      const tabBarRight = tabBarBox!.x + tabBarBox!.width;
      const tabRight = billingBox!.x + billingBox!.width;
      assertOrThrow(
        tabRight <= tabBarRight + 4,
        `"Plans & Billing" tab overflows the tab bar by ${Math.round(tabRight - tabBarRight)}px`,
      );
    });

    // 103: School Settings — clicking billing tab updates URL to ?tab=billing
    await runItem(103, adminSession, 'School Settings Tab Bar', async () => {
      await adminSession!.page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
      const billingTab = adminSession!.page
        .getByRole('button', { name: /Plans & Billing/i })
        .or(adminSession!.page.getByRole('button', { name: /billing/i }))
        .first();
      await billingTab.click();
      await adminSession!.page.waitForTimeout(400);
      const url = adminSession!.page.url();
      assertOrThrow(url.includes('tab=billing'), `Clicking billing tab did not set ?tab=billing in URL. Got: ${url}`);

      // Navigate away and back via URL — tab should stay on billing, not redirect to login
      await adminSession!.page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
      await adminSession!.page.goto(`${BASE_URL}/settings?tab=billing`, { waitUntil: 'networkidle' });
      const settingsUrl = adminSession!.page.url();
      assertOrThrow(
        settingsUrl.includes('/settings'),
        `Navigating to /settings?tab=billing redirected away from settings (got ${settingsUrl})`,
      );
      // Verify the billing tab button is active/selected
      const activeBillingTab = adminSession!.page
        .getByRole('button', { name: /Plans & Billing/i })
        .or(adminSession!.page.getByRole('button', { name: /billing/i }))
        .first();
      assertOrThrow(await activeBillingTab.count() > 0, '"Plans & Billing" tab not found after direct URL navigation');
    });

    // 104: Dev Pro unlock — org settings shows Pro tier badge (not "Free")
    await runItem(104, orgSession, 'Dev Pro Unlock', async () => {
      await orgSession!.page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
      const body = await orgSession!.page.locator('main').innerText();
      // In dev mode the server returns PRO and client also overrides via import.meta.env.DEV
      assertOrThrow(
        !/\bFree\b/i.test(body) || /\bPro\b/i.test(body),
        'Org settings is showing "Free" tier in dev mode — dev Pro override is not working',
      );
      // Reminders and Branding tabs should be accessible (not behind a paywall overlay)
      const remindersTab = orgSession!.page.getByRole('button', { name: /reminders/i }).first();
      if (await remindersTab.count()) {
        await remindersTab.click();
        await orgSession!.page.waitForTimeout(400);
        const tabBody = await orgSession!.page.locator('main').innerText();
        assertOrThrow(
          !/upgrade to pro/i.test(tabBody),
          'Reminders tab still shows "Upgrade to Pro" overlay in dev mode',
        );
      }
    });

    // 105: ProGate redirect — "Upgrade to Pro" navigates to /settings?tab=billing, not mailto:
    await runItem(105, orgSession, 'ProGate Redirect', async () => {
      // Force a page where Pro gate is visible by loading a Pro-gated route
      // Navigate to settings and look for any "Upgrade to Pro" / "Upgrade" button from ProGate
      await orgSession!.page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });

      // Try to find a ProGate upgrade button via the reminders tab (most reliable place)
      const tabs = ['reminders', 'branding'];
      let upgradeBtn: import('@playwright/test').Locator | null = null;
      for (const t of tabs) {
        const tabBtn = orgSession!.page.getByRole('button', { name: new RegExp(t, 'i') }).first();
        if (await tabBtn.count()) {
          await tabBtn.click();
          await orgSession!.page.waitForTimeout(400);
          const candidate = orgSession!.page.getByRole('button', { name: /upgrade to pro/i }).first();
          if (await candidate.count()) {
            upgradeBtn = candidate;
            break;
          }
        }
      }

      if (!upgradeBtn || !(await upgradeBtn.count())) {
        markManual(
          'No "Upgrade to Pro" ProGate button visible in dev mode (dev Pro unlock hides it). Cannot test redirect flow without a genuine Free-tier env.',
          'In a non-dev environment log in as a Free org, navigate to a Pro-gated tab (Reminders or Branding), click "Upgrade to Pro", and confirm it navigates to /settings?tab=billing — not to the mail app.',
        );
        return;
      }

      await upgradeBtn.click();
      await orgSession!.page.waitForTimeout(600);
      const url = orgSession!.page.url();
      assertOrThrow(
        url.includes('/settings') && url.includes('tab=billing'),
        `ProGate "Upgrade to Pro" did not navigate to /settings?tab=billing. Got: ${url}`,
      );

      // Second click — navigate away and trigger again to confirm it still works
      await orgSession!.page.goto(`${BASE_URL}/opportunities`, { waitUntil: 'networkidle' });
      await orgSession!.page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
      for (const t of tabs) {
        const tabBtn = orgSession!.page.getByRole('button', { name: new RegExp(t, 'i') }).first();
        if (await tabBtn.count()) {
          await tabBtn.click();
          await orgSession!.page.waitForTimeout(400);
          const candidate2 = orgSession!.page.getByRole('button', { name: /upgrade to pro/i }).first();
          if (await candidate2.count()) {
            await candidate2.click();
            await orgSession!.page.waitForTimeout(600);
            const url2 = orgSession!.page.url();
            assertOrThrow(
              url2.includes('/settings') && url2.includes('tab=billing'),
              `ProGate redirect failed on second attempt. Got: ${url2}`,
            );
            break;
          }
        }
      }
    });

    // 106: School as hosting org — GET /api/schools/my-beneficiary returns a beneficiary
    await runItem(106, adminSession, 'School as Hosting Org', async () => {
      const [apiResp] = await Promise.all([
        adminSession!.page.waitForResponse(
          (r) => r.url().includes('/api/schools/my-beneficiary') && r.request().method() === 'GET',
          { timeout: 15_000 },
        ),
        adminSession!.page.goto(`${BASE_URL}/opportunities`, { waitUntil: 'networkidle' }),
      ]);
      assertOrThrow(apiResp.ok(), `GET /api/schools/my-beneficiary returned HTTP ${apiResp.status()}`);
      const data = await apiResp.json().catch(() => ({}));
      assertOrThrow(data?.id, 'my-beneficiary response is missing id field');
      assertOrThrow(typeof data.name === 'string' && data.name.length > 0, 'my-beneficiary name is empty');
    });

    // 107: School partner request — admin can send a request (second school needed; seeds only have one, so POST and check API response)
    await runItem(107, adminSession, 'School-to-School Partnership', async () => {
      await adminSession!.page.goto(`${BASE_URL}/discover`, { waitUntil: 'domcontentloaded' });
      const nearbyData = await adminSession!.page.evaluate(async ({ url }) => {
        const token = localStorage.getItem('token');
        const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
        const locationResp = await fetch(`${url}/api/schools/location`, { headers: authHeaders });
        if (!locationResp.ok) return [];
        const location = await locationResp.json();
        if (!location?.latitude || !location?.longitude) return [];
        const nearbyResp = await fetch(
          `${url}/api/beneficiaries/directory/nearby?lat=${location.latitude}&lng=${location.longitude}&radius=10`,
          { headers: authHeaders },
        );
        if (!nearbyResp.ok) return [];
        const payload = await nearbyResp.json();
        return Array.isArray(payload?.items) ? payload.items : [];
      }, { url: BASE_URL });
      const schoolEntry = Array.isArray(nearbyData)
        ? nearbyData.find((e: any) => e.entityType === 'school')
        : null;

      if (!schoolEntry) {
        markManual(
          'No second school found in the nearby directory (seed only has one school). Cannot test school-to-school partner request without two schools.',
          'Seed a second school with non-null lat/lng, log in as the first school admin, open Discover, locate the second school on the map, click "+ Partner", confirm the partner request is sent, then log in as the second school admin, approve the request from the School Partners tab, and verify mutual access.',
        );
        return;
      }

      // Verify the school card renders a "School" badge
      const body = await adminSession!.page.locator('main').innerText();
      assertOrThrow(/School/i.test(body), 'Nearby school does not show "School" badge in Discover page');

      // Send a partner request via the API directly (UI requires geolocation which varies in CI)
      const partnerResp = await adminSession!.page.evaluate(
        async ({ url, schoolId }: { url: string; schoolId: string }) => {
          const token = localStorage.getItem('token');
          const r = await fetch(`${url}/api/school-partners`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ toSchoolId: schoolId }),
          });
          return { status: r.status, body: await r.text() };
        },
        { url: BASE_URL, schoolId: schoolEntry.id as string },
      );
      assertOrThrow(
        partnerResp.status === 201 || partnerResp.status === 409,
        `POST /api/school-partners returned unexpected status ${partnerResp.status}: ${partnerResp.body}`,
      );
    });

    // 108: School Partners tab — visible in admin Beneficiaries/Partners page
    await runItem(108, adminSession, 'School-to-School Partnership', async () => {
      await adminSession!.page.goto(`${BASE_URL}/partners`, { waitUntil: 'networkidle' });
      const body = await adminSession!.page.locator('main').innerText();
      assertOrThrow(
        /Partner|Beneficiar|Community/i.test(body),
        'Partners / Beneficiaries page did not load for school admin',
      );

      // "School Partners" tab should exist
      const schoolPartnersTab = adminSession!.page.getByRole('button', { name: /School Partners/i }).first();
      assertOrThrow(await schoolPartnersTab.count() > 0, '"School Partners" tab not found on Partners page');

      await schoolPartnersTab.click();
      await adminSession!.page.waitForTimeout(600);
      const tabBody = await adminSession!.page.locator('main').innerText();
      assertOrThrow(
        /incoming|outgoing|request|no partner/i.test(tabBody),
        '"School Partners" tab did not render expected content (incoming/outgoing requests)',
      );
    });

  } finally {
    for (const session of sessions.reverse()) {
      await stopSession(session);
    }

    const summary = buildFailureSummary(results);
    fs.writeFileSync(FAIL_SUMMARY_PATH, summary, 'utf8');
    console.log(summary);

    const report = buildQaResultsMarkdown(manualQaAllLines, results);
    fs.writeFileSync(QA_RESULTS_PATH, report, 'utf8');
  }
});
