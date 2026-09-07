import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test, { after } from "node:test";
import prisma from "../src/lib/prisma";
import app from "../src/index";
import { signUserToken } from "../src/middleware/auth";

/**
 * Age eligibility is a STUDENT-only requirement. School staff must never be
 * routed into age setup — a pending school admin is gated on school ownership
 * review only.
 *
 * Locally, every SCHOOL_ADMIN is treated as an internal admin
 * (isInternalAdminUser's !isPubliclyDeployed fallback), which skips the
 * ownership gate entirely, so this file drives the request with
 * VERCEL_ENV=preview to exercise the deployed code path. Both isProdLike() and
 * isPubliclyDeployed() read process.env per call, and node:test runs the tests
 * in this file sequentially in its own process, so the override is contained.
 */

const db = prisma as any;
const servers: Server[] = [];

async function startServer() {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server did not bind");
  return { baseUrl: `http://127.0.0.1:${address.port}`, close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) };
}

async function asPubliclyDeployed<T>(fn: () => Promise<T>): Promise<T> {
  const previous = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = "preview";
  try {
    return await fn();
  } finally {
    if (previous === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previous;
  }
}

async function createUser(role: string, attest: boolean) {
  const email = `setup-gate-${role.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.invalid`;
  const user = await db.user.create({
    data: { email, passwordHash: "not-a-real-hash", name: `Setup Gate ${role}`, role, emailVerified: true },
    select: { id: true, email: true, role: true, tokenVersion: true },
  });
  if (attest) {
    await db.eligibilityAttestation.create({
      data: { userId: user.id, eligible13Plus: true, policyVersion: "13-plus-v1", method: "test" },
    });
  }
  return user;
}

async function destroyUser(userId: string) {
  await db.eligibilityAttestation.deleteMany({ where: { userId } });
  await db.school.deleteMany({ where: { createdById: userId } });
  await db.user.deleteMany({ where: { id: userId } });
}

test("a pending school admin with no attestation is gated on ownership, never on age", async () => {
  const http = await startServer();
  let userId: string | null = null;
  try {
    const user = await createUser("SCHOOL_ADMIN", false);
    userId = user.id;
    const school = await db.school.create({
      data: { name: `Setup Gate School ${Date.now()}`, verified: false, ownershipStatus: "PENDING", createdById: user.id },
      select: { id: true },
    });
    await db.user.update({ where: { id: user.id }, data: { schoolId: school.id } });
    const headers = { authorization: `Bearer ${signUserToken(user)}` };

    const gated = await asPubliclyDeployed(() => fetch(`${http.baseUrl}/api/cohorts`, { headers }));
    assert.equal(gated.status, 403);
    const body = await gated.json();
    assert.equal(body.code, "SCHOOL_SETUP_ONLY");
    assert.match(body.error, /ownership approval is pending/i);

    // /auth/me is a permitted setup route and must not route staff into age setup.
    const me = await asPubliclyDeployed(() => fetch(`${http.baseUrl}/api/auth/me`, { headers }));
    const meBody = await me.text();
    assert.equal(me.status, 200, meBody);
    assert.equal(JSON.parse(meBody).requiresEligibilityAttestation, false);
  } finally {
    await http.close();
    if (userId) await destroyUser(userId);
  }
});

test("a student with no attestation is still gated on age", async () => {
  const http = await startServer();
  let userId: string | null = null;
  try {
    const user = await createUser("STUDENT", false);
    userId = user.id;
    const headers = { authorization: `Bearer ${signUserToken(user)}` };

    const gated = await asPubliclyDeployed(() => fetch(`${http.baseUrl}/api/saved`, { headers }));
    assert.equal(gated.status, 403);
    const body = await gated.json();
    assert.equal(body.code, "AGE_ELIGIBILITY_REQUIRED");

    const me = await asPubliclyDeployed(() => fetch(`${http.baseUrl}/api/auth/me`, { headers }));
    const meBody = await me.text();
    assert.equal(me.status, 200, meBody);
    assert.equal(JSON.parse(meBody).requiresEligibilityAttestation, true);
  } finally {
    await http.close();
    if (userId) await destroyUser(userId);
  }
});

test("a student who has attested is no longer gated", async () => {
  const http = await startServer();
  let userId: string | null = null;
  try {
    const user = await createUser("STUDENT", true);
    userId = user.id;
    const headers = { authorization: `Bearer ${signUserToken(user)}` };

    const allowed = await asPubliclyDeployed(() => fetch(`${http.baseUrl}/api/saved`, { headers }));
    assert.equal(allowed.status, 200, await allowed.text());

    const me = await asPubliclyDeployed(() => fetch(`${http.baseUrl}/api/auth/me`, { headers }));
    assert.equal((await me.json()).requiresEligibilityAttestation, false);
  } finally {
    await http.close();
    if (userId) await destroyUser(userId);
  }
});

test("beneficiary staff with no attestation are not gated at all", async () => {
  const http = await startServer();
  let userId: string | null = null;
  try {
    const user = await createUser("BENEFICIARY_ADMIN", false);
    userId = user.id;
    const headers = { authorization: `Bearer ${signUserToken(user)}` };

    const me = await asPubliclyDeployed(() => fetch(`${http.baseUrl}/api/auth/me`, { headers }));
    const meBody = await me.text();
    assert.equal(me.status, 200, meBody);
    assert.equal(JSON.parse(meBody).requiresEligibilityAttestation, false);

    // /auth/me is a permitted setup route, so a 200 there does not by itself
    // prove the session is unrestricted. A non-setup route must not 403 with a
    // setup-only code.
    const open = await asPubliclyDeployed(() => fetch(`${http.baseUrl}/api/beneficiaries`, { headers }));
    if (open.status === 403) {
      const body = await open.json();
      assert.ok(
        body.code !== "AGE_ELIGIBILITY_REQUIRED" && body.code !== "SCHOOL_SETUP_ONLY",
        `beneficiary staff were setup-only gated: ${JSON.stringify(body)}`,
      );
    }
  } finally {
    await http.close();
    if (userId) await destroyUser(userId);
  }
});

after(async () => {
  for (const server of servers) if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});
