import { Router, Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { sendBeneficiaryInvitationEmail, CLIENT_URL } from "../services/email";

const router = Router();

// GET /api/beneficiaries — list beneficiaries
// For school admin: all approved beneficiaries for their school
// For students: beneficiaries approved by their school
// For beneficiary admins: their own beneficiary
router.get("/", authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.role === "BENEFICIARY_ADMIN") {
      if (!user.beneficiaryId) return res.json([]);
      const ben = await prisma.beneficiary.findUnique({ where: { id: user.beneficiaryId } });
      return res.json(ben ? [ben] : []);
    }

    const schoolId = user.schoolId ?? (
      user.role === "STUDENT" && user.cohortId
        ? (await prisma.cohort.findUnique({ where: { id: user.cohortId }, select: { schoolId: true } }))?.schoolId
        : null
    );

    if (!schoolId) return res.json([]);

    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined; // APPROVED, PENDING, ALL

    const approvals = await prisma.schoolBeneficiaryApproval.findMany({
      where: {
        schoolId,
        ...(status && status !== "ALL" ? { status } : {}),
      },
      include: {
        beneficiary: true,
      },
      orderBy: { createdAt: "desc" },
    });

    let beneficiaries = approvals.map((a) => ({
      ...a.beneficiary,
      approvalStatus: a.status,
      approvalId: a.id,
    }));

    if (search) {
      beneficiaries = beneficiaries.filter(
        (b) =>
          b.name.toLowerCase().includes(search.toLowerCase()) ||
          b.category?.toLowerCase().includes(search.toLowerCase())
      );
    }

    res.json(beneficiaries);
  } catch (err) {
    console.error("List beneficiaries error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/beneficiaries/directory — search beneficiary directory (school admin only)
router.get("/directory", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER", "DISTRICT_ADMIN"), async (req: Request, res: Response) => {
  try {
    const search = req.query.search as string | undefined;
    const category = req.query.category as string | undefined;
    const zip = req.query.zip as string | undefined;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { category: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
      ];
    }
    if (category) where.category = { contains: category, mode: "insensitive" };
    if (zip) where.zip = zip;

    const entries = await prisma.beneficiaryDirectory.findMany({
      where,
      take: 50,
      orderBy: { name: "asc" },
    });

    res.json(entries);
  } catch (err) {
    console.error("Beneficiary directory search error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/beneficiaries — create custom beneficiary (school admin only)
router.post("/", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      name: z.string().min(1).max(255),
      category: z.string().max(100).optional(),
      address: z.string().max(255).optional(),
      city: z.string().max(100).optional(),
      state: z.string().max(50).optional(),
      zip: z.string().regex(/^\d{5}$/).optional(),
      email: z.string().email().optional().or(z.literal("")),
      phone: z.string().max(20).optional(),
      website: z.string().max(255).optional(),
      description: z.string().max(1000).optional(),
      visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PRIVATE"),
    });
    const data = schema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user?.schoolId) return res.status(400).json({ error: "Not associated with a school" });

    const beneficiary = await prisma.beneficiary.create({
      data: {
        name: data.name,
        category: data.category || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        zip: data.zip || null,
        email: data.email || null,
        phone: data.phone || null,
        website: data.website || null,
        description: data.description || null,
        visibility: data.visibility,
        status: "ACTIVE",
        createdBySchoolId: user.schoolId,
      },
    });

    // Auto-approve for the creating school
    await prisma.schoolBeneficiaryApproval.create({
      data: {
        schoolId: user.schoolId,
        beneficiaryId: beneficiary.id,
        status: "APPROVED",
        approvedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "BENEFICIARY_CREATED",
        actorId: req.user!.userId,
        details: JSON.stringify({ beneficiaryId: beneficiary.id, name: beneficiary.name, visibility: data.visibility }),
      },
    });

    res.status(201).json(beneficiary);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    console.error("Create beneficiary error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/beneficiaries/my-signups — student's own BeneficiarySignup records
router.get("/my-signups", authenticate, requireRole("STUDENT"), async (req: Request, res: Response) => {
  try {
    const signups = await prisma.beneficiarySignup.findMany({
      where: { studentId: req.user!.userId },
      include: {
        slot: {
          include: {
            opportunity: {
              include: {
                beneficiary: { select: { id: true, name: true, category: true } },
              },
            },
            _count: { select: { signups: true } },
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

// GET /api/beneficiaries/available-slots — future slots from school-approved beneficiaries (student)
router.get("/available-slots", authenticate, requireRole("STUDENT"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    let schoolId = user?.schoolId ?? null;
    if (!schoolId && user?.cohortId) {
      const cohort = await prisma.cohort.findUnique({ where: { id: user.cohortId }, select: { schoolId: true } });
      schoolId = cohort?.schoolId ?? null;
    }
    if (!schoolId) return res.json([]);

    const approvals = await prisma.schoolBeneficiaryApproval.findMany({
      where: { schoolId, status: "APPROVED" },
      select: { beneficiaryId: true },
    });
    const beneficiaryIds = approvals.map((a) => a.beneficiaryId);
    if (!beneficiaryIds.length) return res.json([]);

    const now = new Date();
    const slots = await prisma.beneficiaryTimeSlot.findMany({
      where: {
        date: { gte: now },
        opportunity: {
          beneficiaryId: { in: beneficiaryIds },
          status: "ACTIVE",
        },
      },
      include: {
        opportunity: {
          include: {
            beneficiary: { select: { id: true, name: true, category: true } },
          },
        },
        _count: { select: { signups: true } },
      },
      orderBy: { date: "asc" },
    });
    res.json(slots);
  } catch (err) {
    console.error("Available slots error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/beneficiaries/:id — get beneficiary details
router.get("/:id", authenticate, async (req: Request, res: Response) => {
  try {
    const ben = await prisma.beneficiary.findUnique({
      where: { id: req.params.id },
      include: {
        opportunities: {
          where: { status: "ACTIVE" },
          include: { timeSlots: { include: { _count: { select: { signups: true } } } } },
        },
        schoolApprovals: {
          select: { schoolId: true, status: true },
        },
      },
    });
    if (!ben) return res.status(404).json({ error: "Beneficiary not found" });

    // Check access: beneficiary admin for their own, school for approved, students for school-approved
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (user?.role === "BENEFICIARY_ADMIN" && user.beneficiaryId !== ben.id) {
      return res.status(403).json({ error: "Not your beneficiary" });
    }

    res.json(ben);
  } catch (err) {
    console.error("Get beneficiary error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/beneficiaries/approve-from-directory — school approves a directory beneficiary
router.post("/approve-from-directory", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const { directoryId } = z.object({ directoryId: z.string().min(1) }).parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user?.schoolId) return res.status(400).json({ error: "Not associated with a school" });

    const school = await prisma.school.findUnique({ where: { id: user.schoolId } });

    // Check if a Beneficiary already exists for this directory entry
    let beneficiary = await prisma.beneficiary.findFirst({ where: { directoryId } });
    if (!beneficiary) {
      const dirEntry = await prisma.beneficiaryDirectory.findUnique({ where: { id: directoryId } });
      if (!dirEntry) return res.status(404).json({ error: "Directory entry not found" });
      beneficiary = await prisma.beneficiary.create({
        data: {
          name: dirEntry.name,
          category: dirEntry.category || null,
          address: dirEntry.address || null,
          city: dirEntry.city || null,
          state: dirEntry.state || null,
          zip: dirEntry.zip || null,
          email: dirEntry.email || null,
          website: dirEntry.website || null,
          directoryId,
          visibility: "PUBLIC",
          status: "PENDING",
        },
      });
    }

    // Upsert approval record
    const approval = await prisma.schoolBeneficiaryApproval.upsert({
      where: { schoolId_beneficiaryId: { schoolId: user.schoolId, beneficiaryId: beneficiary.id } },
      update: { status: "APPROVED", approvedAt: new Date() },
      create: { schoolId: user.schoolId, beneficiaryId: beneficiary.id, status: "APPROVED", approvedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        action: "BENEFICIARY_APPROVED",
        actorId: req.user!.userId,
        details: JSON.stringify({ beneficiaryId: beneficiary.id, schoolId: user.schoolId }),
      },
    });

    // Send invitation if beneficiary has email and is not yet claimed
    if (beneficiary.email && !beneficiary.claimed) {
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      await prisma.beneficiaryInvitation.create({
        data: {
          schoolId: user.schoolId,
          beneficiaryId: beneficiary.id,
          token,
          expiresAt,
          sentTo: beneficiary.email,
          status: "PENDING",
        },
      });
      const magicLink = `${CLIENT_URL}/join/beneficiary?token=${token}`;
      sendBeneficiaryInvitationEmail(beneficiary.email, beneficiary.name, school?.name ?? "A school", magicLink).catch(() => {});
    }

    res.json({ beneficiary, approval });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    console.error("Approve beneficiary error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/beneficiaries/:id/invite — send/resend invitation to an already-approved beneficiary
router.post("/:id/invite", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user?.schoolId) return res.status(400).json({ error: "Not associated with a school" });

    const ben = await prisma.beneficiary.findUnique({ where: { id: req.params.id } });
    if (!ben) return res.status(404).json({ error: "Beneficiary not found" });

    const school = await prisma.school.findUnique({ where: { id: user.schoolId }, select: { name: true } });

    const { email } = z.object({ email: z.string().email() }).parse(req.body);

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.beneficiaryInvitation.create({
      data: {
        schoolId: user.schoolId,
        beneficiaryId: ben.id,
        token,
        expiresAt,
        sentTo: email,
        status: "PENDING",
      },
    });

    const magicLink = `${CLIENT_URL}/join/beneficiary?token=${token}`;
    await sendBeneficiaryInvitationEmail(email, ben.name, school?.name ?? "A school", magicLink);

    res.json({ message: "Invitation sent" });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    console.error("Invite beneficiary error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/beneficiaries/:id/drop — remove beneficiary approval (school admin)
router.post("/:id/drop", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user?.schoolId) return res.status(400).json({ error: "Not associated with a school" });

    await prisma.schoolBeneficiaryApproval.updateMany({
      where: { schoolId: user.schoolId, beneficiaryId: req.params.id },
      data: { status: "REJECTED" },
    });

    res.json({ message: "Beneficiary removed from approved list" });
  } catch (err) {
    console.error("Drop beneficiary error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/beneficiaries/:id/opportunities — list opportunities for a beneficiary
router.get("/:id/opportunities", authenticate, async (req: Request, res: Response) => {
  try {
    const opportunities = await prisma.beneficiaryOpportunity.findMany({
      where: { beneficiaryId: req.params.id, status: { not: "CANCELLED" } },
      include: {
        timeSlots: {
          include: { _count: { select: { signups: true } } },
          orderBy: { date: "asc" },
        },
      },
      orderBy: { startDate: "asc" },
    });
    res.json(opportunities);
  } catch (err) {
    console.error("List beneficiary opportunities error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/beneficiaries/:id/opportunities — create opportunity (beneficiary admin only)
router.post("/:id/opportunities", authenticate, requireRole("BENEFICIARY_ADMIN"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (user?.beneficiaryId !== req.params.id) return res.status(403).json({ error: "Not your beneficiary" });

    const schema = z.object({
      title: z.string().min(1).max(255),
      description: z.string().max(2000),
      category: z.string().max(100).optional(),
      location: z.string().max(255).optional(),
      address: z.string().max(255).optional(),
      startDate: z.string(), // ISO date string
      endDate: z.string().optional(),
      requirementsNote: z.string().max(1000).optional(),
      timeSlots: z.array(z.object({
        date: z.string(),
        startTime: z.string(),
        endTime: z.string(),
        durationHours: z.number().positive(),
        capacity: z.number().int().positive().default(10),
      })).min(1),
    });
    const data = schema.parse(req.body);

    const opp = await prisma.beneficiaryOpportunity.create({
      data: {
        title: data.title,
        description: data.description,
        beneficiaryId: req.params.id,
        category: data.category || null,
        location: data.location || null,
        address: data.address || null,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        requirementsNote: data.requirementsNote || null,
        status: "ACTIVE",
        timeSlots: {
          create: data.timeSlots.map((ts) => ({
            date: new Date(ts.date),
            startTime: ts.startTime,
            endTime: ts.endTime,
            durationHours: ts.durationHours,
            capacity: ts.capacity,
          })),
        },
      },
      include: { timeSlots: true },
    });

    res.status(201).json(opp);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    console.error("Create opportunity error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/beneficiaries/slots/:slotId/signup — student signs up for a time slot
router.post("/slots/:slotId/signup", authenticate, requireRole("STUDENT"), async (req: Request, res: Response) => {
  try {
    const slot = await prisma.beneficiaryTimeSlot.findUnique({
      where: { id: req.params.slotId },
      include: { _count: { select: { signups: true } } },
    });
    if (!slot) return res.status(404).json({ error: "Time slot not found" });

    const existing = await prisma.beneficiarySignup.findUnique({
      where: { slotId_studentId: { slotId: slot.id, studentId: req.user!.userId } },
    });
    if (existing) return res.status(409).json({ error: "Already signed up for this slot" });

    const confirmedCount = slot._count.signups;
    const status = confirmedCount >= slot.capacity ? "WAITLISTED" : "CONFIRMED";

    const signup = await prisma.beneficiarySignup.create({
      data: { slotId: slot.id, studentId: req.user!.userId, status },
    });

    res.status(201).json(signup);
  } catch (err) {
    console.error("Slot signup error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/beneficiaries/:id/signups — list signups for a beneficiary (beneficiary admin)
router.get("/:id/signups", authenticate, requireRole("BENEFICIARY_ADMIN"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (user?.beneficiaryId !== req.params.id) return res.status(403).json({ error: "Not your beneficiary" });

    const statusFilter = req.query.status as string | undefined;
    const signups = await prisma.beneficiarySignup.findMany({
      where: {
        slot: { opportunity: { beneficiaryId: req.params.id } },
        ...(statusFilter ? { verificationStatus: statusFilter } : {}),
      },
      include: {
        slot: {
          include: {
            opportunity: { select: { title: true } },
          },
        },
        // student info via relation not defined, fetch separately
      },
      orderBy: { createdAt: "desc" },
    });

    // Fetch student names
    const studentIds = [...new Set(signups.map((s) => s.studentId))];
    const students = await prisma.user.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, name: true, email: true },
    });
    const studentMap = new Map(students.map((s) => [s.id, s]));

    const result = signups.map((s) => ({
      ...s,
      student: studentMap.get(s.studentId) ?? { id: s.studentId, name: "Unknown", email: "" },
    }));

    res.json(result);
  } catch (err) {
    console.error("List beneficiary signups error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/beneficiaries/signups/:signupId/approve — beneficiary admin approves hours
router.post("/signups/:signupId/approve", authenticate, requireRole("BENEFICIARY_ADMIN"), async (req: Request, res: Response) => {
  try {
    const signup = await prisma.beneficiarySignup.findUnique({
      where: { id: req.params.signupId },
      include: { slot: { include: { opportunity: true } } },
    });
    if (!signup) return res.status(404).json({ error: "Signup not found" });

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (user?.beneficiaryId !== signup.slot.opportunity.beneficiaryId) {
      return res.status(403).json({ error: "Not your beneficiary's signup" });
    }

    const { approvedHours } = req.body;
    const hours = approvedHours ?? signup.slot.durationHours;

    const updated = await prisma.beneficiarySignup.update({
      where: { id: req.params.signupId },
      data: {
        verificationStatus: "APPROVED",
        totalHours: hours,
        verifiedBy: req.user!.userId,
        verifiedAt: new Date(),
      },
    });

    await prisma.beneficiaryAuditLog.create({
      data: {
        action: "APPROVE",
        actorId: req.user!.userId,
        signupId: signup.id,
        details: JSON.stringify({ approvedHours: hours, originalHours: signup.slot.durationHours }),
      },
    });

    res.json(updated);
  } catch (err) {
    console.error("Approve signup error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/beneficiaries/signups/:signupId/reject — beneficiary admin rejects hours
router.post("/signups/:signupId/reject", authenticate, requireRole("BENEFICIARY_ADMIN"), async (req: Request, res: Response) => {
  try {
    const signup = await prisma.beneficiarySignup.findUnique({
      where: { id: req.params.signupId },
      include: { slot: { include: { opportunity: true } } },
    });
    if (!signup) return res.status(404).json({ error: "Signup not found" });

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (user?.beneficiaryId !== signup.slot.opportunity.beneficiaryId) {
      return res.status(403).json({ error: "Not your beneficiary's signup" });
    }

    const { reason } = z.object({ reason: z.string().min(1) }).parse(req.body);

    const updated = await prisma.beneficiarySignup.update({
      where: { id: req.params.signupId },
      data: {
        verificationStatus: "REJECTED",
        rejectionReason: reason,
        verifiedBy: req.user!.userId,
        verifiedAt: new Date(),
      },
    });

    await prisma.beneficiaryAuditLog.create({
      data: {
        action: "REJECT",
        actorId: req.user!.userId,
        signupId: signup.id,
        details: JSON.stringify({ reason }),
      },
    });

    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    console.error("Reject signup error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
