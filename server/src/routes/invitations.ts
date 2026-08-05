import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import prisma from "../lib/prisma";
import { signUserToken } from "../middleware/auth";
import { setAuthCookie } from "../lib/authCookies";
import { hashToken } from "../lib/tokenHash";
import { ensureStudentCohortMembership } from "../lib/studentCohorts";
import { createHybridRateLimit } from "../middleware/rateLimit";
import { firstZodError, strictObject, tokenSchema, trimmedString } from "../lib/validation";
import { roleForBeneficiaryClaim } from "../lib/beneficiaryAdminPolicy";
import { runSerializableTransaction } from "../lib/serializableTransaction";
import { ForbiddenFeatureError, requireOrgFeature, sendForbiddenFeature } from "../lib/orgTierGates";

const router = Router();
const publicInvitationLimiter = createHybridRateLimit({
  namespace: "invitations-public",
  windowMs: 15 * 60 * 1000,
  maxPerIp: 60,
  maxPerUser: 120,
});

const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .max(128)
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^a-zA-Z0-9]/, "Password must contain at least one special character");

const invitationTokenQuerySchema = strictObject({
  token: tokenSchema,
});

const acceptStudentInvitationSchema = strictObject({
  token: tokenSchema,
  name: trimmedString(255, 1),
  password: passwordSchema,
});

const acceptBeneficiaryInvitationSchema = strictObject({
  token: tokenSchema,
  name: trimmedString(255, 1),
  password: passwordSchema,
});

const declineBeneficiaryInvitationSchema = strictObject({
  token: tokenSchema,
});

const acceptBeneficiaryAdminInvitationSchema = strictObject({
  token: tokenSchema,
  name: trimmedString(255, 1),
  password: passwordSchema,
});

// GET /api/invitations/student?token=xxx — look up a student invitation
router.get("/student", publicInvitationLimiter, async (req: Request, res: Response) => {
  try {
    const { token } = invitationTokenQuerySchema.parse({
      token: typeof req.query.token === "string" ? req.query.token : undefined,
    });

    const inv = await prisma.studentInvitation.findUnique({
      where: { token: hashToken(token) },
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
      grade: inv.grade,
      house: inv.house,
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
router.post("/student/accept", publicInvitationLimiter, async (req: Request, res: Response) => {
  try {
    const data = acceptStudentInvitationSchema.parse(req.body);

    const inv = await prisma.studentInvitation.findUnique({
      where: { token: hashToken(data.token) },
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
        if (existing.schoolId && existing.schoolId !== inv.cohort.schoolId) {
          return res.status(409).json({
            error: "This account belongs to another school; an authorized school transfer is required.",
          });
        }
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            schoolId: existing.schoolId ?? inv.cohort.schoolId,
            grade: existing.grade ?? inv.grade,
            house: existing.house ?? inv.house,
          },
        });
        await ensureStudentCohortMembership({
          studentId: existing.id,
          cohortId: inv.cohortId,
          source: "INVITATION",
          forcePrimary: !existing.cohortId,
          schoolId: inv.cohort.schoolId,
        });
        await prisma.studentInvitation.update({
          where: { id: inv.id },
          data: { status: "ACCEPTED", acceptedAt: new Date() },
        });
        if (inv.startingHours && inv.startingHours > 0) {
          await prisma.selfSubmittedRequest.create({
            data: {
              studentId: existing.id,
              schoolId: inv.cohort.schoolId,
              organizationName: "Prior Service Record",
              description: "Hours credited from school import",
              date: new Date(),
              hours: inv.startingHours,
              status: "APPROVED",
              reviewedAt: new Date(),
            },
          });
        }
        const token = signUserToken(existing);
        setAuthCookie(res, token, { persistent: true });
        return res.json({ token, user: { id: existing.id, email: existing.email, name: existing.name, role: existing.role, cohortId: existing.cohortId ?? inv.cohortId, schoolId: inv.cohort.schoolId } });
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
        grade: inv.grade || null,
        house: inv.house || null,
        cohortId: inv.cohortId,
        schoolId: inv.cohort.schoolId,
        emailVerified: true, // invitation-based — email implicitly verified
        status: "ACTIVE",
      },
    });
    await ensureStudentCohortMembership({
      studentId: user.id,
      cohortId: inv.cohortId,
      source: "INVITATION",
      forcePrimary: true,
      schoolId: inv.cohort.schoolId,
    });

    await prisma.studentInvitation.update({
      where: { id: inv.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });

    if (inv.startingHours && inv.startingHours > 0) {
      await prisma.selfSubmittedRequest.create({
        data: {
          studentId: user.id,
          schoolId: inv.cohort.schoolId,
          organizationName: "Prior Service Record",
          description: "Hours credited from school import",
          date: new Date(),
          hours: inv.startingHours,
          status: "APPROVED",
          reviewedAt: new Date(),
        },
      });
    }

    const jwtToken = signUserToken(user);
    setAuthCookie(res, jwtToken, { persistent: true });

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
    if (err instanceof z.ZodError) return res.status(400).json({ error: firstZodError(err) });
    console.error("Accept student invitation error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/invitations/beneficiary?token=xxx — look up a beneficiary invitation
router.get("/beneficiary", publicInvitationLimiter, async (req: Request, res: Response) => {
  try {
    const { token } = invitationTokenQuerySchema.parse({
      token: typeof req.query.token === "string" ? req.query.token : undefined,
    });

    const inv = await prisma.beneficiaryInvitation.findUnique({
      where: { token: hashToken(token) },
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
router.post("/beneficiary/accept", publicInvitationLimiter, async (req: Request, res: Response) => {
  try {
    const data = acceptBeneficiaryInvitationSchema.parse(req.body);

    const inv = await prisma.beneficiaryInvitation.findUnique({
      where: { token: hashToken(data.token) },
      include: { beneficiary: true },
    });

    if (!inv) return res.status(404).json({ error: "Invalid invitation token" });
    if (inv.status === "ACCEPTED") {
      const existingAcceptedUser = await prisma.user.findUnique({ where: { email: inv.sentTo } });
      if (existingAcceptedUser?.role === "BENEFICIARY_ADMIN") {
        const jwtToken = signUserToken(existingAcceptedUser);
        setAuthCookie(res, jwtToken, { persistent: true });
        return res.json({
          token: jwtToken,
          user: {
            id: existingAcceptedUser.id,
            email: existingAcceptedUser.email,
            name: existingAcceptedUser.name,
            role: existingAcceptedUser.role,
            beneficiaryId: existingAcceptedUser.beneficiaryId,
          },
        });
      }
      return res.status(400).json({ error: "Invitation already accepted" });
    }
    if (inv.status === "DECLINED") return res.status(400).json({ error: "Invitation was declined" });
    if (new Date() > inv.expiresAt) {
      await prisma.beneficiaryInvitation.update({ where: { id: inv.id }, data: { status: "EXPIRED" } });
      return res.status(400).json({ error: "Invitation has expired" });
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const acceptance = await runSerializableTransaction(async (tx) => {
      // This lookup must happen inside every serializable retry. Reusing a
      // pre-transaction snapshot could move one administrator between two
      // organizations when separate invitations are accepted concurrently.
      const existing = await tx.user.findUnique({ where: { email: inv.sentTo } });
      if (existing && existing.role !== "BENEFICIARY_ADMIN") {
        throw Object.assign(new Error("An account with this email already exists."), { status: 409 });
      }
      if (existing?.beneficiaryId && existing.beneficiaryId !== inv.beneficiaryId) {
        throw Object.assign(new Error("This administrator already belongs to another organization."), { status: 409 });
      }

      const accepted = await tx.beneficiaryInvitation.updateMany({
        where: { id: inv.id, status: "PENDING", expiresAt: { gt: new Date() } },
        data: { status: "ACCEPTED", acceptedAt: new Date(), respondedAt: new Date() },
      });
      if (accepted.count !== 1) throw Object.assign(new Error("Invitation is no longer available"), { status: 409 });

      const ownerCount = await tx.user.count({
        where: { beneficiaryId: inv.beneficiaryId, role: "BENEFICIARY_ADMIN", beneficiaryAdminRole: "OWNER" },
      });
      const beneficiaryAdminRole = existing?.beneficiaryId === inv.beneficiaryId && existing.beneficiaryAdminRole === "OWNER"
        ? "OWNER"
        : roleForBeneficiaryClaim(ownerCount > 0);
      const acceptedUser = existing
        ? await tx.user.update({
            where: { id: existing.id },
            data: { beneficiaryId: inv.beneficiaryId, beneficiaryAdminRole },
          })
        : await tx.user.create({
            data: {
              email: inv.sentTo,
              passwordHash,
              name: data.name,
              role: "BENEFICIARY_ADMIN",
              beneficiaryId: inv.beneficiaryId,
              beneficiaryAdminRole,
              emailVerified: true,
              status: "ACTIVE",
            },
          });
      await tx.beneficiary.update({
        where: { id: inv.beneficiaryId },
        data: { claimed: true, status: "ACTIVE" },
      });
      await tx.schoolBeneficiaryApproval.upsert({
        where: { schoolId_beneficiaryId: { schoolId: inv.schoolId, beneficiaryId: inv.beneficiaryId } },
        update: { status: "APPROVED", approvedAt: new Date() },
        create: { schoolId: inv.schoolId, beneficiaryId: inv.beneficiaryId, status: "APPROVED", approvedAt: new Date() },
      });
      return { user: acceptedUser, created: !existing };
    });

    const { user } = acceptance;
    const jwtToken = signUserToken(user);
    setAuthCookie(res, jwtToken, { persistent: true });

    res.status(acceptance.created ? 201 : 200).json({
      token: jwtToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        beneficiaryId: user.beneficiaryId,
      },
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: firstZodError(err) });
    if (err?.status === 409) return res.status(409).json({ error: err.message });
    console.error("Accept beneficiary invitation error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/invitations/beneficiary/decline
router.post("/beneficiary/decline", publicInvitationLimiter, async (req: Request, res: Response) => {
  try {
    const { token } = declineBeneficiaryInvitationSchema.parse(req.body);

    const inv = await prisma.beneficiaryInvitation.findUnique({ where: { token } });
    if (!inv) return res.status(404).json({ error: "Invalid invitation token" });
    if (inv.status === "DECLINED") {
      return res.json({ message: "Invitation already declined" });
    }
    if (inv.status === "ACCEPTED") {
      return res.status(400).json({ error: "Invitation already accepted" });
    }

    await prisma.beneficiaryInvitation.update({
      where: { id: inv.id },
      data: { status: "DECLINED", respondedAt: new Date() },
    });

    res.json({ message: "Invitation declined" });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: firstZodError(err) });
    console.error("Decline invitation error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/invitations/beneficiary-admin?token=xxx — inspect an additional-admin invitation
router.get("/beneficiary-admin", publicInvitationLimiter, async (req: Request, res: Response) => {
  try {
    const { token } = invitationTokenQuerySchema.parse({
      token: typeof req.query.token === "string" ? req.query.token : undefined,
    });
    const invitation = await prisma.beneficiaryAdminInvitation.findUnique({
      where: { token: hashToken(token) },
      include: { beneficiary: { select: { name: true } } },
    });
    if (!invitation || invitation.status !== "PENDING") return res.status(404).json({ error: "Invitation not available" });
    if (invitation.expiresAt <= new Date()) {
      await prisma.beneficiaryAdminInvitation.update({ where: { id: invitation.id }, data: { status: "EXPIRED" } });
      return res.status(400).json({ error: "Invitation has expired" });
    }
    const existingAccount = await prisma.user.findUnique({ where: { email: invitation.email }, select: { id: true } });
    res.json({
      beneficiaryName: invitation.beneficiary.name,
      email: invitation.email,
      hasExistingAccount: !!existingAccount,
    });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: firstZodError(err) });
    console.error("Get beneficiary admin invitation error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/invitations/beneficiary-admin/accept — create a new additional-admin account
router.post("/beneficiary-admin/accept", publicInvitationLimiter, async (req: Request, res: Response) => {
  try {
    const data = acceptBeneficiaryAdminInvitationSchema.parse(req.body);
    const invitation = await prisma.beneficiaryAdminInvitation.findUnique({
      where: { token: hashToken(data.token) },
    });
    if (!invitation || invitation.status !== "PENDING") return res.status(404).json({ error: "Invitation not available" });
    if (invitation.expiresAt <= new Date()) {
      await prisma.beneficiaryAdminInvitation.update({ where: { id: invitation.id }, data: { status: "EXPIRED" } });
      return res.status(400).json({ error: "Invitation has expired" });
    }
    await requireOrgFeature(invitation.beneficiaryId, "multiAdminManagement");
    const existing = await prisma.user.findUnique({ where: { email: invitation.email }, select: { id: true } });
    if (existing) return res.status(409).json({ error: "An account already exists for this email. Sign in to accept the invitation." });

    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await prisma.$transaction(async (tx) => {
      const claimed = await tx.beneficiaryAdminInvitation.updateMany({
        where: { id: invitation.id, status: "PENDING", expiresAt: { gt: new Date() } },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });
      if (claimed.count !== 1) throw Object.assign(new Error("Invitation is no longer available"), { status: 409 });
      return tx.user.create({
        data: {
          email: invitation.email,
          passwordHash,
          name: data.name,
          role: "BENEFICIARY_ADMIN",
          beneficiaryId: invitation.beneficiaryId,
          beneficiaryAdminRole: "ADMIN",
          emailVerified: true,
          status: "ACTIVE",
        },
      });
    });
    const jwtToken = signUserToken(user);
    setAuthCookie(res, jwtToken, { persistent: true });
    res.status(201).json({
      token: jwtToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, beneficiaryId: user.beneficiaryId },
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: firstZodError(err) });
    if (err instanceof ForbiddenFeatureError) return sendForbiddenFeature(res, err);
    if (err?.status === 409 || err?.code === "P2002") return res.status(409).json({ error: "Invitation is no longer available or that account already exists" });
    console.error("Accept beneficiary admin invitation error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
