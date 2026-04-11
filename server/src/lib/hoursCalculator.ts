import prisma from "./prisma";

export interface StudentHours {
  approved: number;
  pending: number;
}

/**
 * Calculate total approved and pending hours for one or more students,
 * combining all three hour sources:
 *   1. BeneficiarySignup  (verificationStatus = "APPROVED" / "PENDING")
 *   2. SelfSubmittedRequest (status = "APPROVED" / "PENDING")
 *   3. ServiceSession     (verificationStatus = "APPROVED" / "PENDING", legacy)
 *
 * Returns a Map keyed by studentId.
 */
export async function calculateStudentHours(
  studentIds: string[]
): Promise<Map<string, StudentHours>> {
  if (studentIds.length === 0) return new Map();

  const [benSignups, selfSubs, sessions] = await Promise.all([
    prisma.beneficiarySignup.findMany({
      where: {
        studentId: { in: studentIds },
        verificationStatus: { in: ["APPROVED", "PENDING"] },
        status: { not: "CANCELLED" },
      },
      select: { studentId: true, totalHours: true, verificationStatus: true, slot: { select: { durationHours: true } } },
    }),
    prisma.selfSubmittedRequest.findMany({
      where: {
        studentId: { in: studentIds },
        status: { in: ["APPROVED", "PENDING"] },
      },
      select: { studentId: true, hours: true, status: true },
    }),
    prisma.serviceSession.findMany({
      where: {
        userId: { in: studentIds },
        verificationStatus: { in: ["APPROVED", "PENDING"] },
      },
      select: { userId: true, totalHours: true, verificationStatus: true },
    }),
  ]);

  const result = new Map<string, StudentHours>();

  const get = (id: string): StudentHours => {
    if (!result.has(id)) result.set(id, { approved: 0, pending: 0 });
    return result.get(id)!;
  };

  for (const bs of benSignups) {
    const entry = get(bs.studentId);
    const hours = bs.totalHours ?? bs.slot.durationHours;
    if (bs.verificationStatus === "APPROVED") {
      entry.approved += hours;
    } else {
      entry.pending += bs.slot.durationHours;
    }
  }

  for (const ss of selfSubs) {
    const entry = get(ss.studentId);
    if (ss.status === "APPROVED") {
      entry.approved += ss.hours;
    } else {
      entry.pending += ss.hours;
    }
  }

  for (const s of sessions) {
    const entry = get(s.userId);
    if (s.verificationStatus === "APPROVED") {
      entry.approved += s.totalHours ?? 0;
    } else {
      entry.pending += s.totalHours ?? 0;
    }
  }

  return result;
}
