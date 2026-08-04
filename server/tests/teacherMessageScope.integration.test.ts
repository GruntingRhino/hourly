import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import express from "express";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = "message-scope-test-jwt-secret";

const prisma = require("../src/lib/prisma").default as typeof import("../src/lib/prisma").default;
const messageRoutes = require("../src/routes/messages").default as typeof import("../src/routes/messages").default;
const prismaClient = prisma as any;

async function postAsTeacher(app: express.Express, path: string, body: unknown) {
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
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("teacher bulk messaging excludes same-school students outside assigned cohorts", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    userFindMany: prismaClient.user.findMany,
    schoolFindUnique: prismaClient.school.findUnique,
    transaction: prismaClient.$transaction,
  };
  let messageTransactionCount = 0;
  let observedStudentWhere: any;

  prismaClient.user.findUnique = async ({ where, select }: any) => {
    if (where.id !== "teacher-a") return null;
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
      name: "Teacher A",
      role: "TEACHER",
      status: "ACTIVE",
      tokenVersion: 0,
      emailVerified: true,
      schoolId: "school-a",
      school: { verified: true, ownershipStatus: "APPROVED" },
    };
  };
  prismaClient.school.findUnique = async () => ({
    id: "school-a",
    name: "School A",
    requiredHours: 40,
    serviceStartDate: null,
    serviceEndDate: null,
  });
  prismaClient.user.findMany = async ({ where }: any) => {
    observedStudentWhere = where;
    const assignedIds = where?.OR?.[0]?.cohortId?.in ?? [];
    return assignedIds.includes("cohort-a")
      ? [{ id: "student-a", name: "Assigned", email: "a@school.test", grade: "9", cohortId: "cohort-a", cohort: null, cohortMemberships: [] }]
      : [
          { id: "student-a", name: "Assigned", email: "a@school.test", grade: "9", cohortId: "cohort-a", cohort: null, cohortMemberships: [] },
          { id: "student-b", name: "Unassigned", email: "b@school.test", grade: "9", cohortId: "cohort-b", cohort: null, cohortMemberships: [] },
        ];
  };
  prismaClient.$transaction = async () => {
    messageTransactionCount += 1;
    return [];
  };

  try {
    const app = express();
    app.use(express.json());
    app.use(messageRoutes);
    const response = await postAsTeacher(app, "/bulk", {
      receiverIds: ["student-b"],
      body: "Private cohort reminder",
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      recipientCount: 0,
      message: "No matching recipients found",
    });
    assert.equal(observedStudentWhere.schoolId, "school-a");
    assert.deepEqual(observedStudentWhere.OR[0], { cohortId: { in: ["cohort-a"] } });
    assert.equal(messageTransactionCount, 0);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.user.findMany = original.userFindMany;
    prismaClient.school.findUnique = original.schoolFindUnique;
    prismaClient.$transaction = original.transaction;
  }
});
