import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { sendHourRemovedEmail, sendOrgRequestApprovedEmail } from "../services/email";

const router = Router();

// GET /api/schools — public search (for orgs to find schools)
router.get("/", authenticate, async (req: Request, res: Response) => {
  try {
    const search = req.query.search as string | undefined;
    const schools = await prisma.school.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { domain: { contains: search, mode: "insensitive" } },
            ],
          }
        : undefined,
      select: { id: true, name: true, domain: true, verified: true },
      orderBy: { name: "asc" },
      take: 20,
    });
    res.json(schools);
  } catch (err) {
    console.error("List schools error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/schools/:id — school details (staff only)
router.get("/:id", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER", "DISTRICT_ADMIN"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (user?.schoolId !== req.params.id) {
      return res.status(403).json({ error: "Not your school" });
    }

    const school = await prisma.school.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { staff: true, classrooms: true, approvedOrgs: true, groups: true } },
      },
    });
    if (!school) return res.status(404).json({ error: "School not found" });
    res.json(school);
  } catch (err) {
    console.error("Get school error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/schools/:id — update school settings (SCHOOL_ADMIN only)
router.put("/:id", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (user?.schoolId !== req.params.id) {
      return res.status(403).json({ error: "Not your school" });
    }

    const updateData: any = {
      name: req.body.name,
      domain: req.body.domain,
      requiredHours: req.body.requiredHours,
      verificationStandard: req.body.verificationStandard,
    };
    if (req.body.zipCodes !== undefined) {
      updateData.zipCodes = Array.isArray(req.body.zipCodes)
        ? JSON.stringify(req.body.zipCodes)
        : req.body.zipCodes;
    }

    const updated = await prisma.school.update({
      where: { id: req.params.id },
      data: updateData,
    });
    res.json(updated);
  } catch (err) {
    console.error("Update school error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/schools/:id/students — list students (via classrooms)
router.get("/:id/students", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER", "DISTRICT_ADMIN"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (user?.schoolId !== req.params.id) {
      return res.status(403).json({ error: "Not your school" });
    }

    const students = await prisma.user.findMany({
      where: {
        role: "STUDENT",
        classroom: { schoolId: req.params.id },
      },
      select: {
        id: true, name: true, email: true, grade: true, age: true, avatarUrl: true,
        classroomId: true,
        classroom: { select: { id: true, name: true } },
        serviceSessions: {
          where: { verificationStatus: "APPROVED" },
          select: { totalHours: true },
        },
      },
      orderBy: { name: "asc" },
    });

    const result = students.map((s) => ({
      ...s,
      approvedHours: s.serviceSessions.reduce((sum, ss) => sum + (ss.totalHours || 0), 0),
      serviceSessions: undefined,
    }));

    res.json(result);
  } catch (err) {
    console.error("School students error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/schools/:id/stats — school-wide stats
router.get("/:id/stats", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER", "DISTRICT_ADMIN"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (user?.schoolId !== req.params.id) {
      return res.status(403).json({ error: "Not your school" });
    }

    const school = await prisma.school.findUnique({ where: { id: req.params.id } });
    if (!school) return res.status(404).json({ error: "School not found" });

    const students = await prisma.user.findMany({
      where: {
        role: "STUDENT",
        classroom: { schoolId: req.params.id },
      },
      include: {
        serviceSessions: {
          where: { verificationStatus: "APPROVED" },
          select: { totalHours: true },
        },
      },
    });

    const totalStudents = students.length;
    let totalHours = 0;
    let completedGoal = 0;
    let atRisk = 0;

    for (const student of students) {
      const hours = student.serviceSessions.reduce((sum, ss) => sum + (ss.totalHours || 0), 0);
      totalHours += hours;
      if (hours >= school.requiredHours) completedGoal++;
      else if (hours < school.requiredHours * 0.5) atRisk++;
    }

    res.json({
      totalStudents,
      totalSchoolHours: Math.round(totalHours * 100) / 100,
      studentsCompletedGoal: completedGoal,
      studentsAtRisk: atRisk,
      completionPercentage: totalStudents > 0 ? Math.round((completedGoal / totalStudents) * 100) : 0,
      requiredHours: school.requiredHours,
    });
  } catch (err) {
    console.error("School stats error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/schools/:id/organizations/:orgId/approve
router.post("/:id/organizations/:orgId/approve", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (user?.schoolId !== req.params.id) {
      return res.status(403).json({ error: "Not your school" });
    }

    const approval = await prisma.schoolOrganization.upsert({
      where: {
        schoolId_organizationId: {
          schoolId: req.params.id,
          organizationId: req.params.orgId,
        },
      },
      update: { status: "APPROVED", approvedAt: new Date() },
      create: {
        schoolId: req.params.id,
        organizationId: req.params.orgId,
        status: "APPROVED",
        approvedAt: new Date(),
      },
    });

    await prisma.organization.update({
      where: { id: req.params.orgId },
      data: { status: "APPROVED" },
    });

    // Email the org that they've been approved
    const school = await prisma.school.findUnique({ where: { id: req.params.id }, select: { name: true } });
    const orgAdmins = await prisma.user.findMany({
      where: { organizationId: req.params.orgId, role: "ORG_ADMIN" },
      select: { email: true },
    });
    for (const admin of orgAdmins) {
      sendOrgRequestApprovedEmail(admin.email, school?.name ?? "A school").catch(() => {});
    }

    res.json(approval);
  } catch (err) {
    console.error("Approve org error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/schools/:id/organizations/:orgId/reject
router.post("/:id/organizations/:orgId/reject", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (user?.schoolId !== req.params.id) {
      return res.status(403).json({ error: "Not your school" });
    }

    const approval = await prisma.schoolOrganization.upsert({
      where: {
        schoolId_organizationId: {
          schoolId: req.params.id,
          organizationId: req.params.orgId,
        },
      },
      update: { status: "REJECTED" },
      create: {
        schoolId: req.params.id,
        organizationId: req.params.orgId,
        status: "REJECTED",
      },
    });

    res.json(approval);
  } catch (err) {
    console.error("Reject org error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/schools/:id/organizations
router.get("/:id/organizations", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER", "DISTRICT_ADMIN"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (user?.schoolId !== req.params.id) {
      return res.status(403).json({ error: "Not your school" });
    }

    const approvals = await prisma.schoolOrganization.findMany({
      where: { schoolId: req.params.id },
      include: { organization: true },
      orderBy: { createdAt: "desc" },
    });

    const approvedOrgIds = approvals.map((a) => a.organizationId);
    const pendingOrgs = await prisma.organization.findMany({
      where: { id: { notIn: approvedOrgIds } },
    });

    res.json({ approvals, pendingOrgs });
  } catch (err) {
    console.error("School orgs error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Student Groups ─────────────────────────────────────────────

// GET /api/schools/:id/groups
router.get("/:id/groups", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER", "DISTRICT_ADMIN"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (user?.schoolId !== req.params.id) {
      return res.status(403).json({ error: "Not your school" });
    }

    const groups = await prisma.studentGroup.findMany({
      where: { schoolId: req.params.id },
      include: { _count: { select: { members: true } } },
      orderBy: { name: "asc" },
    });
    res.json(groups);
  } catch (err) {
    console.error("School groups error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/schools/:id/groups
router.post("/:id/groups", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (user?.schoolId !== req.params.id) {
      return res.status(403).json({ error: "Not your school" });
    }

    const group = await prisma.studentGroup.create({
      data: { name: req.body.name, schoolId: req.params.id },
    });
    res.status(201).json(group);
  } catch (err) {
    console.error("Create group error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/schools/:id/groups/:groupId/students
router.get("/:id/groups/:groupId/students", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER", "DISTRICT_ADMIN"), async (req: Request, res: Response) => {
  try {
    const members = await prisma.studentGroupMember.findMany({
      where: { groupId: req.params.groupId },
    });

    const studentIds = members.map((m) => m.studentId);
    const students = await prisma.user.findMany({
      where: { id: { in: studentIds } },
      select: {
        id: true, name: true, email: true, grade: true,
        serviceSessions: {
          where: { verificationStatus: "APPROVED" },
          select: { totalHours: true },
        },
      },
    });

    const school = await prisma.school.findUnique({ where: { id: req.params.id } });

    const result = students.map((s) => {
      const hours = s.serviceSessions.reduce((sum, ss) => sum + (ss.totalHours || 0), 0);
      return {
        id: s.id,
        name: s.name,
        email: s.email,
        grade: s.grade,
        approvedHours: hours,
        requiredHours: school?.requiredHours || 40,
        status: hours >= (school?.requiredHours || 40) ? "COMPLETED" : hours >= (school?.requiredHours || 40) * 0.5 ? "ON_TRACK" : "AT_RISK",
      };
    });

    res.json(result);
  } catch (err) {
    console.error("Group students error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/schools/:id/groups/:groupId/students
router.post("/:id/groups/:groupId/students", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const { studentId } = req.body;
    const member = await prisma.studentGroupMember.create({
      data: { groupId: req.params.groupId, studentId },
    });
    res.status(201).json(member);
  } catch (err) {
    console.error("Add group student error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/schools/:id/staff — create a teacher account (staff invite)
router.post("/:id/staff", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const admin = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (admin?.schoolId !== req.params.id) {
      return res.status(403).json({ error: "Not your school" });
    }

    const { name, email, classroomId } = z.object({
      name: z.string().min(1),
      email: z.string().email(),
      classroomId: z.string().optional(),
    }).parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: "Email already registered" });

    const tempPassword = Math.random().toString(36).slice(-8) + "A1!";
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const teacher = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: "TEACHER",
        schoolId: req.params.id,
        emailVerified: true,
      },
    });

    // If classroomId provided, update that classroom's teacherId
    if (classroomId) {
      await prisma.classroom.update({
        where: { id: classroomId },
        data: { teacherId: teacher.id },
      });
    }

    res.status(201).json({
      id: teacher.id,
      name: teacher.name,
      email: teacher.email,
      role: teacher.role,
      tempPassword, // Dev only: return temp password for testing
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.errors });
    }
    console.error("Create staff error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/schools/:id/remove-hours — school admin removes verified hours for a student
router.post("/:id/remove-hours", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (user?.schoolId !== req.params.id) {
      return res.status(403).json({ error: "Not your school" });
    }

    const { sessionId, reason } = z.object({
      sessionId: z.string(),
      reason: z.string().optional(),
    }).parse(req.body);

    const session = await prisma.serviceSession.findUnique({
      where: { id: sessionId },
      include: {
        opportunity: true,
        user: { select: { id: true, email: true, name: true, classroomId: true, notificationPreferences: true } },
      },
    });
    if (!session) return res.status(404).json({ error: "Session not found" });

    // Teacher can only remove hours for students in their classroom
    if (user.role === "TEACHER") {
      const student = await prisma.user.findUnique({ where: { id: session.userId } });
      const classroom = await prisma.classroom.findUnique({ where: { id: student?.classroomId || "" } });
      if (classroom?.teacherId !== user.id) {
        return res.status(403).json({ error: "Can only remove hours for students in your classroom" });
      }
    }

    await prisma.serviceSession.update({
      where: { id: sessionId },
      data: {
        verificationStatus: "REJECTED",
        status: "REJECTED",
        rejectionReason: reason || "Hours removed by school admin",
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "OVERRIDE",
        actorId: req.user!.userId,
        sessionId,
        details: JSON.stringify({ action: "REMOVE_HOURS", reason }),
      },
    });

    // Notify student
    await prisma.notification.create({
      data: {
        userId: session.userId,
        type: "VERIFICATION_UPDATE",
        title: "Hours Removed",
        body: `${session.totalHours} hours for "${session.opportunity.title}" have been removed by your school admin.${reason ? ` Reason: ${reason}` : ""}`,
      },
    });

    // Send email to student (check notification preferences)
    let sendRemovalEmail = true;
    if (session.user.notificationPreferences) {
      try {
        const prefs = JSON.parse(session.user.notificationPreferences as string);
        if (prefs.hourRemoval?.email === false) sendRemovalEmail = false;
      } catch {}
    }
    if (sendRemovalEmail) {
      sendHourRemovedEmail(session.user.email, session.totalHours ?? 0, session.opportunity.title).catch(() => {});
    }

    res.json({ message: "Hours removed successfully" });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed" });
    }
    console.error("Remove hours error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/schools/:id/organizations/:orgId/block — block an org
router.post("/:id/organizations/:orgId/block", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (user?.schoolId !== req.params.id) {
      return res.status(403).json({ error: "Not your school" });
    }

    await prisma.schoolOrganization.upsert({
      where: { schoolId_organizationId: { schoolId: req.params.id, organizationId: req.params.orgId } },
      update: { status: "BLOCKED" },
      create: { schoolId: req.params.id, organizationId: req.params.orgId, status: "BLOCKED" },
    });

    res.json({ message: "Organization blocked" });
  } catch (err) {
    console.error("Block org error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
