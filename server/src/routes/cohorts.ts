import { Router, Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import { parse } from "csv-parse/sync";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { sendStudentInvitationEmail, CLIENT_URL } from "../services/email";

const router = Router();

// GET /api/cohorts — list cohorts for school
router.get("/", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER", "DISTRICT_ADMIN"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user?.schoolId) return res.status(400).json({ error: "Not associated with a school" });

    const school = await prisma.school.findUnique({ where: { id: user.schoolId } });

    const cohorts = await prisma.cohort.findMany({
      where: { schoolId: user.schoolId },
      include: {
        _count: { select: { students: true, invitations: true } },
        invitations: { select: { status: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const requiredHours = school?.requiredHours ?? 40;

    const result = await Promise.all(
      cohorts.map(async (c) => {
        // fetch students with hour data
        const students = await prisma.user.findMany({
          where: { cohortId: c.id },
          select: { id: true },
        });
        const studentIds = students.map((s) => s.id);
        const [benSignups, selfSubs] = await Promise.all([
          prisma.beneficiarySignup.findMany({
            where: { studentId: { in: studentIds }, verificationStatus: "APPROVED" },
            select: { studentId: true, totalHours: true },
          }),
          prisma.selfSubmittedRequest.findMany({
            where: { studentId: { in: studentIds }, status: "APPROVED" },
            select: { studentId: true, hours: true },
          }),
        ]);
        const hoursMap = new Map<string, number>();
        for (const bs of benSignups) {
          hoursMap.set(bs.studentId, (hoursMap.get(bs.studentId) || 0) + (bs.totalHours ?? 0));
        }
        for (const ss of selfSubs) {
          hoursMap.set(ss.studentId, (hoursMap.get(ss.studentId) || 0) + ss.hours);
        }
        let totalHours = 0;
        let completedCount = 0;
        let atRiskCount = 0;
        for (const s of students) {
          const h = hoursMap.get(s.id) || 0;
          totalHours += h;
          const req = c.requiredHours ?? requiredHours;
          if (h >= req) completedCount++;
          else if (h < req * 0.5) atRiskCount++;
        }
        const invAccepted = c.invitations.filter((i) => i.status === "ACCEPTED").length;
        const invPending = c.invitations.filter((i) => i.status === "PENDING").length;
        return {
          id: c.id,
          name: c.name,
          status: c.status,
          requiredHours: c.requiredHours ?? requiredHours,
          startYear: c.startYear,
          endYear: c.endYear,
          publishedAt: c.publishedAt,
          studentCount: students.length,
          invitationsSent: c._count.invitations,
          invitationsAccepted: invAccepted,
          invitationsPending: invPending,
          totalHours: Math.round(totalHours * 100) / 100,
          completedCount,
          atRiskCount,
          completionPercentage: students.length > 0 ? Math.round((completedCount / students.length) * 100) : 0,
        };
      })
    );

    res.json(result);
  } catch (err) {
    console.error("List cohorts error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/cohorts — create cohort
router.post("/", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      name: z.string().min(1).max(255),
      requiredHours: z.number().min(1).max(10000).optional(),
      startYear: z.number().int().optional(),
      endYear: z.number().int().optional(),
    });
    const data = schema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user?.schoolId) return res.status(400).json({ error: "Not associated with a school" });

    const cohort = await prisma.cohort.create({
      data: {
        name: data.name,
        schoolId: user.schoolId,
        requiredHours: data.requiredHours ?? null,
        startYear: data.startYear ?? null,
        endYear: data.endYear ?? null,
        status: "DRAFT",
      },
    });

    res.status(201).json(cohort);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    console.error("Create cohort error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/cohorts/school-students — all students across all school cohorts with hours
router.get("/school-students", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER", "DISTRICT_ADMIN"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user?.schoolId) return res.status(400).json({ error: "Not associated with a school" });

    const school = await prisma.school.findUnique({ where: { id: user.schoolId } });
    const defaultRequired = school?.requiredHours ?? 40;

    const cohorts = await prisma.cohort.findMany({
      where: { schoolId: user.schoolId },
      select: { id: true, name: true, requiredHours: true },
    });

    const result: any[] = [];
    for (const cohort of cohorts) {
      const students = await prisma.user.findMany({
        where: { cohortId: cohort.id },
        select: { id: true, name: true, email: true, grade: true },
      });
      const studentIds = students.map((s) => s.id);
      if (studentIds.length === 0) continue;
      const [benSignups, selfSubs] = await Promise.all([
        prisma.beneficiarySignup.findMany({
          where: { studentId: { in: studentIds }, verificationStatus: "APPROVED" },
          select: { studentId: true, totalHours: true },
        }),
        prisma.selfSubmittedRequest.findMany({
          where: { studentId: { in: studentIds }, status: "APPROVED" },
          select: { studentId: true, hours: true },
        }),
      ]);
      const hoursMap = new Map<string, number>();
      for (const bs of benSignups) hoursMap.set(bs.studentId, (hoursMap.get(bs.studentId) || 0) + (bs.totalHours ?? 0));
      for (const ss of selfSubs) hoursMap.set(ss.studentId, (hoursMap.get(ss.studentId) || 0) + ss.hours);

      const cohortRequired = cohort.requiredHours ?? defaultRequired;
      for (const s of students) {
        const hours = Math.round((hoursMap.get(s.id) || 0) * 100) / 100;
        result.push({
          id: s.id,
          name: s.name,
          email: s.email,
          grade: s.grade,
          cohortId: cohort.id,
          cohortName: cohort.name,
          approvedHours: hours,
          requiredHours: cohortRequired,
          status: hours >= cohortRequired ? "COMPLETED" : hours >= cohortRequired * 0.5 ? "ON_TRACK" : "AT_RISK",
        });
      }
    }

    res.json(result);
  } catch (err) {
    console.error("School students error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/cohorts/:id — cohort details
router.get("/:id", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER", "DISTRICT_ADMIN"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    const cohort = await prisma.cohort.findUnique({
      where: { id: req.params.id },
      include: {
        students: {
          select: { id: true, name: true, email: true, grade: true, house: true },
        },
        invitations: { orderBy: { createdAt: "desc" } },
        school: { select: { requiredHours: true } },
      },
    });
    if (!cohort) return res.status(404).json({ error: "Cohort not found" });
    if (cohort.schoolId !== user?.schoolId) return res.status(403).json({ error: "Not your school's cohort" });

    const requiredHours = cohort.requiredHours ?? cohort.school.requiredHours ?? 40;
    const studentIds = cohort.students.map((s) => s.id);
    const [benSignups, selfSubs] = await Promise.all([
      prisma.beneficiarySignup.findMany({
        where: { studentId: { in: studentIds }, verificationStatus: "APPROVED" },
        select: { studentId: true, totalHours: true },
      }),
      prisma.selfSubmittedRequest.findMany({
        where: { studentId: { in: studentIds }, status: "APPROVED" },
        select: { studentId: true, hours: true },
      }),
    ]);
    const hoursMap = new Map<string, number>();
    for (const bs of benSignups) {
      hoursMap.set(bs.studentId, (hoursMap.get(bs.studentId) || 0) + (bs.totalHours ?? 0));
    }
    for (const ss of selfSubs) {
      hoursMap.set(ss.studentId, (hoursMap.get(ss.studentId) || 0) + ss.hours);
    }
    const studentsWithHours = cohort.students.map((s) => ({
      ...s,
      approvedHours: hoursMap.get(s.id) || 0,
    }));

    res.json({ ...cohort, students: studentsWithHours, requiredHours });
  } catch (err) {
    console.error("Get cohort error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/cohorts/:id — update cohort
router.put("/:id", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    const cohort = await prisma.cohort.findUnique({ where: { id: req.params.id } });
    if (!cohort) return res.status(404).json({ error: "Cohort not found" });
    if (cohort.schoolId !== user?.schoolId) return res.status(403).json({ error: "Not your school's cohort" });

    const updated = await prisma.cohort.update({
      where: { id: req.params.id },
      data: {
        name: req.body.name ?? cohort.name,
        requiredHours: req.body.requiredHours ?? cohort.requiredHours,
        startYear: req.body.startYear ?? cohort.startYear,
        endYear: req.body.endYear ?? cohort.endYear,
      },
    });
    res.json(updated);
  } catch (err) {
    console.error("Update cohort error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/cohorts/:id/import — CSV import students
router.post("/:id/import", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    const cohort = await prisma.cohort.findUnique({ where: { id: req.params.id } });
    if (!cohort) return res.status(404).json({ error: "Cohort not found" });
    if (cohort.schoolId !== user?.schoolId) return res.status(403).json({ error: "Not your school's cohort" });

    // Expect { csvData: "name,email,grade,house\n..." }
    const { csvData } = z.object({ csvData: z.string().min(1) }).parse(req.body);

    let records: any[];
    try {
      records = parse(csvData, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch (parseErr) {
      return res.status(400).json({ error: "Invalid CSV format" });
    }

    if (records.length === 0) return res.status(400).json({ error: "CSV has no student rows" });
    if (records.length > 2000) return res.status(400).json({ error: "CSV exceeds 2000 row limit" });

    const results = { added: 0, skipped: 0, errors: [] as string[] };

    for (const row of records) {
      const email = (row.email || "").trim().toLowerCase();
      const name = (row.name || "").trim();
      if (!email || !name) {
        results.errors.push(`Skipped row — missing name or email: ${JSON.stringify(row)}`);
        results.skipped++;
        continue;
      }
      // Upsert invitation record
      const existing = await prisma.studentInvitation.findUnique({
        where: { cohortId_email: { cohortId: cohort.id, email } },
      });
      if (existing) {
        results.skipped++;
        continue;
      }
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72h
      await prisma.studentInvitation.create({
        data: {
          cohortId: cohort.id,
          email,
          name: name || null,
          token,
          expiresAt,
          status: "PENDING",
        },
      });
      results.added++;
    }

    res.json({ message: "Import complete", ...results });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    console.error("CSV import error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/cohorts/:id/publish — send student invitations
router.post("/:id/publish", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    const cohort = await prisma.cohort.findUnique({
      where: { id: req.params.id },
      include: { school: { select: { name: true } } },
    });
    if (!cohort) return res.status(404).json({ error: "Cohort not found" });
    if (cohort.schoolId !== user?.schoolId) return res.status(403).json({ error: "Not your school's cohort" });

    const pendingInvitations = await prisma.studentInvitation.findMany({
      where: { cohortId: cohort.id, status: "PENDING" },
    });

    if (pendingInvitations.length === 0) {
      return res.status(400).json({ error: "No pending student invitations to send. Import students first." });
    }

    let sent = 0;
    let failed = 0;
    for (const inv of pendingInvitations) {
      const magicLink = `${CLIENT_URL}/join/student?token=${inv.token}`;
      try {
        await sendStudentInvitationEmail(
          inv.email,
          inv.name,
          cohort.name,
          cohort.school.name,
          magicLink
        );
        sent++;
      } catch (emailErr) {
        console.error(`[cohort publish] Failed to send to ${inv.email}:`, emailErr);
        failed++;
      }
    }

    // Mark cohort as published
    await prisma.cohort.update({
      where: { id: cohort.id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });

    res.json({ message: "Invitations sent", sent, failed });
  } catch (err) {
    console.error("Publish cohort error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/cohorts/:id/add-student — manually add a single student invitation
router.post("/:id/add-student", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    const cohort = await prisma.cohort.findUnique({ where: { id: req.params.id }, include: { school: true } });
    if (!cohort) return res.status(404).json({ error: "Cohort not found" });
    if (cohort.schoolId !== user?.schoolId) return res.status(403).json({ error: "Not your school's cohort" });

    const { email, name } = z.object({
      email: z.string().email(),
      name: z.string().min(1).max(255).optional(),
    }).parse(req.body);

    const existing = await prisma.studentInvitation.findUnique({
      where: { cohortId_email: { cohortId: cohort.id, email } },
    });
    if (existing) return res.status(409).json({ error: "Student already invited to this cohort" });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    const inv = await prisma.studentInvitation.create({
      data: { cohortId: cohort.id, email, name: name || null, token, expiresAt, status: "PENDING" },
    });

    // Send invitation email if cohort is already published
    if (cohort.status === "PUBLISHED") {
      const magicLink = `${CLIENT_URL}/join/student?token=${token}`;
      sendStudentInvitationEmail(email, name || null, cohort.name, cohort.school.name, magicLink).catch(() => {});
    }

    res.status(201).json(inv);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    console.error("Add student error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/cohorts/:id/students/:studentId — remove student from cohort
router.delete("/:id/students/:studentId", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    const cohort = await prisma.cohort.findUnique({ where: { id: req.params.id } });
    if (!cohort) return res.status(404).json({ error: "Cohort not found" });
    if (cohort.schoolId !== user?.schoolId) return res.status(403).json({ error: "Not your school's cohort" });

    await prisma.user.update({
      where: { id: req.params.studentId },
      data: { cohortId: null },
    });
    res.json({ message: "Student removed from cohort" });
  } catch (err) {
    console.error("Remove student from cohort error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
