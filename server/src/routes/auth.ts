import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import prisma from "../lib/prisma";
import { authenticate, signToken } from "../middleware/auth";
import { encryptField, decryptField } from "../lib/fieldEncryption";
import { linkSchoolToBeneficiaryDirectory } from "../lib/schoolBeneficiaryLink";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  CLIENT_URL,
  getCapturedMailinatorInbox,
} from "../services/email";

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

function isInteractiveSignupRequest(req: Request): boolean {
  const fetchSite = (req.get("sec-fetch-site") || "").trim().toLowerCase();
  const fetchMode = (req.get("sec-fetch-mode") || "").trim().toLowerCase();
  const origin = (req.get("origin") || "").trim().toLowerCase();
  const referer = (req.get("referer") || "").trim().toLowerCase();

  if (fetchSite === "same-origin" || fetchSite === "same-site") return true;
  if (fetchMode === "cors" && (origin.includes("localhost:5173") || origin.includes("goodhours.app"))) return true;
  if (referer.includes("/signup")) return true;
  return false;
}

async function precheckDuplicateSignupEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!email) {
      return next();
    }
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
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  // Browser-driven signup flows use a separate, higher-capacity bucket to avoid
  // colliding with API-level abuse checks from non-browser contexts.
  max: (req) => (isInteractiveSignupRequest(req) ? 100 : 5),
  keyGenerator: (req) =>
    `${ipKeyGenerator(req.ip || "")}:${req.get("user-agent") || "unknown"}:${signupRateLimitChannel(req)}`,
  skipFailedRequests: true,
  // Allow authenticated users to create additional accounts during guided
  // onboarding/testing flows without tripping anonymous IP abuse limits.
  skip: (req) => {
    const authHeader = req.get("authorization") || "";
    if (/^Bearer\s+/i.test(authHeader)) return true;
    const cookieHeader = req.headers.cookie || "";
    return /(?:^|;\s*)token=/.test(cookieHeader);
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many signup attempts from this IP. Please try again later." },
});

// Forgot-password: 5 requests per IP per 15 minutes
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many password reset requests from this IP. Please try again later." },
});

// Resend-verification: 3 requests per IP per hour
const resendVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many resend requests from this IP. Please try again later." },
});

// Login: 10 attempts per IP per 15 minutes — prevents brute-force of passwords.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again in 15 minutes." },
});

const router = Router();

router.get("/__test-email", (req: Request, res: Response) => {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    return res.status(404).json({ error: "Not found" });
  }

  const inbox = String(req.query.inbox || "").trim().toLowerCase();
  if (!/^[a-z0-9._-]+$/.test(inbox)) {
    return res.status(400).json({ error: "Valid inbox query param is required" });
  }

  const messages = getCapturedMailinatorInbox(inbox);
  res.json({ inbox, messages });
});

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
const signupSchema = z.object({
  email: z.string().email().max(255),
  password: passwordSchema,
  name: z.string().min(1).max(255),
  role: z.enum(VALID_ROLES),
  schoolName: z.string().max(255).optional(),
  schoolDomain: z.string().max(255).optional(),
  directorySchoolId: z.string().optional(), // SchoolDirectory.id if chosen from directory
  zipCodes: z.array(z.string().regex(/^\d{5}$/, "Invalid ZIP code")).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com",
  "yahoo.com", "ymail.com", "yahoo.co.uk", "yahoo.co.in", "yahoo.com.au",
  "yahoo.fr", "yahoo.de", "yahoo.es", "yahoo.it", "yahoo.ca",
  "hotmail.com", "outlook.com", "live.com", "msn.com",
  "hotmail.co.uk", "hotmail.fr", "hotmail.de", "hotmail.es",
  "live.co.uk", "live.fr",
  "icloud.com", "me.com", "mac.com",
  "aol.com", "aim.com", "verizon.net",
  "protonmail.com", "pm.me", "proton.me",
  "tutanota.com", "tuta.com",
  "gmx.com", "gmx.net", "mail.com",
  "zoho.com", "zohomail.com",
  "yandex.com", "yandex.ru",
  "qq.com", "163.com", "126.com",
  "mail.ru", "inbox.com", "rediffmail.com",
  "comcast.net", "att.net", "sbcglobal.net", "cox.net",
]);

function isPersonalEmailDomain(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase().trim() || "";
  return PERSONAL_EMAIL_DOMAINS.has(domain);
}

/** Strips https://, http://, www. and any path/query from a URL to get the bare domain. */
export function extractDomainFromWebsite(website: string): string | null {
  if (!website?.trim()) return null;
  try {
    let url = website.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) url = "https://" + url;
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Returns true if emailDomain matches or is a subdomain of websiteDomain. */
function emailDomainMatchesWebsite(emailDomain: string, websiteDomain: string): boolean {
  return emailDomain === websiteDomain || emailDomain.endsWith("." + websiteDomain);
}

// POST /api/auth/signup
router.post("/signup", precheckDuplicateSignupEmail, signupLimiter, async (req: Request, res: Response) => {
  try {
    const data = signupSchema.parse(req.body);

    if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
      if (isPersonalEmailDomain(data.email)) {
        return res.status(403).json({ error: "Personal email addresses are not allowed. Please use your school's official email address." });
      }
    }

    // If a directory school was selected, validate email domain against its known domain
    if (data.role === "SCHOOL_ADMIN" && data.directorySchoolId) {
      const dirEntry = await prisma.schoolDirectory.findUnique({
        where: { id: data.directorySchoolId },
        select: { emailDomain: true, website: true },
      });
      // Prefer the explicit emailDomain field; fall back to parsing the website URL
      const schoolDomain = dirEntry?.emailDomain || (dirEntry?.website ? extractDomainFromWebsite(dirEntry.website) : null);
      if (schoolDomain) {
        const emailDomain = data.email.split("@")[1]?.toLowerCase().trim() || "";
        const isEdu = emailDomain.endsWith(".edu");
        if (!isEdu && !emailDomainMatchesWebsite(emailDomain, schoolDomain)) {
          return res.status(403).json({
            error: `Email domain does not match the school's domain (${schoolDomain}). Please use your school email address.`,
          });
        }
      }
    }

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    let schoolId: string | undefined;

    // Generate email verification token
    const emailVerificationToken = crypto.randomBytes(32).toString("hex");
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create the user first (school creation needs user id)
    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name,
        role: data.role,
        emailVerified: false,
        emailVerificationToken,
        emailVerificationExpires,
      },
    });

    // If signing up as a school admin, create the school and link
    if (data.role === "SCHOOL_ADMIN") {
      const school = await prisma.school.create({
        data: {
          name: data.schoolName || data.name,
          domain: data.schoolDomain || undefined,
          directoryId: data.directorySchoolId || null,
          verified: false,
          createdById: user.id,
          zipCodes: data.zipCodes ? JSON.stringify(data.zipCodes) : null,
        },
      });
      schoolId = school.id;

      // Create a default "General" classroom
      const inviteCode = crypto.randomBytes(4).toString("hex");
      await prisma.classroom.create({
        data: {
          name: "General",
          schoolId: school.id,
          teacherId: user.id,
          inviteCode,
        },
      });

      // Associate the admin with their school
      await prisma.user.update({
        where: { id: user.id },
        data: { schoolId: school.id },
      });

      // Auto-create a private beneficiary for this school so students can sign up for school-run opportunities
      const schoolBeneficiary = await prisma.beneficiary.create({
        data: {
          name: school.name,
          visibility: "PRIVATE",
          status: "ACTIVE",
          createdBySchoolId: school.id,
        },
      });
      await prisma.schoolBeneficiaryApproval.create({
        data: {
          schoolId: school.id,
          beneficiaryId: schoolBeneficiary.id,
          status: "APPROVED",
          approvedAt: new Date(),
        },
      });

      // Link to BeneficiaryDirectory if a directory school was chosen
      try {
        await linkSchoolToBeneficiaryDirectory(school.id, data.directorySchoolId);
      } catch (err) {
        console.error("[signup] Failed to link school to BeneficiaryDirectory:", err);
      }
    }

    const token = signToken({ userId: user.id, email: user.email, role: user.role });

    const verificationUrl = `${CLIENT_URL}/verify-email?token=${emailVerificationToken}`;

    // Send verification email — awaited so it completes before Lambda returns.
    // Errors are caught and logged but signup still succeeds.
    try {
      await sendVerificationEmail(user.email, verificationUrl);
    } catch (emailErr) {
      console.error("[signup] Failed to send verification email:", emailErr);
    }

    res.status(201).json({
      token,
      requiresEmailVerification: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: false,
        organizationId: user.organizationId,
        schoolId,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.errors });
    }
    console.error("Signup error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/login
router.post("/login", loginLimiter, async (req: Request, res: Response) => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: {
        organization: true,
        school: true,
        classroom: { include: { school: true } },
        cohort: { include: { school: true } },
        beneficiary: true,
      },
    });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    if (user.status !== "ACTIVE") {
      return res.status(403).json({ error: "Account is " + user.status.toLowerCase() });
    }

    if (!user.passwordHash) {
      return res.status(401).json({ error: "This account uses Google Sign-In. Please use that method." });
    }

    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = signToken({ userId: user.id, email: user.email, role: user.role });

    // Derive school info: from direct association, classroom, or cohort
    const studentSchool = user.school || user.classroom?.school || user.cohort?.school || null;
    const schoolId = user.schoolId || user.classroom?.school?.id || user.cohort?.school?.id || null;

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified,
        organizationId: user.organizationId,
        organization: user.organization,
        schoolId,
        school: studentSchool,
        classroomId: user.classroomId,
        classroom: user.classroom,
        cohortId: user.cohortId,
        cohort: user.cohort,
        beneficiaryId: user.beneficiaryId,
        beneficiary: user.beneficiary,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.errors });
    }
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/auth/me
router.get("/me", authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: {
        organization: true,
        school: true,
        classroom: { include: { school: true } },
        cohort: { include: { school: true } },
        beneficiary: true,
      },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    const studentSchool = user.school || user.classroom?.school || user.cohort?.school || null;
    const schoolId = user.schoolId || user.classroom?.school?.id || user.cohort?.school?.id || null;

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: decryptField(user.phone),
      grade: user.grade,
      house: user.house,
      status: user.status,
      emailVerified: user.emailVerified,
      organizationId: user.organizationId,
      organization: user.organization,
      schoolId,
      school: studentSchool,
      classroomId: user.classroomId,
      classroom: user.classroom,
      cohortId: user.cohortId,
      cohort: user.cohort,
      beneficiaryId: user.beneficiaryId,
      beneficiary: user.beneficiary,
    });
  } catch (err) {
    console.error("Me error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/auth/password
router.put("/password", authenticate, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current password and new password are required" });
    }
    const pwResult = passwordSchema.safeParse(newPassword);
    if (!pwResult.success) {
      return res.status(400).json({ error: pwResult.error.errors[0].message });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.passwordHash) {
      return res.status(400).json({ error: "This account uses Google Sign-In. Password cannot be changed here." });
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { passwordHash },
    });

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("Password change error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

const profileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  phone: z.string().max(20).optional(),
  bio: z.string().max(1000).optional(),
  age: z.number().int().min(10).max(25).optional(),
  grade: z.string().max(50).optional(),
  avatarUrl: z.string().nullable().optional(),
  socialLinks: z.object({
    instagram: z.string().max(255).optional(),
    tiktok: z.string().max(255).optional(),
    twitter: z.string().max(255).optional(),
    youtube: z.string().max(255).optional(),
  }).optional(),
  notificationPreferences: z.record(z.any()).optional(),
  messagePreferences: z.record(z.any()).optional(),
});

// PUT /api/auth/profile
router.put("/profile", authenticate, async (req: Request, res: Response) => {
  try {
    const data = profileSchema.parse(req.body);
    const updateData: any = {
      name: data.name,
      phone: data.phone !== undefined ? encryptField(data.phone) : undefined,
      bio: data.bio,
      age: data.age,
      grade: data.grade,
      socialLinks: data.socialLinks ? JSON.stringify(data.socialLinks) : undefined,
    };
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
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
      return res.status(400).json({ error: "Validation failed", details: err.errors });
    }
    console.error("Profile update error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/auth/verify-email?token=xxx
router.get("/verify-email", async (req: Request, res: Response) => {
  try {
    const { token } = req.query;
    if (!token || typeof token !== "string") {
      return res.status(400).json({ error: "Invalid token" });
    }

    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpires: { gt: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({ error: "Invalid or expired verification token" });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });

    res.json({ message: "Email verified successfully", userId: user.id });
  } catch (err) {
    console.error("Email verification error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/resend-verification
router.post("/resend-verification", resendVerificationLimiter, authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.emailVerified) return res.status(400).json({ error: "Email already verified" });

    const emailVerificationToken = crypto.randomBytes(32).toString("hex");
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerificationToken, emailVerificationExpires },
    });

    const verificationUrl = `${CLIENT_URL}/verify-email?token=${emailVerificationToken}`;

    try {
      await sendVerificationEmail(user.email, verificationUrl);
    } catch (emailErr) {
      console.error("[resend-verification] Failed to send verification email:", emailErr);
    }

    res.json({ message: "Verification email sent" });
  } catch (err) {
    console.error("Resend verification error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/forgot-password
router.post("/forgot-password", forgotPasswordLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });

    // Always respond with success to prevent user enumeration
    if (user) {
      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.user.update({
        where: { id: user.id },
        data: { passwordResetToken: resetToken, passwordResetExpires: resetExpires },
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
      return res.status(400).json({ error: "Valid email is required" });
    }
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/reset-password
router.post("/reset-password", async (req: Request, res: Response) => {
  try {
    const { token, password } = z.object({
      token: z.string(),
      password: passwordSchema,
    }).parse(req.body);

    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordResetToken: null, passwordResetExpires: null },
    });

    res.json({ message: "Password reset successfully" });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.errors });
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
      select: { id: true, role: true, schoolId: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    await prisma.$transaction(async (tx) => {
      // Delete audit logs created by this user
      await tx.auditLog.deleteMany({ where: { actorId: userId } });

      // Delete audit logs that reference this user's sessions
      const sessions = await tx.serviceSession.findMany({
        where: { userId },
        select: { id: true },
      });
      if (sessions.length > 0) {
        await tx.auditLog.deleteMany({ where: { sessionId: { in: sessions.map((s) => s.id) } } });
      }

      // Delete personal data
      await tx.notification.deleteMany({ where: { userId } });
      await tx.message.deleteMany({ where: { OR: [{ senderId: userId }, { receiverId: userId }] } });
      await tx.savedOpportunity.deleteMany({ where: { userId } });
      await tx.studentGroupMember.deleteMany({ where: { studentId: userId } });
      await tx.signup.deleteMany({ where: { userId } });
      await tx.serviceSession.deleteMany({ where: { userId } });

      // School admin: clean up school and classrooms (circular FK requires this)
      if (user.role === "SCHOOL_ADMIN" && user.schoolId) {
        const schoolId = user.schoolId;

        // Detach all students and staff from the school
        await tx.user.updateMany({
          where: { schoolId, id: { not: userId } },
          data: { classroomId: null, schoolId: null },
        });

        // Delete classrooms, org links, groups
        await tx.classroom.deleteMany({ where: { schoolId } });
        await tx.schoolOrganization.deleteMany({ where: { schoolId } });
        const groups = await tx.studentGroup.findMany({ where: { schoolId }, select: { id: true } });
        if (groups.length > 0) {
          await tx.studentGroupMember.deleteMany({ where: { groupId: { in: groups.map((g) => g.id) } } });
          await tx.studentGroup.deleteMany({ where: { schoolId } });
        }
        await tx.school.delete({ where: { id: schoolId } });
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
    if (user.role !== "SCHOOL_ADMIN") return res.status(403).json({ error: "Not a school admin" });

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

// POST /api/auth/dev/bypass-email-verification — DEV ONLY — mark current user's email as verified
router.post("/dev/bypass-email-verification", authenticate, async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    return res.status(404).json({ error: "Not found" });
  }

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
// Guarded by env check. All impersonation actions are logged.
router.post("/impersonate", authenticate, async (req: Request, res: Response) => {
  // Hard block in production
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    return res.status(404).json({ error: "Not found" });
  }

  try {
    const { targetEmail } = z.object({ targetEmail: z.string().email() }).parse(req.body);

    const actor = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!actor || actor.role !== "SCHOOL_ADMIN") {
      return res.status(403).json({ error: "Only admins may impersonate users" });
    }

    const target = await prisma.user.findUnique({
      where: { email: targetEmail },
      include: {
        school: true,
        cohort: { include: { school: true } },
        beneficiary: true,
      },
    });
    if (!target) return res.status(404).json({ error: "User not found" });

    // Log the impersonation
    console.warn(`[IMPERSONATION] ${actor.email} (${actor.id}) impersonated ${target.email} (${target.id}) at ${new Date().toISOString()}`);

    const token = signToken({ userId: target.id, email: target.email, role: target.role });

    const studentSchool = target.school || target.cohort?.school || null;
    const schoolId = target.schoolId || target.cohort?.school?.id || null;

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

export default router;
