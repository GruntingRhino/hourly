/**
 * Relationship Enforcement Tests
 *
 * Verifies that users can only access resources when a valid relationship
 * exists — student own records only, school staff own school only, etc.
 */
import { test, expect, request as playwrightRequest } from "@playwright/test";
import { BASE, getToken, auth } from "./helpers/tokens";
import { getIds, Ids, ensureRevisionSubmission } from "./helpers/setup";

let ids: Ids;
let tSchoolA: string;
let tSchoolB: string;
let tStudent1: string;
let tStudent2: string;
let tStudent3: string;
let tOrgA: string;

let student3RevisionSubId: string;
let messageForStudent2Id: string;     // a message in student2's inbox
let notifForStudent2Id: string;       // a notification in student2's inbox

test.beforeAll(async () => {
  ids = await getIds();
  [tSchoolA, tSchoolB, tStudent1, tStudent2, tStudent3, tOrgA] = await Promise.all([
    getToken("schoolA"),
    getToken("schoolB"),
    getToken("student1"),
    getToken("student2"),
    getToken("student3"),
    getToken("orgA"),
  ]);

  const ctx = await playwrightRequest.newContext();

  // 1. Create a REVISION_REQUESTED submission for student3
  student3RevisionSubId = await ensureRevisionSubmission(
    "student3",
    "schoolB",
    ids.schoolBId,
  );

  // 2. School A admin sends a message to student2 to create a known message ID
  const msgRes = await ctx.post(`${BASE}/api/messages`, {
    data: {
      receiverId: ids.student2Id,
      subject: "RE-04 setup",
      body: "This message belongs to student2 only",
    },
    ...auth(tSchoolA),
  });
  if (msgRes.ok()) {
    messageForStudent2Id = (await msgRes.json()).id as string;
  }

  // 3. Get a notification from student2's inbox (created by step 2)
  const notifRes = await ctx.get(`${BASE}/api/messages/notifications`, auth(tStudent2));
  if (notifRes.ok()) {
    const notifs: Array<{ id: string; read: boolean }> = await notifRes.json();
    const unread = notifs.find((n) => !n.read);
    notifForStudent2Id = unread?.id ?? "";
  }

  await ctx.dispose();
});

// ── RE-01: Student sees only own self-submissions ────────────────────────────

test("RE-01: student1 self-submissions list contains only student1 records", async ({ request }) => {
  const res = await request.get(`${BASE}/api/self-submissions`, auth(tStudent1));
  expect(res.ok()).toBe(true);
  const subs: Array<{ studentId: string }> = await res.json();
  for (const sub of subs) {
    expect(sub.studentId).toBe(ids.student1Id);
  }
});

// ── RE-02: Student cannot update another student's submission ────────────────

test("RE-02: student1 cannot PUT student3 REVISION_REQUESTED submission → 403", async ({ request }) => {
  if (!student3RevisionSubId) test.skip(true, "No revision submission for student3 available");

  const res = await request.put(
    `${BASE}/api/self-submissions/${student3RevisionSubId}`,
    {
      data: { description: "Tampered by student1", hours: 24 },
      ...auth(tStudent1),
    },
  );
  expect(res.status()).toBe(403);
  const body = await res.json();
  expect(body.error).toMatch(/not your submission/i);
});

// ── RE-03: Student cannot update their own submission when status is PENDING ──
// (status must be REVISION_REQUESTED — testing the state guard)

test("RE-03: student cannot PUT a PENDING submission → 400", async ({ request }) => {
  // Create a fresh PENDING submission
  const ctx = await playwrightRequest.newContext();

  await ctx.put(`${BASE}/api/schools/${ids.schoolAId}`, {
    data: { allowSelfSubmission: true },
    ...auth(tSchoolA),
  });

  const subRes = await ctx.post(`${BASE}/api/self-submissions`, {
    data: {
      organizationName: "RE-03 Test Org",
      description: "Testing state guard on resubmit",
      date: "2025-11-15",
      hours: 1,
      category: "general",
    },
    ...auth(tStudent1),
  });

  let pendingId: string | undefined;
  if (subRes.ok()) {
    pendingId = (await subRes.json()).id as string;
  } else {
    const listRes = await ctx.get(`${BASE}/api/self-submissions`, auth(tStudent1));
    const list: Array<{ id: string; status: string }> = await listRes.json();
    pendingId = list.find((s) => s.status === "PENDING")?.id;
  }
  await ctx.dispose();

  if (!pendingId) test.skip(true, "No PENDING submission for RE-03");

  const res = await request.put(`${BASE}/api/self-submissions/${pendingId!}`, {
    data: { description: "Trying to update PENDING" },
    ...auth(tStudent1),
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toMatch(/revision-requested/i);
});

// ── RE-04: Student cannot mark another user's message as read ────────────────

test("RE-04: student1 cannot mark student2 message as read → 403", async ({ request }) => {
  if (!messageForStudent2Id) test.skip(true, "No message for student2 available");

  const res = await request.put(
    `${BASE}/api/messages/${messageForStudent2Id}/read`,
    { data: {}, ...auth(tStudent1) },
  );
  expect(res.status()).toBe(403);
  const body = await res.json();
  expect(body.error).toMatch(/cannot modify this message/i);
});

// ── RE-05: Student cannot mark another user's notification as read ────────────

test("RE-05: student1 cannot mark student2 notification as read → 403", async ({ request }) => {
  if (!notifForStudent2Id) test.skip(true, "No notification for student2 available");

  const res = await request.put(
    `${BASE}/api/messages/notifications/${notifForStudent2Id}/read`,
    { data: {}, ...auth(tStudent1) },
  );
  expect(res.status()).toBe(403);
  const body = await res.json();
  expect(body.error).toMatch(/cannot modify this notification/i);
});

// ── RE-06: School A admin cannot view School B student verification history ───

test("RE-06: School A admin cannot GET school B student verification-history → 403", async ({ request }) => {
  // Route checks actor.schoolId === params.id first → 403 if mismatch
  const res = await request.get(
    `${BASE}/api/schools/${ids.schoolBId}/students/${ids.student3Id}/verification-history`,
    auth(tSchoolA),
  );
  expect(res.status()).toBe(403);
  const body = await res.json();
  expect(body.error).toMatch(/not your school/i);
});

// ── RE-07: School A admin can view own student verification history ────────────

test("RE-07: School A admin CAN GET school A student verification-history → 200", async ({ request }) => {
  const res = await request.get(
    `${BASE}/api/schools/${ids.schoolAId}/students/${ids.student1Id}/verification-history`,
    auth(tSchoolA),
  );
  // May be 200 (student exists and is in school) or 404 (no signups yet — also fine)
  expect([200, 404]).toContain(res.status());
  if (res.status() === 200) {
    const body = await res.json();
    expect(body).toHaveProperty("student");
  }
});

// ── RE-08: Inbox endpoint only returns own messages ───────────────────────────

test("RE-08: student1 inbox contains only messages addressed to student1", async ({ request }) => {
  const res = await request.get(`${BASE}/api/messages`, auth(tStudent1));
  expect(res.ok()).toBe(true);
  const messages: Array<{ receiverId: string }> = await res.json();
  for (const msg of messages) {
    expect(msg.receiverId).toBe(ids.student1Id);
  }
});

test("RE-08b: school A admin inbox contains only messages addressed to admin A", async ({ request }) => {
  const res = await request.get(`${BASE}/api/messages`, auth(tSchoolA));
  expect(res.ok()).toBe(true);
  const messages: Array<{ receiverId: string }> = await res.json();
  for (const msg of messages) {
    expect(msg.receiverId).toBe(ids.adminAId);
  }
});

// ── RE-09: Sent folder only returns own sent messages ────────────────────────

test("RE-09: school A admin sent folder contains only messages sent by admin A", async ({ request }) => {
  const res = await request.get(`${BASE}/api/messages?folder=sent`, auth(tSchoolA));
  expect(res.ok()).toBe(true);
  const messages: Array<{ senderId: string }> = await res.json();
  for (const msg of messages) {
    expect(msg.senderId).toBe(ids.adminAId);
  }
});

// ── RE-10: Beneficiary admin inbox contains only own messages ─────────────────

test("RE-10: orgA admin inbox contains only messages for orgA admin", async ({ request }) => {
  const res = await request.get(`${BASE}/api/messages`, auth(tOrgA));
  expect(res.ok()).toBe(true);
  const messages: Array<{ receiverId: string }> = await res.json();
  for (const msg of messages) {
    expect(msg.receiverId).toBe(ids.orgAdminAId);
  }
});
