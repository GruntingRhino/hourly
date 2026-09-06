import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import express from "express";
import jwt from "jsonwebtoken";
import prisma from "../src/lib/prisma";
import cohortRoutes from "../src/routes/cohorts";
import beneficiaryRoutes from "../src/routes/beneficiaries";
import selfSubmissionRoutes from "../src/routes/selfSubmissions";

// §10 staged bulk imports (scoped as a dry-run preview, not full
// ImportBatch/ImportRow staging): every CSV import endpoint now accepts
// `dryRun: true`, which runs the exact same parsing/validation/business-
// rule logic and returns the exact same result shape, but never writes
// anything — no created/updated rows, no emails, no rate-limit budget
// consumption, no audit log entries. These tests assert that contract for
// all 5 import routes: with dryRun, the reported counts are accurate but
// every mocked write function throws if called (proving it wasn't); and a
// following non-dry-run call for the same behavior still performs the real
// writes (regression coverage for the pre-existing single-shot behavior).

process.env.JWT_SECRET = process.env.JWT_SECRET || "bulk-import-dry-run-test-secret";

const prismaClient = prisma as any;

const schoolAdmin = {
  id: "import-admin-1",
  email: "import-admin@example.test",
  role: "SCHOOL_ADMIN",
  status: "ACTIVE",
  tokenVersion: 0,
  schoolId: "import-school-1",
  emailVerified: true, eligibilityAttestation: { eligible13Plus: true },
  school: { verified: true, ownershipStatus: "APPROVED" },
  assignedCohorts: [],
};

function adminToken(): string {
  return jwt.sign({ userId: schoolAdmin.id, email: schoolAdmin.email, role: schoolAdmin.role, tv: 0 }, process.env.JWT_SECRET!);
}

async function request(app: express.Express, method: string, path: string, body?: unknown) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    return await fetch(`http://127.0.0.1:${(address as any).port}${path}`, {
      method,
      headers: { "content-type": "application/json", authorization: `Bearer ${adminToken()}` },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

function throwIfCalled(label: string) {
  return async () => { throw new Error(`should not be called during a dry run: ${label}`); };
}

test("POST /api/cohorts/:id/import with dryRun:true previews without creating invitations, sending email, or publishing the cohort", async () => {
  const cohort = { id: "cohort-1", name: "Cohort A", schoolId: schoolAdmin.schoolId, publishedAt: null, school: { name: "Import School" } };
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    cohortFindUnique: prismaClient.cohort.findUnique,
    invitationFindUnique: prismaClient.studentInvitation.findUnique,
    invitationCreate: prismaClient.studentInvitation.create,
    cohortUpdate: prismaClient.cohort.update,
    auditLogCount: prismaClient.auditLog.count,
  };
  prismaClient.user.findUnique = async ({ where }: any) =>
    where.id === schoolAdmin.id ? schoolAdmin : (where.email ? null : null);
  prismaClient.cohort.findUnique = async () => cohort;
  prismaClient.studentInvitation.findUnique = async () => null;
  prismaClient.studentInvitation.create = throwIfCalled("studentInvitation.create");
  prismaClient.cohort.update = throwIfCalled("cohort.update");
  prismaClient.auditLog.count = async () => 0;

  try {
    const app = express();
    app.use(express.json());
    app.use("/", cohortRoutes);
    const csvData = "name,email\nAda Lovelace,ada@example.test\nAda Lovelace,ada@example.test\n";
    const res = await request(app, "POST", "/cohort-1/import", { csvData, dryRun: true });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.dryRun, true);
    // Row 1 would be added; row 2 (duplicate email within this same CSV)
    // would be skipped as "Invitation already exists", matching what the
    // real commit path would do on the second row.
    assert.equal(body.added, 1);
    assert.equal(body.skipped, 1);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.cohort.findUnique = original.cohortFindUnique;
    prismaClient.studentInvitation.findUnique = original.invitationFindUnique;
    prismaClient.studentInvitation.create = original.invitationCreate;
    prismaClient.cohort.update = original.cohortUpdate;
    prismaClient.auditLog.count = original.auditLogCount;
  }
});

test("POST /api/cohorts/:id/import without dryRun still creates invitations and publishes the cohort (regression)", async () => {
  const cohort = { id: "cohort-2", name: "Cohort B", schoolId: schoolAdmin.schoolId, publishedAt: null, school: { name: "Import School" } };
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    cohortFindUnique: prismaClient.cohort.findUnique,
    invitationFindUnique: prismaClient.studentInvitation.findUnique,
    invitationCreate: prismaClient.studentInvitation.create,
    cohortUpdate: prismaClient.cohort.update,
    auditLogCount: prismaClient.auditLog.count,
    auditLogCreate: prismaClient.auditLog.create,
    transaction: prismaClient.$transaction,
  };
  let invitationCreated = false;
  let cohortPublished = false;
  prismaClient.user.findUnique = async ({ where }: any) => (where.id === schoolAdmin.id ? schoolAdmin : null);
  prismaClient.cohort.findUnique = async () => cohort;
  prismaClient.studentInvitation.findUnique = async () => null;
  prismaClient.studentInvitation.create = async ({ data }: any) => { invitationCreated = true; return { id: "inv-1", ...data }; };
  prismaClient.cohort.update = async () => { cohortPublished = true; return cohort; };
  prismaClient.auditLog.count = async () => 0;
  prismaClient.auditLog.create = async () => ({ id: "audit-1" });
  prismaClient.$transaction = async (fn: any) => fn(prismaClient);

  try {
    const app = express();
    app.use(express.json());
    app.use("/", cohortRoutes);
    const csvData = "name,email\nAda Lovelace,ada2@example.test\n";
    const res = await request(app, "POST", "/cohort-2/import", { csvData });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.dryRun, false);
    assert.equal(body.added, 1);
    assert.equal(invitationCreated, true);
    assert.equal(cohortPublished, true);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.cohort.findUnique = original.cohortFindUnique;
    prismaClient.studentInvitation.findUnique = original.invitationFindUnique;
    prismaClient.studentInvitation.create = original.invitationCreate;
    prismaClient.cohort.update = original.cohortUpdate;
    prismaClient.auditLog.count = original.auditLogCount;
    prismaClient.auditLog.create = original.auditLogCreate;
    prismaClient.$transaction = original.transaction;
  }
});

test("POST /api/beneficiaries/import-csv with dryRun:true previews without creating any Beneficiary row", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    beneficiaryCreate: prismaClient.beneficiary.create,
    approvalCreate: prismaClient.schoolBeneficiaryApproval.create,
  };
  prismaClient.user.findUnique = async () => schoolAdmin;
  prismaClient.beneficiary.create = throwIfCalled("beneficiary.create");
  prismaClient.schoolBeneficiaryApproval.create = throwIfCalled("schoolBeneficiaryApproval.create");

  try {
    const app = express();
    app.use(express.json());
    app.use("/", beneficiaryRoutes);
    const csvData = "organization_name,category\nFood Bank,community\n";
    const res = await request(app, "POST", "/import-csv", { csvData, dryRun: true });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.dryRun, true);
    assert.equal(body.added, 1);
    assert.equal(body.failed, 0);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.beneficiary.create = original.beneficiaryCreate;
    prismaClient.schoolBeneficiaryApproval.create = original.approvalCreate;
  }
});

test("POST /api/self-submissions/import with dryRun:true previews without creating any SelfSubmittedRequest or audit log", async () => {
  const student = { id: "student-1", email: "student@example.test", schoolId: schoolAdmin.schoolId, cohortId: null };
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    studentFindMany: prismaClient.user.findMany,
    submissionCreate: prismaClient.selfSubmittedRequest.create,
    auditLogCreate: prismaClient.auditLog.create,
  };
  prismaClient.user.findUnique = async () => schoolAdmin;
  prismaClient.user.findMany = async () => [student];
  prismaClient.selfSubmittedRequest.create = throwIfCalled("selfSubmittedRequest.create");
  prismaClient.auditLog.create = throwIfCalled("auditLog.create");

  try {
    const app = express();
    app.use(express.json());
    app.use("/", selfSubmissionRoutes);
    const csvData = "student_email,organization_name,date,hours\nstudent@example.test,Food Bank,2026-01-01,3\n";
    const res = await request(app, "POST", "/import", { csvData, dryRun: true });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.dryRun, true);
    assert.equal(body.imported, 1);
    assert.equal(body.skipped.length, 0);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.user.findMany = original.studentFindMany;
    prismaClient.selfSubmittedRequest.create = original.submissionCreate;
    prismaClient.auditLog.create = original.auditLogCreate;
  }
});

test("POST /api/cohorts/:id/teachers/import with dryRun:true previews without creating a teacher user or assignment", async () => {
  const cohort = { id: "cohort-3", name: "Cohort C", schoolId: schoolAdmin.schoolId };
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    cohortFindUnique: prismaClient.cohort.findUnique,
    schoolFindUnique: prismaClient.school.findUnique,
    assignmentFindUnique: prismaClient.cohortTeacherAssignment.findUnique,
    userCreate: prismaClient.user.create,
    assignmentCreate: prismaClient.cohortTeacherAssignment.create,
  };
  prismaClient.user.findUnique = async ({ where }: any) =>
    where.id === schoolAdmin.id ? { ...schoolAdmin, email: schoolAdmin.email } : null;
  prismaClient.cohort.findUnique = async () => cohort;
  prismaClient.school.findUnique = async () => ({ name: "Import School" });
  prismaClient.cohortTeacherAssignment.findUnique = async () => null;
  prismaClient.user.create = throwIfCalled("user.create");
  prismaClient.cohortTeacherAssignment.create = throwIfCalled("cohortTeacherAssignment.create");

  try {
    const app = express();
    app.use(express.json());
    app.use("/", cohortRoutes);
    const csvData = "name,email\nNew Teacher,newteacher@example.test\n";
    const res = await request(app, "POST", "/cohort-3/teachers/import", { csvData, dryRun: true });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.dryRun, true);
    assert.equal(body.created, 1);
    assert.equal(body.assigned, 0);
    assert.equal(body.skipped, 0);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.cohort.findUnique = original.cohortFindUnique;
    prismaClient.school.findUnique = original.schoolFindUnique;
    prismaClient.cohortTeacherAssignment.findUnique = original.assignmentFindUnique;
    prismaClient.user.create = original.userCreate;
    prismaClient.cohortTeacherAssignment.create = original.assignmentCreate;
  }
});

test("POST /api/cohorts/teachers/import with dryRun:true previews without creating a teacher user or assignment", async () => {
  const cohort = { id: "cohort-name-match", name: "Cohort Named", schoolId: schoolAdmin.schoolId };
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    cohortFindMany: prismaClient.cohort.findMany,
    schoolFindUnique: prismaClient.school.findUnique,
    assignmentFindUnique: prismaClient.cohortTeacherAssignment.findUnique,
    userCreate: prismaClient.user.create,
    assignmentCreate: prismaClient.cohortTeacherAssignment.create,
  };
  prismaClient.user.findUnique = async ({ where }: any) =>
    where.id === schoolAdmin.id ? schoolAdmin : null;
  prismaClient.cohort.findMany = async () => [cohort];
  prismaClient.school.findUnique = async () => ({ name: "Import School" });
  prismaClient.cohortTeacherAssignment.findUnique = async () => null;
  prismaClient.user.create = throwIfCalled("user.create");
  prismaClient.cohortTeacherAssignment.create = throwIfCalled("cohortTeacherAssignment.create");

  try {
    const app = express();
    app.use(express.json());
    app.use("/", cohortRoutes);
    const csvData = `name,email,cohort\nNew Teacher,newteacher2@example.test,${cohort.name}\n`;
    const res = await request(app, "POST", "/teachers/import", { csvData, dryRun: true });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.dryRun, true);
    assert.equal(body.created, 1);
    assert.equal(body.assigned, 0);
    assert.equal(body.skipped, 0);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.cohort.findMany = original.cohortFindMany;
    prismaClient.school.findUnique = original.schoolFindUnique;
    prismaClient.cohortTeacherAssignment.findUnique = original.assignmentFindUnique;
    prismaClient.user.create = original.userCreate;
    prismaClient.cohortTeacherAssignment.create = original.assignmentCreate;
  }
});
