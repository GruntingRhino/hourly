import assert from "node:assert/strict";
import test from "node:test";
import prisma from "../src/lib/prisma";
import { recordServiceHourLedgerEntry } from "../src/lib/serviceHourLedger";

// §9 canonical service-hour ledger: recordServiceHourLedgerEntry is called
// alongside (never instead of) each of the 3 approve routes' existing
// writes to their own source table (BeneficiarySignup, SelfSubmittedRequest,
// ServiceSession) — this does not change what lib/hoursCalculator.ts reads
// from. Exercised against the real (test) database directly, since the
// point is confirming a real FK-constrained row is created correctly, not
// just that a mocked function was called.

test("recordServiceHourLedgerEntry creates a row with minutes correctly rounded from hours", async () => {
  const school = await prisma.school.create({ data: { name: "Ledger Test School" } });
  const student = await prisma.user.create({
    data: { email: "ledger-student@example.test", name: "Ledger Student", role: "STUDENT", schoolId: school.id },
  });
  const approver = await prisma.user.create({
    data: { email: "ledger-approver@example.test", name: "Ledger Approver", role: "SCHOOL_ADMIN", schoolId: school.id },
  });

  try {
    await recordServiceHourLedgerEntry({
      studentId: student.id,
      schoolId: school.id,
      sourceType: "SELF_SUBMITTED",
      sourceId: "fake-submission-id",
      category: "environment",
      approvedHours: 2.5,
      approverId: approver.id,
    });

    const entries = await prisma.serviceHourLedgerEntry.findMany({ where: { studentId: student.id } });
    assert.equal(entries.length, 1);
    assert.equal(entries[0].approvedMinutes, 150);
    assert.equal(entries[0].schoolId, school.id);
    assert.equal(entries[0].sourceType, "SELF_SUBMITTED");
    assert.equal(entries[0].sourceId, "fake-submission-id");
    assert.equal(entries[0].category, "environment");
    assert.equal(entries[0].approverId, approver.id);
  } finally {
    await prisma.serviceHourLedgerEntry.deleteMany({ where: { studentId: student.id } });
    await prisma.user.deleteMany({ where: { id: { in: [student.id, approver.id] } } });
    await prisma.school.delete({ where: { id: school.id } });
  }
});

test("recordServiceHourLedgerEntry is append-only: re-approving the same source inserts a second row, not an update", async () => {
  const school = await prisma.school.create({ data: { name: "Ledger Append-Only Test School" } });
  const student = await prisma.user.create({
    data: { email: "ledger-student-2@example.test", name: "Ledger Student 2", role: "STUDENT", schoolId: school.id },
  });
  const approver = await prisma.user.create({
    data: { email: "ledger-approver-2@example.test", name: "Ledger Approver 2", role: "SCHOOL_ADMIN", schoolId: school.id },
  });

  try {
    const params = {
      studentId: student.id,
      schoolId: school.id,
      sourceType: "SELF_SUBMITTED" as const,
      sourceId: "fake-submission-id-2",
      category: null,
      approverId: approver.id,
    };
    await recordServiceHourLedgerEntry({ ...params, approvedHours: 2 });
    await recordServiceHourLedgerEntry({ ...params, approvedHours: 3 }); // an adjustment/re-approval

    const entries = await prisma.serviceHourLedgerEntry.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: "asc" },
    });
    assert.equal(entries.length, 2);
    assert.equal(entries[0].approvedMinutes, 120);
    assert.equal(entries[1].approvedMinutes, 180);
  } finally {
    await prisma.serviceHourLedgerEntry.deleteMany({ where: { studentId: student.id } });
    await prisma.user.deleteMany({ where: { id: { in: [student.id, approver.id] } } });
    await prisma.school.delete({ where: { id: school.id } });
  }
});

test("recordServiceHourLedgerEntry does not throw when the write fails (best-effort, never blocks the real approval)", async () => {
  // A student/approver id that doesn't exist violates the FK constraint —
  // this must be swallowed (logged), not thrown, since a ledger-write
  // failure must never roll back or fail the actual approval it accompanies.
  await assert.doesNotReject(recordServiceHourLedgerEntry({
    studentId: "nonexistent-student-id",
    schoolId: null,
    sourceType: "SERVICE_SESSION",
    sourceId: "fake-session-id",
    category: null,
    approvedHours: 1,
    approverId: "nonexistent-approver-id",
  }));
});
