import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import prisma from "../src/lib/prisma";
import billingRoutes from "../src/routes/billing";

// Regression test for a gap surfaced while converting
// OrganizationInvoiceRequest.status to a real Prisma enum: GET
// /internal/invoice-requests read req.query.status via
// z.string().trim().min(1) (any non-empty string) and passed it straight
// into the Prisma where clause. A bad ?status= value previously fell
// through to an empty result instead of being rejected.

const prismaClient = prisma as any;

// isInternalAdminUser() treats a SCHOOL_ADMIN as an internal admin in
// non-publicly-deployed environments (see lib/internalAdmin.ts), which is
// exactly the local/test environment this suite runs in.
const internalAdmin = {
  id: "admin-1",
  email: "admin@example.test",
  role: "SCHOOL_ADMIN",
  status: "ACTIVE",
  tokenVersion: 0,
  emailVerified: true, eligibilityAttestation: { eligible13Plus: true },
  school: { verified: true, ownershipStatus: "APPROVED" },
};

async function requestAs(app: express.Express, query: string) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const token = jwt.sign({ userId: internalAdmin.id, email: internalAdmin.email, role: internalAdmin.role, tv: 0 }, process.env.JWT_SECRET!);
    return await fetch(`http://127.0.0.1:${address.port}/internal/invoice-requests${query}`, {
      headers: { authorization: `Bearer ${token}` },
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

function setupMocks(observedWheres: Array<Record<string, unknown>>) {
  prismaClient.user.findUnique = async ({ where }: any) =>
    where.id === internalAdmin.id ? internalAdmin : null;
  prismaClient.organizationInvoiceRequest.findMany = async ({ where }: any) => {
    observedWheres.push(where ?? {});
    return [];
  };
}

test("GET /internal/invoice-requests rejects an invalid status query filter", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    findMany: prismaClient.organizationInvoiceRequest.findMany,
  };
  const observedWheres: Array<Record<string, unknown>> = [];
  setupMocks(observedWheres);
  try {
    const app = express();
    app.use("/", billingRoutes);
    const res = await requestAs(app, "?status=BOGUS");
    assert.equal(res.status, 400);
    assert.equal(observedWheres.length, 0);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.organizationInvoiceRequest.findMany = original.findMany;
  }
});

test("GET /internal/invoice-requests accepts a valid status query filter", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    findMany: prismaClient.organizationInvoiceRequest.findMany,
  };
  const observedWheres: Array<Record<string, unknown>> = [];
  setupMocks(observedWheres);
  try {
    const app = express();
    app.use("/", billingRoutes);
    const res = await requestAs(app, "?status=REJECTED");
    assert.equal(res.status, 200);
    assert.equal(observedWheres[0].status, "REJECTED");
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.organizationInvoiceRequest.findMany = original.findMany;
  }
});

test("GET /internal/invoice-requests with no status query applies no status filter", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    findMany: prismaClient.organizationInvoiceRequest.findMany,
  };
  const observedWheres: Array<Record<string, unknown>> = [];
  setupMocks(observedWheres);
  try {
    const app = express();
    app.use("/", billingRoutes);
    const res = await requestAs(app, "");
    assert.equal(res.status, 200);
    assert.equal(observedWheres[0].status, undefined);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.organizationInvoiceRequest.findMany = original.findMany;
  }
});
