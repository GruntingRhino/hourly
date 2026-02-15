import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";

const router = Router();

// POST /api/verification/:sessionId/approve — org approves hours
router.post("/:sessionId/approve", authenticate, requireRole("ORG_ADMIN", "SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const session = await prisma.serviceSession.findUnique({
      where: { id: req.params.sessionId },
      include: { opportunity: true },
    });
    if (!session) return res.status(404).json({ error: "Session not found" });

    // Verify the actor has permission
    if (req.user!.role === "ORG_ADMIN") {
      const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
      if (session.opportunity.organizationId !== user?.organizationId) {
        return res.status(403).json({ error: "Not your organization's session" });
      }
    }

    if (session.verificationStatus === "APPROVED") {
      return res.status(400).json({ error: "Already approved" });
    }

    const { approvedHours } = req.body;
    const hours = approvedHours !== undefined ? approvedHours : session.totalHours;

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

    res.json(updated);
  } catch (err) {
    console.error("Approve error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/verification/:sessionId/reject — org rejects hours
router.post("/:sessionId/reject", authenticate, requireRole("ORG_ADMIN", "SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const session = await prisma.serviceSession.findUnique({
      where: { id: req.params.sessionId },
      include: { opportunity: true },
    });
    if (!session) return res.status(404).json({ error: "Session not found" });

    if (req.user!.role === "ORG_ADMIN") {
      const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
      if (session.opportunity.organizationId !== user?.organizationId) {
        return res.status(403).json({ error: "Not your organization's session" });
      }
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
        status: "CHECKED_OUT",
        opportunity: { organizationId: user.organizationId },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        opportunity: { select: { id: true, title: true, date: true, startTime: true, endTime: true } },
      },
      orderBy: { checkOutTime: "desc" },
    });

    res.json(sessions);
  } catch (err) {
    console.error("Pending verifications error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
