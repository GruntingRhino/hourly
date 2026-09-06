import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import express from "express";
import jwt from "jsonwebtoken";

// Candidate HTTP regressions. Run this file from server/ after integrating the
// route patch against the disposable test database (or adapt the scoped Prisma
// doubles below to the repository's fixture factory). No source-text assertion
// is sufficient for these boundaries.
process.env.JWT_SECRET = "cohort-access-regression-jwt";

const prisma = require("../src/lib/prisma").default as any;
const reportsRoutes = require("../src/routes/reports").default as express.Router;
const beneficiaryRoutes = require("../src/routes/beneficiaries").default as express.Router;
const schoolRoutes = require("../src/routes/schools").default as express.Router;

const teacher = {
  id: "teacher-a", email: "teacher-a@school.test", role: "TEACHER", status: "ACTIVE",
  tokenVersion: 0, emailVerified: true, eligibilityAttestation: { eligible13Plus: true }, schoolId: "school-a",
  school: { verified: true, ownershipStatus: "APPROVED" },
};
const admin = { ...teacher, id: "admin-a", email: "admin-a@school.test", role: "SCHOOL_ADMIN" };
const outOfCohortStudent = {
  id: "student-b", role: "STUDENT", schoolId: "school-a", cohortId: "cohort-b",
  cohort: { schoolId: "school-a" }, cohortMemberships: [{ cohortId: "cohort-b", cohort: { schoolId: "school-a" } }], classroom: null,
};
const assignedStudent = { ...outOfCohortStudent, id: "student-a", cohortId: "cohort-a", cohortMemberships: [{ cohortId: "cohort-a", cohort: { schoolId: "school-a" } }] };

async function request(router: express.Router, method: string, path: string, actor = teacher, body?: unknown) {
  const app = express(); app.use(express.json()); app.use(router);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address(); assert.ok(address && typeof address === "object");
    const token = jwt.sign({ userId: actor.id, email: actor.email, role: actor.role, tv: 0 }, process.env.JWT_SECRET!);
    return await fetch(`http://127.0.0.1:${address.port}${path}`, {
      method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } finally { await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve())); }
}

function installUserLookup(actor: typeof teacher | typeof admin, student = outOfCohortStudent) {
  const original = prisma.user.findUnique;
  prisma.user.findUnique = async ({ where, select }: any) => {
    if (where.id === actor.id) {
      if (select?.assignedCohorts) return { id: actor.id, role: actor.role, schoolId: actor.schoolId, assignedCohorts: actor.role === "TEACHER" ? [{ cohortId: "cohort-a" }] : [] };
      return actor;
    }
    if (where.id === student.id) return student;
    return null;
  };
  return () => { prisma.user.findUnique = original; };
}

function installStudentAccessLookup(students: any[]) {
  // assertStudentAccessibleToStaff performs this second lookup without a role
  // shortcut; keeping it in the same stub makes cross-school/cohort cases real.
  const original = prisma.user.findUnique;
  prisma.user.findUnique = async ({ where, select }: any) => {
    if (where.id === "teacher-a" && select?.assignedCohorts) return { id: "teacher-a", role: "TEACHER", schoolId: "school-a", assignedCohorts: [{ cohortId: "cohort-a" }] };
    if (where.id === "teacher-a") return teacher;
    return students.find((student) => student.id === where.id) ?? null;
  };
  return () => { prisma.user.findUnique = original; };
}

test("audit history denies same-school teacher outside assigned cohort before logs", async () => {
  const restore = installStudentAccessLookup([outOfCohortStudent]);
  const originals = { session: prisma.serviceSession.findUnique, logs: prisma.auditLog.findMany };
  let logReads = 0;
  prisma.serviceSession.findUnique = async () => ({ id: "session-b", userId: "student-b", user: outOfCohortStudent, opportunity: { organizationId: "org-a" } });
  prisma.auditLog.findMany = async () => { logReads++; return []; };
  try { const response = await request(reportsRoutes, "GET", "/audit/session-b"); assert.equal(response.status, 403); assert.equal(logReads, 0); }
  finally { restore(); prisma.serviceSession.findUnique = originals.session; prisma.auditLog.findMany = originals.logs; }
});

test("audit history allows assigned-cohort teacher and school admin", async () => {
  const originals = { user: prisma.user.findUnique, session: prisma.serviceSession.findUnique, logs: prisma.auditLog.findMany };
  prisma.serviceSession.findUnique = async () => ({ id: "session-a", userId: "student-a", user: assignedStudent, opportunity: { organizationId: "org-a" } });
  prisma.auditLog.findMany = async () => [];
  for (const actor of [teacher, admin]) {
    const restore = installUserLookup(actor, assignedStudent);
    try { const response = await request(reportsRoutes, "GET", "/audit/session-a", actor); assert.equal(response.status, 200); }
    finally { restore(); }
  }
  prisma.user.findUnique = originals.user; prisma.serviceSession.findUnique = originals.session; prisma.auditLog.findMany = originals.logs;
});

test("beneficiary history denies same-school out-of-cohort teacher and preserves student owner", async () => {
  const originals = { user: prisma.user.findUnique, signup: prisma.beneficiarySignup.findUnique, history: prisma.beneficiaryAuditLog.findMany };
  prisma.beneficiarySignup.findUnique = async () => ({ id: "signup-b", studentId: "student-b", slot: { id: "slot-b", date: new Date(), startTime: "09:00", endTime: "10:00", durationHours: 1, opportunity: { title: "Service", category: "General", beneficiaryId: "beneficiary-a", beneficiary: { id: "beneficiary-a", name: "Org", category: "General" } } }, status: "CONFIRMED", verificationStatus: "PENDING", totalHours: null, rejectionReason: null, checkedIn: false, checkedOut: false, verifiedAt: null });
  prisma.beneficiaryAuditLog.findMany = async () => [];
  const restore = installStudentAccessLookup([outOfCohortStudent]);
  try {
    const denied = await request(beneficiaryRoutes, "GET", "/signups/signup-b/history");
    assert.equal(denied.status, 403);
    restore();
    const restoreOwner = installUserLookup({ ...outOfCohortStudent, email: "student-b@school.test", status: "ACTIVE", tokenVersion: 0, emailVerified: true, eligibilityAttestation: { eligible13Plus: true } } as any, outOfCohortStudent);
    try { const owner = await request(beneficiaryRoutes, "GET", "/signups/signup-b/history", { ...outOfCohortStudent, email: "student-b@school.test", status: "ACTIVE", tokenVersion: 0, emailVerified: true, eligibilityAttestation: { eligible13Plus: true } } as any); assert.equal(owner.status, 200); }
    finally { restoreOwner(); }
  }
  finally { prisma.user.findUnique = originals.user; prisma.beneficiarySignup.findUnique = originals.signup; prisma.beneficiaryAuditLog.findMany = originals.history; }
});

test("group roster filters out-of-cohort members and add rejects them", async () => {
  const originals = { user: prisma.user.findUnique, members: prisma.studentGroupMember.findMany, students: prisma.user.findMany, school: prisma.school.findUnique, hours: prisma.serviceSession.findMany };
  const restore = installStudentAccessLookup([outOfCohortStudent, assignedStudent]);
  prisma.studentGroup.findUnique = async () => ({ id: "group-a", schoolId: "school-a" });
  prisma.studentGroupMember.findMany = async () => [{ studentId: "student-b" }, { studentId: "student-a" }];
  prisma.user.findMany = async ({ where, select }: any) => where?.AND ? [{ id: "student-a" }] : where?.id?.in?.includes("student-a") ? [{ id: "student-a", name: "Assigned", email: "a@school.test", grade: "9", cohort: null }] : [];
  prisma.school.findUnique = async () => ({ requiredHours: 40 });
  prisma.serviceSession.findMany = async () => [];
  try {
    const roster = await request(schoolRoutes, "GET", "/school-a/groups/group-a/students"); assert.equal(roster.status, 200); assert.deepEqual((await roster.json()).map((s: any) => s.id), ["student-a"]);
    const add = await request(schoolRoutes, "POST", "/school-a/groups/group-a/students", teacher, { studentId: "student-b" }); assert.equal(add.status, 403);
  } finally { restore(); prisma.user.findUnique = originals.user; prisma.user.findMany = originals.students; prisma.school.findUnique = originals.school; prisma.serviceSession.findMany = originals.hours; }
});
