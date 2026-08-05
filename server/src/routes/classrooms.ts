import { Router, Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import prisma from "../lib/prisma";
import { buildStudentProgressRecords, type StudentProgressRecord } from "../lib/studentProgress";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { sendStudentLeftClassroomEmail } from "../services/email";

const router = Router();

const updateClassroomSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  isActive: z.boolean().optional(),
  teacherId: z.string().trim().min(1).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: "At least one field is required",
});

function generateInviteCode(): string {
  return crypto.randomBytes(4).toString("hex"); // 8 hex chars
}

// POST /api/classrooms — create a classroom (SCHOOL_ADMIN or TEACHER)
router.post(
  "/",
  authenticate,
  requireRole("SCHOOL_ADMIN", "TEACHER"),
  async (req: Request, res: Response) => {
    try {
      const { name } = z.object({ name: z.string().min(1) }).parse(req.body);

      const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
      if (!user?.schoolId) {
        return res.status(400).json({ error: "Not associated with a school" });
      }

      let inviteCode = generateInviteCode();
      // Ensure uniqueness
      while (await prisma.classroom.findUnique({ where: { inviteCode } })) {
        inviteCode = generateInviteCode();
      }

      const classroom = await prisma.classroom.create({
        data: {
          name,
          schoolId: user.schoolId,
          teacherId: user.id,
          inviteCode,
        },
      });

      res.status(201).json(classroom);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: err.errors });
      }
      console.error("Create classroom error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// GET /api/classrooms — list classrooms for user's school (with stats)
router.get(
  "/",
  authenticate,
  requireRole("SCHOOL_ADMIN", "TEACHER"),
  async (req: Request, res: Response) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
      if (!user?.schoolId) {
        return res.status(400).json({ error: "Not associated with a school" });
      }

      const school = await prisma.school.findUnique({ where: { id: user.schoolId } });

      // TEACHER role: only see their own classroom
      const whereClause: any = { schoolId: user.schoolId };
      if (user.role === "TEACHER") {
        whereClause.teacherId = user.id;
      }

      const classrooms = await prisma.classroom.findMany({
        where: whereClause,
        include: {
          teacher: { select: { id: true, name: true } },
        },
        orderBy: { name: "asc" },
      });

      const students = await prisma.user.findMany({
        where: {
          role: "STUDENT",
          isTestAccount: false,
          classroomId: { in: classrooms.map((classroom) => classroom.id) },
        },
        select: {
          id: true,
          name: true,
          email: true,
          grade: true,
          classroomId: true,
          cohortId: true,
          cohort: {
            select: {
              id: true,
              name: true,
              requiredHours: true,
              serviceStartDate: true,
              serviceEndDate: true,
            },
          },
          cohortMemberships: {
            where: { isActive: true },
            orderBy: [{ updatedAt: "desc" }],
            select: {
              cohortId: true,
              isActive: true,
              cohort: {
                select: {
                  id: true,
                  name: true,
                  requiredHours: true,
                  serviceStartDate: true,
                  serviceEndDate: true,
                },
              },
            },
          },
        },
      });

      const progress = await buildStudentProgressRecords(students, {
        schoolId: user.schoolId,
        requiredHours: school?.requiredHours ?? 40,
        serviceStartDate: school?.serviceStartDate ?? null,
        serviceEndDate: school?.serviceEndDate ?? null,
      });
      const progressByClassroomId = new Map<string, StudentProgressRecord[]>();
      for (const student of progress) {
        const sourceStudent = students.find((row) => row.id === student.id);
        if (!sourceStudent?.classroomId) continue;
        const classroomProgress = progressByClassroomId.get(sourceStudent.classroomId) ?? [];
        classroomProgress.push(student);
        progressByClassroomId.set(sourceStudent.classroomId, classroomProgress);
      }

      const result = classrooms.map((c) => {
        const classroomProgress = progressByClassroomId.get(c.id) ?? [];
        const studentCount = classroomProgress.length;
        const totalHours = classroomProgress.reduce((sum, student) => sum + student.approvedHours, 0);
        const completedCount = classroomProgress.filter((student) => student.status === "COMPLETED").length;
        const atRiskCount = classroomProgress.filter((student) => student.status === "AT_RISK").length;
        return {
          id: c.id,
          name: c.name,
          inviteCode: c.inviteCode,
          isActive: c.isActive,
          createdAt: c.createdAt,
          teacher: c.teacher,
          studentCount,
          totalHours: Math.round(totalHours * 100) / 100,
          completedCount,
          atRiskCount,
          completionPercentage: studentCount > 0 ? Math.round((completedCount / studentCount) * 100) : 0,
        };
      });

      res.json(result);
    } catch (err) {
      console.error("List classrooms error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// GET /api/classrooms/:id — get classroom details
router.get(
  "/:id",
  authenticate,
  requireRole("SCHOOL_ADMIN", "TEACHER"),
  async (req: Request, res: Response) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
      const classroom = await prisma.classroom.findUnique({
        where: { id: req.params.id },
        include: {
          teacher: { select: { id: true, name: true } },
          students: {
            select: {
              id: true,
              name: true,
              email: true,
              grade: true,
              serviceSessions: {
                where: { schoolId: user.schoolId, verificationStatus: "APPROVED" },
                select: { totalHours: true },
              },
            },
          },
          school: true,
        },
      });

      if (!classroom) {
        return res.status(404).json({ error: "Classroom not found" });
      }
      if (classroom.schoolId !== user?.schoolId) {
        return res.status(403).json({ error: "Not your school" });
      }
      if (user.role === "TEACHER" && classroom.teacherId !== user.id) {
        return res.status(404).json({ error: "Classroom not found" });
      }

      const studentsWithHours = classroom.students.map((s) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        grade: s.grade,
        approvedHours: s.serviceSessions.reduce((sum: number, ss: any) => sum + (ss.totalHours || 0), 0),
      }));

      res.json({
        ...classroom,
        students: studentsWithHours,
      });
    } catch (err) {
      console.error("Get classroom error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// PUT /api/classrooms/:id — update classroom
router.put(
  "/:id",
  authenticate,
  requireRole("SCHOOL_ADMIN", "TEACHER"),
  async (req: Request, res: Response) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
      const classroom = await prisma.classroom.findUnique({ where: { id: req.params.id } });

      if (!classroom) {
        return res.status(404).json({ error: "Classroom not found" });
      }
      if (classroom.schoolId !== user?.schoolId) {
        return res.status(403).json({ error: "Not your school" });
      }
      if (user.role === "TEACHER" && classroom.teacherId !== user.id) {
        return res.status(404).json({ error: "Classroom not found" });
      }

      const data = updateClassroomSchema.parse(req.body);
      if (user.role === "TEACHER" && data.teacherId !== undefined) {
        return res.status(403).json({ error: "Only school administrators may reassign classrooms" });
      }
      if (data.teacherId !== undefined) {
        const replacementTeacher = await prisma.user.findUnique({
          where: { id: data.teacherId },
          select: { role: true, schoolId: true },
        });
        if (
          !replacementTeacher ||
          replacementTeacher.schoolId !== classroom.schoolId ||
          !["SCHOOL_ADMIN", "TEACHER"].includes(replacementTeacher.role)
        ) {
          return res.status(400).json({ error: "Replacement teacher must be staff at this school" });
        }
      }

      const updated = await prisma.classroom.update({
        where: { id: req.params.id },
        data,
      });

      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: err.errors });
      }
      console.error("Update classroom error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// POST /api/classrooms/join — student joins with invite code
router.post(
  "/join",
  authenticate,
  requireRole("STUDENT"),
  async (req: Request, res: Response) => {
    try {
      const { inviteCode } = z
        .object({ inviteCode: z.string().length(8) })
        .parse(req.body);

      const student = await prisma.user.findUnique({ where: { id: req.user!.userId } });
      if (!student) {
        return res.status(404).json({ error: "User not found" });
      }

      // Prevent multi-classroom conflicts
      if (student.classroomId) {
        return res.status(409).json({
          error: "Already enrolled in a classroom. Leave your current classroom first.",
        });
      }

      const classroom = await prisma.classroom.findUnique({
        where: { inviteCode },
        include: { school: true },
      });

      if (!classroom) {
        return res.status(404).json({ error: "Invalid invite code" });
      }
      if (!classroom.isActive) {
        return res.status(400).json({ error: "This classroom is no longer active" });
      }
      if (!classroom.school.allowJoinByCode) {
        return res.status(403).json({
          error: "Joining by code is currently disabled by your school.",
        });
      }

      // Attach student to classroom and implicitly to school
      const updated = await prisma.user.update({
        where: { id: req.user!.userId },
        data: {
          classroomId: classroom.id,
          schoolId: classroom.schoolId,
        },
        include: {
          classroom: { include: { school: true } },
        },
      });

      res.json({
        message: "Joined classroom successfully",
        classroom: {
          id: classroom.id,
          name: classroom.name,
          school: classroom.school,
        },
        schoolId: classroom.schoolId,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid invite code format" });
      }
      console.error("Join classroom error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// POST /api/classrooms/leave — student leaves classroom
router.post(
  "/leave",
  authenticate,
  requireRole("STUDENT"),
  async (req: Request, res: Response) => {
    try {
      const student = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        include: { classroom: { include: { teacher: { select: { email: true, name: true } } } } },
      });
      if (!student?.classroomId) {
        return res.status(400).json({ error: "Not in a classroom" });
      }

      const classroomName = student.classroom?.name ?? "classroom";
      const teacherEmail = student.classroom?.teacher?.email;

      await prisma.user.update({
        where: { id: req.user!.userId },
        data: {
          classroomId: null,
          schoolId: null,
        },
      });

      // Notify classroom admin via email
      if (teacherEmail) {
        sendStudentLeftClassroomEmail(teacherEmail, student.name, classroomName).catch(() => {});
      }

      res.json({ message: "Left classroom successfully" });
    } catch (err) {
      console.error("Leave classroom error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// GET /api/classrooms/my — student gets their classroom info
router.get(
  "/my/current",
  authenticate,
  requireRole("STUDENT"),
  async (req: Request, res: Response) => {
    try {
      const student = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        include: {
          classroom: {
            include: {
              school: true,
              teacher: { select: { id: true, name: true } },
            },
          },
        },
      });

      if (!student?.classroom) {
        return res.json(null);
      }

      res.json(student.classroom);
    } catch (err) {
      console.error("My classroom error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;
