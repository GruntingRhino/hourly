import { Router, Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { sendHourApprovedEmail } from "../services/email";
import { resolveStudentSchoolId } from "../lib/dataAccessLog";
import { resolveEffectiveRules } from "../lib/schoolRules";

const router = Router();

// POST /api/verification/:sessionId/approve — approve hours
router.post("/:sessionId/approve", authenticate, requireRole("ORG_ADMIN", "SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const session = await prisma.serviceSession.findUnique({
      where: { id: req.params.sessionId },
      include: { opportunity: true },
    });
    if (!session) return res.status(404).json({ error: "Session not found" });

    // Prevent self-verification
    if (session.userId === req.user!.userId) {
      return res.status(403).json({ error: "Cannot verify your own session" });
    }

    // Verify the actor has permission
    if (req.user!.role === "ORG_ADMIN") {
      const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
      if (session.opportunity.organizationId !== user?.organizationId) {
        return res.status(403).json({ error: "Not your organization's session" });
      }
    }

    // School staff may only approve sessions for students in their own school
    if (["SCHOOL_ADMIN", "TEACHER"].includes(req.user!.role)) {
      const actor = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { schoolId: true } });
      if (!actor?.schoolId) return res.status(403).json({ error: "Not associated with a school" });
      const studentSchoolId = await resolveStudentSchoolId(session.userId);
      if (studentSchoolId !== actor.schoolId) {
        return res.status(403).json({ error: "Student is not enrolled in your school" });
      }

      // Enforce requireOrgVerification: school staff cannot be the first approver
      const rules = await resolveEffectiveRules(session.userId);
      if (rules?.requireOrgVerification) {
        return res.status(403).json({
          error: "Your school requires organization verification before school approval. Please ask the organization to verify this session first.",
        });
      }
    }

    if (session.verificationStatus === "APPROVED") {
      return res.status(400).json({ error: "Already approved" });
    }

    // Must be in PENDING_VERIFICATION or CHECKED_OUT status
    if (!["PENDING_VERIFICATION", "CHECKED_OUT"].includes(session.status)) {
      return res.status(400).json({ error: "Session is not pending verification" });
    }

    const { approvedHours } = z.object({
      approvedHours: z.number().positive().max(24).optional(),
    }).parse(req.body);
    const hours = approvedHours !== undefined ? approvedHours : (session.totalHours ?? 0);

    const updated = await prisma.serviceSession.update({
      where: { id: req.params.sessionId },
      data: {
        verificationStatus: "APPROVED",
        totalHours: hours,
        verifiedBy: req.user!.userId,
        verifiedAt: new Date(),
        status: "VERIFIED",
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "APPROVE",
        actorId: req.user!.userId,
        sessionId: session.id,
        details: JSON.stringify({ approvedHours: hours, originalHours: session.totalHours }),
      },
    });

    // Notify student
    await prisma.notification.create({
      data: {
        userId: session.userId,
        type: "VERIFICATION_UPDATE",
        title: "Hours Approved",
        body: `Your ${hours} hours for "${session.opportunity.title}" have been approved.`,
      },
    });

    // Send email to student (check notification preferences)
    const student = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { email: true },
    });
    if (student) {
      const org = await prisma.organization.findUnique({ where: { id: session.opportunity.organizationId }, select: { name: true } });
      if (org) {
        sendHourApprovedEmail(student.email, org.name, hours, session.opportunity.title).catch(() => {});
      }
    }

    res.json(updated);
  } catch (err) {
    console.error("Approve error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/verification/:sessionId/reject — reject hours
router.post("/:sessionId/reject", authenticate, requireRole("ORG_ADMIN", "SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const session = await prisma.serviceSession.findUnique({
      where: { id: req.params.sessionId },
      include: { opportunity: true },
    });
    if (!session) return res.status(404).json({ error: "Session not found" });

    // Prevent self-verification
    if (session.userId === req.user!.userId) {
      return res.status(403).json({ error: "Cannot verify your own session" });
    }

    if (req.user!.role === "ORG_ADMIN") {
      const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
      if (session.opportunity.organizationId !== user?.organizationId) {
        return res.status(403).json({ error: "Not your organization's session" });
      }
    }

    // School staff may only reject sessions for students in their own school
    if (["SCHOOL_ADMIN", "TEACHER"].includes(req.user!.role)) {
      const actor = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { schoolId: true } });
      if (!actor?.schoolId) return res.status(403).json({ error: "Not associated with a school" });
      const studentSchoolId = await resolveStudentSchoolId(session.userId);
      if (studentSchoolId !== actor.schoolId) {
        return res.status(403).json({ error: "Student is not enrolled in your school" });
      }
    }

    if (!["PENDING_VERIFICATION", "CHECKED_OUT"].includes(session.status)) {
      return res.status(400).json({ error: "Session is not pending verification" });
    }

    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: "Rejection reason is required" });

    const updated = await prisma.serviceSession.update({
      where: { id: req.params.sessionId },
      data: {
        verificationStatus: "REJECTED",
        rejectionReason: reason,
        verifiedBy: req.user!.userId,
        verifiedAt: new Date(),
        status: "REJECTED",
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "REJECT",
        actorId: req.user!.userId,
        sessionId: session.id,
        details: JSON.stringify({ reason }),
      },
    });

    await prisma.notification.create({
      data: {
        userId: session.userId,
        type: "VERIFICATION_UPDATE",
        title: "Hours Rejected",
        body: `Your hours for "${session.opportunity.title}" were rejected: ${reason}`,
      },
    });

    res.json(updated);
  } catch (err) {
    console.error("Reject error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/verification/pending — get pending verifications for org
router.get("/pending", authenticate, requireRole("ORG_ADMIN"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user?.organizationId) {
      return res.status(400).json({ error: "Not associated with organization" });
    }

    const sessions = await prisma.serviceSession.findMany({
      where: {
        verificationStatus: "PENDING",
        status: { in: ["CHECKED_OUT", "PENDING_VERIFICATION"] },
        opportunity: { organizationId: user.organizationId },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        opportunity: { select: { id: true, title: true, date: true, startTime: true, endTime: true } },
      },
      orderBy: { submittedAt: "desc" },
    });

    res.json(sessions);
  } catch (err) {
    console.error("Pending verifications error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/verification/school-pending — get pending verifications for school staff
router.get("/school-pending", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user?.schoolId) {
      return res.status(400).json({ error: "Not associated with a school" });
    }

    const sessions = await prisma.serviceSession.findMany({
      where: {
        status: "PENDING_VERIFICATION",
        verificationStatus: "PENDING",
        user: {
          OR: [
            { classroom: { schoolId: user.schoolId } },
            { cohort: { schoolId: user.schoolId } },
          ],
        },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        opportunity: {
          select: {
            id: true, title: true, date: true, startTime: true, endTime: true,
            organization: { select: { name: true } },
          },
        },
      },
      orderBy: { submittedAt: "desc" },
    });

    res.json(sessions);
  } catch (err) {
    console.error("School pending verifications error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
