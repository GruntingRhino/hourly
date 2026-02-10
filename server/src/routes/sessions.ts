import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";

const router = Router();

// POST /api/sessions/:id/checkin — student checks in
router.post("/:id/checkin", authenticate, requireRole("STUDENT"), async (req: Request, res: Response) => {
  try {
    const session = await prisma.serviceSession.findUnique({
      where: { id: req.params.id },
      include: { opportunity: true },
    });
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.userId !== req.user!.userId) {
      return res.status(403).json({ error: "Not your session" });
    }
    if (session.status !== "PENDING_CHECKIN") {
      return res.status(400).json({ error: "Already checked in or completed" });
    }

    // Time-window enforcement: allow check-in within 30 min of start
    const now = new Date();

    const updated = await prisma.serviceSession.update({
      where: { id: req.params.id },
      data: {
        checkInTime: now,
        status: "CHECKED_IN",
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CHECK_IN",
        actorId: req.user!.userId,
        sessionId: session.id,
        details: JSON.stringify({ time: now.toISOString() }),
      },
    });

    res.json(updated);
  } catch (err) {
    console.error("Check-in error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/sessions/:id/checkout — student checks out
router.post("/:id/checkout", authenticate, requireRole("STUDENT"), async (req: Request, res: Response) => {
  try {
    const session = await prisma.serviceSession.findUnique({
      where: { id: req.params.id },
      include: { opportunity: true },
    });
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.userId !== req.user!.userId) {
      return res.status(403).json({ error: "Not your session" });
    }
    if (session.status !== "CHECKED_IN") {
      return res.status(400).json({ error: "Not checked in" });
    }

    const now = new Date();
    const checkIn = session.checkInTime!;
    const totalHours = Math.round(((now.getTime() - checkIn.getTime()) / (1000 * 60 * 60)) * 100) / 100;

    const updated = await prisma.serviceSession.update({
      where: { id: req.params.id },
      data: {
        checkOutTime: now,
        totalHours,
        status: "CHECKED_OUT",
        verificationStatus: "PENDING",
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CHECK_OUT",
        actorId: req.user!.userId,
        sessionId: session.id,
        details: JSON.stringify({ time: now.toISOString(), totalHours }),
      },
    });

    res.json(updated);
  } catch (err) {
    console.error("Check-out error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/sessions/my — student's service sessions
router.get("/my", authenticate, requireRole("STUDENT"), async (req: Request, res: Response) => {
  try {
    const { status, verificationStatus } = req.query;
    const where: any = { userId: req.user!.userId };
    if (status) where.status = status;
    if (verificationStatus) where.verificationStatus = verificationStatus;

    const sessions = await prisma.serviceSession.findMany({
      where,
      include: {
        opportunity: {
          include: { organization: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(sessions);
  } catch (err) {
    console.error("My sessions error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/sessions/organization — org sees their volunteers' sessions
router.get("/organization", authenticate, requireRole("ORGANIZATION"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user?.organizationId) {
      return res.status(400).json({ error: "Not associated with organization" });
    }

    const { verificationStatus } = req.query;
    const where: any = { opportunity: { organizationId: user.organizationId } };
    if (verificationStatus) where.verificationStatus = verificationStatus;

    const sessions = await prisma.serviceSession.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        opportunity: { select: { id: true, title: true, date: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(sessions);
  } catch (err) {
    console.error("Org sessions error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/sessions/school — school sees all student sessions
router.get("/school", authenticate, requireRole("SCHOOL"), async (req: Request, res: Response) => {
  try {
    const school = await prisma.school.findFirst({ where: { adminUserId: req.user!.userId } });
    if (!school) return res.status(400).json({ error: "Not a school admin" });

    const { studentId, verificationStatus } = req.query;
    const where: any = { user: { schoolId: school.id } };
    if (studentId) where.userId = studentId;
    if (verificationStatus) where.verificationStatus = verificationStatus;

    const sessions = await prisma.serviceSession.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        opportunity: {
          include: { organization: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(sessions);
  } catch (err) {
    console.error("School sessions error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
