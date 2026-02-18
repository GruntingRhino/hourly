import { Router, Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import * as zipcodes from "zipcodes";
import * as geolib from "geolib";

const router = Router();

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  tags: z.array(z.string()).optional(),
  location: z.string().min(1),
  address: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  date: z.string(), // ISO date
  startTime: z.string(),
  endTime: z.string(),
  durationHours: z.number().positive(),
  capacity: z.number().int().positive(),
  ageRequirement: z.number().int().optional(),
  gradeRequirement: z.string().optional(),
  isRecurring: z.boolean().optional(),
  recurringPattern: z.string().optional(),
});

// GET /api/opportunities — browse (public, filtered)
router.get("/", async (req: Request, res: Response) => {
  try {
    const { search, date, tag, organizationId, status, schoolId, approvedOnly } = req.query;

    const where: any = { status: (status as string) || "ACTIVE" };

    if (search) {
      where.OR = [
        { title: { contains: search as string } },
        { description: { contains: search as string } },
        { location: { contains: search as string } },
      ];
    }
    if (date) {
      const d = new Date(date as string);
      const nextDay = new Date(d);
      nextDay.setDate(nextDay.getDate() + 1);
      where.date = { gte: d, lt: nextDay };
    }
    if (organizationId) {
      where.organizationId = organizationId;
    }

    // If approvedOnly and schoolId, filter to only approved orgs
    let approvedOrgIds: string[] = [];
    let schoolZip: string | null = null;
    if (schoolId) {
      const school = await prisma.school.findUnique({ where: { id: schoolId as string } });
      if (school?.zipCodes) {
        try {
          const zips = JSON.parse(school.zipCodes);
          if (zips.length > 0) schoolZip = zips[0];
        } catch {}
      }
      const approvals = await prisma.schoolOrganization.findMany({
        where: { schoolId: schoolId as string, status: "APPROVED" },
        select: { organizationId: true },
      });
      approvedOrgIds = approvals.map((a) => a.organizationId);

      // Also get blocked orgs and exclude them
      const blocked = await prisma.schoolOrganization.findMany({
        where: { schoolId: schoolId as string, status: "BLOCKED" },
        select: { organizationId: true },
      });
      const blockedIds = blocked.map((b) => b.organizationId);
      if (blockedIds.length > 0) {
        where.organizationId = { notIn: blockedIds };
      }
    }

    if (approvedOnly === "true" && approvedOrgIds.length > 0) {
      where.organizationId = { in: approvedOrgIds };
    }

    const opportunities = await prisma.opportunity.findMany({
      where,
      include: {
        organization: { select: { id: true, name: true, avatarUrl: true, zipCodes: true } },
        _count: { select: { signups: { where: { status: "CONFIRMED" } } } },
      },
      orderBy: { date: "asc" },
    });

    // Filter by tag if provided (tags stored as JSON string)
    let results = opportunities;
    if (tag) {
      results = opportunities.filter((opp) => {
        if (!opp.tags) return false;
        try {
          const tags = JSON.parse(opp.tags);
          return tags.includes(tag);
        } catch {
          return false;
        }
      });
    }

    // Sort: approved orgs first, then by distance from school ZIP
    if (schoolId && approvedOrgIds.length > 0) {
      const schoolCoords = schoolZip ? ((zipcodes as any).lookup(schoolZip) ?? null) : null;

      results = results.sort((a, b) => {
        const aApproved = approvedOrgIds.includes(a.organizationId) ? 0 : 1;
        const bApproved = approvedOrgIds.includes(b.organizationId) ? 0 : 1;
        if (aApproved !== bApproved) return aApproved - bApproved;

        // Within same approval group, sort by distance if we have coords
        if (schoolCoords) {
          const getOrgCoords = (opp: any) => {
            try {
              const orgZips = opp.organization.zipCodes ? JSON.parse(opp.organization.zipCodes) : [];
              if (orgZips.length > 0) {
                const info = (zipcodes as any).lookup(orgZips[0]) ?? null;
                if (info) return { latitude: info.latitude, longitude: info.longitude };
              }
            } catch {}
            return null;
          };
          const aCoords = getOrgCoords(a);
          const bCoords = getOrgCoords(b);
          if (aCoords && bCoords) {
            const aDist = (geolib as any).getDistance(
              { latitude: schoolCoords.latitude, longitude: schoolCoords.longitude },
              aCoords
            );
            const bDist = (geolib as any).getDistance(
              { latitude: schoolCoords.latitude, longitude: schoolCoords.longitude },
              bCoords
            );
            return aDist - bDist;
          }
        }
        return 0;
      });
    }

    res.json(results);
  } catch (err) {
    console.error("List opportunities error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/opportunities/:id
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const opp = await prisma.opportunity.findUnique({
      where: { id: req.params.id },
      include: {
        organization: { select: { id: true, name: true, description: true, avatarUrl: true } },
        _count: { select: { signups: { where: { status: "CONFIRMED" } } } },
        signups: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        },
      },
    });
    if (!opp) return res.status(404).json({ error: "Opportunity not found" });
    res.json(opp);
  } catch (err) {
    console.error("Get opportunity error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/opportunities — create (org only)
router.post("/", authenticate, requireRole("ORG_ADMIN"), async (req: Request, res: Response) => {
  try {
    const data = createSchema.parse(req.body);

    // Get user's organization
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user?.organizationId) {
      return res.status(400).json({ error: "User not associated with an organization" });
    }

    const opp = await prisma.opportunity.create({
      data: {
        ...data,
        tags: data.tags ? JSON.stringify(data.tags) : null,
        date: new Date(data.date),
        organizationId: user.organizationId,
      },
      include: {
        organization: { select: { id: true, name: true } },
      },
    });

    res.status(201).json(opp);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.errors });
    }
    console.error("Create opportunity error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/opportunities/:id — edit (org only)
router.put("/:id", authenticate, requireRole("ORG_ADMIN"), async (req: Request, res: Response) => {
  try {
    const opp = await prisma.opportunity.findUnique({ where: { id: req.params.id } });
    if (!opp) return res.status(404).json({ error: "Opportunity not found" });

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (opp.organizationId !== user?.organizationId) {
      return res.status(403).json({ error: "Not your organization's opportunity" });
    }

    const updateData: any = { ...req.body };
    if (updateData.tags && Array.isArray(updateData.tags)) {
      updateData.tags = JSON.stringify(updateData.tags);
    }
    if (updateData.date) {
      updateData.date = new Date(updateData.date);
    }

    const updated = await prisma.opportunity.update({
      where: { id: req.params.id },
      data: updateData,
      include: { organization: { select: { id: true, name: true } } },
    });

    res.json(updated);
  } catch (err) {
    console.error("Update opportunity error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/opportunities/:id/cancel — cancel (org only)
router.post("/:id/cancel", authenticate, requireRole("ORG_ADMIN"), async (req: Request, res: Response) => {
  try {
    const opp = await prisma.opportunity.findUnique({ where: { id: req.params.id } });
    if (!opp) return res.status(404).json({ error: "Opportunity not found" });

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (opp.organizationId !== user?.organizationId) {
      return res.status(403).json({ error: "Not your organization's opportunity" });
    }

    const updated = await prisma.opportunity.update({
      where: { id: req.params.id },
      data: { status: "CANCELLED" },
    });

    // Notify all signed-up students
    const signups = await prisma.signup.findMany({
      where: { opportunityId: req.params.id, status: "CONFIRMED" },
    });
    for (const signup of signups) {
      await prisma.notification.create({
        data: {
          userId: signup.userId,
          type: "OPPORTUNITY_CANCELLED",
          title: "Opportunity Cancelled",
          body: `"${opp.title}" has been cancelled.`,
        },
      });
    }

    res.json(updated);
  } catch (err) {
    console.error("Cancel opportunity error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/opportunities/:id/announce — send announcement to all confirmed signups (org only)
router.post("/:id/announce", authenticate, requireRole("ORG_ADMIN"), async (req: Request, res: Response) => {
  try {
    const opp = await prisma.opportunity.findUnique({ where: { id: req.params.id } });
    if (!opp) return res.status(404).json({ error: "Opportunity not found" });

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (opp.organizationId !== user?.organizationId) {
      return res.status(403).json({ error: "Not your organization's opportunity" });
    }

    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });

    const signups = await prisma.signup.findMany({
      where: { opportunityId: req.params.id, status: "CONFIRMED" },
    });

    for (const signup of signups) {
      await prisma.notification.create({
        data: {
          userId: signup.userId,
          type: "ANNOUNCEMENT",
          title: `Announcement: ${opp.title}`,
          body: message,
        },
      });
    }

    res.json({ sent: signups.length });
  } catch (err) {
    console.error("Announce error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
