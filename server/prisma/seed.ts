import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();

function generateInviteCode(): string {
  return crypto.randomBytes(4).toString("hex");
}

async function main() {
  console.log("Cleaning up existing data...");
  // Delete in dependency order, TRUNCATE CASCADE handles circular FKs
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "AuditLog", "Message", "Notification", "SavedOpportunity",
      "StudentGroupMember", "StudentGroup", "ServiceSession",
      "Signup", "SchoolOrganization", "Classroom", "Opportunity",
      "User", "School", "Organization"
    CASCADE
  `);

  console.log("Seeding database...");

  // Create school admin user first
  const schoolAdmin = await prisma.user.create({
    data: {
      email: "admin@lincoln.edu",
      passwordHash: await bcrypt.hash("password123", 12),
      name: "Principal Johnson",
      role: "SCHOOL_ADMIN",
      emailVerified: true,
    },
  });

  // Create school
  const school = await prisma.school.create({
    data: {
      name: "Lincoln High School",
      domain: "lincoln.edu",
      verified: false,
      createdById: schoolAdmin.id,
      requiredHours: 40,
    },
  });

  // Associate admin with school
  await prisma.user.update({
    where: { id: schoolAdmin.id },
    data: { schoolId: school.id },
  });

  // Create default "General" classroom
  const generalClassroom = await prisma.classroom.create({
    data: {
      name: "General",
      schoolId: school.id,
      teacherId: schoolAdmin.id,
      inviteCode: generateInviteCode(),
    },
  });

  // Create a second classroom
  const classroom2 = await prisma.classroom.create({
    data: {
      name: "AP Community Service",
      schoolId: school.id,
      teacherId: schoolAdmin.id,
      inviteCode: generateInviteCode(),
    },
  });

  // Create organization
  const org = await prisma.organization.create({
    data: {
      name: "Green Earth Foundation",
      email: "contact@greenearth.org",
      phone: "(555) 987-6543",
      description: "Environmental conservation and community cleanup organization",
      website: "https://greenearth.org",
      status: "APPROVED",
    },
  });

  const orgUser = await prisma.user.create({
    data: {
      email: "volunteer@greenearth.org",
      passwordHash: await bcrypt.hash("password123", 12),
      name: "Sarah Mitchell",
      role: "ORG_ADMIN",
      organizationId: org.id,
      emailVerified: true,
    },
  });

  // Create a second org
  const org2 = await prisma.organization.create({
    data: {
      name: "Community Library",
      email: "help@library.org",
      phone: "(555) 222-3333",
      description: "Local library tutoring and reading programs",
      status: "APPROVED",
    },
  });

  await prisma.user.create({
    data: {
      email: "staff@library.org",
      passwordHash: await bcrypt.hash("password123", 12),
      name: "Mike Chen",
      role: "ORG_ADMIN",
      organizationId: org2.id,
      emailVerified: true,
    },
  });

  // Approve orgs for school
  await prisma.schoolOrganization.create({
    data: { schoolId: school.id, organizationId: org.id, status: "APPROVED", approvedAt: new Date() },
  });
  await prisma.schoolOrganization.create({
    data: { schoolId: school.id, organizationId: org2.id, status: "APPROVED", approvedAt: new Date() },
  });

  // Create students — joined via classroom (implicitly associated with school)
  const student1 = await prisma.user.create({
    data: {
      email: "john@student.edu",
      passwordHash: await bcrypt.hash("password123", 12),
      name: "John Collander",
      role: "STUDENT",
      age: 16,
      grade: "11th",
      classroomId: generalClassroom.id,
      schoolId: school.id, // denormalized from classroom
      emailVerified: true,
    },
  });

  const student2 = await prisma.user.create({
    data: {
      email: "jane@student.edu",
      passwordHash: await bcrypt.hash("password123", 12),
      name: "Jane Davis",
      role: "STUDENT",
      age: 17,
      grade: "12th",
      classroomId: classroom2.id,
      schoolId: school.id,
      emailVerified: true,
    },
  });

  const student3 = await prisma.user.create({
    data: {
      email: "alex@student.edu",
      passwordHash: await bcrypt.hash("password123", 12),
      name: "Alex Rivera",
      role: "STUDENT",
      age: 15,
      grade: "10th",
      classroomId: generalClassroom.id,
      schoolId: school.id,
      emailVerified: true,
    },
  });

  // Create student groups
  const group1 = await prisma.studentGroup.create({
    data: { name: "Group #1", schoolId: school.id },
  });
  const group2 = await prisma.studentGroup.create({
    data: { name: "Group #2", schoolId: school.id },
  });

  await prisma.studentGroupMember.createMany({
    data: [
      { groupId: group1.id, studentId: student1.id },
      { groupId: group1.id, studentId: student2.id },
      { groupId: group2.id, studentId: student2.id },
      { groupId: group2.id, studentId: student3.id },
    ],
  });

  // Create opportunities
  const opp1 = await prisma.opportunity.create({
    data: {
      title: "Cleanup Soccer Field",
      description: "Help clean up the community soccer field and surrounding areas. Bring work gloves and water.",
      tags: JSON.stringify(["outdoors", "cleanup", "community"]),
      location: "18 Brookstreet Rd",
      date: new Date("2025-08-27"),
      startTime: "10:00 AM",
      endTime: "2:00 PM",
      durationHours: 4,
      capacity: 10,
      organizationId: org.id,
    },
  });

  const opp2 = await prisma.opportunity.create({
    data: {
      title: "Plant Flowers and Water Vegetables",
      description: "Community garden volunteer day. We'll be planting seasonal flowers and tending the vegetable garden.",
      tags: JSON.stringify(["gardening", "outdoors", "community"]),
      location: "145 Maple Street",
      date: new Date("2025-09-01"),
      startTime: "3:00 PM",
      endTime: "6:00 PM",
      durationHours: 3,
      capacity: 10,
      organizationId: org.id,
    },
  });

  const opp3 = await prisma.opportunity.create({
    data: {
      title: "Walk Dogs at Animal Shelter",
      description: "Walk dogs, play with cats and assist staff at the local animal shelter.",
      tags: JSON.stringify(["animals", "indoor", "outdoor"]),
      location: "82 Willow Rd",
      date: new Date("2025-09-13"),
      startTime: "9:00 AM",
      endTime: "12:00 PM",
      durationHours: 3,
      capacity: 10,
      organizationId: org.id,
    },
  });

  const opp4 = await prisma.opportunity.create({
    data: {
      title: "Tutor Elementary School Kids",
      description: "Tutor elementary school kids in reading and math at the community library.",
      tags: JSON.stringify(["education", "tutoring", "indoor"]),
      location: "210 River Street",
      date: new Date("2025-09-17"),
      startTime: "4:00 PM",
      endTime: "5:30 PM",
      durationHours: 1.5,
      capacity: 10,
      organizationId: org2.id,
    },
  });

  const opp5 = await prisma.opportunity.create({
    data: {
      title: "Food Drive Sorting",
      description: "Help sort and organize donations for the annual food drive.",
      tags: JSON.stringify(["food", "community", "indoor"]),
      location: "500 Oak Avenue",
      date: new Date("2025-09-20"),
      startTime: "1:00 PM",
      endTime: "4:00 PM",
      durationHours: 3,
      capacity: 15,
      organizationId: org2.id,
    },
  });

  // Create signups and sessions for student1
  for (const opp of [opp1, opp2]) {
    await prisma.signup.create({
      data: { userId: student1.id, opportunityId: opp.id, status: "CONFIRMED" },
    });
  }

  // Create a completed, verified session for student1
  await prisma.serviceSession.create({
    data: {
      userId: student1.id,
      opportunityId: opp1.id,
      checkInTime: new Date("2025-08-27T10:05:00"),
      checkOutTime: new Date("2025-08-27T14:00:00"),
      totalHours: 3.92,
      status: "VERIFIED",
      verificationStatus: "APPROVED",
      verifiedBy: orgUser.id,
      verifiedAt: new Date("2025-08-27T15:00:00"),
    },
  });

  // Create a pending session
  await prisma.serviceSession.create({
    data: {
      userId: student1.id,
      opportunityId: opp2.id,
      checkInTime: new Date("2025-09-01T15:10:00"),
      checkOutTime: new Date("2025-09-01T18:00:00"),
      totalHours: 2.83,
      status: "CHECKED_OUT",
      verificationStatus: "PENDING",
    },
  });

  // Student2 has more hours
  for (const opp of [opp1, opp3, opp4]) {
    await prisma.signup.create({
      data: { userId: student2.id, opportunityId: opp.id, status: "CONFIRMED" },
    });
    await prisma.serviceSession.create({
      data: {
        userId: student2.id,
        opportunityId: opp.id,
        checkInTime: new Date(opp.date.getTime() + 5 * 60000),
        checkOutTime: new Date(opp.date.getTime() + opp.durationHours * 3600000),
        totalHours: opp.durationHours - 0.08,
        status: "VERIFIED",
        verificationStatus: "APPROVED",
        verifiedBy: orgUser.id,
        verifiedAt: new Date(opp.date.getTime() + (opp.durationHours + 1) * 3600000),
      },
    });
  }

  // Audit logs
  await prisma.auditLog.create({
    data: {
      action: "CHECK_IN",
      actorId: student1.id,
      details: JSON.stringify({ time: "2025-08-27T10:05:00" }),
    },
  });

  console.log("Seed complete!");
  console.log("\nTest accounts:");
  console.log("  Student: john@student.edu / password123");
  console.log("  Student: jane@student.edu / password123");
  console.log("  Student: alex@student.edu / password123");
  console.log("  Organization: volunteer@greenearth.org / password123");
  console.log("  Organization: staff@library.org / password123");
  console.log("  School Admin: admin@lincoln.edu / password123");
  console.log(`\nClassroom invite codes:`);
  console.log(`  General: ${generalClassroom.inviteCode}`);
  console.log(`  AP Community Service: ${classroom2.inviteCode}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
