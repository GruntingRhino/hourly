import { Router, Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { resolveEffectiveRules, checkCategoryCap } from "../lib/schoolRules";
import {
  sendSelfSubmissionApprovedEmail,
  sendSelfSubmissionRejectedEmail,
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
    let schoolId = rules?.schoolId ?? user.schoolId;
    if (!schoolId && user.cohortId) {
      const cohort = await prisma.cohort.findUnique({ where: { id: user.cohortId }, select: { schoolId: true } });
      schoolId = cohort?.schoolId || null;
    }
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

    res.status(201).json(submission);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    console.error("Create self submission error:", err);
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

    if (["SCHOOL_ADMIN", "TEACHER", "DISTRICT_ADMIN"].includes(user.role)) {
      if (!user.schoolId) return res.status(400).json({ error: "Not associated with a school" });
      const statusFilter = req.query.status as string | undefined;
      const submissions = await prisma.selfSubmittedRequest.findMany({
        where: {
          schoolId: user.schoolId,
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
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    const submission = await prisma.selfSubmittedRequest.findUnique({
      where: { id: req.params.id },
      include: { student: { select: { email: true, name: true } } },
    });

    if (!submission) return res.status(404).json({ error: "Submission not found" });
    if (submission.schoolId !== user?.schoolId) return res.status(403).json({ error: "Not your school's submission" });
    if (submission.status !== "PENDING") return res.status(400).json({ error: "Submission is not pending" });

    const { adjustedHours, overrideCap } = req.body;
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
        reviewedBy: req.user!.userId,
        reviewedAt: new Date(),
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
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    const submission = await prisma.selfSubmittedRequest.findUnique({
      where: { id: req.params.id },
      include: { student: { select: { email: true, name: true } } },
    });

    if (!submission) return res.status(404).json({ error: "Submission not found" });
    if (submission.schoolId !== user?.schoolId) return res.status(403).json({ error: "Not your school's submission" });
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

export default router;
