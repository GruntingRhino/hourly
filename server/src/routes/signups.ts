import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { runSerializableTransaction } from "../lib/serializableTransaction";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { buildAnonymousVolunteerLabel } from "../lib/privacy";

const router = Router();

// POST /api/signups — student signs up for opportunity
router.post("/", authenticate, requireRole("STUDENT"), async (req: Request, res: Response) => {
  try {
    const { opportunityId } = req.body;
    if (!opportunityId) {
      return res.status(400).json({ error: "opportunityId is required" });
    }
    const student = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { schoolId: true },
    });
    const schoolId = student?.schoolId ?? null;
    if (!schoolId) {
      return res.status(403).json({ error: "You must be enrolled in a school to sign up for opportunities." });
    }

    const result = await runSerializableTransaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM "Opportunity" WHERE id = ${opportunityId} FOR UPDATE`;

      const opp = await tx.opportunity.findUnique({
        where: { id: opportunityId },
        select: { id: true, title: true, status: true, capacity: true, durationHours: true, organizationId: true },
      });
      if (!opp) return { kind: "error" as const, status: 404, body: { error: "Opportunity not found" } };
      if (opp.status !== "ACTIVE") return { kind: "error" as const, status: 400, body: { error: "Opportunity is not active" } };
      const approval = await tx.schoolOrganization.findFirst({
        where: { schoolId, organizationId: opp.organizationId, status: "APPROVED" },
        select: { id: true },
      });
      if (!approval) {
        return { kind: "error" as const, status: 403, body: { error: "This opportunity is not available at your school." } };
      }

      const existing = await tx.signup.findUnique({
        where: { userId_opportunityId: { userId: req.user!.userId, opportunityId } },
      });
      if (existing && existing.status !== "CANCELLED") {
        return { kind: "error" as const, status: 409, body: { error: "Already signed up" } };
      }

      const confirmedCount = await tx.signup.count({
        where: { opportunityId, status: "CONFIRMED" },
      });
      const status = confirmedCount >= opp.capacity ? "WAITLISTED" : "CONFIRMED";

      if (existing) {
        const updated = await tx.signup.update({
          where: { id: existing.id },
          data: { status },
        });
        await tx.serviceSession.updateMany({
          where: { userId: req.user!.userId, opportunityId },
          data: {
            schoolId,
            status: status === "CONFIRMED" ? "PENDING_CHECKIN" : "WAITLISTED",
            totalHours: opp.durationHours,
            verificationStatus: "PENDING",
            signatureType: null,
            signatureData: null,
            signatureFileName: null,
            submittedAt: null,
            rejectionReason: null,
          },
        });
        return { kind: "success" as const, signup: updated, opp, status, httpStatus: 200 };
      }

      const signup = await tx.signup.create({
        data: {
          userId: req.user!.userId,
          opportunityId,
          status,
        },
      });

      await tx.serviceSession.create({
        data: {
          userId: req.user!.userId,
          schoolId,
          opportunityId,
          status: status === "CONFIRMED" ? "PENDING_CHECKIN" : "WAITLISTED",
          totalHours: opp.durationHours,
        },
      });

      return { kind: "success" as const, signup, opp, status, httpStatus: 201 };
    });

    if (result.kind === "error") {
      return res.status(result.status).json(result.body);
    }

    const { signup, opp, status, httpStatus } = result;

    res.status(httpStatus).json(signup);

    // Keep core signup latency low; notifications are non-blocking side effects.
    void (async () => {
      await prisma.notification.create({
        data: {
          userId: req.user!.userId,
          type: "SIGNUP_CONFIRMED",
          title: status === "CONFIRMED" ? "Signup Confirmed" : "Added to Waitlist",
          body: status === "CONFIRMED"
            ? `You're signed up for "${opp.title}"`
            : `You've been waitlisted for "${opp.title}"`,
          data: JSON.stringify({ href: "/dashboard" }),
        },
      });

      const orgAdmins = await prisma.user.findMany({
        where: { organizationId: opp.organizationId, role: "ORG_ADMIN" },
        select: { id: true },
      });

      if (orgAdmins.length === 0) return;

      await prisma.notification.createMany({
        data: orgAdmins.map((admin) => ({
          userId: admin.id,
          type: "STUDENT_SIGNUP",
          title: "New Signup",
          body: `${buildAnonymousVolunteerLabel(req.user!.userId)} signed up for "${opp.title}"`,
        })),
      });
    })().catch((sideEffectErr) => {
      console.error("Signup side-effect error:", sideEffectErr);
    });
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
            _count: { select: { signups: { where: { status: "CONFIRMED" } } } },
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

    const result = await runSerializableTransaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM "Opportunity" WHERE id = ${signup.opportunityId} FOR UPDATE`;

      const liveSignup = await tx.signup.findUnique({
        where: { id: req.params.id },
      });
      if (!liveSignup) return { kind: "error" as const, status: 404, body: { error: "Signup not found" } };
      if (liveSignup.status === "CANCELLED") {
        return { kind: "error" as const, status: 400, body: { error: "Already cancelled" } };
      }

      const updated = await tx.signup.update({
        where: { id: req.params.id },
        data: { status: "CANCELLED" },
      });

      await tx.serviceSession.updateMany({
        where: { userId: liveSignup.userId, opportunityId: liveSignup.opportunityId },
        data: { status: "CANCELLED" },
      });

      let promotedUserId: string | null = null;
      if (liveSignup.status === "CONFIRMED") {
        const firstWaitlisted = await tx.signup.findFirst({
          where: { opportunityId: liveSignup.opportunityId, status: "WAITLISTED" },
          orderBy: { createdAt: "asc" },
        });
        if (firstWaitlisted) {
          await tx.signup.update({
            where: { id: firstWaitlisted.id },
            data: { status: "CONFIRMED" },
          });
          await tx.serviceSession.updateMany({
            where: { userId: firstWaitlisted.userId, opportunityId: liveSignup.opportunityId },
            data: { status: "PENDING_CHECKIN" },
          });
          promotedUserId = firstWaitlisted.userId;
        }
      }

      return {
        kind: "success" as const,
        updated,
        promotedUserId,
      };
    });

    if (result.kind === "error") {
      return res.status(result.status).json(result.body);
    }

    const opp = await prisma.opportunity.findUnique({ where: { id: signup.opportunityId } });
    if (opp) {
      if (result.promotedUserId) {
        await prisma.notification.create({
          data: {
            userId: result.promotedUserId,
            type: "SIGNUP_CONFIRMED",
            title: "Spot Available!",
            body: `A spot opened up for "${opp.title}" — you're now confirmed!`,
            data: JSON.stringify({ href: "/dashboard" }),
          },
        });
      }

      // Notify org admins of cancellation
      const orgAdmins = await prisma.user.findMany({
        where: { organizationId: opp.organizationId, role: "ORG_ADMIN" },
        select: { id: true },
      });
      if (orgAdmins.length > 0) {
        await prisma.notification.createMany({
          data: orgAdmins.map((admin) => ({
            userId: admin.id,
            type: "SIGNUP_CANCELLED",
            title: "Signup Cancelled",
            body: `${buildAnonymousVolunteerLabel(signup.userId)} cancelled their signup for "${opp.title}"`,
          })),
        });
      }
    }

    res.json(result.updated);
  } catch (err) {
    console.error("Cancel signup error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
