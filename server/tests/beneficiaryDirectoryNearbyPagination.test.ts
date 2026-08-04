import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import prisma from "../src/lib/prisma";
import beneficiaryRoutes from "../src/routes/beneficiaries";

const prismaClient = prisma as any;

const schoolAdmin = { id: "admin-1", email: "admin@example.test", role: "SCHOOL_ADMIN", schoolId: "school-a" };

async function requestAs(app: express.Express, path: string) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const token = jwt.sign({ userId: schoolAdmin.id, email: schoolAdmin.email, role: schoolAdmin.role, tv: 0 }, process.env.JWT_SECRET!);
    return await fetch(`http://127.0.0.1:${address.port}${path}`, { headers: { authorization: `Bearer ${token}` } });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

function setupMocks() {
  prismaClient.user.findUnique = async ({ where }: any) =>
    where.id === schoolAdmin.id
      ? {
          id: schoolAdmin.id, email: schoolAdmin.email, role: schoolAdmin.role, status: "ACTIVE", tokenVersion: 0,
          schoolId: schoolAdmin.schoolId, emailVerified: true, school: { verified: true, ownershipStatus: "APPROVED" },
        }
      : null;
  let queryCount = 0;
  prismaClient.$queryRawUnsafe = async (sql: string) => {
    queryCount += 1;
    // Any query text containing the literal string "NaN" proves an invalid
    // page/limit value reached raw SQL instead of being rejected up front.
    assert.doesNotMatch(sql, /NaN/, "invalid pagination value leaked into raw SQL");
    if (sql.includes("COUNT(*)")) return [{ total: 0 }];
    return [];
  };
  return () => queryCount;
}

test("directory/nearby rejects a non-numeric page instead of building malformed SQL", async () => {
  const original = { userFindUnique: prismaClient.user.findUnique, queryRawUnsafe: prismaClient.$queryRawUnsafe };
  setupMocks();
  try {
    const app = express();
    app.use("/api/beneficiaries", beneficiaryRoutes);
    const res = await requestAs(app, "/api/beneficiaries/directory/nearby?lat=41.8&lng=-87.6&page=not-a-number");
    assert.equal(res.status, 400);
    const body = await res.json() as { error: string };
    assert.match(body.error, /positive integer/);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.$queryRawUnsafe = original.queryRawUnsafe;
  }
});

test("directory/nearby rejects a negative or zero limit", async () => {
  const original = { userFindUnique: prismaClient.user.findUnique, queryRawUnsafe: prismaClient.$queryRawUnsafe };
  setupMocks();
  try {
    const app = express();
    app.use("/api/beneficiaries", beneficiaryRoutes);
    const res = await requestAs(app, "/api/beneficiaries/directory/nearby?lat=41.8&lng=-87.6&limit=0");
    assert.equal(res.status, 400);
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.$queryRawUnsafe = original.queryRawUnsafe;
  }
});

test("directory/nearby accepts a valid page/limit and never reaches raw SQL with NaN", async () => {
  const original = { userFindUnique: prismaClient.user.findUnique, queryRawUnsafe: prismaClient.$queryRawUnsafe };
  const getQueryCount = setupMocks();
  try {
    const app = express();
    app.use("/api/beneficiaries", beneficiaryRoutes);
    const res = await requestAs(app, "/api/beneficiaries/directory/nearby?lat=41.8&lng=-87.6&page=2&limit=25");
    assert.equal(res.status, 200);
    assert.ok(getQueryCount() >= 2, "expected both the count and main queries to run");
  } finally {
    prismaClient.user.findUnique = original.userFindUnique;
    prismaClient.$queryRawUnsafe = original.queryRawUnsafe;
  }
});
