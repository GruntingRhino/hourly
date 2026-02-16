import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";

const router = Router();

// POST /api/signups — student signs up for opportunity
router.post("/", authenticate, requireRole("STUDENT"), async (req: Request, res: Response) => {
  try {
    const { opportunityId } = req.body;
    if (!opportunityId) {
      return res.status(400).json({ error: "opportunityId is required" });
    }

    const opp = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      include: { _count: { select: { signups: { where: { status: "CONFIRMED" } } } } },
    });
    if (!opp) return res.status(404).json({ error: "Opportunity not found" });
    if (opp.status !== "ACTIVE") return res.status(400).json({ error: "Opportunity is not active" });

    // Check for existing signup
    const existing = await prisma.signup.findUnique({
      where: { userId_opportunityId: { userId: req.user!.userId, opportunityId } },
    });
    if (existing) {
      if (existing.status === "CANCELLED") {
        // Re-signup
        const confirmedCount = opp._count.signups;
        const status = confirmedCount >= opp.capacity ? "WAITLISTED" : "CONFIRMED";
        const updated = await prisma.signup.update({
          where: { id: existing.id },
          data: { status },
        });
        // Reset service session to COMMITTED
        await prisma.serviceSession.updateMany({
          where: { userId: req.user!.userId, opportunityId },
          data: {
            status: "COMMITTED",
            totalHours: opp.durationHours,
            verificationStatus: "PENDING",
            signatureType: null,
            signatureData: null,
            signatureFileUrl: null,
            signatureFileName: null,
            submittedAt: null,
            rejectionReason: null,
          },
        });
        return res.json(updated);
      }
      return res.status(409).json({ error: "Already signed up" });
    }

    // Check capacity
    const confirmedCount = opp._count.signups;
    const status = confirmedCount >= opp.capacity ? "WAITLISTED" : "CONFIRMED";

    const signup = await prisma.signup.create({
      data: {
        userId: req.user!.userId,
        opportunityId,
        status,
      },
    });

    // Create a committed service session with pre-filled hours
    await prisma.serviceSession.create({
      data: {
        userId: req.user!.userId,
        opportunityId,
        status: "COMMITTED",
        totalHours: opp.durationHours,
      },
    });

    // Notification
    await prisma.notification.create({
      data: {
        userId: req.user!.userId,
        type: "SIGNUP_CONFIRMED",
        title: status === "CONFIRMED" ? "Signup Confirmed" : "Added to Waitlist",
        body: status === "CONFIRMED"
          ? `You're signed up for "${opp.title}"`
          : `You've been waitlisted for "${opp.title}"`,
      },
    });

    res.status(201).json(signup);
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/signups/my — student's signups
router.get("/my", authenticate, requireRole("STUDENT"), async (req: Request, res: Response) => {
  try {
    const signups = await prisma.signup.findMany({
      where: { userId: req.user!.userId },
      include: {
        opportunity: {
          include: {
            organization: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(signups);
  } catch (err) {
    console.error("My signups error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/signups/:id/cancel — cancel signup
router.post("/:id/cancel", authenticate, async (req: Request, res: Response) => {
  try {
    const signup = await prisma.signup.findUnique({ where: { id: req.params.id } });
    if (!signup) return res.status(404).json({ error: "Signup not found" });

    // Students can cancel their own, orgs can cancel any for their opportunities
    if (signup.userId !== req.user!.userId && req.user!.role !== "ORG_ADMIN") {
      return res.status(403).json({ error: "Cannot cancel this signup" });
    }

    const updated = await prisma.signup.update({
      where: { id: req.params.id },
      data: { status: "CANCELLED" },
    });

    // If a confirmed spot opens, promote first waitlisted
    const opp = await prisma.opportunity.findUnique({ where: { id: signup.opportunityId } });
    if (opp) {
      const firstWaitlisted = await prisma.signup.findFirst({
        where: { opportunityId: signup.opportunityId, status: "WAITLISTED" },
        orderBy: { createdAt: "asc" },
      });
      if (firstWaitlisted) {
        await prisma.signup.update({
          where: { id: firstWaitlisted.id },
          data: { status: "CONFIRMED" },
        });
        await prisma.notification.create({
          data: {
            userId: firstWaitlisted.userId,
            type: "SIGNUP_CONFIRMED",
            title: "Spot Available!",
            body: `A spot opened up for "${opp.title}" — you're now confirmed!`,
          },
        });
      }
    }

    res.json(updated);
  } catch (err) {
    console.error("Cancel signup error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
