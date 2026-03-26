import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { sendHourRemovedEmail, sendOrgRequestApprovedEmail } from "../services/email";
import { logDataAccess } from "../lib/dataAccessLog";
import { geocodeAddress } from "../lib/geocode";

const router = Router();
const schoolJoinSettingsSchema = z.object({
  allowJoinByCode: z.boolean(),
});

// GET /api/schools — public search (for orgs to find schools)
router.get("/", authenticate, async (req: Request, res: Response) => {
  try {
    const search = (req.query.search as string | undefined)?.trim() || "";

    let schools: any[];
    if (!search) {
      schools = await prisma.school.findMany({
        select: { id: true, name: true, domain: true, verified: true, city: true, state: true },
        orderBy: { name: "asc" },
        take: 20,
      });
    } else {
      // Fetch a broad pool matching any word in the query, then rank in JS
      const words = search.toLowerCase().split(/\s+/).filter(Boolean);
      const wordConditions = words.map((w) => ({
        OR: [
          { name: { contains: w, mode: "insensitive" as any } },
          { domain: { contains: w, mode: "insensitive" as any } },
          { city: { contains: w, mode: "insensitive" as any } },
        ],
      }));
      schools = await prisma.school.findMany({
        where: { AND: wordConditions },
        select: { id: true, name: true, domain: true, verified: true, city: true, state: true },
        orderBy: { name: "asc" },
        take: 100,
      });

      const q = search.toLowerCase();
      schools = schools
        .map((s: any) => {
          const nameLower = s.name.toLowerCase();
          let rank = 3;
          if (nameLower.startsWith(q)) rank = 0;
          else if (nameLower.split(/\s+/).some((w: string) => w.startsWith(q))) rank = 1;
          else if ((s.city || "").toLowerCase().includes(q)) rank = 2;
          return { ...s, _rank: rank };
        })
        .sort((a: any, b: any) => a._rank - b._rank || a.name.localeCompare(b.name))
        .slice(0, 20)
        .map(({ _rank: _r, ...s }: any) => s);
    }

    res.json(schools);
  } catch (err) {
    console.error("List schools error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/schools/location — returns school lat/lng for map centering
router.get("/location", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER", "DISTRICT_ADMIN"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user?.schoolId) return res.status(404).json({ error: "No school found" });

    const school = await prisma.school.findUnique({
      where: { id: user.schoolId },
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        state: true,
        zip: true,
        latitude: true,
        longitude: true,
      },
    });

    if (!school) return res.status(404).json({ error: "School not found" });
    res.json(school);
  } catch (err) {
    console.error("School location error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/schools/settings — current school-level settings for the authenticated school staff
router.get("/settings", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER", "DISTRICT_ADMIN"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user?.schoolId) {
      return res.status(400).json({ error: "Not associated with a school" });
    }

    const school = await prisma.school.findUnique({
      where: { id: user.schoolId },
      select: { id: true, allowJoinByCode: true },
    });
    if (!school) {
      return res.status(404).json({ error: "School not found" });
    }

    res.json({
      schoolId: school.id,
      allowJoinByCode: school.allowJoinByCode,
    });
  } catch (err) {
    console.error("Get school settings error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/schools/onboarding — mark onboarding as complete
router.put("/onboarding", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user?.schoolId) return res.status(400).json({ error: "Not associated with a school" });

    await prisma.school.update({
      where: { id: user.schoolId },
      data: { onboardingComplete: true } as any,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Onboarding complete error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/schools/settings — update school-level settings
router.patch("/settings", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const data = schoolJoinSettingsSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user?.schoolId) {
      return res.status(400).json({ error: "Not associated with a school" });
    }

    const updated = await prisma.school.update({
      where: { id: user.schoolId },
      data: { allowJoinByCode: data.allowJoinByCode },
      select: { id: true, allowJoinByCode: true },
    });

    res.json({
      schoolId: updated.id,
      allowJoinByCode: updated.allowJoinByCode,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.errors });
    }
    console.error("Update school settings error:", err);
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

    // Update address fields and geocode if provided
    const hasAddress = req.body.address !== undefined || req.body.city !== undefined ||
      req.body.state !== undefined || req.body.zip !== undefined;
    if (hasAddress) {
      if (req.body.address !== undefined) updateData.address = req.body.address || null;
      if (req.body.city !== undefined) updateData.city = req.body.city || null;
      if (req.body.state !== undefined) updateData.state = req.body.state || null;
      if (req.body.zip !== undefined) updateData.zip = req.body.zip || null;

      const addressParts = [req.body.address, req.body.city, req.body.state, req.body.zip].filter(Boolean);
      if (addressParts.length >= 2) {
        const coords = await geocodeAddress(addressParts.join(", "));
        if (coords) {
          updateData.latitude = coords.lat;
          updateData.longitude = coords.lng;
        }
      }
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
        id: true, name: true, email: true, grade: true,
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
      approvedHours: s.serviceSessions.reduce((sum: number, ss: any) => sum + (ss.totalHours || 0), 0),
      serviceSessions: undefined,
    }));

    await logDataAccess({
      actorId: req.user!.userId,
      action: "VIEW_STUDENT_LIST",
      targetType: "school",
      targetId: req.params.id,
      schoolId: req.params.id,
      details: { studentCount: result.length },
    });

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

    const allOrgs = await prisma.organization.findMany({
      select: { id: true, name: true, description: true },
      orderBy: { name: "asc" },
    });

    const approvalStatusByOrg = new Map<string, string>();
    for (const approval of approvals) {
      approvalStatusByOrg.set(approval.organizationId, approval.status);
    }

    // Keep reviewable orgs visible to school admins for explicit approve/reject actions.
    const pendingOrgs = allOrgs
      .map((org) => ({
        id: org.id,
        name: org.name,
        description: org.description,
        status: approvalStatusByOrg.get(org.id) || "PENDING",
      }))
      .filter((org) => org.status !== "BLOCKED");

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
    const actor = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (actor?.schoolId !== req.params.id) {
      return res.status(403).json({ error: "Not your school" });
    }

    // Verify the group belongs to this school
    const group = await prisma.studentGroup.findUnique({ where: { id: req.params.groupId } });
    if (!group || group.schoolId !== req.params.id) {
      return res.status(403).json({ error: "Group not found in this school" });
    }

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
    const configuredRounds = Number(process.env.TEMP_PASSWORD_BCRYPT_ROUNDS ?? 8);
    const rounds = Number.isFinite(configuredRounds) ? Math.min(14, Math.max(4, Math.floor(configuredRounds))) : 8;
    const passwordHash = await bcrypt.hash(tempPassword, rounds);

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

    const responseBody: Record<string, unknown> = {
      id: teacher.id,
      name: teacher.name,
      email: teacher.email,
      role: teacher.role,
    };
    // Only expose temp password outside production (dev/staging only)
    if (process.env.NODE_ENV !== "production") {
      responseBody.tempPassword = tempPassword;
    }
    res.status(201).json(responseBody);
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
        user: { select: { id: true, email: true, name: true, classroomId: true } },
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

    sendHourRemovedEmail(session.user.email, session.totalHours ?? 0, session.opportunity.title).catch(() => {});

    res.json({ message: "Hours removed successfully" });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed" });
    }
    console.error("Remove hours error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/schools/:id/export — export all student data as CSV (SCHOOL_ADMIN only, FERPA data portability)
router.get("/:id/export", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
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
        OR: [
          { classroom: { schoolId: req.params.id } },
          { cohort: { schoolId: req.params.id } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        grade: true,
        createdAt: true,
        serviceSessions: {
          where: { verificationStatus: "APPROVED" },
          select: { totalHours: true },
        },
      },
      orderBy: { name: "asc" },
    });

    await logDataAccess({
      actorId: req.user!.userId,
      action: "EXPORT_SCHOOL_DATA",
      targetType: "school",
      targetId: req.params.id,
      schoolId: req.params.id,
      details: { studentCount: students.length },
    });

    const rows: string[][] = [["Student ID", "Name", "Email", "Grade", "Approved Hours", "Enrolled At"]];
    for (const s of students) {
      const hours = s.serviceSessions.reduce((sum, ss) => sum + (ss.totalHours || 0), 0);
      rows.push([
        s.id,
        s.name,
        s.email,
        s.grade || "",
        String(Math.round(hours * 100) / 100),
        s.createdAt.toISOString().split("T")[0],
      ]);
    }

    const csv = rows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${school.name.replace(/[^a-z0-9]/gi, "_")}-students.csv"`);
    res.send(csv);
  } catch (err) {
    console.error("School export error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/schools/:id/students/:studentId — remove a student's account and data (SCHOOL_ADMIN only, FERPA right-to-delete)
router.delete("/:id/students/:studentId", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const actor = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (actor?.schoolId !== req.params.id) {
      return res.status(403).json({ error: "Not your school" });
    }

    const student = await prisma.user.findUnique({
      where: { id: req.params.studentId },
      select: {
        id: true,
        role: true,
        classroom: { select: { schoolId: true } },
        cohort: { select: { schoolId: true } },
      },
    });
    if (!student) return res.status(404).json({ error: "Student not found" });
    if (student.role !== "STUDENT") return res.status(400).json({ error: "User is not a student" });

    const studentSchoolId = student.classroom?.schoolId ?? student.cohort?.schoolId ?? null;
    if (studentSchoolId !== req.params.id) {
      return res.status(403).json({ error: "Student is not enrolled in your school" });
    }

    await logDataAccess({
      actorId: req.user!.userId,
      action: "DELETE_STUDENT",
      targetType: "student",
      targetId: req.params.studentId,
      schoolId: req.params.id,
    });

    // Anonymize rather than hard-delete to preserve the integrity of audit logs and verified hours records
    await prisma.user.update({
      where: { id: req.params.studentId },
      data: {
        name: "[Deleted]",
        email: `deleted-${req.params.studentId}@deleted.invalid`,
        passwordHash: null,
        phone: null,
        grade: null,
        house: null,
        googleId: null,
        emailVerificationToken: null,
        passwordResetToken: null,
        status: "REVOKED",
        cohortId: null,
        classroomId: null,
      },
    });

    res.json({ message: "Student data removed" });
  } catch (err) {
    console.error("Delete student error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/schools/:id/data-access-logs — FERPA audit trail of who accessed student data (SCHOOL_ADMIN only)
router.get("/:id/data-access-logs", authenticate, requireRole("SCHOOL_ADMIN", "DISTRICT_ADMIN"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (user?.schoolId !== req.params.id) {
      return res.status(403).json({ error: "Not your school" });
    }

    const logs = await prisma.dataAccessLog.findMany({
      where: { schoolId: req.params.id },
      include: { actor: { select: { id: true, name: true, role: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    res.json(logs);
  } catch (err) {
    console.error("Data access logs error:", err);
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
