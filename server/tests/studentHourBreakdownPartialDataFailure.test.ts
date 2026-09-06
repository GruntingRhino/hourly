import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import prisma from "../src/lib/prisma";
import schoolRoutes from "../src/routes/schools";

// Regression test for §12 (reports must return PARTIAL/UNAVAILABLE rather
// than misleading zeros/failures on partial data-source failure): GET
// /api/schools/:id/students/:studentId/hour-breakdown fetched
// beneficiarySignup/selfSubmittedRequest/serviceSession records (plus the
// already-resilient calculateStudentHours totals) via Promise.all — a
// transient failure in any one of the three raw record queries 500'd the
// whole page even though the others, and the already-computed totals,
// were fine.

const prismaClient = prisma as any;

const schoolAdmin = {
  id: "hbd-admin-1",
  email: "admin@example.test",
  role: "SCHOOL_ADMIN",
  status: "ACTIVE",
  tokenVersion: 0,
  schoolId: "hbd-school-1",
  emailVerified: true, eligibilityAttestation: { eligible13Plus: true },
  school: { verified: true, ownershipStatus: "APPROVED" },
  assignedCohorts: [],
};

const student = {
  id: "hbd-student-1",
  role: "STUDENT",
  schoolId: "hbd-school-1",
  cohortId: null,
  cohort: null,
  cohortMemberships: [],
  name: "Test Student",
  email: "student@example.test",
  grade: "10",
  classroom: null,
};

async function requestAsAdmin(app: express.Express) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const token = jwt.sign({ userId: schoolAdmin.id, email: schoolAdmin.email, role: schoolAdmin.role, tv: 0 }, process.env.JWT_SECRET!);
    return await fetch(`http://127.0.0.1:${(address as any).port}/${schoolAdmin.schoolId}/students/${student.id}/hour-breakdown`, {
      headers: { authorization: `Bearer ${token}` },
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

function baseMocks() {
  prismaClient.user.findUnique = async ({ where }: any) => {
    if (where.id === schoolAdmin.id) return schoolAdmin;
    if (where.id === student.id) return student;
    return null;
  };
  prismaClient.user.findMany = async () => [];
  prismaClient.dataAccessLog.create = async () => ({});
}

test("GET /:id/students/:studentId/hour-breakdown still returns other sources when one record query fails", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    userFindMany: prismaClient.user.findMany,
    dataAccessLogCreate: prismaClient.dataAccessLog.create,
    benSignupFindMany: prismaClient.beneficiarySignup.findMany,
    selfSubFindMany: prismaClient.selfSubmittedRequest.findMany,
    sessionFindMany: prismaClient.serviceSession.findMany,
  };
  baseMocks();
  prismaClient.beneficiarySignup.findMany = async () => { throw new Error("transient DB error"); };
  prismaClient.selfSubmittedRequest.findMany = async () => [];
  prismaClient.serviceSession.findMany = async () => [];
  try {
    const app = express();
    app.use("/", schoolRoutes);
    const res = await requestAsAdmin(app);
    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.equal(body.totals.reconciliation.dataState, "PARTIAL");
    assert.ok(body.totals.reconciliation.failedSources.includes("beneficiary signups"));
    assert.deepEqual(body.records.beneficiary, []);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.user.findMany = original.userFindMany;
    prismaClient.dataAccessLog.create = original.dataAccessLogCreate;
    prismaClient.beneficiarySignup.findMany = original.benSignupFindMany;
    prismaClient.selfSubmittedRequest.findMany = original.selfSubFindMany;
    prismaClient.serviceSession.findMany = original.sessionFindMany;
  }
});

test("GET /:id/students/:studentId/hour-breakdown returns COMPLETE dataState when everything succeeds", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    userFindMany: prismaClient.user.findMany,
    dataAccessLogCreate: prismaClient.dataAccessLog.create,
    benSignupFindMany: prismaClient.beneficiarySignup.findMany,
    selfSubFindMany: prismaClient.selfSubmittedRequest.findMany,
    sessionFindMany: prismaClient.serviceSession.findMany,
  };
  baseMocks();
  prismaClient.beneficiarySignup.findMany = async () => [];
  prismaClient.selfSubmittedRequest.findMany = async () => [];
  prismaClient.serviceSession.findMany = async () => [];
  try {
    const app = express();
    app.use("/", schoolRoutes);
    const res = await requestAsAdmin(app);
    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.equal(body.totals.reconciliation.dataState, "COMPLETE");
    assert.equal(body.totals.reconciliation.failedSources, undefined);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.user.findMany = original.userFindMany;
    prismaClient.dataAccessLog.create = original.dataAccessLogCreate;
    prismaClient.beneficiarySignup.findMany = original.benSignupFindMany;
    prismaClient.selfSubmittedRequest.findMany = original.selfSubFindMany;
    prismaClient.serviceSession.findMany = original.sessionFindMany;
  }
});

// §9 canonical service-hour ledger: surfaced in this same response as a
// read-only audit trail (ledgerEntries), alongside — not instead of — the
// existing per-source records and totals.
test("GET /:id/students/:studentId/hour-breakdown includes ledgerEntries without affecting totals", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    userFindMany: prismaClient.user.findMany,
    dataAccessLogCreate: prismaClient.dataAccessLog.create,
    benSignupFindMany: prismaClient.beneficiarySignup.findMany,
    selfSubFindMany: prismaClient.selfSubmittedRequest.findMany,
    sessionFindMany: prismaClient.serviceSession.findMany,
    ledgerFindMany: prismaClient.serviceHourLedgerEntry.findMany,
  };
  baseMocks();
  prismaClient.beneficiarySignup.findMany = async () => [];
  prismaClient.selfSubmittedRequest.findMany = async () => [];
  prismaClient.serviceSession.findMany = async () => [];
  const approvedAt = new Date("2026-01-15T12:00:00Z");
  prismaClient.serviceHourLedgerEntry.findMany = async () => [{
    id: "ledger-1",
    sourceType: "SELF_SUBMITTED",
    sourceId: "submission-1",
    category: "environment",
    approvedMinutes: 150,
    approvedAt,
    approver: { id: "approver-1", name: "Approving Admin" },
  }];
  try {
    const app = express();
    app.use("/", schoolRoutes);
    const res = await requestAsAdmin(app);
    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.equal(body.totals.reconciliation.dataState, "COMPLETE");
    assert.equal(body.ledgerEntries.length, 1);
    assert.equal(body.ledgerEntries[0].sourceType, "SELF_SUBMITTED");
    assert.equal(body.ledgerEntries[0].approvedHours, 2.5);
    assert.equal(body.ledgerEntries[0].approverName, "Approving Admin");
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.user.findMany = original.userFindMany;
    prismaClient.dataAccessLog.create = original.dataAccessLogCreate;
    prismaClient.beneficiarySignup.findMany = original.benSignupFindMany;
    prismaClient.selfSubmittedRequest.findMany = original.selfSubFindMany;
    prismaClient.serviceSession.findMany = original.sessionFindMany;
    prismaClient.serviceHourLedgerEntry.findMany = original.ledgerFindMany;
  }
});

test("GET /:id/students/:studentId/hour-breakdown degrades to PARTIAL (not 500) when the ledger lookup fails", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    userFindMany: prismaClient.user.findMany,
    dataAccessLogCreate: prismaClient.dataAccessLog.create,
    benSignupFindMany: prismaClient.beneficiarySignup.findMany,
    selfSubFindMany: prismaClient.selfSubmittedRequest.findMany,
    sessionFindMany: prismaClient.serviceSession.findMany,
    ledgerFindMany: prismaClient.serviceHourLedgerEntry.findMany,
  };
  baseMocks();
  prismaClient.beneficiarySignup.findMany = async () => [];
  prismaClient.selfSubmittedRequest.findMany = async () => [];
  prismaClient.serviceSession.findMany = async () => [];
  prismaClient.serviceHourLedgerEntry.findMany = async () => { throw new Error("transient DB error"); };
  try {
    const app = express();
    app.use("/", schoolRoutes);
    const res = await requestAsAdmin(app);
    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.equal(body.totals.reconciliation.dataState, "PARTIAL");
    assert.ok(body.totals.reconciliation.failedSources.includes("service hour ledger"));
    assert.deepEqual(body.ledgerEntries, []);
    // The ledger being unavailable must not affect the real totals.
    assert.equal(typeof body.totals.approved, "number");
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.user.findMany = original.userFindMany;
    prismaClient.dataAccessLog.create = original.dataAccessLogCreate;
    prismaClient.beneficiarySignup.findMany = original.benSignupFindMany;
    prismaClient.selfSubmittedRequest.findMany = original.selfSubFindMany;
    prismaClient.serviceSession.findMany = original.sessionFindMany;
    prismaClient.serviceHourLedgerEntry.findMany = original.ledgerFindMany;
  }
});
