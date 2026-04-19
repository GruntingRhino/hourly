import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { logDataAccess, resolveStudentSchoolId } from "../lib/dataAccessLog";
import { calculateStudentHours } from "../lib/hoursCalculator";
import { buildStudentProgressRecords } from "../lib/studentProgress";
import { signToken } from "../middleware/auth";
import { CLIENT_URL } from "../services/email";

const router = Router();

// 5 parent-link generations per student per hour — prevents token churn/abuse
const parentLinkLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => `parent-link:${(req as any).user?.userId ?? req.ip}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many parent link requests. Please wait before generating another." },
});

// 30 reads per IP per 15 minutes — public endpoint, tokens not guessable but still needs a floor
const parentProgressLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

const SCHOOL_ROLES = ["SCHOOL_ADMIN", "TEACHER"];

function resolveParentProgressBaseUrl(req: Request): string {
  const origin = typeof req.headers.origin === "string" ? req.headers.origin.trim() : "";
  const referer = typeof req.headers.referer === "string" ? req.headers.referer.trim() : "";

  const refererOrigin = (() => {
    if (!referer) return "";
    try {
      return new URL(referer).origin;
    } catch {
      return "";
    }
  })();

  const requestOrigin = origin || refererOrigin;
  const isLocalDevOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(requestOrigin);

  if (process.env.NODE_ENV !== "production" && isLocalDevOrigin) {
    return requestOrigin;
  }

  return CLIENT_URL;
}

// GET /api/reports/student — student's hour summary
router.get("/student", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req.query.studentId as string) || req.user!.userId;

    if (userId !== req.user!.userId) {
      if (!SCHOOL_ROLES.includes(req.user!.role)) {
        return res.status(403).json({ error: "Cannot view this report" });
      }

      // Enforce school scoping: school staff may only view students in their own school
      const actor = await prisma.user.findUnique({ where: { id: req.user!.userId } });
      if (!actor?.schoolId) return res.status(403).json({ error: "Not associated with a school" });

      const studentSchoolId = await resolveStudentSchoolId(userId);
      if (studentSchoolId !== actor.schoolId) {
        return res.status(403).json({ error: "Student is not enrolled in your school" });
      }

      // Audit: school staff accessing a student report
      await logDataAccess({
        actorId: req.user!.userId,
        action: "VIEW_STUDENT_REPORT",
        targetType: "student",
        targetId: userId,
        schoolId: actor.schoolId,
      });
    }

    const sessions = await prisma.serviceSession.findMany({
      where: { userId },
      include: {
        opportunity: {
          include: { organization: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const approved = sessions.filter((s) => s.verificationStatus === "APPROVED");
    const pending = sessions.filter((s) => s.verificationStatus === "PENDING" && s.status !== "COMMITTED");
    const committed = sessions.filter((s) => s.status === "COMMITTED" || s.status === "PENDING_VERIFICATION");
    const rejected = sessions.filter((s) => s.verificationStatus === "REJECTED");

    // Aggregate hours from all sources: BeneficiarySignup + SelfSubmittedRequest + ServiceSession (legacy)
    const hoursMap = await calculateStudentHours([userId]);
    const studentHours = hoursMap.get(userId) ?? { approved: 0, pending: 0 };

    // totalCommittedHours remains ServiceSession-only (no equivalent concept in other models)
    const totalCommittedHours = committed.reduce((sum, s) => sum + (s.totalHours || 0), 0);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        classroom: { include: { school: true } },
        cohort: { include: { school: true } },
        school: true,
      },
    });

    const school = user?.classroom?.school || user?.cohort?.school || user?.school;

    res.json({
      totalApprovedHours: Math.round(studentHours.approved * 100) / 100,
      totalPendingHours: Math.round(studentHours.pending * 100) / 100,
      totalCommittedHours: Math.round(totalCommittedHours * 100) / 100,
      requiredHours: user?.cohort?.requiredHours ?? school?.requiredHours ?? 40,
      activitiesCompleted: approved.length,
      sessions,
      approved,
      pending,
      committed,
      rejected,
    });
  } catch (err) {
    console.error("Student report error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/reports/organization — org volunteer report
router.get("/organization", authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user?.organizationId && !SCHOOL_ROLES.includes(req.user!.role)) {
      return res.status(400).json({ error: "Not associated with organization" });
    }

    const orgId = (req.query.organizationId as string) || user?.organizationId;
    if (!orgId) return res.status(400).json({ error: "Organization ID required" });

    // ORG_ADMIN may only query their own organization
    if (req.user!.role === "ORG_ADMIN" && orgId !== user?.organizationId) {
      return res.status(403).json({ error: "Not your organization" });
    }

    // School staff may only query organizations linked to their school
    if (SCHOOL_ROLES.includes(req.user!.role)) {
      if (!user?.schoolId) return res.status(403).json({ error: "Not associated with a school" });
      const link = await prisma.schoolOrganization.findFirst({
        where: { schoolId: user.schoolId, organizationId: orgId, status: "APPROVED" },
        select: { id: true },
      });
      if (!link) return res.status(403).json({ error: "Organization is not approved for your school" });
    }

    const sessions = await prisma.serviceSession.findMany({
      where: { opportunity: { organizationId: orgId } },
      include: {
        user: { select: { id: true, name: true, email: true } },
        opportunity: { select: { id: true, title: true, date: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const approved = sessions.filter((s) => s.verificationStatus === "APPROVED");
    const totalHours = approved.reduce((sum, s) => sum + (s.totalHours || 0), 0);

    res.json({
      totalSessions: sessions.length,
      approvedSessions: approved.length,
      totalApprovedHours: Math.round(totalHours * 100) / 100,
      sessions,
    });
  } catch (err) {
    console.error("Org report error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/reports/school — school compliance report
router.get("/school", authenticate, async (req: Request, res: Response) => {
  try {
    if (!SCHOOL_ROLES.includes(req.user!.role)) {
      return res.status(403).json({ error: "School role required" });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user?.schoolId) return res.status(400).json({ error: "Not associated with a school" });

    const school = await prisma.school.findUnique({ where: { id: user.schoolId } });
    if (!school) return res.status(400).json({ error: "School not found" });

    // Include both legacy classroom students and new cohort students
    const students = await prisma.user.findMany({
      where: {
        role: "STUDENT",
        OR: [
          { classroom: { schoolId: school.id } },
          { cohort: { schoolId: school.id } },
        ],
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
      requiredHours: school.requiredHours,
      serviceStartDate: school.serviceStartDate,
      serviceEndDate: school.serviceEndDate,
    });

    const report = progress.map((student) => ({
      studentId: student.id,
      name: student.name,
      email: student.email,
      grade: student.grade,
      cohortName: student.cohortName,
      approvedHours: student.approvedHours,
      pendingHours: student.pendingHours,
      requiredHours: student.requiredHours,
      completed: student.status === "COMPLETED",
      percentComplete: student.percentComplete,
      status: student.status,
      riskLevel: student.riskLevel,
      riskReasons: student.riskReasons,
      noShowCount: student.noShowCount,
      daysToDeadline: student.daysToDeadline,
    }));

    await logDataAccess({
      actorId: req.user!.userId,
      action: "VIEW_SCHOOL_REPORT",
      targetType: "school",
      targetId: school.id,
      schoolId: school.id,
      details: { studentCount: report.length },
    });

    res.json({
      schoolName: school.name,
      requiredHours: school.requiredHours,
      totalStudents: report.length,
      studentsCompleted: report.filter((r) => r.completed).length,
      students: report,
    });
  } catch (err) {
    console.error("School report error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/reports/export/csv — CSV export
router.get("/export/csv", authenticate, async (req: Request, res: Response) => {
  try {
    const { type } = req.query;

    let rows: string[][] = [];
    let filename = "goodhours-report.csv";

    if (req.user!.role !== "STUDENT" && type !== "student") {
      return res.status(403).json({ error: "Student role required for CSV export" });
    }

    if (type === "student" || req.user!.role === "STUDENT") {
      const userId = req.user!.userId;

      const [sessions, benSignups, selfSubs] = await Promise.all([
        prisma.serviceSession.findMany({
          where: { userId, verificationStatus: "APPROVED" },
          include: { opportunity: { include: { organization: { select: { name: true } } } } },
          orderBy: { checkInTime: "asc" },
        }),
        prisma.beneficiarySignup.findMany({
          where: { studentId: userId, verificationStatus: "APPROVED" },
          include: {
            slot: {
              include: {
                opportunity: {
                  include: { beneficiary: { select: { name: true } } },
                },
              },
            },
          },
          orderBy: { checkedInAt: "asc" },
        }),
        prisma.selfSubmittedRequest.findMany({
          where: { studentId: userId, status: "APPROVED" },
          orderBy: { date: "asc" },
        }),
      ]);

      await logDataAccess({
        actorId: userId,
        action: "EXPORT_CSV",
        targetType: "student",
        targetId: userId,
        details: { type: "student", sessionCount: sessions.length + benSignups.length + selfSubs.length },
      });

      // Combine all sources into uniform rows, sorted by date
      type CsvRow = { date: string; activity: string; organization: string; hours: number };
      const allRows: CsvRow[] = [];

      for (const s of sessions) {
        allRows.push({
          date: s.checkInTime?.toISOString().split("T")[0] || "",
          activity: s.opportunity.title,
          organization: s.opportunity.organization.name,
          hours: s.totalHours || 0,
        });
      }
      for (const bs of benSignups) {
        allRows.push({
          date: bs.slot.date.toISOString().split("T")[0],
          activity: bs.slot.opportunity.title,
          organization: bs.slot.opportunity.beneficiary.name,
          hours: bs.totalHours ?? bs.slot.durationHours,
        });
      }
      for (const ss of selfSubs) {
        allRows.push({
          date: ss.date.toISOString().split("T")[0],
          activity: ss.organizationName,
          organization: ss.organizationName,
          hours: ss.hours,
        });
      }

      allRows.sort((a, b) => a.date.localeCompare(b.date));

      rows.push(["Date", "Opportunity", "Organization", "Hours", "Status"]);
      for (const r of allRows) {
        rows.push([r.date, r.activity, r.organization, String(r.hours), "APPROVED"]);
      }
      filename = "my-service-hours.csv";
    }

    const csv = rows.length > 0
      ? rows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n")
      : '"Date","Opportunity","Organization","Hours","Status"';
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    console.error("CSV export error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/reports/parent-link — generate a shareable parent progress link for the current student
router.post("/parent-link", authenticate, parentLinkLimiter, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== "STUDENT") {
      return res.status(403).json({ error: "Student role required" });
    }

    const token = signToken(
      { studentId: req.user!.userId, purpose: "PARENT_PROGRESS" },
      { expiresIn: "30d" }
    );
    const baseUrl = resolveParentProgressBaseUrl(req);

    res.json({
      token,
      url: `${baseUrl}/parent-progress?token=${encodeURIComponent(token)}`,
    });
  } catch (err) {
    console.error("Parent link error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/reports/parent-progress?token=... — read-only parent progress view
router.get("/parent-progress", parentProgressLimiter, async (req: Request, res: Response) => {
  try {
    const token = String(req.query.token || "").trim();
    if (!token) return res.status(400).json({ error: "token query param is required" });

    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { studentId?: string; purpose?: string };
    if (payload.purpose !== "PARENT_PROGRESS" || !payload.studentId) {
      return res.status(400).json({ error: "Invalid parent progress token" });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.studentId },
      include: {
        classroom: { include: { school: true } },
        cohort: { include: { school: true } },
        school: true,
      },
    });
    if (!user || user.role !== "STUDENT") {
      return res.status(404).json({ error: "Student not found" });
    }

    const school = user.classroom?.school || user.cohort?.school || user.school;
    const hours = (await calculateStudentHours([user.id])).get(user.id) ?? { approved: 0, pending: 0 };
    const requiredHours = user.cohort?.requiredHours ?? school?.requiredHours ?? 40;
    const deadline = user.cohort?.serviceEndDate ?? school?.serviceEndDate ?? null;
    const remainingHours = Math.max(0, Math.round((requiredHours - hours.approved) * 100) / 100);

    res.json({
      student: {
        id: user.id,
        name: user.name,
        grade: user.grade,
      },
      school: school ? { id: school.id, name: school.name } : null,
      cohort: user.cohort ? { id: user.cohort.id, name: user.cohort.name } : null,
      approvedHours: Math.round(hours.approved * 100) / 100,
      pendingHours: Math.round(hours.pending * 100) / 100,
      requiredHours,
      remainingHours,
      percentComplete: Math.min(100, Math.round((hours.approved / requiredHours) * 100)),
      deadline,
    });
  } catch (err) {
    console.error("Parent progress error:", err);
    res.status(400).json({ error: "Invalid or expired parent progress token" });
  }
});

// GET /api/reports/audit/:sessionId — audit trail for a session
router.get("/audit/:sessionId", authenticate, async (req: Request, res: Response) => {
  try {
    const session = await prisma.serviceSession.findUnique({
      where: { id: req.params.sessionId },
      include: {
        user: {
          select: {
            id: true,
            classroom: { select: { schoolId: true } },
            cohort: { select: { schoolId: true } },
          },
        },
        opportunity: { select: { organizationId: true } },
      },
    });
    if (!session) return res.status(404).json({ error: "Session not found" });

    const actorId = req.user!.userId;
    const actorRole = req.user!.role;

    // Authorization: student owns the session, school staff of their school, or org admin of the opportunity
    if (session.userId !== actorId) {
      if (SCHOOL_ROLES.includes(actorRole)) {
        const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { schoolId: true } });
        const studentSchoolId = session.user.classroom?.schoolId ?? session.user.cohort?.schoolId ?? null;
        if (!actor?.schoolId || studentSchoolId !== actor.schoolId) {
          return res.status(403).json({ error: "Not authorized to view this audit log" });
        }
      } else if (actorRole === "ORG_ADMIN") {
        const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { organizationId: true } });
        if (session.opportunity.organizationId !== actor?.organizationId) {
          return res.status(403).json({ error: "Not authorized to view this audit log" });
        }
      } else {
        return res.status(403).json({ error: "Not authorized to view this audit log" });
      }
    }

    const logs = await prisma.auditLog.findMany({
      where: { sessionId: req.params.sessionId },
      include: {
        actor: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    res.json(logs);
  } catch (err) {
    console.error("Audit log error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
