import type { Request } from "express";
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

export function buildRequestAuditMetadata(req: Request): Record<string, unknown> {
  const forwardedFor = req.headers["x-forwarded-for"];
  const requestIp = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : typeof forwardedFor === "string"
      ? forwardedFor.split(",")[0]?.trim() || null
      : req.ip || null;
  const userAgent = typeof req.headers["user-agent"] === "string"
    ? req.headers["user-agent"].trim().slice(0, 200)
    : null;

  return {
    requestIp,
    userAgent,
  };
}

export function summarizeStudentSubjects(
  students: Array<{ name: string | null; email?: string | null }>,
  limit = 25
): Record<string, unknown> {
  const includedStudents = students
    .map((student) => (student.name || student.email || "").trim())
    .filter(Boolean);

  return {
    studentCount: includedStudents.length,
    includedStudents: includedStudents.slice(0, limit),
    omittedStudentCount: Math.max(0, includedStudents.length - limit),
  };
}
