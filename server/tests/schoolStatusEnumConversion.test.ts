import assert from "node:assert/strict";
import test from "node:test";
import prisma from "../src/lib/prisma";

// Regression test for the §17.1 enum conversion of School.verificationStandard,
// .billingStatus, and .accessStatus (migration
// 20260805040000_convert_school_billing_verification_status_to_enums).
// verificationStandard has only 2 app-written values; billingStatus and
// accessStatus are a manually-operated procurement pipeline where most
// values are set directly by ops, not through any route — this exercises
// the real (test) database directly, since a mocked Prisma client can't
// verify a Postgres enum actually rejects an invalid value the way a CHECK
// constraint or foreign key would.

test("School enum columns accept every documented non-default value and reject an invalid one", async () => {
  const school = await prisma.school.create({
    data: {
      name: "Enum Conversion Test School",
      verificationStandard: "BENEFICIARY_REQUIRED",
      billingStatus: "QUOTE_IN_REVIEW",
      accessStatus: "PILOT",
    },
  });

  try {
    const reloaded = await prisma.school.findUniqueOrThrow({ where: { id: school.id } });
    assert.equal(reloaded.verificationStandard, "BENEFICIARY_REQUIRED");
    assert.equal(reloaded.billingStatus, "QUOTE_IN_REVIEW");
    assert.equal(reloaded.accessStatus, "PILOT");

    // Every documented billingStatus value round-trips.
    const billingValues = [
      "NONE", "QUOTE_REQUESTED", "QUOTE_IN_REVIEW", "QUOTE_SENT", "PRIVACY_REVIEW",
      "SECURITY_REVIEW", "CONTRACT_REVIEW", "AWAITING_SIGNATURE", "AWAITING_PURCHASE_ORDER",
      "PURCHASE_ORDER_RECEIVED", "INVOICED", "PAYMENT_PENDING", "ACTIVE", "PAST_DUE",
      "EXPIRED", "DECLINED",
    ] as const;
    for (const value of billingValues) {
      const updated = await prisma.school.update({
        where: { id: school.id },
        data: { billingStatus: value },
        select: { billingStatus: true },
      });
      assert.equal(updated.billingStatus, value);
    }

    // Every documented accessStatus value round-trips.
    const accessValues = ["PROCUREMENT", "PILOT", "ACTIVE", "SUSPENDED", "EXPIRED"] as const;
    for (const value of accessValues) {
      const updated = await prisma.school.update({
        where: { id: school.id },
        data: { accessStatus: value },
        select: { accessStatus: true },
      });
      assert.equal(updated.accessStatus, value);
    }

    // An invalid value at the raw-SQL level is rejected by the enum type,
    // not silently accepted the way a plain String column would be.
    await assert.rejects(
      prisma.$executeRawUnsafe(
        `UPDATE "School" SET "billingStatus" = 'NOT_A_REAL_STATUS' WHERE id = $1`,
        school.id,
      ),
      /invalid input value for enum/,
    );
  } finally {
    await prisma.school.delete({ where: { id: school.id } });
  }
});

test("School defaults match the schema's documented defaults", async () => {
  const school = await prisma.school.create({ data: { name: "Default Enum Test School" } });
  try {
    assert.equal(school.verificationStandard, "STANDARD");
    assert.equal(school.billingStatus, "NONE");
    assert.equal(school.accessStatus, "PROCUREMENT");
  } finally {
    await prisma.school.delete({ where: { id: school.id } });
  }
});
