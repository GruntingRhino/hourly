import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test, { after, before } from "node:test";
import { startMockGoogleClassroomTenant } from "../../tests/helpers/googleClassroomTenant";

process.env.CLIENT_URL = "https://goodhours.app";

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

test("classroom import lifecycle states are distinguishable: unconnected vs connected+preview+apply", async () => {
  const mock = await startMockGoogleClassroomTenant("default");
  const http = await startServer();
  const email = "lifecycle-" + Date.now() + "@example.invalid";
  const user = await db.user.create({
    data: { email, passwordHash: "x", name: "Lifecycle Admin", role: "SCHOOL_ADMIN", emailVerified: true },
    select: { id: true, email: true, role: true, tokenVersion: true },
  });
  const school = await db.school.create({
    data: { name: "Lifecycle School", verified: true, ownershipStatus: "APPROVED", createdById: user.id },
    select: { id: true },
  });
  await db.user.update({ where: { id: user.id }, data: { schoolId: school.id } });
  const headers = { authorization: "Bearer " + signUserToken(user), "content-type": "application/json" };
  const schoolId: string = school.id;
  const adminId: string = user.id;
  try {
    // 1. Unconnected: 200 with null connection, ops.connected=false, no jobs.
    const beforeRes = await fetch(http.baseUrl + "/api/integrations/googleClassroom/status", { headers });
    const beforeText = await beforeRes.text();
    assert.equal(beforeRes.status, 200, beforeText);
    const beforeBody = JSON.parse(beforeText) as any;
    assert.equal(beforeBody.connection, null, "unconnected school must report null connection");
    assert.equal(beforeBody.ops && beforeBody.ops.connected, false, "unconnected school must report ops.connected=false");
    assert.deepEqual(beforeBody.jobs, [], "unconnected school must report no jobs");

    // 2. MOCK connect against the repo's mock tenant.
    const connectRes = await fetch(http.baseUrl + "/api/integrations/googleClassroom/connect", {
      method: "POST", headers,
      body: JSON.stringify({ mode: "MOCK", displayName: "Lifecycle Mock", baseUrl: mock.baseUrl, mockScenario: "default" }),
    });
    assert.equal(connectRes.status, 201, await connectRes.text());

    // 3. Preview then apply: two jobs with distinct modes.
    const selection = JSON.stringify({ selectedExternalCourseIds: ["gclass-course-bio", "gclass-course-service"] });
    const previewRes = await fetch(http.baseUrl + "/api/integrations/googleClassroom/preview", { method: "POST", headers, body: selection });
    assert.equal(previewRes.status, 200, await previewRes.text());
    const applyRes = await fetch(http.baseUrl + "/api/integrations/googleClassroom/apply", { method: "POST", headers, body: selection });
    assert.equal(applyRes.status, 200, await applyRes.text());

    // 4. Status now reports CONNECTED with distinguishable job lifecycle states.
    const afterRes = await fetch(http.baseUrl + "/api/integrations/googleClassroom/status", { headers });
    const afterText = await afterRes.text();
    assert.equal(afterRes.status, 200, afterText);
    const body = JSON.parse(afterText) as any;
    assert.equal(body.connection && body.connection.status, "CONNECTED", JSON.stringify(body).slice(0, 500));
    assert.equal(body.ops && body.ops.connected, true, "connected school must report ops.connected=true");
    assert.ok(Array.isArray(body.jobs) && body.jobs.length >= 2, "expected >=2 jobs, got " + JSON.stringify(body.jobs).slice(0, 300));
    const modes = new Set(body.jobs.map((j: any) => j.mode));
    assert.ok(modes.has("PREVIEW") && modes.has("APPLY"), "preview and apply jobs must be distinguishable by mode");
    const states = new Set(body.jobs.map((j: any) => j.status));
    for (const s of states) {
      assert.ok(["COMPLETED", "PARTIAL_FAILED", "FAILED", "RUNNING"].includes(String(s)), "unknown job lifecycle state: " + String(s));
    }
    const terminal = body.ops && body.ops.lastSyncStatus;
    assert.ok(terminal === "COMPLETED" || terminal === "PARTIAL_FAILED", "expected a terminal sync state, ops: " + JSON.stringify(body.ops).slice(0, 300));
  } finally {
    await http.close();
    await mock.close();
    const cohorts = await db.cohort.findMany({ where: { schoolId }, select: { id: true } });
    const cohortIds = cohorts.map((c: any) => c.id);
    if (cohortIds.length > 0) {
      await db.studentCohortMembership.deleteMany({ where: { cohortId: { in: cohortIds } } });
      await db.cohortTeacherAssignment.deleteMany({ where: { cohortId: { in: cohortIds } } });
      await db.studentInvitation.deleteMany({ where: { cohortId: { in: cohortIds } } });
    }
    await db.integrationExternalMapping.deleteMany({}).catch(() => {});
    const conns = await db.integrationConnection.findMany({ where: { schoolId }, select: { id: true } });
    for (const cn of conns) {
      await db.integrationSyncError.deleteMany({ where: { connectionId: cn.id } });
      await db.integrationSyncJob.deleteMany({ where: { connectionId: cn.id } });
      await db.integrationConnection.delete({ where: { id: cn.id } });
    }
    if (cohortIds.length > 0) {
      await db.cohort.deleteMany({ where: { id: { in: cohortIds } } });
    }
    await db.user.deleteMany({ where: { schoolId, id: { not: adminId } } });
    await db.dataAccessLog.deleteMany({ where: { actorId: adminId } });
    await db.school.delete({ where: { id: schoolId } });
    await db.user.delete({ where: { id: adminId } });
  }
});

after(async () => {
  for (const server of servers) if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
  if (prisma) await prisma.$disconnect();
});
