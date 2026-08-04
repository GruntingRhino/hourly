import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import prisma from "../src/lib/prisma";
import messageRoutes from "../src/routes/messages";

// Regression test for a gap surfaced while converting InterventionCase.status
// to a real Prisma enum: GET /interventions/cases read req.query.status via
// z.string().optional() (any non-empty string) and passed it straight into
// the Prisma where clause. A bad ?status= value previously fell through to
// an empty result instead of being rejected with a 400.

const prismaClient = prisma as any;

const teacher = {
  id: "teacher-1",
  email: "teacher@example.test",
  role: "TEACHER",
  status: "ACTIVE",
  tokenVersion: 0,
  schoolId: "school-a",
  emailVerified: true,
  school: { verified: true, ownershipStatus: "APPROVED" },
  assignedCohorts: [],
};

async function requestAs(app: express.Express, query: string) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const token = jwt.sign({ userId: teacher.id, email: teacher.email, role: teacher.role, tv: 0 }, process.env.JWT_SECRET!);
    return await fetch(`http://127.0.0.1:${address.port}/interventions/cases${query}`, {
      headers: { authorization: `Bearer ${token}` },
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

function setupMocks(observedWheres: Array<Record<string, unknown>>) {
  prismaClient.user.findUnique = async ({ where }: any) => (where.id === teacher.id ? teacher : null);
  prismaClient.school.findUnique = async () => ({
    id: teacher.schoolId,
    requiredHours: 20,
    serviceStartDate: null,
    serviceEndDate: null,
  });
  prismaClient.interventionCase.findMany = async ({ where }: any) => {
    observedWheres.push(where ?? {});
    return [];
  };
}

test("GET /interventions/cases rejects an invalid status query filter", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    schoolFindUnique: prismaClient.school.findUnique,
    caseFindMany: prismaClient.interventionCase.findMany,
  };
  const observedWheres: Array<Record<string, unknown>> = [];
  setupMocks(observedWheres);
  try {
    const app = express();
    app.use("/", messageRoutes);
    const res = await requestAs(app, "?status=BOGUS");
    assert.equal(res.status, 400);
    assert.equal(observedWheres.length, 0);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.school.findUnique = original.schoolFindUnique;
    prismaClient.interventionCase.findMany = original.caseFindMany;
  }
});

test("GET /interventions/cases accepts a valid status query filter", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    schoolFindUnique: prismaClient.school.findUnique,
    caseFindMany: prismaClient.interventionCase.findMany,
  };
  const observedWheres: Array<Record<string, unknown>> = [];
  setupMocks(observedWheres);
  try {
    const app = express();
    app.use("/", messageRoutes);
    const res = await requestAs(app, "?status=RESOLVED");
    assert.equal(res.status, 200);
    assert.equal(observedWheres[0].status, "RESOLVED");
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.school.findUnique = original.schoolFindUnique;
    prismaClient.interventionCase.findMany = original.caseFindMany;
  }
});

test("GET /interventions/cases with no status query applies no status filter", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    schoolFindUnique: prismaClient.school.findUnique,
    caseFindMany: prismaClient.interventionCase.findMany,
  };
  const observedWheres: Array<Record<string, unknown>> = [];
  setupMocks(observedWheres);
  try {
    const app = express();
    app.use("/", messageRoutes);
    const res = await requestAs(app, "");
    assert.equal(res.status, 200);
    assert.equal(observedWheres[0].status, undefined);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.school.findUnique = original.schoolFindUnique;
    prismaClient.interventionCase.findMany = original.caseFindMany;
  }
});
