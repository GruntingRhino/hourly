import { Router, Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import { parse } from "csv-parse/sync";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { sendBeneficiaryInvitationEmail, CLIENT_URL } from "../services/email";
import { geocodeAddress } from "../lib/geocode";
import { checkCategoryCap } from "../lib/schoolRules";
import { resolveStudentSchoolId } from "../lib/dataAccessLog";
import { buildAnonymousVolunteerLabel } from "../lib/privacy";

// 10 invitations per school admin per hour — prevents inbox-bombing a beneficiary contact
const beneficiaryInviteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => `ben-invite:${(req as any).user?.userId ?? ipKeyGenerator(req.ip || "")}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many invitation attempts. Please wait before sending more invitations." },
});

const router = Router();

// ─── Background city geocoding ────────────────────────────────────────────────
// Tracks which US states currently have a background geocoding job running.
// When a school in an ungeocoded state searches for nearby orgs, we kick off
// a background job that geocodes every city in that state (city-center accuracy).
// Subsequent searches in that state return real results.

const geocodingStates = new Set<string>();

async function geocodeStateBackground(state: string): Promise<void> {
  try {
    const cities = await prisma.$queryRawUnsafe<{ city: string; state: string }[]>(
      `SELECT DISTINCT city, state FROM "BeneficiaryDirectory"
       WHERE state = $1 AND active = true AND latitude IS NULL AND city IS NOT NULL
       ORDER BY city`,
      state
    );
    for (const { city, st } of cities.map(r => ({ city: r.city, st: r.state }))) {
      if (!geocodingStates.has(state)) break; // cancelled / server restart
      try {
        const coords = await geocodeAddress(`${city}, ${st}`);
        if (coords) {
          await prisma.$executeRawUnsafe(
            `UPDATE "BeneficiaryDirectory" SET latitude = $1, longitude = $2
             WHERE city = $3 AND state = $4 AND latitude IS NULL`,
            coords.lat, coords.lng, city, st
          );
        }
      } catch { /* skip bad geocodes */ }
      // Nominatim rate limit: max 1 req/sec
      await new Promise(r => setTimeout(r, 1100));
    }
  } finally {
    geocodingStates.delete(state);
  }
}

// GET /api/beneficiaries — list beneficiaries
// For school admin: all approved beneficiaries for their school
// For students: beneficiaries approved by their school
// For beneficiary admins: their own beneficiary
router.get("/", authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.role === "BENEFICIARY_ADMIN") {
      if (!user.beneficiaryId) return res.json([]);
      const ben = await prisma.beneficiary.findUnique({ where: { id: user.beneficiaryId } });
      return res.json(ben ? [ben] : []);
    }

    const schoolId = user.schoolId ?? (
      user.role === "STUDENT" && user.cohortId
        ? (await prisma.cohort.findUnique({ where: { id: user.cohortId }, select: { schoolId: true } }))?.schoolId
        : null
    );

    if (!schoolId) return res.json([]);

    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined; // APPROVED, PENDING, ALL

    const approvals = await prisma.schoolBeneficiaryApproval.findMany({
      where: {
        schoolId,
        ...(status && status !== "ALL" ? { status } : {}),
      },
      include: {
        beneficiary: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const beneficiaryIds = approvals.map((a) => a.beneficiaryId);
    const latestInvitations = beneficiaryIds.length > 0
      ? await prisma.beneficiaryInvitation.findMany({
          where: { schoolId, beneficiaryId: { in: beneficiaryIds } },
          orderBy: [{ createdAt: "desc" }],
        })
      : [];

    const latestInvitationByBeneficiary = new Map<string, typeof latestInvitations[number]>();
    for (const invitation of latestInvitations) {
      if (!latestInvitationByBeneficiary.has(invitation.beneficiaryId)) {
        latestInvitationByBeneficiary.set(invitation.beneficiaryId, invitation);
      }
    }

    let beneficiaries = approvals.map((a) => ({
      ...a.beneficiary,
      approvalStatus: a.status,
      approvalId: a.id,
      latestInvitationStatus: latestInvitationByBeneficiary.get(a.beneficiaryId)?.status ?? null,
      latestInvitationSentTo: latestInvitationByBeneficiary.get(a.beneficiaryId)?.sentTo ?? null,
      latestInvitationCreatedAt: latestInvitationByBeneficiary.get(a.beneficiaryId)?.createdAt ?? null,
    }));

    if (search) {
      beneficiaries = beneficiaries.filter(
        (b) =>
          b.name.toLowerCase().includes(search.toLowerCase()) ||
          b.category?.toLowerCase().includes(search.toLowerCase())
      );
    }

    res.json(beneficiaries);
  } catch (err) {
    console.error("List beneficiaries error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/beneficiaries/directory/nearby — geo-proximity search
router.get("/directory/nearby", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radius = Math.min(parseFloat((req.query.radius as string) || "10"), 50);
    const category = req.query.category as string | undefined;
    const page = parseInt((req.query.page as string) || "1", 10);
    const limit = Math.min(parseInt((req.query.limit as string) || "50", 10), 500);
    const offset = (page - 1) * limit;

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: "lat and lng query params required" });
    }

    const q = (req.query.q as string | undefined)?.trim() || undefined;

    const haversineExpr = `(3959 * acos(LEAST(1.0, cos(radians($1)) * cos(radians(latitude)) * cos(radians(longitude) - radians($2)) + sin(radians($1)) * sin(radians(latitude)))))`;

    // Build base params (shared between count and main queries)
    const baseParams: any[] = [lat, lng, radius];
    let nextParam = 4;

    const categoryClause = category
      ? `AND LOWER("category") LIKE LOWER('%' || $${nextParam++} || '%')`
      : "";
    if (category) baseParams.push(category);

    const qClause = q
      ? `AND (LOWER(name) LIKE LOWER('%' || $${nextParam} || '%')
             OR LOWER(COALESCE(category,'')) LIKE LOWER('%' || $${nextParam} || '%')
             OR LOWER(COALESCE(city,'')) LIKE LOWER('%' || $${nextParam} || '%')
             OR LOWER(COALESCE(county,'')) LIKE LOWER('%' || $${nextParam} || '%')
             OR LOWER(COALESCE(zip,'')) LIKE LOWER($${nextParam} || '%'))`
      : "";
    if (q) { baseParams.push(q); nextParam++; }

    const whereClause = `
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        AND active = true
        AND ${haversineExpr} < $3
        ${categoryClause}
        ${qClause}
    `;

    // Get true total count (unaffected by LIMIT)
    const countSql = `SELECT COUNT(*)::int as total FROM "BeneficiaryDirectory" ${whereClause}`;
    const [countResult] = await prisma.$queryRawUnsafe<[{ total: number }]>(countSql, ...baseParams);
    const total = Number(countResult.total);

    // Main query with LIMIT/OFFSET
    const limitParamIdx = nextParam;
    const mainParams = [...baseParams, limit];
    const sql = `
      SELECT *,
        ${haversineExpr} AS distance_miles
      FROM "BeneficiaryDirectory"
      ${whereClause}
      ORDER BY distance_miles ASC
      LIMIT $${limitParamIdx} OFFSET ${offset}
    `;

    const results: any[] = await prisma.$queryRawUnsafe(sql, ...mainParams);

    if (q) {
      const lq = q.toLowerCase();
      const lqDigits = lq.replace(/\D/g, "");
      results.sort((a: any, b: any) => {
        const rank = (r: any) => {
          const n = r.name.toLowerCase();
          if (n.startsWith(lq)) return 0;
          if (n.split(/\s+/).some((w: string) => w.startsWith(lq))) return 1;
          const zip5 = (r.zip || "").replace(/\D/g, "").slice(0, 5);
          if ((lqDigits && zip5 && zip5.startsWith(lqDigits)) ||
              (r.city || "").toLowerCase().includes(lq) ||
              (r.category || "").toLowerCase().includes(lq)) return 2;
          return 3;
        };
        const dr = rank(a) - rank(b);
        return dr !== 0 ? dr : parseFloat(a.distance_miles) - parseFloat(b.distance_miles);
      });
    }

    // If no geocoded results, check if we need to kick off background geocoding
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { school: { select: { id: true, state: true } } },
    });
    const schoolId = user?.schoolId;
    const schoolState = (user as any)?.school?.state as string | null;

    let geocodingInProgress = false;
    if (results.length === 0 && schoolState && !geocodingStates.has(schoolState)) {
      // Check if there are ungeocoded entries in this state
      const [{ cnt }] = await prisma.$queryRawUnsafe<[{ cnt: string }]>(
        `SELECT COUNT(*) as cnt FROM "BeneficiaryDirectory" WHERE state = $1 AND latitude IS NULL LIMIT 1`,
        schoolState
      );
      if (parseInt(cnt) > 0) {
        geocodingStates.add(schoolState);
        geocodeStateBackground(schoolState); // fire and forget — no await
        geocodingInProgress = true;
      }
    }

    let approvalMap = new Map<string, string>(); // directoryId -> approval status
    if (schoolId) {
      const dirIds = results.map((r: any) => r.id);
      // Find beneficiaries linked to these directory entries that have school approval
      const beneficiaries = await prisma.beneficiary.findMany({
        where: { directoryId: { in: dirIds } },
        include: {
          schoolApprovals: {
            where: { schoolId },
            select: { status: true },
          },
        },
      });
      for (const ben of beneficiaries) {
        if (ben.directoryId && ben.schoolApprovals.length > 0) {
          approvalMap.set(ben.directoryId, ben.schoolApprovals[0].status);
        }
      }
    }

    const annotated = results.map((r: any) => ({
      id: r.id,
      name: r.name,
      ein: r.ein,
      category: r.category,
      address: r.address,
      city: r.city,
      state: r.state,
      zip: r.zip,
      latitude: parseFloat(r.latitude),
      longitude: parseFloat(r.longitude),
      email: r.email,
      website: r.website,
      phone: r.phone,
      nteeCode: r.nteeCode,
      claimed: r.claimed,
      distanceMiles: Math.round(parseFloat(r.distance_miles) * 10) / 10,
      approvalStatus: approvalMap.get(r.id) ?? null,
    }));

    res.json({ items: annotated, total, geocodingInProgress });
  } catch (err) {
    console.error("Nearby beneficiary directory error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/beneficiaries/directory — search beneficiary directory (school admin only)
router.get("/directory", authenticate, requireRole("SCHOOL_ADMIN", "TEACHER"), async (req: Request, res: Response) => {
  try {
    const search = req.query.search as string | undefined;
    const category = req.query.category as string | undefined;
    const zip = req.query.zip as string | undefined;
    const city = req.query.city as string | undefined;

    const where: any = { active: true };
    if (search) {
      // Normalize zip-like queries (strip spaces, leading zeros preserved)
      const normalizedSearch = search.trim();
      where.OR = [
        { name: { contains: normalizedSearch, mode: "insensitive" } },
        { category: { contains: normalizedSearch, mode: "insensitive" } },
        { city: { contains: normalizedSearch, mode: "insensitive" } },
        { county: { contains: normalizedSearch, mode: "insensitive" } },
        { zip: { contains: normalizedSearch, mode: "insensitive" } },
      ];
    }
    if (category) where.category = { contains: category, mode: "insensitive" };
    if (zip) where.zip = zip;
    if (city) where.city = { contains: city.trim(), mode: "insensitive" };

    const entries = await prisma.beneficiaryDirectory.findMany({
      where,
      take: 50,
      orderBy: { name: "asc" },
    });

    // Re-rank when a search query is present: name matches first, then city/zip matches
    if (search) {
      const lq = search.trim().toLowerCase();
      entries.sort((a, b) => {
        const rank = (r: typeof a) => {
          const n = r.name.toLowerCase();
          if (n.startsWith(lq)) return 0;
          if (n.split(/\s+/).some((w) => w.startsWith(lq))) return 1;
          const zip5 = (r.zip || "").replace(/\D/g, "").slice(0, 5);
          if (zip5 && zip5.startsWith(lq.replace(/\D/g, ""))) return 2;
          if ((r.city || "").toLowerCase().includes(lq)) return 2;
          return 3;
        };
        return rank(a) - rank(b) || a.name.localeCompare(b.name);
      });
    }

    res.json(entries);
  } catch (err) {
    console.error("Beneficiary directory search error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/beneficiaries — create custom beneficiary (school admin only)
router.post("/", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      name: z.string().min(1).max(255),
      category: z.string().max(100).optional(),
      address: z.string().max(255).optional(),
      city: z.string().max(100).optional(),
      state: z.string().max(50).optional(),
      zip: z.string().regex(/^\d{5}$/).optional().or(z.literal("")),
      email: z.string().email().optional().or(z.literal("")),
      phone: z.string().max(20).optional(),
      website: z.string().max(255).optional(),
      description: z.string().max(1000).optional(),
      visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PRIVATE"),
    });
    const data = schema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user?.schoolId) return res.status(400).json({ error: "Not associated with a school" });

    const beneficiary = await prisma.beneficiary.create({
      data: {
        name: data.name,
        category: data.category || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        zip: data.zip || null,
        email: data.email || null,
        phone: data.phone || null,
        website: data.website || null,
        description: data.description || null,
        visibility: data.visibility,
        status: "ACTIVE",
        createdBySchoolId: user.schoolId,
      },
    });

    // Auto-approve for the creating school
    await prisma.schoolBeneficiaryApproval.create({
      data: {
        schoolId: user.schoolId,
        beneficiaryId: beneficiary.id,
        status: "PENDING",
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "BENEFICIARY_CREATED",
        actorId: req.user!.userId,
        details: JSON.stringify({ beneficiaryId: beneficiary.id, name: beneficiary.name, visibility: data.visibility }),
      },
    });

    res.status(201).json(beneficiary);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    console.error("Create beneficiary error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/beneficiaries/:id — update a school-created beneficiary
router.put("/:id", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      name: z.string().min(1).max(255),
      category: z.string().max(100).optional().or(z.literal("")),
      address: z.string().max(255).optional().or(z.literal("")),
      city: z.string().max(100).optional().or(z.literal("")),
      state: z.string().max(50).optional().or(z.literal("")),
      zip: z.string().regex(/^\d{5}$/).optional().or(z.literal("")),
      email: z.string().email().optional().or(z.literal("")),
      phone: z.string().max(20).optional().or(z.literal("")),
      website: z.string().max(255).optional().or(z.literal("")),
      description: z.string().max(1000).optional().or(z.literal("")),
      visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PRIVATE"),
    });
    const data = schema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user?.schoolId) return res.status(400).json({ error: "Not associated with a school" });

    const beneficiary = await prisma.beneficiary.findUnique({ where: { id: req.params.id } });
    if (!beneficiary) return res.status(404).json({ error: "Beneficiary not found" });
    if (beneficiary.createdBySchoolId !== user.schoolId) {
      return res.status(403).json({ error: "Only school-created partners can be edited here" });
    }

    const updated = await prisma.beneficiary.update({
      where: { id: beneficiary.id },
      data: {
        name: data.name,
        category: data.category || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        zip: data.zip || null,
        email: data.email || null,
        phone: data.phone || null,
        website: data.website || null,
        description: data.description || null,
        visibility: data.visibility,
      },
    });

    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    console.error("Update beneficiary error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/beneficiaries/my-signups — student's own BeneficiarySignup records
router.get("/my-signups", authenticate, requireRole("STUDENT"), async (req: Request, res: Response) => {
  try {
    const signups = await prisma.beneficiarySignup.findMany({
      where: { studentId: req.user!.userId },
      include: {
        slot: {
          include: {
            opportunity: {
              include: {
                beneficiary: { select: { id: true, name: true, category: true } },
              },
            },
            _count: { select: { signups: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(signups);
  } catch (err) {
    console.error("My signups error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/beneficiaries/available-slots — future slots from school-approved beneficiaries (student)
router.get("/available-slots", authenticate, requireRole("STUDENT"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    let schoolId = user?.schoolId ?? null;
    if (!schoolId && user?.cohortId) {
      const cohort = await prisma.cohort.findUnique({ where: { id: user.cohortId }, select: { schoolId: true } });
      schoolId = cohort?.schoolId ?? null;
    }
    if (!schoolId && user?.classroomId) {
      const classroom = await prisma.classroom.findUnique({ where: { id: user.classroomId }, select: { schoolId: true } });
      schoolId = classroom?.schoolId ?? null;
    }
    if (!schoolId) return res.json([]);

    const approvals = await prisma.schoolBeneficiaryApproval.findMany({
      where: { schoolId, status: "APPROVED" },
      select: { beneficiaryId: true },
    });
    const beneficiaryIds = approvals.map((a) => a.beneficiaryId);
    if (!beneficiaryIds.length) return res.json([]);

    const now = new Date();
    const slots = await prisma.beneficiaryTimeSlot.findMany({
      where: {
        date: { gte: now },
        opportunity: {
          beneficiaryId: { in: beneficiaryIds },
          status: "ACTIVE",
        },
      },
      include: {
        opportunity: {
          include: {
            beneficiary: { select: { id: true, name: true, category: true } },
          },
        },
        _count: { select: { signups: true } },
      },
      orderBy: { date: "asc" },
    });
    res.json(slots);
  } catch (err) {
    console.error("Available slots error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/beneficiaries/import-csv — bulk import community partners
router.post("/import-csv", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const { csvData } = z.object({ csvData: z.string().min(1) }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user?.schoolId) return res.status(400).json({ error: "Not associated with a school" });

    let records: any[];
    try {
      records = parse(csvData, { columns: true, skip_empty_lines: true, trim: true });
    } catch {
      return res.status(400).json({ error: "Invalid CSV format" });
    }
    if (records.length === 0) return res.status(400).json({ error: "CSV has no data rows" });
    if (records.length > 500) return res.status(400).json({ error: "CSV exceeds 500 row limit" });

    const results = { added: 0, failed: 0, errors: [] as string[] };
    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const name = (row.organization_name || row.name || "").trim();
      if (!name) {
        results.errors.push(`Row ${i + 2}: missing organization_name or name`);
        results.failed++;
        continue;
      }
      try {
        const ben = await prisma.beneficiary.create({
          data: {
            name,
            category: (row.category || "").trim() || null,
            email: (row.contact_email || row.email)?.trim() || null,
            phone: (row.phone || row.phone_number)?.trim() || null,
            website: row.website?.trim() || null,
            address: row.address?.trim() || null,
            city: row.city?.trim() || null,
            state: row.state?.trim() || null,
            zip: (row.zip || row.zip_code)?.trim() || null,
            description: row.description?.trim() || null,
            visibility: ((row.visibility || "").trim().toUpperCase() === "PUBLIC" ? "PUBLIC" : "PRIVATE"),
            status: "ACTIVE",
            createdBySchoolId: user.schoolId,
          },
        });
        const approvalStatus = (row.approved || "").toLowerCase() === "true" ? "APPROVED" : "PENDING";
        await prisma.schoolBeneficiaryApproval.create({
          data: {
            schoolId: user.schoolId!,
            beneficiaryId: ben.id,
            status: approvalStatus,
            ...(approvalStatus === "APPROVED" ? { approvedAt: new Date() } : {}),
          },
        });
        results.added++;
      } catch (err: any) {
        results.errors.push(`Row ${i + 2}: ${err.message || "failed to create"}`);
        results.failed++;
      }
    }
    res.json(results);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    console.error("Import CSV error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/beneficiaries/slots/:slotId — get full slot details for student detail view
router.get("/slots/:slotId", authenticate, async (req: Request, res: Response) => {
  try {
    const slot = await prisma.beneficiaryTimeSlot.findUnique({
      where: { id: req.params.slotId },
      include: {
        opportunity: {
          include: {
            beneficiary: {
              select: { id: true, name: true, category: true, address: true, city: true, state: true, description: true, website: true, phone: true },
            },
          },
        },
        _count: { select: { signups: true } },
      },
    });
    if (!slot) return res.status(404).json({ error: "Slot not found" });

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { role: true, beneficiaryId: true, schoolId: true, cohort: { select: { schoolId: true } }, classroom: { select: { schoolId: true } } },
    });

    if (user?.role === "BENEFICIARY_ADMIN") {
      if (user.beneficiaryId !== slot.opportunity.beneficiary.id) {
        return res.status(403).json({ error: "Not your beneficiary's slot" });
      }
    } else {
      const schoolId = user?.classroom?.schoolId ?? user?.cohort?.schoolId ?? user?.schoolId ?? null;
      if (!schoolId) return res.status(403).json({ error: "Not associated with a school" });
      const approval = await prisma.schoolBeneficiaryApproval.findFirst({
        where: { schoolId, beneficiaryId: slot.opportunity.beneficiary.id, status: "APPROVED" },
        select: { id: true },
      });
      if (!approval) return res.status(403).json({ error: "This opportunity is not available at your school" });
    }

    let mySignup = null;
    if (user?.role === "STUDENT") {
      mySignup = await prisma.beneficiarySignup.findUnique({
        where: { slotId_studentId: { slotId: slot.id, studentId: req.user!.userId } },
        select: { id: true, status: true, verificationStatus: true },
      });
    }

    res.json({ ...slot, mySignup });
  } catch (err) {
    console.error("Get slot detail error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/beneficiaries/:id — get beneficiary details
router.get("/:id", authenticate, async (req: Request, res: Response) => {
  try {
    const ben = await prisma.beneficiary.findUnique({
      where: { id: req.params.id },
      include: {
        opportunities: {
          where: { status: "ACTIVE" },
          include: { timeSlots: { include: { _count: { select: { signups: true } } } } },
        },
        schoolApprovals: {
          select: { schoolId: true, status: true },
        },
      },
    });
    if (!ben) return res.status(404).json({ error: "Beneficiary not found" });

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { role: true, beneficiaryId: true, schoolId: true, cohort: { select: { schoolId: true } }, classroom: { select: { schoolId: true } } },
    });

    if (user?.role === "BENEFICIARY_ADMIN") {
      if (user.beneficiaryId !== ben.id) return res.status(403).json({ error: "Not your beneficiary" });
    } else {
      // School staff and students: require an APPROVED school-beneficiary relationship
      const schoolId = user?.classroom?.schoolId ?? user?.cohort?.schoolId ?? user?.schoolId ?? null;
      if (!schoolId) return res.status(403).json({ error: "Not associated with a school" });
      const approval = await prisma.schoolBeneficiaryApproval.findFirst({
        where: { schoolId, beneficiaryId: ben.id, status: "APPROVED" },
        select: { id: true },
      });
      if (!approval) return res.status(403).json({ error: "This beneficiary is not available to your school" });
    }

    // Strip cross-school approval details from response for non-BENEFICIARY_ADMIN callers
    const { schoolApprovals: _sa, ...benPublic } = ben as any;
    res.json(user?.role === "BENEFICIARY_ADMIN" ? ben : benPublic);
  } catch (err) {
    console.error("Get beneficiary error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/beneficiaries/approve-from-directory — school approves a directory beneficiary
router.post("/approve-from-directory", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const { directoryId } = z.object({ directoryId: z.string().min(1) }).parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user?.schoolId) return res.status(400).json({ error: "Not associated with a school" });

    const school = await prisma.school.findUnique({ where: { id: user.schoolId } });

    // Check if a Beneficiary already exists for this directory entry
    let beneficiary = await prisma.beneficiary.findFirst({ where: { directoryId } });
    if (!beneficiary) {
      const dirEntry = await prisma.beneficiaryDirectory.findUnique({ where: { id: directoryId } });
      if (!dirEntry) return res.status(404).json({ error: "Directory entry not found" });
      beneficiary = await prisma.beneficiary.create({
        data: {
          name: dirEntry.name,
          category: dirEntry.category || null,
          address: dirEntry.address || null,
          city: dirEntry.city || null,
          state: dirEntry.state || null,
          zip: dirEntry.zip || null,
          email: dirEntry.email || null,
          website: dirEntry.website || null,
          directoryId,
          visibility: "PUBLIC",
          status: "PENDING",
        },
      });
    }

    // Create a PENDING approval — status becomes APPROVED only when the beneficiary accepts the invitation.
    // This prevents unilateral approval: schools can only be considered approved once the beneficiary
    // explicitly accepts their partnership invitation.
    const approval = await prisma.schoolBeneficiaryApproval.upsert({
      where: { schoolId_beneficiaryId: { schoolId: user.schoolId, beneficiaryId: beneficiary.id } },
      update: {}, // don't downgrade an existing APPROVED record if they re-click
      create: { schoolId: user.schoolId, beneficiaryId: beneficiary.id, status: "PENDING" },
    });

    await prisma.auditLog.create({
      data: {
        action: "BENEFICIARY_INVITED",
        actorId: req.user!.userId,
        details: JSON.stringify({ beneficiaryId: beneficiary.id, schoolId: user.schoolId }),
      },
    });

    // Send invitation so the beneficiary can explicitly accept this school's partnership.
    // For unclaimed beneficiaries: email the beneficiary's contact address.
    // For claimed beneficiaries: email the existing admin account so they can accept the new partnership.
    const inviteEmail = beneficiary.claimed
      ? (await prisma.user.findFirst({ where: { beneficiaryId: beneficiary.id, role: "BENEFICIARY_ADMIN" }, select: { email: true } }))?.email ?? beneficiary.email
      : beneficiary.email;

    if (inviteEmail && approval.status === "PENDING") {
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      await prisma.beneficiaryInvitation.create({
        data: {
          schoolId: user.schoolId,
          beneficiaryId: beneficiary.id,
          token,
          expiresAt,
          sentTo: inviteEmail,
          status: "PENDING",
        },
      });
      const magicLink = `${CLIENT_URL}/join/beneficiary?token=${token}`;
      sendBeneficiaryInvitationEmail(
        inviteEmail,
        beneficiary.name,
        school?.name ?? "A school",
        magicLink,
        school?.partnerInviteTemplate ?? null
      ).catch(() => {});
    }

    res.json({ beneficiary, approval });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    console.error("Approve beneficiary error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/beneficiaries/:id/invite — send/resend invitation to an already-approved beneficiary
router.post("/:id/invite", authenticate, requireRole("SCHOOL_ADMIN"), beneficiaryInviteLimiter, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user?.schoolId) return res.status(400).json({ error: "Not associated with a school" });

    const ben = await prisma.beneficiary.findUnique({ where: { id: req.params.id } });
    if (!ben) return res.status(404).json({ error: "Beneficiary not found" });

    const school = await prisma.school.findUnique({
      where: { id: user.schoolId },
      select: { name: true, partnerInviteTemplate: true },
    });

    const { email, message } = z.object({
      email: z.string().email(),
      message: z.string().max(4000).optional(),
    }).parse(req.body);

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.beneficiaryInvitation.create({
      data: {
        schoolId: user.schoolId,
        beneficiaryId: ben.id,
        token,
        expiresAt,
        sentTo: email,
        status: "PENDING",
      },
    });

    const magicLink = `${CLIENT_URL}/join/beneficiary?token=${token}`;
    await sendBeneficiaryInvitationEmail(
      email,
      ben.name,
      school?.name ?? "A school",
      magicLink,
      message ?? school?.partnerInviteTemplate ?? null
    );

    res.json({ message: "Invitation sent" });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    console.error("Invite beneficiary error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/beneficiaries/:id/approve — approve a pending beneficiary for the school
router.post("/:id/approve", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user?.schoolId) return res.status(400).json({ error: "Not associated with a school" });

    const updated = await prisma.schoolBeneficiaryApproval.updateMany({
      where: { schoolId: user.schoolId, beneficiaryId: req.params.id },
      data: { status: "APPROVED", approvedAt: new Date() },
    });
    if (updated.count === 0) return res.status(404).json({ error: "Approval record not found" });

    await prisma.auditLog.create({
      data: {
        action: "BENEFICIARY_APPROVED",
        actorId: req.user!.userId,
        details: JSON.stringify({ beneficiaryId: req.params.id, schoolId: user.schoolId }),
      },
    });

    res.json({ message: "Beneficiary approved" });
  } catch (err) {
    console.error("Approve beneficiary error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/beneficiaries/:id/drop — remove beneficiary approval (school admin)
router.post("/:id/drop", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user?.schoolId) return res.status(400).json({ error: "Not associated with a school" });

    const [school, beneficiary] = await Promise.all([
      prisma.school.findUnique({ where: { id: user.schoolId }, select: { name: true } }),
      prisma.beneficiary.findUnique({ where: { id: req.params.id } }),
    ]);
    if (!beneficiary) return res.status(404).json({ error: "Beneficiary not found" });
    if (
      beneficiary.createdBySchoolId === user.schoolId &&
      beneficiary.visibility === "PRIVATE" &&
      school &&
      beneficiary.name === school.name
    ) {
      return res.status(400).json({ error: "This Partner account is used for tracking volunteer opportunities within the school." });
    }

    await prisma.schoolBeneficiaryApproval.updateMany({
      where: { schoolId: user.schoolId, beneficiaryId: req.params.id },
      data: { status: "REJECTED" },
    });

    res.json({ message: "Beneficiary removed from approved list" });
  } catch (err) {
    console.error("Drop beneficiary error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/beneficiaries/:id/schools — list approved schools for a beneficiary (beneficiary admin only)
router.get("/:id/schools", authenticate, requireRole("BENEFICIARY_ADMIN"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (user?.beneficiaryId !== req.params.id) return res.status(403).json({ error: "Not your beneficiary" });

    const approvals = await prisma.schoolBeneficiaryApproval.findMany({
      where: { beneficiaryId: req.params.id, status: "APPROVED" },
      include: { school: { select: { id: true, name: true } } },
    });

    res.json(approvals.map((a) => ({ id: a.school.id, name: a.school.name })));
  } catch (err) {
    console.error("List beneficiary schools error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/beneficiaries/:id/opportunities — list opportunities for a beneficiary
router.get("/:id/opportunities", authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { role: true, beneficiaryId: true, schoolId: true, cohort: { select: { schoolId: true } }, classroom: { select: { schoolId: true } } },
    });

    if (user?.role === "BENEFICIARY_ADMIN") {
      if (user.beneficiaryId !== req.params.id) return res.status(403).json({ error: "Not your beneficiary" });
    } else {
      const schoolId = user?.classroom?.schoolId ?? user?.cohort?.schoolId ?? user?.schoolId ?? null;
      if (!schoolId) return res.status(403).json({ error: "Not associated with a school" });
      const approval = await prisma.schoolBeneficiaryApproval.findFirst({
        where: { schoolId, beneficiaryId: req.params.id, status: "APPROVED" },
        select: { id: true },
      });
      if (!approval) return res.status(403).json({ error: "This beneficiary is not available to your school" });
    }

    const opportunities = await prisma.beneficiaryOpportunity.findMany({
      where: { beneficiaryId: req.params.id, status: { not: "CANCELLED" } },
      include: {
        timeSlots: {
          include: { _count: { select: { signups: true } } },
          orderBy: { date: "asc" },
        },
      },
      orderBy: { startDate: "asc" },
    });
    res.json(opportunities);
  } catch (err) {
    console.error("List beneficiary opportunities error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/beneficiaries/:id/opportunities — create opportunity (beneficiary admin only)
router.post("/:id/opportunities", authenticate, requireRole("BENEFICIARY_ADMIN"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (user?.beneficiaryId !== req.params.id) return res.status(403).json({ error: "Not your beneficiary" });

    const schema = z.object({
      title: z.string().min(1).max(255),
      description: z.string().max(2000),
      category: z.string().max(100).optional(),
      location: z.string().max(255).optional(),
      address: z.string().max(255).optional(),
      startDate: z.string(), // ISO date string
      endDate: z.string().optional(),
      requirementsNote: z.string().max(1000).optional(),
      schoolRestrictions: z.array(z.string()).optional(), // school IDs; null = all approved schools
      timeSlots: z.array(z.object({
        date: z.string(),
        startTime: z.string(),
        endTime: z.string(),
        durationHours: z.number().positive(),
        capacity: z.number().int().positive().default(10),
      })).min(1),
    });
    const data = schema.parse(req.body);

    const opp = await prisma.beneficiaryOpportunity.create({
      data: {
        title: data.title,
        description: data.description,
        beneficiaryId: req.params.id,
        category: data.category || null,
        location: data.location || null,
        address: data.address || null,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        requirementsNote: data.requirementsNote || null,
        schoolRestrictions: data.schoolRestrictions ? JSON.stringify(data.schoolRestrictions) : null,
        status: "ACTIVE",
        timeSlots: {
          create: data.timeSlots.map((ts) => ({
            date: new Date(ts.date),
            startTime: ts.startTime,
            endTime: ts.endTime,
            durationHours: ts.durationHours,
            capacity: ts.capacity,
          })),
        },
      },
      include: { timeSlots: true },
    });

    res.status(201).json(opp);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    console.error("Create opportunity error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/beneficiaries/:id/opportunities/:oppId — edit opportunity metadata
router.patch("/:id/opportunities/:oppId", authenticate, requireRole("BENEFICIARY_ADMIN"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (user?.beneficiaryId !== req.params.id) return res.status(403).json({ error: "Not your beneficiary" });

    const opp = await prisma.beneficiaryOpportunity.findUnique({ where: { id: req.params.oppId } });
    if (!opp || opp.beneficiaryId !== req.params.id) return res.status(404).json({ error: "Opportunity not found" });
    if (opp.status === "CANCELLED") return res.status(400).json({ error: "Cannot edit a cancelled opportunity" });

    const schema = z.object({
      title: z.string().min(1).max(255).optional(),
      description: z.string().max(2000).optional(),
      location: z.string().max(255).nullable().optional(),
      requirementsNote: z.string().max(1000).nullable().optional(),
      schoolRestrictions: z.array(z.string()).nullable().optional(),
    });
    const data = schema.parse(req.body);

    const updated = await prisma.beneficiaryOpportunity.update({
      where: { id: req.params.oppId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.requirementsNote !== undefined && { requirementsNote: data.requirementsNote }),
        ...(data.schoolRestrictions !== undefined && {
          schoolRestrictions: data.schoolRestrictions ? JSON.stringify(data.schoolRestrictions) : null,
        }),
      },
      include: { timeSlots: { include: { _count: { select: { signups: true } } }, orderBy: { date: "asc" } } },
    });

    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    console.error("Update opportunity error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/beneficiaries/:id/opportunities/:oppId — soft-delete (CANCELLED)
router.delete("/:id/opportunities/:oppId", authenticate, requireRole("BENEFICIARY_ADMIN"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (user?.beneficiaryId !== req.params.id) return res.status(403).json({ error: "Not your beneficiary" });

    const opp = await prisma.beneficiaryOpportunity.findUnique({
      where: { id: req.params.oppId },
      include: {
        timeSlots: {
          include: { signups: { where: { status: { in: ["CONFIRMED", "WAITLISTED"] } }, select: { id: true } } },
        },
      },
    });
    if (!opp || opp.beneficiaryId !== req.params.id) return res.status(404).json({ error: "Opportunity not found" });

    const hasActiveSignups = opp.timeSlots.some((slot) => slot.signups.length > 0);
    if (hasActiveSignups) {
      return res.status(400).json({ error: "Cannot delete an opportunity that has confirmed student signups." });
    }

    await prisma.beneficiaryOpportunity.update({
      where: { id: req.params.oppId },
      data: { status: "CANCELLED" },
    });

    res.json({ message: "Opportunity deleted" });
  } catch (err) {
    console.error("Delete opportunity error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/beneficiaries/slots/:slotId/signup — student signs up for a time slot
router.post("/slots/:slotId/signup", authenticate, requireRole("STUDENT"), async (req: Request, res: Response) => {
  try {
    const slot = await prisma.beneficiaryTimeSlot.findUnique({
      where: { id: req.params.slotId },
      include: {
        _count: { select: { signups: true } },
        opportunity: { select: { beneficiaryId: true, status: true, schoolRestrictions: true } },
      },
    });
    if (!slot) return res.status(404).json({ error: "Time slot not found" });
    if (slot.opportunity.status !== "ACTIVE") return res.status(400).json({ error: "This opportunity is no longer active" });

    // Resolve the student's school
    const studentUser = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { schoolId: true, cohort: { select: { schoolId: true } }, classroom: { select: { schoolId: true } } },
    });
    const studentSchoolId = studentUser?.classroom?.schoolId ?? studentUser?.cohort?.schoolId ?? studentUser?.schoolId ?? null;
    if (!studentSchoolId) {
      return res.status(403).json({ error: "You must be enrolled in a school to sign up for opportunities." });
    }

    // Verify the beneficiary is approved for the student's school
    const approval = await prisma.schoolBeneficiaryApproval.findFirst({
      where: { schoolId: studentSchoolId, beneficiaryId: slot.opportunity.beneficiaryId, status: "APPROVED" },
      select: { id: true },
    });
    if (!approval) {
      return res.status(403).json({ error: "This opportunity is not available at your school." });
    }

    // Enforce schoolRestrictions if the beneficiary set them
    if (slot.opportunity.schoolRestrictions) {
      let restrictions: string[] = [];
      try { restrictions = JSON.parse(slot.opportunity.schoolRestrictions); } catch { /* ignore malformed */ }
      if (restrictions.length > 0 && !restrictions.includes(studentSchoolId)) {
        return res.status(403).json({ error: "This opportunity is not open to your school." });
      }
    }

    const existing = await prisma.beneficiarySignup.findUnique({
      where: { slotId_studentId: { slotId: slot.id, studentId: req.user!.userId } },
    });
    if (existing) return res.status(409).json({ error: "Already signed up for this slot" });

    const confirmedCount = slot._count.signups;
    const status = confirmedCount >= slot.capacity ? "WAITLISTED" : "CONFIRMED";

    const signup = await prisma.beneficiarySignup.create({
      data: { slotId: slot.id, studentId: req.user!.userId, status },
    });

    res.status(201).json(signup);
  } catch (err) {
    console.error("Slot signup error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/beneficiaries/:id/signups — list signups for a beneficiary (beneficiary admin)
router.get("/:id/signups", authenticate, requireRole("BENEFICIARY_ADMIN"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (user?.beneficiaryId !== req.params.id) return res.status(403).json({ error: "Not your beneficiary" });

    const statusFilter = req.query.status as string | undefined;
    const signups = await prisma.beneficiarySignup.findMany({
      where: {
        slot: { opportunity: { beneficiaryId: req.params.id } },
        ...(statusFilter ? { verificationStatus: statusFilter } : {}),
      },
      include: {
        slot: {
          include: {
            opportunity: { select: { title: true } },
          },
        },
        // student info via relation not defined, fetch separately
      },
      orderBy: { createdAt: "desc" },
    });

    const result = signups.map((s) => ({
      ...s,
      student: { label: buildAnonymousVolunteerLabel(s.id) },
    }));

    res.json(result);
  } catch (err) {
    console.error("List beneficiary signups error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/beneficiaries/signups/:signupId/approve — beneficiary admin approves hours
router.post("/signups/:signupId/approve", authenticate, requireRole("BENEFICIARY_ADMIN"), async (req: Request, res: Response) => {
  try {
    const signup = await prisma.beneficiarySignup.findUnique({
      where: { id: req.params.signupId },
      include: { slot: { include: { opportunity: true } } },
    });
    if (!signup) return res.status(404).json({ error: "Signup not found" });

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (user?.beneficiaryId !== signup.slot.opportunity.beneficiaryId) {
      return res.status(403).json({ error: "Not your beneficiary's signup" });
    }

    const { approvedHours, overrideCap } = z.object({
      approvedHours: z.number().positive().optional(),
      overrideCap: z.boolean().optional(),
    }).parse(req.body);
    if (approvedHours !== undefined && approvedHours > signup.slot.durationHours) {
      return res.status(400).json({ error: `approvedHours cannot exceed the slot duration of ${signup.slot.durationHours}h` });
    }
    const hours = approvedHours ?? signup.slot.durationHours;

    // Category cap check
    if (!overrideCap) {
      const category = signup.slot.opportunity.category;
      const capCheck = await checkCategoryCap(signup.studentId, category, hours);
      if (capCheck.exceeded) {
        return res.status(400).json({
          error: `Approval would exceed the "${capCheck.category}" category cap of ${capCheck.cap} hours (current: ${capCheck.current.toFixed(1)}h, adding: ${hours}h). Pass overrideCap: true to bypass.`,
          capExceeded: true,
          cap: capCheck.cap,
          current: capCheck.current,
          category: capCheck.category,
        });
      }
    }

    const updated = await prisma.beneficiarySignup.update({
      where: { id: req.params.signupId },
      data: {
        verificationStatus: "APPROVED",
        totalHours: hours,
        verifiedBy: req.user!.userId,
        verifiedAt: new Date(),
      },
    });

    await prisma.beneficiaryAuditLog.create({
      data: {
        action: overrideCap ? "CAP_OVERRIDE" : "APPROVE",
        actorId: req.user!.userId,
        signupId: signup.id,
        details: JSON.stringify({
          approvedHours: hours,
          originalHours: signup.slot.durationHours,
          ...(overrideCap ? { capOverride: true } : {}),
        }),
      },
    });

    res.json(updated);
  } catch (err) {
    console.error("Approve signup error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/beneficiaries/:id/invitations — list school invitations for this beneficiary
router.get("/:id/invitations", authenticate, requireRole("BENEFICIARY_ADMIN"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (user?.beneficiaryId !== req.params.id) return res.status(403).json({ error: "Not your beneficiary" });

    const invitations = await prisma.beneficiaryInvitation.findMany({
      where: { beneficiaryId: req.params.id },
      orderBy: { createdAt: "desc" },
    });

    // Attach school names
    const schoolIds = [...new Set(invitations.map((inv) => inv.schoolId))];
    const schools = await prisma.school.findMany({
      where: { id: { in: schoolIds } },
      select: { id: true, name: true },
    });
    const schoolMap = new Map(schools.map((s) => [s.id, s.name]));

    const deduped = new Map<string, typeof invitations[number]>();
    for (const inv of invitations) {
      const current = deduped.get(inv.schoolId);
      if (!current) {
        deduped.set(inv.schoolId, inv);
        continue;
      }

      const currentScore = current.status === "ACCEPTED" ? 3 : current.status === "PENDING" ? 2 : 1;
      const nextScore = inv.status === "ACCEPTED" ? 3 : inv.status === "PENDING" ? 2 : 1;
      if (nextScore > currentScore) {
        deduped.set(inv.schoolId, inv);
      }
    }

    const result = [...deduped.values()].map((inv) => ({
      ...inv,
      schoolName: schoolMap.get(inv.schoolId) ?? "Unknown School",
    }));

    res.json(result);
  } catch (err) {
    console.error("List invitations error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/beneficiaries/invitations/:invId/respond — accept or decline an invitation
router.post("/invitations/:invId/respond", authenticate, requireRole("BENEFICIARY_ADMIN"), async (req: Request, res: Response) => {
  try {
    const { action } = z.object({ action: z.enum(["ACCEPTED", "DECLINED"]) }).parse(req.body);

    const inv = await prisma.beneficiaryInvitation.findUnique({ where: { id: req.params.invId } });
    if (!inv) return res.status(404).json({ error: "Invitation not found" });

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (user?.beneficiaryId !== inv.beneficiaryId) return res.status(403).json({ error: "Not your invitation" });

    const updated = await prisma.beneficiaryInvitation.update({
      where: { id: inv.id },
      data: {
        status: action,
        respondedAt: new Date(),
        ...(action === "ACCEPTED" ? { acceptedAt: new Date() } : {}),
      },
    });

    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    console.error("Respond invitation error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/beneficiaries/:id/profile — beneficiary admin updates their profile
router.patch("/:id/profile", authenticate, requireRole("BENEFICIARY_ADMIN"), async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (user?.beneficiaryId !== req.params.id) return res.status(403).json({ error: "Not your beneficiary" });

    const schema = z.object({
      name: z.string().min(1).max(255).optional(),
      email: z.string().email().optional().or(z.literal("")),
      phone: z.string().max(20).optional(),
      description: z.string().max(1000).optional(),
      website: z.string().max(255).optional(),
      address: z.string().max(255).optional(),
      city: z.string().max(100).optional(),
      state: z.string().max(50).optional(),
      zip: z.string().regex(/^\d{5}$/).optional().or(z.literal("")),
    });
    const data = schema.parse(req.body);

    const updated = await prisma.beneficiary.update({
      where: { id: req.params.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.email !== undefined ? { email: data.email || null } : {}),
        ...(data.phone !== undefined ? { phone: data.phone || null } : {}),
        ...(data.description !== undefined ? { description: data.description || null } : {}),
        ...(data.website !== undefined ? { website: data.website || null } : {}),
        ...(data.address !== undefined ? { address: data.address || null } : {}),
        ...(data.city !== undefined ? { city: data.city || null } : {}),
        ...(data.state !== undefined ? { state: data.state || null } : {}),
        ...(data.zip !== undefined ? { zip: data.zip || null } : {}),
      },
    });

    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    console.error("Update beneficiary profile error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/beneficiaries/signups/:signupId/reject — beneficiary admin rejects hours
router.post("/signups/:signupId/reject", authenticate, requireRole("BENEFICIARY_ADMIN"), async (req: Request, res: Response) => {
  try {
    const signup = await prisma.beneficiarySignup.findUnique({
      where: { id: req.params.signupId },
      include: { slot: { include: { opportunity: true } } },
    });
    if (!signup) return res.status(404).json({ error: "Signup not found" });

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (user?.beneficiaryId !== signup.slot.opportunity.beneficiaryId) {
      return res.status(403).json({ error: "Not your beneficiary's signup" });
    }

    const { reason } = z.object({ reason: z.string().min(1) }).parse(req.body);

    const updated = await prisma.beneficiarySignup.update({
      where: { id: req.params.signupId },
      data: {
        verificationStatus: "REJECTED",
        rejectionReason: reason,
        verifiedBy: req.user!.userId,
        verifiedAt: new Date(),
      },
    });

    await prisma.beneficiaryAuditLog.create({
      data: {
        action: "REJECT",
        actorId: req.user!.userId,
        signupId: signup.id,
        details: JSON.stringify({ reason }),
      },
    });

    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    console.error("Reject signup error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/beneficiaries/signups/:signupId/history — verification history for a beneficiary signup
router.get("/signups/:signupId/history", authenticate, async (req: Request, res: Response) => {
  try {
    const actor = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, role: true, schoolId: true, beneficiaryId: true },
    });
    if (!actor) return res.status(404).json({ error: "User not found" });

    const signup = await prisma.beneficiarySignup.findUnique({
      where: { id: req.params.signupId },
      include: {
        slot: {
          include: {
            opportunity: {
              include: {
                beneficiary: { select: { id: true, name: true, category: true } },
              },
            },
          },
        },
      },
    });
    if (!signup) return res.status(404).json({ error: "Signup not found" });

    if (actor.role === "BENEFICIARY_ADMIN") {
      if (actor.beneficiaryId !== signup.slot.opportunity.beneficiaryId) {
        return res.status(403).json({ error: "Not your beneficiary's signup" });
      }
    } else if (["SCHOOL_ADMIN", "TEACHER"].includes(actor.role)) {
      const studentSchoolId = await resolveStudentSchoolId(signup.studentId);
      if (!actor.schoolId || studentSchoolId !== actor.schoolId) {
        return res.status(403).json({ error: "Student is not enrolled in your school" });
      }
    } else if (actor.role === "STUDENT") {
      if (signup.studentId !== actor.id) {
        return res.status(403).json({ error: "Not your verification history" });
      }
    } else {
      return res.status(403).json({ error: "Access denied" });
    }

    const history = await prisma.beneficiaryAuditLog.findMany({
        where: { signupId: signup.id },
        orderBy: { createdAt: "asc" },
      });
    const actorIds = [...new Set(history.map((entry) => entry.actorId))];
    const actors = actorIds.length
      ? await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true, role: true },
        })
      : [];
    const actorMap = new Map(actors.map((actor) => [actor.id, actor]));

    res.json({
      signup: {
        id: signup.id,
        status: signup.status,
        verificationStatus: signup.verificationStatus,
        totalHours: signup.totalHours,
        rejectionReason: signup.rejectionReason,
        checkedIn: signup.checkedIn,
        checkedOut: signup.checkedOut,
        verifiedAt: signup.verifiedAt,
        student: actor.role === "BENEFICIARY_ADMIN"
          ? { label: buildAnonymousVolunteerLabel(signup.id) }
          : { id: signup.studentId, label: buildAnonymousVolunteerLabel(signup.id) },
        slot: {
          id: signup.slot.id,
          date: signup.slot.date,
          startTime: signup.slot.startTime,
          endTime: signup.slot.endTime,
          durationHours: signup.slot.durationHours,
          opportunity: {
            title: signup.slot.opportunity.title,
            category: signup.slot.opportunity.category,
            beneficiary: signup.slot.opportunity.beneficiary,
          },
        },
      },
      history: history.map((entry) => ({
        id: entry.id,
        action: entry.action,
        details: entry.details,
        createdAt: entry.createdAt,
        actor: actorMap.get(entry.actorId) ?? { id: entry.actorId, name: "Unknown", role: "UNKNOWN" },
      })),
    });
  } catch (err) {
    console.error("Beneficiary signup history error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/beneficiaries/signups/:signupId/cancel — student cancels their signup (promotes next waitlisted)
router.post("/signups/:signupId/cancel", authenticate, requireRole("STUDENT"), async (req: Request, res: Response) => {
  try {
    const signup = await prisma.beneficiarySignup.findUnique({
      where: { id: req.params.signupId },
      include: { slot: true },
    });
    if (!signup) return res.status(404).json({ error: "Signup not found" });
    if (signup.studentId !== req.user!.userId) return res.status(403).json({ error: "Not your signup" });
    if (signup.status === "CANCELLED") return res.status(400).json({ error: "Already cancelled" });
    if (signup.verificationStatus === "APPROVED") return res.status(400).json({ error: "Cannot cancel an already-approved signup" });

    await prisma.beneficiarySignup.update({
      where: { id: signup.id },
      data: { status: "CANCELLED" },
    });

    // Promote the earliest waitlisted student if this was a CONFIRMED slot
    if (signup.status === "CONFIRMED") {
      const nextWaitlisted = await prisma.beneficiarySignup.findFirst({
        where: { slotId: signup.slotId, status: "WAITLISTED" },
        orderBy: { createdAt: "asc" },
      });
      if (nextWaitlisted) {
        await prisma.beneficiarySignup.update({
          where: { id: nextWaitlisted.id },
          data: { status: "CONFIRMED" },
        });
        // Notify the promoted student
        await prisma.notification.create({
          data: {
            userId: nextWaitlisted.studentId,
            type: "SIGNUP_CONFIRMED",
            title: "You're off the waitlist!",
            body: `A spot opened up and you're now confirmed for "${signup.slot.startTime}–${signup.slot.endTime}" on ${new Date(signup.slot.date).toLocaleDateString()}.`,
          },
        });
      }
    }

    res.json({ message: "Signup cancelled" });
  } catch (err) {
    console.error("Cancel signup error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/beneficiaries/signups/:signupId/no-show — beneficiary admin marks student as no-show
router.post("/signups/:signupId/no-show", authenticate, requireRole("BENEFICIARY_ADMIN"), async (req: Request, res: Response) => {
  try {
    const signup = await prisma.beneficiarySignup.findUnique({
      where: { id: req.params.signupId },
      include: { slot: { include: { opportunity: true } } },
    });
    if (!signup) return res.status(404).json({ error: "Signup not found" });

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (user?.beneficiaryId !== signup.slot.opportunity.beneficiaryId) {
      return res.status(403).json({ error: "Not your beneficiary's signup" });
    }
    if (signup.status === "CANCELLED") return res.status(400).json({ error: "Cannot mark a cancelled signup as no-show" });
    if (signup.status === "WAITLISTED") return res.status(400).json({ error: "Waitlisted signups cannot be marked as no-show" });
    if (signup.status === "NO_SHOW") return res.status(400).json({ error: "Student is already marked as a no-show" });
    if (signup.verificationStatus === "APPROVED") {
      return res.status(400).json({ error: "Approved hours cannot be converted to a no-show" });
    }

    const updated = await prisma.beneficiarySignup.update({
      where: { id: signup.id },
      data: {
        status: "NO_SHOW",
        checkedOut: false,
        checkedOutAt: null,
        totalHours: null,
      },
    });

    await prisma.beneficiaryAuditLog.create({
      data: {
        action: "NO_SHOW",
        actorId: req.user!.userId,
        signupId: signup.id,
        details: JSON.stringify({ studentId: signup.studentId }),
      },
    });

    res.json(updated);
  } catch (err) {
    console.error("No-show error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
