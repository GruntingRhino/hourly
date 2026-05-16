import prisma from "./prisma";

type DbClient = Pick<typeof prisma, "studentCohortMembership" | "user">;

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
  schoolId?: string | null;
  db?: DbClient;
}): Promise<{ id: string; studentId: string; cohortId: string; source: string; isActive: boolean }> {
  const db = params.db ?? prisma;
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

  const student = await db.user.findUnique({
    where: { id: params.studentId },
    select: { cohortId: true, schoolId: true },
  });
  if (!student) return membership;

  const nextPrimaryCohortId =
    params.forcePrimary || !student.cohortId
      ? params.cohortId
      : student.cohortId;

  const nextSchoolId = student.schoolId ?? params.schoolId ?? null;
  if (student.cohortId !== nextPrimaryCohortId || student.schoolId !== nextSchoolId) {
    await db.user.update({
      where: { id: params.studentId },
      data: {
        cohortId: nextPrimaryCohortId,
        schoolId: nextSchoolId,
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
