import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import prisma from "../src/lib/prisma";
import beneficiaryRoutes from "../src/routes/beneficiaries";

// Regression test for a gap surfaced while converting SchoolBeneficiaryApproval.status
// to a real Prisma enum: GET /api/beneficiaries read req.query.status as an
// unvalidated string and passed it straight into the Prisma where clause.
// A SCHOOL_ADMIN could pass any garbage value (e.g. ?status=BOGUS) and it
// would previously fall through to Prisma as a plain string filter, silently
// returning an empty array instead of surfacing the bad input.

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
};

async function requestAs(app: express.Express, statusQuery: string | undefined) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const token = jwt.sign({ userId: schoolAdmin.id, email: schoolAdmin.email, role: schoolAdmin.role, tv: 0 }, process.env.JWT_SECRET!);
    const path = statusQuery === undefined ? "/" : `/?status=${encodeURIComponent(statusQuery)}`;
    return await fetch(`http://127.0.0.1:${address.port}${path}`, {
      headers: { authorization: `Bearer ${token}` },
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

function setupMocks(observedWheres: Array<Record<string, unknown>>) {
  prismaClient.user.findUnique = async ({ where }: any) =>
    where.id === schoolAdmin.id ? schoolAdmin : null;
  prismaClient.schoolBeneficiaryApproval.findMany = async ({ where }: any) => {
    observedWheres.push(where);
    return [];
  };
  prismaClient.beneficiaryInvitation.findMany = async () => [];
}

test("GET /api/beneficiaries rejects an invalid status query filter", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    approvalFindMany: prismaClient.schoolBeneficiaryApproval.findMany,
    invitationFindMany: prismaClient.beneficiaryInvitation.findMany,
  };
  const observedWheres: Array<Record<string, unknown>> = [];
  setupMocks(observedWheres);
  try {
    const app = express();
    app.use(beneficiaryRoutes);
    const res = await requestAs(app, "BOGUS");
    assert.equal(res.status, 400);
    assert.equal(observedWheres.length, 0);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.schoolBeneficiaryApproval.findMany = original.approvalFindMany;
    prismaClient.beneficiaryInvitation.findMany = original.invitationFindMany;
  }
});

test("GET /api/beneficiaries accepts a valid status query filter", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    approvalFindMany: prismaClient.schoolBeneficiaryApproval.findMany,
    invitationFindMany: prismaClient.beneficiaryInvitation.findMany,
  };
  const observedWheres: Array<Record<string, unknown>> = [];
  setupMocks(observedWheres);
  try {
    const app = express();
    app.use(beneficiaryRoutes);
    const res = await requestAs(app, "REJECTED");
    assert.equal(res.status, 200);
    assert.equal(observedWheres[0].status, "REJECTED");
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.schoolBeneficiaryApproval.findMany = original.approvalFindMany;
    prismaClient.beneficiaryInvitation.findMany = original.invitationFindMany;
  }
});

test("GET /api/beneficiaries?status=ALL is treated as no filter", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    approvalFindMany: prismaClient.schoolBeneficiaryApproval.findMany,
    invitationFindMany: prismaClient.beneficiaryInvitation.findMany,
  };
  const observedWheres: Array<Record<string, unknown>> = [];
  setupMocks(observedWheres);
  try {
    const app = express();
    app.use(beneficiaryRoutes);
    const res = await requestAs(app, "ALL");
    assert.equal(res.status, 200);
    assert.equal(observedWheres[0].status, undefined);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.schoolBeneficiaryApproval.findMany = original.approvalFindMany;
    prismaClient.beneficiaryInvitation.findMany = original.invitationFindMany;
  }
});
