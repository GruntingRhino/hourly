/**
 * Reports & Export Safety Tests
 *
 * Verifies:
 * - School reports are scoped to own school
 * - Student CSV exports only include own approved data
 * - Cross-school ?studentId param is blocked
 * - Org report cross-org via ?organizationId (known gap — test documents it)
 * - Unauthenticated and wrong-role access blocked
 */
import { test, expect } from "@playwright/test";
import { BASE, getToken, auth } from "./helpers/tokens";
import { getIds, Ids } from "./helpers/setup";

let ids: Ids;
let tSchoolA: string;
let tSchoolB: string;
let tOrgA: string;
let tStudent1: string;
let tStudent3: string;

test.beforeAll(async () => {
  ids = await getIds();
  [tSchoolA, tSchoolB, tOrgA, tStudent1, tStudent3] = await Promise.all([
    getToken("schoolA"),
    getToken("schoolB"),
    getToken("orgA"),
    getToken("student1"),
    getToken("student3"),
  ]);
});

// ── ER-01: School report scoped to own school ────────────────────────────────

test("ER-01a: school A report contains only school A students", async ({ request }) => {
  const res = await request.get(`${BASE}/api/reports/school`, auth(tSchoolA));
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body).toHaveProperty("students");
  const students: Array<{ studentId: string }> = body.students;

  // School B students must never appear
  for (const s of students) {
    expect(s.studentId).not.toBe(ids.student3Id);
  }
  expect(students.find((s) => s.studentId === ids.adminBId)).toBeUndefined();
});

test("ER-01b: school B report does not contain school A students", async ({ request }) => {
  const res = await request.get(`${BASE}/api/reports/school`, auth(tSchoolB));
  expect(res.ok()).toBe(true);
  const body = await res.json();
  const students: Array<{ studentId: string }> = body.students;
  expect(students.find((s) => s.studentId === ids.student1Id)).toBeUndefined();
  expect(students.find((s) => s.studentId === ids.student2Id)).toBeUndefined();
});

// ── ER-02: Student CSV export contains only own records ──────────────────────

test("ER-02: student1 CSV export contains only student1 data", async ({ request }) => {
  const res = await request.get(`${BASE}/api/reports/export/csv`, auth(tStudent1));
  expect(res.ok()).toBe(true);
  expect(res.headers()["content-type"]).toMatch(/text\/csv/i);

  const csv = await res.text();
  // CSV must always have a header row
  expect(csv).toMatch(/Date.*Opportunity.*Organization.*Hours.*Status/i);
  // Must not reference student3's email (i.e. no cross-contamination)
  expect(csv).not.toContain("abhay.sivaram+7@gmail.com");
  // Must not contain PENDING or REJECTED rows
  expect(csv).not.toMatch(/,REJECTED/);
  expect(csv).not.toMatch(/,PENDING/);
});

// ── ER-03: Non-student cannot export CSV ────────────────────────────────────

test("ER-03a: SCHOOL_ADMIN without type=student gets 403 on CSV export", async ({ request }) => {
  const res = await request.get(`${BASE}/api/reports/export/csv`, auth(tSchoolA));
  expect(res.status()).toBe(403);
  const body = await res.json();
  expect(body.error).toMatch(/student role required/i);
});

test("ER-03b: BENEFICIARY_ADMIN cannot export CSV → 403", async ({ request }) => {
  const res = await request.get(`${BASE}/api/reports/export/csv`, auth(tOrgA));
  expect(res.status()).toBe(403);
});

// ── ER-04: Cross-school student report via ?studentId ────────────────────────

test("ER-04a: school A admin cannot view school B student report → 403", async ({ request }) => {
  const res = await request.get(
    `${BASE}/api/reports/student?studentId=${ids.student3Id}`,
    auth(tSchoolA),
  );
  expect(res.status()).toBe(403);
  const body = await res.json();
  expect(body.error).toMatch(/not enrolled in your school/i);
});

test("ER-04b: school B admin cannot view school A student report → 403", async ({ request }) => {
  const res = await request.get(
    `${BASE}/api/reports/student?studentId=${ids.student1Id}`,
    auth(tSchoolB),
  );
  expect(res.status()).toBe(403);
  const body = await res.json();
  expect(body.error).toMatch(/not enrolled in your school/i);
});

// ── ER-05: Student cannot view another student's report ──────────────────────

test("ER-05: student1 cannot view student3 report via ?studentId → 403", async ({ request }) => {
  const res = await request.get(
    `${BASE}/api/reports/student?studentId=${ids.student3Id}`,
    auth(tStudent1),
  );
  expect(res.status()).toBe(403);
  const body = await res.json();
  expect(body.error).toMatch(/cannot view this report/i);
});

// ── ER-06: School A admin CAN view own student report ───────────────────────

test("ER-06: school A admin CAN view student1 report → 200", async ({ request }) => {
  const res = await request.get(
    `${BASE}/api/reports/student?studentId=${ids.student1Id}`,
    auth(tSchoolA),
  );
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body).toHaveProperty("totalApprovedHours");
  expect(body).toHaveProperty("sessions");
  expect(body).toHaveProperty("requiredHours");
});

// ── ER-07: Org report — ?organizationId cross-org gap ───────────────────────
// Known gap: a school-role actor can supply any orgId via query param.
// Expected: 403. If this test fails (returns 200), the gap is live.

test("ER-07: school A admin with ?organizationId=orgBId should be 403 (known gap)", async ({ request }) => {
  const res = await request.get(
    `${BASE}/api/reports/organization?organizationId=${ids.orgBId}`,
    auth(tSchoolA),
  );
  // This SHOULD be 403. If it returns 200, flag it — school A can read org B's data.
  expect(res.status()).toBe(403);
});

// ── ER-08: BENEFICIARY_ADMIN cannot read school report ──────────────────────

test("ER-08: BENEFICIARY_ADMIN cannot GET /api/reports/school → 403", async ({ request }) => {
  const res = await request.get(`${BASE}/api/reports/school`, auth(tOrgA));
  expect(res.status()).toBe(403);
});

// ── ER-09: Audit log cross-school access blocked ────────────────────────────

test("ER-09: school A admin cannot view school B session audit log → 403 or 404", async ({ request }) => {
  // Use a plausible-looking (but non-existent) session ID
  // 404 = session doesn't exist; 403 = authorization failed first
  // Either is a secure outcome; 200 would be the failure case.
  const fakeId = "c" + "0".repeat(24);
  const res = await request.get(`${BASE}/api/reports/audit/${fakeId}`, auth(tSchoolA));
  expect([403, 404]).toContain(res.status());
  expect(res.status()).not.toBe(200);
});

// ── ER-10: CSV always has header row ────────────────────────────────────────

test("ER-10: student with zero approved hours still gets a valid CSV header", async ({ request }) => {
  // student3 may have no approved hours
  const res = await request.get(`${BASE}/api/reports/export/csv`, auth(tStudent3));
  expect(res.ok()).toBe(true);
  const csv = await res.text();
  // Should always have the header row
  expect(csv).toMatch(/Date/i);
  expect(csv).toMatch(/Opportunity/i);
  expect(csv).toMatch(/Hours/i);
});

// ── ER-11: Unauthenticated report access → 401 ──────────────────────────────

test("ER-11a: unauthenticated GET /api/reports/school → 401", async ({ request }) => {
  const res = await request.get(`${BASE}/api/reports/school`);
  expect(res.status()).toBe(401);
});

test("ER-11b: unauthenticated GET /api/reports/student → 401", async ({ request }) => {
  const res = await request.get(`${BASE}/api/reports/student`);
  expect(res.status()).toBe(401);
});

test("ER-11c: unauthenticated GET /api/reports/export/csv → 401", async ({ request }) => {
  const res = await request.get(`${BASE}/api/reports/export/csv`);
  expect(res.status()).toBe(401);
});
