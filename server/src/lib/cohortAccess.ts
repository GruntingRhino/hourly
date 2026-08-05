import prisma from "./prisma";

export type StaffAccessScope = {
  userId: string;
  role: "SCHOOL_ADMIN" | "TEACHER";
  schoolId: string;
  assignedCohortIds: string[];
  isSchoolAdmin: boolean;
};

export async function getStaffAccessScope(userId: string): Promise<StaffAccessScope | null> {
  let user:
    | {
        id: string;
        role: "SCHOOL_ADMIN" | "TEACHER" | string;
        schoolId: string | null;
        assignedCohorts: Array<{ cohortId: string }>;
      }
    | null;

  try {
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        schoolId: true,
        assignedCohorts: { select: { cohortId: true } },
      },
    });
  } catch (err) {
    if (!(err instanceof Error) || !err.message.includes("CohortTeacherAssignment")) {
      throw err;
    }

    user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        schoolId: true,
      },
    }).then((entry) => entry ? { ...entry, assignedCohorts: [] } : null);
  }
  if (!user?.schoolId) return null;
  if (user.role !== "SCHOOL_ADMIN" && user.role !== "TEACHER") return null;
  return {
    userId: user.id,
    role: user.role,
    schoolId: user.schoolId,
    assignedCohortIds: user.assignedCohorts.map((assignment) => assignment.cohortId),
    isSchoolAdmin: user.role === "SCHOOL_ADMIN",
  };
}

export function getAccessibleCohortIds(scope: StaffAccessScope): string[] | null {
  return scope.isSchoolAdmin ? null : scope.assignedCohortIds;
}

export function ensureTeacherHasAssignedCohorts(scope: StaffAccessScope): boolean {
  return scope.isSchoolAdmin || scope.assignedCohortIds.length > 0;
}

export function canAccessCohort(scope: StaffAccessScope, cohortId: string): boolean {
  return scope.isSchoolAdmin || scope.assignedCohortIds.includes(cohortId);
}

export function buildCohortScopedStudentWhere(scope: StaffAccessScope): Record<string, unknown> {
  // isTestAccount is documented on the schema ("hidden from all lists") but
  // was never actually excluded anywhere — Canvas/Google Classroom
  // integration test flows write it, but no query filtered it back out, so
  // QA/Playwright fixture students would appear mixed into real staff-facing
  // rosters, reports, and messaging audiences. This is the central
  // cohort-scoping helper every staff-facing "list students" query in
  // routes/{cohorts,reports,messages,selfSubmissions,schools,sessions}.ts
  // already builds its where clause from, so excluding it here is the
  // single highest-coverage fix for the documented intent.
  if (scope.isSchoolAdmin) {
    return {
      schoolId: scope.schoolId,
      isTestAccount: false,
    };
  }

  return {
    schoolId: scope.schoolId,
    isTestAccount: false,
    OR: [
      { cohortId: { in: scope.assignedCohortIds } },
      { cohortMemberships: { some: { isActive: true, cohortId: { in: scope.assignedCohortIds } } } },
    ],
  };
}

export async function assertStudentAccessibleToStaff(
  scope: StaffAccessScope,
  studentId: string
): Promise<boolean> {
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: {
      role: true,
      schoolId: true,
      cohortId: true,
      cohort: { select: { schoolId: true } },
      cohortMemberships: {
        where: { isActive: true },
        select: {
          cohortId: true,
          cohort: { select: { schoolId: true } },
        },
      },
      classroom: { select: { schoolId: true } },
    },
  });
  if (!student || student.role !== "STUDENT") return false;

  if (student.schoolId !== scope.schoolId) return false;

  if (scope.isSchoolAdmin) return true;
  if (student.cohortId && scope.assignedCohortIds.includes(student.cohortId)) return true;
  return student.cohortMemberships.some((membership) => scope.assignedCohortIds.includes(membership.cohortId));
}

export async function getAccessibleTeacherCohorts(scope: StaffAccessScope): Promise<Array<{ id: string; name: string }>> {
  return prisma.cohort.findMany({
    where: {
      schoolId: scope.schoolId,
      ...(scope.isSchoolAdmin ? {} : { id: { in: scope.assignedCohortIds } }),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
