import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import prisma from "../src/lib/prisma";
import reportRoutes from "../src/routes/reports";

// Regression test for §12 (reports must return PARTIAL/UNAVAILABLE rather
// than misleading zeros on partial data-source failure): GET
// /api/reports/export/csv fetched serviceSession/beneficiarySignup/
// selfSubmittedRequest via Promise.all — if any one source rejected, the
// whole request 500'd even though the other two sources had real data. If
// all three ever succeeded but with less data than expected due to a
// masked failure, the exported CSV — a student's official hours record —
// would have looked complete while silently missing hours. Fixed with
// Promise.allSettled, a warning row when some (not all) sources fail, and a
// 503 (not an empty "0 hours" CSV) when every source fails.

const prismaClient = prisma as any;

const student = {
  id: "student-1",
  email: "student@example.test",
  role: "STUDENT",
  status: "ACTIVE",
  tokenVersion: 0,
  emailVerified: true, eligibilityAttestation: { eligible13Plus: true },
};

async function requestAsStudent(app: express.Express) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const token = jwt.sign({ userId: student.id, email: student.email, role: student.role, tv: 0 }, process.env.JWT_SECRET!);
    return await fetch(`http://127.0.0.1:${(address as any).port}/export/csv`, {
      headers: { authorization: `Bearer ${token}` },
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

function baseMocks() {
  prismaClient.user.findUnique = async ({ where }: any) => (where.id === student.id ? student : null);
  prismaClient.dataAccessLog.create = async () => ({});
}

test("GET /export/csv still exports the other two sources when one source fails", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    dataAccessLogCreate: prismaClient.dataAccessLog.create,
    sessionFindMany: prismaClient.serviceSession.findMany,
    benSignupFindMany: prismaClient.beneficiarySignup.findMany,
    selfSubFindMany: prismaClient.selfSubmittedRequest.findMany,
  };
  baseMocks();
  prismaClient.serviceSession.findMany = async () => { throw new Error("transient DB error"); };
  prismaClient.beneficiarySignup.findMany = async () => [];
  prismaClient.selfSubmittedRequest.findMany = async () => [
    { date: new Date("2026-01-15"), organizationName: "Food Bank", hours: 3 },
  ];
  try {
    const app = express();
    app.use("/", reportRoutes);
    const res = await requestAsStudent(app);
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.match(body, /Food Bank/);
    assert.match(body, /WARNING: this export is incomplete/);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.dataAccessLog.create = original.dataAccessLogCreate;
    prismaClient.serviceSession.findMany = original.sessionFindMany;
    prismaClient.beneficiarySignup.findMany = original.benSignupFindMany;
    prismaClient.selfSubmittedRequest.findMany = original.selfSubFindMany;
  }
});

test("GET /export/csv returns 503 (not an empty CSV) when every source fails", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    dataAccessLogCreate: prismaClient.dataAccessLog.create,
    sessionFindMany: prismaClient.serviceSession.findMany,
    benSignupFindMany: prismaClient.beneficiarySignup.findMany,
    selfSubFindMany: prismaClient.selfSubmittedRequest.findMany,
  };
  baseMocks();
  prismaClient.serviceSession.findMany = async () => { throw new Error("db down"); };
  prismaClient.beneficiarySignup.findMany = async () => { throw new Error("db down"); };
  prismaClient.selfSubmittedRequest.findMany = async () => { throw new Error("db down"); };
  try {
    const app = express();
    app.use("/", reportRoutes);
    const res = await requestAsStudent(app);
    assert.equal(res.status, 503);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.dataAccessLog.create = original.dataAccessLogCreate;
    prismaClient.serviceSession.findMany = original.sessionFindMany;
    prismaClient.beneficiarySignup.findMany = original.benSignupFindMany;
    prismaClient.selfSubmittedRequest.findMany = original.selfSubFindMany;
  }
});

test("GET /export/csv succeeds normally with no warning when all sources succeed", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    dataAccessLogCreate: prismaClient.dataAccessLog.create,
    sessionFindMany: prismaClient.serviceSession.findMany,
    benSignupFindMany: prismaClient.beneficiarySignup.findMany,
    selfSubFindMany: prismaClient.selfSubmittedRequest.findMany,
  };
  baseMocks();
  prismaClient.serviceSession.findMany = async () => [];
  prismaClient.beneficiarySignup.findMany = async () => [];
  prismaClient.selfSubmittedRequest.findMany = async () => [];
  try {
    const app = express();
    app.use("/", reportRoutes);
    const res = await requestAsStudent(app);
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.doesNotMatch(body, /WARNING/);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.dataAccessLog.create = original.dataAccessLogCreate;
    prismaClient.serviceSession.findMany = original.sessionFindMany;
    prismaClient.beneficiarySignup.findMany = original.benSignupFindMany;
    prismaClient.selfSubmittedRequest.findMany = original.selfSubFindMany;
  }
});
