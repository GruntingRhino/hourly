import { Router, Request, Response } from "express";
import { z } from "zod";
import { parse as parseCsv } from "csv-parse/sync";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { resolveEffectiveRules, checkCategoryCap, getBlockedCategoryKeysForStudent, normalizeCategoryKey } from "../lib/schoolRules";
import { assertStudentAccessibleToStaff, buildCohortScopedStudentWhere, getStaffAccessScope } from "../lib/cohortAccess";
import { resolveStudentSchoolId } from "../lib/dataAccessLog";
import {
  sendSelfSubmissionApprovedEmail,
  sendSelfSubmissionRejectedEmail,
  sendNewSubmissionAlertEmail,
  sendSubmissionRevisionEmail,
} from "../services/email";

const router = Router();

// POST /api/self-submissions — student submits self-selected volunteering
router.post("/", authenticate, requireRole("STUDENT"), async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      organizationName: z.string().min(1).max(255),
      description: z.string().min(1).max(2000),
      date: z.string(), // ISO date
      hours: z.number().positive().max(24),
      evidenceNote: z.string().max(1000).optional(),
      category: z.string().max(100).optional(),
    });
    const data = schema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) return res.status(404).json({ error: "User not found" });

    // Resolve effective rules (covers allowSelfSubmission + date window)
    const rules = await resolveEffectiveRules(user.id);

    // Get school ID from rules or cohort fallback
    const schoolId = rules?.schoolId ?? await resolveStudentSchoolId(user.id);
    if (!schoolId) return res.status(400).json({ error: "You must be enrolled in a school cohort to submit hours." });

    // Check self-submission is allowed
    if (rules && !rules.allowSelfSubmission) {
      return res.status(403).json({ error: "Your school does not accept self-submitted hours." });
    }

    // Check service date window
    const serviceDate = new Date(data.date);
    if (rules?.serviceStartDate && serviceDate < rules.serviceStartDate) {
      return res.status(400).json({ error: `Service date must be on or after ${rules.serviceStartDate.toISOString().split("T")[0]}.` });
    }
    if (rules?.serviceEndDate && serviceDate > rules.serviceEndDate) {
      return res.status(400).json({ error: `Service date must be on or before ${rules.serviceEndDate.toISOString().split("T")[0]}.` });
    }

    const blockedCategoryKeys = await getBlockedCategoryKeysForStudent(user.id);
    if (blockedCategoryKeys.has(normalizeCategoryKey(data.category))) {
      const categoryLabel = data.category || "this category";
      return res.status(403).json({
        error: `Your school is preventing you from doing more ${categoryLabel}. You have already completed the maximum allowed hours in that category.`,
        categoryBlocked: true,
        category: categoryLabel,
      });
    }

    const submission = await prisma.selfSubmittedRequest.create({
      data: {
        studentId: user.id,
        schoolId,
        organizationName: data.organizationName,
        description: data.description,
        date: serviceDate,
        hours: data.hours,
        evidenceNote: data.evidenceNote || null,
        category: data.category || "general",
        status: "PENDING",
      },
    });

    // Alert school admins about new pending submission
    prisma.user.findMany({
      where: { schoolId, role: "SCHOOL_ADMIN" },
      select: { id: true, email: true, name: true },
    }).then(async (admins) => {
      await prisma.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          type: "SELF_SUBMISSION_REVIEW",
          title: "New self-submitted hours request",
          body: `${user.name} submitted ${data.hours}h for ${data.organizationName}.`,
          data: JSON.stringify({ href: "/submissions" }),
        })),
      }).catch(() => {});
      for (const admin of admins) {
        sendNewSubmissionAlertEmail(admin.email, admin.name, user.name, data.organizationName, data.hours).catch(() => {});
      }
    }).catch(() => {});

    res.status(201).json(submission);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    console.error("Create self submission error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/self-submissions/import — school admin bulk-imports pre-approved prior hours
router.post("/import", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const { csvData } = z.object({ csvData: z.string().min(1) }).parse(req.body);

    const scope = await getStaffAccessScope(req.user!.userId);
    if (!scope?.schoolId) return res.status(400).json({ error: "Not associated with a school" });

    let records: Record<string, string>[];
    try {
      records = parseCsv(csvData, { columns: true, skip_empty_lines: true, trim: true });
    } catch {
      return res.status(400).json({ error: "Invalid CSV format" });
    }

    if (records.length === 0) return res.status(400).json({ error: "CSV has no data rows" });
    if (records.length > 500) return res.status(400).json({ error: "CSV exceeds 500 row limit" });

    // Load all students belonging to this school
    const schoolStudents = await prisma.user.findMany({
      where: {
        role: "STUDENT",
        ...buildCohortScopedStudentWhere(scope),
      },
      select: { id: true, email: true, schoolId: true, cohortId: true },
    });
    const studentByEmail = new Map<string, (typeof schoolStudents)[number]>(schoolStudents.map((s) => [s.email.toLowerCase(), s]));

    const createdIds: string[] = [];
    const skipped: { row: number; email: string; reason: string }[] = [];

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNum = i + 2; // +1 header, +1 for 1-index

      const email = (row.student_email ?? row.email ?? "").toLowerCase();
      const orgName = (row.organization_name ?? row.organization ?? "").trim();
      const dateStr = (row.date ?? "").trim();
      const hoursRaw = parseFloat(row.hours ?? "");
      const description = (row.description ?? "").trim() || "Imported prior service hours";
      const category = (row.category ?? "general").trim() || "general";

      if (!email) { skipped.push({ row: rowNum, email: "", reason: "Missing student_email" }); continue; }
      if (!orgName) { skipped.push({ row: rowNum, email, reason: "Missing organization_name" }); continue; }
      if (!dateStr) { skipped.push({ row: rowNum, email, reason: "Missing date" }); continue; }
      if (isNaN(hoursRaw) || hoursRaw <= 0 || hoursRaw > 24) {
        skipped.push({ row: rowNum, email, reason: "Invalid hours (must be > 0 and ≤ 24)" }); continue;
      }

      const serviceDate = new Date(dateStr);
      if (isNaN(serviceDate.getTime())) {
        skipped.push({ row: rowNum, email, reason: "Invalid date (use YYYY-MM-DD)" }); continue;
      }

      const student = studentByEmail.get(email);
      if (!student) {
        skipped.push({ row: rowNum, email, reason: "Student not found in your school" }); continue;
      }

      const schoolId = (await resolveStudentSchoolId(student.id)) ?? scope.schoolId;

      const submission = await prisma.selfSubmittedRequest.create({
        data: {
          studentId: student.id,
          schoolId: schoolId!,
          organizationName: orgName,
          description,
          date: serviceDate,
          hours: hoursRaw,
          category,
          status: "APPROVED",
          reviewedBy: scope.userId,
          reviewedAt: new Date(),
        },
      });
      createdIds.push(submission.id);
    }

    await prisma.auditLog.create({
      data: {
        action: "BULK_HOURS_IMPORT",
        actorId: scope.userId,
        details: JSON.stringify({
          imported: createdIds.length,
          skipped: skipped.length,
          schoolId: scope.schoolId,
        }),
      },
    });

    res.json({ imported: createdIds.length, skipped });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    console.error("Bulk import error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/self-submissions — list submissions
// For school admin: all pending submissions for their school
// For student: their own submissions
router.get("/", authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.role === "STUDENT") {
      const submissions = await prisma.selfSubmittedRequest.findMany({
        where: { studentId: user.id },
        orderBy: { createdAt: "desc" },
      });
      return res.json(submissions);
    }

    if (["SCHOOL_ADMIN", "TEACHER"].includes(user.role)) {
      const scope = await getStaffAccessScope(req.user!.userId);
      if (!scope?.schoolId) return res.status(400).json({ error: "Not associated with a school" });
      const statusFilter = req.query.status as string | undefined;
      const submissions = await prisma.selfSubmittedRequest.findMany({
        where: {
          schoolId: scope.schoolId,
          ...(scope.isSchoolAdmin ? {} : {
            student: {
              OR: [
                { cohortId: { in: scope.assignedCohortIds } },
                { cohortMemberships: { some: { isActive: true, cohortId: { in: scope.assignedCohortIds } } } },
              ],
            },
          }),
          ...(statusFilter ? { status: statusFilter } : {}),
        },
        include: {
          student: { select: { id: true, name: true, email: true, cohortId: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      return res.json(submissions);
    }

    res.status(403).json({ error: "Access denied" });
  } catch (err) {
    console.error("List self submissions error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/self-submissions/:id/approve — school admin approves
router.post("/:id/approve", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const scope = await getStaffAccessScope(req.user!.userId);
    const submission = await prisma.selfSubmittedRequest.findUnique({
      where: { id: req.params.id },
      include: { student: { select: { id: true, email: true, name: true } } },
    });

    if (!submission) return res.status(404).json({ error: "Submission not found" });
    if (submission.schoolId !== scope?.schoolId) return res.status(403).json({ error: "Not your school's submission" });
    const studentAllowed = scope ? await assertStudentAccessibleToStaff(scope, submission.student.id) : false;
    if (!studentAllowed) return res.status(403).json({ error: "Student is not enrolled in a cohort you control" });
    if (submission.status !== "PENDING") return res.status(400).json({ error: "Submission is not pending" });

    const { adjustedHours, overrideCap } = z.object({
      adjustedHours: z.number().positive().max(24).optional(),
      overrideCap: z.boolean().optional(),
    }).parse(req.body);
    const hours = adjustedHours ?? submission.hours;

    // Category cap check
    if (!overrideCap) {
      const capCheck = await checkCategoryCap(submission.studentId, submission.category, hours);
      if (capCheck.exceeded) {
        return res.status(400).json({
          error: `Approval would exceed the "${capCheck.category}" category cap of ${capCheck.cap} hours (current: ${capCheck.current.toFixed(1)}h, adding: ${hours}h). Pass overrideCap: true to bypass.`,
          capExceeded: true,
          cap: capCheck.cap,
          current: capCheck.current,
          category: capCheck.category,
        });
      }
    }

    const updated = await prisma.selfSubmittedRequest.update({
      where: { id: req.params.id },
      data: {
        status: "APPROVED",
        hours,
        reviewedBy: req.user!.userId,
        reviewedAt: new Date(),
        rejectionReason: null,
        revisionNote: null,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: overrideCap ? "CAP_OVERRIDE" : "SELF_SUBMISSION_APPROVED",
        actorId: req.user!.userId,
        details: JSON.stringify({
          submissionId: submission.id,
          studentId: submission.studentId,
          hours,
          orgName: submission.organizationName,
          ...(overrideCap ? { capOverride: true } : {}),
        }),
      },
    });

    // Notify student
    await prisma.notification.create({
      data: {
        userId: submission.studentId,
        type: "VERIFICATION_UPDATE",
        title: "Self-Submitted Hours Approved",
        body: `Your ${hours} hours at "${submission.organizationName}" have been approved.`,
        data: JSON.stringify({ href: "/submit" }),
      },
    });

    sendSelfSubmissionApprovedEmail(
      submission.student.email,
      submission.student.name,
      submission.organizationName,
      hours
    ).catch(() => {});

    res.json(updated);
  } catch (err) {
    console.error("Approve self submission error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/self-submissions/:id/reject — school admin rejects
router.post("/:id/reject", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const scope = await getStaffAccessScope(req.user!.userId);
    const submission = await prisma.selfSubmittedRequest.findUnique({
      where: { id: req.params.id },
      include: { student: { select: { id: true, email: true, name: true } } },
    });

    if (!submission) return res.status(404).json({ error: "Submission not found" });
    if (submission.schoolId !== scope?.schoolId) return res.status(403).json({ error: "Not your school's submission" });
    const studentAllowed = scope ? await assertStudentAccessibleToStaff(scope, submission.student.id) : false;
    if (!studentAllowed) return res.status(403).json({ error: "Student is not enrolled in a cohort you control" });
    if (submission.status !== "PENDING") return res.status(400).json({ error: "Submission is not pending" });

    const { reason } = z.object({ reason: z.string().min(1) }).parse(req.body);

    const updated = await prisma.selfSubmittedRequest.update({
      where: { id: req.params.id },
      data: {
        status: "REJECTED",
        rejectionReason: reason,
        reviewedBy: req.user!.userId,
        reviewedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "SELF_SUBMISSION_REJECTED",
        actorId: req.user!.userId,
        details: JSON.stringify({ submissionId: submission.id, studentId: submission.studentId, reason }),
      },
    });

    await prisma.notification.create({
      data: {
        userId: submission.studentId,
        type: "VERIFICATION_UPDATE",
        title: "Self-Submitted Hours Not Approved",
        body: `Your hours at "${submission.organizationName}" were not approved. Reason: ${reason}`,
        data: JSON.stringify({ href: "/submit" }),
      },
    });

    sendSelfSubmissionRejectedEmail(
      submission.student.email,
      submission.student.name,
      submission.organizationName,
      reason
    ).catch(() => {});

    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    console.error("Reject self submission error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/self-submissions/:id/request-revision — admin sends back for revision
router.post("/:id/request-revision", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const scope = await getStaffAccessScope(req.user!.userId);
    const submission = await prisma.selfSubmittedRequest.findUnique({
      where: { id: req.params.id },
      include: { student: { select: { id: true, email: true, name: true } } },
    });

    if (!submission) return res.status(404).json({ error: "Submission not found" });
    if (submission.schoolId !== scope?.schoolId) return res.status(403).json({ error: "Not your school's submission" });
    const studentAllowed = scope ? await assertStudentAccessibleToStaff(scope, submission.student.id) : false;
    if (!studentAllowed) return res.status(403).json({ error: "Student is not enrolled in a cohort you control" });
    if (submission.status !== "PENDING") return res.status(400).json({ error: "Only pending submissions can be sent for revision" });

    const { note } = z.object({ note: z.string().min(1).max(1000) }).parse(req.body);

    const updated = await prisma.selfSubmittedRequest.update({
      where: { id: req.params.id },
      data: {
        status: "REVISION_REQUESTED",
        revisionNote: note,
        reviewedBy: req.user!.userId,
        reviewedAt: new Date(),
      },
    });

    await prisma.notification.create({
      data: {
        userId: submission.studentId,
        type: "VERIFICATION_UPDATE",
        title: "Revision requested for your submission",
        body: `Your hours at "${submission.organizationName}" need revision. Note: ${note}`,
        data: JSON.stringify({ href: "/submit" }),
      },
    });

    sendSubmissionRevisionEmail(
      submission.student.email,
      submission.student.name,
      submission.organizationName,
      note
    ).catch(() => {});

    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    console.error("Request revision error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/self-submissions/:id/cancel — student cancels their own pending/revision request
router.post("/:id/cancel", authenticate, requireRole("STUDENT"), async (req: Request, res: Response) => {
  try {
    const submission = await prisma.selfSubmittedRequest.findUnique({ where: { id: req.params.id } });
    if (!submission) return res.status(404).json({ error: "Submission not found" });
    if (submission.studentId !== req.user!.userId) return res.status(403).json({ error: "Not your submission" });
    if (!["PENDING", "REVISION_REQUESTED"].includes(submission.status)) {
      return res.status(400).json({ error: "Only pending or revision-requested submissions can be cancelled" });
    }

    const updated = await prisma.selfSubmittedRequest.update({
      where: { id: submission.id },
      data: {
        status: "CANCELLED",
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "SELF_SUBMISSION_CANCELLED",
        actorId: req.user!.userId,
        details: JSON.stringify({
          submissionId: submission.id,
          studentId: submission.studentId,
          previousStatus: submission.status,
          orgName: submission.organizationName,
        }),
      },
    });

    res.json(updated);
  } catch (err) {
    console.error("Cancel self submission error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/self-submissions/:id — student updates and resubmits a REVISION_REQUESTED submission
router.put("/:id", authenticate, requireRole("STUDENT"), async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      organizationName: z.string().min(1).max(255).optional(),
      description: z.string().min(1).max(2000).optional(),
      date: z.string().optional(),
      hours: z.number().positive().max(24).optional(),
      evidenceNote: z.string().max(1000).optional(),
      category: z.string().max(100).optional(),
    });
    const data = schema.parse(req.body);

    const submission = await prisma.selfSubmittedRequest.findUnique({ where: { id: req.params.id } });
    if (!submission) return res.status(404).json({ error: "Submission not found" });
    if (submission.studentId !== req.user!.userId) return res.status(403).json({ error: "Not your submission" });
    if (submission.status !== "REVISION_REQUESTED") return res.status(400).json({ error: "Only revision-requested submissions can be updated" });

    const rules = await resolveEffectiveRules(req.user!.userId);
    if (rules && !rules.allowSelfSubmission) {
      return res.status(403).json({ error: "Your school does not accept self-submitted hours." });
    }

    const serviceDate = data.date ? new Date(data.date) : submission.date;
    if (rules?.serviceStartDate && serviceDate < rules.serviceStartDate) {
      return res.status(400).json({ error: `Service date must be on or after ${rules.serviceStartDate.toISOString().split("T")[0]}.` });
    }
    if (rules?.serviceEndDate && serviceDate > rules.serviceEndDate) {
      return res.status(400).json({ error: `Service date must be on or before ${rules.serviceEndDate.toISOString().split("T")[0]}.` });
    }

    const nextCategory = data.category ?? submission.category;
    const blockedCategoryKeys = await getBlockedCategoryKeysForStudent(req.user!.userId);
    if (blockedCategoryKeys.has(normalizeCategoryKey(nextCategory))) {
      return res.status(403).json({
        error: `Your school is preventing you from doing more ${nextCategory || "this category"}. You have already completed the maximum allowed hours in that category.`,
        categoryBlocked: true,
        category: nextCategory || "this category",
      });
    }

    const updated = await prisma.selfSubmittedRequest.update({
      where: { id: req.params.id },
      data: {
        ...(data.organizationName && { organizationName: data.organizationName }),
        ...(data.description && { description: data.description }),
        ...(data.date && { date: serviceDate }),
        ...(data.hours && { hours: data.hours }),
        ...(data.evidenceNote !== undefined && { evidenceNote: data.evidenceNote || null }),
        ...(data.category && { category: data.category }),
        status: "PENDING",
        timesRevised: submission.timesRevised + 1,
        rejectionReason: null,
      },
    });

    // Notify school admins again
    prisma.user.findMany({
      where: { schoolId: submission.schoolId, role: "SCHOOL_ADMIN" },
      select: { id: true, email: true, name: true },
    }).then(async (admins) => {
      const student = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { name: true } });
      await prisma.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          type: "SELF_SUBMISSION_REVIEW",
          title: "Revised self-submitted hours request",
          body: `${student?.name ?? "A student"} resubmitted ${updated.hours}h for ${updated.organizationName}.`,
          data: JSON.stringify({ href: "/submissions" }),
        })),
      }).catch(() => {});
      for (const admin of admins) {
        sendNewSubmissionAlertEmail(admin.email, admin.name, student?.name ?? "A student", updated.organizationName, updated.hours).catch(() => {});
      }
    }).catch(() => {});

    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    console.error("Update self submission error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
