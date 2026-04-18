/**
 * Playwright test account seeder
 *
 * Creates 7 hidden test accounts (isTestAccount=true) that are invisible in all
 * school/beneficiary/student lists. Safe to run repeatedly — upserts by email.
 *
 * Accounts:
 *   +1  school-admin@test.goodhours.app  SCHOOL_ADMIN   → Playwright School A
 *   +2  abhay.sivaram+2@gmail.com  SCHOOL_ADMIN   → Playwright School B
 *   +3  abhay.sivaram+3@gmail.com  BENEFICIARY_ADMIN → Playwright Org A
 *   +4  abhay.sivaram+4@gmail.com  BENEFICIARY_ADMIN → Playwright Org B
 *   +5  abhay.sivaram+5@gmail.com  STUDENT        → School A, Cohort A
 *   +6  abhay.sivaram+6@gmail.com  STUDENT        → School A, Cohort A
 *   +7  abhay.sivaram+7@gmail.com  STUDENT        → School B, Cohort B
 *
 * Password for all accounts: Playwright1!
 *
 * Usage:
 *   cd server && npx tsx prisma/seed-playwright.ts
 */

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PASSWORD = "Playwright1!";

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  // ── School A admin ───────────────────────────────────────────────────────────
  const adminA = await prisma.user.upsert({
    where: { email: "school-admin@test.goodhours.app" },
    update: { passwordHash, isTestAccount: true, emailVerified: true },
    create: {
      email: "school-admin@test.goodhours.app",
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
        createdById: adminA.id,
      },
    });
    await prisma.user.update({
      where: { id: adminA.id },
      data: { schoolId: schoolA.id },
    });
    // Private school beneficiary
    const bA = await prisma.beneficiary.create({
      data: {
        name: "Playwright School A",
        visibility: "PRIVATE",
        status: "ACTIVE",
        createdBySchoolId: schoolA.id,
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
    await prisma.user.update({
      where: { id: adminA.id },
      data: { schoolId: schoolA.id },
    });
  }

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
        createdById: adminB.id,
      },
    });
    await prisma.user.update({
      where: { id: adminB.id },
      data: { schoolId: schoolB.id },
    });
    const bB = await prisma.beneficiary.create({
      data: {
        name: "Playwright School B",
        visibility: "PRIVATE",
        status: "ACTIVE",
        createdBySchoolId: schoolB.id,
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
    await prisma.user.update({
      where: { id: adminB.id },
      data: { schoolId: schoolB.id },
    });
  }

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
    where: { name: "Playwright Org A", visibility: "PUBLIC" },
  });
  if (!orgA) {
    orgA = await prisma.beneficiary.create({
      data: {
        name: "Playwright Org A",
        visibility: "PUBLIC",
        status: "ACTIVE",
      },
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
    where: { name: "Playwright Org B", visibility: "PUBLIC" },
  });
  if (!orgB) {
    orgB = await prisma.beneficiary.create({
      data: {
        name: "Playwright Org B",
        visibility: "PUBLIC",
        status: "ACTIVE",
      },
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
  for (const [email, name, cohortId] of [
    ["abhay.sivaram+5@gmail.com", "PW Student 1", cohortA.id],
    ["abhay.sivaram+6@gmail.com", "PW Student 2", cohortA.id],
    ["abhay.sivaram+7@gmail.com", "PW Student 3", cohortB.id],
  ] as [string, string, string][]) {
    await prisma.user.upsert({
      where: { email },
      update: { passwordHash, isTestAccount: true, emailVerified: true, cohortId },
      create: {
        email,
        name,
        role: "STUDENT",
        passwordHash,
        emailVerified: true,
        isTestAccount: true,
        cohortId,
      },
    });
  }

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
  console.log("  School A admin : school-admin@test.goodhours.app");
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
