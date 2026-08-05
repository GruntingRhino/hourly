import test from "node:test";
import assert from "node:assert/strict";
import prisma from "../src/lib/prisma";

// Regression test for docs/qa/DATA_INTEGRITY_REPORT.md Issue 3: the
// ServiceSession_verified_requires_checkout CHECK constraint (added earlier
// this session) originally only required checkOutTime IS NOT NULL for a
// VERIFIED session, not checkInTime — so a direct database write (the
// exact threat model the report describes: Prisma Studio, a bad migration,
// a compromised backend) could still produce a VERIFIED session with a
// checkOutTime but no checkInTime. Strengthened to require both, matching
// the report's suggested invariant exactly. This test exercises the real
// constraint against the real (test) database — not mocked — since a
// mocked Prisma client can't verify a DB-level CHECK constraint actually
// rejects the row.

test("DB rejects a VERIFIED ServiceSession with checkOutTime but no checkInTime", async () => {
  const org = await prisma.organization.create({
    data: { name: "Constraint Test Org", email: "constraint-test-org@example.test", status: "APPROVED" },
  });
  const opportunity = await prisma.opportunity.create({
    data: {
      title: "Constraint Test Opportunity",
      description: "desc",
      location: "loc",
      date: new Date(),
      startTime: "10:00 AM",
      endTime: "2:00 PM",
      durationHours: 4,
      capacity: 10,
      status: "ACTIVE",
      organizationId: org.id,
    },
  });
  const student = await prisma.user.create({
    data: { email: "constraint-test-student@example.test", name: "Constraint Test Student", role: "STUDENT" },
  });

  try {
    await assert.rejects(
      prisma.$executeRaw`
        INSERT INTO "ServiceSession" (id, "userId", "opportunityId", status, "checkOutTime", "createdAt", "updatedAt")
        VALUES (${"constraint-test-session-1"}, ${student.id}, ${opportunity.id}, 'VERIFIED'::"ServiceSessionStatus", NOW(), NOW(), NOW())
      `,
      /violates check constraint/,
    );
  } finally {
    await prisma.serviceSession.deleteMany({ where: { userId: student.id } });
    await prisma.user.delete({ where: { id: student.id } });
    await prisma.opportunity.delete({ where: { id: opportunity.id } });
    await prisma.organization.delete({ where: { id: org.id } });
  }
});

test("DB allows a VERIFIED ServiceSession with both checkInTime and checkOutTime set", async () => {
  const org = await prisma.organization.create({
    data: { name: "Constraint Test Org 2", email: "constraint-test-org-2@example.test", status: "APPROVED" },
  });
  const opportunity = await prisma.opportunity.create({
    data: {
      title: "Constraint Test Opportunity 2",
      description: "desc",
      location: "loc",
      date: new Date(),
      startTime: "10:00 AM",
      endTime: "2:00 PM",
      durationHours: 4,
      capacity: 10,
      status: "ACTIVE",
      organizationId: org.id,
    },
  });
  const student = await prisma.user.create({
    data: { email: "constraint-test-student-2@example.test", name: "Constraint Test Student 2", role: "STUDENT" },
  });

  try {
    const session = await prisma.serviceSession.create({
      data: {
        userId: student.id,
        opportunityId: opportunity.id,
        status: "VERIFIED",
        checkInTime: new Date(),
        checkOutTime: new Date(),
        totalHours: 4,
      },
    });
    assert.ok(session.id);
  } finally {
    await prisma.serviceSession.deleteMany({ where: { userId: student.id } });
    await prisma.user.delete({ where: { id: student.id } });
    await prisma.opportunity.delete({ where: { id: opportunity.id } });
    await prisma.organization.delete({ where: { id: org.id } });
  }
});
