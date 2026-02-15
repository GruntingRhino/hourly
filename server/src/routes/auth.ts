import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import prisma from "../lib/prisma";
import { authenticate, signToken } from "../middleware/auth";

const router = Router();

const VALID_ROLES = ["STUDENT", "ORG_ADMIN", "SCHOOL_ADMIN"] as const;

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(VALID_ROLES),
  age: z.number().optional(),
  organizationName: z.string().optional(),
  schoolName: z.string().optional(),
  schoolDomain: z.string().optional(),
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

    // If signing up as an org admin, create the organization
    if (data.role === "ORG_ADMIN") {
      const org = await prisma.organization.create({
        data: {
          name: data.organizationName || data.name,
          email: data.email,
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
        emailVerified: true,
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

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
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

// PUT /api/auth/profile
router.put("/profile", authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        name: req.body.name,
        phone: req.body.phone,
        bio: req.body.bio,
        age: req.body.age,
        grade: req.body.grade,
      },
    });
    res.json(user);
  } catch (err) {
    console.error("Profile update error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
