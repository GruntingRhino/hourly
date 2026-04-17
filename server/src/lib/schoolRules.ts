import prisma from "./prisma";

export interface EffectiveRules {
  schoolId: string;
  serviceStartDate: Date | null;
  serviceEndDate: Date | null;
  allowSelfSubmission: boolean;
  verificationStandard: string;
  requireOrgVerification: boolean;
  categoryHourCaps: Record<string, number> | null;
}

function parseCaps(json: string | null | undefined): Record<string, number> | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as Record<string, number>;
  } catch {
    return null;
  }
}

function requiresOrgVerification(verificationStandard: string | null | undefined, requireOrgVerification: boolean): boolean {
  return requireOrgVerification || verificationStandard === "BENEFICIARY_REQUIRED";
}

/**
 * Resolve effective service rules for a user.
 * For students: merges cohort overrides onto school defaults.
 * For school staff: returns school-level rules directly.
 */
export async function resolveEffectiveRules(userId: string): Promise<EffectiveRules | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      schoolId: true,
      cohort: {
        select: {
          schoolId: true,
          serviceStartDate: true,
          serviceEndDate: true,
          allowSelfSubmission: true,
          categoryHourCaps: true,
        },
      },
      classroom: { select: { schoolId: true } },
    },
  });
  if (!user) return null;

  const schoolId =
    user.schoolId ??
    user.cohort?.schoolId ??
    user.classroom?.schoolId ??
    null;
  if (!schoolId) return null;

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: {
      serviceStartDate: true,
      serviceEndDate: true,
      allowSelfSubmission: true,
      verificationStandard: true,
      requireOrgVerification: true,
      categoryHourCaps: true,
    },
  });
  if (!school) return null;

  const cohort = user.cohort;

  return {
    schoolId,
    serviceStartDate: cohort?.serviceStartDate ?? school.serviceStartDate,
    serviceEndDate: cohort?.serviceEndDate ?? school.serviceEndDate,
    allowSelfSubmission: cohort?.allowSelfSubmission ?? school.allowSelfSubmission,
    verificationStandard: school.verificationStandard,
    requireOrgVerification: requiresOrgVerification(school.verificationStandard, school.requireOrgVerification),
    categoryHourCaps: parseCaps(cohort?.categoryHourCaps) ?? parseCaps(school.categoryHourCaps),
  };
}

/**
 * Check if approving `newHours` for `studentId` in `category` would exceed their cap.
 */
export async function checkCategoryCap(
  studentId: string,
  category: string | null | undefined,
  newHours: number
): Promise<{ exceeded: boolean; cap: number; current: number; category: string }> {
  const rules = await resolveEffectiveRules(studentId);
  const cat = category || "general";

  if (!rules?.categoryHourCaps) {
    return { exceeded: false, cap: Infinity, current: 0, category: cat };
  }

  const cap = rules.categoryHourCaps[cat];
  if (cap === undefined) {
    return { exceeded: false, cap: Infinity, current: 0, category: cat };
  }

  const [benSignups, selfSubs] = await Promise.all([
    prisma.beneficiarySignup.findMany({
      where: { studentId, verificationStatus: "APPROVED" },
      select: {
        totalHours: true,
        slot: { select: { opportunity: { select: { category: true } } } },
      },
    }),
    prisma.selfSubmittedRequest.findMany({
      where: { studentId, status: "APPROVED" },
      select: { hours: true, category: true },
    }),
  ]);

  let current = 0;
  for (const bs of benSignups) {
    if ((bs.slot.opportunity.category || "general") === cat) {
      current += bs.totalHours ?? 0;
    }
  }
  for (const ss of selfSubs) {
    if ((ss.category || "general") === cat) {
      current += ss.hours;
    }
  }

  return { exceeded: current + newHours > cap, cap, current, category: cat };
}
