import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test, { after } from "node:test";
import prisma from "../src/lib/prisma";
import app from "../src/index";
import { signUserToken } from "../src/middleware/auth";

const db = prisma as any;
const servers: Server[] = [];

async function startServer(): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server did not bind");
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

async function deleteAccount(baseUrl: string, user: { id: string; email: string; role: string; tokenVersion: number }) {
  return fetch(`${baseUrl}/api/auth/account`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${signUserToken(user)}` },
  });
}

async function createSchoolFixture(suffix: string) {
  const school = await db.school.create({
    data: {
      name: `Synthetic deletion safety ${suffix}`,
      ownershipStatus: "APPROVED",
      verified: true,
      onboardingComplete: true,
    },
  });
  const makeUser = (role: string, label: string) => db.user.create({
    data: {
      email: `${label}-${suffix}@example.invalid`,
      name: label,
      role,
      emailVerified: true,
      eligibilityAttestation: { create: { eligible13Plus: true, policyVersion: "2026-09-05", method: "test_fixture" } },
      schoolId: school.id,
    },
  });
  const admin = await makeUser("SCHOOL_ADMIN", "admin");
  const peerAdmin = await makeUser("SCHOOL_ADMIN", "peer-admin");
  const teacher = await makeUser("TEACHER", "teacher");
  const student = await makeUser("STUDENT", "student");
  const cohort = await db.cohort.create({ data: { name: `Synthetic cohort ${suffix}`, schoolId: school.id } });
  await db.user.update({ where: { id: student.id }, data: { cohortId: cohort.id } });
  const peerAudit = await db.dataAccessLog.create({
    data: { actorId: peerAdmin.id, action: "VIEW_SCHOOL_REPORT", schoolId: school.id, targetType: "school", targetId: school.id },
  });
  return { school, admin, peerAdmin, teacher, student, cohort, peerAudit };
}

async function cleanupSchool(schoolId: string) {
  await db.dataAccessLog.deleteMany({ where: { schoolId: schoolId } });
  await db.studentCohortMembership.deleteMany({ where: { cohort: { schoolId } } });
  await db.user.updateMany({ where: { schoolId }, data: { cohortId: null, schoolId: null } });
  await db.cohort.deleteMany({ where: { schoolId } });
  await db.user.deleteMany({ where: { schoolId } });
  await db.school.deleteMany({ where: { id: schoolId } });
}

test("personal deletion by one school admin preserves the school, peers, students, and records", async () => {
  const fixture = await createSchoolFixture(`peer-${Date.now()}`);
  const http = await startServer();
  try {
    const response = await deleteAccount(http.baseUrl, fixture.admin);
    assert.equal(response.status, 200, await response.text());

    assert.equal(await db.school.count({ where: { id: fixture.school.id } }), 1);
    assert.equal(await db.user.count({ where: { id: fixture.admin.id } }), 0);
    assert.equal((await db.user.findUnique({ where: { id: fixture.peerAdmin.id } })).schoolId, fixture.school.id);
    assert.equal((await db.user.findUnique({ where: { id: fixture.student.id } })).schoolId, fixture.school.id);
    assert.equal((await db.cohort.findUnique({ where: { id: fixture.cohort.id } })).schoolId, fixture.school.id);
    assert.equal(await db.dataAccessLog.count({ where: { id: fixture.peerAudit.id } }), 1);
  } finally {
    await http.close();
    await cleanupSchool(fixture.school.id);
  }
});

test("last school admin cannot personally delete and orphan the school", async () => {
  const fixture = await createSchoolFixture(`last-${Date.now()}`);
  await db.dataAccessLog.deleteMany({ where: { actorId: fixture.peerAdmin.id } });
  await db.user.delete({ where: { id: fixture.peerAdmin.id } });
  const http = await startServer();
  try {
    const response = await deleteAccount(http.baseUrl, fixture.admin);
    const responseBody = await response.json() as { code?: string };
    assert.equal(response.status, 409);
    const body = responseBody;
    assert.equal(body.code, "SCHOOL_ADMIN_TRANSFER_REQUIRED");
    assert.equal(await db.school.count({ where: { id: fixture.school.id } }), 1);
    assert.equal(await db.user.count({ where: { id: fixture.admin.id } }), 1);
  } finally {
    await http.close();
    await cleanupSchool(fixture.school.id);
  }
});

test("student and teacher personal deletion leaves the school and other users intact", async () => {
  for (const role of ["STUDENT", "TEACHER"] as const) {
    const fixture = await createSchoolFixture(`${role.toLowerCase()}-${Date.now()}`);
    const target = role === "STUDENT" ? fixture.student : fixture.teacher;
    const http = await startServer();
    try {
      const response = await deleteAccount(http.baseUrl, target);
      assert.equal(response.status, 200, await response.text());
      assert.equal(await db.user.count({ where: { id: target.id } }), 0);
      assert.equal(await db.school.count({ where: { id: fixture.school.id } }), 1);
      assert.equal(await db.user.count({ where: { id: fixture.admin.id } }), 1);
      const other = role === "STUDENT" ? fixture.teacher : fixture.student;
      assert.equal(await db.user.count({ where: { id: other.id } }), 1);
    } finally {
      await http.close();
      await cleanupSchool(fixture.school.id);
    }
  }
});

test("concurrent admin deletions preserve one-admin continuity", async () => {
  const fixture = await createSchoolFixture(`concurrent-${Date.now()}`);
  const http = await startServer();
  try {
    const responses = await Promise.all([
      deleteAccount(http.baseUrl, fixture.admin),
      deleteAccount(http.baseUrl, fixture.peerAdmin),
    ]);
    assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
    assert.equal(await db.school.count({ where: { id: fixture.school.id } }), 1);
    assert.equal(await db.user.count({ where: { schoolId: fixture.school.id, role: "SCHOOL_ADMIN" } }), 1);
  } finally {
    await http.close();
    await cleanupSchool(fixture.school.id);
  }
});

after(async () => {
  for (const server of servers) {
    if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  await prisma.$disconnect();
});
