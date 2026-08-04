import { Router, Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";

const router = Router();

const savedStatusEnum = z.enum(["SAVED", "SKIPPED", "DISCARDED"]);

const saveOpportunitySchema = z.object({
  opportunityId: z.string().trim().min(1),
  status: savedStatusEnum.optional(),
});

// POST /api/saved — save/skip/discard opportunity
router.post("/", authenticate, requireRole("STUDENT"), async (req: Request, res: Response) => {
  try {
    const parsed = saveOpportunitySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "opportunityId is required and status must be SAVED, SKIPPED, or DISCARDED" });
    }
    const { opportunityId, status } = parsed.data;

    const saved = await prisma.savedOpportunity.upsert({
      where: {
        userId_opportunityId: { userId: req.user!.userId, opportunityId },
      },
      update: { status: status ?? "SAVED" },
      create: {
        userId: req.user!.userId,
        opportunityId,
        status: status ?? "SAVED",
      },
    });
    res.json(saved);
  } catch (err) {
    console.error("Save opportunity error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/saved — get saved opportunities
router.get("/", authenticate, requireRole("STUDENT"), async (req: Request, res: Response) => {
  try {
    const statusFilter = savedStatusEnum.optional().safeParse(req.query.status);
    if (!statusFilter.success) {
      return res.status(400).json({ error: "status must be SAVED, SKIPPED, or DISCARDED" });
    }
    const where: any = { userId: req.user!.userId };
    if (statusFilter.data) where.status = statusFilter.data;

    const saved = await prisma.savedOpportunity.findMany({
      where,
      include: {
        opportunity: {
          include: {
            organization: { select: { id: true, name: true } },
            _count: { select: { signups: { where: { status: "CONFIRMED" } } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(saved);
  } catch (err) {
    console.error("Get saved error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/saved/:id
router.delete("/:id", authenticate, requireRole("STUDENT"), async (req: Request, res: Response) => {
  try {
    const saved = await prisma.savedOpportunity.findUnique({ where: { id: req.params.id } });
    if (!saved || saved.userId !== req.user!.userId) {
      return res.status(403).json({ error: "Cannot delete this saved opportunity" });
    }
    await prisma.savedOpportunity.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error("Delete saved error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
