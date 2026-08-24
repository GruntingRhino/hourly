import { Router, Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";

const router = Router();
const windowSchema = z.object({ weekday: z.number().int().min(0).max(6), start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/) });
function validTimezone(timezone: string) { try { new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(); return true; } catch { return false; } }
function parseTags(raw: string | null | undefined): string[] { try { const parsed = raw ? JSON.parse(raw) : []; return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : []; } catch { return []; } }

router.get("/", authenticate, requireRole("STUDENT"), async (req: Request, res: Response) => {
  const preference = await prisma.studentPreference.findUnique({ where: { studentId: req.user!.userId }, include: { availability: true } });
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { schoolId: true } });
  const school = user?.schoolId ? await prisma.school.findUnique({ where: { id: user.schoolId }, select: { approvedInterestTags: true } }) : null;
  return res.json({ preference, approvedTags: parseTags(school?.approvedInterestTags) });
});

router.put("/", authenticate, requireRole("STUDENT"), async (req: Request, res: Response) => {
  try {
    const input = z.object({ optedIn: z.boolean(), interestTags: z.array(z.string().trim().min(1).max(50)).max(25), timezone: z.string().min(1).max(100), availability: z.array(windowSchema).max(28) }).parse(req.body);
    if (!validTimezone(input.timezone)) return res.status(400).json({ error: "Invalid IANA timezone" });
    const student = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { schoolId: true } });
    if (!student?.schoolId) return res.status(403).json({ error: "Student is not associated with a school" });
    const school = await prisma.school.findUnique({ where: { id: student.schoolId }, select: { approvedInterestTags: true } });
    const approved = new Set(parseTags(school?.approvedInterestTags).map((tag) => tag.toLowerCase()));
    const invalid = input.interestTags.filter((tag) => !approved.has(tag.toLowerCase()));
    if (invalid.length) return res.status(400).json({ error: "Interest tags must be approved by your school", invalidTags: invalid });
    const saved = await prisma.$transaction(async (tx) => {
      const preference = await tx.studentPreference.upsert({ where: { studentId: req.user!.userId }, create: { studentId: req.user!.userId, schoolId: student.schoolId!, optedIn: input.optedIn, interestTags: JSON.stringify([...new Set(input.interestTags)]), timezone: input.timezone }, update: { schoolId: student.schoolId!, optedIn: input.optedIn, interestTags: JSON.stringify([...new Set(input.interestTags)]), timezone: input.timezone } });
      await tx.studentAvailabilityWindow.deleteMany({ where: { preferenceId: preference.id } });
      if (input.availability.length) await tx.studentAvailabilityWindow.createMany({ data: input.availability.map(({ weekday, start, end }) => ({ weekday, start, end, studentId: req.user!.userId, preferenceId: preference.id })) });
      return tx.studentPreference.findUnique({ where: { id: preference.id }, include: { availability: true } });
    });
    return res.json(saved);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    console.error("Student preference update error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});
export default router;
