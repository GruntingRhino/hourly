import prisma from "./prisma";

type DbClient = Pick<typeof prisma, "studentCohortMembership" | "user" | "cohort">;

function tenantBoundaryViolation(): Error & { status: number; code: string } {
  return Object.assign(new Error("Cross-school membership rejected"), {
    status: 403,
    code: "TENANT_BOUNDARY_VIOLATION",
  });
}

async function choosePrimaryCohortId(db: DbClient, studentId: string): Promise<string | null> {
  const memberships = await db.studentCohortMembership.findMany({
    where: { studentId, isActive: true },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: { cohortId: true },
  });
  return memberships[0]?.cohortId ?? null;
}

export async function ensureStudentCohortMembership(params: {
  studentId: string;
  cohortId: string;
  source: "MANUAL" | "INVITATION" | "CANVAS" | "GOOGLE_CLASSROOM";
  forcePrimary?: boolean;
  schoolId: string;
  db?: DbClient;
}): Promise<{ id: string; studentId: string; cohortId: string; source: string; isActive: boolean }> {
  const db = params.db ?? prisma;
  const [student, cohort] = await Promise.all([
    db.user.findUnique({
      where: { id: params.studentId },
      select: { id: true, role: true, schoolId: true, cohortId: true },
    }),
    db.cohort.findUnique({
      where: { id: params.cohortId },
      select: { id: true, schoolId: true },
    }),
  ]);

  if (
    !student ||
    student.role !== "STUDENT" ||
    !cohort ||
    student.schoolId !== params.schoolId ||
    cohort.schoolId !== params.schoolId
  ) {
    throw tenantBoundaryViolation();
  }

  const membership = await db.studentCohortMembership.upsert({
    where: { studentId_cohortId: { studentId: params.studentId, cohortId: params.cohortId } },
    update: {
      isActive: true,
      source: params.source,
    },
    create: {
      studentId: params.studentId,
      cohortId: params.cohortId,
      source: params.source,
      isActive: true,
    },
  });

  const nextPrimaryCohortId =
    params.forcePrimary || !student.cohortId
      ? params.cohortId
      : student.cohortId;

  if (student.cohortId !== nextPrimaryCohortId) {
    await db.user.update({
      where: { id: params.studentId },
      data: {
        cohortId: nextPrimaryCohortId,
      },
    });
  }

  return membership;
}

export async function deactivateStudentCohortMembership(params: {
  studentId: string;
  cohortId: string;
  clearPrimaryIfMatches?: boolean;
  db?: DbClient;
}): Promise<void> {
  const db = params.db ?? prisma;
  await db.studentCohortMembership.updateMany({
    where: { studentId: params.studentId, cohortId: params.cohortId, isActive: true },
    data: { isActive: false },
  });

  if (!params.clearPrimaryIfMatches) return;

  const student = await db.user.findUnique({
    where: { id: params.studentId },
    select: { cohortId: true },
  });
  if (!student || student.cohortId !== params.cohortId) return;

  const nextPrimaryCohortId = await choosePrimaryCohortId(db, params.studentId);
  await db.user.update({
    where: { id: params.studentId },
    data: { cohortId: nextPrimaryCohortId },
  });
}
