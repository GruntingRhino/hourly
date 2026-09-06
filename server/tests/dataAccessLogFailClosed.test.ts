import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import prisma from "../src/lib/prisma";
import beneficiaryRoutes from "../src/routes/beneficiaries";
import { logDataAccess, summarizeStudentSubjects } from "../src/lib/dataAccessLog";

const prismaClient = prisma as any;

test("summarizeStudentSubjects never includes student names or emails", () => {
  const summary = summarizeStudentSubjects([
    { id: "student-1" },
    { id: "student-2" },
    { id: "student-1" }, // duplicate — must be deduped before counting/digesting
  ]);
  assert.equal(summary.studentCount, 2);
  assert.equal("includedStudents" in summary, false);
  assert.equal(typeof summary.subjectSetDigest, "string");
  assert.ok((summary.subjectSetDigest as string).length > 0);

  // Digest is deterministic for the same subject set...
  const again = summarizeStudentSubjects([{ id: "student-2" }, { id: "student-1" }]);
  assert.equal(again.subjectSetDigest, summary.subjectSetDigest);

  // ...and changes for a different subject set.
  const different = summarizeStudentSubjects([{ id: "student-3" }]);
  assert.notEqual(different.subjectSetDigest, summary.subjectSetDigest);
});

test("logDataAccess rejects instead of swallowing a write failure", async () => {
  const original = prismaClient.dataAccessLog.create;
  prismaClient.dataAccessLog.create = async () => {
    throw new Error("simulated database outage");
  };
  try {
    await assert.rejects(
      () => logDataAccess({ actorId: "actor-1", action: "VIEW_STUDENT_LIST" }),
      /simulated database outage/,
    );
  } finally {
    prismaClient.dataAccessLog.create = original;
  }
});

async function requestAs(app: express.Express, path: string, user: { id: string; email: string; role: string }) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role, tv: 0 }, process.env.JWT_SECRET!);
    return await fetch(`http://127.0.0.1:${address.port}${path}`, { headers: { authorization: `Bearer ${token}` } });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test("a failed audit write blocks the beneficiary signup-list response instead of releasing student data", async () => {
  const benAdmin = { id: "ben-admin-1", email: "admin@example.test", role: "BENEFICIARY_ADMIN" };
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    signupFindMany: prismaClient.beneficiarySignup.findMany,
    userFindMany: prismaClient.user.findMany,
    dataAccessLogCreate: prismaClient.dataAccessLog.create,
  };

  prismaClient.user.findUnique = async ({ where }: any) =>
    where.id === benAdmin.id
      ? {
          id: benAdmin.id, email: benAdmin.email, role: benAdmin.role, status: "ACTIVE", tokenVersion: 0,
          beneficiaryId: "beneficiary-1", emailVerified: true, eligibilityAttestation: { eligible13Plus: true }, school: null,
        }
      : null;
  prismaClient.beneficiarySignup.findMany = async () => [
    { id: "signup-1", studentId: "student-1", status: "CONFIRMED", verificationStatus: "PENDING", slot: { opportunity: { id: "opp-1", title: "Food bank shift" } } },
  ];
  prismaClient.user.findMany = async () => [{ id: "student-1", name: "Alice" }];
  // Simulate the audit-write outage that must not be treated as best-effort.
  prismaClient.dataAccessLog.create = async () => {
    throw new Error("simulated audit outage");
  };

  try {
    const app = express();
    app.use("/api/beneficiaries", beneficiaryRoutes);
    const res = await requestAs(app, "/api/beneficiaries/beneficiary-1/signups", benAdmin);
    assert.equal(res.status, 500, "response must fail closed, not release student data with no audit trail");
    const body = await res.json() as { error: string };
    assert.ok(body.error);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.beneficiarySignup.findMany = original.signupFindMany;
    prismaClient.user.findMany = original.userFindMany;
    prismaClient.dataAccessLog.create = original.dataAccessLogCreate;
  }
});
