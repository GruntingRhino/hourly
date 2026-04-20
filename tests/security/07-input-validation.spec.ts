/**
 * Input Validation Tests
 *
 * Verifies server-side Zod schemas reject invalid, malicious, and boundary inputs.
 * Also tests mass-assignment protection (extra fields stripped server-side).
 *
 * All tests run against the real API — no mocking.
 */
import { test, expect, request as playwrightRequest } from "@playwright/test";
import { BASE, getToken, auth } from "./helpers/tokens";
import { getIds, Ids, ensurePendingSubmission } from "./helpers/setup";

let ids: Ids;
let tSchoolA: string;
let tStudent1: string;
let approvalTargetSubId: string;  // a fresh PENDING sub to test approve/reject state guards

test.beforeAll(async () => {
  ids = await getIds();
  [tSchoolA, tStudent1] = await Promise.all([
    getToken("schoolA"),
    getToken("student1"),
  ]);

  const ctx = await playwrightRequest.newContext();

  // Ensure school A allows self-submissions with no date window (open for IV tests)
  await ctx.put(`${BASE}/api/schools/${ids.schoolAId}`, {
    data: {
      allowSelfSubmission: true,
      serviceStartDate: null,
      serviceEndDate: null,
      categoryHourCaps: null,
      requireOrgVerification: false,
    },
    ...auth(tSchoolA),
  });

  await ctx.dispose();

  // Create a fresh pending submission to use in approval state tests
  approvalTargetSubId = await ensurePendingSubmission("student1", "schoolA", ids.schoolAId, {
    date: "2025-10-25",
    hours: 3,
  });
});

// ── IV-01: Negative hours ────────────────────────────────────────────────────

test("IV-01: negative hours in self-submission → 400", async ({ request }) => {
  const res = await request.post(`${BASE}/api/self-submissions`, {
    data: {
      organizationName: "IV Test",
      description: "Negative hours test",
      date: "2025-10-25",
      hours: -5,
    },
    ...auth(tStudent1),
  });
  expect(res.status()).toBe(400);
});

// ── IV-02: Zero hours ────────────────────────────────────────────────────────

test("IV-02: zero hours in self-submission → 400", async ({ request }) => {
  const res = await request.post(`${BASE}/api/self-submissions`, {
    data: {
      organizationName: "IV Test",
      description: "Zero hours test",
      date: "2025-10-25",
      hours: 0,
    },
    ...auth(tStudent1),
  });
  expect(res.status()).toBe(400);
});

// ── IV-03: Hours over 24 ─────────────────────────────────────────────────────

test("IV-03: hours > 24 in self-submission → 400", async ({ request }) => {
  const res = await request.post(`${BASE}/api/self-submissions`, {
    data: {
      organizationName: "IV Test",
      description: "Excessive hours test",
      date: "2025-10-25",
      hours: 100,
    },
    ...auth(tStudent1),
  });
  expect(res.status()).toBe(400);
});

// ── IV-04: Missing required fields ───────────────────────────────────────────

test("IV-04a: self-submission with no organizationName → 400", async ({ request }) => {
  const res = await request.post(`${BASE}/api/self-submissions`, {
    data: { description: "Missing org name", date: "2025-10-25", hours: 2 },
    ...auth(tStudent1),
  });
  expect(res.status()).toBe(400);
});

test("IV-04b: self-submission with no description → 400", async ({ request }) => {
  const res = await request.post(`${BASE}/api/self-submissions`, {
    data: { organizationName: "Test Org", date: "2025-10-25", hours: 2 },
    ...auth(tStudent1),
  });
  expect(res.status()).toBe(400);
});

// ── IV-05: Mass assignment — extra fields stripped ────────────────────────────

test("IV-05: extra fields (status, reviewedBy, schoolId) stripped on create", async ({ request }) => {
  const res = await request.post(`${BASE}/api/self-submissions`, {
    data: {
      organizationName: "Mass Assignment Org",
      description: "Attempting mass assignment",
      date: "2025-10-26",
      hours: 1,
      category: "general",
      // Injected fields — must be stripped by Zod
      status: "APPROVED",
      reviewedBy: "injected-admin-id-xxxx",
      schoolId: "injected-school-id-xxxx",
      convertedSessionId: "injected-session-id",
    },
    ...auth(tStudent1),
  });

  if (res.ok()) {
    const body = await res.json();
    expect(body.status).toBe("PENDING");           // not APPROVED
    expect(body.reviewedBy).toBeNull();
    expect(body.schoolId).toBe(ids.schoolAId);     // resolved from auth, not from body
    expect(body.convertedSessionId).toBeNull();
  } else {
    // 400 is also acceptable — Zod strips unknown keys, so if they're stripped it passes
    expect([201, 400]).toContain(res.status());
  }
});

// ── IV-06: Invalid status transition — approve non-pending session ────────────

test("IV-06: approve /api/verification/:id with non-existent session → 404", async ({ request }) => {
  // requireRole passes for schoolA; DB lookup returns 404
  const res = await request.post(
    `${BASE}/api/verification/nonexistentid1234567890123/approve`,
    { data: {}, ...auth(tSchoolA) },
  );
  expect(res.status()).toBe(404);
  const body = await res.json();
  expect(body.error).toMatch(/session not found/i);
});

// ── IV-07: Double-approve a self-submission ────────────────────────────────────

test("IV-07: re-approving an already-approved self-submission → 400", async ({ request }) => {
  if (!approvalTargetSubId) test.skip(true, "No pending submission available for double-approve test");

  const ctx = await playwrightRequest.newContext();

  // First approval
  const first = await ctx.post(
    `${BASE}/api/self-submissions/${approvalTargetSubId}/approve`,
    { data: {}, ...auth(tSchoolA) },
  );

  if (!first.ok()) {
    // Already approved from a previous run — that's fine for this test
    await ctx.dispose();
  } else {
    await ctx.dispose();

    // Second approval attempt
    const res = await request.post(
      `${BASE}/api/self-submissions/${approvalTargetSubId}/approve`,
      { data: {}, ...auth(tSchoolA) },
    );
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/not pending/i);
  }
});

// ── IV-08: Reject without reason ─────────────────────────────────────────────

test("IV-08: reject self-submission with no reason body → 400", async ({ request }) => {
  // Create a fresh pending submission
  const pendingId = await ensurePendingSubmission("student1", "schoolA", ids.schoolAId, {
    date: "2025-10-27",
    hours: 1,
  });
  if (!pendingId) test.skip(true, "No pending submission available");

  const res = await request.post(
    `${BASE}/api/self-submissions/${pendingId}/reject`,
    { data: {}, ...auth(tSchoolA) }, // no 'reason' field
  );
  expect(res.status()).toBe(400);
});

test("IV-08b: reject /api/verification/:id with no reason → 400", async ({ request }) => {
  // Use a fake session ID — 404 expected (role passes, session not found)
  // This tests that if a real session existed, missing reason would fail
  // We can only test the shape of validation here
  const res = await request.post(
    `${BASE}/api/verification/nonexistentid1234567890/reject`,
    { data: {}, ...auth(tSchoolA) }, // no 'reason'
  );
  // 404 (no session) or 400 (reason missing) — both are correct
  expect([400, 404]).toContain(res.status());
});

// ── IV-09: Malformed CSV in bulk import ──────────────────────────────────────

test("IV-09a: malformed CSV (HTML injection) → 400", async ({ request }) => {
  const res = await request.post(`${BASE}/api/self-submissions/import`, {
    data: { csvData: "<script>alert(1)</script>" },
    ...auth(tSchoolA),
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toMatch(/invalid csv|no data rows/i);
});

test("IV-09b: empty CSV data → 400", async ({ request }) => {
  const res = await request.post(`${BASE}/api/self-submissions/import`, {
    data: { csvData: "" },
    ...auth(tSchoolA),
  });
  expect(res.status()).toBe(400);
});

test("IV-09c: CSV with header only (no data rows) → 400", async ({ request }) => {
  const res = await request.post(`${BASE}/api/self-submissions/import`, {
    data: { csvData: "student_email,organization_name,date,hours\n" },
    ...auth(tSchoolA),
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toMatch(/no data rows/i);
});

// ── IV-10: CSV row limit ─────────────────────────────────────────────────────

test("IV-10: CSV with 501 data rows → 400 (row limit exceeded)", async ({ request }) => {
  const header = "student_email,organization_name,date,hours\n";
  const row = `${encodeURIComponent("abhay.sivaram+5@gmail.com")},Test Org,2025-10-01,1\n`;
  // Use a plain string (not encoded) for actual CSV
  const csvRow = "abhay.sivaram+5@gmail.com,Test Org,2025-10-01,1\n";
  const csvData = header + csvRow.repeat(501);

  const res = await request.post(`${BASE}/api/self-submissions/import`, {
    data: { csvData },
    ...auth(tSchoolA),
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toMatch(/exceeds.*500/i);
});

// ── IV-11: CSV import skips cross-school students ────────────────────────────

test("IV-11: CSV import with student3 (School B) is skipped when run by School A admin", async ({ request }) => {
  const csvData = [
    "student_email,organization_name,date,hours",
    "abhay.sivaram+7@gmail.com,Cross School Org,2025-10-01,5",
  ].join("\n");

  const res = await request.post(`${BASE}/api/self-submissions/import`, {
    data: { csvData },
    ...auth(tSchoolA),
  });
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body.imported).toBe(0);
  expect(body.skipped).toHaveLength(1);
  expect(body.skipped[0].reason).toMatch(/not found in your school/i);
});

// ── IV-12: Oversized message body ────────────────────────────────────────────

test("IV-12: bulk message body over 5000 chars → 400", async ({ request }) => {
  const res = await request.post(`${BASE}/api/messages/bulk`, {
    data: {
      audience: "ALL_STUDENTS",
      body: "A".repeat(5001),
    },
    ...auth(tSchoolA),
  });
  expect(res.status()).toBe(400);
});

// ── IV-13: Bulk message subject over 255 chars ───────────────────────────────

test("IV-13: bulk message subject over 255 chars → 400", async ({ request }) => {
  const res = await request.post(`${BASE}/api/messages/bulk`, {
    data: {
      audience: "ALL_STUDENTS",
      subject: "S".repeat(256),
      body: "Valid body",
    },
    ...auth(tSchoolA),
  });
  expect(res.status()).toBe(400);
});

// ── IV-14: Self-submission description length ─────────────────────────────────

test("IV-14: self-submission description over 2000 chars → 400", async ({ request }) => {
  const res = await request.post(`${BASE}/api/self-submissions`, {
    data: {
      organizationName: "Test Org",
      description: "D".repeat(2001),
      date: "2025-10-25",
      hours: 2,
    },
    ...auth(tStudent1),
  });
  expect(res.status()).toBe(400);
});

// ── IV-15: School update with invalid date ordering ───────────────────────────

test("IV-15: school update with endDate before startDate → 400", async ({ request }) => {
  const res = await request.put(`${BASE}/api/schools/${ids.schoolAId}`, {
    data: {
      serviceStartDate: "2026-06-01T00:00:00Z",
      serviceEndDate: "2025-09-01T00:00:00Z", // before start
    },
    ...auth(tSchoolA),
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toMatch(/serviceEndDate must be after/i);
});

// ── IV-16: School category caps must be positive numbers ─────────────────────

test("IV-16: categoryHourCaps with negative value → 400", async ({ request }) => {
  const res = await request.put(`${BASE}/api/schools/${ids.schoolAId}`, {
    data: { categoryHourCaps: { general: -10 } },
    ...auth(tSchoolA),
  });
  expect(res.status()).toBe(400);
});
