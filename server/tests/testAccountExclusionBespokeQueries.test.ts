import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import express from "express";
import jwt from "jsonwebtoken";

// Regression coverage for the bespoke (non-buildCohortScopedStudentWhere)
// staff-facing "list students" query sites that independently construct
// `where: { role: "STUDENT", ... }`. These don't go through the shared
// cohortAccess helper, so each needed its own `isTestAccount: false` added
// by hand. This asserts every one of them actually passes it to Prisma.

process.env.JWT_SECRET = "test-account-exclusion-test-jwt-secret";

const prisma = require("../src/lib/prisma").default as typeof import("../src/lib/prisma").default;
const prismaClient = prisma as any;

const classroomRoutes = require("../src/routes/classrooms").default as typeof import("../src/routes/classrooms").default;
const cohortRoutes = require("../src/routes/cohorts").default as typeof import("../src/routes/cohorts").default;
const schoolRoutes = require("../src/routes/schools").default as typeof import("../src/routes/schools").default;

function tokenFor(userId: string, role: string) {
  return jwt.sign({ userId, email: `${userId}@school.test`, role, tv: 0 }, process.env.JWT_SECRET!);
}

async function request(app: express.Express, method: string, path: string, userId: string, role: string, body?: unknown) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    return await fetch(`http://127.0.0.1:${(address as any).port}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${tokenFor(userId, role)}`,
        "content-type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function captureUserFindMany(): { calls: Array<Record<string, unknown>>; restore: () => void } {
  const original = prismaClient.user.findMany;
  const calls: Array<Record<string, unknown>> = [];
  prismaClient.user.findMany = async ({ where }: any) => {
    calls.push(where);
    return [];
  };
  return { calls, restore: () => { prismaClient.user.findMany = original; } };
}

test("GET /api/classrooms excludes test accounts from the student roster query", async () => {
  const admin = {
    id: "admin-a",
    email: "admin-a@school.test",
    role: "SCHOOL_ADMIN",
    status: "ACTIVE",
    tokenVersion: 0,
    emailVerified: true, eligibilityAttestation: { eligible13Plus: true },
    schoolId: "school-a",
    school: { verified: true, ownershipStatus: "APPROVED" },
  };
  const originalFindUnique = prismaClient.user.findUnique;
  const originalSchoolFindUnique = prismaClient.school.findUnique;
  const originalClassroomFindMany = prismaClient.classroom.findMany;
  prismaClient.user.findUnique = async () => admin;
  prismaClient.school.findUnique = async () => ({ id: "school-a" });
  prismaClient.classroom.findMany = async () => [];
  const { calls, restore } = captureUserFindMany();

  try {
    const app = express();
    app.use(express.json());
    app.use(classroomRoutes);
    const response = await request(app, "GET", "/", "admin-a", "SCHOOL_ADMIN");
    assert.equal(response.status, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].isTestAccount, false);
  } finally {
    restore();
    prismaClient.user.findUnique = originalFindUnique;
    prismaClient.school.findUnique = originalSchoolFindUnique;
    prismaClient.classroom.findMany = originalClassroomFindMany;
  }
});

test("GET /api/cohorts/:id excludes test accounts from the cohort roster query", async () => {
  const admin = {
    id: "admin-a",
    email: "admin-a@school.test",
    role: "SCHOOL_ADMIN",
    status: "ACTIVE",
    tokenVersion: 0,
    emailVerified: true, eligibilityAttestation: { eligible13Plus: true },
    schoolId: "school-a",
    school: { verified: true, ownershipStatus: "APPROVED" },
    assignedCohorts: [],
  };
  const cohort = {
    id: "cohort-a",
    name: "Cohort A",
    schoolId: "school-a",
    requiredHours: 40,
    serviceStartDate: null,
    serviceEndDate: null,
    usesHouseField: false,
    school: { requiredHours: 40, serviceStartDate: null, serviceEndDate: null },
    invitations: [],
    teacherAssignments: [],
    status: "PUBLISHED",
    graduationYear: null,
    publishedAt: new Date(),
    allowSelfSubmission: false,
    categoryHourCaps: null,
  };
  const originalFindUnique = prismaClient.user.findUnique;
  const originalCohortFindUnique = prismaClient.cohort.findUnique;
  const originalSchoolFindUnique = prismaClient.school.findUnique;
  prismaClient.user.findUnique = async () => admin;
  prismaClient.cohort.findUnique = async () => cohort;
  prismaClient.school.findUnique = async () => ({ id: "school-a", requiredHours: 40 });
  const { calls, restore } = captureUserFindMany();

  try {
    const app = express();
    app.use(express.json());
    app.use("/api/cohorts", cohortRoutes);
    const response = await request(app, "GET", "/api/cohorts/cohort-a", "admin-a", "SCHOOL_ADMIN");
    assert.equal(response.status, 200);
    assert.ok(calls.length >= 1);
    assert.ok(calls.every((where) => where.isTestAccount === false));
  } finally {
    restore();
    prismaClient.user.findUnique = originalFindUnique;
    prismaClient.cohort.findUnique = originalCohortFindUnique;
    prismaClient.school.findUnique = originalSchoolFindUnique;
  }
});

test("GET /api/schools/:id/export excludes test accounts from the student export query", async () => {
  const admin = {
    id: "admin-a",
    email: "admin-a@school.test",
    role: "SCHOOL_ADMIN",
    status: "ACTIVE",
    tokenVersion: 0,
    emailVerified: true, eligibilityAttestation: { eligible13Plus: true },
    schoolId: "school-a",
    school: { verified: true, ownershipStatus: "APPROVED" },
    assignedCohorts: [],
  };
  const originalFindUnique = prismaClient.user.findUnique;
  const originalSchoolFindUnique = prismaClient.school.findUnique;
  const originalDataAccessLogCreate = prismaClient.dataAccessLog.create;
  prismaClient.user.findUnique = async () => admin;
  prismaClient.school.findUnique = async () => ({
    id: "school-a",
    name: "School A",
    requiredHours: 40,
    serviceStartDate: null,
    serviceEndDate: null,
  });
  prismaClient.dataAccessLog.create = async () => ({});
  const { calls, restore } = captureUserFindMany();

  try {
    const app = express();
    app.use(express.json());
    app.use("/api/schools", schoolRoutes);
    const response = await request(app, "GET", "/api/schools/school-a/export", "admin-a", "SCHOOL_ADMIN");
    assert.equal(response.status, 200);
    assert.ok(calls.length >= 1);
    assert.ok(calls.every((where) => where.isTestAccount === false));
  } finally {
    restore();
    prismaClient.user.findUnique = originalFindUnique;
    prismaClient.school.findUnique = originalSchoolFindUnique;
    prismaClient.dataAccessLog.create = originalDataAccessLogCreate;
  }
});

test("GET /api/schools/:id/students/at-risk excludes test accounts", async () => {
  const admin = {
    id: "admin-a",
    email: "admin-a@school.test",
    role: "SCHOOL_ADMIN",
    status: "ACTIVE",
    tokenVersion: 0,
    emailVerified: true, eligibilityAttestation: { eligible13Plus: true },
    schoolId: "school-a",
    school: { verified: true, ownershipStatus: "APPROVED" },
    assignedCohorts: [],
  };
  const originalFindUnique = prismaClient.user.findUnique;
  const originalSchoolFindUnique = prismaClient.school.findUnique;
  prismaClient.user.findUnique = async () => admin;
  prismaClient.school.findUnique = async () => ({
    id: "school-a",
    requiredHours: 40,
    serviceStartDate: null,
    serviceEndDate: null,
  });
  const { calls, restore } = captureUserFindMany();

  try {
    const app = express();
    app.use(express.json());
    app.use("/api/schools", schoolRoutes);
    const response = await request(app, "GET", "/api/schools/school-a/students/at-risk", "admin-a", "SCHOOL_ADMIN");
    assert.equal(response.status, 200);
    assert.ok(calls.length >= 1);
    assert.ok(calls.every((where) => where.isTestAccount === false));
  } finally {
    restore();
    prismaClient.user.findUnique = originalFindUnique;
    prismaClient.school.findUnique = originalSchoolFindUnique;
  }
});

test("PUT /api/schools/:id with categoryHourCaps excludes test accounts from cap-warning scan", async () => {
  const admin = {
    id: "admin-a",
    email: "admin-a@school.test",
    role: "SCHOOL_ADMIN",
    status: "ACTIVE",
    tokenVersion: 0,
    emailVerified: true, eligibilityAttestation: { eligible13Plus: true },
    schoolId: "school-a",
    school: { verified: true, ownershipStatus: "APPROVED" },
  };
  const originalFindUnique = prismaClient.user.findUnique;
  const originalSchoolFindUnique = prismaClient.school.findUnique;
  const originalSchoolUpdate = prismaClient.school.update;
  const originalDataAccessLogCreate = prismaClient.dataAccessLog.create;
  prismaClient.user.findUnique = async () => admin;
  prismaClient.school.findUnique = async () => ({ id: "school-a", requiredHours: 40 });
  prismaClient.school.update = async () => ({ id: "school-a", categoryHourCaps: { environment: 10 } });
  prismaClient.dataAccessLog.create = async () => ({});
  const { calls, restore } = captureUserFindMany();

  try {
    const app = express();
    app.use(express.json());
    app.use("/api/schools", schoolRoutes);
    const response = await request(app, "PUT", "/api/schools/school-a", "admin-a", "SCHOOL_ADMIN", {
      categoryHourCaps: { environment: 10 },
    });
    assert.equal(response.status, 200);
    assert.ok(calls.length >= 1);
    assert.ok(calls.every((where) => where.isTestAccount === false));
  } finally {
    restore();
    prismaClient.user.findUnique = originalFindUnique;
    prismaClient.school.findUnique = originalSchoolFindUnique;
    prismaClient.school.update = originalSchoolUpdate;
    prismaClient.dataAccessLog.create = originalDataAccessLogCreate;
  }
});
