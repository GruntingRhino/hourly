import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import prisma from "../src/lib/prisma";
import opportunityRoutes from "../src/routes/opportunities";

// Regression tests for two gaps surfaced while converting Opportunity.status
// to a real Prisma enum:
//
// 1. GET /api/opportunities (public, unauthenticated) read
//    `status: (status as string) || "ACTIVE"` and passed any string straight
//    into the Prisma where clause.
// 2. PUT /api/opportunities/:id (ORG_ADMIN) built its update payload via
//    `{ ...req.body }` with no validation — a mass-assignment gap that let a
//    caller set arbitrary Opportunity fields (e.g. organizationId).

const prismaClient = prisma as any;

const orgAdmin = {
  id: "org-admin-1",
  email: "orgadmin@example.test",
  role: "ORG_ADMIN",
  status: "ACTIVE",
  tokenVersion: 0,
  organizationId: "org-a",
  emailVerified: true, eligibilityAttestation: { eligible13Plus: true },
};

async function requestAs(app: express.Express, method: "GET" | "PUT", path: string, body?: unknown, asUser: boolean = true) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (asUser) {
      const token = jwt.sign({ userId: orgAdmin.id, email: orgAdmin.email, role: orgAdmin.role, tv: 0 }, process.env.JWT_SECRET!);
      headers.authorization = `Bearer ${token}`;
    }
    return await fetch(`http://127.0.0.1:${address.port}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test("GET /api/opportunities rejects an invalid status query filter", async () => {
  const original = prismaClient.opportunity.findMany;
  const observedWheres: Array<Record<string, unknown>> = [];
  prismaClient.opportunity.findMany = async ({ where }: any) => {
    observedWheres.push(where ?? {});
    return [];
  };
  try {
    const app = express();
    app.use(express.json());
    app.use("/", opportunityRoutes);
    const res = await requestAs(app, "GET", "/?status=BOGUS", undefined, false);
    assert.equal(res.status, 400);
    assert.equal(observedWheres.length, 0);
  } finally {
    prismaClient.opportunity.findMany = original;
  }
});

test("GET /api/opportunities accepts a valid status query filter", async () => {
  const original = prismaClient.opportunity.findMany;
  const observedWheres: Array<Record<string, unknown>> = [];
  prismaClient.opportunity.findMany = async ({ where }: any) => {
    observedWheres.push(where ?? {});
    return [];
  };
  try {
    const app = express();
    app.use(express.json());
    app.use("/", opportunityRoutes);
    const res = await requestAs(app, "GET", "/?status=COMPLETED", undefined, false);
    assert.equal(res.status, 200);
    assert.equal(observedWheres[0].status, "COMPLETED");
  } finally {
    prismaClient.opportunity.findMany = original;
  }
});

// §18 legacy model consolidation (later session) froze every ORG_ADMIN
// write route on this file, including this one, at the API layer — so the
// mass-assignment whitelist this test used to exercise below is no longer
// reachable via HTTP at all (blockFrozenLegacyOrgAdminWrite runs first and
// never calls next()). The whitelist logic itself is left in the route
// body as harmless defense-in-depth rather than removed, in case the
// freeze is ever lifted, but this test now documents and asserts the
// current, actual behavior: the route returns 410 before ever touching
// the database or the whitelist logic.
test("PUT /api/opportunities/:id is frozen for ORG_ADMIN (legacy write, §18)", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    oppFindUnique: prismaClient.opportunity.findUnique,
    transaction: prismaClient.$transaction,
  };
  let transactionCalled = false;
  prismaClient.user.findUnique = async ({ where }: any) => (where.id === orgAdmin.id ? orgAdmin : null);
  prismaClient.opportunity.findUnique = async () => ({
    id: "opp-1",
    organizationId: orgAdmin.organizationId,
    address: null,
  });
  prismaClient.$transaction = async () => {
    transactionCalled = true;
    throw new Error("should never be reached — the freeze runs before this");
  };
  try {
    const app = express();
    app.use(express.json());
    app.use("/", opportunityRoutes);
    const res = await requestAs(app, "PUT", "/opp-1", {
      organizationId: "someone-elses-org",
      status: "COMPLETED",
      title: "Renamed",
    });
    assert.equal(res.status, 410);
    const body = await res.json();
    assert.equal(body.code, "LEGACY_ORG_ADMIN_FROZEN");
    assert.equal(transactionCalled, false);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.opportunity.findUnique = original.oppFindUnique;
    prismaClient.$transaction = original.transaction;
  }
});
