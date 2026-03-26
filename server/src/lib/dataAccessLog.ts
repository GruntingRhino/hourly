import prisma from "./prisma";

/**
 * Log a data access event for FERPA audit purposes.
 * Non-blocking — failures are swallowed so they never break the request.
 */
export async function logDataAccess(params: {
  actorId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  schoolId?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.dataAccessLog.create({
      data: {
        actorId: params.actorId,
        action: params.action,
        targetType: params.targetType ?? null,
        targetId: params.targetId ?? null,
        schoolId: params.schoolId ?? null,
        details: params.details ? JSON.stringify(params.details) : null,
      },
    });
  } catch {
    // intentionally swallowed — audit log failures must not disrupt the user flow
  }
}

/**
 * Resolve a student's school ID by checking cohort or classroom association.
 * Returns null if the student cannot be linked to a school.
 */
export async function resolveStudentSchoolId(studentId: string): Promise<string | null> {
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: {
      schoolId: true,
      cohort: { select: { schoolId: true } },
      classroom: { select: { schoolId: true } },
    },
  });
  if (!student) return null;
  return student.classroom?.schoolId ?? student.cohort?.schoolId ?? student.schoolId ?? null;
}
