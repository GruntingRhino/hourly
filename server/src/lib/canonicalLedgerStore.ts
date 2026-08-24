import { randomUUID } from "node:crypto";
import prisma from "./prisma";
import { resolveStudentSchoolId } from "./dataAccessLog";

export async function syncStudentCanonicalLedger(studentId: string) {
  const schoolId = await resolveStudentSchoolId(studentId);
  if (!schoolId) throw new Error("Student is not associated with a school");
  const [student, selfSubmissions, sessions, beneficiarySignups] = await Promise.all([
    prisma.user.findUnique({ where: { id: studentId }, select: { id: true } }),
    prisma.selfSubmittedRequest.findMany({ where: { studentId, schoolId, status: "APPROVED" } }),
    prisma.serviceSession.findMany({ where: { userId: studentId, verificationStatus: "APPROVED" }, include: { opportunity: { include: { organization: { select: { name: true } } } } } }),
    prisma.beneficiarySignup.findMany({ where: { studentId, verificationStatus: "APPROVED", status: { not: "CANCELLED" } }, include: { slot: { include: { opportunity: { include: { beneficiary: { select: { name: true } } } } } } } }),
  ]);
  if (!student) throw new Error("Student not found");
  const entries = [
    ...selfSubmissions.map((item) => ({ source: "SELF_SUBMISSION", sourceId: item.id, serviceDate: item.date, organizationName: item.organizationName, description: item.description, hours: item.hours, verifiedBy: item.reviewedBy, verifiedAt: item.reviewedAt })),
    ...sessions.map((item) => ({ source: "LEGACY_SESSION", sourceId: item.id, serviceDate: item.opportunity.date, organizationName: item.opportunity.organization.name, description: item.opportunity.title, hours: item.totalHours ?? 0, verifiedBy: item.verifiedBy, verifiedAt: item.verifiedAt })),
    ...beneficiarySignups.map((item) => ({ source: "BENEFICIARY_SIGNUP", sourceId: item.id, serviceDate: item.slot.date, organizationName: item.slot.opportunity.beneficiary.name, description: item.slot.opportunity.title, hours: item.totalHours ?? item.slot.durationHours, verifiedBy: item.verifiedBy, verifiedAt: item.verifiedAt })),
  ];
  for (const entry of entries) {
    await prisma.canonicalLedgerEntry.upsert({
      where: { source_sourceId: { source: entry.source, sourceId: entry.sourceId } },
      create: { id: randomUUID(), studentId, schoolId, ...entry },
      update: { studentId, schoolId, ...entry },
    });
  }
  return prisma.canonicalLedgerEntry.findMany({ where: { studentId, schoolId }, orderBy: [{ serviceDate: "asc" }, { id: "asc" }] });
}
