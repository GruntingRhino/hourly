/**
 * Playwright test account seeder
 *
 * Creates 7 hidden test accounts (isTestAccount=true) that are invisible in all
 * school/beneficiary/student lists. Safe to run repeatedly — upserts by email.
 *
 * Accounts:
 *   +1  abhay.sivaram+1@gmail.com  SCHOOL_ADMIN   → Playwright School A
 *   +2  abhay.sivaram+2@gmail.com  SCHOOL_ADMIN   → Playwright School B
 *   +3  abhay.sivaram+3@gmail.com  BENEFICIARY_ADMIN → Playwright Org A
 *   +4  abhay.sivaram+4@gmail.com  BENEFICIARY_ADMIN → Playwright Org B
 *   +5  abhay.sivaram+5@gmail.com  STUDENT        → School A, Cohort A
 *   +6  abhay.sivaram+6@gmail.com  STUDENT        → School A, Cohort A
 *   +7  abhay.sivaram+7@gmail.com  STUDENT        → School B, Cohort B
 *   +8  abhay.sivaram+8@gmail.com  STUDENT        → School A, no cohort (Canvas link edge case)
 *
 * Password for all accounts: Playwright1!
 *
 * Usage:
 *   cd server && npx tsx prisma/seed-playwright.ts
 */

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { schoolCreatedBeneficiaryPlan } from "../src/lib/schoolBeneficiaryPolicy";
import { isProdLike } from "../src/lib/isProdLike";
import { ELIGIBILITY_POLICY_VERSION } from "../src/lib/schoolAuthority";

const prisma = new PrismaClient();

/**
 * Seeded students stand in for students who already confirmed they are 13+.
 * Without the attestation row `evaluateSessionEligibility` puts them in the
 * setup-only state and every student-scoped route answers 403
 * AGE_ELIGIBILITY_REQUIRED, so the whole security suite tests the age gate
 * instead of the behaviour it targets. Staff accounts deliberately get no
 * attestation — the 13+ requirement is students-only.
 */
async function attestEligible(userId: string): Promise<void> {
  await prisma.eligibilityAttestation.upsert({
    where: { userId },
    update: { eligible13Plus: true },
    create: {
      userId,
      eligible13Plus: true,
      policyVersion: ELIGIBILITY_POLICY_VERSION,
      method: "seed",
    },
  });
}

const PASSWORD = "Playwright1!";
const SCHOOL_ADMIN_A_EMAIL = "abhay.sivaram+1@gmail.com";
const LEGACY_SCHOOL_ADMIN_A_EMAIL = "school-admin@test.goodhours.app";

async function main() {
  // Non-destructive (upserts by email) so this doesn't need the same
  // multi-condition guard as seed.ts's TRUNCATE — but it still creates
  // privileged accounts with a fixed, publicly-visible password, so it must
  // never run against anything production-like.
  if (isProdLike()) {
    throw new Error(
      "[seed-playwright] Refusing to run: this looks like a production-like environment " +
      "(APP_ENV/NODE_ENV/VERCEL_ENV). This script creates accounts with a fixed, known password."
    );
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const existingAdminA = await prisma.user.findUnique({
    where: { email: SCHOOL_ADMIN_A_EMAIL },
    select: { id: true },
  });
  if (!existingAdminA) {
    await prisma.user.updateMany({
      where: { email: LEGACY_SCHOOL_ADMIN_A_EMAIL, isTestAccount: true },
      data: { email: SCHOOL_ADMIN_A_EMAIL },
    });
  }

  // ── School A admin ───────────────────────────────────────────────────────────
  const adminA = await prisma.user.upsert({
    where: { email: SCHOOL_ADMIN_A_EMAIL },
    update: { passwordHash, isTestAccount: true, emailVerified: true },
    create: {
      email: SCHOOL_ADMIN_A_EMAIL,
      name: "PW School Admin A",
      role: "SCHOOL_ADMIN",
      passwordHash,
      emailVerified: true,
      isTestAccount: true,
    },
  });

  let schoolA = await prisma.school.findFirst({
    where: { createdById: adminA.id },
  });
  if (!schoolA) {
    schoolA = await prisma.school.create({
      data: {
        name: "Playwright School A",
        verified: true,
        ownershipStatus: "APPROVED",
        onboardingComplete: true,
        createdById: adminA.id,
      },
    });
    // Private school beneficiary
    const bA = await prisma.beneficiary.create({
      data: {
        name: "Playwright School A",
        visibility: "PRIVATE",
        status: "ACTIVE",
        createdBySchoolId: schoolA.id,
        ...schoolCreatedBeneficiaryPlan("PRIVATE"),
      },
    });
    await prisma.schoolBeneficiaryApproval.create({
      data: {
        schoolId: schoolA.id,
        beneficiaryId: bA.id,
        status: "APPROVED",
        approvedAt: new Date(),
      },
    });
  } else {
    await prisma.school.update({
      where: { id: schoolA.id },
      data: { onboardingComplete: true, verified: true, ownershipStatus: "APPROVED" },
    });
  }
  await prisma.beneficiary.updateMany({
    where: { createdBySchoolId: schoolA.id, visibility: "PRIVATE" },
    data: schoolCreatedBeneficiaryPlan("PRIVATE"),
  });
  await prisma.user.update({
    where: { id: adminA.id },
    data: { schoolId: schoolA.id },
  });

  // ── School B admin ───────────────────────────────────────────────────────────
  const adminB = await prisma.user.upsert({
    where: { email: "abhay.sivaram+2@gmail.com" },
    update: { passwordHash, isTestAccount: true, emailVerified: true },
    create: {
      email: "abhay.sivaram+2@gmail.com",
      name: "PW School Admin B",
      role: "SCHOOL_ADMIN",
      passwordHash,
      emailVerified: true,
      isTestAccount: true,
    },
  });

  let schoolB = await prisma.school.findFirst({
    where: { createdById: adminB.id },
  });
  if (!schoolB) {
    schoolB = await prisma.school.create({
      data: {
        name: "Playwright School B",
        verified: true,
        ownershipStatus: "APPROVED",
        onboardingComplete: true,
        createdById: adminB.id,
      },
    });
    const bB = await prisma.beneficiary.create({
      data: {
        name: "Playwright School B",
        visibility: "PRIVATE",
        status: "ACTIVE",
        createdBySchoolId: schoolB.id,
        ...schoolCreatedBeneficiaryPlan("PRIVATE"),
      },
    });
    await prisma.schoolBeneficiaryApproval.create({
      data: {
        schoolId: schoolB.id,
        beneficiaryId: bB.id,
        status: "APPROVED",
        approvedAt: new Date(),
      },
    });
  } else {
    await prisma.school.update({
      where: { id: schoolB.id },
      data: { onboardingComplete: true, verified: true, ownershipStatus: "APPROVED" },
    });
  }
  await prisma.beneficiary.updateMany({
    where: { createdBySchoolId: schoolB.id, visibility: "PRIVATE" },
    data: schoolCreatedBeneficiaryPlan("PRIVATE"),
  });
  await prisma.user.update({
    where: { id: adminB.id },
    data: { schoolId: schoolB.id },
  });

  // ── Cohorts ──────────────────────────────────────────────────────────────────
  let cohortA = await prisma.cohort.findFirst({
    where: { schoolId: schoolA.id, name: "PW Cohort A" },
  });
  if (!cohortA) {
    cohortA = await prisma.cohort.create({
      data: {
        name: "PW Cohort A",
        schoolId: schoolA.id,
        status: "PUBLISHED",
      },
    });
  }

  let cohortB = await prisma.cohort.findFirst({
    where: { schoolId: schoolB.id, name: "PW Cohort B" },
  });
  if (!cohortB) {
    cohortB = await prisma.cohort.create({
      data: {
        name: "PW Cohort B",
        schoolId: schoolB.id,
        status: "PUBLISHED",
      },
    });
  }

  // ── Beneficiary org admins ───────────────────────────────────────────────────
  let orgA = await prisma.beneficiary.findFirst({
    where: { name: "Playwright Org A" },
  });
  if (!orgA) {
    orgA = await prisma.beneficiary.create({
      data: {
        name: "Playwright Org A",
        visibility: "PRIVATE",
        status: "ACTIVE",
      },
    });
  } else {
    await prisma.beneficiary.update({
      where: { id: orgA.id },
      data: { visibility: "PRIVATE", status: "ACTIVE" },
    });
  }

  const benefAdminA = await prisma.user.upsert({
    where: { email: "abhay.sivaram+3@gmail.com" },
    update: { passwordHash, isTestAccount: true, emailVerified: true, beneficiaryId: orgA.id },
    create: {
      email: "abhay.sivaram+3@gmail.com",
      name: "PW Org Admin A",
      role: "BENEFICIARY_ADMIN",
      passwordHash,
      emailVerified: true,
      isTestAccount: true,
      beneficiaryId: orgA.id,
    },
  });
  void benefAdminA;

  let orgB = await prisma.beneficiary.findFirst({
    where: { name: "Playwright Org B" },
  });
  if (!orgB) {
    orgB = await prisma.beneficiary.create({
      data: {
        name: "Playwright Org B",
        visibility: "PRIVATE",
        status: "ACTIVE",
      },
    });
  } else {
    await prisma.beneficiary.update({
      where: { id: orgB.id },
      data: { visibility: "PRIVATE", status: "ACTIVE" },
    });
  }

  const benefAdminB = await prisma.user.upsert({
    where: { email: "abhay.sivaram+4@gmail.com" },
    update: { passwordHash, isTestAccount: true, emailVerified: true, beneficiaryId: orgB.id },
    create: {
      email: "abhay.sivaram+4@gmail.com",
      name: "PW Org Admin B",
      role: "BENEFICIARY_ADMIN",
      passwordHash,
      emailVerified: true,
      isTestAccount: true,
      beneficiaryId: orgB.id,
    },
  });
  void benefAdminB;

  // ── Students ─────────────────────────────────────────────────────────────────
  for (const [email, name, cohortId, schoolId] of [
    ["abhay.sivaram+5@gmail.com", "PW Student 1", cohortA.id, schoolA.id],
    ["abhay.sivaram+6@gmail.com", "PW Student 2", cohortA.id, schoolA.id],
    ["abhay.sivaram+7@gmail.com", "PW Student 3", cohortB.id, schoolB.id],
  ] as [string, string, string, string][]) {
    const student = await prisma.user.upsert({
      where: { email },
      update: { passwordHash, isTestAccount: true, emailVerified: true, schoolId, cohortId },
      create: {
        email,
        name,
        role: "STUDENT",
        passwordHash,
        emailVerified: true,
        isTestAccount: true,
        schoolId,
        cohortId,
      },
    });
    await prisma.studentCohortMembership.upsert({
      where: { studentId_cohortId: { studentId: student.id, cohortId } },
      update: { isActive: true, source: "MANUAL" },
      create: { studentId: student.id, cohortId, isActive: true, source: "MANUAL" },
    });
    await attestEligible(student.id);
  }

  const canvasStudent = await prisma.user.upsert({
    where: { email: "abhay.sivaram+8@gmail.com" },
    update: {
      passwordHash,
      isTestAccount: true,
      emailVerified: true,
      schoolId: schoolA.id,
      cohortId: null,
    },
    create: {
      email: "abhay.sivaram+8@gmail.com",
      name: "PW Existing Canvas Student",
      role: "STUDENT",
      passwordHash,
      emailVerified: true,
      isTestAccount: true,
      schoolId: schoolA.id,
    },
  });
  await attestEligible(canvasStudent.id);

  // ── School ↔ Org approvals ───────────────────────────────────────────────────
  // School A ↔ Org A (APPROVED so students can browse Org A opportunities)
  await prisma.schoolBeneficiaryApproval.upsert({
    where: { schoolId_beneficiaryId: { schoolId: schoolA.id, beneficiaryId: orgA.id } },
    update: { status: "APPROVED", approvedAt: new Date() },
    create: { schoolId: schoolA.id, beneficiaryId: orgA.id, status: "APPROVED", approvedAt: new Date() },
  });

  // School B ↔ Org B
  await prisma.schoolBeneficiaryApproval.upsert({
    where: { schoolId_beneficiaryId: { schoolId: schoolB.id, beneficiaryId: orgB.id } },
    update: { status: "APPROVED", approvedAt: new Date() },
    create: { schoolId: schoolB.id, beneficiaryId: orgB.id, status: "APPROVED", approvedAt: new Date() },
  });

  console.log("✓ Playwright test accounts seeded");
  console.log(`  School A admin : ${SCHOOL_ADMIN_A_EMAIL}`);
  console.log("  School B admin : abhay.sivaram+2@gmail.com");
  console.log("  Org admin A    : abhay.sivaram+3@gmail.com");
  console.log("  Org admin B    : abhay.sivaram+4@gmail.com");
  console.log("  Student 1      : abhay.sivaram+5@gmail.com  (School A)");
  console.log("  Student 2      : abhay.sivaram+6@gmail.com  (School A)");
  console.log("  Student 3      : abhay.sivaram+7@gmail.com  (School B)");
  console.log("  Password       : Playwright1!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
