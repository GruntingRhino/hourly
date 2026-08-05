import { Router, Request, Response } from "express";
import { create as contentDisposition } from "content-disposition";
import prisma from "../lib/prisma";
import { buildCsv } from "../lib/csv";
import { authenticate } from "../middleware/auth";
import {
  buildRequestAuditMetadata,
  logDataAccess,
  resolveStudentSchoolId,
  summarizeStudentSubjects,
} from "../lib/dataAccessLog";
import { calculateStudentHours } from "../lib/hoursCalculator";
import { buildStudentProgressRecords } from "../lib/studentProgress";
import { buildAnonymousVolunteerLabel } from "../lib/privacy";
import { safeSchoolSelect } from "../lib/schoolSelect";
import { resolveSchoolFromUserAssociations } from "../lib/userAssociations";
import {
  assertStudentAccessibleToStaff,
  buildCohortScopedStudentWhere,
  getAccessibleTeacherCohorts,
  getStaffAccessScope,
} from "../lib/cohortAccess";
import { createHybridRateLimit } from "../middleware/rateLimit";

const router = Router();

// 5 parent-link generations per student per hour — prevents token churn/abuse
const parentLinkLimiter = createHybridRateLimit({
  namespace: "parent-link",
  windowMs: 60 * 60 * 1000,
  maxPerIp: 20,
  maxPerUser: 5,
});

// 30 reads per IP per 15 minutes — public endpoint, tokens not guessable but still needs a floor
const parentProgressLimiter = createHybridRateLimit({
  namespace: "parent-progress",
  windowMs: 15 * 60 * 1000,
  maxPerIp: 30,
});

const SCHOOL_ROLES = ["SCHOOL_ADMIN", "TEACHER"];

function buildSchoolReportAuditDetails(params: {
  req: Request;
  schoolName: string;
  actorRole: string;
  scope: Awaited<ReturnType<typeof getStaffAccessScope>>;
  selectedCohortNames: string[];
  students: Array<{ id: string }>;
}) {
  const isAssignedCohortScope = !!params.scope && !params.scope.isSchoolAdmin;
  return {
    accessKind: "report_view",
    reportType: "school_compliance",
    actorRole: params.actorRole,
    scopeType: isAssignedCohortScope ? "assigned_cohorts" : "school",
    scopeLabel: isAssignedCohortScope ? params.selectedCohortNames.join(", ") : params.schoolName,
    assignedCohorts: isAssignedCohortScope ? params.selectedCohortNames : [],
    ...summarizeStudentSubjects(params.students),
    ...buildRequestAuditMetadata(params.req),
  };
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

      const scope = await getStaffAccessScope(req.user!.userId);
      const studentAllowed = scope ? await assertStudentAccessibleToStaff(scope, userId) : false;
      if (!studentAllowed) {
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

    const reportOwner = await prisma.user.findUnique({
      where: { id: userId },
      select: { schoolId: true },
    });
    if (!reportOwner?.schoolId) {
      return res.status(404).json({ error: "Student school not found" });
    }
    const owningSchoolId = reportOwner.schoolId;

    const fallbackResponse = {
      totalApprovedHours: 0,
      totalPendingHours: 0,
      totalCommittedHours: 0,
      requiredHours: 40,
      activitiesCompleted: 0,
      sessions: [],
      approved: [],
      pending: [],
      committed: [],
      rejected: [],
      interventionCase: null,
      warning: "Student report is temporarily unavailable.",
    };

    try {
      const sessions = await prisma.serviceSession.findMany({
        where: { userId, schoolId: owningSchoolId },
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
    const hoursMap = await calculateStudentHours([userId], owningSchoolId);
    const studentHours = hoursMap.get(userId) ?? { approved: 0, pending: 0 };

    // totalCommittedHours remains ServiceSession-only (no equivalent concept in other models)
    const totalCommittedHours = committed.reduce((sum, s) => sum + (s.totalHours || 0), 0);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        classroom: { include: { school: true } },
        cohort: { include: { school: true } },
        cohortMemberships: {
          where: { isActive: true },
          include: { cohort: { include: { school: true } } },
          orderBy: { updatedAt: "desc" },
        },
        school: true,
      },
    });

    const school = resolveSchoolFromUserAssociations(user);
    const interventionCase = school
      ? await prisma.interventionCase.findUnique({
          where: { schoolId_studentId: { schoolId: school.id, studentId: userId } },
          include: { owner: { select: { id: true, name: true, role: true, email: true } } },
        }).catch(() => null)
      : null;

    const lastStudentActionAt = sessions.length
      ? sessions
          .flatMap((session) => [session.updatedAt, session.submittedAt, session.verifiedAt, session.checkInTime, session.checkOutTime])
          .filter((value): value is Date => value instanceof Date)
          .sort((a, b) => b.getTime() - a.getTime())[0] ?? null
      : null;

    res.json({
      totalApprovedHours: Math.round(studentHours.approved * 100) / 100,
      totalPendingHours: Math.round(studentHours.pending * 100) / 100,
      totalCommittedHours: Math.round(totalCommittedHours * 100) / 100,
      requiredHours: user?.cohort?.requiredHours ?? school?.requiredHours ?? 40,
      activitiesCompleted: approved.length,
      // COMPLETE unless one or more underlying hour sources failed to load — in that
      // case the totals above may be understated and should not be treated as final.
      dataState: hoursMap.dataState,
      ...(hoursMap.dataState === "PARTIAL" ? { failedSources: hoursMap.failedSources } : {}),
      sessions,
      approved,
      pending,
      committed,
      rejected,
      interventionCase: interventionCase ? {
        id: interventionCase.id,
        status: interventionCase.status,
        priority: interventionCase.priority,
        reason: interventionCase.reason,
        summary: interventionCase.summary,
        nextStepForStudent: interventionCase.nextStepForStudent,
        nextStepForStaff: interventionCase.nextStepForStaff,
        staffNote: req.user!.role === "STUDENT" && userId === req.user!.userId ? null : interventionCase.staffNote,
        studentMessage: interventionCase.studentMessage,
        dueDate: interventionCase.dueDate,
        lastContactedAt: interventionCase.lastContactedAt,
        lastStudentActionAt,
        resolvedAt: interventionCase.resolvedAt,
        owner: interventionCase.owner,
      } : null,
    });
    } catch (err) {
      console.error("Student report enrichment failed:", err);
      res.json(fallbackResponse);
    }
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
        user: { select: { id: true } },
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
      sessions: sessions.map((session) => ({
        ...session,
        user: {
          label: buildAnonymousVolunteerLabel(session.user.id),
        },
      })),
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
    const scope = await getStaffAccessScope(req.user!.userId);

    const school = await prisma.school.findUnique({
      where: { id: user.schoolId },
      select: safeSchoolSelect,
    });
    if (!school) return res.status(400).json({ error: "School not found" });
    try {
      const selectedCohorts = scope ? await getAccessibleTeacherCohorts(scope) : [];

    // Include both legacy classroom students and new cohort students
    const students = await prisma.user.findMany({
      where: {
        role: "STUDENT",
        ...(scope ? buildCohortScopedStudentWhere(scope) : {
          OR: [
            { classroom: { schoolId: school.id } },
            { cohort: { schoolId: school.id } },
          ],
        }),
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
        cohortMemberships: {
          where: { isActive: true },
          orderBy: [{ updatedAt: "desc" }],
          select: {
            cohortId: true,
            isActive: true,
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
        },
      },
    });

    const progress = await buildStudentProgressRecords(students, {
      schoolId: school.id,
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
      details: buildSchoolReportAuditDetails({
        req,
        schoolName: school.name,
        actorRole: req.user!.role,
        scope,
        selectedCohortNames: selectedCohorts.map((cohort) => cohort.name),
        students: students.map((student) => ({ id: student.id })),
      }),
    });

    res.json({
      schoolName: school.name,
      requiredHours: school.requiredHours,
      totalStudents: report.length,
      studentsCompleted: report.filter((r) => r.completed).length,
      students: report,
      // COMPLETE unless one or more underlying hour/no-show sources failed to
      // load for this batch — in that case some students' totals above may be
      // understated and should not be treated as final.
      dataState: progress.dataState,
      ...(progress.dataState === "PARTIAL" ? { failedSources: progress.failedSources } : {}),
    });
    } catch (err) {
      console.error("School report enrichment failed:", err);
      res.json({
        schoolName: school.name,
        requiredHours: school.requiredHours,
        totalStudents: 0,
        studentsCompleted: 0,
        students: [],
        warning: "School report is temporarily unavailable.",
      });
    }
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

      // Promise.allSettled (not Promise.all): this export is a student's
      // official hours record — if one of the three independent sources
      // has a transient failure, the other two should still be exported
      // rather than the whole request 500ing, but the export must say so
      // rather than silently presenting an incomplete record as complete.
      const [sessionsResult, benSignupsResult, selfSubsResult] = await Promise.allSettled([
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

      const failedSources: string[] = [];
      if (sessionsResult.status === "rejected") {
        failedSources.push("organization-verified hours");
        console.error("CSV export: serviceSession lookup failed", sessionsResult.reason);
      }
      if (benSignupsResult.status === "rejected") {
        failedSources.push("beneficiary-verified hours");
        console.error("CSV export: beneficiarySignup lookup failed", benSignupsResult.reason);
      }
      if (selfSubsResult.status === "rejected") {
        failedSources.push("self-submitted hours");
        console.error("CSV export: selfSubmittedRequest lookup failed", selfSubsResult.reason);
      }
      const sessions = sessionsResult.status === "fulfilled" ? sessionsResult.value : [];
      const benSignups = benSignupsResult.status === "fulfilled" ? benSignupsResult.value : [];
      const selfSubs = selfSubsResult.status === "fulfilled" ? selfSubsResult.value : [];

      await logDataAccess({
        actorId: userId,
        action: "EXPORT_CSV",
        targetType: "student",
        targetId: userId,
        details: {
          type: "student",
          sessionCount: sessions.length + benSignups.length + selfSubs.length,
          ...(failedSources.length ? { partial: true, failedSources } : {}),
        },
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

      // All three sources failing would otherwise produce an empty CSV
      // indistinguishable from a genuinely zero-hours student — refuse to
      // export a record that isn't known to be complete rather than
      // silently claiming zero hours.
      if (failedSources.length === 3) {
        return res.status(503).json({ error: "Unable to retrieve your hours right now. Please try again shortly." });
      }

      rows.push(["Date", "Opportunity", "Organization", "Hours", "Status"]);
      for (const r of allRows) {
        rows.push([r.date, r.activity, r.organization, String(r.hours), "APPROVED"]);
      }
      if (failedSources.length > 0) {
        rows.push([`WARNING: this export is incomplete — could not retrieve ${failedSources.join(", ")}. Please try again shortly.`, "", "", "", ""]);
      }
      filename = "my-service-hours.csv";
    }

    const csv = rows.length > 0
      ? buildCsv(rows)
      : '"Date","Opportunity","Organization","Hours","Status"';
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", contentDisposition(filename));
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
    return res.status(403).json({
      error: "Parent progress links are disabled until a school-managed FERPA-compliant sharing workflow is implemented.",
    });
  } catch (err) {
    console.error("Parent link error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/reports/parent-progress?token=... — read-only parent progress view
router.get("/parent-progress", parentProgressLimiter, async (req: Request, res: Response) => {
  try {
    return res.status(403).json({
      error: "Parent progress links are disabled until a school-managed FERPA-compliant sharing workflow is implemented.",
    });
  } catch (err) {
    console.error("Parent progress error:", err);
    res.status(500).json({ error: "Internal server error" });
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
        const studentSchoolId = await resolveStudentSchoolId(session.user.id);
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
