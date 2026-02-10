import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";

const router = Router();

// POST /api/saved — save/skip/discard opportunity
router.post("/", authenticate, requireRole("STUDENT"), async (req: Request, res: Response) => {
  try {
    const { opportunityId, status } = req.body; // SAVED, SKIPPED, DISCARDED
    if (!opportunityId) return res.status(400).json({ error: "opportunityId is required" });

    const saved = await prisma.savedOpportunity.upsert({
      where: {
        userId_opportunityId: { userId: req.user!.userId, opportunityId },
      },
      update: { status: status || "SAVED" },
      create: {
        userId: req.user!.userId,
        opportunityId,
        status: status || "SAVED",
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
    const { status } = req.query;
    const where: any = { userId: req.user!.userId };
    if (status) where.status = status;

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
router.delete("/:id", authenticate, async (req: Request, res: Response) => {
  try {
    await prisma.savedOpportunity.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error("Delete saved error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
