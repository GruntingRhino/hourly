import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test, { after, before, beforeEach } from "node:test";

/**
 * POST /api/auth/ownership-approval/resend, driven over real HTTP against the
 * PRODUCTION branch.
 *
 * Two environment facts make that safe and possible here:
 *  - `CLIENT_URL` is captured once when services/email.ts loads, so it is set
 *    below and the app is pulled in with a dynamic import (static imports would
 *    be hoisted above the assignment);
 *  - `isProdLike()` reads process.env per call, so APP_ENV is flipped only
 *    around each request — the app still booted under the test environment and
 *    against the disposable test database.
 * `EMAIL_DELIVERY_MODE` then decides what the send does: "log" makes it succeed
 * without touching a provider, "send" with no RESEND_API_KEY makes it throw.
 * No mail can leave the machine either way.
 *
 * Regressions covered:
 *  - the production branch was unreachable — `/(^|\\.)goodhours\\.app$/i` had
 *    doubled backslashes, so production always answered 200 `delivery:"bypass"`
 *    and mailed nothing, after rotating the token and claiming the cooldown;
 *  - a failed send must restore the previously emailed approval token and must
 *    NOT fully release the cooldown (this route's throttle).
 */

process.env.CLIENT_URL = "https://goodhours.app";

let prisma: any;
let db: any;
let app: any;
let signUserToken: (u: { id: string; email: string; role: string; tokenVersion: number }) => string;

const servers: Server[] = [];
const COOLDOWN_MS = 15 * 60 * 1000;

// Rate limiters are created at module load and use an in-memory bucket store
// in the test environment (no Redis, and isProdLike() is false at import time).
// Buckets persist across tests in the same process, so clear them here to give
// each test a clean slate. The limiter module exposes no reset API, so we clear
// the PostgreSQL table too (used when APP_ENV is flipped to production mid-test
// by asProduction, since shouldUseDatabaseStore is re-evaluated per request via
// the module-level flag captured at import — but we also need to clear any
// buckets that may have been written to the DB during a prior asProduction run).
//
// Node's --env-file flag does NOT override variables already present in the
// shell environment, so NODE_ENV=production (from this shell) would leak into
// tests and make isProdLike() return true. Explicitly reset all three flags
// that isProdLike() checks so tests 5 (non-production bypass) runs correctly.
beforeEach(async () => {
  process.env.APP_ENV = "development";
  process.env.NODE_ENV = "test";
  process.env.VERCEL_ENV = undefined;
  process.env.EMAIL_DELIVERY_MODE = "log";
  if (db) {
    try { await db.$executeRawUnsafe('DELETE FROM "RateLimitBucket"'); } catch {}
  }
});

before(async () => {
  prisma = (await import("../src/lib/prisma")).default;
  db = prisma as any;
  app = (await import("../src/index")).default;
  signUserToken = (await import("../src/middleware/auth")).signUserToken;
});

async function startServer() {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server did not bind");
  return { baseUrl: `http://127.0.0.1:${address.port}`, close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) };
}

async function asProduction<T>(deliveryMode: "log" | "send", fn: () => Promise<T>): Promise<T> {
  const saved = { APP_ENV: process.env.APP_ENV, EMAIL_DELIVERY_MODE: process.env.EMAIL_DELIVERY_MODE };
  process.env.APP_ENV = "production";
  process.env.EMAIL_DELIVERY_MODE = deliveryMode;
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

/**
 * A fresh applicant per test: the route is rate limited per authenticated user
 * (1 request / 60s), so reusing one account across tests would throttle rather
 * than exercise the handler.
 */
async function createPendingAdmin(lastSentAt: Date | null) {
  const email = `resend-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.invalid`;
  const user = await db.user.create({
    data: { email, passwordHash: "not-a-real-hash", name: "Resend Admin", role: "SCHOOL_ADMIN", emailVerified: true },
    select: { id: true, email: true, role: true, tokenVersion: true },
  });
  const school = await db.school.create({
    data: {
      name: `Resend Test School ${Date.now()}`,
      verified: false,
      ownershipStatus: "PENDING",
      ownershipApprovalToken: "previously-emailed-token-hash",
      ownershipApprovalTokenExpires: null,
      ownershipApprovalLastSentAt: lastSentAt,
      createdById: user.id,
    },
    select: { id: true },
  });
  await db.user.update({ where: { id: user.id }, data: { schoolId: school.id } });
  return { user, schoolId: school.id, headers: { authorization: `Bearer ${signUserToken(user)}` } };
}

async function destroy(userId: string) {
  await db.school.deleteMany({ where: { createdById: userId } });
  await db.user.deleteMany({ where: { id: userId } });
}

test("on the production target the resend reaches the real send path and reports delivery honestly", async () => {
  const http = await startServer();
  const { user, schoolId, headers } = await createPendingAdmin(null);
  try {
    const response = await asProduction("log", () =>
      fetch(`${http.baseUrl}/api/auth/ownership-approval/resend`, { method: "POST", headers }));
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    // The whole regression: this was "bypass" in production.
    assert.equal(body.delivery, "sent", JSON.stringify(body));

    const school = await db.school.findUnique({ where: { id: schoolId }, select: { ownershipApprovalToken: true, ownershipApprovalLastSentAt: true } });
    assert.notEqual(school.ownershipApprovalToken, "previously-emailed-token-hash", "a delivered resend issues a new token");
    assert.notEqual(school.ownershipApprovalLastSentAt, null, "a delivered resend claims the cooldown");
  } finally {
    await http.close();
    await destroy(user.id);
  }
});

test("an elapsed resend cooldown permits another send and renews the cooldown", async () => {
  const http = await startServer();
  const { user, schoolId, headers } = await createPendingAdmin(new Date(Date.now() - COOLDOWN_MS - 5_000));
  try {
    const before = Date.now();
    const response = await asProduction("log", () =>
      fetch(`${http.baseUrl}/api/auth/ownership-approval/resend`, { method: "POST", headers }));
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(body.delivery, "sent");
    assert.equal(body.retryAfterSeconds, 900);
    const school = await db.school.findUnique({ where: { id: schoolId }, select: { ownershipApprovalToken: true, ownershipApprovalLastSentAt: true } });
    assert.notEqual(school.ownershipApprovalToken, "previously-emailed-token-hash");
    assert.ok(school.ownershipApprovalLastSentAt.getTime() >= before);
  } finally {
    await http.close();
    await destroy(user.id);
  }
});

test("a failed provider send restores the previously emailed token and keeps a short cooldown", async () => {
  assert.equal(process.env.RESEND_API_KEY, undefined, "this test relies on there being no provider credential");
  const http = await startServer();
  const { user, schoolId, headers } = await createPendingAdmin(null);
  try {
    const before = Date.now();
    const response = await asProduction("send", () =>
      fetch(`${http.baseUrl}/api/auth/ownership-approval/resend`, { method: "POST", headers }));
    const body = await response.json();
    assert.equal(response.status, 502, JSON.stringify(body));
    assert.equal(body.delivery, "failed");

    const school = await db.school.findUnique({ where: { id: schoolId }, select: { ownershipApprovalToken: true, ownershipApprovalLastSentAt: true } });
    // The link already delivered to the owner must survive a failed resend.
    assert.equal(school.ownershipApprovalToken, "previously-emailed-token-hash");
    // Cooldown shortened, NOT released: this stamp is the route's throttle and
    // a "failed" send may still have been accepted by the provider.
    assert.notEqual(school.ownershipApprovalLastSentAt, null, "a failed send must not fully release the cooldown");
    const remainingMs = school.ownershipApprovalLastSentAt.getTime() + COOLDOWN_MS - before;
    assert.ok(remainingMs > 0, `cooldown was released entirely (remaining ${remainingMs}ms)`);
    assert.ok(remainingMs <= 60_000 + 5_000, `cooldown was not shortened (remaining ${remainingMs}ms)`);
  } finally {
    await http.close();
    await destroy(user.id);
  }
});

test("a resend inside the 15-minute window is refused with a server-provided cooldown and rotates nothing", async () => {
  const http = await startServer();
  const { user, schoolId, headers } = await createPendingAdmin(new Date(Date.now() - 60_000));
  try {
    const response = await asProduction("log", () =>
      fetch(`${http.baseUrl}/api/auth/ownership-approval/resend`, { method: "POST", headers }));
    assert.equal(response.status, 429);
    const body = await response.json();
    assert.ok(body.retryAfterSeconds > 0 && body.retryAfterSeconds <= 900, `unexpected retryAfterSeconds: ${body.retryAfterSeconds}`);
    assert.equal(response.headers.get("retry-after"), String(body.retryAfterSeconds));

    const school = await db.school.findUnique({ where: { id: schoolId }, select: { ownershipApprovalToken: true } });
    assert.equal(school.ownershipApprovalToken, "previously-emailed-token-hash");
  } finally {
    await http.close();
    await destroy(user.id);
  }
});

test("a non-production target still bypasses without mailing anyone", async () => {
  const http = await startServer();
  const { user, headers } = await createPendingAdmin(null);
  try {
    // No APP_ENV override: local/dev must never reach the business owner.
    const response = await fetch(`${http.baseUrl}/api/auth/ownership-approval/resend`, { method: "POST", headers });
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(body.delivery, "bypass");
  } finally {
    await http.close();
    await destroy(user.id);
  }
});

test("the per-applicant rate limiter throttles a burst even when the cooldown would allow it", async () => {
  const http = await startServer();
  const { user, schoolId, headers } = await createPendingAdmin(null);
  try {
    const first = await asProduction("log", () =>
      fetch(`${http.baseUrl}/api/auth/ownership-approval/resend`, { method: "POST", headers }));
    assert.equal(first.status, 200, await first.text());

    // Clear the DB cooldown so only the middleware limiter can stop the burst.
    await db.school.update({ where: { id: schoolId }, data: { ownershipApprovalLastSentAt: null } });
    const second = await asProduction("log", () =>
      fetch(`${http.baseUrl}/api/auth/ownership-approval/resend`, { method: "POST", headers }));
    assert.equal(second.status, 429, await second.text());
  } finally {
    await http.close();
    await destroy(user.id);
  }
});

after(async () => {
  for (const server of servers) if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
  if (prisma) await prisma.$disconnect();
});
