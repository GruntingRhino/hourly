import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import prisma from "../lib/prisma";
import { authenticate, signToken } from "../middleware/auth";

const router = Router();

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(["STUDENT", "ORGANIZATION", "SCHOOL"]),
  age: z.number().optional(),
  schoolId: z.string().optional(),
  organizationName: z.string().optional(),
  schoolName: z.string().optional(),
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

    // If signing up as an organization, create the organization
    if (data.role === "ORGANIZATION") {
      const org = await prisma.organization.create({
        data: {
          name: data.organizationName || data.name,
          email: data.email,
        },
      });
      organizationId = org.id;
    }

    // If signing up as a school, create the school
    if (data.role === "SCHOOL") {
      const school = await prisma.school.create({
        data: {
          name: data.schoolName || data.name,
          adminUserId: "temp", // will update after user creation
        },
      });
      schoolId = school.id;
    }

    // If student with school affiliation
    if (data.role === "STUDENT" && data.schoolId) {
      schoolId = data.schoolId;
    }

    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name,
        role: data.role,
        age: data.age,
        schoolId: data.role === "STUDENT" ? schoolId : undefined,
        organizationId,
        emailVerified: true, // In production, would send verification email
      },
    });

    // Update school admin reference
    if (data.role === "SCHOOL" && schoolId) {
      await prisma.school.update({
        where: { id: schoolId },
        data: { adminUserId: user.id },
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
        schoolId: data.role === "SCHOOL" ? schoolId : user.schoolId,
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
      include: { organization: true, school: true },
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

    // For school admins, find their school
    let adminSchoolId: string | undefined;
    if (user.role === "SCHOOL") {
      const school = await prisma.school.findFirst({ where: { adminUserId: user.id } });
      adminSchoolId = school?.id;
    }

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
        schoolId: user.role === "SCHOOL" ? adminSchoolId : user.schoolId,
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
      include: { organization: true, school: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    let adminSchoolId: string | undefined;
    if (user.role === "SCHOOL") {
      const school = await prisma.school.findFirst({ where: { adminUserId: user.id } });
      adminSchoolId = school?.id;
    }

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
      schoolId: user.role === "SCHOOL" ? adminSchoolId : user.schoolId,
      school: user.school,
    });
  } catch (err) {
    console.error("Me error:", err);
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
