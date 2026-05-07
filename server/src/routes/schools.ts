import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import {
  sendHourRemovedEmail,
  sendOrgRequestApprovedEmail,
  sendOwnershipTransferConfirmationEmail,
  CLIENT_URL,
} from "../services/email";
import {
  buildRequestAuditMetadata,
  logDataAccess,
  summarizeStudentSubjects,
} from "../lib/dataAccessLog";
import { getCategoryCapStatusesForStudent, resolveEffectiveRules } from "../lib/schoolRules";
import { safeSchoolSelect } from "../lib/schoolSelect";
import { geocodeAddress } from "../lib/geocode";
import { buildStudentProgressRecords } from "../lib/studentProgress";
import { calculateStudentHours } from "../lib/hoursCalculator";
import {
  assertStudentAccessibleToStaff,
  buildCohortScopedStudentWhere,
  getAccessibleTeacherCohorts,
  getStaffAccessScope,
} from "../lib/cohortAccess";
import {
  buildLaunchWorkspace,
  normalizeFirstUserMonitoringConfig,
  normalizeOnboardingInstructionsConfig,
  normalizeRollbackPlanConfig,
  normalizeSupportProcessConfig,
} from "../lib/launchCenter";

const router = Router();
const REQUIRED_CATEGORY_CAP = "Community Service";

type CategoryCapWarning = {
  studentId: string;
  studentName: string;
  category: string;
  cap: number;
  approvedHours: number;
  message: string;
};

async function buildCategoryCapWarningsForSchool(schoolId: string): Promise<CategoryCapWarning[]> {
  const students = await prisma.user.findMany({
    where: {
      role: "STUDENT",
      OR: [
        { schoolId },
        { cohort: { schoolId } },
        { classroom: { schoolId } },
      ],
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const warnings = await Promise.all(
    students.map(async (student) => {
      const statuses = await getCategoryCapStatusesForStudent(student.id);
      return statuses
        .filter((status) => status.alreadyOverCap)
        .map((status) => ({
          studentId: student.id,
          studentName: student.name,
          category: status.category,
          cap: status.cap,
          approvedHours: status.approvedHours,
          message: `${student.name} has already completed ${status.approvedHours.toFixed(1)} ${status.category} hours, which is above the ${status.cap}h cap. Their hours are kept, but they cannot do more ${status.category}.`,
        }));
    }),
  );

  return warnings.flat();
}
const schoolJoinSettingsSchema = z.object({
  allowJoinByCode: z.boolean(),
  partnerInviteTemplate: z.string().max(4000).optional(),
});

const dateInputSchema = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]);

const launchPlanUpdateSchema = z.object({
  onboardingInstructions: z.object({
    overview: z.string().max(2000).optional(),
    nextMilestone: z.string().max(2000).optional(),
  }).optional(),
  supportProcess: z.object({
    ownerName: z.string().max(120).optional(),
    ownerEmail: z.union([z.string().email(), z.literal("")]).optional(),
    responseTimeHours: z.number().int().min(1).max(168).optional(),
    escalationAfterHours: z.number().int().min(1).max(168).optional(),
    intakeChannels: z.array(z.string().max(80)).max(8).optional(),
    notes: z.string().max(4000).optional(),
  }).optional(),
  rollbackPlan: z.object({
    ownerName: z.string().max(120).optional(),
    trigger: z.string().max(500).optional(),
    freezeAction: z.string().max(500).optional(),
    rollbackSteps: z.string().max(4000).optional(),
    restoreCheck: z.string().max(1500).optional(),
    lastDrillAt: dateInputSchema.optional(),
  }).optional(),
  firstUserMonitoring: z.object({
    launchStartDate: dateInputSchema.optional(),
    checkCadence: z.enum(["DAILY", "TWICE_DAILY", "WEEKDAYS"]).optional(),
    activeStudentTarget: z.number().int().min(1).max(10000).optional(),
    watchList: z.array(z.string().max(120)).max(20).optional(),
    notes: z.string().max(2500).optional(),
  }).optional(),
});

const launchBugCreateSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().max(2000).optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  area: z.string().max(120).optional(),
  source: z.string().max(120).optional(),
  ownerName: z.string().max(120).optional(),
  workaround: z.string().max(1200).optional(),
  nextAction: z.string().max(1200).optional(),
});

const launchBugUpdateSchema = z.object({
  title: z.string().trim().min(3).max(160).optional(),
  description: z.string().max(2000).optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  status: z.enum(["OPEN", "INVESTIGATING", "BLOCKED", "FIXED", "MONITORING", "CLOSED"]).optional(),
  area: z.string().max(120).optional(),
  source: z.string().max(120).optional(),
  ownerName: z.string().max(120).optional(),
  workaround: z.string().max(1200).optional(),
  nextAction: z.string().max(1200).optional(),
});

function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}

function isMissingSchemaObjectError(err: unknown, objectName: string): boolean {
  return err instanceof Error && err.message.includes(objectName) && (
    err.message.includes("does not exist")
    || err.message.includes("Unknown field")
    || err.message.includes("Unknown arg")
  );
}

function buildStaffStudentAuditDetails(params: {
  req: Request;
  actorRole: string;
  accessKind: "student_list_view" | "school_data_export";
  reportType: "student_directory" | "school_export_csv";
  scopeLabel: string;
  scopeType: "school" | "cohort_selection" | "assigned_cohorts";
  assignedCohorts?: string[];
  filters?: Record<string, unknown>;
  students: Array<{ name: string; email: string }>;
}) {
  return {
    accessKind: params.accessKind,
    reportType: params.reportType,
    actorRole: params.actorRole,
    scopeType: params.scopeType,
    scopeLabel: params.scopeLabel,
    assignedCohorts: params.assignedCohorts ?? [],
    filters: params.filters ?? {},
    ...summarizeStudentSubjects(params.students),
    ...buildRequestAuditMetadata(params.req),
  };
}

async function runOwnershipTransfer(params: {
  schoolId: string;
  currentAdminId: string;
  targetUserId: string;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: params.currentAdminId },
      data: { role: "TEACHER" },
    });
    await tx.user.update({
      where: { id: params.targetUserId },
      data: { role: "SCHOOL_ADMIN" },
    });
    await tx.school.update({
      where: { id: params.schoolId },
      data: {
        createdById: params.targetUserId,
        ownershipTransferToken: null,
        ownershipTransferExpires: null,
        ownershipTransferTargetUserId: null,
      },
    });
  });
}

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
router.get("/location", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
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
router.get("/settings", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user?.schoolId) {
      return res.status(400).json({ error: "Not associated with a school" });
    }

    const school = await prisma.school.findUnique({
      where: { id: user.schoolId },
      select: { id: true, allowJoinByCode: true, partnerInviteTemplate: true },
    });
    if (!school) {
      return res.status(404).json({ error: "School not found" });
    }

    res.json({
      schoolId: school.id,
      allowJoinByCode: school.allowJoinByCode,
      partnerInviteTemplate: school.partnerInviteTemplate ?? "",
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
      data: {
        allowJoinByCode: data.allowJoinByCode,
        ...(data.partnerInviteTemplate !== undefined ? { partnerInviteTemplate: data.partnerInviteTemplate.trim() || null } : {}),
      },
      select: { id: true, allowJoinByCode: true, partnerInviteTemplate: true },
    });

    res.json({
      schoolId: updated.id,
      allowJoinByCode: updated.allowJoinByCode,
      partnerInviteTemplate: updated.partnerInviteTemplate ?? "",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.errors });
    }
    console.error("Update school settings error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/schools/:id/staff — list school staff and their accessible cohorts
router.get("/:id/staff", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const scope = await getStaffAccessScope(req.user!.userId);
    if (scope?.schoolId !== req.params.id || !scope.isSchoolAdmin) {
      return res.status(403).json({ error: "Not your school" });
    }

    let staff: Array<any>;
    try {
      staff = await prisma.user.findMany({
        where: {
          schoolId: req.params.id,
          role: { in: ["SCHOOL_ADMIN", "TEACHER"] },
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          assignedCohorts: {
            select: {
              cohort: { select: { id: true, name: true } },
            },
            orderBy: { cohort: { name: "asc" } },
          },
        },
        orderBy: [{ role: "asc" }, { name: "asc" }],
      });
    } catch (err) {
      if (
        !isMissingSchemaObjectError(err, "CohortTeacherAssignment")
        && !isMissingSchemaObjectError(err, "assignedCohorts")
      ) {
        throw err;
      }
      staff = await prisma.user.findMany({
        where: {
          schoolId: req.params.id,
          role: { in: ["SCHOOL_ADMIN", "TEACHER"] },
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
        orderBy: [{ role: "asc" }, { name: "asc" }],
      }).then((rows) => rows.map((row) => ({ ...row, assignedCohorts: [] })));
    }

    res.json(staff.map((member) => ({
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      assignedCohorts: member.assignedCohorts.map((assignment: any) => assignment.cohort),
    })));
  } catch (err) {
    console.error("List school staff error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/schools/:id/ownership-transfer — request school ownership transfer
router.post("/:id/ownership-transfer", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const admin = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, name: true, email: true, schoolId: true, role: true },
    });
    if (admin?.schoolId !== req.params.id) {
      return res.status(403).json({ error: "Not your school" });
    }

    const { targetEmail } = z.object({
      targetEmail: z.string().email(),
    }).parse(req.body);

    const normalizedTargetEmail = targetEmail.trim().toLowerCase();
    if (normalizedTargetEmail === admin.email.trim().toLowerCase()) {
      return res.status(400).json({ error: "You already own this school." });
    }

    const targetUser = await prisma.user.findFirst({
      where: {
        email: normalizedTargetEmail,
        schoolId: req.params.id,
        role: { in: ["TEACHER", "SCHOOL_ADMIN"] },
      },
      select: { id: true, name: true, email: true, role: true },
    });
    if (!targetUser) {
      return res.status(404).json({ error: "Target account must already be registered as school staff for this school." });
    }
    if (targetUser.role === "SCHOOL_ADMIN") {
      return res.status(400).json({ error: "That account already owns this school." });
    }

    const school = await prisma.school.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true },
    });
    if (!school) return res.status(404).json({ error: "School not found" });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.school.update({
      where: { id: school.id },
      data: {
        ownershipTransferToken: token,
        ownershipTransferExpires: expiresAt,
        ownershipTransferTargetUserId: targetUser.id,
      },
    });

    const confirmationLink = `${CLIENT_URL}/school/confirm-transfer?token=${token}`;
    await sendOwnershipTransferConfirmationEmail(
      admin.email,
      school.name,
      targetUser.name,
      targetUser.email,
      confirmationLink
    );

    res.json({
      message: "Transfer confirmation email sent.",
      targetUser: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.errors });
    }
    console.error("Ownership transfer request error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/schools/confirm-transfer — confirm school ownership transfer by token
router.post("/confirm-transfer", async (req: Request, res: Response) => {
  try {
    const { token } = z.object({ token: z.string().min(1) }).parse(req.body);

    const school = await prisma.school.findFirst({
      where: {
        ownershipTransferToken: token,
        ownershipTransferExpires: { gt: new Date() },
      },
      select: {
        id: true,
        createdById: true,
        ownershipTransferTargetUserId: true,
      },
    });
    if (!school?.createdById || !school.ownershipTransferTargetUserId) {
      return res.status(400).json({ error: "Invalid or expired transfer token" });
    }

    await runOwnershipTransfer({
      schoolId: school.id,
      currentAdminId: school.createdById,
      targetUserId: school.ownershipTransferTargetUserId,
    });

    res.json({ message: "Ownership transferred successfully." });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.errors });
    }
    console.error("Ownership transfer confirm error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/schools/my-rules — effective service rules for the authenticated user
router.get("/my-rules", authenticate, async (req: Request, res: Response) => {
  try {
    const rules = await resolveEffectiveRules(req.user!.userId);
    if (!rules) {
      return res.status(404).json({ error: "No school rules found" });
    }
    const categoryCapStatuses =
      req.user?.role === "STUDENT"
        ? await getCategoryCapStatusesForStudent(req.user.userId)
        : [];
    res.json({
      ...rules,
      categoryCapStatuses,
      blockedCategories: categoryCapStatuses
        .filter((status) => status.maxedOut || status.alreadyOverCap)
        .map((status) => status.category),
    });
  } catch (err) {
    console.error("Get my rules error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/schools/launch — launch center workspace for the authenticated school staff
router.get("/launch", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { schoolId: true },
    });
    if (!user?.schoolId) {
      return res.status(400).json({ error: "Not associated with a school" });
    }

    const workspace = await buildLaunchWorkspace(user.schoolId);
    if (!workspace) {
      return res.status(404).json({ error: "School not found" });
    }

    res.json(workspace);
  } catch (err) {
    console.error("Get launch center error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/schools/launch — update persisted launch center configs
router.put("/launch", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const data = launchPlanUpdateSchema.parse(req.body);
    if (
      data.onboardingInstructions === undefined &&
      data.supportProcess === undefined &&
      data.rollbackPlan === undefined &&
      data.firstUserMonitoring === undefined
    ) {
      return res.status(400).json({ error: "At least one launch section is required" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { schoolId: true },
    });
    if (!user?.schoolId) {
      return res.status(400).json({ error: "Not associated with a school" });
    }

    const school = await prisma.school.findUnique({
      where: { id: user.schoolId },
      select: {
        id: true,
        name: true,
        createdAt: true,
        launchOnboardingConfig: true,
        launchSupportConfig: true,
        launchRollbackConfig: true,
        launchMonitoringConfig: true,
        staff: {
          where: { role: { in: ["SCHOOL_ADMIN", "TEACHER"] } },
          orderBy: { createdAt: "asc" },
          select: {
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
    if (!school) {
      return res.status(404).json({ error: "School not found" });
    }

    const updateData: Record<string, string> = {};
    if (data.onboardingInstructions !== undefined) {
      updateData.launchOnboardingConfig = JSON.stringify(
        normalizeOnboardingInstructionsConfig(data.onboardingInstructions, school)
      );
    }
    if (data.supportProcess !== undefined) {
      updateData.launchSupportConfig = JSON.stringify(
        normalizeSupportProcessConfig(data.supportProcess, school)
      );
    }
    if (data.rollbackPlan !== undefined) {
      updateData.launchRollbackConfig = JSON.stringify(
        normalizeRollbackPlanConfig(data.rollbackPlan, school)
      );
    }
    if (data.firstUserMonitoring !== undefined) {
      updateData.launchMonitoringConfig = JSON.stringify(
        normalizeFirstUserMonitoringConfig(data.firstUserMonitoring, school)
      );
    }

    await prisma.school.update({
      where: { id: user.schoolId },
      data: updateData,
    });

    const workspace = await buildLaunchWorkspace(user.schoolId);
    res.json(workspace);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.errors });
    }
    console.error("Update launch center error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/schools/launch/bugs — create a launch bug
router.post("/launch/bugs", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const data = launchBugCreateSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { schoolId: true },
    });
    if (!user?.schoolId) {
      return res.status(400).json({ error: "Not associated with a school" });
    }

    const bug = await prisma.schoolLaunchBug.create({
      data: {
        schoolId: user.schoolId,
        title: data.title.trim(),
        description: data.description?.trim() || null,
        severity: data.severity,
        status: "OPEN",
        area: data.area?.trim() || null,
        source: data.source?.trim() || null,
        ownerName: data.ownerName?.trim() || null,
        workaround: data.workaround?.trim() || null,
        nextAction: data.nextAction?.trim() || null,
        createdById: req.user!.userId,
      },
    });

    res.status(201).json({
      id: bug.id,
      title: bug.title,
      description: bug.description ?? "",
      severity: bug.severity,
      status: bug.status,
      area: bug.area ?? "",
      source: bug.source ?? "",
      ownerName: bug.ownerName ?? "",
      workaround: bug.workaround ?? "",
      nextAction: bug.nextAction ?? "",
      createdById: bug.createdById,
      createdAt: bug.createdAt.toISOString(),
      updatedAt: bug.updatedAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.errors });
    }
    console.error("Create launch bug error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/schools/launch/bugs/:bugId — update a launch bug
router.put("/launch/bugs/:bugId", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const data = launchBugUpdateSchema.parse(req.body);
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "No launch bug fields provided" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { schoolId: true },
    });
    if (!user?.schoolId) {
      return res.status(400).json({ error: "Not associated with a school" });
    }

    const bug = await prisma.schoolLaunchBug.findUnique({
      where: { id: req.params.bugId },
      select: { id: true, schoolId: true },
    });
    if (!bug) {
      return res.status(404).json({ error: "Launch bug not found" });
    }
    if (bug.schoolId !== user.schoolId) {
      return res.status(403).json({ error: "Not your school's launch bug" });
    }

    const updated = await prisma.schoolLaunchBug.update({
      where: { id: req.params.bugId },
      data: {
        ...(data.title !== undefined && { title: data.title.trim() }),
        ...(data.description !== undefined && { description: data.description.trim() || null }),
        ...(data.severity !== undefined && { severity: data.severity }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.area !== undefined && { area: data.area.trim() || null }),
        ...(data.source !== undefined && { source: data.source.trim() || null }),
        ...(data.ownerName !== undefined && { ownerName: data.ownerName.trim() || null }),
        ...(data.workaround !== undefined && { workaround: data.workaround.trim() || null }),
        ...(data.nextAction !== undefined && { nextAction: data.nextAction.trim() || null }),
      },
    });

    res.json({
      id: updated.id,
      title: updated.title,
      description: updated.description ?? "",
      severity: updated.severity,
      status: updated.status,
      area: updated.area ?? "",
      source: updated.source ?? "",
      ownerName: updated.ownerName ?? "",
      workaround: updated.workaround ?? "",
      nextAction: updated.nextAction ?? "",
      createdById: updated.createdById,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.errors });
    }
    console.error("Update launch bug error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/schools/:id — school details (staff only)
router.get("/:id", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (user?.schoolId !== req.params.id) {
      return res.status(403).json({ error: "Not your school" });
    }

    const school = await prisma.school.findUnique({
      where: { id: req.params.id },
      select: {
        ...safeSchoolSelect,
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

    // Validate all school update fields
    const updateSchema = z.object({
      name: z.string().min(1).max(255).optional(),
      domain: z.string().max(255).nullable().optional(),
      requiredHours: z.number().min(1).max(2000).optional(),
      verificationStandard: z.enum(["STANDARD", "BENEFICIARY_REQUIRED"]).optional(),
      serviceStartDate: z.string().datetime({ offset: true }).nullable().optional(),
      serviceEndDate: z.string().datetime({ offset: true }).nullable().optional(),
      allowSelfSubmission: z.boolean().optional(),
      requireOrgVerification: z.boolean().optional(),
      categoryHourCaps: z.record(z.string(), z.number().positive()).nullable().optional(),
      address: z.string().max(255).nullable().optional(),
      city: z.string().max(100).nullable().optional(),
      state: z.string().max(100).nullable().optional(),
      zip: z.string().max(20).nullable().optional(),
      partnerInviteTemplate: z.string().max(4000).nullable().optional(),
      zipCodes: z.array(z.string().regex(/^\d{5}$/)).nullable().optional(),
    });

    let body: z.infer<typeof updateSchema>;
    try {
      body = updateSchema.parse(req.body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: err.errors });
      }
      throw err;
    }

    const rulesData = body;

    // Validate date ordering when both are set
    if (rulesData.serviceStartDate && rulesData.serviceEndDate) {
      if (new Date(rulesData.serviceEndDate) <= new Date(rulesData.serviceStartDate)) {
        return res.status(400).json({ error: "serviceEndDate must be after serviceStartDate" });
      }
    }

    const currentSchool = await prisma.school.findUnique({
      where: { id: req.params.id },
      select: { requiredHours: true },
    });
    if (!currentSchool) {
      return res.status(404).json({ error: "School not found" });
    }

    const effectiveRequiredHours = body.requiredHours ?? currentSchool.requiredHours;
    if (rulesData.categoryHourCaps) {
      const normalizedCategoryHourCaps = Object.fromEntries(
        Object.entries(rulesData.categoryHourCaps).filter(([category]) => category.trim() !== REQUIRED_CATEGORY_CAP)
      );
      rulesData.categoryHourCaps = normalizedCategoryHourCaps;
      const totalCapHours = Object.values(normalizedCategoryHourCaps).reduce((sum, hours) => sum + hours, 0);
      if (totalCapHours > effectiveRequiredHours) {
        return res.status(400).json({
          error: `Category caps cannot exceed the total required hours of ${effectiveRequiredHours}h.`,
        });
      }
    }

    const updateData: any = {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.domain !== undefined && { domain: body.domain }),
      ...(body.requiredHours !== undefined && { requiredHours: body.requiredHours }),
      ...(body.verificationStandard !== undefined && { verificationStandard: body.verificationStandard }),
    };
    if (req.body.zipCodes !== undefined) {
      updateData.zipCodes = Array.isArray(req.body.zipCodes)
        ? JSON.stringify(req.body.zipCodes)
        : req.body.zipCodes;
    }

    // Apply service rules fields
    if (rulesData.serviceStartDate !== undefined) updateData.serviceStartDate = rulesData.serviceStartDate ? new Date(rulesData.serviceStartDate) : null;
    if (rulesData.serviceEndDate !== undefined) updateData.serviceEndDate = rulesData.serviceEndDate ? new Date(rulesData.serviceEndDate) : null;
    if (rulesData.allowSelfSubmission !== undefined) updateData.allowSelfSubmission = rulesData.allowSelfSubmission;
    if (rulesData.verificationStandard !== undefined) updateData.verificationStandard = rulesData.verificationStandard;
    if (rulesData.requireOrgVerification !== undefined) updateData.requireOrgVerification = rulesData.requireOrgVerification;
    if (rulesData.verificationStandard === "BENEFICIARY_REQUIRED") {
      updateData.requireOrgVerification = true;
    }
    if (rulesData.categoryHourCaps !== undefined) {
      updateData.categoryHourCaps = rulesData.categoryHourCaps != null ? JSON.stringify(rulesData.categoryHourCaps) : null;
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
      select: safeSchoolSelect,
    });
    const categoryCapWarnings =
      updateData.categoryHourCaps !== undefined
        ? await buildCategoryCapWarningsForSchool(req.params.id)
        : [];

    await logDataAccess({
      actorId: req.user!.userId,
      action: "SCHOOL_SETTINGS_UPDATED",
      targetType: "School",
      targetId: req.params.id,
      schoolId: req.params.id,
      details: { updatedFields: Object.keys(updateData) },
    });

    res.json({
      ...updated,
      categoryCapWarnings,
    });
  } catch (err) {
    console.error("Update school error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/schools/:id/students — list students (via classrooms)
router.get("/:id/students", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const scope = await getStaffAccessScope(req.user!.userId);
    if (scope?.schoolId !== req.params.id) {
      return res.status(403).json({ error: "Not your school" });
    }

    const students = await prisma.user.findMany({
      where: {
        role: "STUDENT",
        ...(scope ? buildCohortScopedStudentWhere(scope) : {
          OR: [
            { classroom: { schoolId: req.params.id } },
            { cohort: { schoolId: req.params.id } },
          ],
        }),
      },
      select: {
        id: true, name: true, email: true, grade: true,
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
        classroomId: true,
        classroom: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    });

    const school = await prisma.school.findUnique({
      where: { id: req.params.id },
      select: { name: true, requiredHours: true, serviceStartDate: true, serviceEndDate: true },
    });
    if (!school) return res.status(404).json({ error: "School not found" });
    const accessibleCohorts = scope ? await getAccessibleTeacherCohorts(scope) : [];

    const progress = await buildStudentProgressRecords(students, {
      requiredHours: school.requiredHours,
      serviceStartDate: school.serviceStartDate,
      serviceEndDate: school.serviceEndDate,
    });
    const progressMap = new Map(progress.map((student) => [student.id, student]));

    const result = students.map((student) => ({
      ...student,
      approvedHours: progressMap.get(student.id)?.approvedHours ?? 0,
      pendingHours: progressMap.get(student.id)?.pendingHours ?? 0,
      requiredHours: progressMap.get(student.id)?.requiredHours ?? school.requiredHours,
      status: progressMap.get(student.id)?.status ?? "ON_TRACK",
      riskReasons: progressMap.get(student.id)?.riskReasons ?? [],
      noShowCount: progressMap.get(student.id)?.noShowCount ?? 0,
      daysToDeadline: progressMap.get(student.id)?.daysToDeadline ?? null,
    }));

    await logDataAccess({
      actorId: req.user!.userId,
      action: "VIEW_STUDENT_LIST",
      targetType: "school",
      targetId: req.params.id,
      schoolId: req.params.id,
      details: buildStaffStudentAuditDetails({
        req,
        actorRole: req.user!.role,
        accessKind: "student_list_view",
        reportType: "student_directory",
        scopeType: scope?.isSchoolAdmin ? "school" : "assigned_cohorts",
        scopeLabel: scope?.isSchoolAdmin
          ? school.name
          : accessibleCohorts.map((cohort) => cohort.name).join(", "),
        assignedCohorts: scope?.isSchoolAdmin ? [] : accessibleCohorts.map((cohort) => cohort.name),
        students: students.map((student) => ({ name: student.name, email: student.email })),
      }),
    });

    res.json(result);
  } catch (err) {
    console.error("School students error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/schools/:id/students/:studentId/verification-history — beneficiary verification audit trail for one student
router.get("/:id/students/:studentId/verification-history", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const scope = await getStaffAccessScope(req.user!.userId);
    if (scope?.schoolId !== req.params.id) {
      return res.status(403).json({ error: "Not your school" });
    }

    const student = await prisma.user.findUnique({
      where: { id: req.params.studentId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        classroom: { select: { schoolId: true } },
        cohort: { select: { schoolId: true, name: true } },
      },
    });
    if (!student) return res.status(404).json({ error: "Student not found" });
    if (student.role !== "STUDENT") return res.status(400).json({ error: "User is not a student" });

    const studentAllowed = scope ? await assertStudentAccessibleToStaff(scope, student.id) : false;
    if (!studentAllowed) return res.status(403).json({ error: "Student is not enrolled in a cohort you control" });

    const signups = await prisma.beneficiarySignup.findMany({
      where: { studentId: student.id },
      include: {
        slot: {
          include: {
            opportunity: {
              include: {
                beneficiary: { select: { id: true, name: true, category: true } },
              },
            },
          },
        },
        auditLogs: { orderBy: { createdAt: "asc" } },
      },
      orderBy: [{ slot: { date: "desc" } }, { createdAt: "desc" }],
    });
    const actorIds = [...new Set(signups.flatMap((signup) => signup.auditLogs.map((entry) => entry.actorId)))];
    const actors = actorIds.length
      ? await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true, role: true },
        })
      : [];
    const actorMap = new Map(actors.map((actor) => [actor.id, actor]));

    res.json({
      student: {
        id: student.id,
        name: student.name,
        email: student.email,
        cohortName: student.cohort?.name ?? null,
      },
      signups: signups.map((signup) => ({
        id: signup.id,
        status: signup.status,
        verificationStatus: signup.verificationStatus,
        totalHours: signup.totalHours,
        rejectionReason: signup.rejectionReason,
        checkedIn: signup.checkedIn,
        checkedOut: signup.checkedOut,
        slot: {
          date: signup.slot.date,
          startTime: signup.slot.startTime,
          endTime: signup.slot.endTime,
          durationHours: signup.slot.durationHours,
          opportunity: {
            title: signup.slot.opportunity.title,
            category: signup.slot.opportunity.category,
            beneficiary: signup.slot.opportunity.beneficiary,
          },
        },
        history: signup.auditLogs.map((entry) => ({
          id: entry.id,
          action: entry.action,
          details: entry.details,
          createdAt: entry.createdAt,
          actor: actorMap.get(entry.actorId) ?? { id: entry.actorId, name: "Unknown", role: "UNKNOWN" },
        })),
      })),
    });
  } catch (err) {
    console.error("Student verification history error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/schools/:id/students/:studentId/hour-breakdown — per-student source-of-truth view
router.get("/:id/students/:studentId/hour-breakdown", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const scope = await getStaffAccessScope(req.user!.userId);
    if (scope?.schoolId !== req.params.id) {
      return res.status(403).json({ error: "Not your school" });
    }

    const student = await prisma.user.findUnique({
      where: { id: req.params.studentId },
      select: {
        id: true,
        name: true,
        email: true,
        grade: true,
        role: true,
        classroom: { select: { schoolId: true, name: true } },
        cohort: { select: { schoolId: true, name: true } },
      },
    });
    if (!student) return res.status(404).json({ error: "Student not found" });
    if (student.role !== "STUDENT") return res.status(400).json({ error: "User is not a student" });

    const studentAllowed = scope ? await assertStudentAccessibleToStaff(scope, student.id) : false;
    if (!studentAllowed) return res.status(403).json({ error: "Student is not enrolled in a cohort you control" });

    const [beneficiarySignups, selfSubmissions, legacySessions, totalsMap] = await Promise.all([
      prisma.beneficiarySignup.findMany({
        where: { studentId: student.id },
        include: {
          slot: {
            include: {
              opportunity: {
                include: {
                  beneficiary: { select: { id: true, name: true, category: true } },
                },
              },
            },
          },
          auditLogs: { orderBy: { createdAt: "asc" } },
        },
        orderBy: [{ slot: { date: "desc" } }, { createdAt: "desc" }],
      }),
      prisma.selfSubmittedRequest.findMany({
        where: { studentId: student.id },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      }),
      prisma.serviceSession.findMany({
        where: { userId: student.id },
        include: {
          opportunity: {
            include: {
              organization: { select: { id: true, name: true } },
            },
          },
          auditLogs: { orderBy: { createdAt: "asc" } },
        },
        orderBy: [{ createdAt: "desc" }],
      }),
      calculateStudentHours([student.id]),
    ]);

    const actorIds = [
      ...beneficiarySignups.flatMap((signup) => signup.auditLogs.map((entry) => entry.actorId)),
      ...legacySessions.flatMap((session) => session.auditLogs.map((entry) => entry.actorId)),
      ...selfSubmissions.map((submission) => submission.reviewedBy).filter((value): value is string => Boolean(value)),
    ];

    const auditActors = actorIds.length
      ? await prisma.user.findMany({
          where: { id: { in: [...new Set(actorIds)] } },
          select: { id: true, name: true, role: true },
        })
      : [];
    const auditActorMap = new Map(auditActors.map((auditActor) => [auditActor.id, auditActor]));

    let beneficiaryApproved = 0;
    let beneficiaryPending = 0;
    let selfApproved = 0;
    let selfPending = 0;
    let legacyApproved = 0;
    let legacyPending = 0;

    const beneficiaryRecords = beneficiarySignups.map((signup) => {
      const displayHours = signup.totalHours ?? signup.slot.durationHours;
      const approvedHours = signup.verificationStatus === "APPROVED" ? displayHours : 0;
      const pendingHours =
        signup.verificationStatus === "PENDING" && signup.status !== "CANCELLED"
          ? signup.slot.durationHours
          : 0;
      beneficiaryApproved += approvedHours;
      beneficiaryPending += pendingHours;

      return {
        id: signup.id,
        source: "BENEFICIARY",
        title: signup.slot.opportunity.title,
        organizationName: signup.slot.opportunity.beneficiary.name,
        category: signup.slot.opportunity.category ?? signup.slot.opportunity.beneficiary.category ?? null,
        date: signup.slot.date,
        status: signup.status,
        verificationStatus: signup.verificationStatus,
        displayHours: roundHours(displayHours),
        approvedHours: roundHours(approvedHours),
        pendingHours: roundHours(pendingHours),
        rejectionReason: signup.rejectionReason,
        auditTrail: signup.auditLogs.map((entry) => ({
          id: entry.id,
          action: entry.action,
          details: entry.details,
          createdAt: entry.createdAt,
          actor: auditActorMap.get(entry.actorId) ?? { id: entry.actorId, name: "Unknown", role: "UNKNOWN" },
        })),
      };
    });

    const selfSubmissionRecords = selfSubmissions.map((submission) => {
      const approvedHours = submission.status === "APPROVED" ? submission.hours : 0;
      const pendingHours = submission.status === "PENDING" ? submission.hours : 0;
      selfApproved += approvedHours;
      selfPending += pendingHours;

      return {
        id: submission.id,
        source: "SELF_SUBMISSION",
        title: submission.organizationName,
        organizationName: submission.organizationName,
        category: submission.category ?? "general",
        date: submission.date,
        status: submission.status,
        displayHours: roundHours(submission.hours),
        approvedHours: roundHours(approvedHours),
        pendingHours: roundHours(pendingHours),
        description: submission.description,
        evidenceNote: submission.evidenceNote,
        rejectionReason: submission.rejectionReason,
        revisionNote: submission.revisionNote,
        timesRevised: submission.timesRevised,
        reviewedAt: submission.reviewedAt,
        reviewer: submission.reviewedBy
          ? auditActorMap.get(submission.reviewedBy) ?? { id: submission.reviewedBy, name: "Unknown", role: "UNKNOWN" }
          : null,
      };
    });

    const legacyRecords = legacySessions.map((session) => {
      const displayHours = session.totalHours ?? 0;
      const approvedHours = session.verificationStatus === "APPROVED" ? displayHours : 0;
      const pendingHours = session.verificationStatus === "PENDING" ? displayHours : 0;
      legacyApproved += approvedHours;
      legacyPending += pendingHours;

      return {
        id: session.id,
        source: "LEGACY_SESSION",
        title: session.opportunity.title,
        organizationName: session.opportunity.organization.name,
        date: session.opportunity.date,
        status: session.status,
        verificationStatus: session.verificationStatus,
        displayHours: roundHours(displayHours),
        approvedHours: roundHours(approvedHours),
        pendingHours: roundHours(pendingHours),
        rejectionReason: session.rejectionReason,
        auditTrail: session.auditLogs.map((entry) => ({
          id: entry.id,
          action: entry.action,
          details: entry.details,
          createdAt: entry.createdAt,
          actor: auditActorMap.get(entry.actorId) ?? { id: entry.actorId, name: "Unknown", role: "UNKNOWN" },
        })),
      };
    });

    const expectedTotals = totalsMap.get(student.id) ?? { approved: 0, pending: 0 };
    const approved = roundHours(beneficiaryApproved + selfApproved + legacyApproved);
    const pending = roundHours(beneficiaryPending + selfPending + legacyPending);

    await logDataAccess({
      actorId: req.user!.userId,
      action: "VIEW_STUDENT_HOUR_BREAKDOWN",
      targetType: "student",
      targetId: student.id,
      schoolId: req.params.id,
      details: { approved, pending },
    });

    res.json({
      student: {
        id: student.id,
        name: student.name,
        email: student.email,
        grade: student.grade,
        cohortName: student.cohort?.name ?? null,
        classroomName: student.classroom?.name ?? null,
      },
      totals: {
        approved,
        pending,
        bySource: {
          beneficiary: {
            approved: roundHours(beneficiaryApproved),
            pending: roundHours(beneficiaryPending),
            count: beneficiaryRecords.length,
          },
          selfSubmission: {
            approved: roundHours(selfApproved),
            pending: roundHours(selfPending),
            count: selfSubmissionRecords.length,
          },
          legacy: {
            approved: roundHours(legacyApproved),
            pending: roundHours(legacyPending),
            count: legacyRecords.length,
          },
        },
        reconciliation: {
          expectedApproved: roundHours(expectedTotals.approved),
          expectedPending: roundHours(expectedTotals.pending),
          reconciled: approved === roundHours(expectedTotals.approved) && pending === roundHours(expectedTotals.pending),
        },
      },
      records: {
        beneficiary: beneficiaryRecords,
        selfSubmission: selfSubmissionRecords,
        legacy: legacyRecords,
      },
    });
  } catch (err) {
    console.error("Student hour breakdown error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/schools/:id/stats — school-wide stats
router.get("/:id/stats", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const scope = await getStaffAccessScope(req.user!.userId);
    if (scope?.schoolId !== req.params.id) {
      return res.status(403).json({ error: "Not your school" });
    }

    const school = await prisma.school.findUnique({
      where: { id: req.params.id },
      select: {
        name: true,
        requiredHours: true,
        serviceStartDate: true,
        serviceEndDate: true,
      },
    });
    if (!school) return res.status(404).json({ error: "School not found" });

    const students = await prisma.user.findMany({
      where: {
        role: "STUDENT",
        ...(scope ? buildCohortScopedStudentWhere(scope) : {
          OR: [
            { classroom: { schoolId: req.params.id } },
            { cohort: { schoolId: req.params.id } },
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
      },
    });

    const progress = await buildStudentProgressRecords(students, {
      requiredHours: school.requiredHours,
      serviceStartDate: school.serviceStartDate,
      serviceEndDate: school.serviceEndDate,
    });

    const totalStudents = progress.length;
    const totalHours = progress.reduce((sum, student) => sum + student.approvedHours, 0);
    const completedGoal = progress.filter((student) => student.status === "COMPLETED").length;
    const atRisk = progress.filter((student) => student.status === "AT_RISK").length;

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
router.get("/:id/organizations", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
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

// GET /api/schools/:id/partner-opportunities — opportunities from approved partners
router.get("/:id/partner-opportunities", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (user?.schoolId !== req.params.id) {
      return res.status(403).json({ error: "Not your school" });
    }

    const search = (req.query.search as string | undefined)?.trim();
    const category = (req.query.category as string | undefined)?.trim();

    const opportunities = await prisma.beneficiaryOpportunity.findMany({
      where: {
        status: "ACTIVE",
        beneficiary: {
          schoolApprovals: {
            some: {
              schoolId: req.params.id,
              status: "APPROVED",
            },
          },
        },
        ...(category ? { category: { equals: category, mode: "insensitive" } } : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
                { location: { contains: search, mode: "insensitive" } },
                { category: { contains: search, mode: "insensitive" } },
                { beneficiary: { name: { contains: search, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      include: {
        beneficiary: { select: { id: true, name: true, category: true } },
        timeSlots: {
          include: { _count: { select: { signups: true } } },
          orderBy: { date: "asc" },
        },
      },
      orderBy: [{ startDate: "asc" }, { title: "asc" }],
    });

    res.json(opportunities);
  } catch (err) {
    console.error("School partner opportunities error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Student Groups ─────────────────────────────────────────────

// GET /api/schools/:id/groups
router.get("/:id/groups", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
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
router.get("/:id/groups/:groupId/students", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
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
    const [students, school, hoursMap] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: studentIds } },
        select: {
          id: true, name: true, email: true, grade: true,
          cohort: { select: { requiredHours: true } },
        },
      }),
      prisma.school.findUnique({ where: { id: req.params.id }, select: { requiredHours: true } }),
      calculateStudentHours(studentIds),
    ]);

    const result = students.map((s) => {
      const hours = hoursMap.get(s.id)?.approved ?? 0;
      const required = s.cohort?.requiredHours ?? school?.requiredHours ?? 40;
      return {
        id: s.id,
        name: s.name,
        email: s.email,
        grade: s.grade,
        approvedHours: hours,
        requiredHours: required,
        status: hours >= required ? "COMPLETED" : hours >= required * 0.5 ? "ON_TRACK" : "AT_RISK",
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
    const actor = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (actor?.schoolId !== req.params.id) {
      return res.status(403).json({ error: "Not your school" });
    }

    // Verify the group belongs to this school
    const group = await prisma.studentGroup.findUnique({ where: { id: req.params.groupId } });
    if (!group || group.schoolId !== req.params.id) {
      return res.status(403).json({ error: "Group not found in this school" });
    }

    const { studentId } = req.body;
    if (!studentId) return res.status(400).json({ error: "studentId is required" });

    // Verify the student belongs to this school
    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: { role: true, schoolId: true, cohort: { select: { schoolId: true } }, classroom: { select: { schoolId: true } } },
    });
    const studentSchoolId = student?.classroom?.schoolId ?? student?.cohort?.schoolId ?? student?.schoolId ?? null;
    if (!student || student.role !== "STUDENT" || studentSchoolId !== req.params.id) {
      return res.status(403).json({ error: "Student is not enrolled in your school" });
    }

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

    const tempPassword = crypto.randomBytes(12).toString("base64url");
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

    // If classroomId provided, verify it belongs to this school before assigning
    if (classroomId) {
      const classroom = await prisma.classroom.findUnique({ where: { id: classroomId }, select: { schoolId: true } });
      if (!classroom || classroom.schoolId !== req.params.id) {
        return res.status(400).json({ error: "classroomId does not belong to this school" });
      }
      await prisma.classroom.update({
        where: { id: classroomId },
        data: { teacherId: teacher.id },
      });
    }

    await logDataAccess({
      actorId: req.user!.userId,
      action: "STAFF_CREATED",
      targetType: "User",
      targetId: teacher.id,
      schoolId: req.params.id,
      details: { email: teacher.email, role: teacher.role },
    });

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

    // Verify the session's student belongs to this school regardless of role
    const sessionStudentSchoolId = await (async () => {
      const s = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { schoolId: true, cohort: { select: { schoolId: true } }, classroom: { select: { schoolId: true } } },
      });
      return s?.classroom?.schoolId ?? s?.cohort?.schoolId ?? s?.schoolId ?? null;
    })();
    if (sessionStudentSchoolId !== req.params.id) {
      return res.status(403).json({ error: "Student is not enrolled in your school" });
    }

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

// GET /api/schools/:id/export — export student data as CSV; optional ?cohortId= filter
router.get("/:id/export", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (user?.schoolId !== req.params.id) {
      return res.status(403).json({ error: "Not your school" });
    }
    const scope = await getStaffAccessScope(req.user!.userId);
    if (scope?.schoolId !== req.params.id) {
      return res.status(403).json({ error: "Not your school" });
    }

    const school = await prisma.school.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        requiredHours: true,
        serviceStartDate: true,
        serviceEndDate: true,
      },
    });
    if (!school) return res.status(404).json({ error: "School not found" });

    const cohortId = (req.query.cohortId as string | undefined) || undefined;
    let cohortLabel: string | null = null;

    if (cohortId) {
      const cohort = await prisma.cohort.findFirst({
        where: { id: cohortId, schoolId: req.params.id },
        select: { name: true },
      });
      if (!cohort) {
        return res.status(404).json({ error: "Cohort not found for this school" });
      }
      if (scope && !scope.isSchoolAdmin && !scope.assignedCohortIds.includes(cohortId)) {
        return res.status(403).json({ error: "Not your cohort" });
      }
      cohortLabel = cohort.name;
    }

    // Build where clause: optional cohort filter
    const whereClause: any = {
      role: "STUDENT",
    };
    if (cohortId) {
      whereClause.cohortId = cohortId;
    } else if (scope && !scope.isSchoolAdmin) {
      whereClause.cohortId = { in: scope.assignedCohortIds };
    } else {
      whereClause.OR = [
        { classroom: { schoolId: req.params.id } },
        { cohort: { schoolId: req.params.id } },
      ];
    }

    const students = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        grade: true,
        createdAt: true,
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
      orderBy: { name: "asc" },
    });

    const progress = await buildStudentProgressRecords(students, {
      requiredHours: school.requiredHours,
      serviceStartDate: school.serviceStartDate,
      serviceEndDate: school.serviceEndDate,
    });
    const progressMap = new Map(progress.map((student) => [student.id, student]));
    const accessibleCohorts = scope ? await getAccessibleTeacherCohorts(scope) : [];

    await logDataAccess({
      actorId: req.user!.userId,
      action: "EXPORT_SCHOOL_DATA",
      targetType: "school",
      targetId: req.params.id,
      schoolId: req.params.id,
      details: buildStaffStudentAuditDetails({
        req,
        actorRole: req.user!.role,
        accessKind: "school_data_export",
        reportType: "school_export_csv",
        scopeType: cohortLabel
          ? "cohort_selection"
          : scope?.isSchoolAdmin
            ? "school"
            : "assigned_cohorts",
        scopeLabel: cohortLabel
          ?? (scope?.isSchoolAdmin
            ? school.name
            : accessibleCohorts.map((cohort) => cohort.name).join(", ")),
        assignedCohorts: scope?.isSchoolAdmin ? [] : accessibleCohorts.map((cohort) => cohort.name),
        filters: cohortLabel ? { cohort: cohortLabel } : {},
        students: students.map((student) => ({ name: student.name, email: student.email })),
      }),
    });

    const rows: string[][] = [["Student ID", "Name", "Email", "Grade", "Cohort", "Approved Hours", "Required Hours", "% Complete", "Enrolled At"]];
    for (const s of students) {
      const student = progressMap.get(s.id);
      const hours = student?.approvedHours ?? 0;
      const required = student?.requiredHours ?? school.requiredHours;
      const pct = student?.percentComplete ?? Math.min(100, Math.round((hours / required) * 100));
      rows.push([
        s.id,
        s.name,
        s.email,
        s.grade || "",
        s.cohort?.name || "",
        String(Math.round(hours * 100) / 100),
        String(required),
        `${pct}%`,
        s.createdAt.toISOString().split("T")[0],
      ]);
    }

    const label = (cohortLabel ?? school.name).replace(/[^a-z0-9]/gi, "_");
    const csv = rows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${label}-students.csv"`);
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
router.get("/:id/data-access-logs", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
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
    const userTargetIds = [...new Set(logs
      .filter((log) => log.targetId && ["student", "user", "User"].includes(log.targetType || ""))
      .map((log) => log.targetId!)
    )];
    const schoolTargetIds = [...new Set(logs
      .filter((log) => log.targetId && ["school", "School"].includes(log.targetType || ""))
      .map((log) => log.targetId!)
    )];
    const cohortTargetIds = [...new Set(logs
      .filter((log) => log.targetId && ["cohort", "Cohort"].includes(log.targetType || ""))
      .map((log) => log.targetId!)
    )];

    const [users, schools, cohorts] = await Promise.all([
      userTargetIds.length
        ? prisma.user.findMany({ where: { id: { in: userTargetIds } }, select: { id: true, name: true, email: true } })
        : Promise.resolve([]),
      schoolTargetIds.length
        ? prisma.school.findMany({ where: { id: { in: schoolTargetIds } }, select: { id: true, name: true } })
        : Promise.resolve([]),
      cohortTargetIds.length
        ? prisma.cohort.findMany({ where: { id: { in: cohortTargetIds } }, select: { id: true, name: true } })
        : Promise.resolve([]),
    ]);

    const userLabelById = new Map(users.map((entry) => [entry.id, entry.name || entry.email]));
    const schoolLabelById = new Map(schools.map((entry) => [entry.id, entry.name]));
    const cohortLabelById = new Map(cohorts.map((entry) => [entry.id, entry.name]));

    res.json(logs.map((log) => {
      let targetLabel: string | null = null;
      if (log.targetId) {
        if (["student", "user", "User"].includes(log.targetType || "")) {
          targetLabel = userLabelById.get(log.targetId) ?? null;
        } else if (["school", "School"].includes(log.targetType || "")) {
          targetLabel = schoolLabelById.get(log.targetId) ?? null;
        } else if (["cohort", "Cohort"].includes(log.targetType || "")) {
          targetLabel = cohortLabelById.get(log.targetId) ?? null;
        }
      }
      return {
        ...log,
        targetId: null,
        targetLabel,
      };
    }));
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

// GET /api/schools/:id/students/at-risk — JSON list of at-risk students (optionally exportable)
router.get("/:id/students/at-risk", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const scope = await getStaffAccessScope(req.user!.userId);
    if (scope?.schoolId !== req.params.id) {
      return res.status(403).json({ error: "Not your school" });
    }

    const school = await prisma.school.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        requiredHours: true,
        serviceStartDate: true,
        serviceEndDate: true,
      },
    });
    if (!school) return res.status(404).json({ error: "School not found" });

    const cohortId = req.query.cohortId as string | undefined;

    if (cohortId) {
      const cohort = await prisma.cohort.findFirst({
        where: { id: cohortId, schoolId: req.params.id },
        select: { id: true },
      });
      if (!cohort) {
        return res.status(404).json({ error: "Cohort not found for this school" });
      }
      if (scope && !scope.isSchoolAdmin && !scope.assignedCohortIds.includes(cohortId)) {
        return res.status(403).json({ error: "Not your cohort" });
      }
    }

    const whereClause: any = { role: "STUDENT" };
    if (cohortId) {
      whereClause.cohortId = cohortId;
    } else if (scope && !scope.isSchoolAdmin) {
      whereClause.cohortId = { in: scope.assignedCohortIds };
    } else {
      whereClause.OR = [
        { classroom: { schoolId: req.params.id } },
        { cohort: { schoolId: req.params.id } },
      ];
    }

    const students = await prisma.user.findMany({
      where: whereClause,
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
      orderBy: { name: "asc" },
    });

    const progress = await buildStudentProgressRecords(students, {
      requiredHours: school.requiredHours,
      serviceStartDate: school.serviceStartDate,
      serviceEndDate: school.serviceEndDate,
    });

    const atRisk = progress
      .filter((student) => student.status === "AT_RISK")
      .map((student) => ({
        id: student.id,
        name: student.name,
        email: student.email,
        grade: student.grade,
        cohort: student.cohortName,
        approvedHours: student.approvedHours,
        pendingHours: student.pendingHours,
        requiredHours: student.requiredHours,
        remainingHours: student.remainingHours,
        percentComplete: student.percentComplete,
        riskLevel: student.riskLevel,
        riskReasons: student.riskReasons,
        noShowCount: student.noShowCount,
        daysToDeadline: student.daysToDeadline,
        deadline: student.serviceEndDate?.toISOString() ?? null,
      }));

    // CSV export if requested
    if (req.query.format === "csv") {
      const rows = [[
        "Name",
        "Email",
        "Grade",
        "Cohort",
        "Approved Hours",
        "Pending Hours",
        "Required Hours",
        "Remaining Hours",
        "% Complete",
        "Risk Level",
        "Risk Reasons",
        "No-Shows",
        "Deadline",
      ]];
      for (const s of atRisk) {
        rows.push([
          s.name,
          s.email,
          s.grade ?? "",
          s.cohort ?? "",
          String(s.approvedHours),
          String(s.pendingHours),
          String(s.requiredHours),
          String(s.remainingHours),
          `${s.percentComplete}%`,
          s.riskLevel,
          s.riskReasons.join("; "),
          String(s.noShowCount),
          s.deadline ? s.deadline.split("T")[0] : "",
        ]);
      }
      const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="at-risk-students.csv"`);
      return res.send(csv);
    }

    res.json({ total: atRisk.length, students: atRisk });
  } catch (err) {
    console.error("At-risk students error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
