import prisma from "./prisma";

export interface StudentHours {
  approved: number;
  pending: number;
}

/**
 * The returned Map carries dataState/failedSources as extra properties
 * rather than changing the return type to an object wrapper, so every
 * existing `.get(id)` call site keeps working unchanged. Callers that care
 * whether the result is authoritative should check `.dataState` before
 * treating a student's hours as final — a PARTIAL result means one or more
 * underlying sources failed and this student's true total may be higher
 * than what's reflected here (never lower: failed sources are simply
 * omitted, not zeroed out and asserted as correct).
 */
export type StudentHoursMap = Map<string, StudentHours> & {
  dataState: "COMPLETE" | "PARTIAL";
  failedSources: string[];
};

/**
 * Calculate total approved and pending hours for one or more students,
 * combining all three hour sources:
 *   1. BeneficiarySignup  (verificationStatus = "APPROVED"; pending only when status = "CONFIRMED")
 *   2. SelfSubmittedRequest (status = "APPROVED" / "PENDING" / "REVISION_REQUESTED")
 *   3. ServiceSession     (verificationStatus = "APPROVED" / "PENDING", legacy)
 *
 * Returns a Map keyed by studentId. See StudentHoursMap for the
 * dataState/failedSources contract when a source lookup fails.
 */
export async function calculateStudentHours(
  studentIds: string[],
  schoolId: string
): Promise<StudentHoursMap> {
  if (studentIds.length === 0) {
    return Object.assign(new Map<string, StudentHours>(), { dataState: "COMPLETE" as const, failedSources: [] });
  }

  let benSignups: Array<{
    studentId: string;
    totalHours: number | null;
    verificationStatus: string;
    status: string;
    slot: { durationHours: number } | null;
  }> = [];
  let selfSubs: Array<{ studentId: string; hours: number; status: string }> = [];
  let sessions: Array<{ userId: string; totalHours: number | null; verificationStatus: string }> = [];

  const queries = await Promise.allSettled([
    prisma.beneficiarySignup.findMany({
      where: {
        studentId: { in: studentIds },
        schoolId,
        verificationStatus: { in: ["APPROVED", "PENDING"] },
        status: { not: "CANCELLED" },
      },
      select: { studentId: true, totalHours: true, verificationStatus: true, status: true, slot: { select: { durationHours: true } } },
    }),
    prisma.selfSubmittedRequest.findMany({
      where: {
        studentId: { in: studentIds },
        schoolId,
        status: { in: ["APPROVED", "PENDING", "REVISION_REQUESTED"] },
      },
      select: { studentId: true, hours: true, status: true },
    }),
    prisma.serviceSession.findMany({
      where: {
        userId: { in: studentIds },
        schoolId,
        verificationStatus: { in: ["APPROVED", "PENDING"] },
      },
      select: { userId: true, totalHours: true, verificationStatus: true },
    }),
  ]);

  const failedSources: string[] = [];
  if (queries[0].status === "fulfilled") benSignups = queries[0].value;
  else {
    failedSources.push("beneficiarySignup");
    console.warn("[hoursCalculator] beneficiarySignup lookup failed; omitting this source:", queries[0].reason);
  }
  if (queries[1].status === "fulfilled") selfSubs = queries[1].value;
  else {
    failedSources.push("selfSubmittedRequest");
    console.warn("[hoursCalculator] selfSubmittedRequest lookup failed; omitting this source:", queries[1].reason);
  }
  if (queries[2].status === "fulfilled") sessions = queries[2].value;
  else {
    failedSources.push("serviceSession");
    console.warn("[hoursCalculator] serviceSession lookup failed; omitting this source:", queries[2].reason);
  }
  const result = new Map<string, StudentHours>();

  const get = (id: string): StudentHours => {
    if (!result.has(id)) result.set(id, { approved: 0, pending: 0 });
    return result.get(id)!;
  };

  for (const bs of benSignups) {
    const entry = get(bs.studentId);
    const slotHours = bs.slot?.durationHours ?? 0;
    if (bs.verificationStatus === "APPROVED") {
      entry.approved += bs.totalHours ?? slotHours;
    } else if (bs.status === "CONFIRMED") {
      // Only count as pending if the student's spot is confirmed (not waitlisted)
      entry.pending += slotHours;
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

  return Object.assign(result, {
    dataState: (failedSources.length ? "PARTIAL" : "COMPLETE") as "COMPLETE" | "PARTIAL",
    failedSources,
  });
}
