/**
 * Backfill script: for every existing school that does not already have a
 * private beneficiary, create one and auto-approve it for that school.
 *
 * Safe to re-run — skips schools that already have a beneficiary.
 *
 * Usage: npx tsx prisma/backfill-school-beneficiaries.ts
 */

import prisma from "../src/lib/prisma";
import { SCHOOL_CREATED_BENEFICIARY_PLAN } from "../src/lib/schoolBeneficiaryPolicy";

async function main() {
  const schools = await prisma.school.findMany({ select: { id: true, name: true } });
  console.log(`Found ${schools.length} school(s). Processing...`);

  let created = 0;
  let skipped = 0;

  for (const school of schools) {
    // Check if a private beneficiary already exists for this school
    const existing = await prisma.beneficiary.findFirst({
      where: { createdBySchoolId: school.id, visibility: "PRIVATE" },
    });

    if (existing) {
      // Ensure the approval record exists too
      await prisma.schoolBeneficiaryApproval.upsert({
        where: { schoolId_beneficiaryId: { schoolId: school.id, beneficiaryId: existing.id } },
        update: {},
        create: {
          schoolId: school.id,
          beneficiaryId: existing.id,
          status: "APPROVED",
          approvedAt: new Date(),
        },
      });
      console.log(`  SKIP  ${school.name} — beneficiary already exists`);
      skipped++;
      continue;
    }

    const beneficiary = await prisma.beneficiary.create({
      data: {
        name: school.name,
        visibility: "PRIVATE",
        status: "ACTIVE",
        createdBySchoolId: school.id,
        ...SCHOOL_CREATED_BENEFICIARY_PLAN,
      },
    });

    await prisma.schoolBeneficiaryApproval.create({
      data: {
        schoolId: school.id,
        beneficiaryId: beneficiary.id,
        status: "APPROVED",
        approvedAt: new Date(),
      },
    });

    console.log(`  CREATE ${school.name} — beneficiary created and approved`);
    created++;
  }

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
