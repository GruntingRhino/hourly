import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import prisma from "../src/lib/prisma";
import beneficiaryRoutes from "../src/routes/beneficiaries";

const prismaClient = prisma as any;

const benAdmin = { id: "ben-admin-1", email: "admin@example.test", role: "BENEFICIARY_ADMIN", beneficiaryId: "beneficiary-1" };

async function requestAs(app: express.Express, path: string, body: unknown) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const token = jwt.sign({ userId: benAdmin.id, email: benAdmin.email, role: benAdmin.role, tv: 0 }, process.env.JWT_SECRET!);
    return await fetch(`http://127.0.0.1:${address.port}${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

const PAST_SLOT = { date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), endTime: "10:00" };
const FUTURE_SLOT = { date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), endTime: "10:00" };

function setupMocks(signups: Array<{ id: string; status: string; slot?: { date: Date; endTime: string } }>) {
  prismaClient.user.findUnique = async ({ where }: any) =>
    where.id === benAdmin.id
      ? { id: benAdmin.id, email: benAdmin.email, role: benAdmin.role, status: "ACTIVE", tokenVersion: 0, beneficiaryId: benAdmin.beneficiaryId, emailVerified: true, eligibilityAttestation: { eligible13Plus: true }, school: null }
      : null;
  prismaClient.beneficiaryOpportunity.findUnique = async () => ({ beneficiaryId: benAdmin.beneficiaryId });
  prismaClient.beneficiarySignup.findMany = async () =>
    signups.map((s) => ({ id: s.id, status: s.status, slot: s.slot ?? PAST_SLOT }));
  prismaClient.$transaction = async (fn: any) => {
    const updateCalls: any[] = [];
    const tx = {
      beneficiarySignup: {
        update: async (args: any) => {
          updateCalls.push(args);
          return { id: args.where.id, ...args.data };
        },
      },
      beneficiaryAuditLog: { create: async () => ({}) },
    };
    const result = await fn(tx);
    (prismaClient as any)._lastUpdateCalls = updateCalls;
    return result;
  };
}

test("batch attendance rejects more than 200 records", async () => {
  const original = { userFindUnique: prismaClient.user.findUnique, oppFindUnique: prismaClient.beneficiaryOpportunity.findUnique };
  setupMocks([]);
  try {
    const app = express();
    app.use(express.json());
    app.use("/api/beneficiaries", beneficiaryRoutes);
    const records = Array.from({ length: 201 }, (_, i) => ({ signupId: `signup-${i}`, attendance: "ATTENDED" }));
    const res = await requestAs(app, "/api/beneficiaries/beneficiary-1/opportunities/opp-1/attendance", { records });
    assert.equal(res.status, 400);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.beneficiaryOpportunity.findUnique = original.oppFindUnique;
  }
});

test("batch attendance rejects duplicate signupIds", async () => {
  const original = { userFindUnique: prismaClient.user.findUnique, oppFindUnique: prismaClient.beneficiaryOpportunity.findUnique };
  setupMocks([]);
  try {
    const app = express();
    app.use(express.json());
    app.use("/api/beneficiaries", beneficiaryRoutes);
    const res = await requestAs(app, "/api/beneficiaries/beneficiary-1/opportunities/opp-1/attendance", {
      records: [
        { signupId: "signup-1", attendance: "ATTENDED" },
        { signupId: "signup-1", attendance: "NO_SHOW" },
      ],
    });
    assert.equal(res.status, 400);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.beneficiaryOpportunity.findUnique = original.oppFindUnique;
  }
});

test("marking a signup NO_SHOW through the batch route keeps status in sync with attendance", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    oppFindUnique: prismaClient.beneficiaryOpportunity.findUnique,
    signupFindMany: prismaClient.beneficiarySignup.findMany,
    transaction: prismaClient.$transaction,
  };
  setupMocks([{ id: "signup-1", status: "CONFIRMED" }]);
  try {
    const app = express();
    app.use(express.json());
    app.use("/api/beneficiaries", beneficiaryRoutes);
    const res = await requestAs(app, "/api/beneficiaries/beneficiary-1/opportunities/opp-1/attendance", {
      records: [{ signupId: "signup-1", attendance: "NO_SHOW" }],
    });
    assert.equal(res.status, 200);
    const calls = (prismaClient as any)._lastUpdateCalls;
    assert.equal(calls.length, 1);
    assert.equal(calls[0].data.attendance, "NO_SHOW");
    // This is the core bug: previously only `attendance` was set, leaving
    // `status` at "CONFIRMED" — which meant the hour-approval route's
    // NO_SHOW override requirement never applied to signups marked
    // no-show through this batch endpoint.
    assert.equal(calls[0].data.status, "NO_SHOW", "status must be kept in sync with attendance");
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.beneficiaryOpportunity.findUnique = original.oppFindUnique;
    prismaClient.beneficiarySignup.findMany = original.signupFindMany;
    prismaClient.$transaction = original.transaction;
  }
});

test("marking NO_SHOW before the event has ended is rejected without an early override", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    oppFindUnique: prismaClient.beneficiaryOpportunity.findUnique,
    signupFindMany: prismaClient.beneficiarySignup.findMany,
    transaction: prismaClient.$transaction,
  };
  setupMocks([{ id: "signup-1", status: "CONFIRMED", slot: FUTURE_SLOT }]);
  try {
    const app = express();
    app.use(express.json());
    app.use("/api/beneficiaries", beneficiaryRoutes);
    const res = await requestAs(app, "/api/beneficiaries/beneficiary-1/opportunities/opp-1/attendance", {
      records: [{ signupId: "signup-1", attendance: "NO_SHOW" }],
    });
    assert.equal(res.status, 400);
    const body = await res.json() as { earlyOverrideRequired?: boolean };
    assert.equal(body.earlyOverrideRequired, true);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.beneficiaryOpportunity.findUnique = original.oppFindUnique;
    prismaClient.beneficiarySignup.findMany = original.signupFindMany;
    prismaClient.$transaction = original.transaction;
  }
});

test("marking NO_SHOW before the event has ended succeeds with earlyOverride + reason", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    oppFindUnique: prismaClient.beneficiaryOpportunity.findUnique,
    signupFindMany: prismaClient.beneficiarySignup.findMany,
    transaction: prismaClient.$transaction,
  };
  setupMocks([{ id: "signup-1", status: "CONFIRMED", slot: FUTURE_SLOT }]);
  try {
    const app = express();
    app.use(express.json());
    app.use("/api/beneficiaries", beneficiaryRoutes);
    const res = await requestAs(app, "/api/beneficiaries/beneficiary-1/opportunities/opp-1/attendance", {
      records: [{ signupId: "signup-1", attendance: "NO_SHOW" }],
      earlyOverride: true,
      earlyOverrideReason: "Student called to cancel in advance.",
    });
    assert.equal(res.status, 200);
    const calls = (prismaClient as any)._lastUpdateCalls;
    assert.equal(calls[0].data.status, "NO_SHOW");
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.beneficiaryOpportunity.findUnique = original.oppFindUnique;
    prismaClient.beneficiarySignup.findMany = original.signupFindMany;
    prismaClient.$transaction = original.transaction;
  }
});

test("marking ATTENDED before the event has ended does not require the early override", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    oppFindUnique: prismaClient.beneficiaryOpportunity.findUnique,
    signupFindMany: prismaClient.beneficiarySignup.findMany,
    transaction: prismaClient.$transaction,
  };
  setupMocks([{ id: "signup-1", status: "CONFIRMED", slot: FUTURE_SLOT }]);
  try {
    const app = express();
    app.use(express.json());
    app.use("/api/beneficiaries", beneficiaryRoutes);
    const res = await requestAs(app, "/api/beneficiaries/beneficiary-1/opportunities/opp-1/attendance", {
      records: [{ signupId: "signup-1", attendance: "ATTENDED" }],
    });
    assert.equal(res.status, 200);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.beneficiaryOpportunity.findUnique = original.oppFindUnique;
    prismaClient.beneficiarySignup.findMany = original.signupFindMany;
    prismaClient.$transaction = original.transaction;
  }
});

test("batch attendance skips cancelled and waitlisted signups instead of overwriting them", async () => {
  const original = {
    userFindUnique: prismaClient.user.findUnique,
    oppFindUnique: prismaClient.beneficiaryOpportunity.findUnique,
    signupFindMany: prismaClient.beneficiarySignup.findMany,
    transaction: prismaClient.$transaction,
  };
  setupMocks([
    { id: "signup-cancelled", status: "CANCELLED" },
    { id: "signup-waitlisted", status: "WAITLISTED" },
    { id: "signup-confirmed", status: "CONFIRMED" },
  ]);
  try {
    const app = express();
    app.use(express.json());
    app.use("/api/beneficiaries", beneficiaryRoutes);
    const res = await requestAs(app, "/api/beneficiaries/beneficiary-1/opportunities/opp-1/attendance", {
      records: [
        { signupId: "signup-cancelled", attendance: "ATTENDED" },
        { signupId: "signup-waitlisted", attendance: "ATTENDED" },
        { signupId: "signup-confirmed", attendance: "ATTENDED" },
      ],
    });
    assert.equal(res.status, 200);
    const body = await res.json() as { updated: number };
    assert.equal(body.updated, 1);
    const calls = (prismaClient as any)._lastUpdateCalls;
    assert.equal(calls.length, 1);
    assert.equal(calls[0].where.id, "signup-confirmed");
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.beneficiaryOpportunity.findUnique = original.oppFindUnique;
    prismaClient.beneficiarySignup.findMany = original.signupFindMany;
    prismaClient.$transaction = original.transaction;
  }
});
