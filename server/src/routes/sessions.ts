import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { logDataAccess, resolveStudentSchoolId } from "../lib/dataAccessLog";
import { buildAnonymousVolunteerLabel } from "../lib/privacy";
import { detectSignatureMime } from "../lib/signatureStorage";
import { runSerializableTransaction } from "../lib/serializableTransaction";
import {
  createAttendanceQrToken,
  hashAttendanceQrToken,
  parseAttendanceQrToken,
} from "../lib/attendanceQr";

const router = Router();

const DEFAULT_QR_TTL_MINUTES = 30;
const MAX_QR_TTL_MINUTES = 120;

function attendanceQrSecret(): string {
  return process.env.QR_ATTENDANCE_SECRET || process.env.JWT_SECRET || "";
}

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

// POST /api/sessions/opportunities/:opportunityId/qr-token — organization creates a short-lived event check-in token
router.post("/opportunities/:opportunityId/qr-token", authenticate, requireRole("ORG_ADMIN"), async (req: Request, res: Response) => {
  try {
    const actor = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { organizationId: true },
    });
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: req.params.opportunityId },
      select: { id: true, organizationId: true, title: true },
    });
    if (!opportunity) return res.status(404).json({ error: "Opportunity not found" });
    if (!actor?.organizationId || actor.organizationId !== opportunity.organizationId) {
      return res.status(403).json({ error: "You do not manage this opportunity" });
    }

    const requestedMinutes = req.body?.expiresInMinutes;
    const expiresInMinutes = requestedMinutes == null ? DEFAULT_QR_TTL_MINUTES : Number(requestedMinutes);
    if (!Number.isInteger(expiresInMinutes) || expiresInMinutes < 1 || expiresInMinutes > MAX_QR_TTL_MINUTES) {
      return res.status(400).json({ error: `expiresInMinutes must be an integer from 1 to ${MAX_QR_TTL_MINUTES}` });
    }

    const secret = attendanceQrSecret();
    if (!secret) return res.status(503).json({ error: "Attendance QR is not configured" });

    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
    const tokenId = crypto.randomUUID();
    const token = createAttendanceQrToken({
      tokenId,
      opportunityId: opportunity.id,
      expiresAt,
      secret,
    });
    await prisma.attendanceQrToken.create({
      data: {
        id: tokenId,
        opportunityId: opportunity.id,
        createdById: req.user!.userId,
        tokenHash: hashAttendanceQrToken(token),
        expiresAt,
      },
    });

    return res.status(201).json({ token, opportunityId: opportunity.id, opportunityTitle: opportunity.title, expiresAt });
  } catch (err) {
    console.error("Create attendance QR token error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/sessions/qr-checkin — student redeems an event QR token once
router.post("/qr-checkin", authenticate, requireRole("STUDENT"), async (req: Request, res: Response) => {
  try {
    const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
    const parsed = parseAttendanceQrToken(token, attendanceQrSecret());
    if (!parsed) return res.status(400).json({ error: "Invalid or expired attendance QR token" });

    const tokenRecord = await prisma.attendanceQrToken.findUnique({ where: { tokenHash: hashAttendanceQrToken(token) } });
    if (!tokenRecord || tokenRecord.id !== parsed.tokenId || tokenRecord.opportunityId !== parsed.opportunityId) {
      return res.status(400).json({ error: "Invalid attendance QR token" });
    }
    if (tokenRecord.revokedAt || tokenRecord.expiresAt <= new Date()) {
      return res.status(400).json({ error: "Attendance QR token has expired" });
    }

    const result = await runSerializableTransaction(async (tx) => {
      const session = await tx.serviceSession.findUnique({
        where: { userId_opportunityId: { userId: req.user!.userId, opportunityId: parsed.opportunityId } },
      });
      if (!session) return { kind: "error" as const, status: 403, body: { error: "You are not signed up for this opportunity" } };
      if (session.status !== "PENDING_CHECKIN" && session.status !== "COMMITTED") {
        return { kind: "error" as const, status: 409, body: { error: "This session cannot be checked in" } };
      }

      const now = new Date();
      const updated = await tx.serviceSession.update({
        where: { id: session.id },
        data: { checkInTime: now, status: "CHECKED_IN" },
      });
      await tx.attendanceQrRedemption.create({
        data: { tokenId: tokenRecord.id, studentId: req.user!.userId, sessionId: session.id, checkedInAt: now },
      });
      await tx.auditLog.create({
        data: {
          action: "CHECK_IN",
          actorId: req.user!.userId,
          sessionId: session.id,
          details: JSON.stringify({ method: "QR", tokenId: tokenRecord.id, time: now.toISOString() }),
        },
      });
      return { kind: "success" as const, updated };
    });

    if (result.kind === "error") return res.status(result.status).json(result.body);
    return res.json(result.updated);
  } catch (err: any) {
    if (err?.code === "P2002") return res.status(409).json({ error: "This attendance QR token was already used" });
    console.error("QR check-in error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
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
    const allowed = actor?.role === "STUDENT"
      ? session.userId === req.user!.userId
      : actor?.role === "ORG_ADMIN"
        ? actor.organizationId === session.opportunity.organizationId
        : (await resolveStudentSchoolId(session.userId)) === (await resolveStudentSchoolId(req.user!.userId));
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
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user?.schoolId) return res.status(400).json({ error: "Not associated with a school" });

    const { studentId, verificationStatus } = req.query;

    // If viewing a specific student, verify they belong to this school first
    if (studentId) {
      const studentSchoolId = await resolveStudentSchoolId(studentId as string);
      if (studentSchoolId !== user.schoolId) {
        return res.status(403).json({ error: "Student is not enrolled in your school" });
      }
    }

    // Scope to students in this school — include both legacy classroom and new cohort students
    const schoolScope = {
      OR: [
        { classroom: { schoolId: user.schoolId } },
        { cohort: { schoolId: user.schoolId } },
        { cohortMemberships: { some: { isActive: true, cohort: { schoolId: user.schoolId } } } },
      ],
    };
    const where: any = { user: schoolScope };
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
      targetId: (studentId as string | undefined) ?? user.schoolId,
      schoolId: user.schoolId,
      details: { sessionCount: sessions.length },
    });

    res.json(sessions);
  } catch (err) {
    console.error("School sessions error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
