import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import prisma from "../lib/prisma";
import { signToken } from "../middleware/auth";

const router = Router();

const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .max(128)
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^a-zA-Z0-9]/, "Password must contain at least one special character");

// GET /api/invitations/student?token=xxx — look up a student invitation
router.get("/student", async (req: Request, res: Response) => {
  try {
    const { token } = req.query;
    if (!token || typeof token !== "string") {
      return res.status(400).json({ error: "Token is required" });
    }

    const inv = await prisma.studentInvitation.findUnique({
      where: { token },
      include: { cohort: { include: { school: { select: { id: true, name: true } } } } },
    });

    if (!inv) return res.status(404).json({ error: "Invalid invitation token" });
    if (inv.status === "ACCEPTED") return res.status(400).json({ error: "Invitation already used" });
    if (inv.status === "REVOKED") return res.status(400).json({ error: "Invitation has been revoked" });
    if (new Date() > inv.expiresAt) {
      await prisma.studentInvitation.update({ where: { id: inv.id }, data: { status: "EXPIRED" } });
      return res.status(400).json({ error: "Invitation has expired. Ask your school administrator to resend." });
    }

    // Don't expose sensitive info — just metadata needed to render enrollment form
    res.json({
      email: inv.email,
      name: inv.name,
      cohortName: inv.cohort.name,
      schoolName: inv.cohort.school.name,
      schoolId: inv.cohort.school.id,
    });
  } catch (err) {
    console.error("Get student invitation error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/invitations/student/accept — student accepts invitation and creates account
router.post("/student/accept", async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      token: z.string(),
      name: z.string().min(1).max(255),
      password: passwordSchema,
      grade: z.string().max(50).optional(),
      house: z.string().max(100).optional(),
    });
    const data = schema.parse(req.body);

    const inv = await prisma.studentInvitation.findUnique({
      where: { token: data.token },
      include: { cohort: { include: { school: true } } },
    });

    if (!inv) return res.status(404).json({ error: "Invalid invitation token" });
    if (inv.status === "ACCEPTED") return res.status(400).json({ error: "Invitation already used" });
    if (inv.status === "REVOKED") return res.status(400).json({ error: "Invitation has been revoked" });
    if (new Date() > inv.expiresAt) {
      await prisma.studentInvitation.update({ where: { id: inv.id }, data: { status: "EXPIRED" } });
      return res.status(400).json({ error: "Invitation has expired. Contact your school administrator." });
    }

    // Check if user already exists with this email
    const existing = await prisma.user.findUnique({ where: { email: inv.email } });
    if (existing) {
      // If the user exists and is already a STUDENT, link them to the cohort
      if (existing.role === "STUDENT") {
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            cohortId: inv.cohortId,
            schoolId: inv.cohort.schoolId,
          },
        });
        await prisma.studentInvitation.update({
          where: { id: inv.id },
          data: { status: "ACCEPTED", acceptedAt: new Date() },
        });
        const token = signToken({ userId: existing.id, email: existing.email, role: existing.role });
        return res.json({ token, user: { id: existing.id, email: existing.email, name: existing.name, role: existing.role, cohortId: inv.cohortId, schoolId: inv.cohort.schoolId } });
      }
      return res.status(409).json({ error: "An account with this email already exists with a different role." });
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        email: inv.email,
        passwordHash,
        name: data.name,
        role: "STUDENT",
        grade: data.grade || null,
        house: data.house || null,
        cohortId: inv.cohortId,
        schoolId: inv.cohort.schoolId,
        emailVerified: true, // invitation-based — email implicitly verified
        status: "ACTIVE",
      },
    });

    await prisma.studentInvitation.update({
      where: { id: inv.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });

    const jwtToken = signToken({ userId: user.id, email: user.email, role: user.role });

    res.status(201).json({
      token: jwtToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        cohortId: user.cohortId,
        schoolId: user.schoolId,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    console.error("Accept student invitation error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/invitations/beneficiary?token=xxx — look up a beneficiary invitation
router.get("/beneficiary", async (req: Request, res: Response) => {
  try {
    const { token } = req.query;
    if (!token || typeof token !== "string") {
      return res.status(400).json({ error: "Token is required" });
    }

    const inv = await prisma.beneficiaryInvitation.findUnique({
      where: { token },
      include: { beneficiary: true },
    });

    if (!inv) return res.status(404).json({ error: "Invalid invitation token" });
    if (inv.status === "ACCEPTED") return res.status(400).json({ error: "Invitation already accepted" });
    if (inv.status === "DECLINED") return res.status(400).json({ error: "Invitation was declined" });
    if (new Date() > inv.expiresAt) {
      await prisma.beneficiaryInvitation.update({ where: { id: inv.id }, data: { status: "EXPIRED" } });
      return res.status(400).json({ error: "Invitation has expired" });
    }

    const school = await prisma.school.findUnique({ where: { id: inv.schoolId }, select: { name: true } });

    res.json({
      beneficiaryName: inv.beneficiary.name,
      schoolName: school?.name ?? "A school",
      sentTo: inv.sentTo,
      beneficiaryId: inv.beneficiaryId,
    });
  } catch (err) {
    console.error("Get beneficiary invitation error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/invitations/beneficiary/accept — beneficiary accepts invitation and creates admin account
router.post("/beneficiary/accept", async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      token: z.string(),
      name: z.string().min(1).max(255), // admin user name
      password: passwordSchema,
    });
    const data = schema.parse(req.body);

    const inv = await prisma.beneficiaryInvitation.findUnique({
      where: { token: data.token },
      include: { beneficiary: true },
    });

    if (!inv) return res.status(404).json({ error: "Invalid invitation token" });
    if (inv.status === "ACCEPTED") return res.status(400).json({ error: "Invitation already accepted" });
    if (inv.status === "DECLINED") return res.status(400).json({ error: "Invitation was declined" });
    if (new Date() > inv.expiresAt) {
      await prisma.beneficiaryInvitation.update({ where: { id: inv.id }, data: { status: "EXPIRED" } });
      return res.status(400).json({ error: "Invitation has expired" });
    }

    // Check if account already exists for this email
    const existing = await prisma.user.findUnique({ where: { email: inv.sentTo } });
    if (existing && existing.role === "BENEFICIARY_ADMIN") {
      // Link to beneficiary if not already
      await prisma.user.update({
        where: { id: existing.id },
        data: { beneficiaryId: inv.beneficiaryId },
      });
      await prisma.beneficiaryInvitation.update({
        where: { id: inv.id },
        data: { status: "ACCEPTED", acceptedAt: new Date(), respondedAt: new Date() },
      });
      await prisma.beneficiary.update({
        where: { id: inv.beneficiaryId },
        data: { claimed: true, status: "ACTIVE" },
      });
      // Approve the school relationship
      await prisma.schoolBeneficiaryApproval.upsert({
        where: { schoolId_beneficiaryId: { schoolId: inv.schoolId, beneficiaryId: inv.beneficiaryId } },
        update: { status: "APPROVED", approvedAt: new Date() },
        create: { schoolId: inv.schoolId, beneficiaryId: inv.beneficiaryId, status: "APPROVED", approvedAt: new Date() },
      });
      const jwtToken = signToken({ userId: existing.id, email: existing.email, role: existing.role });
      return res.json({ token: jwtToken, user: { id: existing.id, email: existing.email, name: existing.name, role: existing.role, beneficiaryId: inv.beneficiaryId } });
    }
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        email: inv.sentTo,
        passwordHash,
        name: data.name,
        role: "BENEFICIARY_ADMIN",
        beneficiaryId: inv.beneficiaryId,
        emailVerified: true,
        status: "ACTIVE",
      },
    });

    await prisma.beneficiaryInvitation.update({
      where: { id: inv.id },
      data: { status: "ACCEPTED", acceptedAt: new Date(), respondedAt: new Date() },
    });

    await prisma.beneficiary.update({
      where: { id: inv.beneficiaryId },
      data: { claimed: true, status: "ACTIVE" },
    });

    // Approve the school relationship
    await prisma.schoolBeneficiaryApproval.upsert({
      where: { schoolId_beneficiaryId: { schoolId: inv.schoolId, beneficiaryId: inv.beneficiaryId } },
      update: { status: "APPROVED", approvedAt: new Date() },
      create: { schoolId: inv.schoolId, beneficiaryId: inv.beneficiaryId, status: "APPROVED", approvedAt: new Date() },
    });

    const jwtToken = signToken({ userId: user.id, email: user.email, role: user.role });

    res.status(201).json({
      token: jwtToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        beneficiaryId: user.beneficiaryId,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    console.error("Accept beneficiary invitation error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/invitations/beneficiary/decline
router.post("/beneficiary/decline", async (req: Request, res: Response) => {
  try {
    const { token } = z.object({ token: z.string() }).parse(req.body);

    const inv = await prisma.beneficiaryInvitation.findUnique({ where: { token } });
    if (!inv) return res.status(404).json({ error: "Invalid invitation token" });
    if (["ACCEPTED", "DECLINED"].includes(inv.status)) {
      return res.status(400).json({ error: `Invitation already ${inv.status.toLowerCase()}` });
    }

    await prisma.beneficiaryInvitation.update({
      where: { id: inv.id },
      data: { status: "DECLINED", respondedAt: new Date() },
    });

    res.json({ message: "Invitation declined" });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    console.error("Decline invitation error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
