import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import express from "express";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = "student-milestones-scope-test-secret";

const prisma = require("../src/lib/prisma").default as typeof import("../src/lib/prisma").default;
const reportsRoutes = require("../src/routes/reports").default as typeof import("../src/routes/reports").default;
const db = prisma as any;

const teacher = {
  id: "teacher-a",
  role: "TEACHER",
  schoolId: "school-a",
  assignedCohorts: [{ cohortId: "cohort-a" }],
  status: "ACTIVE",
  tokenVersion: 0,
  emailVerified: true, eligibilityAttestation: { eligible13Plus: true },
  school: { verified: true, ownershipStatus: "APPROVED" },
};

const student = {
  id: "student-a",
  role: "STUDENT",
  schoolId: "school-a",
  cohortId: "cohort-a",
  cohort: { schoolId: "school-a", requiredHours: 40, milestoneThresholds: null },
  cohortMemberships: [],
  classroom: null,
  school: { requiredHours: 40, milestoneThresholds: null },
};

async function request(path: string) {
  const app = express();
  app.use(reportsRoutes);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const token = jwt.sign({ userId: teacher.id, email: "teacher-a@school.test", role: teacher.role, tv: 0 }, process.env.JWT_SECRET!);
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, { headers: { authorization: `Bearer ${token}` } });
    return response;
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("student milestones enforce teacher school and assigned-cohort scope", async () => {
  const original = {
    userFindUnique: db.user.findUnique,
    beneficiaryFindMany: db.beneficiarySignup.findMany,
    selfSubmittedFindMany: db.selfSubmittedRequest.findMany,
    sessionFindMany: db.serviceSession.findMany,
  };
  db.user.findUnique = async ({ where, select }: any) => {
    if (where.id === teacher.id && select?.assignedCohorts) return teacher;
    if (where.id === "student-b") return { ...student, id: "student-b", schoolId: "school-b", cohortId: "cohort-b", cohort: { schoolId: "school-b" } };
    if (where.id === "student-out") return { ...student, id: "student-out", cohortId: "cohort-b" };
    if (where.id === student.id) return student;
    return teacher;
  };
  db.beneficiarySignup.findMany = async () => [];
  db.selfSubmittedRequest.findMany = async () => [];
  db.serviceSession.findMany = async () => [];

  try {
    const crossSchool = await request("/student/milestones?studentId=student-b");
    assert.equal(crossSchool.status, 403);
    const outOfCohort = await request("/student/milestones?studentId=student-out");
    assert.equal(outOfCohort.status, 403);
    const authorized = await request("/student/milestones?studentId=student-a");
    assert.equal(authorized.status, 200);
    assert.equal((await authorized.json()).percentComplete, 0);
  } finally {
    db.user.findUnique = original.userFindUnique;
    db.beneficiarySignup.findMany = original.beneficiaryFindMany;
    db.selfSubmittedRequest.findMany = original.selfSubmittedFindMany;
    db.serviceSession.findMany = original.sessionFindMany;
  }
});
