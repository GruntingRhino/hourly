import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import prisma from "../src/lib/prisma";
import selfSubmissionRoutes from "../src/routes/selfSubmissions";

// Regression test for a gap surfaced while converting SelfSubmittedRequest.status
// to a real Prisma enum: GET /api/self-submissions read
// `req.query.status as string | undefined` and passed any string straight
// into the Prisma where clause. A bad ?status= value previously fell through
// to an empty result instead of being rejected with a 400.

const prismaClient = prisma as any;

const schoolAdmin = {
  id: "admin-1",
  email: "admin@example.test",
  role: "SCHOOL_ADMIN",
  status: "ACTIVE",
  tokenVersion: 0,
  schoolId: "school-a",
  emailVerified: true, eligibilityAttestation: { eligible13Plus: true },
  school: { verified: true, ownershipStatus: "APPROVED" },
  assignedCohorts: [],
};

async function requestAs(app: express.Express, query: string) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const token = jwt.sign({ userId: schoolAdmin.id, email: schoolAdmin.email, role: schoolAdmin.role, tv: 0 }, process.env.JWT_SECRET!);
    return await fetch(`http://127.0.0.1:${address.port}/${query}`, {
      headers: { authorization: `Bearer ${token}` },
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

function setupMocks(observedWheres: Array<Record<string, unknown>>) {
  prismaClient.user.findUnique = async ({ where }: any) => (where.id === schoolAdmin.id ? schoolAdmin : null);
  prismaClient.selfSubmittedRequest.findMany = async ({ where }: any) => {
    observedWheres.push(where ?? {});
    return [];
  };
}

test("GET /api/self-submissions rejects an invalid status query filter", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    findMany: prismaClient.selfSubmittedRequest.findMany,
  };
  const observedWheres: Array<Record<string, unknown>> = [];
  setupMocks(observedWheres);
  try {
    const app = express();
    app.use("/", selfSubmissionRoutes);
    const res = await requestAs(app, "?status=BOGUS");
    assert.equal(res.status, 400);
    assert.equal(observedWheres.length, 0);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.selfSubmittedRequest.findMany = original.findMany;
  }
});

test("GET /api/self-submissions accepts a valid status query filter, including CANCELLED", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    findMany: prismaClient.selfSubmittedRequest.findMany,
  };
  const observedWheres: Array<Record<string, unknown>> = [];
  setupMocks(observedWheres);
  try {
    const app = express();
    app.use("/", selfSubmissionRoutes);
    const res = await requestAs(app, "?status=CANCELLED");
    assert.equal(res.status, 200);
    assert.equal(observedWheres[0].status, "CANCELLED");
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.selfSubmittedRequest.findMany = original.findMany;
  }
});

test("GET /api/self-submissions with no status query applies no status filter", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    findMany: prismaClient.selfSubmittedRequest.findMany,
  };
  const observedWheres: Array<Record<string, unknown>> = [];
  setupMocks(observedWheres);
  try {
    const app = express();
    app.use("/", selfSubmissionRoutes);
    const res = await requestAs(app, "");
    assert.equal(res.status, 200);
    assert.equal(observedWheres[0].status, undefined);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.selfSubmittedRequest.findMany = original.findMany;
  }
});
