import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test, { after, before } from "node:test";

/**
 * Regression: GET /api/integrations/googleClassroom/oauth/url?testOrigin=...
 * crashed with Prisma "Unknown argument `testOrigin`" because
 * GoogleClassroomOAuthState had no such column while the service persists
 * the test origin through the state row.
 *
 * OAuth client env is faked before the app import (the service snapshots it
 * at module load); no real Google traffic happens — the endpoint only builds
 * the authorize URL and stores the state row.
 */

process.env.CLIENT_URL = "https://goodhours.app";
process.env.GOOGLE_CLASSROOM_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
process.env.GOOGLE_CLASSROOM_CLIENT_SECRET = "test-client-secret";
process.env.GOOGLE_CLASSROOM_CALLBACK_URL = "https://goodhours.app/api/integrations/googleClassroom/oauth/callback";
// Test OAuth destinations must be administratively approved per call.
process.env.LMS_ALLOW_TEST_ORIGINS = "true";
process.env.LMS_TEST_ALLOWED_ORIGINS = "https://oauth-tenant.mock.local";

let prisma: any;
let db: any;
let app: any;
let signUserToken: (u: { id: string; email: string; role: string; tokenVersion: number }) => string;
const servers: Server[] = [];

before(async () => {
  process.env.APP_ENV = "development";
  process.env.NODE_ENV = "test";
  delete process.env.VERCEL_ENV;
  process.env.EMAIL_DELIVERY_MODE = "log";
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
  const baseUrl = "http://127.0.0.1:" + (address as any).port;
  return { baseUrl, close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) };
}

async function createAdmin() {
  const email = "oauth-url-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + "@example.invalid";
  const user = await db.user.create({
    data: { email, passwordHash: "x", name: "OAuth URL Admin", role: "SCHOOL_ADMIN", emailVerified: true },
    select: { id: true, email: true, role: true, tokenVersion: true },
  });
  const school = await db.school.create({
    data: { name: "OAuth URL School", verified: true, ownershipStatus: "APPROVED", createdById: user.id },
    select: { id: true },
  });
  await db.user.update({ where: { id: user.id }, data: { schoolId: school.id } });
  return { user, schoolId: school.id as string, headers: { authorization: "Bearer " + signUserToken(user) } };
}

async function destroy(userId: string, schoolId: string) {
  await db.googleClassroomOAuthState.deleteMany({ where: { schoolId } });
  await db.user.deleteMany({ where: { schoolId } });
  await db.school.deleteMany({ where: { id: schoolId } });
  await db.dataAccessLog.deleteMany({ where: { actorId: userId } });
  await db.user.deleteMany({ where: { id: userId } });
}

test("oauth url with testOrigin stores the origin on the state row", async () => {
  const http = await startServer();
  const { user, schoolId, headers } = await createAdmin();
  try {
    const res = await fetch(http.baseUrl + "/api/integrations/googleClassroom/oauth/url?testOrigin=" + encodeURIComponent("https://oauth-tenant.mock.local"), { headers });
    const text = await res.text();
    assert.equal(res.status, 200, text);
    const body = JSON.parse(text) as any;
    assert.ok(body.url.includes("https://oauth-tenant.mock.local/o/oauth2/v2/auth"), "authorize URL must use the test origin: " + body.url.slice(0, 120));
    const rows = await db.googleClassroomOAuthState.findMany({ where: { schoolId } });
    assert.equal(rows.length, 1, "exactly one state row must be stored");
    assert.equal(rows[0].testOrigin, "https://oauth-tenant.mock.local");
  } finally {
    await http.close();
    await destroy(user.id, schoolId);
  }
});

test("oauth url without testOrigin stores a null origin and uses Google", async () => {
  const http = await startServer();
  const { user, schoolId, headers } = await createAdmin();
  try {
    const res = await fetch(http.baseUrl + "/api/integrations/googleClassroom/oauth/url", { headers });
    const text = await res.text();
    assert.equal(res.status, 200, text);
    const body = JSON.parse(text) as any;
    assert.ok(body.url.includes("https://accounts.google.com/o/oauth2/v2/auth"), "default authorize URL must use Google: " + body.url.slice(0, 120));
    const rows = await db.googleClassroomOAuthState.findMany({ where: { schoolId } });
    assert.equal(rows.length, 1, "exactly one state row must be stored");
    assert.equal(rows[0].testOrigin, null);
  } finally {
    await http.close();
    await destroy(user.id, schoolId);
  }
});

after(async () => {
  for (const server of servers) if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
  if (prisma) await prisma.$disconnect();
});
