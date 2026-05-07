import { Router, Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import { parse } from "csv-parse/sync";
import prisma from "../lib/prisma";
import { runSerializableTransaction } from "../lib/serializableTransaction";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { sendPasswordResetEmail, sendStudentInvitationEmail, CLIENT_URL } from "../services/email";
import { buildStudentProgressRecords } from "../lib/studentProgress";
import { logDataAccess } from "../lib/dataAccessLog";
import { safeSchoolSelect } from "../lib/schoolSelect";
import {
  assertStudentAccessibleToStaff,
  buildCohortScopedStudentWhere,
  canAccessCohort,
  getAccessibleCohortIds,
  getStaffAccessScope,
} from "../lib/cohortAccess";
import bcrypt from "bcryptjs";

const router = Router();
const BASE_IMPORT_HEADERS = ["name", "email", "grade"] as const;
const HOUSE_IMPORT_HEADERS = [...BASE_IMPORT_HEADERS, "house"] as const;
type ImportCsvIssue = { row: number; email: string | null; reason: string };
type TeacherImportIssue = { row: number; email: string | null; reason: string };
const COHORT_INVITE_LIMIT_PER_HOUR = 20;
const COHORT_INVITE_AUDIT_ACTION = "COHORT_INVITE_DISPATCHED";
const TEACHER_IMPORT_HEADERS = ["name", "email"] as const;
const SCHOOL_TEACHER_IMPORT_HEADERS = ["name", "email", "cohort"] as const;

function isMissingSchemaObjectError(err: unknown, objectName: string): boolean {
  return err instanceof Error && err.message.includes(objectName) && (
    err.message.includes("does not exist")
    || err.message.includes("Unknown field")
    || err.message.includes("Unknown arg")
  );
}

function inferUsesHouseField(params: {
  students: Array<{ house?: string | null }>;
  invitations: Array<{ house?: string | null }>;
}): boolean {
  return params.students.some((student) => !!student.house?.trim())
    || params.invitations.some((invitation) => !!invitation.house?.trim());
}

function normalizeTeacherEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function findOrCreateTeacherForCohort(params: {
  schoolId: string;
  cohortId: string;
  actorId: string;
  actorEmail: string;
  name: string;
  email: string;
}): Promise<
  | { status: "assigned-existing" | "created-and-assigned"; teacherId: string; teacherEmail: string; teacherName: string }
  | { status: "already-assigned"; reason: string }
  | { status: "already-school-admin"; reason: string }
  | { status: "conflict"; reason: string }
> {
  const email = normalizeTeacherEmail(params.email);
  if (email === normalizeTeacherEmail(params.actorEmail)) {
    return {
      status: "already-school-admin",
      reason: "you already have control over this cohort",
    };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role === "SCHOOL_ADMIN" && existing.schoolId === params.schoolId) {
      return {
        status: "already-school-admin",
        reason: "you already have control over this cohort",
      };
    }
    if (existing.role !== "TEACHER" || existing.schoolId !== params.schoolId) {
      return {
        status: "conflict",
        reason: "A user with this email already exists outside this school's teacher roster",
      };
    }

    const assignment = await prisma.cohortTeacherAssignment.findUnique({
      where: { cohortId_teacherId: { cohortId: params.cohortId, teacherId: existing.id } },
    });
    if (assignment) {
      return { status: "already-assigned", reason: "Teacher is already assigned to this cohort" };
    }

    await prisma.cohortTeacherAssignment.create({
      data: { cohortId: params.cohortId, teacherId: existing.id },
    });
    return {
      status: "assigned-existing",
      teacherId: existing.id,
      teacherEmail: existing.email,
      teacherName: existing.name,
    };
  }

  const tempPassword = crypto.randomBytes(12).toString("base64url");
  const configuredRounds = Number(process.env.TEMP_PASSWORD_BCRYPT_ROUNDS ?? 8);
  const rounds = Number.isFinite(configuredRounds) ? Math.min(14, Math.max(4, Math.floor(configuredRounds))) : 8;
  const passwordHash = await bcrypt.hash(tempPassword, rounds);
  const passwordResetToken = crypto.randomBytes(32).toString("hex");
  const passwordResetExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const created = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: params.name.trim(),
      role: "TEACHER",
      schoolId: params.schoolId,
      emailVerified: true,
      passwordResetToken,
      passwordResetExpires,
    },
  });

  await prisma.cohortTeacherAssignment.create({
    data: { cohortId: params.cohortId, teacherId: created.id },
  });

  const resetLink = `${CLIENT_URL}/reset-password?token=${passwordResetToken}`;
  sendPasswordResetEmail(created.email, resetLink).catch((err) => {
    console.error("[cohort teacher] Failed to send teacher setup email:", err);
  });

  return {
    status: "created-and-assigned",
    teacherId: created.id,
    teacherEmail: created.email,
    teacherName: created.name,
  };
}

function getCohortInviteAuditNeedle(cohortId: string): string {
  return `"cohortId":"${cohortId}"`;
}

function getCohortInviteLimitMessage(cohortName: string): string {
  return `This cohort has already used its ${COHORT_INVITE_LIMIT_PER_HOUR} invitation emails for the last hour. Try again later.`;
}

async function getCohortInviteUsage(cohortId: string): Promise<number> {
  const windowStart = new Date(Date.now() - 60 * 60 * 1000);
  return prisma.auditLog.count({
    where: {
      action: COHORT_INVITE_AUDIT_ACTION,
      createdAt: { gte: windowStart },
      details: { contains: getCohortInviteAuditNeedle(cohortId) },
    },
  });
}

async function consumeCohortInviteBudget(params: {
  actorId: string;
  cohortId: string;
  cohortName: string;
  email: string;
  source: "IMPORT" | "PUBLISH" | "ADD_STUDENT";
}): Promise<{ allowed: true; used: number; remaining: number } | { allowed: false; used: number; remaining: 0; message: string }> {
  return runSerializableTransaction(async (tx) => {
    const windowStart = new Date(Date.now() - 60 * 60 * 1000);
    const used = await tx.auditLog.count({
      where: {
        action: COHORT_INVITE_AUDIT_ACTION,
        createdAt: { gte: windowStart },
        details: { contains: getCohortInviteAuditNeedle(params.cohortId) },
      },
    });

    if (used >= COHORT_INVITE_LIMIT_PER_HOUR) {
      return {
        allowed: false as const,
        used,
        remaining: 0 as const,
        message: getCohortInviteLimitMessage(params.cohortName),
      };
    }

    await tx.auditLog.create({
      data: {
        action: COHORT_INVITE_AUDIT_ACTION,
        actorId: params.actorId,
        details: JSON.stringify({
          cohortId: params.cohortId,
          cohortName: params.cohortName,
          email: params.email,
          source: params.source,
        }),
      },
    });

    return {
      allowed: true as const,
      used: used + 1,
      remaining: COHORT_INVITE_LIMIT_PER_HOUR - (used + 1),
    };
  });
}

async function sendCohortInvitation(
  cohort: { name: string; school: { name: string } },
  invitation: { email: string; name: string | null; token: string }
): Promise<boolean> {
  const magicLink = `${CLIENT_URL}/join/student?token=${invitation.token}`;
  try {
    await sendStudentInvitationEmail(
      invitation.email,
      invitation.name,
      cohort.name,
      cohort.school.name,
      magicLink
    );
    return true;
  } catch (emailErr) {
    console.error(`[cohort invite] Failed to send to ${invitation.email}:`, emailErr);
    return false;
  }
}

// GET /api/cohorts — list cohorts for school
router.get("/", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const scope = await getStaffAccessScope(req.user!.userId);
    if (!scope?.schoolId) return res.status(400).json({ error: "Not associated with a school" });

    const school = await prisma.school.findUnique({
      where: { id: scope.schoolId },
      select: safeSchoolSelect,
    });
    const accessibleCohortIds = getAccessibleCohortIds(scope);

    let cohorts: Array<any>;
    try {
      cohorts = await prisma.cohort.findMany({
        where: {
          schoolId: scope.schoolId,
          ...(accessibleCohortIds ? { id: { in: accessibleCohortIds } } : {}),
        },
        include: {
          _count: { select: { students: true, invitations: true } },
          invitations: { select: { status: true } },
          teacherAssignments: {
            include: {
              teacher: { select: { id: true, name: true, email: true } },
            },
            orderBy: { teacher: { name: "asc" } },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    } catch (err) {
      if (
        !isMissingSchemaObjectError(err, "CohortTeacherAssignment")
        && !isMissingSchemaObjectError(err, "teacherAssignments")
        && !isMissingSchemaObjectError(err, "Cohort.usesHouseField")
        && !isMissingSchemaObjectError(err, "usesHouseField")
      ) {
        throw err;
      }

      cohorts = await prisma.cohort.findMany({
        where: {
          schoolId: scope.schoolId,
          ...(accessibleCohortIds ? { id: { in: accessibleCohortIds } } : {}),
        },
        select: {
          id: true,
          name: true,
          status: true,
          requiredHours: true,
          startYear: true,
          endYear: true,
          publishedAt: true,
          createdAt: true,
          _count: { select: { students: true, invitations: true } },
          invitations: { select: { status: true } },
        },
        orderBy: { createdAt: "desc" },
      }).then((rows) => rows.map((row) => ({ ...row, teacherAssignments: [] })));
    }

    const requiredHours = school?.requiredHours ?? 40;

    const students = await prisma.user.findMany({
      where: {
        role: "STUDENT",
        cohort: {
          schoolId: scope.schoolId,
          ...(accessibleCohortIds ? { id: { in: accessibleCohortIds } } : {}),
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        grade: true,
        cohortId: true,
        cohort: {
          select: {
            id: true,
            name: true,
            requiredHours: true,
            serviceStartDate: true,
            serviceEndDate: true,
          },
        },
      },
    });

    const progress = await buildStudentProgressRecords(students, {
      requiredHours,
      serviceStartDate: school?.serviceStartDate ?? null,
      serviceEndDate: school?.serviceEndDate ?? null,
    });
    const progressByCohort = new Map<string, typeof progress>();
    for (const student of progress) {
      if (!student.cohortId) continue;
      const list = progressByCohort.get(student.cohortId) ?? [];
      list.push(student);
      progressByCohort.set(student.cohortId, list);
    }

    const result = cohorts.map((c) => {
      const cohortProgress = progressByCohort.get(c.id) ?? [];
      const totalHours = cohortProgress.reduce((sum, student) => sum + student.approvedHours, 0);
      const completedCount = cohortProgress.filter((student) => student.status === "COMPLETED").length;
      const atRiskCount = cohortProgress.filter((student) => student.status === "AT_RISK").length;
      const invAccepted = c.invitations.filter((i: { status: string }) => i.status === "ACCEPTED").length;
      const invPending = c.invitations.filter((i: { status: string }) => i.status === "PENDING").length;
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        requiredHours: c.requiredHours ?? requiredHours,
        startYear: c.startYear,
        endYear: c.endYear,
        publishedAt: c.publishedAt,
        studentCount: cohortProgress.length,
        invitationsSent: c._count.invitations,
        invitationsAccepted: invAccepted,
        invitationsPending: invPending,
        totalHours: Math.round(totalHours * 100) / 100,
        completedCount,
        atRiskCount,
        completionPercentage: cohortProgress.length > 0 ? Math.round((completedCount / cohortProgress.length) * 100) : 0,
        teachers: (c.teacherAssignments ?? []).map((assignment: any) => assignment.teacher),
      };
    });

    res.json(result);
  } catch (err) {
    console.error("List cohorts error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/cohorts — create cohort
router.post("/", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      name: z.string().min(1).max(255),
      requiredHours: z.number().min(1).max(10000).optional(),
      startYear: z.number().int().optional(),
      endYear: z.number().int().optional(),
    });
    const data = schema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user?.schoolId) return res.status(400).json({ error: "Not associated with a school" });

    const cohort = await prisma.cohort.create({
      data: {
        name: data.name,
        schoolId: user.schoolId,
        requiredHours: data.requiredHours ?? null,
        startYear: data.startYear ?? null,
        endYear: data.endYear ?? null,
        status: "DRAFT",
      },
    });

    res.status(201).json(cohort);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    console.error("Create cohort error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/cohorts/school-students — all students across all school cohorts with hours
router.get("/school-students", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const scope = await getStaffAccessScope(req.user!.userId);
    if (!scope?.schoolId) return res.status(400).json({ error: "Not associated with a school" });
    const school = await prisma.school.findUnique({
      where: { id: scope.schoolId },
      select: safeSchoolSelect,
    });
    const studentWhere = buildCohortScopedStudentWhere(scope);
    const defaultRequired = school?.requiredHours ?? 40;
    const students = await prisma.user.findMany({
      where: { role: "STUDENT", ...studentWhere },
      select: {
        id: true,
        name: true,
        email: true,
        grade: true,
        cohortId: true,
        cohort: {
          select: {
            id: true,
            name: true,
            requiredHours: true,
            serviceStartDate: true,
            serviceEndDate: true,
          },
        },
      },
      orderBy: [{ cohort: { name: "asc" } }, { name: "asc" }],
    });

    const progress = await buildStudentProgressRecords(students, {
      requiredHours: defaultRequired,
      serviceStartDate: school?.serviceStartDate ?? null,
      serviceEndDate: school?.serviceEndDate ?? null,
    });

    res.json(progress.map((student) => ({
      id: student.id,
      name: student.name,
      email: student.email,
      grade: student.grade,
      cohortId: student.cohortId,
      cohortName: student.cohortName,
      approvedHours: student.approvedHours,
      pendingHours: student.pendingHours,
      requiredHours: student.requiredHours,
      status: student.status,
      riskReasons: student.riskReasons,
      noShowCount: student.noShowCount,
      daysToDeadline: student.daysToDeadline,
    })));
  } catch (err) {
    console.error("School students error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/cohorts/teachers/import — CSV import teacher-to-cohort assignments at school scope
router.post("/teachers/import", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const scope = await getStaffAccessScope(req.user!.userId);
    if (!scope?.schoolId) return res.status(400).json({ error: "Not associated with a school" });

    const actor = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { email: true },
    });
    if (!actor) return res.status(404).json({ error: "User not found" });

    const { csvData } = z.object({ csvData: z.string().min(1) }).parse(req.body);
    let headerRow: string[];
    try {
      const parsedHeader = parse(csvData, {
        to_line: 1,
        skip_empty_lines: true,
        trim: true,
      }) as string[][];
      headerRow = (parsedHeader[0] ?? []).map((value) => String(value).trim().toLowerCase());
    } catch (parseErr: any) {
      return res.status(400).json({ error: parseErr?.message || "The CSV could not be parsed." });
    }

    const headerMatches =
      headerRow.length === SCHOOL_TEACHER_IMPORT_HEADERS.length &&
      SCHOOL_TEACHER_IMPORT_HEADERS.every((header, index) => headerRow[index] === header);
    if (!headerMatches) {
      return res.status(400).json({ error: 'CSV headers must be exactly "name,email,cohort".' });
    }

    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Array<Record<string, string>>;

    const cohortNames = Array.from(new Set(
      records.map((row) => (row.cohort || "").trim()).filter(Boolean)
    ));
    const cohorts = await prisma.cohort.findMany({
      where: { schoolId: scope.schoolId, name: { in: cohortNames } },
      select: { id: true, name: true },
    });
    const cohortByName = new Map(cohorts.map((cohort) => [cohort.name.trim().toLowerCase(), cohort]));

    const result = {
      assigned: 0,
      created: 0,
      skipped: 0,
      errors: [] as Array<TeacherImportIssue & { cohort: string | null }>,
    };

    for (const [index, row] of records.entries()) {
      const rowNumber = index + 2;
      const name = (row.name || "").trim();
      const email = normalizeTeacherEmail(row.email || "");
      const cohortName = (row.cohort || "").trim();

      if (!name || !email || !cohortName) {
        result.errors.push({
          row: rowNumber,
          email: email || null,
          cohort: cohortName || null,
          reason: "Missing required name, email, or cohort",
        });
        result.skipped++;
        continue;
      }
      const emailCheck = z.string().email().safeParse(email);
      if (!emailCheck.success) {
        result.errors.push({ row: rowNumber, email, cohort: cohortName, reason: "Invalid email address" });
        result.skipped++;
        continue;
      }

      const cohort = cohortByName.get(cohortName.toLowerCase());
      if (!cohort) {
        result.errors.push({ row: rowNumber, email, cohort: cohortName, reason: "Cohort not found in this school" });
        result.skipped++;
        continue;
      }

      const action = await findOrCreateTeacherForCohort({
        schoolId: scope.schoolId,
        cohortId: cohort.id,
        actorId: req.user!.userId,
        actorEmail: actor.email,
        name,
        email,
      });

      if (action.status === "assigned-existing") {
        result.assigned++;
        continue;
      }
      if (action.status === "created-and-assigned") {
        result.created++;
        continue;
      }

      if (
        action.status === "already-assigned"
        || action.status === "already-school-admin"
        || action.status === "conflict"
      ) {
        result.errors.push({ row: rowNumber, email, cohort: cohortName, reason: action.reason });
        result.skipped++;
      }
    }

    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    console.error("Import school cohort teachers error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/cohorts/:id — cohort details
router.get("/:id", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const scope = await getStaffAccessScope(req.user!.userId);
    let cohort: any;
    try {
      cohort = await prisma.cohort.findUnique({
        where: { id: req.params.id },
        include: {
          students: {
            select: { id: true, name: true, email: true, grade: true, house: true },
          },
          invitations: { orderBy: { createdAt: "desc" } },
          school: { select: { requiredHours: true, serviceStartDate: true, serviceEndDate: true } },
          teacherAssignments: {
            include: { teacher: { select: { id: true, name: true, email: true } } },
            orderBy: { teacher: { name: "asc" } },
          },
        },
      });
    } catch (err) {
      if (
        !isMissingSchemaObjectError(err, "CohortTeacherAssignment")
        && !isMissingSchemaObjectError(err, "teacherAssignments")
        && !isMissingSchemaObjectError(err, "Cohort.usesHouseField")
        && !isMissingSchemaObjectError(err, "usesHouseField")
      ) {
        throw err;
      }

      cohort = await prisma.cohort.findUnique({
        where: { id: req.params.id },
        select: {
          id: true,
          name: true,
          status: true,
          schoolId: true,
          requiredHours: true,
          startYear: true,
          endYear: true,
          publishedAt: true,
          serviceStartDate: true,
          serviceEndDate: true,
          allowSelfSubmission: true,
          categoryHourCaps: true,
          students: {
            select: { id: true, name: true, email: true, grade: true, house: true },
          },
          invitations: {
            orderBy: { createdAt: "desc" },
          },
          school: { select: { requiredHours: true, serviceStartDate: true, serviceEndDate: true } },
        },
      }).then((row) => row ? { ...row, teacherAssignments: [], usesHouseField: false } : null);
    }
    if (!cohort) return res.status(404).json({ error: "Cohort not found" });
    if (cohort.schoolId !== scope?.schoolId) return res.status(403).json({ error: "Not your school's cohort" });
    if (scope && !canAccessCohort(scope, cohort.id)) return res.status(403).json({ error: "You do not control this cohort" });

    const requiredHours = cohort.requiredHours ?? cohort.school.requiredHours ?? 40;
    const studentsForProgress = cohort.students.map((student: any) => ({
      ...student,
      cohortId: cohort.id,
      cohort: {
        id: cohort.id,
        name: cohort.name,
        requiredHours: cohort.requiredHours,
        serviceStartDate: cohort.serviceStartDate ?? null,
        serviceEndDate: cohort.serviceEndDate ?? null,
      },
    }));
    const progress = await buildStudentProgressRecords(studentsForProgress, {
      requiredHours: cohort.school.requiredHours ?? 40,
      serviceStartDate: cohort.school.serviceStartDate ?? null,
      serviceEndDate: cohort.school.serviceEndDate ?? null,
    });
    const progressMap = new Map(progress.map((student) => [student.id, student]));
    const studentIds = cohort.students.map((student: any) => student.id);
    const studentsWithHours = cohort.students.map((student: any) => ({
      ...student,
      approvedHours: progressMap.get(student.id)?.approvedHours ?? 0,
      pendingHours: progressMap.get(student.id)?.pendingHours ?? 0,
      status: progressMap.get(student.id)?.status ?? "ON_TRACK",
      riskReasons: progressMap.get(student.id)?.riskReasons ?? [],
      noShowCount: progressMap.get(student.id)?.noShowCount ?? 0,
      daysToDeadline: progressMap.get(student.id)?.daysToDeadline ?? null,
    }));

    // Count pending verifications for students in this cohort
    const [pendingBenSignups, pendingSelfSubs] = await Promise.all([
      prisma.beneficiarySignup.count({
        where: { studentId: { in: studentIds }, verificationStatus: "PENDING" },
      }),
      prisma.selfSubmittedRequest.count({
        where: { studentId: { in: studentIds }, status: "PENDING" },
      }),
    ]);
    const pendingVerifications = pendingBenSignups + pendingSelfSubs;

    res.json({
      ...cohort,
      usesHouseField:
        cohort.usesHouseField || inferUsesHouseField({ students: cohort.students, invitations: cohort.invitations }),
      students: studentsWithHours,
      invitations: cohort.invitations.filter((invitation: { status: string }) => invitation.status !== "ACCEPTED"),
      requiredHours,
      pendingVerifications,
      teachers: (cohort.teacherAssignments ?? []).map((assignment: any) => assignment.teacher),
    });
  } catch (err) {
    console.error("Get cohort error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/cohorts/:id — update cohort
router.put("/:id", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const scope = await getStaffAccessScope(req.user!.userId);
    const cohort = await prisma.cohort.findUnique({
      where: { id: req.params.id },
      include: { school: { select: { name: true } } },
    });
    if (!cohort) return res.status(404).json({ error: "Cohort not found" });
    if (cohort.schoolId !== scope?.schoolId) return res.status(403).json({ error: "Not your school's cohort" });
    if (scope && !canAccessCohort(scope, cohort.id)) return res.status(403).json({ error: "You do not control this cohort" });

    const cohortUpdateSchema = z.object({
      name: z.string().min(1).max(255).optional(),
      requiredHours: z.number().min(1).max(10000).nullable().optional(),
      startYear: z.number().int().nullable().optional(),
      endYear: z.number().int().nullable().optional(),
      serviceStartDate: z.string().datetime({ offset: true }).nullable().optional(),
      serviceEndDate: z.string().datetime({ offset: true }).nullable().optional(),
      allowSelfSubmission: z.boolean().nullable().optional(),
      categoryHourCaps: z.record(z.string(), z.number().positive()).nullable().optional(),
      usesHouseField: z.boolean().optional(),
    });

    let body: z.infer<typeof cohortUpdateSchema>;
    try {
      body = cohortUpdateSchema.parse(req.body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: err.errors });
      }
      throw err;
    }

    if (body.serviceStartDate && body.serviceEndDate) {
      if (new Date(body.serviceEndDate) <= new Date(body.serviceStartDate)) {
        return res.status(400).json({ error: "serviceEndDate must be after serviceStartDate" });
      }
    }

    const data: any = {
      name: body.name ?? cohort.name,
      requiredHours: body.requiredHours !== undefined ? body.requiredHours : cohort.requiredHours,
      startYear: body.startYear !== undefined ? body.startYear : cohort.startYear,
      endYear: body.endYear !== undefined ? body.endYear : cohort.endYear,
    };
    if (body.serviceStartDate !== undefined) data.serviceStartDate = body.serviceStartDate ? new Date(body.serviceStartDate) : null;
    if (body.serviceEndDate !== undefined) data.serviceEndDate = body.serviceEndDate ? new Date(body.serviceEndDate) : null;
    if (body.allowSelfSubmission !== undefined) data.allowSelfSubmission = body.allowSelfSubmission;
    if (body.categoryHourCaps !== undefined) data.categoryHourCaps = body.categoryHourCaps != null ? JSON.stringify(body.categoryHourCaps) : null;
    if (body.usesHouseField !== undefined) data.usesHouseField = body.usesHouseField;

    const updated = await prisma.cohort.update({
      where: { id: req.params.id },
      data,
    });
    res.json(updated);
  } catch (err) {
    console.error("Update cohort error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/cohorts/:id/import — CSV import students
router.post("/:id/import", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const scope = await getStaffAccessScope(req.user!.userId);
    const cohort = await prisma.cohort.findUnique({
      where: { id: req.params.id },
      include: { school: { select: { name: true } } },
    });
    if (!cohort) return res.status(404).json({ error: "Cohort not found" });
    if (cohort.schoolId !== scope?.schoolId) return res.status(403).json({ error: "Not your school's cohort" });
    if (scope && !canAccessCohort(scope, cohort.id)) return res.status(403).json({ error: "You do not control this cohort" });

    // Expect { csvData: "name,email,grade\n..." } or { csvData: "name,email,grade,house\n..." }
    const { csvData } = z.object({ csvData: z.string().min(1) }).parse(req.body);

    let headerRow: string[];
    try {
      const parsedHeader = parse(csvData, {
        to_line: 1,
        skip_empty_lines: true,
        trim: true,
      }) as string[][];
      headerRow = (parsedHeader[0] ?? []).map((value) => String(value).trim().toLowerCase());
    } catch (parseErr: any) {
      const row = Number(parseErr?.lines ?? 1) || 1;
      return res.status(400).json({
        error: "Invalid CSV format",
        errors: [{ row, email: null, reason: parseErr?.message || "The CSV could not be parsed." }] satisfies ImportCsvIssue[],
      });
    }

    const matchesBaseHeaders =
      headerRow.length === BASE_IMPORT_HEADERS.length &&
      BASE_IMPORT_HEADERS.every((header, index) => headerRow[index] === header);
    const matchesHouseHeaders =
      headerRow.length === HOUSE_IMPORT_HEADERS.length &&
      HOUSE_IMPORT_HEADERS.every((header, index) => headerRow[index] === header);
    const usesHouseField = matchesHouseHeaders;

    if (!matchesBaseHeaders && !matchesHouseHeaders) {
      return res.status(400).json({
        error: 'CSV headers must be exactly "name,email,grade" or "name,email,grade,house".',
        errors: [{
          row: 1,
          email: null,
          reason: `Header row was "${headerRow.join(",") || "(empty)"}". Expected exactly "name,email,grade" or "name,email,grade,house".`,
        }] satisfies ImportCsvIssue[],
      });
    }

    let records: any[];
    try {
      records = parse(csvData, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch (parseErr: any) {
      const row = Number(parseErr?.lines ?? 1) || 1;
      return res.status(400).json({
        error: "Invalid CSV format",
        errors: [{ row, email: null, reason: parseErr?.message || "The CSV could not be parsed." }] satisfies ImportCsvIssue[],
      });
    }

    if (records.length === 0) {
      return res.status(400).json({
        error: "CSV has no student rows",
        errors: [{ row: 1, email: null, reason: "Add at least one student row below the header." }] satisfies ImportCsvIssue[],
      });
    }
    if (records.length > 2000) {
      return res.status(400).json({
        error: "CSV exceeds 2000 row limit",
        errors: [{ row: 1, email: null, reason: `This file has ${records.length} student rows. The limit is 2000.` }] satisfies ImportCsvIssue[],
      });
    }

    const results = {
      added: 0,
      skipped: 0,
      errors: [] as ImportCsvIssue[],
    };

    for (const [index, row] of records.entries()) {
      const rowNumber = index + 2;
      const email = (row.email || "").trim().toLowerCase();
      const name = (row.name || "").trim();
      const grade = (row.grade || "").trim();
      const house = (row.house || "").trim();
      if (!email || !name) {
        results.errors.push({ row: rowNumber, email: email || null, reason: "Missing required name or email" });
        results.skipped++;
        continue;
      }
      const emailCheck = z.string().email().safeParse(email);
      if (!emailCheck.success) {
        results.errors.push({ row: rowNumber, email, reason: "Invalid email address" });
        results.skipped++;
        continue;
      }
      const existingStudent = await prisma.user.findUnique({ where: { email } });
      if (existingStudent?.cohortId === cohort.id) {
        results.errors.push({ row: rowNumber, email, reason: "Student is already enrolled in this cohort" });
        results.skipped++;
        continue;
      }
      // Upsert invitation record
      const existing = await prisma.studentInvitation.findUnique({
        where: { cohortId_email: { cohortId: cohort.id, email } },
      });
      if (existing) {
        results.errors.push({ row: rowNumber, email, reason: "Invitation already exists for this cohort" });
        results.skipped++;
        continue;
      }
      const budget = await consumeCohortInviteBudget({
        actorId: req.user!.userId,
        cohortId: cohort.id,
        cohortName: cohort.name,
        email,
        source: "IMPORT",
      });
      if (!budget.allowed) {
        results.errors.push({ row: rowNumber, email, reason: budget.message });
        results.skipped++;
        continue;
      }
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72h
      await prisma.studentInvitation.create({
        data: {
          cohortId: cohort.id,
          email,
          name: name || null,
          grade: grade || null,
          house: usesHouseField ? house || null : null,
          token,
          expiresAt,
          status: "PENDING",
        },
      });
      const sent = await sendCohortInvitation(cohort, { email, name: name || null, token });
      if (!sent) {
        results.errors.push({ row: rowNumber, email, reason: "Invite created but email delivery failed. Retry from the cohort page." });
      }
      results.added++;
    }

    await prisma.cohort.update({
      where: { id: cohort.id },
      data: {
        status: "PUBLISHED",
        publishedAt: cohort.publishedAt ?? new Date(),
        usesHouseField,
      },
    });

    res.json({
      message: "Import complete",
      ...results,
      preview: {
        totalRows: records.length,
        importedRows: results.added,
        skippedRows: results.skipped,
      },
      inviteLimit: {
        perHour: COHORT_INVITE_LIMIT_PER_HOUR,
        usedLastHour: await getCohortInviteUsage(cohort.id),
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    console.error("CSV import error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/cohorts/:id/publish — resend pending student invitations
router.post("/:id/publish", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const scope = await getStaffAccessScope(req.user!.userId);
    const cohort = await prisma.cohort.findUnique({
      where: { id: req.params.id },
      include: { school: { select: { name: true } } },
    });
    if (!cohort) return res.status(404).json({ error: "Cohort not found" });
    if (cohort.schoolId !== scope?.schoolId) return res.status(403).json({ error: "Not your school's cohort" });
    if (scope && !canAccessCohort(scope, cohort.id)) return res.status(403).json({ error: "You do not control this cohort" });

    const pendingInvitations = await prisma.studentInvitation.findMany({
      where: { cohortId: cohort.id, status: "PENDING" },
    });

    if (pendingInvitations.length === 0) {
      return res.status(400).json({ error: "No pending student invitations to send. Import students first." });
    }

    let sent = 0;
    let failed = 0;
    let blockedByRateLimit = 0;
    for (const inv of pendingInvitations) {
      const budget = await consumeCohortInviteBudget({
        actorId: req.user!.userId,
        cohortId: cohort.id,
        cohortName: cohort.name,
        email: inv.email,
        source: "PUBLISH",
      });
      if (!budget.allowed) {
        blockedByRateLimit = pendingInvitations.length - sent - failed;
        failed += blockedByRateLimit;
        break;
      }
      const ok = await sendCohortInvitation(cohort, inv);
      if (ok) {
        sent++;
      } else {
        failed++;
      }
    }

    // Mark cohort as published
    await prisma.cohort.update({
      where: { id: cohort.id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });

    res.json({
      message: blockedByRateLimit > 0 ? getCohortInviteLimitMessage(cohort.name) : "Invitations sent",
      sent,
      failed,
      blockedByRateLimit,
      inviteLimit: {
        perHour: COHORT_INVITE_LIMIT_PER_HOUR,
        usedLastHour: await getCohortInviteUsage(cohort.id),
      },
    });
  } catch (err) {
    console.error("Publish cohort error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/cohorts/:id/add-student — manually add a single student invitation
router.post("/:id/add-student", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const scope = await getStaffAccessScope(req.user!.userId);
    const cohort = await prisma.cohort.findUnique({
      where: { id: req.params.id },
      include: { school: { select: safeSchoolSelect } },
    });
    if (!cohort) return res.status(404).json({ error: "Cohort not found" });
    if (cohort.schoolId !== scope?.schoolId) return res.status(403).json({ error: "Not your school's cohort" });
    if (scope && !canAccessCohort(scope, cohort.id)) return res.status(403).json({ error: "You do not control this cohort" });

    const { email, name, grade, house } = z.object({
      email: z.string().email(),
      name: z.string().min(1).max(255).optional(),
      grade: z.string().max(50).optional(),
      house: z.string().max(100).optional(),
    }).parse(req.body);

    const existing = await prisma.studentInvitation.findUnique({
      where: { cohortId_email: { cohortId: cohort.id, email } },
    });
    if (existing) return res.status(409).json({ error: "Student already invited to this cohort" });

    const budget = await consumeCohortInviteBudget({
      actorId: req.user!.userId,
      cohortId: cohort.id,
      cohortName: cohort.name,
      email,
      source: "ADD_STUDENT",
    });
    if (!budget.allowed) {
      return res.status(429).json({
        error: budget.message,
        inviteLimit: {
          perHour: COHORT_INVITE_LIMIT_PER_HOUR,
          usedLastHour: budget.used,
        },
      });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    const inv = await prisma.studentInvitation.create({
      data: {
        cohortId: cohort.id,
        email,
        name: name || null,
        grade: grade || null,
        house: cohort.usesHouseField ? house || null : null,
        token,
        expiresAt,
        status: "PENDING",
      },
    });

    const emailSent = await sendCohortInvitation(cohort, inv);
    await prisma.cohort.update({
      where: { id: cohort.id },
      data: { status: "PUBLISHED", publishedAt: cohort.publishedAt ?? new Date() },
    });

    res.status(201).json({
      ...inv,
      emailSent,
      inviteLimit: {
        perHour: COHORT_INVITE_LIMIT_PER_HOUR,
        usedLastHour: budget.used,
        remainingThisHour: budget.remaining,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    console.error("Add student error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/cohorts/:id/teachers — manually assign or create a teacher for this cohort
router.post("/:id/teachers", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const scope = await getStaffAccessScope(req.user!.userId);
    const cohort = await prisma.cohort.findUnique({ where: { id: req.params.id } });
    if (!cohort) return res.status(404).json({ error: "Cohort not found" });
    if (cohort.schoolId !== scope?.schoolId) return res.status(403).json({ error: "Not your school's cohort" });

    const actor = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { email: true, name: true },
    });
    if (!actor) return res.status(404).json({ error: "User not found" });

    const { name, email } = z.object({
      name: z.string().min(1).max(255),
      email: z.string().email(),
    }).parse(req.body);

    const result = await findOrCreateTeacherForCohort({
      schoolId: cohort.schoolId,
      cohortId: cohort.id,
      actorId: req.user!.userId,
      actorEmail: actor.email,
      name,
      email,
    });

    if (result.status === "already-school-admin") {
      return res.status(409).json({ error: result.reason });
    }
    if (result.status === "already-assigned") {
      return res.status(409).json({ error: result.reason });
    }
    if (result.status === "conflict") {
      return res.status(409).json({ error: result.reason });
    }

    const teacher = await prisma.user.findUnique({
      where: { id: result.teacherId },
      select: { id: true, name: true, email: true, role: true },
    });

    res.status(201).json({
      teacher,
      assignmentStatus: result.status,
    });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    console.error("Assign cohort teacher error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/cohorts/:id/teachers/import — CSV import cohort teachers
router.post("/:id/teachers/import", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const scope = await getStaffAccessScope(req.user!.userId);
    const cohort = await prisma.cohort.findUnique({ where: { id: req.params.id } });
    if (!cohort) return res.status(404).json({ error: "Cohort not found" });
    if (cohort.schoolId !== scope?.schoolId) return res.status(403).json({ error: "Not your school's cohort" });

    const actor = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { email: true },
    });
    if (!actor) return res.status(404).json({ error: "User not found" });

    const { csvData } = z.object({ csvData: z.string().min(1) }).parse(req.body);
    let headerRow: string[];
    try {
      const parsedHeader = parse(csvData, {
        to_line: 1,
        skip_empty_lines: true,
        trim: true,
      }) as string[][];
      headerRow = (parsedHeader[0] ?? []).map((value) => String(value).trim().toLowerCase());
    } catch (parseErr: any) {
      return res.status(400).json({ error: parseErr?.message || "The CSV could not be parsed." });
    }

    const headerMatches =
      headerRow.length === TEACHER_IMPORT_HEADERS.length &&
      TEACHER_IMPORT_HEADERS.every((header, index) => headerRow[index] === header);
    if (!headerMatches) {
      return res.status(400).json({ error: 'CSV headers must be exactly "name,email".' });
    }

    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Array<Record<string, string>>;

    const result = {
      assigned: 0,
      created: 0,
      skipped: 0,
      errors: [] as TeacherImportIssue[],
    };

    for (const [index, row] of records.entries()) {
      const rowNumber = index + 2;
      const name = (row.name || "").trim();
      const email = normalizeTeacherEmail(row.email || "");
      if (!name || !email) {
        result.errors.push({ row: rowNumber, email: email || null, reason: "Missing required name or email" });
        result.skipped++;
        continue;
      }
      const emailCheck = z.string().email().safeParse(email);
      if (!emailCheck.success) {
        result.errors.push({ row: rowNumber, email, reason: "Invalid email address" });
        result.skipped++;
        continue;
      }
      const action = await findOrCreateTeacherForCohort({
        schoolId: cohort.schoolId,
        cohortId: cohort.id,
        actorId: req.user!.userId,
        actorEmail: actor.email,
        name,
        email,
      });
      if (action.status === "assigned-existing") {
        result.assigned++;
        continue;
      }
      if (action.status === "created-and-assigned") {
        result.created++;
        continue;
      }
      if (
        action.status === "already-assigned" ||
        action.status === "already-school-admin" ||
        action.status === "conflict"
      ) {
        result.errors.push({ row: rowNumber, email, reason: action.reason });
      }
      result.skipped++;
    }

    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    console.error("Import cohort teachers error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/cohorts/:id/teachers/:teacherId — unassign a teacher from a cohort
router.delete("/:id/teachers/:teacherId", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const scope = await getStaffAccessScope(req.user!.userId);
    const cohort = await prisma.cohort.findUnique({ where: { id: req.params.id } });
    if (!cohort) return res.status(404).json({ error: "Cohort not found" });
    if (cohort.schoolId !== scope?.schoolId) return res.status(403).json({ error: "Not your school's cohort" });

    await prisma.cohortTeacherAssignment.delete({
      where: {
        cohortId_teacherId: {
          cohortId: req.params.id,
          teacherId: req.params.teacherId,
        },
      },
    });

    res.status(204).send();
  } catch (err) {
    console.error("Remove cohort teacher error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/cohorts/:id — delete cohort (must be empty of students)
router.delete("/:id", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    const cohort = await prisma.cohort.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { students: true } } },
    });
    if (!cohort) return res.status(404).json({ error: "Cohort not found" });
    if (cohort.schoolId !== user?.schoolId) return res.status(403).json({ error: "Not your school's cohort" });

    // Remove all students from cohort first, then delete
    await prisma.user.updateMany({ where: { cohortId: cohort.id }, data: { cohortId: null } });
    await prisma.cohort.delete({ where: { id: cohort.id } });

    await logDataAccess({
      actorId: req.user!.userId,
      action: "COHORT_DELETED",
      targetType: "Cohort",
      targetId: cohort.id,
      schoolId: cohort.schoolId,
      details: { cohortName: cohort.name, studentCount: cohort._count.students },
    });

    res.status(204).send();
  } catch (err) {
    console.error("Delete cohort error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/cohorts/:id/students/:studentId — remove student from cohort
router.delete("/:id/students/:studentId", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const scope = await getStaffAccessScope(req.user!.userId);
    const cohort = await prisma.cohort.findUnique({ where: { id: req.params.id } });
    if (!cohort) return res.status(404).json({ error: "Cohort not found" });
    if (cohort.schoolId !== scope?.schoolId) return res.status(403).json({ error: "Not your school's cohort" });
    if (scope && !canAccessCohort(scope, cohort.id)) return res.status(403).json({ error: "You do not control this cohort" });

    // Verify the student is actually enrolled in this specific cohort
    const studentAccessible = scope
      ? await assertStudentAccessibleToStaff(scope, req.params.studentId)
      : false;
    if (!studentAccessible) return res.status(403).json({ error: "Student is not enrolled in a cohort you control" });

    const student = await prisma.user.findUnique({ where: { id: req.params.studentId }, select: { role: true, cohortId: true } });
    if (!student || student.role !== "STUDENT") return res.status(404).json({ error: "Student not found" });
    if (student.cohortId !== req.params.id) return res.status(403).json({ error: "Student is not enrolled in this cohort" });

    await prisma.user.update({
      where: { id: req.params.studentId },
      data: { cohortId: null },
    });
    res.json({ message: "Student removed from cohort" });
  } catch (err) {
    console.error("Remove student from cohort error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
