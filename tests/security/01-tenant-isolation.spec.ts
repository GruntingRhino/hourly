/**
 * Tenant Isolation Tests
 *
 * Verifies that School A actors cannot read, modify, or message School B data
 * by swapping IDs in route params and query strings.
 *
 * Precondition: run `cd server && npx tsx prisma/seed-playwright.ts`
 */
import { test, expect, request } from "@playwright/test";
import { BASE, getToken, auth } from "./helpers/tokens";
import { getIds, Ids, ensurePendingSubmission } from "./helpers/setup";

let ids: Ids;
let tA: string;  // School A admin token
let tB: string;  // School B admin token
let tS1: string; // Student 1 token (School A)
let tS3: string; // Student 3 token (School B)
let sub3Id: string; // Pending submission belonging to student3 / school B

test.beforeAll(async () => {
  ids = await getIds();
  [tA, tB, tS1, tS3] = await Promise.all([
    getToken("schoolA"),
    getToken("schoolB"),
    getToken("student1"),
    getToken("student3"),
  ]);

  sub3Id = await ensurePendingSubmission("student3", "schoolB", ids.schoolBId, {
    date: "2025-10-15",
    hours: 3,
  });
});

// ── TI-01: Cross-school student report via ?studentId param ──────────────────

test("TI-01: School A admin cannot GET student3 report via ?studentId → 403", async ({ request }) => {
  const res = await request.get(
    `${BASE}/api/reports/student?studentId=${ids.student3Id}`,
    auth(tA),
  );
  expect(res.status()).toBe(403);
  const body = await res.json();
  expect(body.error).toMatch(/not enrolled in your school/i);
});

// ── TI-02: Student cannot view another student's report ──────────────────────

test("TI-02: student1 cannot GET student3 report via ?studentId → 403", async ({ request }) => {
  const res = await request.get(
    `${BASE}/api/reports/student?studentId=${ids.student3Id}`,
    auth(tS1),
  );
  expect(res.status()).toBe(403);
  const body = await res.json();
  expect(body.error).toMatch(/cannot view this report/i);
});

// ── TI-04: Cross-school self-submission approve ──────────────────────────────

test("TI-04: School A admin cannot approve School B student submission → 403", async ({ request }) => {
  if (!sub3Id) test.skip(true, "No pending submission for student3");

  const res = await request.post(
    `${BASE}/api/self-submissions/${sub3Id}/approve`,
    { data: {}, ...auth(tA) },
  );
  expect(res.status()).toBe(403);
  const body = await res.json();
  expect(body.error).toMatch(/not your school/i);
});

// ── TI-05: Cross-school self-submission reject ───────────────────────────────

test("TI-05: School A admin cannot reject School B student submission → 403", async ({ request }) => {
  if (!sub3Id) test.skip(true, "No pending submission for student3");

  const res = await request.post(
    `${BASE}/api/self-submissions/${sub3Id}/reject`,
    { data: { reason: "Cross-school attack test" }, ...auth(tA) },
  );
  expect(res.status()).toBe(403);
  const body = await res.json();
  expect(body.error).toMatch(/not your school/i);
});

// ── TI-06: Cross-school revision request ────────────────────────────────────

test("TI-06: School A admin cannot request revision on School B submission → 403", async ({ request }) => {
  if (!sub3Id) test.skip(true, "No pending submission for student3");

  const res = await request.post(
    `${BASE}/api/self-submissions/${sub3Id}/request-revision`,
    { data: { note: "Cross-school revision attack" }, ...auth(tA) },
  );
  expect(res.status()).toBe(403);
  const body = await res.json();
  expect(body.error).toMatch(/not your school/i);
});

// ── TI-07: School A admin cannot GET School B school details ─────────────────

test("TI-07: School A admin cannot GET /api/schools/:schoolBId → 403", async ({ request }) => {
  const res = await request.get(`${BASE}/api/schools/${ids.schoolBId}`, auth(tA));
  expect(res.status()).toBe(403);
  const body = await res.json();
  expect(body.error).toMatch(/not your school/i);
});

// ── TI-08: School A admin cannot GET School B student list ───────────────────

test("TI-08: School A admin cannot GET /api/schools/:schoolBId/students → 403", async ({ request }) => {
  const res = await request.get(
    `${BASE}/api/schools/${ids.schoolBId}/students`,
    auth(tA),
  );
  expect(res.status()).toBe(403);
  const body = await res.json();
  expect(body.error).toMatch(/not your school/i);
});

// ── TI-09: Bulk message to cross-school cohort ───────────────────────────────

test("TI-09: School A admin cannot bulk-message School B cohort → 404", async ({ request }) => {
  const res = await request.post(`${BASE}/api/messages/bulk`, {
    data: {
      audience: "COHORT_STUDENTS",
      cohortId: ids.cohortBId,
      body: "Cross-school bulk message attack",
    },
    ...auth(tA),
  });
  expect(res.status()).toBe(404);
  const body = await res.json();
  expect(body.error).toMatch(/cohort not found for this school/i);
});

// ── TI-10: Cohort list scoped to own school ──────────────────────────────────

test("TI-10: School A cohort list never includes School B cohorts", async ({ request }) => {
  const res = await request.get(`${BASE}/api/cohorts`, auth(tA));
  expect(res.ok()).toBe(true);
  const cohorts: Array<{ id: string }> = await res.json();
  // schoolId may not be in the payload — the key assertion is that School B's cohort is absent
  expect(cohorts.find((c) => c.id === ids.cohortBId)).toBeUndefined();
});

// ── TI-11: School directory does not expose registration tokens ──────────────

test("TI-11: school search results never include registrationToken or registrationEmail", async ({ request }) => {
  const res = await request.get(
    `${BASE}/api/schools?search=Playwright`,
    auth(tA),
  );
  expect(res.ok()).toBe(true);
  const schools: object[] = await res.json();
  expect(schools.length).toBeGreaterThan(0);
  for (const school of schools) {
    expect(school).not.toHaveProperty("registrationToken");
    expect(school).not.toHaveProperty("registrationEmail");
    expect(school).not.toHaveProperty("registrationTokenExpires");
    expect(school).not.toHaveProperty("passwordHash");
  }
});

// ── TI-12: Student self-submission list scoped to own records ────────────────

test("TI-12: student1 submission list contains only student1 records", async ({ request }) => {
  const res = await request.get(`${BASE}/api/self-submissions`, auth(tS1));
  expect(res.ok()).toBe(true);
  const subs: Array<{ studentId: string }> = await res.json();
  for (const sub of subs) {
    expect(sub.studentId).toBe(ids.student1Id);
  }
  // Specifically: student3's submission must not appear
  expect(subs.find((s) => s.studentId === ids.student3Id)).toBeUndefined();
});

// ── TI-13: Cross-school student verification history blocked ─────────────────

test("TI-13: School A admin cannot GET School B student verification history → 403", async ({ request }) => {
  const res = await request.get(
    `${BASE}/api/schools/${ids.schoolBId}/students/${ids.student3Id}/verification-history`,
    auth(tA),
  );
  expect(res.status()).toBe(403);
  const body = await res.json();
  expect(body.error).toMatch(/not your school/i);
});

// ── TI-14: School A admin cannot view School B school report ─────────────────
// (covered more fully in 05-reports-exports.spec.ts — included here for
// completeness so TI tests are self-contained)

test("TI-14: School B report does not include School A students", async ({ request }) => {
  const res = await request.get(`${BASE}/api/reports/school`, auth(tB));
  expect(res.ok()).toBe(true);
  const body = await res.json();
  const students: Array<{ studentId: string }> = body.students ?? [];
  expect(students.find((s) => s.studentId === ids.student1Id)).toBeUndefined();
  expect(students.find((s) => s.studentId === ids.student2Id)).toBeUndefined();
});

// ── TI-15: Unauthenticated access → 401 everywhere ──────────────────────────

test("TI-15: unauthenticated access to /api/reports/school → 401", async ({ request }) => {
  const res = await request.get(`${BASE}/api/reports/school`);
  expect(res.status()).toBe(401);
});

test("TI-15b: unauthenticated access to /api/cohorts → 401", async ({ request }) => {
  const res = await request.get(`${BASE}/api/cohorts`);
  expect(res.status()).toBe(401);
});

test("TI-15c: unauthenticated access to /api/self-submissions → 401", async ({ request }) => {
  const res = await request.get(`${BASE}/api/self-submissions`);
  expect(res.status()).toBe(401);
});
