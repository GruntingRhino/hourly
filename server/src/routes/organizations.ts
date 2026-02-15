import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";

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
      },
    });
    res.json(org);
  } catch (err) {
    console.error("Update org error:", err);
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
