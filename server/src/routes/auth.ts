import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import prisma from "../lib/prisma";
import { authenticate, signToken } from "../middleware/auth";

const router = Router();

const VALID_ROLES = ["STUDENT", "ORG_ADMIN", "SCHOOL_ADMIN"] as const;

const signupSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(255),
  role: z.enum(VALID_ROLES),
  age: z.number().int().min(10).max(25).optional(),
  grade: z.string().max(50).optional(),
  organizationName: z.string().max(255).optional(),
  orgName: z.string().max(255).optional(), // alias for organizationName
  description: z.string().max(1000).optional(),
  phone: z.string().max(20).optional(),
  website: z.string().max(255).optional(),
  schoolName: z.string().max(255).optional(),
  schoolDomain: z.string().max(255).optional(),
  zipCodes: z.array(z.string().regex(/^\d{5}$/, "Invalid ZIP code")).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// POST /api/auth/signup
router.post("/signup", async (req: Request, res: Response) => {
  try {
    const data = signupSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    let organizationId: string | undefined;
    let schoolId: string | undefined;

    // Generate email verification token
    const emailVerificationToken = crypto.randomBytes(32).toString("hex");
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // If signing up as an org admin, create the organization
    if (data.role === "ORG_ADMIN") {
      const org = await prisma.organization.create({
        data: {
          name: data.organizationName || data.orgName || data.name,
          email: data.email,
          phone: data.phone || null,
          description: data.description || null,
          website: data.website || null,
          zipCodes: data.zipCodes ? JSON.stringify(data.zipCodes) : null,
        },
      });
      organizationId = org.id;
    }

    // Create the user first (school creation needs user id)
    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name,
        role: data.role,
        age: data.role === "STUDENT" ? data.age : undefined,
        organizationId,
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
    }

    const token = signToken({ userId: user.id, email: user.email, role: user.role });

    // In dev, include the verification link in the response
    const verificationUrl = `${process.env.APP_URL || "http://localhost:5173"}/verify-email?token=${emailVerificationToken}`;

    res.status(201).json({
      token,
      requiresEmailVerification: true,
      verificationUrl, // Dev only: include in response for testing
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
router.post("/login", async (req: Request, res: Response) => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: {
        organization: true,
        school: true,
        classroom: { include: { school: true } },
      },
    });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    if (user.status !== "ACTIVE") {
      return res.status(403).json({ error: "Account is " + user.status.toLowerCase() });
    }

    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = signToken({ userId: user.id, email: user.email, role: user.role });

    // Derive school info for students from classroom
    const studentSchool = user.classroom?.school || null;

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        emailVerified: user.emailVerified,
        organizationId: user.organizationId,
        organization: user.organization,
        schoolId: user.schoolId || studentSchool?.id,
        school: user.school || studentSchool,
        classroomId: user.classroomId,
        classroom: user.classroom,
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
      },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    const studentSchool = user.classroom?.school || null;

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      age: user.age,
      grade: user.grade,
      status: user.status,
      emailVerified: user.emailVerified,
      socialLinks: user.socialLinks ? JSON.parse(user.socialLinks) : null,
      organizationId: user.organizationId,
      organization: user.organization,
      schoolId: user.schoolId || studentSchool?.id,
      school: user.school || studentSchool,
      classroomId: user.classroomId,
      classroom: user.classroom,
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
    if (newPassword.length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters" });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
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
  socialLinks: z.object({
    instagram: z.string().max(255).optional(),
    tiktok: z.string().max(255).optional(),
    twitter: z.string().max(255).optional(),
    youtube: z.string().max(255).optional(),
  }).optional(),
});

// PUT /api/auth/profile
router.put("/profile", authenticate, async (req: Request, res: Response) => {
  try {
    const data = profileSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        name: data.name,
        phone: data.phone,
        bio: data.bio,
        age: data.age,
        grade: data.grade,
        socialLinks: data.socialLinks ? JSON.stringify(data.socialLinks) : undefined,
      },
    });
    res.json(user);
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
router.post("/resend-verification", authenticate, async (req: Request, res: Response) => {
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

    const verificationUrl = `${process.env.APP_URL || "http://localhost:5173"}/verify-email?token=${emailVerificationToken}`;

    res.json({ message: "Verification email sent", verificationUrl });
  } catch (err) {
    console.error("Resend verification error:", err);
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

export default router;
