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

export interface CategoryCapStatus {
  category: string;
  cap: number;
  approvedHours: number;
  remainingHours: number;
  maxedOut: boolean;
  alreadyOverCap: boolean;
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

const CATEGORY_ALIASES: Record<string, string> = {
  arts: "arts & culture",
  "arts and culture": "arts & culture",
  community: "community improvement",
  mentoring: "tutoring & mentoring",
  tutoring: "tutoring & mentoring",
  food: "food & nutrition",
  health: "health care",
};

export function normalizeCategoryKey(category: string | null | undefined): string {
  const normalized = (category || "general").trim().toLowerCase();
  return CATEGORY_ALIASES[normalized] ?? normalized;
}

function buildNormalizedCapLookup(caps: Record<string, number> | null | undefined): Map<string, { label: string; cap: number }> {
  const lookup = new Map<string, { label: string; cap: number }>();
  if (!caps) return lookup;
  for (const [label, cap] of Object.entries(caps)) {
    lookup.set(normalizeCategoryKey(label), { label, cap });
  }
  return lookup;
}

export async function getApprovedCategoryHoursForStudent(studentId: string): Promise<Map<string, number>> {
  const [benSignups, selfSubs] = await Promise.all([
    prisma.beneficiarySignup.findMany({
      where: { studentId, verificationStatus: "APPROVED" },
      select: {
        totalHours: true,
        slot: {
          select: {
            durationHours: true,
            opportunity: { select: { category: true } },
          },
        },
      },
    }),
    prisma.selfSubmittedRequest.findMany({
      where: { studentId, status: "APPROVED" },
      select: { hours: true, category: true },
    }),
  ]);

  const totals = new Map<string, number>();
  const add = (category: string | null | undefined, hours: number) => {
    const key = normalizeCategoryKey(category);
    totals.set(key, (totals.get(key) ?? 0) + hours);
  };

  for (const signup of benSignups) {
    add(signup.slot.opportunity.category, signup.totalHours ?? signup.slot.durationHours);
  }
  for (const submission of selfSubs) {
    add(submission.category, submission.hours);
  }

  return totals;
}

export async function getCategoryCapStatusesForStudent(studentId: string): Promise<CategoryCapStatus[]> {
  const rules = await resolveEffectiveRules(studentId);
  if (!rules?.categoryHourCaps) return [];

  const approvedHours = await getApprovedCategoryHoursForStudent(studentId);
  const capLookup = buildNormalizedCapLookup(rules.categoryHourCaps);

  return Array.from(capLookup.entries()).map(([key, value]) => {
    const current = approvedHours.get(key) ?? 0;
    return {
      category: value.label,
      cap: value.cap,
      approvedHours: current,
      remainingHours: Math.max(0, value.cap - current),
      maxedOut: current >= value.cap,
      alreadyOverCap: current > value.cap,
    };
  });
}

export async function getBlockedCategoryKeysForStudent(studentId: string): Promise<Set<string>> {
  const statuses = await getCategoryCapStatusesForStudent(studentId);
  return new Set(
    statuses
      .filter((status) => status.maxedOut || status.alreadyOverCap)
      .map((status) => normalizeCategoryKey(status.category)),
  );
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
  const cat = normalizeCategoryKey(category);

  if (!rules?.categoryHourCaps) {
    return { exceeded: false, cap: Infinity, current: 0, category: category || "general" };
  }

  const capLookup = buildNormalizedCapLookup(rules.categoryHourCaps);
  const matchedCap = capLookup.get(cat);
  if (!matchedCap) {
    return { exceeded: false, cap: Infinity, current: 0, category: category || "general" };
  }
  const approvedHours = await getApprovedCategoryHoursForStudent(studentId);
  const current = approvedHours.get(cat) ?? 0;

  return {
    exceeded: current + newHours > matchedCap.cap,
    cap: matchedCap.cap,
    current,
    category: matchedCap.label,
  };
}
