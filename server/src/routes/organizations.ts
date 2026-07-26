import { Router, Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { sendOrgApprovalRequestEmail } from "../services/email";
import { buildAnonymousVolunteerLabel } from "../lib/privacy";
import { strictObject, optionalTrimmedString } from "../lib/validation";

const router = Router();

const organizationPublicSelect = {
  id: true,
  name: true,
  description: true,
  website: true,
  avatarUrl: true,
  opportunities: {
    where: { status: "ACTIVE" },
    orderBy: { date: "asc" },
    take: 10,
    select: {
      id: true,
      title: true,
      description: true,
      date: true,
      startTime: true,
      endTime: true,
      location: true,
      status: true,
    },
  },
  _count: { select: { opportunities: true } },
} as const;

// Owner-only profile data. Never use this for a directory or an unrelated
// authenticated requester.
const organizationOwnerSelect = {
  ...organizationPublicSelect,
  email: true,
  phone: true,
  status: true,
  zipCodes: true,
} as const;

// GET /api/organizations — list all
router.get("/", authenticate, async (_req: Request, res: Response) => {
  try {
    const orgs = await prisma.organization.findMany({
      select: organizationPublicSelect,
      orderBy: { name: "asc" },
    });
    res.json(orgs);
  } catch (err) {
    console.error("List orgs error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/organizations/:id
router.get("/:id", authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { organizationId: true },
    });
    const isOwner = req.user!.role === "ORG_ADMIN" && user?.organizationId === req.params.id;
    const org = await prisma.organization.findUnique({
      where: { id: req.params.id },
      select: isOwner ? organizationOwnerSelect : organizationPublicSelect,
    });
    if (!org) return res.status(404).json({ error: "Organization not found" });
    res.json(org);
  } catch (err) {
    console.error("Get org error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/organizations/:id — update org profile
const updateOrgSchema = strictObject({
  name: optionalTrimmedString(255),
  phone: optionalTrimmedString(50),
  description: optionalTrimmedString(2000),
  website: optionalTrimmedString(500),
  zipCodes: z.array(z.string().trim().regex(/^\d{5}$/, "Invalid ZIP code")).max(50).optional(),
});

router.put("/:id", authenticate, requireRole("ORG_ADMIN"), async (req: Request, res: Response) => {
  try {
    const data = updateOrgSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (user?.organizationId !== req.params.id) {
      return res.status(403).json({ error: "Not your organization" });
    }

    const org = await prisma.organization.update({
      where: { id: req.params.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.website !== undefined && { website: data.website }),
        ...(data.zipCodes !== undefined && { zipCodes: data.zipCodes.length > 0 ? JSON.stringify(data.zipCodes) : null }),
      },
    });
    res.json(org);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.errors });
    }
    console.error("Update org error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/organizations/:id/request-school/:schoolId — request to be added to school's approved list
router.post("/:id/request-school/:schoolId", authenticate, requireRole("ORG_ADMIN"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (user?.organizationId !== req.params.id) {
      return res.status(403).json({ error: "Not your organization" });
    }

    const existing = await prisma.schoolOrganization.findUnique({
      where: { schoolId_organizationId: { schoolId: req.params.schoolId, organizationId: req.params.id } },
    });
    if (existing) return res.status(409).json({ error: "Relationship already exists" });

    const request = await prisma.schoolOrganization.create({
      data: {
        schoolId: req.params.schoolId,
        organizationId: req.params.id,
        status: "PENDING",
      },
    });

    // Notify school admin (in-app + email)
    const schoolAdmin = await prisma.user.findFirst({
      where: { schoolId: req.params.schoolId, role: "SCHOOL_ADMIN" },
    });
    if (schoolAdmin) {
      const org = await prisma.organization.findUnique({ where: { id: req.params.id } });
      await prisma.notification.create({
        data: {
          userId: schoolAdmin.id,
          type: "ORG_REQUEST",
          title: "New Organization Request",
          body: `${org?.name} has requested to be added to your approved organizations list.`,
        },
      });
      sendOrgApprovalRequestEmail(schoolAdmin.email, org?.name ?? "An organization").catch(() => {});
    }

    res.status(201).json(request);
  } catch (err) {
    console.error("Request school error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/organizations/:id/schools — list schools this org is approved for
router.get("/:id/schools", authenticate, requireRole("ORG_ADMIN"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (user?.organizationId !== req.params.id) {
      return res.status(403).json({ error: "Not your organization" });
    }

    const approvals = await prisma.schoolOrganization.findMany({
      where: { organizationId: req.params.id },
      include: { school: { select: { id: true, name: true, domain: true } } },
    });

    res.json(approvals);
  } catch (err) {
    console.error("Org schools error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/organizations/:id/volunteers — anonymous volunteer summary
router.get("/:id/volunteers", authenticate, requireRole("ORG_ADMIN"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (user?.organizationId !== req.params.id) {
      return res.status(403).json({ error: "Not your organization" });
    }

    const sessions = await prisma.serviceSession.findMany({
      where: {
        opportunity: { organizationId: req.params.id },
        verificationStatus: "APPROVED",
      },
      select: {
        userId: true,
        totalHours: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const volunteerMap = new Map<string, { id: string; label: string; totalHours: number; sessionCount: number }>();

    for (const session of sessions) {
      const existing = volunteerMap.get(session.userId);
      if (existing) {
        existing.totalHours += session.totalHours || 0;
        existing.sessionCount += 1;
      } else {
        volunteerMap.set(session.userId, {
          id: session.userId,
          label: buildAnonymousVolunteerLabel(session.userId),
          totalHours: session.totalHours || 0,
          sessionCount: 1,
        });
      }
    }

    res.json(
      [...volunteerMap.values()]
        .map((volunteer) => ({
          ...volunteer,
          totalHours: Math.round(volunteer.totalHours * 100) / 100,
        }))
        .sort((a, b) => b.totalHours - a.totalHours)
    );
  } catch (err) {
    console.error("Volunteers error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/organizations/:id/stats — impact summary
router.get("/:id/stats", authenticate, async (req: Request, res: Response) => {
  try {
    const orgId = req.params.id;

    const totalOpportunities = await prisma.opportunity.count({ where: { organizationId: orgId } });
    const totalSignups = await prisma.signup.count({
      where: { opportunity: { organizationId: orgId }, status: "CONFIRMED" },
    });
    const approvedSessions = await prisma.serviceSession.findMany({
      where: { opportunity: { organizationId: orgId }, verificationStatus: "APPROVED" },
      select: { totalHours: true },
    });
    const totalHours = approvedSessions.reduce((sum, s) => sum + (s.totalHours || 0), 0);
    const uniqueVolunteers = await prisma.serviceSession.findMany({
      where: { opportunity: { organizationId: orgId }, verificationStatus: "APPROVED" },
      distinct: ["userId"],
      select: { userId: true },
    });

    res.json({
      totalOpportunities,
      totalSignups,
      totalApprovedHours: Math.round(totalHours * 100) / 100,
      uniqueVolunteers: uniqueVolunteers.length,
    });
  } catch (err) {
    console.error("Org stats error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
