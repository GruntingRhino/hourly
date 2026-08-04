import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { logDataAccess } from "../lib/dataAccessLog";
import { buildAnonymousVolunteerLabel } from "../lib/privacy";
import { detectSignatureMime } from "../lib/signatureStorage";
import {
  assertStudentAccessibleToStaff,
  buildCohortScopedStudentWhere,
  getStaffAccessScope,
} from "../lib/cohortAccess";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

function uploadSignatureFile(req: Request, res: Response, next: NextFunction) {
  upload.single("signatureFile")(req, res, (err: any) => {
    if (!err) return next();

    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File must be 5MB or smaller" });
    }

    const message = typeof err?.message === "string" && err.message.trim()
      ? err.message.trim()
      : "Invalid signature file upload";
    return res.status(400).json({ error: message });
  });
}

async function authorizeVerificationSubmission(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await prisma.serviceSession.findUnique({
      where: { id: req.params.id },
      include: { opportunity: true },
    });
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.userId !== req.user!.userId) return res.status(403).json({ error: "Not your session" });
    if (!["COMMITTED", "CHECKED_OUT", "PENDING_VERIFICATION", "REJECTED"].includes(session.status)) {
      return res.status(400).json({ error: "Session is not ready for verification" });
    }
    if (new Date() < new Date(session.opportunity.date)) {
      return res.status(400).json({ error: "Cannot submit verification before the opportunity date" });
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

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
    const { status, verificationStatus, opportunityId } = req.query;
    const where: any = { userId: req.user!.userId };
    if (status) where.status = status;
    if (verificationStatus) where.verificationStatus = verificationStatus;
    if (opportunityId) where.opportunityId = opportunityId;

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
        user: { select: { id: true } },
        opportunity: { select: { id: true, title: true, date: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(
      sessions.map((session) => ({
        ...session,
        user: {
          label: buildAnonymousVolunteerLabel(session.user.id),
        },
      }))
    );
  } catch (err) {
    console.error("Org sessions error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/sessions/:id/submit-verification — student submits verification with signature
router.post("/:id/submit-verification", authenticate, requireRole("STUDENT"), authorizeVerificationSubmission, uploadSignatureFile, async (req: Request, res: Response) => {
  try {
    const session = await prisma.serviceSession.findUnique({
      where: { id: req.params.id },
      include: { opportunity: true, user: { include: { classroom: { include: { school: true } } } } },
    });
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.userId !== req.user!.userId) {
      return res.status(403).json({ error: "Not your session" });
    }
    if (!["COMMITTED", "CHECKED_OUT", "PENDING_VERIFICATION", "REJECTED"].includes(session.status)) {
      return res.status(400).json({ error: "Session is not ready for verification" });
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
      const signatureMimeType = detectSignatureMime(file.buffer);
      if (!signatureMimeType) {
        return res.status(400).json({ error: "Signature file must contain a PDF, PNG, or JPEG document" });
      }
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
        signatureFileName: file ? file.originalname : null,
        signatureFileBytes: file ? Uint8Array.from(file.buffer) : null,
        signatureFileMimeType: file ? detectSignatureMime(file.buffer) : null,
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

    // Notify org admins of verification submission
    const orgAdmins = await prisma.user.findMany({
      where: { organizationId: session.opportunity.organizationId, role: "ORG_ADMIN" },
      select: { id: true },
    });
    if (orgAdmins.length > 0) {
      await prisma.notification.createMany({
        data: orgAdmins.map((admin) => ({
          userId: admin.id,
          type: "VERIFICATION_SUBMITTED",
          title: "Verification Request",
          body: `${buildAnonymousVolunteerLabel(session.user.id)} submitted verification for "${session.opportunity.title}" — ${session.totalHours}h`,
        })),
      });
    }

    res.json(updated);
  } catch (err) {
    console.error("Submit verification error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/sessions/:id/signature-file — scoped access to durable file evidence
router.get("/:id/signature-file", authenticate, requireRole("STUDENT", "SCHOOL_ADMIN", "TEACHER", "ORG_ADMIN"), async (req: Request, res: Response) => {
  try {
    const session = await prisma.serviceSession.findUnique({
      where: { id: req.params.id },
      select: {
        userId: true,
        schoolId: true,
        signatureFileName: true,
        signatureFileBytes: true,
        signatureFileMimeType: true,
        opportunity: { select: { organizationId: true } },
      },
    });
    if (!session?.signatureFileBytes || !session.signatureFileMimeType) {
      return res.status(404).json({ error: "Signature file not found" });
    }

    const actor = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { role: true, organizationId: true },
    });
    let allowed = false;
    if (actor?.role === "STUDENT") {
      allowed = session.userId === req.user!.userId;
    } else if (actor?.role === "ORG_ADMIN") {
      allowed = actor.organizationId === session.opportunity.organizationId;
    } else if (actor?.role === "SCHOOL_ADMIN" || actor?.role === "TEACHER") {
      const scope = await getStaffAccessScope(req.user!.userId);
      allowed = Boolean(
        scope &&
        session.schoolId === scope.schoolId &&
        await assertStudentAccessibleToStaff(scope, session.userId)
      );
    }
    if (!allowed) return res.status(403).json({ error: "Forbidden" });

    const safeName = (session.signatureFileName ?? "signature").replace(/[\r\n"]/g, "_");
    res.setHeader("Content-Type", session.signatureFileMimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    res.send(Buffer.from(session.signatureFileBytes));
  } catch (err) {
    console.error("Signature download error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/sessions/school — school sees all student sessions
router.get("/school", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const scope = await getStaffAccessScope(req.user!.userId);
    if (!scope) return res.status(403).json({ error: "No school access" });

    const { studentId, verificationStatus } = req.query;

    if (studentId) {
      const allowed = await assertStudentAccessibleToStaff(scope, studentId as string);
      if (!allowed) {
        return res.status(404).json({ error: "Student not found" });
      }
    }

    const where: any = {
      schoolId: scope.schoolId,
      user: buildCohortScopedStudentWhere(scope),
    };
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

    await logDataAccess({
      actorId: req.user!.userId,
      action: "VIEW_SESSIONS",
      targetType: studentId ? "student" : "school",
      targetId: (studentId as string | undefined) ?? scope.schoolId,
      schoolId: scope.schoolId,
      details: { sessionCount: sessions.length },
    });

    res.json(sessions);
  } catch (err) {
    console.error("School sessions error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
