import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";

import prisma from "../lib/prisma";
import { authenticate, signToken, signUserToken, verifyToken } from "../middleware/auth";
import { setAuthCookie, clearAuthCookie } from "../lib/authCookies";
import { generateToken, hashToken } from "../lib/tokenHash";
import { encryptField, decryptField } from "../lib/fieldEncryption";
import {
  extractDomainFromWebsite,
  isPersonalEmailDomain,
  isQaSignupBypassEmail,
  normalizeEmail,
} from "../lib/signupEmailPolicy";
import { resolveSchoolFromUserAssociations, resolveSchoolIdFromUserAssociations } from "../lib/userAssociations";
import { createEmailSendRateLimit, createHybridRateLimit } from "../middleware/rateLimit";
import { isUniqueConstraintError } from "../lib/prismaErrors";
import { isInternalAdminUser } from "../lib/internalAdmin";
import { assertExactSchoolDomain, evaluateSessionEligibility } from "../lib/schoolAuthority";
import {
  firstZodError,
  opaqueIdSchema,
  optionalTrimmedString,
  strictObject,
  tokenSchema,
  trimmedString,
} from "../lib/validation";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  CLIENT_URL,
  getCapturedMailinatorInbox,
} from "../services/email";
import { isProdLike, isPubliclyDeployed } from "../lib/isProdLike";

const ENABLE_IMPERSONATION = process.env.ENABLE_IMPERSONATION === "true";

// Set ALLOW_PERSONAL_EMAIL_DOMAINS=true to bypass personal email domain restrictions (e.g. during testing).
const ALLOW_PERSONAL_EMAIL_DOMAINS = process.env.ALLOW_PERSONAL_EMAIL_DOMAINS === "true";
// Explicit opt-in for temporary QA aliases. Keep off by default so production-like
// environments do not silently allow personal Gmail signups.
const ALLOW_QA_SIGNUP_BYPASS = process.env.ALLOW_QA_SIGNUP_BYPASS === "true";

function normalizeRateLimitEmail(email: unknown): string {
  if (typeof email !== "string") return "unknown";
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return "unknown";
  return normalizeEmail(trimmed);
}

function emailRecipientRateLimitKey(email: unknown): string | null {
  const normalized = normalizeRateLimitEmail(email);
  return normalized === "unknown" ? null : normalized;
}

function getRequestUserAgent(req: Request): string {
  return (req.get("user-agent") || "unknown").trim().toLowerCase();
}

const schoolAuthSelect = {
  id: true,
  name: true,
  domain: true,
  verified: true,
  ownershipStatus: true,
  requiredHours: true,
  verificationStandard: true,
  zipCodes: true,
  address: true,
  city: true,
  state: true,
  zip: true,
  latitude: true,
  longitude: true,
  serviceStartDate: true,
  serviceEndDate: true,
  allowSelfSubmission: true,
  requireOrgVerification: true,
  categoryHourCaps: true,
  partnerInviteTemplate: true,
} as const;

// Limits for endpoints that trigger outbound email — the primary DDOS surface.
// Each limit is per IP address and resets on a rolling window.

function signupRateLimitChannel(req: Request): string {
  const origin = (req.get("origin") || "").trim().toLowerCase();
  const referer = (req.get("referer") || "").trim().toLowerCase();
  const fetchSite = (req.get("sec-fetch-site") || "").trim().toLowerCase();
  if (origin || referer || fetchSite) {
    return `origin:${origin || "none"}|referer:${referer || "none"}|sec-fetch-site:${fetchSite || "none"}`;
  }

  return "direct";
}

async function precheckDuplicateSignupEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const raw = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!raw) {
      return next();
    }
    const email = normalizeEmail(raw);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }
    next();
  } catch (err) {
    console.error("[signup] Duplicate precheck failed:", err);
    next();
  }
}

// Signup:
// - API/direct (non-browser): 5 accounts per IP/channel per hour
// - Interactive browser flow: higher threshold to avoid false positives
const signupLimiter = createHybridRateLimit({
  namespace: "signup",
  windowMs: 60 * 60 * 1000,
  maxPerIp: 5,
  keySuffix: (req) => `${getRequestUserAgent(req)}:${signupRateLimitChannel(req)}`,
  skipFailedRequests: true,
  // Allow authenticated users to create additional accounts during guided
  // onboarding/testing flows without tripping anonymous IP abuse limits.
  // Must verify the JWT signature — bare base64-decode allows forgery.
  skip: (req) => {
    const authHeader = req.get("authorization") || "";
    if (!/^Bearer\s+/i.test(authHeader)) return false;
    try {
      const token = authHeader.slice(7);
      const payload = verifyToken<{ userId?: string }>(token);
      return !!payload.userId;
    } catch {
      return false;
    }
  },
  failClosed: true,
  message: "Too many signup attempts from this IP. Please try again later.",
});

const signupEmailLimiter = createEmailSendRateLimit({
  namespace: "signup-verification",
  recipientKey: (req) => emailRecipientRateLimitKey(req.body?.email),
});

const forgotPasswordLimiter = createEmailSendRateLimit({
  namespace: "forgot-password",
  recipientKey: (req) => emailRecipientRateLimitKey(req.body?.email),
});

const resendVerificationLimiter = createEmailSendRateLimit({
  namespace: "resend-verification",
  recipientKey: (req) => emailRecipientRateLimitKey(req.body?.email),
});

// Login global IP window: 50 failed attempts per IP/UA per 15 minutes.
const loginIpLimiter = createHybridRateLimit({
  namespace: "login-ip",
  windowMs: 15 * 60 * 1000,
  maxPerIp: 50,
  keySuffix: getRequestUserAgent,
  skipSuccessfulRequests: true,
  failClosed: true,
  message: "Too many login attempts. Please try again in 15 minutes.",
});

// Login credential window: 8 failed attempts per IP/email pair per 15 minutes.
const loginLimiter = createHybridRateLimit({
  namespace: "login-credential",
  windowMs: 15 * 60 * 1000,
  maxPerIp: 8,
  keySuffix: (req) => normalizeRateLimitEmail(req.body?.email),
  skipSuccessfulRequests: true,
  failClosed: true,
  message: "Too many login attempts. Please try again in 15 minutes.",
});

const router = Router();
const publicAuthLimiter = createHybridRateLimit({
  namespace: "auth-public",
  windowMs: 15 * 60 * 1000,
  maxPerIp: 60,
  maxPerUser: 120,
});

const loginProfileInclude = {
  organization: true,
  school: { select: schoolAuthSelect },
  classroom: { include: { school: { select: schoolAuthSelect } } },
  cohort: { include: { school: { select: schoolAuthSelect } } },
  cohortMemberships: {
    where: { isActive: true },
    include: { cohort: { include: { school: { select: schoolAuthSelect } } } },
    orderBy: { updatedAt: "desc" },
  },
  createdSchools: {
    select: schoolAuthSelect,
    orderBy: { createdAt: "asc" },
    take: 1,
  },
  beneficiary: true,
} as const;

async function loadLoginProfile(userId: string) {
  try {
    return await prisma.user.findUnique({
      where: { id: userId },
      include: loginProfileInclude,
    });
  } catch (err) {
    console.warn("[auth] Login profile enrichment failed:", err);
    return null;
  }
}

function serializeCohortMemberships(
  memberships: Array<{ cohort?: { id: string; name: string; serviceEndDate: Date | null } | null; source: string }> | null | undefined,
) {
  return (memberships ?? [])
    .filter((membership): membership is { cohort: { id: string; name: string; serviceEndDate: Date | null }; source: string } => Boolean(membership?.cohort))
    .map((membership) => ({
      id: membership.cohort.id,
      name: membership.cohort.name,
      source: membership.source,
      serviceEndDate: membership.cohort.serviceEndDate,
    }));
}

function buildLoginUserPayload(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
  organizationId: string | null;
  schoolId: string | null;
  classroomId: string | null;
  cohortId: string | null;
  beneficiaryId: string | null;
}, profile: Awaited<ReturnType<typeof loadLoginProfile>> | null) {
  const enriched = profile ?? null;
  const enrichedUser = enriched as (typeof enriched & {
    phone?: string | null;
    grade?: string | null;
    house?: string | null;
    bio?: string | null;
    avatarUrl?: string | null;
    socialLinks?: string | null;
    notificationPreferences?: string | null;
    messagePreferences?: string | null;
  }) | null;
  let studentSchool = null;
  let schoolId = user.schoolId;

  try {
    studentSchool = enriched ? resolveSchoolFromUserAssociations(enriched) : null;
    schoolId = enriched ? resolveSchoolIdFromUserAssociations(enriched) : user.schoolId;
  } catch (err) {
    console.warn("[auth] Failed to resolve school associations for login payload:", err);
  }

  let socialLinks = null;
  let notificationPreferences = null;
  let messagePreferences = null;

  try {
    socialLinks = enrichedUser?.socialLinks ? JSON.parse(enrichedUser.socialLinks) : null;
  } catch (err) {
    console.warn("[auth] Failed to parse social links for login payload:", err);
  }

  try {
    notificationPreferences = enrichedUser?.notificationPreferences
      ? JSON.parse(enrichedUser.notificationPreferences)
      : null;
  } catch (err) {
    console.warn("[auth] Failed to parse notification preferences for login payload:", err);
  }

  try {
    messagePreferences = enrichedUser?.messagePreferences
      ? JSON.parse(enrichedUser.messagePreferences)
      : null;
  } catch (err) {
    console.warn("[auth] Failed to parse message preferences for login payload:", err);
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isInternalAdmin: isInternalAdminUser(user),
    emailVerified: user.emailVerified,
    phone: enrichedUser?.phone ? decryptField(enrichedUser.phone) : undefined,
    grade: enrichedUser?.grade ?? undefined,
    house: enrichedUser?.house ?? undefined,
    bio: enrichedUser?.bio ?? undefined,
    avatarUrl: enrichedUser?.avatarUrl ?? null,
    socialLinks,
    notificationPreferences,
    messagePreferences,
    organizationId: user.organizationId,
    organization: enriched?.organization ?? null,
    schoolId,
    school: studentSchool,
    classroomId: user.classroomId,
    classroom: enriched?.classroom ?? null,
    cohortId: user.cohortId,
    cohort: enriched?.cohort ?? null,
    cohorts: serializeCohortMemberships(enriched?.cohortMemberships),
    beneficiaryId: user.beneficiaryId,
    beneficiary: enriched?.beneficiary ?? null,
  };
}

async function safeBcryptCompare(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch (err) {
    console.warn("[auth] bcrypt compare failed for stored password hash:", err);
    return false;
  }
}


if (!isPubliclyDeployed()) {
  router.get("/__test-email", publicAuthLimiter, (req: Request, res: Response) => {
    const inbox = String(req.query.inbox || "").trim().toLowerCase();
    if (!/^[a-z0-9._-]+$/.test(inbox)) {
      return res.status(400).json({ error: "Valid inbox query param is required" });
    }

    const messages = getCapturedMailinatorInbox(inbox);
    res.json({ inbox, messages });
  });
}

// Only SCHOOL_ADMIN can self-register. Students and Beneficiary admins must use invitation flows.
const VALID_ROLES = ["SCHOOL_ADMIN"] as const;

const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .max(128)
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^a-zA-Z0-9]/, "Password must contain at least one special character");

// School admin self-signup schema — students/beneficiaries use invitation flows
const signupSchema = strictObject({
  email: z.string().trim().toLowerCase().email().max(255),
  password: passwordSchema,
  name: trimmedString(255, 1),
  role: z.enum(VALID_ROLES),
  schoolName: optionalTrimmedString(255),
  schoolDomain: optionalTrimmedString(255),
  directorySchoolId: opaqueIdSchema.optional(), // SchoolDirectory.id if chosen from directory
  zipCodes: z.array(z.string().trim().regex(/^\d{5}$/, "Invalid ZIP code")).max(50).optional(),
});

const loginSchema = strictObject({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(1).max(128),
});

const passwordChangeSchema = strictObject({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

const emailTokenQuerySchema = strictObject({
  token: tokenSchema,
});

const forgotPasswordSchema = strictObject({
  email: z.string().trim().toLowerCase().email().max(255),
});

const resetPasswordSchema = strictObject({
  token: tokenSchema,
  password: passwordSchema,
});

const messagePreferenceSchema = strictObject({
  allowFrom: z.enum(["EVERYONE", "ORGS_ONLY", "ADMINS_ONLY"]).optional(),
  profileVisibility: z.enum(["EVERYONE", "SCHOOL", "PRIVATE"]).optional(),
});

const profileSchema = strictObject({
  name: optionalTrimmedString(255, 1),
  phone: optionalTrimmedString(20),
  grade: optionalTrimmedString(50),
  notificationPreferences: z.record(
    z.string().trim().min(1).max(64),
    strictObject({
      email: z.boolean(),
      inApp: z.boolean(),
    })
  ).optional(),
  messagePreferences: messagePreferenceSchema.optional(),
});

// POST /api/auth/signup
// Rate limiters run before the duplicate-email precheck so the 409 response
// cannot be used for unthrottled account enumeration.
router.post("/signup", publicAuthLimiter, signupLimiter, signupEmailLimiter, precheckDuplicateSignupEmail, async (req: Request, res: Response) => {
  let signupStage = "parse";
  try {
    const data = signupSchema.parse(req.body);
    data.email = normalizeEmail(data.email);
    const isQaBypass = isQaSignupBypassEmail(data.email, ALLOW_QA_SIGNUP_BYPASS);

    if (isProdLike() && !ALLOW_PERSONAL_EMAIL_DOMAINS && !isQaBypass) {
      if (isPersonalEmailDomain(data.email)) {
        return res.status(403).json({ error: "Personal email addresses are not allowed. Please use your school's official email address." });
      }
    }

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    // Generate email verification token — only the hash is stored
    const emailVerificationToken = generateToken();
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const directorySchool = data.directorySchoolId
      ? await prisma.schoolDirectory.findUnique({
          where: { id: data.directorySchoolId },
          select: {
            id: true,
            name: true,
            type: true,
            address: true,
            city: true,
            state: true,
            zip: true,
            latitude: true,
            longitude: true,
            emailDomain: true,
            website: true,
            claimed: true,
          },
        })
      : null;

    if (data.directorySchoolId) {
      const existingSchool = await prisma.school.findFirst({
        where: { directoryId: data.directorySchoolId },
        include: { createdBy: { select: { email: true } } },
      });
      if (directorySchool?.claimed || existingSchool) {
        return res.status(409).json({
          error: "This school is already registered.",
          contactEmail: existingSchool?.registrationEmail || existingSchool?.createdBy?.email || null,
        });
      }
      if (!directorySchool) {
        return res.status(400).json({
          error: "Selected school is no longer available. Please search again.",
        });
      }
    }

    const approvedDirectoryDomain = directorySchool?.emailDomain ||
      (directorySchool?.website ? extractDomainFromWebsite(directorySchool.website) : null);
    if (approvedDirectoryDomain && (isProdLike() || !ALLOW_PERSONAL_EMAIL_DOMAINS) && !isQaBypass) {
      try {
        assertExactSchoolDomain(data.email, approvedDirectoryDomain);
      } catch {
        return res.status(403).json({
          error: `Email domain does not match the school's domain (${approvedDirectoryDomain}). Please use your school email address.`,
          code: "SCHOOL_DOMAIN_MISMATCH",
        });
      }
    }

    const schoolName = directorySchool?.name || data.schoolName || data.name;
    const schoolDomain = directorySchool?.emailDomain || data.schoolDomain || null;

    signupStage = "transaction.pending-authority";
    let user: {
      id: string;
      email: string;
      name: string;
      role: string;
    };
    let schoolId: string;
    try {
      const created = await prisma.$transaction(async (tx) => {
        const txUser = await tx.user.create({
          data: {
            email: data.email,
            passwordHash,
            name: data.name,
            role: data.role,
            emailVerified: false,
            emailVerificationToken: hashToken(emailVerificationToken),
            emailVerificationExpires,
          },
          select: { id: true, email: true, name: true, role: true },
        });

        const txSchool = await tx.school.create({
          data: {
            name: schoolName,
            verified: false,
            ownershipStatus: "PENDING",
            registrationEmail: data.email,
            createdById: txUser.id,
            domain: schoolDomain || undefined,
            directoryId: data.directorySchoolId || undefined,
            type: directorySchool?.type || undefined,
            address: directorySchool?.address || undefined,
            city: directorySchool?.city || undefined,
            state: directorySchool?.state || undefined,
            zip: directorySchool?.zip || undefined,
            latitude: directorySchool?.latitude ?? undefined,
            longitude: directorySchool?.longitude ?? undefined,
            zipCodes: data.zipCodes ? JSON.stringify(data.zipCodes) : undefined,
          },
          select: { id: true },
        });

        await tx.user.update({
          where: { id: txUser.id },
          data: { schoolId: txSchool.id },
        });

        return { user: txUser, schoolId: txSchool.id };
      });
      user = created.user;
      schoolId = created.schoolId;
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        return res.status(409).json({ error: "Email or school is already registered" });
      }
      throw err;
    }

    const verificationUrl = `${CLIENT_URL}/verify-email?token=${emailVerificationToken}`;

    // Send verification email — awaited so it completes before Lambda returns.
    // Errors are caught and logged but signup still succeeds.
    try {
      await sendVerificationEmail(user.email, verificationUrl);
    } catch (emailErr) {
      console.error("[signup] Failed to send verification email:", emailErr);
    }

    res.status(201).json({
      requiresEmailVerification: true,
      requiresSchoolOwnershipReview: true,
      ownershipStatus: "PENDING",
      email: user.email,
      schoolApplicationId: schoolId,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: firstZodError(err) });
    }
    console.error("Signup error:", err, { signupStage });
    const errorCode = typeof err === "object" && err && "code" in err ? String((err as any).code) : undefined;
    const errorMeta = typeof err === "object" && err && "meta" in err ? (err as any).meta : undefined;
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/login
router.post("/login", publicAuthLimiter, loginIpLimiter, loginLimiter, async (req: Request, res: Response) => {
  try {
    const data = loginSchema.parse(req.body);
    data.email = normalizeEmail(data.email);

    const user = await prisma.user.findUnique({
      where: { email: data.email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        passwordHash: true,
        emailVerified: true,
        organizationId: true,
        schoolId: true,
        classroomId: true,
        cohortId: true,
        beneficiaryId: true,
        tokenVersion: true,
        school: {
          select: { verified: true, ownershipStatus: true },
        },
      },
    });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    if (user.status !== "ACTIVE") {
      return res.status(403).json({ error: "Account is " + user.status.toLowerCase() });
    }

    if (!user.passwordHash) {
      // Generic message — a distinct response would confirm the account exists
      // and reveal its sign-in method to unauthenticated callers.
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const valid = await safeBcryptCompare(data.password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const eligibility = evaluateSessionEligibility({
      ...user,
      isInternalAdmin: isInternalAdminUser(user),
    });
    if (eligibility.allowed === false) {
      return res.status(eligibility.status).json({
        error: eligibility.error,
        code: eligibility.code,
      });
    }

    const token = signUserToken(user);
    setAuthCookie(res, token, { persistent: true });

    const profile = await loadLoginProfile(user.id);
    const payload = buildLoginUserPayload(user, profile);

    res.json({
      token,
      user: payload,
    });

  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: firstZodError(err) });
    }
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/logout — clears the HttpOnly session cookie. Client-side
// storage (cached user profile) is cleared separately by the caller; an
// HttpOnly cookie can only be cleared by the server.
router.post("/logout", async (_req: Request, res: Response) => {
  clearAuthCookie(res);
  res.status(204).send();
});

const sessionPrefSchema = z.object({ persistent: z.boolean() });

// POST /api/auth/session-pref — re-issues the session cookie with the
// requested persistence ("remember me" vs. session-only), without
// requiring the caller to log in again. Mirrors the client's session
// preference toggle (see SessionPrefBanner.tsx).
router.post("/session-pref", authenticate, async (req: Request, res: Response) => {
  try {
    const { persistent } = sessionPrefSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, email: true, role: true, tokenVersion: true },
    });
    if (!user) return res.status(401).json({ error: "Invalid or expired token" });
    setAuthCookie(res, signUserToken(user), { persistent });
    res.status(204).send();
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: firstZodError(err) });
    }
    console.error("Session pref error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/auth/me
router.get("/me", authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        grade: true,
        house: true,
        status: true,
        emailVerified: true,
        organizationId: true,
        schoolId: true,
        classroomId: true,
        cohortId: true,
        beneficiaryId: true,
      },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    const profile = await loadLoginProfile(user.id);
    const payload = buildLoginUserPayload(user, profile);

    res.json({
      ...payload,
      phone: decryptField(user.phone),
      grade: user.grade,
      house: user.house,
      status: user.status,
      isInternalAdmin: isInternalAdminUser(user),
    });

  } catch (err) {
    console.error("Me error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/auth/password
router.put("/password", authenticate, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = passwordChangeSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.passwordHash) {
      return res.status(400).json({ error: "This account uses Google Sign-In. Password cannot be changed here." });
    }
    const valid = await safeBcryptCompare(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    // Bump tokenVersion so every outstanding JWT is revoked, then issue a
    // fresh token so the current session stays signed in.
    const updated = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { passwordHash, tokenVersion: { increment: 1 } },
    });

    const refreshedToken = signUserToken(updated);
    setAuthCookie(res, refreshedToken, { persistent: true });
    res.json({ message: "Password changed successfully", token: refreshedToken });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: firstZodError(err) });
    }
    console.error("Password change error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/auth/profile
router.put("/profile", authenticate, async (req: Request, res: Response) => {
  try {
    const data = profileSchema.parse(req.body);
    const updateData: any = {
      name: data.name,
      phone: data.phone !== undefined ? encryptField(data.phone) : undefined,
      grade: data.grade,
    };
    if (data.notificationPreferences !== undefined) {
      updateData.notificationPreferences = JSON.stringify(data.notificationPreferences);
    }
    if (data.messagePreferences !== undefined) {
      updateData.messagePreferences = JSON.stringify(data.messagePreferences);
    }
    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: updateData,
      select: {
        id: true, email: true, name: true, role: true, phone: true,
        grade: true, house: true, status: true, emailVerified: true,
        schoolId: true, cohortId: true, beneficiaryId: true, organizationId: true,
        createdAt: true, updatedAt: true,
      },
    });
    res.json({ ...user, phone: decryptField(user.phone) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: firstZodError(err) });
    }
    console.error("Profile update error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/auth/verify-email?token=xxx
router.get("/verify-email", publicAuthLimiter, async (req: Request, res: Response) => {
  try {
    const { token } = emailTokenQuerySchema.parse({
      token: typeof req.query.token === "string" ? req.query.token : undefined,
    });

    const tokenDigest = hashToken(token);
    const user = await prisma.$transaction(async (tx) => {
      const candidate = await tx.user.findFirst({
        where: {
          emailVerificationToken: tokenDigest,
          emailVerificationExpires: { gt: new Date() },
          emailVerified: false,
        },
        select: { id: true, role: true, schoolId: true },
      });
      if (!candidate) return null;

      const consumed = await tx.user.updateMany({
        where: {
          id: candidate.id,
          emailVerificationToken: tokenDigest,
          emailVerificationExpires: { gt: new Date() },
          emailVerified: false,
        },
        data: {
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpires: null,
        },
      });
      if (consumed.count !== 1) return null;

      if (candidate.role === "SCHOOL_ADMIN" && candidate.schoolId) {
        await tx.school.updateMany({
          where: { id: candidate.schoolId, ownershipStatus: "PENDING" },
          data: { ownershipEvidenceVerifiedAt: new Date() },
        });
      }

      return candidate;
    });

    if (!user) {
      return res.status(400).json({ error: "Invalid or expired verification token" });
    }

    res.json({
      message: "Email verified successfully",
      requiresSchoolOwnershipReview: user.role === "SCHOOL_ADMIN",
      ownershipStatus: user.role === "SCHOOL_ADMIN" ? "PENDING" : undefined,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: firstZodError(err) });
    }
    console.error("Email verification error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/resend-verification — public and enumeration-resistant because
// pending users intentionally do not possess an application session.
router.post("/resend-verification", publicAuthLimiter, resendVerificationLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    const normalizedEmail = normalizeEmail(email);
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (user && !user.emailVerified) {
      const emailVerificationToken = generateToken();
      const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerificationToken: hashToken(emailVerificationToken), emailVerificationExpires },
      });

      const verificationUrl = `${CLIENT_URL}/verify-email?token=${emailVerificationToken}`;
      try {
        await sendVerificationEmail(user.email, verificationUrl);
      } catch (emailErr) {
        console.error("[resend-verification] Failed to send verification email:", emailErr);
      }
    }

    res.json({ message: "If an unverified account exists, a verification email has been sent." });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: firstZodError(err, "Valid email is required") });
    }
    console.error("Resend verification error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/forgot-password
router.post("/forgot-password", publicAuthLimiter, forgotPasswordLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = forgotPasswordSchema.parse(req.body);
    const email = normalizeEmail(parsed.email);
    const user = await prisma.user.findUnique({ where: { email } });

    // Always respond with success to prevent user enumeration
    if (user) {
      const resetToken = generateToken();
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.user.update({
        where: { id: user.id },
        data: { passwordResetToken: hashToken(resetToken), passwordResetExpires: resetExpires },
      });

      const resetLink = `${CLIENT_URL}/reset-password?token=${resetToken}`;
      try {
        await sendPasswordResetEmail(user.email, resetLink);
      } catch (emailErr) {
        console.error("[forgot-password] Failed to send reset email:", emailErr);
      }
    }

    res.json({ message: "If an account with that email exists, a password reset link has been sent." });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: firstZodError(err, "Valid email is required") });
    }
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/reset-password
router.post("/reset-password", publicAuthLimiter, async (req: Request, res: Response) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);

    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: hashToken(token),
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    // tokenVersion bump revokes every JWT issued before the reset —
    // a stolen session cannot outlive a password reset.
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
        tokenVersion: { increment: 1 },
      },
    });

    res.json({ message: "Password reset successfully" });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: firstZodError(err) });
    }
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/auth/account — permanently delete the current user's account and all their data
router.delete("/account", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, schoolId: true, beneficiaryId: true, organizationId: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    await prisma.$transaction(async (tx) => {
      const deleteUserServiceSessionAuditLogs = async () => {
        const sessions = await tx.serviceSession.findMany({
          where: { userId },
          select: { id: true },
        });
        if (sessions.length > 0) {
          await tx.auditLog.deleteMany({ where: { sessionId: { in: sessions.map((session) => session.id) } } });
        }
      };

      const deleteUserBeneficiaryAuditLogs = async () => {
        const signups = await tx.beneficiarySignup.findMany({
          where: { studentId: userId },
          select: { id: true },
        });
        if (signups.length > 0) {
          await tx.beneficiaryAuditLog.deleteMany({ where: { signupId: { in: signups.map((signup) => signup.id) } } });
        }
      };

      const deleteInterventionMessagesForCampaigns = async (campaignIds: string[]) => {
        if (campaignIds.length === 0) return;
        const recipients = await tx.interventionRecipient.findMany({
          where: { campaignId: { in: campaignIds } },
          select: { messageId: true },
        });
        const messageIds = recipients
          .map((recipient) => recipient.messageId)
          .filter((messageId): messageId is string => Boolean(messageId));
        await tx.interventionCampaign.deleteMany({ where: { id: { in: campaignIds } } });
        if (messageIds.length > 0) {
          await tx.message.deleteMany({ where: { id: { in: messageIds } } });
        }
      };

      const deleteSchoolData = async (schoolId: string) => {
        const cohorts = await tx.cohort.findMany({
          where: { schoolId },
          select: { id: true },
        });
        const cohortIds = cohorts.map((cohort) => cohort.id);

        const invitations = cohortIds.length > 0
          ? await tx.studentInvitation.findMany({
              where: { cohortId: { in: cohortIds } },
              select: { id: true },
            })
          : [];
        const invitationIds = invitations.map((invitation) => invitation.id);

        const schoolCampaigns = await tx.interventionCampaign.findMany({
          where: { schoolId },
          select: { id: true },
        });

        await deleteInterventionMessagesForCampaigns(schoolCampaigns.map((campaign) => campaign.id));
        await tx.interventionCase.deleteMany({ where: { schoolId } });
        await tx.schoolLaunchBug.deleteMany({ where: { schoolId } });
        await tx.selfSubmittedRequest.deleteMany({ where: { schoolId } });
        await tx.beneficiaryInvitation.deleteMany({ where: { schoolId } });
        await tx.schoolBeneficiaryApproval.deleteMany({ where: { schoolId } });
        await tx.schoolOrganization.deleteMany({ where: { schoolId } });
        await tx.verifiedDomain.deleteMany({ where: { schoolId } });
        await tx.integrationSyncError.deleteMany({ where: { schoolId } });
        await tx.integrationSyncJob.deleteMany({ where: { schoolId } });
        await tx.integrationExternalMapping.deleteMany({ where: { schoolId } });
        await tx.integrationConnection.deleteMany({ where: { schoolId } });
        await tx.dataAccessLog.deleteMany({ where: { schoolId } });

        if (cohortIds.length > 0) {
          await tx.integrationExternalMapping.deleteMany({
            where: {
              OR: [
                { localType: "Cohort", localId: { in: cohortIds } },
                { localType: "StudentInvitation", localId: { in: invitationIds } },
              ],
            },
          });
          await tx.cohortTeacherAssignment.deleteMany({ where: { cohortId: { in: cohortIds } } });
          await tx.studentCohortMembership.deleteMany({ where: { cohortId: { in: cohortIds } } });
          await tx.studentInvitation.deleteMany({ where: { cohortId: { in: cohortIds } } });
          await tx.user.updateMany({
            where: { cohortId: { in: cohortIds } },
            data: { cohortId: null },
          });
          await tx.cohort.deleteMany({ where: { id: { in: cohortIds } } });
        }

        const classrooms = await tx.classroom.findMany({
          where: { schoolId },
          select: { id: true },
        });
        if (classrooms.length > 0) {
          await tx.user.updateMany({
            where: { classroomId: { in: classrooms.map((classroom) => classroom.id) } },
            data: { classroomId: null },
          });
        }
        await tx.classroom.deleteMany({ where: { schoolId } });

        const groups = await tx.studentGroup.findMany({ where: { schoolId }, select: { id: true } });
        if (groups.length > 0) {
          await tx.studentGroupMember.deleteMany({ where: { groupId: { in: groups.map((group) => group.id) } } });
          await tx.studentGroup.deleteMany({ where: { schoolId } });
        }

        await tx.user.updateMany({
          where: { schoolId, id: { not: userId } },
          data: { classroomId: null, cohortId: null, schoolId: null },
        });

        await tx.school.delete({ where: { id: schoolId } });
      };

      // Delete audit logs created by this user
      await tx.auditLog.deleteMany({ where: { actorId: userId } });
      await deleteUserServiceSessionAuditLogs();
      await deleteUserBeneficiaryAuditLogs();

      // Delete personal data
      await tx.dataAccessLog.deleteMany({ where: { actorId: userId } });
      await tx.notification.deleteMany({ where: { userId } });
      await tx.savedOpportunity.deleteMany({ where: { userId } });
      await tx.studentGroupMember.deleteMany({ where: { studentId: userId } });
      await tx.selfSubmittedRequest.deleteMany({ where: { studentId: userId } });
      await tx.cohortTeacherAssignment.deleteMany({ where: { teacherId: userId } });
      await tx.studentCohortMembership.deleteMany({ where: { studentId: userId } });
      await tx.interventionCase.deleteMany({ where: { studentId: userId } });
      await tx.interventionCase.updateMany({
        where: { ownerId: userId },
        data: { ownerId: null },
      });
      const userCampaigns = await tx.interventionCampaign.findMany({
        where: { actorId: userId },
        select: { id: true },
      });
      await deleteInterventionMessagesForCampaigns(userCampaigns.map((campaign) => campaign.id));
      await tx.interventionRecipient.deleteMany({ where: { studentId: userId } });
      await tx.message.deleteMany({ where: { OR: [{ senderId: userId }, { receiverId: userId }] } });
      await tx.beneficiarySignup.deleteMany({ where: { studentId: userId } });
      await tx.signup.deleteMany({ where: { userId } });
      await tx.serviceSession.deleteMany({ where: { userId } });
      if (user.role === "SCHOOL_ADMIN" && user.schoolId) {
        await deleteSchoolData(user.schoolId);
      }

      // Delete the user
      await tx.user.delete({ where: { id: userId } });
    });

    res.json({ message: "Account permanently deleted" });
  } catch (err) {
    console.error("Delete account error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/set-graduation-goal — school admin sets graduation hours goal after setup
router.post("/set-graduation-goal", authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user?.schoolId) return res.status(400).json({ error: "Not associated with a school" });
    if (!["SCHOOL_ADMIN"].includes(user.role)) {
      return res.status(403).json({ error: "Not a school admin" });
    }

    const { requiredHours } = z.object({ requiredHours: z.number().min(1).max(1000) }).parse(req.body);

    const school = await prisma.school.update({
      where: { id: user.schoolId },
      data: { requiredHours },
      select: { id: true, name: true, requiredHours: true },
    });

    res.json(school);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.errors });
    }
    console.error("Set graduation goal error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

if (!isPubliclyDeployed() && ENABLE_IMPERSONATION) {
  // POST /api/auth/dev/bypass-email-verification — DEV ONLY — mark current user's email as verified
  router.post("/dev/bypass-email-verification", authenticate, async (req: Request, res: Response) => {
    try {
      const user = await prisma.user.update({
        where: { id: req.user!.userId },
        data: { emailVerified: true, emailVerificationToken: null, emailVerificationExpires: null },
      });

      res.json({ message: "Email verification bypassed", emailVerified: true, userId: user.id });
    } catch (err) {
      console.error("Dev bypass verification error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/auth/impersonate — DEV ONLY — log in as any user without password
  router.post("/impersonate", authenticate, async (req: Request, res: Response) => {
    try {
      const { targetEmail } = z.object({ targetEmail: z.string().email() }).parse(req.body);

      const actor = await prisma.user.findUnique({ where: { id: req.user!.userId } });
      if (!actor || actor.role !== "SCHOOL_ADMIN") {
        return res.status(403).json({ error: "Only admins may impersonate users" });
      }

      const target = await prisma.user.findUnique({
        where: { email: targetEmail },
        include: {
          school: { select: schoolAuthSelect },
          cohort: { include: { school: { select: schoolAuthSelect } } },
          cohortMemberships: {
            where: { isActive: true },
            include: { cohort: { include: { school: { select: schoolAuthSelect } } } },
            orderBy: { updatedAt: "desc" },
          },
          beneficiary: true,
        },
      });
      if (!target) return res.status(404).json({ error: "User not found" });

      console.warn(`[IMPERSONATION] ${actor.email} (${actor.id}) impersonated ${target.email} (${target.id}) at ${new Date().toISOString()}`);

      // FERPA audit log for impersonation access
      try {
        await prisma.dataAccessLog.create({
          data: {
            actorId: actor.id,
            action: "IMPERSONATE_USER",
            targetType: "user",
            targetId: target.id,
            details: JSON.stringify({
              actorEmail: actor.email,
              targetEmail: target.email,
              targetRole: target.role,
              timestamp: new Date().toISOString(),
            }),
          },
        });
      } catch (logErr) {
        console.error("[FERPA] Failed to log impersonation access:", logErr);
      }

      const token = signUserToken(target);
      // Session-only cookie for impersonation — don't leave a long-lived
      // cookie behind for a temporarily-assumed identity.
      setAuthCookie(res, token, { persistent: false });

      const studentSchool = resolveSchoolFromUserAssociations(target);
      const schoolId = resolveSchoolIdFromUserAssociations(target);

      res.json({
        token,
        impersonated: true,
        actor: { id: actor.id, email: actor.email },
        user: {
          id: target.id,
          email: target.email,
          name: target.name,
          role: target.role,
          emailVerified: target.emailVerified,
          schoolId,
          school: studentSchool,
          cohortId: target.cohortId,
          cohort: target.cohort,
          cohorts: target.cohortMemberships.map((membership) => ({
            id: membership.cohort.id,
            name: membership.cohort.name,
            source: membership.source,
            serviceEndDate: membership.cohort.serviceEndDate,
          })),
          beneficiaryId: target.beneficiaryId,
          beneficiary: target.beneficiary,
        },
      });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
      console.error("Impersonation error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
} else if (!isPubliclyDeployed() && !ENABLE_IMPERSONATION) {
  console.warn("[Auth] Dev impersonation routes disabled. Set ENABLE_IMPERSONATION=true to enable.");
}

export default router;
