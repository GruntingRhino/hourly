import { Router, Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";

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
    const { search, date, tag, organizationId, status } = req.query;

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

    const opportunities = await prisma.opportunity.findMany({
      where,
      include: {
        organization: { select: { id: true, name: true, avatarUrl: true } },
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

export default router;
