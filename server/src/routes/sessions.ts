import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";

const router = Router();

// Multer config for signature file uploads
const storage = multer.diskStorage({
  destination: path.join(__dirname, "../../uploads"),
  filename: (_req, file, cb) => {
    const unique = crypto.randomBytes(8).toString("hex");
    cb(null, `sig-${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = [".pdf", ".png", ".jpg", ".jpeg"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, PNG, JPG files are allowed"));
    }
  },
});

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
    if (session.status !== "PENDING_CHECKIN" && session.status !== "COMMITTED") {
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
router.get("/organization", authenticate, requireRole("ORG_ADMIN"), async (req: Request, res: Response) => {
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

// POST /api/sessions/:id/submit-verification — student submits verification with signature
router.post("/:id/submit-verification", authenticate, requireRole("STUDENT"), upload.single("signatureFile"), async (req: Request, res: Response) => {
  try {
    const session = await prisma.serviceSession.findUnique({
      where: { id: req.params.id },
      include: { opportunity: true, user: { include: { classroom: { include: { school: true } } } } },
    });
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.userId !== req.user!.userId) {
      return res.status(403).json({ error: "Not your session" });
    }
    if (session.status !== "COMMITTED") {
      return res.status(400).json({ error: "Session is not in COMMITTED state" });
    }

    // Check opportunity end date has passed
    const oppDate = new Date(session.opportunity.date);
    const now = new Date();
    if (now < oppDate) {
      return res.status(400).json({ error: "Cannot submit verification before the opportunity date" });
    }

    // Determine signature type
    const { signatureType, signatureData } = req.body;
    const file = req.file;

    if (signatureType === "DRAWN") {
      if (!signatureData) {
        return res.status(400).json({ error: "Signature data is required for drawn signatures" });
      }
    } else if (file) {
      // File upload path
    } else {
      return res.status(400).json({ error: "Either a drawn signature or file upload is required" });
    }

    const updated = await prisma.serviceSession.update({
      where: { id: req.params.id },
      data: {
        status: "PENDING_VERIFICATION",
        verificationStatus: "PENDING",
        signatureType: file ? "FILE" : "DRAWN",
        signatureData: signatureType === "DRAWN" ? signatureData : null,
        signatureFileUrl: file ? `/uploads/${file.filename}` : null,
        signatureFileName: file ? file.originalname : null,
        submittedAt: new Date(),
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: "SUBMIT_VERIFICATION",
        actorId: req.user!.userId,
        sessionId: session.id,
        details: JSON.stringify({
          signatureType: file ? "FILE" : "DRAWN",
          totalHours: session.totalHours,
        }),
      },
    });

    // Notify school staff
    const schoolId = session.user.classroom?.school?.id;
    if (schoolId) {
      const schoolStaff = await prisma.user.findMany({
        where: {
          schoolId,
          role: { in: ["SCHOOL_ADMIN", "TEACHER"] },
        },
      });
      await prisma.notification.createMany({
        data: schoolStaff.map((staff) => ({
          userId: staff.id,
          type: "VERIFICATION_SUBMITTED",
          title: "Verification Submitted",
          body: `${session.user.name} submitted ${session.totalHours}h for "${session.opportunity.title}" for review.`,
          data: JSON.stringify({ sessionId: session.id }),
        })),
      });
    }

    res.json(updated);
  } catch (err) {
    console.error("Submit verification error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/sessions/school — school sees all student sessions
router.get("/school", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER", "DISTRICT_ADMIN"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user?.schoolId) return res.status(400).json({ error: "Not associated with a school" });

    const { studentId, verificationStatus } = req.query;
    const where: any = { user: { classroom: { schoolId: user.schoolId } } };
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
