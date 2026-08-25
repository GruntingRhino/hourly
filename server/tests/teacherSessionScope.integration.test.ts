import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import express from "express";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = "tenant-scope-test-jwt-secret";

const prisma = require("../src/lib/prisma").default as typeof import("../src/lib/prisma").default;
const sessionRoutes = require("../src/routes/sessions").default as typeof import("../src/routes/sessions").default;
const prismaClient = prisma as any;

async function getAsTeacher(app: express.Express, path: string) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const token = jwt.sign(
      { userId: "teacher-a", email: "teacher-a@school.test", role: "TEACHER", tv: 0 },
      process.env.JWT_SECRET!,
    );
    return await fetch(`http://127.0.0.1:${address.port}${path}`, {
      headers: { authorization: `Bearer ${token}` },
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("teacher cannot list sessions for a same-school student outside assigned cohorts", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    sessionFindMany: prismaClient.serviceSession.findMany,
    dataAccessCreate: prismaClient.dataAccessLog.create,
  };
  let sessionQueryCount = 0;

  prismaClient.user.findUnique = async ({ where, select }: any) => {
    if (where.id === "teacher-a") {
      if (select?.assignedCohorts) {
        return {
          id: "teacher-a",
          role: "TEACHER",
          schoolId: "school-a",
          assignedCohorts: [{ cohortId: "cohort-a" }],
        };
      }
      return {
        id: "teacher-a",
        email: "teacher-a@school.test",
        role: "TEACHER",
        status: "ACTIVE",
        tokenVersion: 0,
        emailVerified: true,
        schoolId: "school-a",
        school: { verified: true, ownershipStatus: "APPROVED" },
      };
    }
    if (where.id === "student-b") {
      return {
        id: "student-b",
        role: "STUDENT",
        schoolId: "school-a",
        cohortId: "cohort-b",
        cohort: { schoolId: "school-a" },
        cohortMemberships: [{ cohortId: "cohort-b", cohort: { schoolId: "school-a" } }],
        classroom: null,
      };
    }
    return null;
  };
  prismaClient.serviceSession.findMany = async () => {
    sessionQueryCount += 1;
    return [{ id: "sensitive-session" }];
  };
  prismaClient.dataAccessLog.create = async () => ({ id: "audit" });

  try {
    const app = express();
    app.use(sessionRoutes);
    const response = await getAsTeacher(app, "/school?studentId=student-b");
    assert.equal(response.status, 404);
    assert.equal(sessionQueryCount, 0);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.serviceSession.findMany = original.sessionFindMany;
    prismaClient.dataAccessLog.create = original.dataAccessCreate;
  }
});

test("teacher session queries require the record-owning school", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    sessionFindMany: prismaClient.serviceSession.findMany,
    dataAccessCreate: prismaClient.dataAccessLog.create,
  };
  let observedWhere: any;

  prismaClient.user.findUnique = async ({ where, select }: any) => {
    if (where.id === "teacher-a") {
      if (select?.assignedCohorts) {
        return {
          id: "teacher-a",
          role: "TEACHER",
          schoolId: "school-a",
          assignedCohorts: [{ cohortId: "cohort-a" }],
        };
      }
      return {
        id: "teacher-a",
        email: "teacher-a@school.test",
        role: "TEACHER",
        status: "ACTIVE",
        tokenVersion: 0,
        emailVerified: true,
        schoolId: "school-a",
        school: { verified: true, ownershipStatus: "APPROVED" },
      };
    }
    if (where.id === "student-a") {
      return {
        id: "student-a",
        role: "STUDENT",
        schoolId: "school-a",
        cohortId: "cohort-a",
        cohort: { schoolId: "school-a" },
        cohortMemberships: [{ cohortId: "cohort-a", cohort: { schoolId: "school-a" } }],
        classroom: null,
      };
    }
    return null;
  };
  prismaClient.serviceSession.findMany = async ({ where }: any) => {
    observedWhere = where;
    return [];
  };
  prismaClient.dataAccessLog.create = async () => ({ id: "audit" });

  try {
    const app = express();
    app.use(sessionRoutes);
    const response = await getAsTeacher(app, "/school?studentId=student-a");
    assert.equal(response.status, 200);
    assert.equal(observedWhere.schoolId, "school-a");
    assert.equal(observedWhere.userId, "student-a");
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.serviceSession.findMany = original.sessionFindMany;
    prismaClient.dataAccessLog.create = original.dataAccessCreate;
  }
});

test("teacher cannot download signature evidence owned by another school", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    sessionFindUnique: prismaClient.serviceSession.findUnique,
  };

  prismaClient.user.findUnique = async ({ where, select }: any) => {
    if (where.id === "teacher-a") {
      if (select?.assignedCohorts) {
        return {
          id: "teacher-a",
          role: "TEACHER",
          schoolId: "school-a",
          assignedCohorts: [{ cohortId: "cohort-a" }],
        };
      }
      return {
        id: "teacher-a",
        email: "teacher-a@school.test",
        role: "TEACHER",
        status: "ACTIVE",
        tokenVersion: 0,
        emailVerified: true,
        schoolId: "school-a",
        organizationId: null,
        school: { verified: true, ownershipStatus: "APPROVED" },
      };
    }
    if (where.id === "student-a") {
      return {
        id: "student-a",
        role: "STUDENT",
        schoolId: "school-a",
        cohortId: "cohort-a",
        cohort: { schoolId: "school-a" },
        cohortMemberships: [{ cohortId: "cohort-a", cohort: { schoolId: "school-a" } }],
        classroom: null,
      };
    }
    return null;
  };
  prismaClient.serviceSession.findUnique = async () => ({
    id: "session-foreign",
    userId: "student-a",
    schoolId: "school-b",
    signatureFileBytes: Buffer.from("foreign signature"),
    signatureFileName: "signature.pdf",
    signatureFileMimeType: "application/pdf",
    opportunity: { organizationId: "org-b" },
  });

  try {
    const app = express();
    app.use(sessionRoutes);
    const response = await getAsTeacher(app, "/session-foreign/signature-file");
    assert.equal(response.status, 403);
    assert.doesNotMatch(await response.text(), /foreign signature/);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.serviceSession.findUnique = original.sessionFindUnique;
  }
});
