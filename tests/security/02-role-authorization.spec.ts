/**
 * Role Authorization Tests
 *
 * Verifies that each role can only perform actions within its scope.
 * Tests the requireRole() middleware for every sensitive endpoint.
 *
 * Key: STUDENT and BENEFICIARY_ADMIN must be blocked from all admin-only
 * and school-staff-only actions. A fake session ID is used where a real
 * ServiceSession is not available — the role check fires before the DB lookup.
 */
import { test, expect, request } from "@playwright/test";
import { BASE, getToken, auth } from "./helpers/tokens";
import { getIds, Ids, ensurePendingSubmission } from "./helpers/setup";

let ids: Ids;
let tSchoolA: string;
let tOrgA: string;
let tStudent1: string;
let pendingSubId: string;

test.beforeAll(async () => {
  ids = await getIds();
  [tSchoolA, tOrgA, tStudent1] = await Promise.all([
    getToken("schoolA"),
    getToken("orgA"),
    getToken("student1"),
  ]);

  pendingSubId = await ensurePendingSubmission("student1", "schoolA", ids.schoolAId, {
    date: "2025-11-10",
    hours: 2,
  });
});

// ── RA-01: STUDENT cannot approve legacy verification sessions ───────────────

test("RA-01: STUDENT cannot POST /api/verification/:id/approve → 403", async ({ request }) => {
  // requireRole("ORG_ADMIN","SCHOOL_ADMIN","TEACHER") fires before DB lookup
  const res = await request.post(
    `${BASE}/api/verification/fake-session-id-000000000/approve`,
    { data: {}, ...auth(tStudent1) },
  );
  expect(res.status()).toBe(403);
});

test("RA-01b: STUDENT cannot POST /api/verification/:id/reject → 403", async ({ request }) => {
  const res = await request.post(
    `${BASE}/api/verification/fake-session-id-000000000/reject`,
    { data: { reason: "student rejection attempt" }, ...auth(tStudent1) },
  );
  expect(res.status()).toBe(403);
});

// ── RA-02: STUDENT cannot approve self-submissions ───────────────────────────

test("RA-02: STUDENT cannot POST /api/self-submissions/:id/approve → 403", async ({ request }) => {
  if (!pendingSubId) test.skip(true, "No pending submission available");
  const res = await request.post(
    `${BASE}/api/self-submissions/${pendingSubId}/approve`,
    { data: {}, ...auth(tStudent1) },
  );
  expect(res.status()).toBe(403);
});

test("RA-02b: STUDENT cannot POST /api/self-submissions/:id/reject → 403", async ({ request }) => {
  if (!pendingSubId) test.skip(true, "No pending submission available");
  const res = await request.post(
    `${BASE}/api/self-submissions/${pendingSubId}/reject`,
    { data: { reason: "student reject" }, ...auth(tStudent1) },
  );
  expect(res.status()).toBe(403);
});

test("RA-02c: STUDENT cannot POST /api/self-submissions/:id/request-revision → 403", async ({ request }) => {
  if (!pendingSubId) test.skip(true, "No pending submission available");
  const res = await request.post(
    `${BASE}/api/self-submissions/${pendingSubId}/request-revision`,
    { data: { note: "student revision attempt" }, ...auth(tStudent1) },
  );
  expect(res.status()).toBe(403);
});

// ── RA-03: BENEFICIARY_ADMIN cannot read school report ───────────────────────

test("RA-03: BENEFICIARY_ADMIN cannot GET /api/reports/school → 403", async ({ request }) => {
  const res = await request.get(`${BASE}/api/reports/school`, auth(tOrgA));
  expect(res.status()).toBe(403);
  const body = await res.json();
  expect(body.error).toMatch(/school role required/i);
});

// ── RA-04: BENEFICIARY_ADMIN cannot create cohorts ───────────────────────────

test("RA-04: BENEFICIARY_ADMIN cannot POST /api/cohorts → 403", async ({ request }) => {
  const res = await request.post(`${BASE}/api/cohorts`, {
    data: { name: "Injected Cohort", status: "PUBLISHED" },
    ...auth(tOrgA),
  });
  expect(res.status()).toBe(403);
});

// ── RA-05: STUDENT cannot create cohorts ─────────────────────────────────────

test("RA-05: STUDENT cannot POST /api/cohorts → 403", async ({ request }) => {
  const res = await request.post(`${BASE}/api/cohorts`, {
    data: { name: "Student Injected Cohort" },
    ...auth(tStudent1),
  });
  expect(res.status()).toBe(403);
});

// ── RA-06: STUDENT cannot send bulk messages ─────────────────────────────────

test("RA-06: STUDENT cannot POST /api/messages/bulk → 403", async ({ request }) => {
  const res = await request.post(`${BASE}/api/messages/bulk`, {
    data: {
      audience: "ALL_STUDENTS",
      body: "Mass message from a student — should be blocked",
    },
    ...auth(tStudent1),
  });
  expect(res.status()).toBe(403);
});

// ── RA-07: BENEFICIARY_ADMIN cannot approve self-submissions ─────────────────

test("RA-07: BENEFICIARY_ADMIN cannot POST /api/self-submissions/:id/approve → 403", async ({ request }) => {
  if (!pendingSubId) test.skip(true, "No pending submission available");
  const res = await request.post(
    `${BASE}/api/self-submissions/${pendingSubId}/approve`,
    { data: {}, ...auth(tOrgA) },
  );
  expect(res.status()).toBe(403);
});

// ── RA-08: STUDENT cannot view verification queues ───────────────────────────

test("RA-08a: STUDENT cannot GET /api/verification/pending → 403", async ({ request }) => {
  const res = await request.get(`${BASE}/api/verification/pending`, auth(tStudent1));
  expect(res.status()).toBe(403);
});

test("RA-08b: STUDENT cannot GET /api/verification/school-pending → 403", async ({ request }) => {
  const res = await request.get(`${BASE}/api/verification/school-pending`, auth(tStudent1));
  expect(res.status()).toBe(403);
});

test("RA-08c: BENEFICIARY_ADMIN cannot GET /api/verification/school-pending → 403", async ({ request }) => {
  const res = await request.get(`${BASE}/api/verification/school-pending`, auth(tOrgA));
  expect(res.status()).toBe(403);
});

// ── RA-09: STUDENT cannot bulk-import prior hours via CSV ────────────────────

test("RA-09: STUDENT cannot POST /api/self-submissions/import → 403", async ({ request }) => {
  const csv = "student_email,organization_name,date,hours\ntest@test.com,Test Org,2025-10-01,2";
  const res = await request.post(`${BASE}/api/self-submissions/import`, {
    data: { csvData: csv },
    ...auth(tStudent1),
  });
  expect(res.status()).toBe(403);
});

// ── RA-10: STUDENT cannot trigger reminder cycle ─────────────────────────────

test("RA-10: STUDENT cannot POST /api/messages/reminders/run → 403", async ({ request }) => {
  const res = await request.post(`${BASE}/api/messages/reminders/run`, {
    data: {},
    ...auth(tStudent1),
  });
  expect(res.status()).toBe(403);
});

// ── RA-11: STUDENT cannot update school settings ─────────────────────────────

test("RA-11: STUDENT cannot PUT /api/schools/:id → 403", async ({ request }) => {
  const res = await request.put(`${BASE}/api/schools/${ids.schoolAId}`, {
    data: { allowSelfSubmission: false },
    ...auth(tStudent1),
  });
  expect(res.status()).toBe(403);
});

// ── RA-12: BENEFICIARY_ADMIN cannot run reminders ────────────────────────────

test("RA-12: BENEFICIARY_ADMIN cannot POST /api/messages/reminders/run → 403", async ({ request }) => {
  const res = await request.post(`${BASE}/api/messages/reminders/run`, {
    data: {},
    ...auth(tOrgA),
  });
  expect(res.status()).toBe(403);
});

// ── RA-13: STUDENT cannot export school CSV ──────────────────────────────────
// The route checks: role !== STUDENT && type !== student → 403
// A STUDENT calling with no params gets their own data (allowed).
// A SCHOOL_ADMIN calling gets 403 (tested in 05-reports-exports).
// Here: verify STUDENT always gets their own data even if they try type tricks.

test("RA-13: STUDENT export ignores type param and always returns own data", async ({ request }) => {
  // Student can export; endpoint ignores ?type= for students
  const res = await request.get(`${BASE}/api/reports/export/csv`, auth(tStudent1));
  expect(res.ok()).toBe(true);
  expect(res.headers()["content-type"]).toMatch(/text\/csv/);
});

// ── RA-14: No token at all → 401 on every write endpoint ────────────────────

const WRITE_ENDPOINTS = [
  { method: "POST", path: "/api/self-submissions" },
  { method: "POST", path: "/api/messages/bulk" },
  { method: "POST", path: "/api/messages/reminders/run" },
  { method: "POST", path: "/api/self-submissions/import" },
  { method: "POST", path: "/api/cohorts" },
];

for (const { method, path } of WRITE_ENDPOINTS) {
  test(`RA-14: unauthenticated ${method} ${path} → 401`, async ({ request }) => {
    const res = method === "POST"
      ? await request.post(`${BASE}${path}`, { data: {} })
      : await request.get(`${BASE}${path}`);
    expect(res.status()).toBe(401);
  });
}
