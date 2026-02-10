import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";

const router = Router();

// GET /api/schools — list all schools
router.get("/", async (_req: Request, res: Response) => {
  try {
    const schools = await prisma.school.findMany({
      include: { _count: { select: { students: true } } },
      orderBy: { name: "asc" },
    });
    res.json(schools);
  } catch (err) {
    console.error("List schools error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/schools/:id
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const school = await prisma.school.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { students: true, approvedOrgs: true, groups: true } } },
    });
    if (!school) return res.status(404).json({ error: "School not found" });
    res.json(school);
  } catch (err) {
    console.error("Get school error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/schools/:id — update school settings
router.put("/:id", authenticate, requireRole("SCHOOL"), async (req: Request, res: Response) => {
  try {
    const school = await prisma.school.findUnique({ where: { id: req.params.id } });
    if (!school || school.adminUserId !== req.user!.userId) {
      return res.status(403).json({ error: "Not your school" });
    }

    const updated = await prisma.school.update({
      where: { id: req.params.id },
      data: {
        name: req.body.name,
        address: req.body.address,
        phone: req.body.phone,
        description: req.body.description,
        requiredHours: req.body.requiredHours,
        verificationStandard: req.body.verificationStandard,
      },
    });
    res.json(updated);
  } catch (err) {
    console.error("Update school error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/schools/:id/students — list students
router.get("/:id/students", authenticate, requireRole("SCHOOL"), async (req: Request, res: Response) => {
  try {
    const school = await prisma.school.findUnique({ where: { id: req.params.id } });
    if (!school || school.adminUserId !== req.user!.userId) {
      return res.status(403).json({ error: "Not your school" });
    }

    const students = await prisma.user.findMany({
      where: { schoolId: req.params.id, role: "STUDENT" },
      select: {
        id: true, name: true, email: true, grade: true, age: true, avatarUrl: true,
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
router.get("/:id/stats", authenticate, requireRole("SCHOOL"), async (req: Request, res: Response) => {
  try {
    const school = await prisma.school.findUnique({ where: { id: req.params.id } });
    if (!school || school.adminUserId !== req.user!.userId) {
      return res.status(403).json({ error: "Not your school" });
    }

    const students = await prisma.user.findMany({
      where: { schoolId: req.params.id, role: "STUDENT" },
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

// POST /api/schools/:id/organizations/:orgId/approve — approve an org
router.post("/:id/organizations/:orgId/approve", authenticate, requireRole("SCHOOL"), async (req: Request, res: Response) => {
  try {
    const school = await prisma.school.findUnique({ where: { id: req.params.id } });
    if (!school || school.adminUserId !== req.user!.userId) {
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

    res.json(approval);
  } catch (err) {
    console.error("Approve org error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/schools/:id/organizations/:orgId/reject
router.post("/:id/organizations/:orgId/reject", authenticate, requireRole("SCHOOL"), async (req: Request, res: Response) => {
  try {
    const school = await prisma.school.findUnique({ where: { id: req.params.id } });
    if (!school || school.adminUserId !== req.user!.userId) {
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

// GET /api/schools/:id/organizations — list org approval statuses
router.get("/:id/organizations", authenticate, requireRole("SCHOOL"), async (req: Request, res: Response) => {
  try {
    const school = await prisma.school.findUnique({ where: { id: req.params.id } });
    if (!school || school.adminUserId !== req.user!.userId) {
      return res.status(403).json({ error: "Not your school" });
    }

    const approvals = await prisma.schoolOrganization.findMany({
      where: { schoolId: req.params.id },
      include: { organization: true },
      orderBy: { createdAt: "desc" },
    });

    // Also get orgs not yet reviewed
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
router.get("/:id/groups", authenticate, requireRole("SCHOOL"), async (req: Request, res: Response) => {
  try {
    const school = await prisma.school.findUnique({ where: { id: req.params.id } });
    if (!school || school.adminUserId !== req.user!.userId) {
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
router.post("/:id/groups", authenticate, requireRole("SCHOOL"), async (req: Request, res: Response) => {
  try {
    const school = await prisma.school.findUnique({ where: { id: req.params.id } });
    if (!school || school.adminUserId !== req.user!.userId) {
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
router.get("/:id/groups/:groupId/students", authenticate, requireRole("SCHOOL"), async (req: Request, res: Response) => {
  try {
    const members = await prisma.studentGroupMember.findMany({
      where: { groupId: req.params.groupId },
      include: {
        group: true,
      },
    });

    // Get full student info for each member
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
router.post("/:id/groups/:groupId/students", authenticate, requireRole("SCHOOL"), async (req: Request, res: Response) => {
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

export default router;
