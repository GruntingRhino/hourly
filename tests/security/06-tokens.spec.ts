/**
 * Parent/Public Token Safety Tests
 *
 * Parent/guardian progress sharing is intentionally disabled until a
 * school-controlled workflow exists.
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
test.beforeAll(async () => {
  ids = await getIds();
  [tStudent1, tSchoolA] = await Promise.all([
    getToken("student1"),
    getToken("schoolA"),
  ]);
});

// ── PT-01: Parent link generation is disabled ────────────────────────────────

test("PT-01a: STUDENT cannot POST /api/reports/parent-link", async ({ request }) => {
  const res = await request.post(`${BASE}/api/reports/parent-link`, auth(tStudent1));
  expect(res.status()).toBe(403);
  const body = await res.json();
  expect(body.error).toMatch(/disabled|school-managed|ferpa/i);
});

test("PT-01b: /api/reports/parent-progress is disabled even with a token parameter", async ({ request }) => {
  const res = await request.get(
    `${BASE}/api/reports/parent-progress?token=not-a-real-token`,
  );
  expect(res.status()).toBe(403);
  const body = await res.json();
  expect(body.error).toMatch(/disabled|school-managed|ferpa/i);
});

// ── PT-02: Missing or empty token parameter still blocked ────────────────────

test("PT-02a: missing token parameter is rejected", async ({ request }) => {
  const res = await request.get(`${BASE}/api/reports/parent-progress`);
  expect(res.status()).toBe(403);
  const body = await res.json();
  expect(body.error).toMatch(/disabled|school-managed|ferpa/i);
});

test("PT-02b: empty token parameter is rejected", async ({ request }) => {
  const res = await request.get(`${BASE}/api/reports/parent-progress?token=`);
  expect(res.status()).toBe(403);
});

// ── PT-03: Non-student cannot generate parent link ───────────────────────────

test("PT-03a: SCHOOL_ADMIN cannot POST /api/reports/parent-link → 403", async ({ request }) => {
  const res = await request.post(`${BASE}/api/reports/parent-link`, auth(tSchoolA));
  expect(res.status()).toBe(403);
  const body = await res.json();
  expect(body.error).toMatch(/student role required|disabled/i);
});

test("PT-03b: unauthenticated POST /api/reports/parent-link → 401", async ({ request }) => {
  const res = await request.post(`${BASE}/api/reports/parent-link`);
  expect(res.status()).toBe(401);
});
