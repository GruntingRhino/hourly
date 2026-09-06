import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import prisma from "../src/lib/prisma";
import savedRoutes from "../src/routes/saved";

const prismaClient = prisma as any;

const student = { id: "student-1", email: "student@example.test", role: "STUDENT" };

async function requestAs(app: express.Express, method: "GET" | "POST", path: string, body?: unknown) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const token = jwt.sign({ userId: student.id, email: student.email, role: student.role, tv: 0 }, process.env.JWT_SECRET!);
    return await fetch(`http://127.0.0.1:${address.port}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

function setupMocks() {
  prismaClient.user.findUnique = async ({ where }: any) =>
    where.id === student.id
      ? { id: student.id, email: student.email, role: student.role, status: "ACTIVE", tokenVersion: 0, emailVerified: true, eligibilityAttestation: { eligible13Plus: true }, school: null }
      : null;
}

test("POST /api/saved rejects a status value outside SAVED/SKIPPED/DISCARDED", async () => {
  const original = { userFindUnique: prismaClient.user.findUnique };
  setupMocks();
  try {
    const app = express();
    app.use(express.json());
    app.use("/api/saved", savedRoutes);
    const res = await requestAs(app, "POST", "/api/saved", { opportunityId: "opp-1", status: "NOT_A_REAL_STATUS" });
    assert.equal(res.status, 400);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
  }
});

test("POST /api/saved rejects a missing opportunityId", async () => {
  const original = { userFindUnique: prismaClient.user.findUnique };
  setupMocks();
  try {
    const app = express();
    app.use(express.json());
    app.use("/api/saved", savedRoutes);
    const res = await requestAs(app, "POST", "/api/saved", { status: "SAVED" });
    assert.equal(res.status, 400);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
  }
});

test("POST /api/saved accepts a valid status and defaults to SAVED when omitted", async () => {
  const original = { userFindUnique: prismaClient.user.findUnique, upsert: prismaClient.savedOpportunity.upsert };
  setupMocks();
  let capturedData: any = null;
  prismaClient.savedOpportunity.upsert = async ({ create }: any) => {
    capturedData = create;
    return { id: "saved-1", ...create };
  };

  try {
    const app = express();
    app.use(express.json());
    app.use("/api/saved", savedRoutes);
    const res = await requestAs(app, "POST", "/api/saved", { opportunityId: "opp-1" });
    assert.equal(res.status, 200);
    assert.equal(capturedData.status, "SAVED");
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.savedOpportunity.upsert = original.upsert;
  }
});

test("GET /api/saved rejects an invalid status query filter", async () => {
  const original = { userFindUnique: prismaClient.user.findUnique };
  setupMocks();
  try {
    const app = express();
    app.use(express.json());
    app.use("/api/saved", savedRoutes);
    const res = await requestAs(app, "GET", "/api/saved?status=BOGUS");
    assert.equal(res.status, 400);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
  }
});

test("GET /api/saved accepts a valid status query filter", async () => {
  const original = { userFindUnique: prismaClient.user.findUnique, findMany: prismaClient.savedOpportunity.findMany };
  setupMocks();
  let capturedWhere: any = null;
  prismaClient.savedOpportunity.findMany = async ({ where }: any) => {
    capturedWhere = where;
    return [];
  };
  try {
    const app = express();
    app.use(express.json());
    app.use("/api/saved", savedRoutes);
    const res = await requestAs(app, "GET", "/api/saved?status=SKIPPED");
    assert.equal(res.status, 200);
    assert.equal(capturedWhere.status, "SKIPPED");
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.savedOpportunity.findMany = original.findMany;
  }
});
