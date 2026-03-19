import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();

function generateInviteCode(): string {
  return crypto.randomBytes(4).toString("hex");
}

async function main() {
  const now = new Date();
  const plusDays = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  console.log("Cleaning up existing data...");
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "BeneficiaryAuditLog", "BeneficiarySignup", "BeneficiaryTimeSlot",
      "BeneficiaryOpportunity", "BeneficiaryInvitation", "SchoolBeneficiaryApproval",
      "AuditLog", "Message", "Notification", "SavedOpportunity",
      "StudentGroupMember", "StudentGroup", "ServiceSession",
      "Signup", "SchoolOrganization", "Classroom", "Opportunity",
      "SelfSubmittedRequest", "StudentInvitation", "Cohort", "VerifiedDomain",
      "User", "School", "Organization", "Beneficiary"
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
      zipCodes: JSON.stringify(["10001"]), // Midtown Manhattan
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

  // ─── Create Beneficiaries (new architecture) ───────────────────────────────

  const ben1 = await prisma.beneficiary.create({
    data: {
      name: "Green Earth Foundation",
      email: "contact@greenearth.org",
      phone: "(555) 987-6543",
      description: "Environmental conservation and community cleanup organization",
      website: "https://greenearth.org",
      category: "Environment",
      address: "150 E Houston St",
      city: "New York",
      state: "NY",
      zip: "10002",
      latitude: 40.7223,
      longitude: -73.9874,
      status: "ACTIVE",
      visibility: "PUBLIC",
    },
  });

  const ben2 = await prisma.beneficiary.create({
    data: {
      name: "Community Library",
      email: "help@library.org",
      phone: "(555) 222-3333",
      description: "Local library tutoring and reading programs",
      website: "https://communitylibrary.org",
      category: "Education",
      address: "90210 Rodeo Dr",
      city: "Beverly Hills",
      state: "CA",
      zip: "90210",
      latitude: 34.0696,
      longitude: -118.4055,
      status: "ACTIVE",
      visibility: "PUBLIC",
    },
  });

  // Create beneficiary admin users (linked to beneficiaries)
  const ben1User = await prisma.user.create({
    data: {
      email: "volunteer@greenearth.org",
      passwordHash: await bcrypt.hash("password123", 12),
      name: "Sarah Mitchell",
      role: "BENEFICIARY_ADMIN",
      beneficiaryId: ben1.id,
      emailVerified: true,
    },
  });

  const ben2User = await prisma.user.create({
    data: {
      email: "staff@library.org",
      passwordHash: await bcrypt.hash("password123", 12),
      name: "Mike Chen",
      role: "BENEFICIARY_ADMIN",
      beneficiaryId: ben2.id,
      emailVerified: true,
    },
  });

  // School approves both beneficiaries
  await prisma.schoolBeneficiaryApproval.create({
    data: {
      schoolId: school.id,
      beneficiaryId: ben1.id,
      status: "APPROVED",
      approvedAt: new Date(),
    },
  });
  await prisma.schoolBeneficiaryApproval.create({
    data: {
      schoolId: school.id,
      beneficiaryId: ben2.id,
      status: "APPROVED",
      approvedAt: new Date(),
    },
  });

  // Create a pending invitation record (school invited ben1 via directory)
  await prisma.beneficiaryInvitation.create({
    data: {
      schoolId: school.id,
      beneficiaryId: ben1.id,
      token: crypto.randomBytes(32).toString("hex"),
      expiresAt: plusDays(30),
      sentTo: "contact@greenearth.org",
      status: "ACCEPTED",
      acceptedAt: new Date(),
    },
  });

  // ─── BeneficiaryOpportunity + TimeSlots ────────────────────────────────────

  const opp_ben1_a = await prisma.beneficiaryOpportunity.create({
    data: {
      title: "Park Cleanup Day",
      description: "Help clean up Central Park trails and surrounding areas. Bring work gloves and water.",
      beneficiaryId: ben1.id,
      category: "Environment",
      location: "Central Park, New York, NY",
      requirementsNote: "Wear closed-toe shoes. Gloves provided.",
      startDate: plusDays(5),
      endDate: plusDays(30),
      status: "ACTIVE",
      timeSlots: {
        create: [
          {
            date: plusDays(5),
            startTime: "10:00 AM",
            endTime: "2:00 PM",
            durationHours: 4,
            capacity: 10,
          },
          {
            date: plusDays(12),
            startTime: "10:00 AM",
            endTime: "2:00 PM",
            durationHours: 4,
            capacity: 10,
          },
          {
            date: plusDays(19),
            startTime: "9:00 AM",
            endTime: "1:00 PM",
            durationHours: 4,
            capacity: 8,
          },
        ],
      },
    },
  });

  const opp_ben1_b = await prisma.beneficiaryOpportunity.create({
    data: {
      title: "Community Garden Planting",
      description: "Plant seasonal flowers and tend the vegetable garden in our community plot.",
      beneficiaryId: ben1.id,
      category: "Environment",
      location: "145 Maple Street, New York, NY",
      startDate: plusDays(7),
      status: "ACTIVE",
      timeSlots: {
        create: [
          {
            date: plusDays(7),
            startTime: "3:00 PM",
            endTime: "6:00 PM",
            durationHours: 3,
            capacity: 10,
          },
          {
            date: plusDays(14),
            startTime: "3:00 PM",
            endTime: "6:00 PM",
            durationHours: 3,
            capacity: 10,
          },
        ],
      },
    },
  });

  const opp_ben2_a = await prisma.beneficiaryOpportunity.create({
    data: {
      title: "After-School Tutoring",
      description: "Tutor elementary school kids in reading and math at the community library.",
      beneficiaryId: ben2.id,
      category: "Education",
      location: "210 River Street, Beverly Hills, CA",
      requirementsNote: "Minimum 16 years old. Background check required.",
      startDate: plusDays(3),
      status: "ACTIVE",
      timeSlots: {
        create: [
          {
            date: plusDays(3),
            startTime: "4:00 PM",
            endTime: "5:30 PM",
            durationHours: 1.5,
            capacity: 6,
          },
          {
            date: plusDays(10),
            startTime: "4:00 PM",
            endTime: "5:30 PM",
            durationHours: 1.5,
            capacity: 6,
          },
          {
            date: plusDays(17),
            startTime: "4:00 PM",
            endTime: "5:30 PM",
            durationHours: 1.5,
            capacity: 6,
          },
        ],
      },
    },
  });

  // ─── Legacy Organization + Opportunities (kept for session history) ─────────

  const org = await prisma.organization.create({
    data: {
      name: "Green Earth Foundation",
      email: "contact@greenearth.org",
      phone: "(555) 987-6543",
      description: "Environmental conservation and community cleanup organization",
      website: "https://greenearth.org",
      status: "APPROVED",
      zipCodes: JSON.stringify(["10002"]),
    },
  });

  const org2 = await prisma.organization.create({
    data: {
      name: "Community Library",
      email: "help@library.org",
      phone: "(555) 222-3333",
      description: "Local library tutoring and reading programs",
      status: "APPROVED",
      zipCodes: JSON.stringify(["90210"]),
    },
  });

  // Approve orgs for school (legacy)
  await prisma.schoolOrganization.create({
    data: { schoolId: school.id, organizationId: org.id, status: "APPROVED", approvedAt: new Date() },
  });
  await prisma.schoolOrganization.create({
    data: { schoolId: school.id, organizationId: org2.id, status: "APPROVED", approvedAt: new Date() },
  });

  // Create students
  const student1 = await prisma.user.create({
    data: {
      email: "john@student.edu",
      passwordHash: await bcrypt.hash("password123", 12),
      name: "John Collander",
      role: "STUDENT",
      grade: "11th",
      classroomId: generalClassroom.id,
      schoolId: school.id,
      emailVerified: true,
    },
  });

  const student2 = await prisma.user.create({
    data: {
      email: "jane@student.edu",
      passwordHash: await bcrypt.hash("password123", 12),
      name: "Jane Davis",
      role: "STUDENT",
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
      grade: "10th",
      classroomId: generalClassroom.id,
      schoolId: school.id,
      emailVerified: true,
    },
  });

  // Reserve QA inboxes
  for (let i = 1; i <= 20; i += 1) {
    const suffix = String(i).padStart(2, "0");
    await prisma.user.create({
      data: {
        email: `qa-test-${suffix}@mailinator.com`,
        passwordHash: await bcrypt.hash("Password1!", 12),
        name: `QA Reserved ${suffix}`,
        role: "STUDENT",
        emailVerified: false,
      },
    });
  }

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

  // ─── Legacy Opportunities (for service session history) ─────────────────────

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
      title: "R Waitlist Probe",
      description: "Deterministic waitlist seed opportunity for QA promotion flow.",
      tags: JSON.stringify(["food", "community", "indoor"]),
      location: "500 Oak Avenue",
      date: new Date("2025-08-28"),
      startTime: "1:00 PM",
      endTime: "4:00 PM",
      durationHours: 3,
      capacity: 2,
      organizationId: org2.id,
    },
  });

  const opp6 = await prisma.opportunity.create({
    data: {
      title: "QA Upcoming Check-In Session",
      description: "Seeded future session for deterministic check-in/check-out coverage.",
      tags: JSON.stringify(["qa", "upcoming"]),
      location: "500 Example Road",
      date: plusDays(2),
      startTime: "9:00 AM",
      endTime: "11:00 AM",
      durationHours: 2,
      capacity: 5,
      organizationId: org.id,
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
      verifiedBy: ben1User.id,
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

  for (const opp of [opp3, opp4]) {
    await prisma.signup.create({
      data: { userId: student1.id, opportunityId: opp.id, status: "CONFIRMED" },
    });
    await prisma.serviceSession.create({
      data: {
        userId: student1.id,
        opportunityId: opp.id,
        checkInTime: new Date(opp.date.getTime() + 5 * 60000),
        checkOutTime: new Date(opp.date.getTime() + opp.durationHours * 3600000),
        totalHours: Math.max(0, opp.durationHours - 0.08),
        status: "VERIFIED",
        verificationStatus: "APPROVED",
        verifiedBy: opp.organizationId === org2.id ? ben2User.id : ben1User.id,
        verifiedAt: new Date(opp.date.getTime() + (opp.durationHours + 1) * 3600000),
      },
    });
  }

  await prisma.signup.create({
    data: { userId: student1.id, opportunityId: opp6.id, status: "CONFIRMED" },
  });
  await prisma.serviceSession.create({
    data: {
      userId: student1.id,
      opportunityId: opp6.id,
      totalHours: opp6.durationHours,
      status: "PENDING_CHECKIN",
      verificationStatus: "PENDING",
    },
  });

  // Student2 has more hours
  for (const opp of [opp1, opp3, opp4]) {
    const orgQueuePending = opp.organizationId === org.id;
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
        status: orgQueuePending ? "CHECKED_OUT" : "VERIFIED",
        verificationStatus: orgQueuePending ? "PENDING" : "APPROVED",
        verifiedBy: orgQueuePending ? null : ben1User.id,
        verifiedAt: orgQueuePending ? null : new Date(opp.date.getTime() + (opp.durationHours + 1) * 3600000),
      },
    });
  }

  await prisma.signup.create({
    data: { userId: student3.id, opportunityId: opp5.id, status: "CONFIRMED" },
  });
  await prisma.serviceSession.create({
    data: {
      userId: student3.id,
      opportunityId: opp5.id,
      checkInTime: new Date("2025-08-28T13:05:00"),
      checkOutTime: new Date("2025-08-28T16:00:00"),
      totalHours: 2.92,
      status: "CHECKED_OUT",
      verificationStatus: "PENDING",
    },
  });

  // ─── BeneficiarySignup samples (for beneficiary admin view) ─────────────────

  // Get the first time slots
  const slots = await prisma.beneficiaryTimeSlot.findMany({
    where: { opportunity: { beneficiaryId: ben1.id } },
    orderBy: { date: "asc" },
    take: 2,
  });

  if (slots.length >= 1) {
    // student1 signed up and checked in — details visible to beneficiary admin
    await prisma.beneficiarySignup.create({
      data: {
        slotId: slots[0].id,
        studentId: student1.id,
        status: "CONFIRMED",
        checkedIn: true,
        checkedInAt: new Date(slots[0].date.getTime() - 5 * 60000),
        verificationStatus: "PENDING",
      },
    });
    // student2 signed up but NOT checked in — details masked
    await prisma.beneficiarySignup.create({
      data: {
        slotId: slots[0].id,
        studentId: student2.id,
        status: "CONFIRMED",
        checkedIn: false,
        verificationStatus: "PENDING",
      },
    });
  }

  // Audit log
  await prisma.auditLog.create({
    data: {
      action: "CHECK_IN",
      actorId: student1.id,
      details: JSON.stringify({ time: "2025-08-27T10:05:00" }),
    },
  });

  console.log("Seed complete!");
  console.log("\nTest accounts:");
  console.log("  Student:            john@student.edu / password123");
  console.log("  Student:            jane@student.edu / password123");
  console.log("  Student:            alex@student.edu / password123");
  console.log("  Beneficiary Admin:  volunteer@greenearth.org / password123");
  console.log("  Beneficiary Admin:  staff@library.org / password123");
  console.log("  School Admin:       admin@lincoln.edu / password123");
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
