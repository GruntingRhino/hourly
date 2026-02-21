import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { sendOrgApprovalRequestEmail } from "../services/email";

const router = Router();

// GET /api/organizations — list all
router.get("/", async (_req: Request, res: Response) => {
  try {
    const orgs = await prisma.organization.findMany({
      include: {
        _count: { select: { opportunities: true, members: true } },
      },
      orderBy: { name: "asc" },
    });
    res.json(orgs);
  } catch (err) {
    console.error("List orgs error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/organizations/:id
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.params.id },
      include: {
        opportunities: {
          where: { status: "ACTIVE" },
          orderBy: { date: "asc" },
          take: 10,
        },
        _count: { select: { opportunities: true, members: true } },
      },
    });
    if (!org) return res.status(404).json({ error: "Organization not found" });
    res.json(org);
  } catch (err) {
    console.error("Get org error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/organizations/:id — update org profile
router.put("/:id", authenticate, requireRole("ORG_ADMIN"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (user?.organizationId !== req.params.id) {
      return res.status(403).json({ error: "Not your organization" });
    }

    const org = await prisma.organization.update({
      where: { id: req.params.id },
      data: {
        name: req.body.name,
        phone: req.body.phone,
        description: req.body.description,
        website: req.body.website,
        socialLinks: req.body.socialLinks ? JSON.stringify(req.body.socialLinks) : undefined,
        zipCodes: "zipCodes" in req.body
          ? (Array.isArray(req.body.zipCodes) && req.body.zipCodes.length > 0
              ? JSON.stringify(req.body.zipCodes)
              : null)
          : undefined,
      },
    });
    res.json(org);
  } catch (err) {
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

// GET /api/organizations/:id/volunteers — volunteer history
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
      include: {
        user: { select: { id: true, name: true, email: true } },
        opportunity: { select: { id: true, title: true, date: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(sessions);
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
