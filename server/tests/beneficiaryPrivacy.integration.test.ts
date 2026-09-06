import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import prisma from "../src/lib/prisma";
import beneficiaryRoutes from "../src/routes/beneficiaries";

const prismaClient = prisma as any;

const student = { id: "student-1", email: "student@example.test", role: "STUDENT", status: "ACTIVE", tokenVersion: 0, emailVerified: true, eligibilityAttestation: { eligible13Plus: true }, school: null };
const schoolAdmin = { id: "admin-1", email: "admin@example.test", role: "SCHOOL_ADMIN", status: "ACTIVE", tokenVersion: 0, schoolId: "school-a", emailVerified: true, eligibilityAttestation: { eligible13Plus: true }, school: { verified: true, ownershipStatus: "APPROVED" } };
const teacher = { id: "teacher-1", email: "teacher@example.test", role: "TEACHER", status: "ACTIVE", tokenVersion: 0, schoolId: "school-a", emailVerified: true, eligibilityAttestation: { eligible13Plus: true }, school: { verified: true, ownershipStatus: "APPROVED" } };
const unrelatedStudent = { id: "student-2", email: "other@example.test", role: "STUDENT", status: "ACTIVE", tokenVersion: 0, emailVerified: true, eligibilityAttestation: { eligible13Plus: true }, school: null };

const privateBeneficiary = {
  id: "beneficiary-approved",
  name: "Approved Organization",
  email: "contact@approved.example",
  phone: "+1-555-0100",
  address: "123 Private Street",
  city: "Springfield",
  state: "IL",
  zip: "62701",
  description: "Approved organization",
  website: "https://approved.example",
  category: "Community",
  visibility: "PRIVATE",
  claimed: true,
  createdBySchoolId: "school-a",
  stripeCustomerId: "cus_secret",
  stripeSubscriptionId: "sub_secret",
  stripePriceId: "price_secret",
  subscriptionStatus: "active",
  planTier: "PRO",
  uploadAbuseStrikes: 4,
  uploadSuspendedUntil: new Date("2030-01-01"),
};

function pick(source: Record<string, unknown>, select: Record<string, boolean>) {
  return Object.fromEntries(Object.entries(select).filter(([, enabled]) => enabled).map(([key]) => [key, source[key]]));
}

async function requestAs(app: express.Express, user: typeof student | typeof schoolAdmin | typeof teacher | typeof unrelatedStudent) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role, tv: 0 }, process.env.JWT_SECRET!);
    return await fetch(`http://127.0.0.1:${address.port}/?status=ALL`, {
      headers: { authorization: `Bearer ${token}` },
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("beneficiary list enforces student privacy through the authenticated HTTP API", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    approvalFindMany: prismaClient.schoolBeneficiaryApproval.findMany,
    invitationFindMany: prismaClient.beneficiaryInvitation.findMany,
  };
  const users = new Map([[student.id, student], [schoolAdmin.id, schoolAdmin], [teacher.id, teacher], [unrelatedStudent.id, unrelatedStudent]]);
  const observedApprovalWheres: Array<Record<string, unknown>> = [];

  prismaClient.user.findUnique = async ({ where, select }: any) => {
    const user = users.get(where.id);
    if (!user) return null;
    if (select?.cohort) return user.id === unrelatedStudent.id
      ? { schoolId: "school-b", cohort: null, classroom: null, cohortMemberships: [] }
      : { schoolId: "school-a", cohort: null, classroom: null, cohortMemberships: [] };
    return user;
  };
  prismaClient.schoolBeneficiaryApproval.findMany = async ({ where, select }: any) => {
    observedApprovalWheres.push(where);
    if (where.schoolId !== "school-a") return [];
    return [{
      id: "approval-1",
      beneficiaryId: privateBeneficiary.id,
      status: "APPROVED",
      beneficiary: pick(privateBeneficiary, select.beneficiary.select),
    }];
  };
  prismaClient.beneficiaryInvitation.findMany = async ({ select }: any) => [pick({
    beneficiaryId: privateBeneficiary.id,
    status: "PENDING",
    createdAt: new Date("2026-01-01"),
    sentTo: "hidden@example.test",
  }, select)];

  try {
    const app = express();
    app.use(beneficiaryRoutes);

    const studentResponse = await requestAs(app, student);
    assert.equal(studentResponse.status, 200);
    assert.deepEqual(observedApprovalWheres[0], { schoolId: "school-a", status: "APPROVED" });
    const studentJson = await studentResponse.json() as Array<Record<string, unknown>>;
    assert.equal(studentJson.length, 1);
    for (const field of [
      "approvalId", "latestInvitationStatus", "latestInvitationSentTo", "latestInvitationCreatedAt",
      "email", "phone", "address", "stripeCustomerId", "stripeSubscriptionId", "stripePriceId",
      "subscriptionStatus", "planTier", "uploadAbuseStrikes", "uploadSuspendedUntil",
    ]) assert.equal(field in studentJson[0], false, `student response exposed ${field}`);

    const teacherResponse = await requestAs(app, teacher);
    assert.equal(teacherResponse.status, 200);
    assert.deepEqual(observedApprovalWheres[1], { schoolId: "school-a", status: "APPROVED" });
    const teacherJson = await teacherResponse.json() as Array<Record<string, unknown>>;
    assert.equal(teacherJson.length, 1);
    for (const field of ["email", "phone", "address", "approvalId", "latestInvitationStatus", "latestInvitationSentTo", "latestInvitationCreatedAt"]) {
      assert.equal(field in teacherJson[0], false, `teacher response exposed ${field}`);
    }

    const adminResponse = await requestAs(app, schoolAdmin);
    assert.equal(adminResponse.status, 200);
    const adminJson = await adminResponse.json() as Array<Record<string, unknown>>;
    assert.equal(adminJson.length, 1);
    assert.equal(adminJson[0].approvalId, "approval-1");
    assert.equal(adminJson[0].latestInvitationStatus, "PENDING");
    assert.ok("latestInvitationCreatedAt" in adminJson[0]);
    assert.equal("latestInvitationSentTo" in adminJson[0], false);

    const unrelatedResponse = await requestAs(app, unrelatedStudent);
    assert.equal(unrelatedResponse.status, 200);
    assert.deepEqual(await unrelatedResponse.json(), []);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.schoolBeneficiaryApproval.findMany = original.approvalFindMany;
    prismaClient.beneficiaryInvitation.findMany = original.invitationFindMany;
  }
});
