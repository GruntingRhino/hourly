import { Router, Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import { parse } from "csv-parse/sync";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { sendStudentInvitationEmail, CLIENT_URL } from "../services/email";
import { buildStudentProgressRecords } from "../lib/studentProgress";
import { logDataAccess } from "../lib/dataAccessLog";

const router = Router();

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
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user?.schoolId) return res.status(400).json({ error: "Not associated with a school" });

    const school = await prisma.school.findUnique({ where: { id: user.schoolId } });

    const cohorts = await prisma.cohort.findMany({
      where: { schoolId: user.schoolId },
      include: {
        _count: { select: { students: true, invitations: true } },
        invitations: { select: { status: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const requiredHours = school?.requiredHours ?? 40;

    const students = await prisma.user.findMany({
      where: {
        role: "STUDENT",
        cohort: { schoolId: user.schoolId },
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
      const invAccepted = c.invitations.filter((i) => i.status === "ACCEPTED").length;
      const invPending = c.invitations.filter((i) => i.status === "PENDING").length;
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
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user?.schoolId) return res.status(400).json({ error: "Not associated with a school" });

    const school = await prisma.school.findUnique({ where: { id: user.schoolId } });
    const defaultRequired = school?.requiredHours ?? 40;
    const students = await prisma.user.findMany({
      where: { role: "STUDENT", cohort: { schoolId: user.schoolId } },
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

// GET /api/cohorts/:id — cohort details
router.get("/:id", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    const cohort = await prisma.cohort.findUnique({
      where: { id: req.params.id },
      include: {
        students: {
          select: { id: true, name: true, email: true, grade: true, house: true },
        },
        invitations: { orderBy: { createdAt: "desc" } },
        school: { select: { requiredHours: true, serviceStartDate: true, serviceEndDate: true } },
      },
    });
    if (!cohort) return res.status(404).json({ error: "Cohort not found" });
    if (cohort.schoolId !== user?.schoolId) return res.status(403).json({ error: "Not your school's cohort" });

    const requiredHours = cohort.requiredHours ?? cohort.school.requiredHours ?? 40;
    const studentsForProgress = cohort.students.map((student) => ({
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
    const studentIds = cohort.students.map((student) => student.id);
    const studentsWithHours = cohort.students.map((student) => ({
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
      students: studentsWithHours,
      invitations: cohort.invitations.filter((invitation) => invitation.status !== "ACCEPTED"),
      requiredHours,
      pendingVerifications,
    });
  } catch (err) {
    console.error("Get cohort error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/cohorts/:id — update cohort
router.put("/:id", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    const cohort = await prisma.cohort.findUnique({
      where: { id: req.params.id },
      include: { school: { select: { name: true } } },
    });
    if (!cohort) return res.status(404).json({ error: "Cohort not found" });
    if (cohort.schoolId !== user?.schoolId) return res.status(403).json({ error: "Not your school's cohort" });

    const cohortUpdateSchema = z.object({
      name: z.string().min(1).max(255).optional(),
      requiredHours: z.number().min(1).max(10000).nullable().optional(),
      startYear: z.number().int().nullable().optional(),
      endYear: z.number().int().nullable().optional(),
      serviceStartDate: z.string().datetime({ offset: true }).nullable().optional(),
      serviceEndDate: z.string().datetime({ offset: true }).nullable().optional(),
      allowSelfSubmission: z.boolean().nullable().optional(),
      categoryHourCaps: z.record(z.string(), z.number().positive()).nullable().optional(),
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
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    const cohort = await prisma.cohort.findUnique({
      where: { id: req.params.id },
      include: { school: { select: { name: true } } },
    });
    if (!cohort) return res.status(404).json({ error: "Cohort not found" });
    if (cohort.schoolId !== user?.schoolId) return res.status(403).json({ error: "Not your school's cohort" });

    // Expect { csvData: "name,email,grade,house\n..." }
    const { csvData } = z.object({ csvData: z.string().min(1) }).parse(req.body);

    let records: any[];
    try {
      records = parse(csvData, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch (parseErr) {
      return res.status(400).json({ error: "Invalid CSV format" });
    }

    if (records.length === 0) return res.status(400).json({ error: "CSV has no student rows" });
    if (records.length > 2000) return res.status(400).json({ error: "CSV exceeds 2000 row limit" });

    const results = {
      added: 0,
      skipped: 0,
      errors: [] as Array<{ row: number; email: string | null; reason: string }>,
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
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72h
      await prisma.studentInvitation.create({
        data: {
          cohortId: cohort.id,
          email,
          name: name || null,
          grade: grade || null,
          house: house || null,
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
      data: { status: "PUBLISHED", publishedAt: cohort.publishedAt ?? new Date() },
    });

    res.json({
      message: "Import complete",
      ...results,
      preview: {
        totalRows: records.length,
        importedRows: results.added,
        skippedRows: results.skipped,
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
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    const cohort = await prisma.cohort.findUnique({
      where: { id: req.params.id },
      include: { school: { select: { name: true } } },
    });
    if (!cohort) return res.status(404).json({ error: "Cohort not found" });
    if (cohort.schoolId !== user?.schoolId) return res.status(403).json({ error: "Not your school's cohort" });

    const pendingInvitations = await prisma.studentInvitation.findMany({
      where: { cohortId: cohort.id, status: "PENDING" },
    });

    if (pendingInvitations.length === 0) {
      return res.status(400).json({ error: "No pending student invitations to send. Import students first." });
    }

    let sent = 0;
    let failed = 0;
    for (const inv of pendingInvitations) {
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

    res.json({ message: "Invitations sent", sent, failed });
  } catch (err) {
    console.error("Publish cohort error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/cohorts/:id/add-student — manually add a single student invitation
router.post("/:id/add-student", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    const cohort = await prisma.cohort.findUnique({ where: { id: req.params.id }, include: { school: true } });
    if (!cohort) return res.status(404).json({ error: "Cohort not found" });
    if (cohort.schoolId !== user?.schoolId) return res.status(403).json({ error: "Not your school's cohort" });

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

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    const inv = await prisma.studentInvitation.create({
      data: {
        cohortId: cohort.id,
        email,
        name: name || null,
        grade: grade || null,
        house: house || null,
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

    res.status(201).json({ ...inv, emailSent });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    console.error("Add student error:", err);
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
router.delete("/:id/students/:studentId", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    const cohort = await prisma.cohort.findUnique({ where: { id: req.params.id } });
    if (!cohort) return res.status(404).json({ error: "Cohort not found" });
    if (cohort.schoolId !== user?.schoolId) return res.status(403).json({ error: "Not your school's cohort" });

    // Verify the student is actually enrolled in this specific cohort
    const student = await prisma.user.findUnique({
      where: { id: req.params.studentId },
      select: { role: true, cohortId: true },
    });
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
