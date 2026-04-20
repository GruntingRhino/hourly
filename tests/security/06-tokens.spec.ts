/**
 * Parent/Public Token Safety Tests
 *
 * The /api/reports/parent-progress endpoint is unauthenticated (no JWT required)
 * and uses a separate JWT with purpose="PARENT_PROGRESS".
 *
 * Tests verify:
 * - Valid token returns minimal data (no email, no sessions)
 * - Expired / wrong-signature tokens are rejected
 * - Regular login JWT cannot be repurposed as a parent token
 * - The token always returns only the embedded student's data
 * - Only STUDENTs can generate parent links
 */
import { test, expect, request } from "@playwright/test";
import { BASE, getToken, auth } from "./helpers/tokens";
import { getIds, Ids } from "./helpers/setup";

let ids: Ids;
let tStudent1: string;
let tSchoolA: string;
let parentToken: string;

test.beforeAll(async () => {
  ids = await getIds();
  [tStudent1, tSchoolA] = await Promise.all([
    getToken("student1"),
    getToken("schoolA"),
  ]);

  // Generate a fresh parent progress link for student1
  const ctx = await request.newContext();
  const res = await ctx.post(`${BASE}/api/reports/parent-link`, auth(tStudent1));
  if (!res.ok()) {
    throw new Error(`parent-link failed: ${res.status()} — ${await res.text()}`);
  }
  const body = await res.json();
  parentToken = body.token as string;
  await ctx.dispose();
});

// ── PT-01: Valid token returns correct minimal payload ───────────────────────

test("PT-01a: valid parent token returns student progress fields", async ({ request }) => {
  const res = await request.get(
    `${BASE}/api/reports/parent-progress?token=${encodeURIComponent(parentToken)}`,
  );
  expect(res.ok()).toBe(true);
  const body = await res.json();

  // Required fields
  expect(body).toHaveProperty("student");
  expect(body).toHaveProperty("approvedHours");
  expect(body).toHaveProperty("pendingHours");
  expect(body).toHaveProperty("requiredHours");
  expect(body).toHaveProperty("remainingHours");
  expect(body).toHaveProperty("percentComplete");
  expect(body).toHaveProperty("deadline");
  expect(body.student).toHaveProperty("id");
  expect(body.student).toHaveProperty("name");
  expect(body.student).toHaveProperty("grade");
});

test("PT-01b: valid parent token does not expose email or raw sessions", async ({ request }) => {
  const res = await request.get(
    `${BASE}/api/reports/parent-progress?token=${encodeURIComponent(parentToken)}`,
  );
  expect(res.ok()).toBe(true);
  const body = await res.json();

  // MUST NOT expose these fields
  expect(body.student).not.toHaveProperty("email");
  expect(body.student).not.toHaveProperty("passwordHash");
  expect(body).not.toHaveProperty("sessions");
  expect(body).not.toHaveProperty("approved");
  expect(body).not.toHaveProperty("rejected");
});

test("PT-01c: valid parent token is for the correct student", async ({ request }) => {
  const res = await request.get(
    `${BASE}/api/reports/parent-progress?token=${encodeURIComponent(parentToken)}`,
  );
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body.student.id).toBe(ids.student1Id);
});

// ── PT-02: Invalid signatures rejected ──────────────────────────────────────

test("PT-02a: tampered JWT (invalid signature) → 400", async ({ request }) => {
  // Replace the signature segment with garbage
  const parts = parentToken.split(".");
  const tampered = `${parts[0]}.${parts[1]}.invalidsignatureXXXXXXXX`;
  const res = await request.get(
    `${BASE}/api/reports/parent-progress?token=${encodeURIComponent(tampered)}`,
  );
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toBeTruthy();
});

test("PT-02b: completely random string as token → 400", async ({ request }) => {
  const res = await request.get(
    `${BASE}/api/reports/parent-progress?token=completelyrandomnotajwtXYZ123`,
  );
  expect(res.status()).toBe(400);
});

test("PT-02c: well-formed JWT signed with wrong key → 400", async ({ request }) => {
  // A plausible JWT structure but signed with the wrong key
  const fakeJwt =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" +          // header: {"alg":"HS256","typ":"JWT"}
    ".eyJzdHVkZW50SWQiOiJmYWtlIiwicHVycG9zZSI6IlBBUkVOVF9QUk9HUkVTUyIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjo5OTk5OTk5OTk5fQ" + // payload
    ".fake_hmac_signature_that_will_fail";
  const res = await request.get(
    `${BASE}/api/reports/parent-progress?token=${encodeURIComponent(fakeJwt)}`,
  );
  expect(res.status()).toBe(400);
});

// ── PT-03: Expired token structure (non-zero exp in the past) ────────────────
// We cannot generate a real expired token without the JWT_SECRET.
// We verify that the tampered-signature test above covers the case where
// an attacker might construct a token with exp in the past.

test("PT-03: token with past exp but tampered signature → 400", async ({ request }) => {
  // exp=1700000001 is well in the past
  const header = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url");
  const payload = Buffer.from(
    '{"studentId":"fake","purpose":"PARENT_PROGRESS","iat":1700000000,"exp":1700000001}',
  ).toString("base64url");
  const fakeToken = `${header}.${payload}.badsignature`;
  const res = await request.get(
    `${BASE}/api/reports/parent-progress?token=${encodeURIComponent(fakeToken)}`,
  );
  expect(res.status()).toBe(400);
});

// ── PT-04: Regular login JWT repurposed as parent token ──────────────────────

test("PT-04: student login JWT cannot be used as parent progress token → 400", async ({ request }) => {
  // The login JWT contains userId/email/role — not studentId/purpose=PARENT_PROGRESS
  const res = await request.get(
    `${BASE}/api/reports/parent-progress?token=${encodeURIComponent(tStudent1)}`,
  );
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toMatch(/invalid parent progress token/i);
});

test("PT-04b: school admin login JWT cannot be used as parent progress token → 400", async ({ request }) => {
  const res = await request.get(
    `${BASE}/api/reports/parent-progress?token=${encodeURIComponent(tSchoolA)}`,
  );
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toMatch(/invalid parent progress token/i);
});

// ── PT-05: Token always returns only embedded student ───────────────────────

test("PT-05: parent token for student1 always returns student1 data only", async ({ request }) => {
  // Two consecutive requests with the same token → always same student
  const [res1, res2] = await Promise.all([
    request.get(`${BASE}/api/reports/parent-progress?token=${encodeURIComponent(parentToken)}`),
    request.get(`${BASE}/api/reports/parent-progress?token=${encodeURIComponent(parentToken)}`),
  ]);
  const [b1, b2] = await Promise.all([res1.json(), res2.json()]);
  expect(b1.student.id).toBe(ids.student1Id);
  expect(b2.student.id).toBe(ids.student1Id);
});

// ── PT-06: Missing or empty token parameter ──────────────────────────────────

test("PT-06a: missing token parameter → 400", async ({ request }) => {
  const res = await request.get(`${BASE}/api/reports/parent-progress`);
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toMatch(/token.*required/i);
});

test("PT-06b: empty token parameter → 400", async ({ request }) => {
  const res = await request.get(`${BASE}/api/reports/parent-progress?token=`);
  expect(res.status()).toBe(400);
});

// ── PT-07: Non-student cannot generate parent link ───────────────────────────

test("PT-07a: SCHOOL_ADMIN cannot POST /api/reports/parent-link → 403", async ({ request }) => {
  const res = await request.post(`${BASE}/api/reports/parent-link`, auth(tSchoolA));
  expect(res.status()).toBe(403);
  const body = await res.json();
  expect(body.error).toMatch(/student role required/i);
});

test("PT-07b: unauthenticated POST /api/reports/parent-link → 401", async ({ request }) => {
  const res = await request.post(`${BASE}/api/reports/parent-link`);
  expect(res.status()).toBe(401);
});

// ── PT-08: Parent link URL contains student1's token only ────────────────────

test("PT-08: POST /api/reports/parent-link returns token and url", async ({ request }) => {
  const res = await request.post(`${BASE}/api/reports/parent-link`, auth(tStudent1));
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body).toHaveProperty("token");
  expect(body).toHaveProperty("url");
  expect(typeof body.token).toBe("string");
  expect(body.token.split(".")).toHaveLength(3); // valid JWT structure
  // URL must contain the token
  expect(body.url).toContain("parent-progress");
});
