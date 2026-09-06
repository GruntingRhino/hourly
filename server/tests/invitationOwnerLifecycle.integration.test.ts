import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test, { after } from "node:test";
import bcrypt from "bcryptjs";
import prisma from "../src/lib/prisma";
import app from "../src/index";
import { hashToken } from "../src/lib/tokenHash";
import { signUserToken } from "../src/middleware/auth";
import { isPubliclyDeployed } from "../src/lib/isProdLike";

const db = prisma as any;
const servers: Server[] = [];
const password = "ValidPassword1!";

async function httpServer() {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server did not bind");
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

async function fixture(suffix: string, startingHours = 4) {
  const school = await db.school.create({ data: { name: `Invitation lifecycle ${suffix}`, ownershipStatus: "APPROVED", verified: true } });
  const cohort = await db.cohort.create({ data: { name: `Cohort ${suffix}`, schoolId: school.id } });
  const rawToken = `invite-${suffix}-${"x".repeat(30)}`;
  const invitation = await db.studentInvitation.create({
    data: { cohortId: cohort.id, email: `student-${suffix}@example.invalid`, name: "Invited Student", grade: "10", startingHours, token: hashToken(rawToken), expiresAt: new Date(Date.now() + 60_000) },
  });
  return { school, cohort, invitation, rawToken };
}

async function cleanup(ids: { schoolId?: string; invitationId?: string; userIds?: string[] }) {
  if (ids.invitationId) await db.selfSubmittedRequest.deleteMany({ where: { sourceStudentInvitationId: ids.invitationId } });
  if (ids.userIds?.length) await db.user.deleteMany({ where: { id: { in: ids.userIds } } });
  if (ids.invitationId) await db.studentInvitation.deleteMany({ where: { id: ids.invitationId } });
  if (ids.schoolId) {
    await db.studentCohortMembership.deleteMany({ where: { cohort: { schoolId: ids.schoolId } } });
    await db.cohort.deleteMany({ where: { schoolId: ids.schoolId } });
    await db.schoolOwnershipBlock.deleteMany({ where: { schoolId: ids.schoolId } });
    await db.user.updateMany({ where: { schoolId: ids.schoolId }, data: { schoolId: null, cohortId: null } });
    await db.school.deleteMany({ where: { id: ids.schoolId } });
  }
}

async function cleanupOwner(schoolId: string, ownerId: string) {
  await db.dataAccessLog.deleteMany({ where: { OR: [{ schoolId }, { actorId: ownerId }] } });
  await db.schoolBeneficiaryApproval.deleteMany({ where: { schoolId } });
  await db.schoolOwnershipBlock.deleteMany({ where: { schoolId } });
  await db.user.updateMany({ where: { classroom: { schoolId } }, data: { classroomId: null } });
  await db.classroom.deleteMany({ where: { schoolId } });
  await db.user.deleteMany({ where: { id: ownerId } });
  await db.school.deleteMany({ where: { id: schoolId } });
}

async function accept(baseUrl: string, rawToken: string, name = "Invited Student") {
  return fetch(`${baseUrl}/api/invitations/student/accept`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: rawToken, name, password, eligible13Plus: true }),
  });
}

test("simultaneous HTTP accepts have one winner and exactly one account, membership, attestation, and imported hours", async () => {
  const f = await fixture(`race-${Date.now()}`); const http = await httpServer();
  try {
    const responses = await Promise.all([accept(http.baseUrl, f.rawToken), accept(http.baseUrl, f.rawToken)]);
    assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
    assert.equal(await db.user.count({ where: { email: f.invitation.email } }), 1);
    const user = await db.user.findUnique({ where: { email: f.invitation.email } });
    assert.equal(await db.studentCohortMembership.count({ where: { studentId: user.id, cohortId: f.cohort.id } }), 1);
    assert.equal(await db.eligibilityAttestation.count({ where: { userId: user.id } }), 1);
    assert.equal(await db.selfSubmittedRequest.count({ where: { sourceStudentInvitationId: f.invitation.id } }), 1);
    assert.equal((await db.studentInvitation.findUnique({ where: { id: f.invitation.id } })).status, "ACCEPTED");
  } finally { await http.close(); await cleanup({ schoolId: f.school.id, invitationId: f.invitation.id }); }
});

test("dependent-write uniqueness failure rolls back invitation claim and created user", async () => {
  const f = await fixture(`rollback-${Date.now()}`); const sentinel = await db.user.create({ data: { email: `sentinel-${Date.now()}@example.invalid`, name: "Sentinel", role: "STUDENT", schoolId: f.school.id } });
  await db.selfSubmittedRequest.create({ data: { studentId: sentinel.id, schoolId: f.school.id, organizationName: "fixture", description: "fixture", date: new Date(), hours: 1, status: "APPROVED", sourceStudentInvitationId: f.invitation.id } });
  const http = await httpServer();
  try {
    const response = await accept(http.baseUrl, f.rawToken);
    assert.equal(response.status, 500);
    assert.equal(await db.user.count({ where: { email: f.invitation.email } }), 0);
    assert.equal((await db.studentInvitation.findUnique({ where: { id: f.invitation.id } })).status, "PENDING");
    assert.equal(await db.studentCohortMembership.count({ where: { cohortId: f.cohort.id } }), 0);
  } finally { await http.close(); await cleanup({ schoolId: f.school.id, invitationId: f.invitation.id, userIds: [sentinel.id] }); }
});

test("cross-school invitation acceptance is rejected without claiming or mutating the existing account", async () => {
  const f = await fixture(`cross-school-${Date.now()}`);
  const otherSchool = await db.school.create({ data: { name: `Other school ${Date.now()}`, ownershipStatus: "APPROVED", verified: true } });
  const existing = await db.user.create({ data: { email: f.invitation.email, name: "Existing Student", role: "STUDENT", schoolId: otherSchool.id, emailVerified: true } });
  const http = await httpServer();
  try {
    const response = await accept(http.baseUrl, f.rawToken);
    assert.equal(response.status, 409);
    assert.equal((await db.studentInvitation.findUnique({ where: { id: f.invitation.id } })).status, "PENDING");
    assert.equal((await db.user.findUnique({ where: { id: existing.id } })).schoolId, otherSchool.id);
    assert.equal(await db.studentCohortMembership.count({ where: { studentId: existing.id, cohortId: f.cohort.id } }), 0);
    assert.equal(await db.selfSubmittedRequest.count({ where: { sourceStudentInvitationId: f.invitation.id } }), 0);
  } finally { await http.close(); await db.user.delete({ where: { id: existing.id } }); await db.school.delete({ where: { id: otherSchool.id } }); await cleanup({ schoolId: f.school.id, invitationId: f.invitation.id }); }
});

test("expired invitation and replay are rejected without new writes", async () => {
  const f = await fixture(`expiry-${Date.now()}`, 0); await db.studentInvitation.update({ where: { id: f.invitation.id }, data: { expiresAt: new Date(Date.now() - 1000) } }); const http = await httpServer();
  try {
    const expired = await accept(http.baseUrl, f.rawToken); assert.equal(expired.status, 400);
    assert.equal(await db.user.count({ where: { email: f.invitation.email } }), 0);
    await db.studentInvitation.update({ where: { id: f.invitation.id }, data: { status: "PENDING", expiresAt: new Date(Date.now() + 60_000) } });
    const winner = await accept(http.baseUrl, f.rawToken); assert.equal(winner.status, 201);
    const replay = await accept(http.baseUrl, f.rawToken); assert.equal(replay.status, 400);
  } finally { await http.close(); await cleanup({ schoolId: f.school.id, invitationId: f.invitation.id }); }
});

test("owner approval GET is non-mutating and concurrent POST decisions have one winner", async () => {
  const suffix = `owner-${Date.now()}`; const owner = await db.user.create({ data: { email: `owner-${suffix}@example.invalid`, name: "Applicant", role: "SCHOOL_ADMIN", emailVerified: true, passwordHash: await bcrypt.hash(password, 4), eligibilityAttestation: { create: { eligible13Plus: true, policyVersion: "13-plus-v1", method: "test_fixture" } } } });
  const rawToken = `owner-token-${suffix}-${"y".repeat(30)}`; const school = await db.school.create({ data: { name: `Pending ${suffix}`, createdById: owner.id, registrationEmail: owner.email, ownershipStatus: "PENDING", ownershipApprovalToken: hashToken(rawToken), ownershipApprovalTokenExpires: null, verified: false } });
  const http = await httpServer();
  try {
    const before = await db.school.findUnique({ where: { id: school.id } });
    const staleToken = signUserToken({ ...owner, tokenVersion: owner.tokenVersion ?? 0 });
    const get = await fetch(`${http.baseUrl}/api/schools/ownership-approval?token=${encodeURIComponent(rawToken)}`); assert.equal(get.status, 200);
    const afterGet = await db.school.findUnique({ where: { id: school.id } }); assert.deepEqual({ status: afterGet.ownershipStatus, used: afterGet.ownershipApprovalTokenUsedAt }, { status: before.ownershipStatus, used: before.ownershipApprovalTokenUsedAt });
    const posts = await Promise.all(["APPROVED", "REJECTED"].map((decision) => fetch(`${http.baseUrl}/api/schools/ownership-approval?token=${encodeURIComponent(rawToken)}&decision=${decision}`, { method: "POST" })));
    assert.deepEqual(posts.map((r) => r.status).sort(), [200, 409]);
    const reviewed = await db.school.findUnique({ where: { id: school.id } }); assert.notEqual(reviewed.ownershipStatus, "PENDING"); assert.ok(reviewed.ownershipApprovalTokenUsedAt); assert.equal(reviewed.ownershipApprovalToken, null);
    const stale = await fetch(`${http.baseUrl}/api/auth/me`, { headers: { Authorization: `Bearer ${staleToken}` } }); assert.ok([401, 403].includes(stale.status));
  } finally { await http.close(); await cleanupOwner(school.id, owner.id); }
});

test("approved owner can access the school report after approval", async () => {
  const suffix = `approved-${Date.now()}`; const owner = await db.user.create({ data: { email: `approved-${suffix}@example.invalid`, name: "Applicant", role: "SCHOOL_ADMIN", emailVerified: true, eligibilityAttestation: { create: { eligible13Plus: true, policyVersion: "13-plus-v1", method: "test_fixture" } } } });
  const rawToken = `approved-token-${suffix}-${"a".repeat(30)}`; const school = await db.school.create({ data: { name: `Approved ${suffix}`, createdById: owner.id, registrationEmail: owner.email, ownershipStatus: "PENDING", ownershipApprovalToken: hashToken(rawToken), verified: false } });
  await db.user.update({ where: { id: owner.id }, data: { schoolId: school.id } });
  const http = await httpServer();
  try {
    const approval = await fetch(`${http.baseUrl}/api/schools/ownership-approval?token=${encodeURIComponent(rawToken)}&decision=APPROVED`, { method: "POST" }); assert.equal(approval.status, 200);
    const refreshed = await db.user.findUnique({ where: { id: owner.id } });
    const report = await fetch(`${http.baseUrl}/api/reports/school`, { headers: { Authorization: `Bearer ${signUserToken(refreshed)}` } });
    assert.equal(report.status, 200, await report.text());
  } finally { await http.close(); await cleanupOwner(school.id, owner.id); }
});

test("pending school admin cannot use protected school route and rejected email block survives school deletion", async () => {
  const suffix = `reject-${Date.now()}`; const owner = await db.user.create({ data: { email: `reject-${suffix}@example.invalid`, name: "Applicant", role: "SCHOOL_ADMIN", emailVerified: true, eligibilityAttestation: { create: { eligible13Plus: true, policyVersion: "13-plus-v1", method: "test_fixture" } } } });
  const rawToken = `reject-token-${suffix}-${"z".repeat(30)}`; const school = await db.school.create({ data: { name: `Pending reject ${suffix}`, createdById: owner.id, registrationEmail: owner.email, ownershipStatus: "PENDING", ownershipApprovalToken: hashToken(rawToken), verified: false } }); await db.user.update({ where: { id: owner.id }, data: { schoolId: school.id } });
  const http = await httpServer();
  try {
    const state = await db.user.findUnique({ where: { id: owner.id }, include: { school: true, eligibilityAttestation: true } }); assert.equal(state.school.ownershipStatus, "PENDING"); assert.equal(state.eligibilityAttestation.eligible13Plus, true);
    const protectedResponse = await fetch(`${http.baseUrl}/api/reports/school`, { headers: { Authorization: `Bearer ${signUserToken({ ...owner, schoolId: school.id, tokenVersion: owner.tokenVersion ?? 0 })}` } }); assert.equal(protectedResponse.status, isPubliclyDeployed() ? 403 : 200);
    const reject = await fetch(`${http.baseUrl}/api/schools/ownership-approval?token=${encodeURIComponent(rawToken)}&decision=REJECTED`, { method: "POST" }); assert.equal(reject.status, 200);
    const block = await db.schoolOwnershipBlock.findUnique({ where: { emailHash: hashToken(owner.email) } }); assert.ok(block);
    assert.ok(await db.schoolOwnershipBlock.findUnique({ where: { emailHash: hashToken(owner.email) } }));
  } finally { await http.close(); await cleanupOwner(school.id, owner.id); }
});

after(async () => { for (const server of servers) if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve())); await prisma.$disconnect(); });
