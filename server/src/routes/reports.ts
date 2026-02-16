import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";

const router = Router();

const SCHOOL_ROLES = ["SCHOOL_ADMIN", "TEACHER", "DISTRICT_ADMIN"];

// GET /api/reports/student — student's hour summary
router.get("/student", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req.query.studentId as string) || req.user!.userId;

    if (userId !== req.user!.userId && !SCHOOL_ROLES.includes(req.user!.role)) {
      return res.status(403).json({ error: "Cannot view this report" });
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

    const totalApprovedHours = approved.reduce((sum, s) => sum + (s.totalHours || 0), 0);
    const totalPendingHours = pending.reduce((sum, s) => sum + (s.totalHours || 0), 0);
    const totalCommittedHours = committed.reduce((sum, s) => sum + (s.totalHours || 0), 0);

    // Get student's school requirements via classroom
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        classroom: { include: { school: true } },
        school: true,
      },
    });

    const school = user?.classroom?.school || user?.school;

    res.json({
      totalApprovedHours: Math.round(totalApprovedHours * 100) / 100,
      totalPendingHours: Math.round(totalPendingHours * 100) / 100,
      totalCommittedHours: Math.round(totalCommittedHours * 100) / 100,
      requiredHours: school?.requiredHours || 40,
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

    const students = await prisma.user.findMany({
      where: {
        role: "STUDENT",
        classroom: { schoolId: school.id },
      },
      include: {
        serviceSessions: {
          where: { verificationStatus: "APPROVED" },
          select: { totalHours: true, opportunity: { select: { title: true, organizationId: true } } },
        },
      },
    });

    const report = students.map((s) => {
      const hours = s.serviceSessions.reduce((sum, ss) => sum + (ss.totalHours || 0), 0);
      return {
        studentId: s.id,
        name: s.name,
        email: s.email,
        grade: s.grade,
        approvedHours: Math.round(hours * 100) / 100,
        requiredHours: school.requiredHours,
        completed: hours >= school.requiredHours,
        percentComplete: Math.min(100, Math.round((hours / school.requiredHours) * 100)),
      };
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
    let filename = "hourly-report.csv";

    if (type === "student" || req.user!.role === "STUDENT") {
      const sessions = await prisma.serviceSession.findMany({
        where: { userId: req.user!.userId, verificationStatus: "APPROVED" },
        include: { opportunity: { include: { organization: { select: { name: true } } } } },
        orderBy: { checkInTime: "asc" },
      });

      rows.push(["Date", "Opportunity", "Organization", "Hours", "Status"]);
      for (const s of sessions) {
        rows.push([
          s.checkInTime?.toISOString().split("T")[0] || "",
          s.opportunity.title,
          s.opportunity.organization.name,
          String(s.totalHours || 0),
          s.verificationStatus,
        ]);
      }
      filename = "my-service-hours.csv";
    }

    const csv = rows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    console.error("CSV export error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/reports/audit/:sessionId — audit trail for a session
router.get("/audit/:sessionId", authenticate, async (req: Request, res: Response) => {
  try {
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
