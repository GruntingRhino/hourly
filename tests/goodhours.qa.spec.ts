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
const MANUAL_QA_PATH = path.join(ROOT, 'manual_qa.md');

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
  waitlistOpportunityTitle: string;
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
  waitlistOpportunityTitle: '',
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
  const links = await page.locator('a[href^="/opportunity/"]').evaluateAll((anchors) =>
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
  assertOrThrow(checklist.length === 101, `Expected 101 checklist items from manual_qa.md, found ${checklist.length}`);

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
      let created = false;
      for (let i = 1; i <= 30; i += 1) {
        const suffix = String(i).padStart(2, '0');
        const email = `qa-test-${suffix}@mailinator.com`;
        const resp = await signupVolunteer(authSession!.page, email, flowState.qaPassword, `QA Student ${suffix}`);
        const txt = await resp.text().catch(() => '');

        if (resp.status() === 409 && /already registered/i.test(txt)) {
          continue;
        }

        if (resp.status() === 201) {
          flowState.qaEmail = email;
          created = true;
          break;
        }

        throw new Error(`Unexpected signup status ${resp.status()} body=${txt}`);
      }

      assertOrThrow(created, 'Failed to create fresh mailinator student account');
      const body = await authSession!.page.locator('body').innerText();
      assertOrThrow(/Verify your email/i.test(body), 'Verify your email screen not shown after signup');
      assertOrThrow(body.includes(flowState.qaEmail), 'Verify screen does not show the created email address');
    });

    await runItem(2, authSession, 'Auth', async () => {
      const inbox = flowState.qaEmail.split('@')[0];
      const msg = await fetchMailinatorMessage(browser, inbox, /Verify your GoodHours account/i, 180_000);
      const fromOk = /noreply@notifications\.goodhours\.app/i.test(msg.rawText) || /GoodHours/i.test(msg.rowText);
      assertOrThrow(fromOk, 'Verification email sender did not match expected noreply@notifications.goodhours.app');
      const verifyLink = msg.links.find((l) => /verify-email\?token=/i.test(l));
      assertOrThrow(verifyLink, 'Verification link not found in mailinator LINKS tab');
      flowState.verifyLinkOld = verifyLink!;
    });

    await runItem(3, authSession, 'Auth', async () => {
      assertOrThrow(flowState.verifyLinkOld, 'Missing verification link from previous step');
      await authSession!.page.goto(flowState.verifyLinkOld, { waitUntil: 'networkidle' });
      await authSession!.page.waitForTimeout(1200);
      const body = await authSession!.page.locator('body').innerText();
      const verifiedLike = /Email verified!/i.test(body) || /Join a Classroom/i.test(body);
      assertOrThrow(verifiedLike, 'Verification link did not lead to Email verified/Join a Classroom flow');
    });

    await runItem(4, authSession, 'Auth', async () => {
      if (await authSession!.page.getByRole('button', { name: /Sign out/i }).count()) {
        await authSession!.page.getByRole('button', { name: /Sign out/i }).click();
        await authSession!.page.waitForTimeout(500);
      }

      await authSession!.page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
      await authSession!.page.locator('input[type="email"]').fill(ACCOUNTS.studentA.email);
      await authSession!.page.locator('input[type="password"]').fill('wrong-password');
      const [resp] = await Promise.all([
        authSession!.page.waitForResponse((r) => r.url().includes('/api/auth/login'), { timeout: 60_000 }),
        authSession!.page.getByRole('button', { name: /sign in/i }).click(),
      ]);
      const body = await authSession!.page.locator('body').innerText();
      assertOrThrow(resp.status() >= 400, 'Wrong-password login unexpectedly succeeded');
      assertOrThrow(/Invalid email or password/i.test(body), 'Expected invalid credentials error text not shown');
    });

    await runItem(5, authSession, 'Auth', async () => {
      await authSession!.page.goto(`${BASE_URL}/forgot-password`, { waitUntil: 'networkidle' });
      await authSession!.page.locator('input[type="email"]').fill(flowState.qaEmail);
      const [resp] = await Promise.all([
        authSession!.page.waitForResponse((r) => r.url().includes('/api/auth/forgot-password'), { timeout: 60_000 }),
        authSession!.page.getByRole('button', { name: /Send Reset Link/i }).click(),
      ]);
      assertOrThrow(resp.status() === 200, `Forgot-password request failed with ${resp.status()}`);
      const body = await authSession!.page.locator('body').innerText();
      assertOrThrow(/Check your email/i.test(body), 'Forgot-password confirmation not shown');

      const inbox = flowState.qaEmail.split('@')[0];
      const msg = await fetchMailinatorMessage(browser, inbox, /Reset/i, 180_000);
      const resetLink = msg.links.find((l) => /reset-password\?token=/i.test(l));
      assertOrThrow(resetLink, 'Reset-password link not found in mailinator');
      flowState.resetLink = resetLink!;

      await authSession!.page.goto(flowState.resetLink, { waitUntil: 'networkidle' });
      assertOrThrow(/\/reset-password/i.test(authSession!.page.url()), 'Reset link did not land on /reset-password form');
    });

    await runItem(6, authSession, 'Auth', async () => {
      assertOrThrow(flowState.resetLink, 'Missing reset link from previous step');
      await authSession!.page.goto(flowState.resetLink, { waitUntil: 'networkidle' });
      const pwdInputs = authSession!.page.locator('input[type="password"]');
      assertOrThrow((await pwdInputs.count()) >= 2, 'Reset-password form inputs not found');
      await pwdInputs.first().fill(flowState.qaResetPassword);
      await pwdInputs.nth(1).fill(flowState.qaResetPassword);

      const [resp] = await Promise.all([
        authSession!.page.waitForResponse((r) => r.url().includes('/api/auth/reset-password'), { timeout: 60_000 }),
        authSession!.page.getByRole('button', { name: /Reset Password/i }).click(),
      ]);

      assertOrThrow(resp.status() === 200, `Reset password API failed with ${resp.status()}`);
      await authSession!.page.waitForTimeout(1300);
      const body = await authSession!.page.locator('body').innerText();
      assertOrThrow(/Password reset!/i.test(body) || /Redirecting to sign in/i.test(body), 'Password reset success message not shown');

      await login(authSession!.page, flowState.qaEmail, flowState.qaResetPassword, false);
      const loggedInBody = await authSession!.page.locator('body').innerText();
      assertOrThrow(
        /Join a Classroom|Dashboard|Verify your email/i.test(loggedInBody),
        'Could not login with reset password',
      );
    });

    await runItem(7, authSession, 'Auth', async () => {
      await ensureStudentSignupRole(authSession!.page);
      const inputs = authSession!.page.locator('input');
      await inputs.nth(0).fill('Duplicate Check');
      await inputs.nth(1).fill(ACCOUNTS.studentA.email);
      await inputs.nth(2).fill('16');
      await inputs.nth(3).fill('Password1!');

      const [resp] = await Promise.all([
        authSession!.page.waitForResponse((r) => r.url().includes('/api/auth/signup'), { timeout: 60_000 }),
        authSession!.page.getByRole('button', { name: /Create Account/i }).click(),
      ]);

      const txt = await resp.text().catch(() => '');
      assertOrThrow(resp.status() === 409, `Expected 409 for duplicate signup, got ${resp.status()}`);
      assertOrThrow(/Email already registered/i.test(txt), 'Duplicate-signup response body did not include expected error');
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
      assertOrThrow(/Committed Hours/i.test(body), 'Committed Hours card missing');
      assertOrThrow(/Verified Hours/i.test(body), 'Verified Hours card missing');
      assertOrThrow(/Activities Done/i.test(body), 'Activities Done card missing');
    });

    await runItem(9, studentSession, 'Student Flow', async () => {
      const body = await studentSession!.page.locator('main').innerText();
      assertOrThrow(/Progress toward goal/i.test(body), 'Progress section missing');
      assertOrThrow(/\d+(?:\.\d+)?\s*\/\s*\d+/.test(body), 'Verified-hours vs goal value not shown');
    });

    await runItem(10, studentSession, 'Student Flow', async () => {
      const body = await studentSession!.page.locator('main').innerText();
      assertOrThrow(/Upcoming Opportunities/i.test(body), 'Upcoming Opportunities section missing');
      assertOrThrow(!/No upcoming opportunities/i.test(body), 'No future events listed in Upcoming Opportunities');
    });

    await runItem(11, studentSession, 'Student Flow', async () => {
      const body = await studentSession!.page.locator('main').innerText();
      assertOrThrow(/Recent Activity/i.test(body), 'Recent Activity section missing');
      assertOrThrow(/PENDING|APPROVED|VERIFIED|REJECTED|CHECKED_IN|CHECKED_OUT/i.test(body), 'No activity statuses found');
    });

    await runItem(12, studentSession, 'Student Flow', async () => {
      await studentSession!.page.goto(`${BASE_URL}/browse`, { waitUntil: 'networkidle' });
      const count = await studentSession!.page.locator('a[href^="/opportunity/"]').count();
      assertOrThrow(count > 0, 'No opportunities loaded on Browse page');
    });

    await runItem(13, studentSession, 'Student Flow', async () => {
      const links = await findOpportunityLinks(studentSession!.page);
      assertOrThrow(links.length > 0, 'No opportunities available for search test');
      const partial = links[0].title.split(/\s+/).find((w) => w.length >= 3) ?? links[0].title.slice(0, 3);
      const search = studentSession!.page.locator('input[placeholder*="Search opportunities"]');
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
      const selects = studentSession!.page.locator('select');
      assertOrThrow((await selects.count()) >= 2, 'Tag filter select not found');
      const tagSelect = selects.nth(1);
      const options = await tagSelect.evaluate((s: HTMLSelectElement) =>
        Array.from(s.options)
          .map((o) => ({ value: o.value, text: o.textContent || '' }))
          .filter((o) => o.value),
      );
      assertOrThrow(options.length > 0, 'No tag options available');

      const beforeCount = (await findOpportunityLinks(studentSession!.page)).length;
      await tagSelect.selectOption(options[0].value);
      await studentSession!.page.waitForTimeout(700);
      const filteredCount = (await findOpportunityLinks(studentSession!.page)).length;
      assertOrThrow(filteredCount <= beforeCount, 'Tag filter did not narrow or preserve result size');

      await tagSelect.selectOption('');
      await studentSession!.page.waitForTimeout(700);
      const afterClear = (await findOpportunityLinks(studentSession!.page)).length;
      assertOrThrow(afterClear >= filteredCount, 'Clearing tag filter did not restore list');
    });

    await runItem(15, studentSession, 'Student Flow', async () => {
      const sortSelect = studentSession!.page.locator('select').first();
      await sortSelect.selectOption({ label: 'Date' }).catch(async () => {
        await sortSelect.selectOption('date');
      });
      await studentSession!.page.waitForTimeout(800);
      const text = await studentSession!.page.locator('main').innerText();
      const dates = parseVisibleDates(text);
      assertOrThrow(dates.length >= 2, 'Not enough dated entries to validate chronological sort');
      assertOrThrow(isNonDecreasing(dates), 'Events are not in chronological order after Sort: Date');
    });

    await runItem(16, studentSession, 'Student Flow', async () => {
      const sortSelect = studentSession!.page.locator('select').first();
      await sortSelect.selectOption({ label: 'Most Popular' }).catch(async () => {
        await sortSelect.selectOption('popular');
      });
      await studentSession!.page.waitForTimeout(800);
      const text = await studentSession!.page.locator('main').innerText();
      const ratios = parseVisibleRatios(text);
      assertOrThrow(ratios.length >= 2, 'Not enough signup ratio values to validate popularity sort');
      assertOrThrow(isNonIncreasing(ratios), 'Higher-signup opportunities are not first in Most Popular sort');
    });

    await runItem(17, studentSession, 'Student Flow', async () => {
      const before = (await findOpportunityLinks(studentSession!.page)).length;
      const checkbox = studentSession!.page.locator('input[type="checkbox"]').first();
      assertOrThrow(await checkbox.count(), 'Approved Orgs Only toggle not found');
      await checkbox.check({ force: true }).catch(async () => {
        await checkbox.click();
      });
      await studentSession!.page.waitForTimeout(700);
      const after = (await findOpportunityLinks(studentSession!.page)).length;
      assertOrThrow(after <= before, 'Approved Orgs Only toggle did not narrow list');
      await checkbox.uncheck({ force: true }).catch(async () => {
        await checkbox.click();
      });
    });

    await runItem(18, studentSession, 'Student Flow', async () => {
      await studentSession!.page.getByRole('button', { name: /^All$/i }).click();
      await studentSession!.page.waitForTimeout(300);
      const saveBtn = studentSession!.page.getByRole('button', { name: /^Save$/i }).first();
      assertOrThrow(await saveBtn.count(), 'Save button not found on any opportunity card');
      await saveBtn.click();
      await studentSession!.page.waitForTimeout(600);
      await studentSession!.page.getByRole('button', { name: /^Saved$/i }).click();
      await studentSession!.page.waitForTimeout(500);
      const body = await studentSession!.page.locator('main').innerText();
      assertOrThrow(!/No saved opportunities/i.test(body), 'Saved tab did not include saved opportunity');
    });

    await runItem(19, studentSession, 'Student Flow', async () => {
      await studentSession!.page.getByRole('button', { name: /^All$/i }).click();
      await studentSession!.page.waitForTimeout(300);
      const skipBtn = studentSession!.page.getByRole('button', { name: /^Skip$/i }).first();
      assertOrThrow(await skipBtn.count(), 'Skip button not found on any opportunity card');
      await skipBtn.click();
      await studentSession!.page.waitForTimeout(600);
      await studentSession!.page.getByRole('button', { name: /^Skipped$/i }).click();
      await studentSession!.page.waitForTimeout(500);
      const body = await studentSession!.page.locator('main').innerText();
      assertOrThrow(!/No skipped opportunities/i.test(body), 'Skipped tab did not include skipped opportunity');
    });

    await runItem(20, studentSession, 'Student Flow', async () => {
      await studentSession!.page.getByRole('button', { name: /^All$/i }).click();
      await studentSession!.page.waitForTimeout(300);
      const discardBtn = studentSession!.page.locator('button', { hasText: '✕' }).first();
      assertOrThrow(await discardBtn.count(), 'Discard button not found on any opportunity card');
      await discardBtn.click();
      await studentSession!.page.waitForTimeout(600);
      await studentSession!.page.getByRole('button', { name: /^Discarded$/i }).click();
      await studentSession!.page.waitForTimeout(500);
      const body = await studentSession!.page.locator('main').innerText();
      assertOrThrow(!/No discarded opportunities/i.test(body), 'Discarded tab did not include discarded opportunity');
    });

    await runItem(21, studentSession, 'Student Flow', async () => {
      let recovered = false;
      for (const tab of ['Skipped', 'Discarded']) {
        await studentSession!.page.getByRole('button', { name: new RegExp(`^${tab}$`, 'i') }).click();
        await studentSession!.page.waitForTimeout(450);
        const recoverBtn = studentSession!.page.getByRole('button', { name: /Recover|Undo|Restore/i }).first();
        if (await recoverBtn.count()) {
          await recoverBtn.click();
          await studentSession!.page.waitForTimeout(500);
          recovered = true;
          break;
        }
      }

      assertOrThrow(recovered, 'No recover action available in Skipped/Discarded tabs');
      await studentSession!.page.getByRole('button', { name: /^All$/i }).click();
      await studentSession!.page.waitForTimeout(300);
      const count = await studentSession!.page.locator('a[href^="/opportunity/"]').count();
      assertOrThrow(count > 0, 'Recovered opportunity did not return to main list');
    });

    await runItem(22, studentSession, 'Student Flow', async () => {
      await studentSession!.page.getByRole('button', { name: /^All$/i }).click();
      const links = await findOpportunityLinks(studentSession!.page);
      assertOrThrow(links.length > 0, 'No opportunities available for detail-view test');
      await studentSession!.page.goto(`${BASE_URL}${links[0].href}`, { waitUntil: 'networkidle' });
      const body = await studentSession!.page.locator('main').innerText();
      assertOrThrow(/Location:/i.test(body), 'Opportunity detail missing location');
      assertOrThrow(/Date:/i.test(body), 'Opportunity detail missing date');
      assertOrThrow(/Time:/i.test(body), 'Opportunity detail missing time');
      assertOrThrow(/\d+\s*\/\s*\d+/i.test(body), 'Opportunity detail missing capacity');
      assertOrThrow(/custom/i.test(body), 'Opportunity detail missing custom fields display');
    });

    await runItem(23, studentSession, 'Student Flow', async () => {
      const opp = await findOpportunityWithAction(studentSession!.page, /^Sign Up$/i);
      assertOrThrow(opp, 'No opportunity with Sign Up button found');
      flowState.studentSignedOpportunityTitle = opp!.title;
      await studentSession!.page.getByRole('button', { name: /^Sign Up$/i }).first().click();
      await studentSession!.page.waitForTimeout(900);
      const body = await studentSession!.page.locator('main').innerText();
      assertOrThrow(/You\'re signed up for this opportunity/i.test(body), 'Signup confirmation not shown after clicking Sign Up');
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
        throw new Error('No capacity-full opportunity with Join Waitlist button found');
      }
      flowState.waitlistOpportunityTitle = target.title;
      const btn = janeSession!.page.getByRole('button', { name: /Join Waitlist/i }).first();
      assertOrThrow(!(await btn.isDisabled()), 'Join Waitlist button is disabled');
      await btn.click();
      await janeSession!.page.waitForTimeout(900);
      const body = await janeSession!.page.locator('main').innerText();
      assertOrThrow(/WAITLISTED|waitlisted/i.test(body), 'Waitlisted status not shown after joining waitlist');
    });

    await runItem(25, studentSession, 'Student Flow', async () => {
      assertOrThrow(flowState.studentSignedOpportunityTitle, 'No signed opportunity title recorded from item 23');
      await openOpportunityByTitle(studentSession!.page, flowState.studentSignedOpportunityTitle);
      const cancelBtn = studentSession!.page.getByRole('button', { name: /Cancel Signup|Cancel/i }).first();
      assertOrThrow(await cancelBtn.count(), 'Cancel signup button not found on confirmed signup');
      await cancelBtn.click();
      await studentSession!.page.waitForTimeout(900);
      const body = await studentSession!.page.locator('main').innerText();
      assertOrThrow(/Sign Up/i.test(body), 'Slot not freed / signup button not restored after cancel');
    });

    await runItem(26, janeSession, 'Student Flow', async () => {
      assertOrThrow(flowState.waitlistOpportunityTitle, 'No waitlist opportunity recorded from item 24');
      await openOpportunityByTitle(janeSession!.page, flowState.waitlistOpportunityTitle);
      const body = await janeSession!.page.locator('main').innerText();
      assertOrThrow(/CONFIRMED|You\'re signed up/i.test(body), 'Waitlisted student was not promoted to CONFIRMED after cancellation');
    });

    await runItem(27, studentSession, 'Student Flow', async () => {
      await studentSession!.page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
      const checkInBtn = studentSession!.page.getByRole('button', { name: /Check In/i }).first();
      assertOrThrow(await checkInBtn.count(), 'Check In button not found on dashboard/activity for confirmed session');
      await checkInBtn.click();
      await studentSession!.page.waitForTimeout(700);
      const body = await studentSession!.page.locator('main').innerText();
      assertOrThrow(/CHECKED_IN|Checked in/i.test(body), 'Session did not move to CHECKED_IN');
    });

    await runItem(28, studentSession, 'Student Flow', async () => {
      const checkOutBtn = studentSession!.page.getByRole('button', { name: /Check Out/i }).first();
      assertOrThrow(await checkOutBtn.count(), 'Check Out button not found after check-in');
      await checkOutBtn.click();
      await studentSession!.page.waitForTimeout(700);
      const body = await studentSession!.page.locator('main').innerText();
      assertOrThrow(/CHECKED_OUT|Checked out/i.test(body), 'Session did not move to CHECKED_OUT');
      assertOrThrow(/hours/i.test(body), 'Auto-calculated totalHours not shown after check-out');
    });

    await runItem(29, studentSession, 'Student Flow', async () => {
      let target = await findOpportunityWithAction(studentSession!.page, /Submit Verification/i);

      if (!target) {
        const signable = await findOpportunityWithAction(studentSession!.page, /^Sign Up$/i);
        assertOrThrow(signable, 'No signable opportunity found to create a verification session');
        await studentSession!.page.getByRole('button', { name: /^Sign Up$/i }).first().click();
        await studentSession!.page.waitForTimeout(900);
        target = { ...signable };
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
      assertOrThrow(target, 'No suitable opportunity found for file upload verification test');

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
      await studentSession!.page.goto(`${BASE_URL}/browse`, { waitUntil: 'networkidle' });
      const links = await findOpportunityLinks(studentSession!.page);
      let blockedFound = false;
      for (const link of links) {
        await studentSession!.page.goto(`${BASE_URL}${link.href}`, { waitUntil: 'networkidle' });
        const body = await studentSession!.page.locator('main').innerText();
        if (/Verification unlocks after/i.test(body)) {
          blockedFound = true;
          break;
        }
      }
      assertOrThrow(blockedFound, 'Could not verify blocking behavior for verification before event date');
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
      const testPhone = '(555) 123-4567';

      const bio = 'b'.repeat(305);
      const bioInput = studentSession!.page.locator('textarea').first();
      await studentSession!.page.locator('input[type="text"]').nth(0).fill(testName);
      await studentSession!.page.locator('input[type="tel"]').first().fill(testPhone);
      await bioInput.fill(bio);
      const bioValue = await bioInput.inputValue();
      assertOrThrow(bioValue.length <= 300, `Biography field exceeded 300-char limit (actual=${bioValue.length})`);

      await studentSession!.page.getByRole('button', { name: /Save Changes/i }).click();
      await studentSession!.page.waitForTimeout(1000);
      await studentSession!.page.reload({ waitUntil: 'networkidle' });
      await studentSession!.page.getByRole('button', { name: /^profile$/i }).click();
      const savedName = await studentSession!.page.locator('input[type="text"]').nth(0).inputValue();
      const savedPhone = await studentSession!.page.locator('input[type="tel"]').first().inputValue();
      assertOrThrow(savedName === testName, 'Profile name did not persist after save+refresh');
      assertOrThrow(savedPhone === testPhone, 'Profile phone did not persist after save+refresh');
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
      await studentSession!.page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
      await studentSession!.page.getByRole('button', { name: /^profile$/i }).click();
      const insta = `@johnqa${Date.now()}`;
      const instaInput = studentSession!.page.locator('input[placeholder*="Instagram"]');
      assertOrThrow(await instaInput.count(), 'Instagram input not found');
      await instaInput.fill(insta);
      await studentSession!.page.getByRole('button', { name: /Save Changes/i }).click();
      await studentSession!.page.waitForTimeout(900);
      await studentSession!.page.reload({ waitUntil: 'networkidle' });
      await studentSession!.page.getByRole('button', { name: /^profile$/i }).click();
      const saved = await studentSession!.page.locator('input[placeholder*="Instagram"]').inputValue();
      assertOrThrow(saved === insta, 'Instagram handle did not persist after save+refresh');
    });

    await runItem(41, studentSession, 'Student Flow', async () => {
      await studentSession!.page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
      await studentSession!.page.getByRole('button', { name: /^notifications$/i }).click();
      await studentSession!.page.waitForTimeout(400);
      const row = studentSession!.page.getByText('Hour Approvals', { exact: true });
      assertOrThrow(await row.count(), 'Hour Approvals row not found in Notifications settings');
      const emailToggle = row.locator('xpath=ancestor::*[self::tr or self::div][1]//button').first();
      assertOrThrow(await emailToggle.count(), 'Hour Approvals email toggle not found');
      await emailToggle.click();
      await studentSession!.page.getByRole('button', { name: /Save Preferences/i }).click();
      await studentSession!.page.waitForTimeout(700);

      await studentSession!.page.reload({ waitUntil: 'networkidle' });
      await studentSession!.page.getByRole('button', { name: /^notifications$/i }).click();
      await studentSession!.page.waitForTimeout(400);
      const cls = await row.locator('xpath=ancestor::*[self::tr or self::div][1]//button').first().getAttribute('class');
      assertOrThrow(Boolean(cls && cls.includes('bg-gray-300')), 'Hour Approvals email toggle did not persist OFF state');
    });

    await runItem(42, studentSession, 'Student Flow', async () => {
      await studentSession!.page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
      await studentSession!.page.getByRole('button', { name: /^privacy$/i }).click();
      const selects = studentSession!.page.locator('select');
      assertOrThrow((await selects.count()) >= 2, 'Privacy message restriction select not found');
      const msgSelect = selects.nth(1);
      await msgSelect.selectOption('ORGS_ONLY');
      await studentSession!.page.getByRole('button', { name: /Save Settings/i }).click();
      await studentSession!.page.waitForTimeout(700);
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
      await orgSession!.page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
      const body = await orgSession!.page.locator('main').innerText();
      for (const card of ['Total Opportunities', 'Total Signups', 'Approved Hours', 'Unique Volunteers']) {
        assertOrThrow(body.includes(card), `Missing org stat card: ${card}`);
      }
    });

    await runItem(47, orgSession, 'Organization Flow', async () => {
      const body = await orgSession!.page.locator('main').innerText();
      assertOrThrow(/Pending Verifications/i.test(body), 'Pending Verifications section missing');
      assertOrThrow(await orgSession!.page.getByRole('button', { name: /Approve/i }).count(), 'No pending verification actions listed');
    });

    await runItem(48, orgSession, 'Organization Flow', async () => {
      const body = await orgSession!.page.locator('main').innerText();
      assertOrThrow(/Recent Activity Feed/i.test(body), 'Recent activity feed missing');
      assertOrThrow(!/No recent activity\./i.test(body), 'Recent activity feed has no notifications to show');
    });

    await runItem(49, orgSession, 'Organization Flow', async () => {
      await orgSession!.page.goto(`${BASE_URL}/opportunities/new`, { waitUntil: 'networkidle' });
      flowState.createdOrgOpportunityTitle = `QA Org Create ${safeNowTag()}`;
      await orgSession!.page.locator('input[name="title"]').fill(flowState.createdOrgOpportunityTitle);
      await orgSession!.page.locator('textarea[name="description"]').fill('Automation create/edit/cancel validation opportunity.');
      await orgSession!.page.locator('input[name="location"]').fill('500 Example Road');
      await orgSession!.page.locator('input[name="address"]').fill('10001');
      await orgSession!.page.locator('input[name="date"]').fill(daysFromNow(2));
      await orgSession!.page.locator('input[name="startTime"]').fill('9:00 AM');
      await orgSession!.page.locator('input[name="endTime"]').fill('11:00 AM');
      await orgSession!.page.locator('input[name="durationHours"]').fill('2');
      await orgSession!.page.locator('input[name="capacity"]').fill('4');

      const [createResp] = await Promise.all([
        orgSession!.page.waitForResponse((r) => r.url().includes('/api/opportunities') && r.request().method() === 'POST', { timeout: 60_000 }),
        orgSession!.page.getByRole('button', { name: /Create Opportunity/i }).click(),
      ]);

      flowState.latestCreateOpportunityResponse = await createResp.json().catch(() => null);
      assertOrThrow(createResp.status() === 201, `Create opportunity failed with status ${createResp.status()}`);
      await orgSession!.page.waitForTimeout(900);
      const body = await orgSession!.page.locator('main').innerText();
      assertOrThrow(body.includes(flowState.createdOrgOpportunityTitle), 'Created opportunity missing from opportunities list');
      assertOrThrow(/Active/i.test(body), 'Created opportunity did not appear with ACTIVE status context');
    });

    await runItem(50, orgSession, 'Organization Flow', async () => {
      const data = flowState.latestCreateOpportunityResponse;
      assertOrThrow(data, 'No create-opportunity API response available for geocode validation');
      assertOrThrow(data.latitude !== null && data.longitude !== null, 'Auto-geocode did not populate latitude/longitude on created opportunity');
    });

    await runItem(51, orgSession, 'Organization Flow', async () => {
      await orgSession!.page.goto(`${BASE_URL}/opportunities`, { waitUntil: 'networkidle' });
      const card = orgSession!.page.locator('div,article').filter({ hasText: flowState.createdOrgOpportunityTitle }).first();
      assertOrThrow(await card.count(), 'Created opportunity card not found for edit');
      const edit = card.getByRole('button', { name: /Edit Details/i }).first();
      assertOrThrow(await edit.count(), 'Edit Details button not found for created opportunity');
      await edit.click();
      await orgSession!.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

      flowState.updatedOrgOpportunityTitle = `${flowState.createdOrgOpportunityTitle} Updated`;
      await orgSession!.page.locator('input[name="title"]').fill(flowState.updatedOrgOpportunityTitle);
      await orgSession!.page.locator('textarea[name="description"]').fill('Updated description from automation run.');
      await orgSession!.page.locator('input[name="capacity"]').fill('6');

      await orgSession!.page.getByRole('button', { name: /Save Changes/i }).click();
      await orgSession!.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      const body = await orgSession!.page.locator('main').innerText();
      assertOrThrow(body.includes(flowState.updatedOrgOpportunityTitle), 'Updated opportunity title not reflected immediately in list');
    });

    await runItem(52, orgSession, 'Organization Flow', async () => {
      const card = orgSession!.page.locator('div,article').filter({ hasText: flowState.updatedOrgOpportunityTitle }).first();
      assertOrThrow(await card.count(), 'Updated opportunity card not found for cancel action');
      const cancel = card.getByRole('button', { name: /^Cancel$/i }).first();
      assertOrThrow(await cancel.count(), 'Cancel button missing on updated opportunity');
      await cancel.click();
      await orgSession!.page.waitForTimeout(900);
      if (await orgSession!.page.getByRole('button', { name: /Confirm|Yes|Cancel Opportunity/i }).count()) {
        await orgSession!.page.getByRole('button', { name: /Confirm|Yes|Cancel Opportunity/i }).first().click();
        await orgSession!.page.waitForTimeout(700);
      }

      await orgSession!.page.getByRole('button', { name: /^Cancelled$/i }).click();
      await orgSession!.page.waitForTimeout(700);
      const body = await orgSession!.page.locator('main').innerText();
      assertOrThrow(body.includes(flowState.updatedOrgOpportunityTitle), 'Cancelled opportunity not shown in CANCELLED list');
    });

    await runItem(53, orgSession, 'Organization Flow', async () => {
      await orgSession!.page.goto(`${BASE_URL}/opportunities/new`, { waitUntil: 'networkidle' });
      const recurringCheckbox = orgSession!.page.locator('input[name="isRecurring"]').first();
      assertOrThrow(await recurringCheckbox.count(), 'Recurring toggle checkbox not found');
      await recurringCheckbox.check({ force: true }).catch(async () => recurringCheckbox.click());
      await orgSession!.page.waitForTimeout(500);
      const body = await orgSession!.page.locator('main').innerText();
      assertOrThrow(/Recurring Pattern/i.test(body), 'Recurring pattern field did not appear after enabling Recurring toggle');
    });

    await runItem(54, orgSession, 'Organization Flow', async () => {
      await orgSession!.page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
      const beforeCount = await orgSession!.page.getByRole('button', { name: /Approve/i }).count();
      assertOrThrow(beforeCount > 0, 'No pending verification available to approve');
      await orgSession!.page.getByRole('button', { name: /Approve/i }).first().click();
      await orgSession!.page.waitForTimeout(900);
      const afterCount = await orgSession!.page.getByRole('button', { name: /Approve/i }).count();
      assertOrThrow(afterCount < beforeCount, 'Pending verification did not transition to VERIFIED after approval');
    });

    await runItem(55, orgSession, 'Organization Flow', async () => {
      const approveBtn = orgSession!.page.getByRole('button', { name: /Approve/i }).first();
      assertOrThrow(await approveBtn.count(), 'No pending verification available for override approval');
      const overrideInput = orgSession!.page.locator('input[placeholder*="Override"]').first();
      assertOrThrow(await overrideInput.count(), 'Approve-with-override UI/control not present in organization verification flow');
      await overrideInput.fill('1.25');

      const [resp] = await Promise.all([
        orgSession!.page.waitForResponse(
          (r) => r.url().includes('/api/verification/') && r.url().includes('/approve') && r.request().method() === 'POST',
          { timeout: 60_000 },
        ),
        approveBtn.click(),
      ]);

      assertOrThrow(resp.status() === 200, `Override approve request failed with status ${resp.status()}`);
      const data = await resp.json().catch(() => null as any);
      const approvedHours = Number(data?.totalHours);
      assertOrThrow(
        Number.isFinite(approvedHours) && Math.abs(approvedHours - 1.25) < 0.001,
        `verifiedHours did not reflect override value. got=${String(data?.totalHours)}`,
      );
    });

    await runItem(56, orgSession, 'Organization Flow', async () => {
      const rejectBtn = orgSession!.page.getByRole('button', { name: /Reject/i }).first();
      assertOrThrow(await rejectBtn.count(), 'No pending verification available to reject');
      await rejectBtn.click();
      await orgSession!.page.waitForTimeout(600);

      const modalReject = orgSession!.page.getByRole('button', { name: /^Reject$/i }).first();
      assertOrThrow(await modalReject.count(), 'Reject confirmation modal/button not found');
      await modalReject.click();
      await orgSession!.page.waitForTimeout(900);

      const stillOpen = await orgSession!.page.getByRole('button', { name: /^Reject$/i }).count();
      if (!stillOpen) {
        throw new Error('Reject succeeded without required reason; checklist expects reason to be required');
      }

      const reasonInput = orgSession!.page.locator('textarea').first();
      assertOrThrow(await reasonInput.count(), 'Reject reason input missing');
      await reasonInput.fill('QA automated rejection reason');
      await orgSession!.page.getByRole('button', { name: /^Reject$/i }).first().click();
      await orgSession!.page.waitForTimeout(900);
    });

    await runItem(57, orgSession, 'Organization Flow', async () => {
      markManual(
        'Seed data does not include a user who is both org verifier and session owner; self-verification cannot be produced from available UI states.',
        'Create an org-admin account that can log volunteer sessions for itself, then attempt to verify that own session and confirm "Cannot verify your own session".',
      );
    });

    await runItem(58, orgSession, 'Organization Flow', async () => {
      await orgSession!.page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
      await orgSession!.page.getByRole('button', { name: /Make Announcement/i }).click();
      await orgSession!.page.waitForTimeout(500);
      const select = orgSession!.page.locator('select').first();
      const options = await select.evaluate((s: HTMLSelectElement) =>
        Array.from(s.options)
          .map((o) => ({ value: o.value, text: o.textContent || '' }))
          .filter((o) => o.value),
      );
      assertOrThrow(options.length > 0, 'No opportunities available in announcement modal');
      await select.selectOption(options[0].value);
      await orgSession!.page.locator('textarea').fill(`Announcement ${safeNowTag()}`);
      await orgSession!.page.getByRole('button', { name: /Send to All Signups/i }).click();
      await orgSession!.page.waitForTimeout(1000);
      const body = await orgSession!.page.locator('main').innerText();
      assertOrThrow(!/Make Announcement\nOpportunity/i.test(body), 'Announcement modal did not close after send');
    });

    await runItem(59, orgSession, 'Organization Flow', async () => {
      flowState.orgToStudentSubject = `QA Org->Student ${safeNowTag()}`;
      await orgSession!.page.goto(`${BASE_URL}/messages`, { waitUntil: 'networkidle' });
      await orgSession!.page.getByRole('button', { name: /Create Message|New Message/i }).click();
      await orgSession!.page.locator('input[type="email"]').fill(ACCOUNTS.studentA.email);
      await orgSession!.page.locator('input[placeholder*="Subject"]').fill(flowState.orgToStudentSubject);
      await orgSession!.page.locator('textarea').fill(`Automated org message ${randomUUID()}`);
      await orgSession!.page.getByRole('button', { name: /^Send$/i }).click();
      await orgSession!.page.waitForTimeout(900);
      await orgSession!.page.getByRole('button', { name: /^sent$/i }).click();
      const body = await orgSession!.page.locator('main').innerText();
      assertOrThrow(body.includes(flowState.orgToStudentSubject), 'Org message to john not present in Sent folder');
    });

    await runItem(60, orgSession, 'Organization Flow', async () => {
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
      await orgSession!.page.getByRole('button', { name: /^profile$/i }).click();
      const desc = 'd'.repeat(510);
      const descInput = orgSession!.page.locator('textarea').first();
      await descInput.fill(desc);
      const descVal = await descInput.inputValue();
      assertOrThrow(descVal.length <= 500, `Organization description exceeded 500-char limit (${descVal.length})`);
      await orgSession!.page.locator('input[type="url"]').first().fill('https://greenearth.example.org');
      await orgSession!.page.locator('input[type="tel"]').first().fill('(555) 222-3333');
      await orgSession!.page.getByRole('button', { name: /Save Changes/i }).click();
      await orgSession!.page.waitForTimeout(900);
      await orgSession!.page.reload({ waitUntil: 'networkidle' });
      await orgSession!.page.getByRole('button', { name: /^profile$/i }).click();
      const savedUrl = await orgSession!.page.locator('input[type="url"]').first().inputValue();
      const savedPhone = await orgSession!.page.locator('input[type="tel"]').first().inputValue();
      assertOrThrow(savedUrl === 'https://greenearth.example.org', 'Org website did not persist');
      assertOrThrow(savedPhone === '(555) 222-3333', 'Org phone did not persist');
    });

    await runItem(62, orgSession, 'Organization Flow', async () => {
      const zip = `10${String(Math.floor(Math.random() * 900)).padStart(3, '0')}`;
      const zipInput = orgSession!.page.locator('input[placeholder*="e.g. 02101"]').first();
      assertOrThrow(await zipInput.count(), 'ZIP input not found in org profile');
      await zipInput.fill(zip);
      await orgSession!.page.getByRole('button', { name: /^Add$/i }).click();
      await orgSession!.page.waitForTimeout(600);
      let body = await orgSession!.page.locator('main').innerText();
      assertOrThrow(body.includes(zip), 'Added ZIP code did not appear in list');
      const removeBtn = orgSession!.page.getByRole('button', { name: '×' }).first();
      assertOrThrow(await removeBtn.count(), 'ZIP remove button not found');
      await removeBtn.click();
      await orgSession!.page.waitForTimeout(500);
      body = await orgSession!.page.locator('main').innerText();
      assertOrThrow(!body.includes(zip), 'Removed ZIP code still present in list');
    });

    await runItem(63, orgSession, 'Organization Flow', async () => {
      await orgSession!.page.getByRole('button', { name: /^schools$/i }).click();
      await orgSession!.page.waitForTimeout(500);
      const searchInput = orgSession!.page.locator('input[placeholder*="Search by school"]');
      assertOrThrow(await searchInput.count(), 'Schools search input not found');
      await searchInput.fill('Lincoln');
      await orgSession!.page.getByRole('button', { name: /^Search$/i }).click();
      await orgSession!.page.waitForTimeout(900);
      const body = await orgSession!.page.locator('main').innerText();
      if (!/Pending/i.test(body) && !/Request/i.test(body)) {
        throw new Error('Could not create/request school approval; org already approved and no request action exposed');
      }
    });

    await runItem(64, orgSession, 'Organization Flow', async () => {
      await orgSession!.page.getByRole('button', { name: /^analytics$/i }).click();
      await orgSession!.page.waitForTimeout(500);
      const body = await orgSession!.page.locator('main').innerText();
      assertOrThrow(/Total Volunteers/i.test(body), 'Analytics missing volunteer count');
      assertOrThrow(/Total Hours/i.test(body), 'Analytics missing total hours');
    });

    await runItem(65, orgSession, 'Organization Flow', async () => {
      await orgSession!.page.getByRole('button', { name: /^data$/i }).click();
      await orgSession!.page.waitForTimeout(500);
      const result = await downloadFile(
        orgSession!.page,
        () => orgSession!.page.getByRole('button', { name: /Export Volunteer Data \(CSV\)/i }).click(),
        'org-volunteers',
      );
      assertOrThrow(result.name.toLowerCase().endsWith('.csv'), 'Org export did not download .csv file');
      assertOrThrow(result.size > 0, 'Org export CSV file is empty');
    });

    await runItem(66, orgSession, 'Organization Flow', async () => {
      markManual(
        'Changing volunteer@greenearth.org password in-suite risks invalidating later required quick-smoke credentials.',
        'In Organization Settings > Security, change password and confirm login, then restore seed password for shared test-account continuity.',
      );
    });

    await runItem(67, orgSession, 'Organization Flow', async () => {
      await orgSession!.page.getByRole('button', { name: /^notifications$/i }).click();
      await orgSession!.page.waitForTimeout(500);
      const row = orgSession!.page.getByText('New Signup Alert', { exact: true });
      assertOrThrow(await row.count(), 'New Signup Alert row not found');
      const toggle = row.locator('xpath=ancestor::*[self::tr or self::div][1]//button').first();
      assertOrThrow(await toggle.count(), 'New Signup email toggle not found');
      await toggle.click();
      await orgSession!.page.getByRole('button', { name: /Save Preferences/i }).click();
      await orgSession!.page.waitForTimeout(700);
      await orgSession!.page.reload({ waitUntil: 'networkidle' });
      await orgSession!.page.getByRole('button', { name: /^notifications$/i }).click();
      await orgSession!.page.waitForTimeout(500);
      const cls = await row.locator('xpath=ancestor::*[self::tr or self::div][1]//button').first().getAttribute('class');
      assertOrThrow(Boolean(cls && cls.includes('bg-gray-300')), 'New Signup toggle state did not persist OFF after refresh');
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
      await adminSession!.page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
      await adminSession!.page.evaluate(() => {
        const keys = Object.keys(localStorage).filter((k) => k.startsWith('school_onboarding_'));
        keys.forEach((k) => localStorage.removeItem(k));
      });
      await adminSession!.page.reload({ waitUntil: 'domcontentloaded' });
      assertOrThrow(
        await adminSession!.page.getByRole('button', { name: /Continue to Dashboard/i }).count(),
        'Onboarding goal screen did not appear after clearing school_onboarding_* localStorage keys',
      );
    });

    await runItem(69, adminSession, 'School Admin Flow', async () => {
      const continueBtn = adminSession!.page.getByRole('button', { name: /Continue to Dashboard/i }).first();
      assertOrThrow(await continueBtn.count(), 'Continue to Dashboard button not present for onboarding step');
      await continueBtn.click({ timeout: 10000 });
      await adminSession!.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      assertOrThrow(/\/dashboard|\/groups/.test(adminSession!.page.url()), 'Did not land on dashboard after onboarding goal save');
    });

    await runItem(70, adminSession, 'School Admin Flow', async () => {
      const body = await adminSession!.page.locator('main').innerText();
      for (const token of ['Total Students', 'Total Hours', 'Goal Completion', 'At Risk']) {
        assertOrThrow(body.includes(token), `Dashboard stat missing: ${token}`);
      }
    });

    await runItem(71, adminSession, 'School Admin Flow', async () => {
      const body = await adminSession!.page.locator('main').innerText();
      assertOrThrow(/Classrooms/i.test(body), 'Classroom grid section missing');
      assertOrThrow(/Students/i.test(body), 'Classroom student count missing');
      assertOrThrow(/[a-z0-9]{8}/i.test(body), 'Invite code not shown in classroom grid');
    });

    await runItem(72, adminSession, 'School Admin Flow', async () => {
      const body = await adminSession!.page.locator('main').innerText();
      const codeMatch = body.match(/\b[a-z0-9]{8}\b/i);
      assertOrThrow(codeMatch, 'No invite code found to validate clipboard copy');
      await adminSession!.page.getByRole('button', { name: /^Copy$/i }).first().click();
      await adminSession!.page.waitForTimeout(500);
      try {
        const clipboard = await adminSession!.page.evaluate(async () => {
          try {
            // @ts-ignore
            return await navigator.clipboard.readText();
          } catch {
            return '';
          }
        });
        if (!clipboard) {
          markManual(
            'Clipboard read is blocked in this browser context despite copy action being clickable.',
            'Click Copy invite code, then paste into a text field to confirm clipboard content matches the invite code.',
          );
        }
        assertOrThrow(clipboard.includes(codeMatch![0]), 'Clipboard content does not contain copied invite code');
      } catch {
        markManual(
          'Clipboard API read is unavailable in this run environment.',
          'Click copy invite code and manually paste to verify copied code is correct.',
        );
      }
    });

    await runItem(73, adminSession, 'School Admin Flow', async () => {
      const approveBtn = adminSession!.page.getByRole('button', { name: /Approve/i }).first();
      assertOrThrow(await approveBtn.count(), 'No pending org request found to approve from step 3f');
      await approveBtn.click();
      await adminSession!.page.waitForTimeout(700);
      const body = await adminSession!.page.locator('main').innerText();
      assertOrThrow(/APPROVED|Approved/i.test(body), 'Approved status not visible after approving org request');
    });

    await runItem(74, adminSession, 'School Admin Flow', async () => {
      const rejectBtn = adminSession!.page.getByRole('button', { name: /Reject/i }).first();
      assertOrThrow(await rejectBtn.count(), 'No second pending org request found to reject');
      await rejectBtn.click();
      await adminSession!.page.waitForTimeout(700);
      const body = await adminSession!.page.locator('main').innerText();
      assertOrThrow(/REJECTED|Rejected/i.test(body), 'Rejected status not shown after rejecting org');
    });

    await runItem(75, adminSession, 'School Admin Flow', async () => {
      const blockButtonsBefore = await adminSession!.page.getByRole('button', { name: /^Block$/i }).count();
      assertOrThrow(blockButtonsBefore > 0, 'No approved org available to block');
      await adminSession!.page.getByRole('button', { name: /^Block$/i }).first().click();
      await adminSession!.page.waitForTimeout(700);
      if (await adminSession!.page.getByRole('button', { name: /Confirm|Yes|Block/i }).count()) {
        await adminSession!.page.getByRole('button', { name: /Confirm|Yes|Block/i }).first().click();
        await adminSession!.page.waitForTimeout(700);
      }
      const blockButtonsAfter = await adminSession!.page.getByRole('button', { name: /^Block$/i }).count();
      assertOrThrow(blockButtonsAfter < blockButtonsBefore, 'Approved org did not disappear from approved list after block');
    });

    await runItem(76, adminSession, 'School Admin Flow', async () => {
      await adminSession!.page.goto(`${BASE_URL}/groups`, { waitUntil: 'networkidle' });
      const body = await adminSession!.page.locator('main').innerText();
      assertOrThrow(/All Students/i.test(body), 'All Students sidebar entry missing');
      assertOrThrow(/CLASSROOMS/i.test(body), 'Individual classrooms sidebar section missing');
    });

    await runItem(77, adminSession, 'School Admin Flow', async () => {
      const search = adminSession!.page.locator('input[placeholder*="Search students"]');
      assertOrThrow(await search.count(), 'Student search input missing');
      await search.fill('John');
      await adminSession!.page.waitForTimeout(700);
      const body = await adminSession!.page.locator('main').innerText();
      assertOrThrow(/John/i.test(body), 'Search did not keep matching student visible');
    });

    await runItem(78, adminSession, 'School Admin Flow', async () => {
      await adminSession!.page.getByRole('button', { name: /Completed/i }).click();
      await adminSession!.page.waitForTimeout(600);
      const body = await adminSession!.page.locator('main').innerText();
      assertOrThrow(/Completed|No students/i.test(body), 'Completed filter did not apply / render expected state');
    });

    await runItem(79, adminSession, 'School Admin Flow', async () => {
      await adminSession!.page.getByRole('button', { name: /^At Risk/i }).click();
      await adminSession!.page.waitForTimeout(600);
      const body = await adminSession!.page.locator('main').innerText();
      assertOrThrow(/At Risk|No students/i.test(body), 'At Risk filter did not apply / render expected state');
    });

    await runItem(80, adminSession, 'School Admin Flow', async () => {
      await adminSession!.page.getByRole('button', { name: /Not Started/i }).click();
      await adminSession!.page.waitForTimeout(600);
      const body = await adminSession!.page.locator('main').innerText();
      assertOrThrow(/Not Started|No students/i.test(body), 'Not Started filter did not apply / render expected state');
    });

    await runItem(81, adminSession, 'School Admin Flow', async () => {
      await adminSession!.page.getByRole('button', { name: /^All\d+/i }).first().click().catch(async () => {
        await adminSession!.page.getByRole('button', { name: /All Students/i }).click();
      });
      await adminSession!.page.waitForTimeout(400);
      const johnBtn = adminSession!.page.getByRole('button', { name: /John Collander/i }).first();
      assertOrThrow(await johnBtn.count(), 'Student row for John not found');
      await johnBtn.click();
      await adminSession!.page.waitForTimeout(700);
      const body = await adminSession!.page.locator('main').innerText();
      assertOrThrow(/john@student\.edu/i.test(body), 'Right panel missing selected student email');
      assertOrThrow(/Progress/i.test(body), 'Right panel missing progress bar/info');
      assertOrThrow(/At Risk|On Track|Completed|Not Started/i.test(body), 'Right panel missing status badge');
    });

    await runItem(82, adminSession, 'School Admin Flow', async () => {
      const sendReminder = adminSession!.page.getByRole('button', { name: /Send Reminder/i }).first();
      assertOrThrow(await sendReminder.count(), 'Send Reminder button not found');
      await sendReminder.click();
      await adminSession!.page.waitForTimeout(700);
      const body = await adminSession!.page.locator('main').innerText();
      assertOrThrow(/compose|recipient|to:/i.test(body), 'Send Reminder did not open a compose window with pre-filled recipient');
    });

    await runItem(83, adminSession, 'School Admin Flow', async () => {
      const viewHistory = adminSession!.page.getByRole('button', { name: /View Hour History|Hide Hour History/i }).first();
      assertOrThrow(await viewHistory.count(), 'View Hour History control not found');
      if ((await viewHistory.textContent())?.match(/View/i)) {
        await viewHistory.click();
        await adminSession!.page.waitForTimeout(700);
      }
      const body = await adminSession!.page.locator('main').innerText();
      assertOrThrow(/h\b/i.test(body), 'Hour history does not show hours');
    });

    await runItem(84, adminSession, 'School Admin Flow', async () => {
      const beforeBody = await adminSession!.page.locator('main').innerText();
      const beforeTotalMatch = beforeBody.match(/Total Hours\s*([\d.]+)/i);
      const beforeTotal = beforeTotalMatch ? Number(beforeTotalMatch[1]) : NaN;

      const removeBtn = adminSession!.page.getByRole('button', { name: /Remove Hours/i }).first();
      assertOrThrow(await removeBtn.count(), 'Remove Hours action not found on a VERIFIED session');
      await removeBtn.click();
      await adminSession!.page.waitForTimeout(700);
      if (await adminSession!.page.locator('textarea').count()) {
        await adminSession!.page.locator('textarea').first().fill('QA remove-hours test');
      }
      if (await adminSession!.page.getByRole('button', { name: /Confirm|Remove|Reject/i }).count()) {
        await adminSession!.page.getByRole('button', { name: /Confirm|Remove|Reject/i }).first().click();
      }
      await adminSession!.page.waitForTimeout(1000);
      await adminSession!.page.reload({ waitUntil: 'networkidle' });
      const afterBody = await adminSession!.page.locator('main').innerText();
      assertOrThrow(/REJECTED|Rejected|Remove Hours/i.test(afterBody), 'Session status did not reflect removed/rejected hours');

      const afterTotalMatch = afterBody.match(/Total Hours\s*([\d.]+)/i);
      const afterTotal = afterTotalMatch ? Number(afterTotalMatch[1]) : NaN;
      if (!Number.isNaN(beforeTotal) && !Number.isNaN(afterTotal)) {
        assertOrThrow(afterTotal <= beforeTotal, 'School total hours did not decrease after removing hours');
      }
    });

    await runItem(85, adminSession, 'School Admin Flow', async () => {
      await adminSession!.page.goto(`${BASE_URL}/groups`, { waitUntil: 'networkidle' });
      await adminSession!.page.getByRole('button', { name: /Add Staff Member/i }).click();
      await adminSession!.page.waitForTimeout(500);
      const unique = Date.now();
      await adminSession!.page.locator('input[type="text"]').first().fill(`QA Teacher ${unique}`);
      await adminSession!.page.locator('input[type="email"]').first().fill(`qa-teacher-${unique}@mailinator.com`);
      const select = adminSession!.page.locator('select').first();
      if (await select.count()) {
        const opts = await select.evaluate((s: HTMLSelectElement) => Array.from(s.options).map((o) => o.value).filter(Boolean));
        if (opts.length) await select.selectOption(opts[0]);
      }
      await adminSession!.page.getByRole('button', { name: /Create Account|Submit/i }).first().click();
      await adminSession!.page.waitForTimeout(900);
      const body = await adminSession!.page.locator('main').innerText();
      assertOrThrow(/temporary password|success|created/i.test(body), 'Add Staff flow did not show success with temporary password');
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
      await adminSession!.page.getByRole('button', { name: /^classrooms$/i }).click();
      await adminSession!.page.waitForTimeout(500);
      const className = `QA Classroom ${Date.now()}`;
      const input = adminSession!.page.locator('input[placeholder*="New classroom name"]').first();
      assertOrThrow(await input.count(), 'Create Classroom input not found');
      await input.fill(className);
      await adminSession!.page.getByRole('button', { name: /^Create$/i }).click();
      await adminSession!.page.waitForTimeout(900);
      const body = await adminSession!.page.locator('main').innerText();
      assertOrThrow(body.includes(className), 'Created classroom not shown in list');
      assertOrThrow(/[a-z0-9]{8}/i.test(body), 'Created classroom does not display invite code');
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
      await firstToggle.click();
      await adminSession!.page.getByRole('button', { name: /Save Preferences/i }).click();
      await adminSession!.page.waitForTimeout(700);
      await adminSession!.page.reload({ waitUntil: 'networkidle' });
      await adminSession!.page.getByRole('button', { name: /^notifications$/i }).click();
      const cls = await adminSession!.page.locator('button.w-10.h-5').first().getAttribute('class');
      assertOrThrow(Boolean(cls && cls.includes('bg-gray-300')), 'Admin notification toggle did not persist OFF after refresh');
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
      const blocked = sendResp.status() >= 400 && /Message preferences do not allow this|preferences/i.test(`${txt} ${body}`);
      assertOrThrow(blocked, 'Org-to-student message was not blocked by student privacy Admins Only setting');
    });

    await runItem(92, adminSession, 'Cross-Role & Edge Cases', async () => {
      await adminSession!.page.goto(`${BASE_URL}/groups`, { waitUntil: 'networkidle' });
      const body = await adminSession!.page.locator('body').innerText();
      assertOrThrow(/Audit Log|Audit Trail/i.test(body), 'No audit trail UI found for approved-then-removed session history verification');
    });

    await runItem(93, undefined, 'Cross-Role & Edge Cases', async () => {
      const rateSession = await startAnonymousSession(browser, 'rate-limit');
      sessions.push(rateSession);
      const statuses: number[] = [];
      let saw429Body = '';

      for (let i = 0; i < 7; i += 1) {
        const email = `qa-rate-${Date.now()}-${i}@mailinator.com`;
        const resp = await rateSession.context.request.post(`${BASE_URL}/api/auth/signup`, {
          data: {
            role: 'STUDENT',
            name: `Rate Tester ${i}`,
            email,
            age: 16,
            password: 'Password1!',
          },
        });
        statuses.push(resp.status());
        const txt = await resp.text().catch(() => '');
        if (resp.status() === 429) {
          saw429Body = txt;
          break;
        }
      }

      assertOrThrow(statuses.some((s) => s === 429), `No 429 returned after 6+ signup attempts. Statuses: ${statuses.join(', ')}`);
      assertOrThrow(/Too many signup attempts/i.test(saw429Body), '429 response did not include expected rate-limit message');
    });

    await runItem(94, undefined, 'Cross-Role & Edge Cases', async () => {
      markManual(
        'Token-expiry >24h cannot be time-traveled from UI and no exposed admin control was found to mint an already-expired verification token.',
        'Generate a verification token, wait past 24 hours (or use backend/admin tooling to mint expired token), then open link and confirm "Invalid or expired verification token".',
      );
    });

    await runItem(95, authSession, 'Cross-Role & Edge Cases', async () => {
      const resendEmail = `qa-test-${Date.now().toString().slice(-6)}@mailinator.com`;
      const signupResp = await signupVolunteer(authSession!.page, resendEmail, 'Password1!', 'QA Resend User');
      assertOrThrow(signupResp.status() === 201, `Failed to create resend-test account. status=${signupResp.status()}`);
      const inbox = resendEmail.split('@')[0];

      const first = await fetchMailinatorMessage(browser, inbox, /Verify your GoodHours account/i, 180_000);
      const oldLink = first.links.find((l) => /verify-email\?token=/i.test(l));
      assertOrThrow(oldLink, 'Old verification token link not found');

      const resendBtn = authSession!.page.getByRole('button', { name: /Resend verification email|Resend/i }).first();
      assertOrThrow(await resendBtn.count(), 'Resend button not found on verification screen');
      await resendBtn.click();
      await authSession!.page.waitForTimeout(1200);

      const second = await fetchMailinatorMessage(browser, inbox, /Verify your GoodHours account/i, 180_000);
      const newLink = second.links.find((l) => /verify-email\?token=/i.test(l));
      assertOrThrow(newLink, 'New verification token link not found after resend');
      assertOrThrow(newLink !== oldLink, 'Resend verification did not produce a new token link');

      flowState.verifyLinkOld = oldLink!;
      flowState.verifyLinkNew = newLink!;

      await authSession!.page.goto(flowState.verifyLinkOld, { waitUntil: 'networkidle' });
      await authSession!.page.waitForTimeout(1200);
      const body = await authSession!.page.locator('body').innerText();
      assertOrThrow(
        /Invalid or expired verification token|expired verification token|Verify your email/i.test(body),
        'Old token did not show invalid/expired behavior after resend',
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
      const count = await quickJohn.page.locator('a[href^="/opportunity/"]').count();
      assertOrThrow(count > 0, 'Browse page did not load opportunities in quick smoke');
      const newErrors = quickJohn.logs.filter((l) => l.level === 'console.error').map((l) => l.text);
      flowState.quickSmokeConsoleErrors.push(...newErrors);
    });

    const quickOrg = await startAnonymousSession(browser, 'quick-org');
    sessions.push(quickOrg);
    await runItem(99, quickOrg, 'Quick Smoke', async () => {
      await login(quickOrg.page, ACCOUNTS.org.email, ACCOUNTS.org.password, false);
      await quickOrg.page.goto(`${BASE_URL}/opportunities`, { waitUntil: 'networkidle' });
      const body = await quickOrg.page.locator('main').innerText();
      assertOrThrow(/My Opportunities/i.test(body), 'Org opportunities list did not load in quick smoke');
      const newErrors = quickOrg.logs.filter((l) => l.level === 'console.error').map((l) => l.text);
      flowState.quickSmokeConsoleErrors.push(...newErrors);
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
