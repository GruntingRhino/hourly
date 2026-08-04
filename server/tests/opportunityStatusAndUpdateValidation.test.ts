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
  emailVerified: true,
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

test("PUT /api/opportunities/:id strips fields outside the edit whitelist instead of mass-assigning them", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    oppFindUnique: prismaClient.opportunity.findUnique,
    transaction: prismaClient.$transaction,
  };
  prismaClient.user.findUnique = async ({ where }: any) => (where.id === orgAdmin.id ? orgAdmin : null);
  prismaClient.opportunity.findUnique = async () => ({
    id: "opp-1",
    organizationId: orgAdmin.organizationId,
    address: null,
  });
  const observedUpdateData: Array<Record<string, unknown>> = [];
  // runSerializableTransaction (src/lib/serializableTransaction.ts) calls
  // prisma.$transaction(fn, { isolationLevel: "Serializable" }); stub it to
  // hand the route's callback a fake tx client so we can capture the exact
  // `data` object it passes to opportunity.update.
  prismaClient.$transaction = async (fn: any) => {
    const tx = {
      $executeRaw: async () => undefined,
      signup: { count: async () => 0 },
      opportunity: {
        update: async ({ data }: any) => {
          observedUpdateData.push(data);
          return { id: "opp-1", ...data };
        },
      },
    };
    return fn(tx);
  };
  try {
    const app = express();
    app.use(express.json());
    app.use("/", opportunityRoutes);
    // organizationId and status are not part of createSchema's field
    // whitelist, so a caller sending them in the PUT body must not be able
    // to move the opportunity to another org or force its status.
    const res = await requestAs(app, "PUT", "/opp-1", {
      organizationId: "someone-elses-org",
      status: "COMPLETED",
      title: "Renamed",
    });
    assert.equal(res.status, 200);
    assert.equal(observedUpdateData.length, 1);
    assert.equal(observedUpdateData[0].organizationId, undefined);
    assert.equal(observedUpdateData[0].status, undefined);
    assert.equal(observedUpdateData[0].title, "Renamed");
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.opportunity.findUnique = original.oppFindUnique;
    prismaClient.$transaction = original.transaction;
  }
});
