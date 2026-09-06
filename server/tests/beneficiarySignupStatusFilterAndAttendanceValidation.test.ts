import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import prisma from "../src/lib/prisma";
import beneficiaryRoutes from "../src/routes/beneficiaries";

// Regression tests for two gaps surfaced while converting
// BeneficiarySignup.status/.verificationStatus/.attendance to real Prisma
// enums:
//
// 1. GET /api/beneficiaries/:id/signups read `req.query.status as string`
//    and passed it straight into a verificationStatus Prisma filter.
// 2. POST /:id/opportunities/:oppId/attendance validated `attendance` with
//    a manual Set.has() check instead of a Zod schema.

const prismaClient = prisma as any;

const beneficiaryAdmin = {
  id: "ben-admin-1",
  email: "benadmin@example.test",
  role: "BENEFICIARY_ADMIN",
  status: "ACTIVE",
  tokenVersion: 0,
  beneficiaryId: "ben-1",
  beneficiaryAdminRole: "OWNER",
  emailVerified: true, eligibilityAttestation: { eligible13Plus: true },
};

async function requestAs(app: express.Express, method: "GET" | "POST", path: string, body?: unknown) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const token = jwt.sign({ userId: beneficiaryAdmin.id, email: beneficiaryAdmin.email, role: beneficiaryAdmin.role, tv: 0 }, process.env.JWT_SECRET!);
    return await fetch(`http://127.0.0.1:${address.port}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test("GET /:id/signups rejects an invalid status query filter", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    findMany: prismaClient.beneficiarySignup.findMany,
  };
  const observedWheres: Array<Record<string, unknown>> = [];
  prismaClient.user.findUnique = async ({ where }: any) => (where.id === beneficiaryAdmin.id ? beneficiaryAdmin : null);
  prismaClient.beneficiarySignup.findMany = async ({ where }: any) => {
    observedWheres.push(where ?? {});
    return [];
  };
  try {
    const app = express();
    app.use(express.json());
    app.use("/", beneficiaryRoutes);
    const res = await requestAs(app, "GET", "/ben-1/signups?status=BOGUS");
    assert.equal(res.status, 400);
    assert.equal(observedWheres.length, 0);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.beneficiarySignup.findMany = original.findMany;
  }
});

test("GET /:id/signups accepts a valid status query filter", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    findMany: prismaClient.beneficiarySignup.findMany,
    dataAccessLogCreate: prismaClient.dataAccessLog.create,
  };
  const observedWheres: Array<Record<string, unknown>> = [];
  prismaClient.user.findUnique = async ({ where }: any) => (where.id === beneficiaryAdmin.id ? beneficiaryAdmin : null);
  prismaClient.beneficiarySignup.findMany = async ({ where }: any) => {
    observedWheres.push(where ?? {});
    return [];
  };
  prismaClient.dataAccessLog.create = async () => ({});
  try {
    const app = express();
    app.use(express.json());
    app.use("/", beneficiaryRoutes);
    const res = await requestAs(app, "GET", "/ben-1/signups?status=PENDING");
    assert.equal(res.status, 200);
    assert.equal(observedWheres[0].verificationStatus, "PENDING");
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.beneficiarySignup.findMany = original.findMany;
    prismaClient.dataAccessLog.create = original.dataAccessLogCreate;
  }
});

test("POST /:id/opportunities/:oppId/attendance rejects an invalid attendance value", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    oppFindUnique: prismaClient.beneficiaryOpportunity.findUnique,
    signupFindMany: prismaClient.beneficiarySignup.findMany,
  };
  prismaClient.user.findUnique = async ({ where }: any) => (where.id === beneficiaryAdmin.id ? beneficiaryAdmin : null);
  prismaClient.beneficiaryOpportunity.findUnique = async () => ({ id: "opp-1", beneficiaryId: "ben-1" });
  prismaClient.beneficiarySignup.findMany = async () => [];
  try {
    const app = express();
    app.use(express.json());
    app.use("/", beneficiaryRoutes);
    const res = await requestAs(app, "POST", "/ben-1/opportunities/opp-1/attendance", {
      records: [{ signupId: "signup-1", attendance: "MAYBE" }],
    });
    assert.equal(res.status, 400);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.beneficiaryOpportunity.findUnique = original.oppFindUnique;
    prismaClient.beneficiarySignup.findMany = original.signupFindMany;
  }
});
