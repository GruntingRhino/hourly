/**
 * Migration backfill script: converts existing student.schoolId data
 * into a default "General" classroom per school.
 *
 * Run AFTER the Prisma schema migration has been applied.
 *
 * What this does:
 * 1. Updates SCHOOL users to SCHOOL_ADMIN role
 * 2. Updates ORGANIZATION users to ORG_ADMIN role
 * 3. For each school, creates a "General" classroom if none exists
 * 4. Moves students with schoolId into the General classroom
 * 5. Associates SCHOOL-role users with their school via schoolId
 * 6. Marks all schools as unverified
 *
 * Usage: npx tsx prisma/backfill-classrooms.ts
 */

import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

function generateInviteCode(): string {
  return crypto.randomBytes(4).toString("hex");
}

async function main() {
  console.log("Starting backfill migration...\n");

  // 1. Update role names
  const orgUpdate = await prisma.user.updateMany({
    where: { role: "ORGANIZATION" },
    data: { role: "ORG_ADMIN" },
  });
  console.log(`Updated ${orgUpdate.count} ORGANIZATION -> ORG_ADMIN`);

  const schoolUpdate = await prisma.user.updateMany({
    where: { role: "SCHOOL" },
    data: { role: "SCHOOL_ADMIN" },
  });
  console.log(`Updated ${schoolUpdate.count} SCHOOL -> SCHOOL_ADMIN`);

  // 2. Get all schools
  const schools = await prisma.school.findMany();
  console.log(`\nProcessing ${schools.length} schools...`);

  for (const school of schools) {
    console.log(`\n--- School: ${school.name} (${school.id})`);

    // Mark as unverified
    await prisma.school.update({
      where: { id: school.id },
      data: { verified: false },
    });

    // Find the school admin (createdBy)
    const admin = await prisma.user.findFirst({
      where: { role: "SCHOOL_ADMIN", schoolId: school.id },
    });

    if (!admin) {
      console.log("  WARNING: No admin found for school, skipping classroom creation");
      continue;
    }

    // Check if a General classroom already exists
    let generalClassroom = await prisma.classroom.findFirst({
      where: { schoolId: school.id, name: "General" },
    });

    if (!generalClassroom) {
      let inviteCode = generateInviteCode();
      while (await prisma.classroom.findUnique({ where: { inviteCode } })) {
        inviteCode = generateInviteCode();
      }

      generalClassroom = await prisma.classroom.create({
        data: {
          name: "General",
          schoolId: school.id,
          teacherId: admin.id,
          inviteCode,
        },
      });
      console.log(`  Created General classroom (code: ${inviteCode})`);
    } else {
      console.log(`  General classroom already exists`);
    }

    // Find students with this schoolId but no classroomId
    const students = await prisma.user.findMany({
      where: {
        role: "STUDENT",
        schoolId: school.id,
        classroomId: null,
      },
    });

    if (students.length > 0) {
      await prisma.user.updateMany({
        where: {
          id: { in: students.map((s) => s.id) },
        },
        data: {
          classroomId: generalClassroom.id,
        },
      });
      console.log(`  Moved ${students.length} students into General classroom`);
    } else {
      console.log(`  No students to move`);
    }
  }

  console.log("\nBackfill complete!");
}

main()
  .catch((e) => {
    console.error("Backfill error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
