import { Router, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import crypto from "crypto";
import { generateToken, hashToken } from "../lib/tokenHash";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { parse } from "csv-parse/sync";
import multer from "multer";
import prisma from "../lib/prisma";
import { isPrismaKnownRequestError } from "../lib/prismaErrors";
import { runSerializableTransaction } from "../lib/serializableTransaction";
import { canRemoveBeneficiaryAdmin } from "../lib/beneficiaryAdminPolicy";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { sendBeneficiaryInvitationEmail, sendBeneficiaryAdminInvitationEmail, CLIENT_URL } from "../services/email";
import {
  getOrgTier,
  getOrgTierLimits,
  requireOrgFeature,
  ForbiddenFeatureError,
  sendForbiddenFeature,
  ORGANIZATION_TIER_LIMITS,
  DEFAULT_FREE_REMINDERS,
  DEFAULT_PRO_REMINDERS,
} from "../lib/orgTierGates";
import { geocodeAddress } from "../lib/geocode";
import { checkCategoryCap, getBlockedCategoryKeysForStudent, normalizeCategoryKey } from "../lib/schoolRules";
import { resolveStudentSchoolId, logDataAccess } from "../lib/dataAccessLog";
import { resolveOpportunityCategory } from "../lib/opportunityCategories";
import { toLegacyAvailableSlot } from "../lib/legacyOpportunityAvailability";
import { detectMimeType } from "../lib/detectMimeType";
import { isDevMode } from "../lib/env";
import { createHybridRateLimit } from "../middleware/rateLimit";
import { resolveWritableUploadDir } from "../lib/runtimeStorage";

const UPLOAD_DIR = resolveWritableUploadDir("beneficiary-attachments");

const MAX_FILE_SIZE = 10 * 1024 * 1024;        // 10 MB per file
const MAX_FILES_PER_UPLOAD = 5;
const MAX_TOTAL_PER_UPLOAD = 25 * 1024 * 1024; // 25 MB per request

const ABUSE_STRIKE_THRESHOLD = 5;
const SUSPENSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Derived from centralized tier gates — single source of truth
const TIER_LIMITS = {
  FREE: {
    storageBytes: ORGANIZATION_TIER_LIMITS.FREE.storageLimitBytes,
    uploadsPerHour: ORGANIZATION_TIER_LIMITS.FREE.uploadAttemptsPerHour,
  },
  PRO: {
    storageBytes: ORGANIZATION_TIER_LIMITS.PRO.storageLimitBytes,
    uploadsPerHour: ORGANIZATION_TIER_LIMITS.PRO.uploadAttemptsPerHour,
  },
} as const;

// Multer: disk storage only (never memory), enforce hard size cap server-side.
// fileFilter is intentionally permissive here — real MIME detection happens
// after the file lands on disk via magic bytes.
const attachmentUpload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, _file, cb) => cb(null, crypto.randomUUID()),
  }),
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES_PER_UPLOAD },
});

async function recordAbuseStrike(beneficiaryId: string): Promise<void> {
  const ben = await prisma.beneficiary.update({
    where: { id: beneficiaryId },
    data: { uploadAbuseStrikes: { increment: 1 } },
    select: { uploadAbuseStrikes: true },
  });
  if (ben.uploadAbuseStrikes >= ABUSE_STRIKE_THRESHOLD) {
    await prisma.beneficiary.update({
      where: { id: beneficiaryId },
      data: { uploadSuspendedUntil: new Date(Date.now() + SUSPENSION_DURATION_MS) },
    });
    console.warn(`[upload] Beneficiary ${beneficiaryId} suspended after ${ABUSE_STRIKE_THRESHOLD} abuse strikes.`);
  }
}

function sha256ofFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

function toStoredBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(Array.from(bytes));
}

function normalizeInviteEmail(email: unknown): string {
  return typeof email === "string" && email.trim()
    ? email.trim().toLowerCase()
    : "unknown";
}

// ─── FERPA Helpers ───────────────────────────────────────────────

function pseudonymousStudentLabel(studentId: string): string {
  const hash = crypto.createHash("sha256").update(studentId).digest("hex");
  return `Student-${hash.slice(0, 8)}`;
}

async function isBeneficiaryPiiEnabled(beneficiaryId: string): Promise<boolean> {
  const approvals = await prisma.schoolBeneficiaryApproval.findMany({
    where: { beneficiaryId, status: "APPROVED" },
    include: {
      school: {
        select: { ferpaBeneficiaryPiiEnabled: true },
      },
    },
  });
  return approvals.some((a) => a.school.ferpaBeneficiaryPiiEnabled);
}

// 10 invitations per school admin/recipient pair per hour — prevents inbox-bombing a beneficiary contact
const beneficiaryInviteLimiter = createHybridRateLimit({
  namespace: "ben-invite",
  windowMs: 60 * 60 * 1000,
  maxPerIp: 25,
  maxPerUser: 10,
  keySuffix: (req) => normalizeInviteEmail(req.body?.email),
});

const router = Router();

function getSlotStartAt(slotDate: Date, startTime: string): Date {
  const [hours, minutes] = startTime.split(":").map(Number);
  const startAt = new Date(slotDate);
  startAt.setUTCHours(hours, minutes, 0, 0);
  return startAt;
}

function getSlotEndAt(slotDate: Date, endTime: string): Date {
  const [hours, minutes] = endTime.split(":").map(Number);
  const endAt = new Date(slotDate);
  endAt.setUTCHours(hours, minutes, 0, 0);
  return endAt;
}

function getBeneficiarySignupDisplayStatus(signup: {
  status: string;
  verificationStatus: string;
}): string {
  if (signup.status === "NO_SHOW") return "No-Show";
  if (signup.verificationStatus === "APPROVED") return "Approved";
  if (signup.verificationStatus === "REJECTED") return "Denied";
  return "Pending";
}

async function notifyBeneficiarySignupReviewChange(params: {
  studentId: string;
  opportunityTitle: string;
  slotDate: Date;
  fromStatus: string;
  toStatus: string;
  approvedHours?: number | null;
  rejectionReason?: string | null;
}) {
  const dateLabel = params.slotDate.toLocaleDateString();
  let body = `"${params.opportunityTitle}" on ${dateLabel} changed from ${params.fromStatus} to ${params.toStatus}.`;
  if (params.toStatus === "Approved" && params.approvedHours != null) {
    body = `"${params.opportunityTitle}" on ${dateLabel} was approved for ${params.approvedHours} hour${params.approvedHours === 1 ? "" : "s"}.`;
  } else if (params.toStatus === "Denied" && params.rejectionReason) {
    body = `"${params.opportunityTitle}" on ${dateLabel} was denied. Reason: ${params.rejectionReason}`;
  } else if (params.toStatus === "Pending") {
    body = `"${params.opportunityTitle}" on ${dateLabel} was returned to pending review.`;
  } else if (params.toStatus === "No-Show") {
    body = `"${params.opportunityTitle}" on ${dateLabel} was marked as a no-show.`;
  }

  await prisma.notification.create({
    data: {
      userId: params.studentId,
      type: "VERIFICATION_UPDATE",
      title: `Hours status updated: ${params.toStatus}`,
      body,
      data: JSON.stringify({
        fromStatus: params.fromStatus,
        toStatus: params.toStatus,
        approvedHours: params.approvedHours ?? null,
        rejectionReason: params.rejectionReason ?? null,
      }),
    },
  });
}

async function canManageBeneficiary(userId: string, beneficiaryId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return false;
  if (user.role === "SCHOOL_ADMIN" && user.schoolId) {
    const ben = await prisma.beneficiary.findFirst({
      where: { id: beneficiaryId, createdBySchoolId: user.schoolId, visibility: "PRIVATE" },
    });
    return ben !== null;
  }
  return user.beneficiaryId === beneficiaryId;
}

async function cancelBeneficiarySlot(
  slotId: string,
  beneficiaryId: string,
  actorUserId: string,
  forceCancel: boolean,
) {
  const slot = await prisma.beneficiaryTimeSlot.findUnique({
    where: { id: slotId },
    include: {
      opportunity: { select: { beneficiaryId: true, title: true, beneficiary: { select: { name: true } } } },
      signups: {
        where: { status: { in: ["CONFIRMED", "WAITLISTED"] } },
        select: { id: true, studentId: true, status: true },
      },
    },
  });
  if (!slot || slot.opportunity.beneficiaryId !== beneficiaryId) {
    return { status: 404 as const, body: { error: "Time slot not found" } };
  }

  if (!await canManageBeneficiary(actorUserId, beneficiaryId)) {
    return { status: 403 as const, body: { error: "Not your beneficiary" } };
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  if (slot.date <= cutoff) {
    return { status: 400 as const, body: { error: "Can only delete slots more than 24 hours in the future" } };
  }

  if (slot.signups.length > 0 && !forceCancel) {
    return {
      status: 409 as const,
      body: {
        error: "This slot has students signed up. Confirm cancellation to remove the slot and notify them.",
        code: "SLOT_HAS_SIGNUPS",
        affectedSignupCount: slot.signups.length,
      },
    };
  }

  await runSerializableTransaction(async (tx) => {
    if (slot.signups.length > 0) {
      const signupIds = slot.signups.map((signup) => signup.id);
      await tx.beneficiaryAuditLog.deleteMany({
        where: { signupId: { in: signupIds } },
      });
      await tx.beneficiarySignup.deleteMany({
        where: { id: { in: slot.signups.map((signup) => signup.id) } },
      });
    }

    await tx.beneficiaryTimeSlot.delete({ where: { id: slotId } });
  });

  const affectedStudentIds = [...new Set(slot.signups.map((signup) => signup.studentId))];
  if (affectedStudentIds.length > 0) {
    const formattedDate = slot.date.toLocaleDateString();
    await prisma.notification.createMany({
      data: affectedStudentIds.map((studentId) => ({
        userId: studentId,
        type: "OPPORTUNITY_CANCELLED",
        title: "Time slot cancelled",
        body: `${slot.opportunity.beneficiary.name} cancelled "${slot.opportunity.title}" on ${formattedDate} from ${slot.startTime} to ${slot.endTime}. Your signup has been removed.`,
      })),
    });
  }

  return {
    status: 200 as const,
    body: { success: true, cancelledSignupCount: slot.signups.length },
  };
}

// ─── Background city geocoding ────────────────────────────────────────────────
// Tracks which US states currently have a background geocoding job running.
// When a school in an ungeocoded state searches for nearby orgs, we kick off
// a background job that geocodes every city in that state (city-center accuracy).
// Subsequent searches in that state return real results.

const geocodingStates = new Set<string>();

async function geocodeStateBackground(state: string): Promise<void> {
  try {
    const cities = await prisma.$queryRawUnsafe(
      `SELECT DISTINCT city, state FROM "BeneficiaryDirectory"
       WHERE state = $1 AND active = true AND latitude IS NULL AND city IS NOT NULL
       ORDER BY city`,
      state
    ) as Array<{ city: string; state: string }>;
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
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        role: true,
        schoolId: true,
        cohortId: true,
        beneficiaryId: true,
      },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.role === "BENEFICIARY_ADMIN") {
      if (!user.beneficiaryId) return res.json([]);
      const ben = await prisma.beneficiary.findUnique({ where: { id: user.beneficiaryId } });
      return res.json(ben ? [ben] : []);
    }

    const schoolId = user.role === "STUDENT"
      ? await resolveStudentSchoolId(user.id)
      : user.schoolId;

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
    const limit = parseInt((req.query.limit as string) || "10000", 10);
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
    const [countResult] = (await prisma.$queryRawUnsafe(countSql, ...baseParams)) as Array<{ total: number }>;
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
      include: { school: { select: { id: true, state: true, directoryId: true } } },
    });
    const schoolId = user?.schoolId;
    const schoolState = (user as any)?.school?.state as string | null;

    // A registered school is also linked to a BeneficiaryDirectory row so it can
    // appear as a partner to other schools. Do not show that row back to its
    // owner: the school's private beneficiary and approval are created by
    // default during registration.
    const ownSchoolBeneficiary = schoolId
      ? await prisma.beneficiary.findFirst({
          where: { createdBySchoolId: schoolId, visibility: "PRIVATE" },
          select: { directoryId: true },
        })
      : null;
    let ownSchoolDirectoryId = ownSchoolBeneficiary?.directoryId ?? null;
    if (!ownSchoolDirectoryId && user?.school?.directoryId) {
      const schoolDirectory = await prisma.schoolDirectory.findUnique({
        where: { id: user.school.directoryId },
        select: { ncessId: true },
      });
      if (schoolDirectory?.ncessId) {
        ownSchoolDirectoryId = (await prisma.beneficiaryDirectory.findUnique({
          where: { ncessId: schoolDirectory.ncessId },
          select: { id: true },
        }))?.id ?? null;
      }
    }
    const visibleResults = ownSchoolDirectoryId
      ? results.filter((result: any) => result.id !== ownSchoolDirectoryId)
      : results;

    let geocodingInProgress = false;
    if (results.length === 0 && schoolState && !geocodingStates.has(schoolState)) {
      // Check if there are ungeocoded entries in this state
      const [{ cnt }] = (await prisma.$queryRawUnsafe(
        `SELECT COUNT(*) as cnt FROM "BeneficiaryDirectory" WHERE state = $1 AND latitude IS NULL LIMIT 1`,
        schoolState
      )) as Array<{ cnt: string }>;
      if (parseInt(cnt) > 0) {
        geocodingStates.add(schoolState);
        geocodeStateBackground(schoolState); // fire and forget — no await
        geocodingInProgress = true;
      }
    }

    let approvalMap = new Map<string, string>(); // directoryId -> approval status
    if (schoolId) {
      const dirIds = visibleResults.map((r: any) => r.id);
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

    const annotated = visibleResults.map((r: any) => ({
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
      entityType: "org" as const,
    }));

    // Also include nearby schools (using their stored lat/lng)
    const nearbySchools: any[] = schoolId
      ? await prisma.$queryRawUnsafe(
          `SELECT s.id, s.name, s.address, s.city, s.state, s.zip, s.latitude, s.longitude,
                  (3959 * acos(LEAST(1.0, cos(radians($1)) * cos(radians(s.latitude)) * cos(radians(s.longitude) - radians($2)) + sin(radians($1)) * sin(radians(s.latitude))))) AS distance_miles
           FROM "School" s
           WHERE s.id != $4
             AND s.latitude IS NOT NULL AND s.longitude IS NOT NULL
             AND (3959 * acos(LEAST(1.0, cos(radians($1)) * cos(radians(s.latitude)) * cos(radians(s.longitude) - radians($2)) + sin(radians($1)) * sin(radians(s.latitude))))) < $3
           ORDER BY distance_miles ASC
           LIMIT 50`,
          lat, lng, radius, schoolId
        )
      : [];

    // Check existing partner request status for each nearby school
    const schoolPartnerStatuses = new Map<string, string>();
    if (schoolId && nearbySchools.length > 0) {
      const ids = nearbySchools.map((s: any) => s.id);
      const requests = await prisma.schoolPartnerRequest.findMany({
        where: {
          OR: [
            { fromSchoolId: schoolId, toSchoolId: { in: ids } },
            { toSchoolId: schoolId, fromSchoolId: { in: ids } },
          ],
        },
      });
      for (const r of requests) {
        const otherId = r.fromSchoolId === schoolId ? r.toSchoolId : r.fromSchoolId;
        schoolPartnerStatuses.set(otherId, r.status);
      }
    }

    const annotatedSchools = nearbySchools.map((s: any) => ({
      id: s.id,
      name: s.name,
      category: "School",
      address: s.address,
      city: s.city,
      state: s.state,
      zip: s.zip,
      latitude: parseFloat(s.latitude),
      longitude: parseFloat(s.longitude),
      distanceMiles: Math.round(parseFloat(s.distance_miles) * 10) / 10,
      entityType: "school" as const,
      partnerStatus: schoolPartnerStatuses.get(s.id) ?? null,
    }));

    const allItems = [...annotated, ...annotatedSchools].sort((a, b) => a.distanceMiles - b.distanceMiles);

    const ownSchoolWasInResults = ownSchoolDirectoryId !== null
      && results.some((result: any) => result.id === ownSchoolDirectoryId);
    const visibleDirectoryTotal = Math.max(0, total - (ownSchoolWasInResults ? 1 : 0));
    res.json({ items: allItems, total: visibleDirectoryTotal + nearbySchools.length, geocodingInProgress });
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
        status: "APPROVED",
        approvedAt: new Date(),
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
        auditLogs: {
          orderBy: { createdAt: "desc" },
        },
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
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { id: true, schoolId: true } });
    let schoolId = user?.schoolId ?? null;
    if (!schoolId && user) {
      schoolId = await resolveStudentSchoolId(user.id);
    }
    if (!schoolId) return res.json([]);

    const [approvals, legacyApprovals] = await Promise.all([
      prisma.schoolBeneficiaryApproval.findMany({
        where: { schoolId, status: "APPROVED" },
        select: { beneficiaryId: true },
      }),
      prisma.schoolOrganization.findMany({
        where: { schoolId, status: "APPROVED" },
        select: { organizationId: true },
      }),
    ]);
    const beneficiaryIds = approvals.map((a) => a.beneficiaryId);
    const legacyOrganizationIds = legacyApprovals.map((a) => a.organizationId);
    if (!beneficiaryIds.length && !legacyOrganizationIds.length) return res.json([]);

    const now = new Date();
    const startOfTodayUtc = new Date(now);
    startOfTodayUtc.setUTCHours(0, 0, 0, 0);
    const [slots, blockedCategoryKeys, legacyOpportunities] = await Promise.all([
      prisma.beneficiaryTimeSlot.findMany({
      where: {
        date: { gte: startOfTodayUtc },
        opportunity: {
          beneficiaryId: { in: beneficiaryIds },
          status: "ACTIVE",
        },
      },
      include: {
        opportunity: {
          include: {
            beneficiary: { select: { id: true, name: true, category: true, planTier: true } },
          },
        },
        _count: { select: { signups: { where: { status: "CONFIRMED" } } } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      }),
      getBlockedCategoryKeysForStudent(req.user!.userId),
      legacyOrganizationIds.length
        ? prisma.opportunity.findMany({
            where: {
              organizationId: { in: legacyOrganizationIds },
              status: "ACTIVE",
              date: { gte: startOfTodayUtc },
            },
            include: {
              organization: { select: { id: true, name: true } },
              _count: { select: { signups: { where: { status: "CONFIRMED" } } } },
            },
            orderBy: [{ date: "asc" }, { startTime: "asc" }],
          })
        : Promise.resolve([]),
    ]);
    const beneficiarySlots = slots.filter((slot) => {
      if (getSlotStartAt(slot.date, slot.startTime) < now) return false;
      const categoryKey = normalizeCategoryKey(slot.opportunity.category);
      return !blockedCategoryKeys.has(categoryKey);
    });
    const legacySlots = legacyOpportunities
      .filter((opportunity) => getSlotStartAt(opportunity.date, opportunity.startTime) >= now)
      .map((opportunity) => toLegacyAvailableSlot({
        ...opportunity,
        confirmedSignupCount: opportunity._count.signups,
      }));
    res.json(
      [...beneficiarySlots, ...legacySlots].sort((a, b) => {
        const dateDifference = new Date(a.date).getTime() - new Date(b.date).getTime();
        return dateDifference || a.startTime.localeCompare(b.startTime);
      }),
    );
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
      select: { id: true, role: true, beneficiaryId: true, schoolId: true, cohort: { select: { schoolId: true } }, classroom: { select: { schoolId: true } } },
    });

    if (user?.role === "BENEFICIARY_ADMIN") {
      if (user.beneficiaryId !== slot.opportunity.beneficiary.id) {
        return res.status(403).json({ error: "Not your beneficiary's slot" });
      }
    } else {
      const schoolId = user ? await resolveStudentSchoolId(user.id) ?? user.schoolId : null;
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

// GET /api/beneficiaries/attachments/:attachmentId — serve attachment file (auth required)
// BENEFICIARY_ADMIN: may access their own org's attachments only.
// SCHOOL_ADMIN / STUDENT: may access only if their school has an APPROVED relationship with the beneficiary.
router.get("/attachments/:attachmentId", authenticate, async (req: Request, res: Response) => {
  try {
    const attachment = await prisma.beneficiaryOpportunityAttachment.findUnique({
      where: { id: req.params.attachmentId },
      select: { filename: true, originalName: true, mimeType: true, beneficiaryId: true, contentBytes: true },
    });
    if (!attachment) return res.status(404).json({ error: "Attachment not found" });

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { role: true, beneficiaryId: true, schoolId: true, cohort: { select: { schoolId: true } }, classroom: { select: { schoolId: true } } },
    });
    if (!user) return res.status(401).json({ error: "Not authenticated" });

    if (user.role === "BENEFICIARY_ADMIN") {
      if (user.beneficiaryId !== attachment.beneficiaryId) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
    } else {
      // School staff and students must have an APPROVED relationship with this beneficiary
      const schoolId = user ? await resolveStudentSchoolId(req.user!.userId) ?? user.schoolId : null;
      if (!schoolId) return res.status(403).json({ error: "Not associated with a school" });
      const approval = await prisma.schoolBeneficiaryApproval.findFirst({
        where: { schoolId, beneficiaryId: attachment.beneficiaryId, status: "APPROVED" },
        select: { id: true },
      });
      if (!approval) return res.status(403).json({ error: "Not authorized to access this file" });
    }

    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(attachment.originalName)}"`);
    res.setHeader("Content-Type", attachment.mimeType);
    if (attachment.contentBytes) {
      res.send(Buffer.from(attachment.contentBytes));
      return;
    }

    const filePath = path.join(UPLOAD_DIR, attachment.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found" });
    res.sendFile(filePath);
  } catch (err) {
    console.error("Serve attachment error:", err);
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
      select: { id: true, role: true, beneficiaryId: true, schoolId: true, cohort: { select: { schoolId: true } }, classroom: { select: { schoolId: true } } },
    });

    if (user?.role === "BENEFICIARY_ADMIN") {
      if (user.beneficiaryId !== ben.id) return res.status(403).json({ error: "Not your beneficiary" });
    } else {
      // School staff and students: require an APPROVED school-beneficiary relationship
      const schoolId = user ? await resolveStudentSchoolId(user.id) ?? user.schoolId : null;
      if (!schoolId) return res.status(403).json({ error: "Not associated with a school" });
      const approval = await prisma.schoolBeneficiaryApproval.findFirst({
        where: { schoolId, beneficiaryId: ben.id, status: "APPROVED" },
        select: { id: true },
      });
      if (!approval) return res.status(403).json({ error: "This beneficiary is not available to your school" });
    }

    // Strip internal/billing fields from response for non-BENEFICIARY_ADMIN callers
    const {
      schoolApprovals: _sa,
      stripeCustomerId: _sc,
      stripeSubscriptionId: _ss,
      stripePriceId: _sp,
      subscriptionStatus: _subst,
      planTier: _pt,
      currentPeriodEnd: _cpe,
      cancelAtPeriodEnd: _cap,
      billingInterval: _bi,
      proActivatedAt: _pa,
      uploadAbuseStrikes: _uas,
      uploadSuspendedUntil: _usu,
      ...benPublic
    } = ben as any;
    res.json(user?.role === "BENEFICIARY_ADMIN" ? ben : benPublic);
  } catch (err) {
    console.error("Get beneficiary error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/beneficiaries/approve-from-directory — school approves a directory beneficiary
router.post("/approve-from-directory", authenticate, requireRole("SCHOOL_ADMIN"), beneficiaryInviteLimiter, async (req: Request, res: Response) => {
  try {
    const { directoryId } = z.object({ directoryId: z.string().min(1) }).parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { school: { select: { directoryId: true } } },
    });
    if (!user?.schoolId) return res.status(400).json({ error: "Not associated with a school" });

    const schoolDirectory = user.school?.directoryId
      ? await prisma.schoolDirectory.findUnique({
          where: { id: user.school.directoryId },
          select: { ncessId: true },
        })
      : null;
    const ownSchoolDirectory = schoolDirectory?.ncessId
      ? await prisma.beneficiaryDirectory.findUnique({
          where: { ncessId: schoolDirectory.ncessId },
          select: { id: true },
        })
      : null;
    if (ownSchoolDirectory?.id === directoryId) {
      return res.status(400).json({ error: "Your school is already approved by default" });
    }

    const school = await prisma.school.findUnique({ where: { id: user.schoolId } });

    // Check if a Beneficiary already exists for this directory entry
    let beneficiary = await prisma.beneficiary.findFirst({ where: { directoryId } });
    const ownSchoolBeneficiary = await prisma.beneficiary.findFirst({
      where: { createdBySchoolId: user.schoolId, visibility: "PRIVATE", directoryId },
      select: { id: true },
    });
    if (ownSchoolBeneficiary) {
      return res.status(400).json({ error: "Your school is already approved by default" });
    }
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
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      await prisma.beneficiaryInvitation.create({
        data: {
          schoolId: user.schoolId,
          beneficiaryId: beneficiary.id,
          token: hashToken(token),
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

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.beneficiaryInvitation.create({
      data: {
        schoolId: user.schoolId,
        beneficiaryId: ben.id,
        token: hashToken(token),
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
router.get("/:id/schools", authenticate, requireRole("BENEFICIARY_ADMIN", "SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    if (!await canManageBeneficiary(req.user!.userId, req.params.id)) return res.status(403).json({ error: "Not your beneficiary" });

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

// ─── Recurrence helpers ───────────────────────────────────────────────────────

interface RecurrenceRule {
  type: "monthly_day_of_week" | "monthly_dates";
  daysOfWeek?: number[];    // 0=Sun..6=Sat, multiple allowed (for monthly_day_of_week)
  weeksOfMonth?: number[];  // 1-5, which Nth occurrence per month
  datesOfMonth?: number[];  // 1-31 (for monthly_dates)
  startTime: string;        // "HH:MM"
  endTime: string;          // "HH:MM"
  durationHours: number;
  capacity: number;
  monthsAhead: number;      // 1-12
}

function calcDurationHours(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
}

function generateRecurringSlots(
  rule: RecurrenceRule,
  fromDate: Date,
): { date: Date; startTime: string; endTime: string; durationHours: number; capacity: number }[] {
  const slots: { date: Date; startTime: string; endTime: string; durationHours: number; capacity: number }[] = [];
  const cursor = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), 1));

  for (let m = 0; m < rule.monthsAhead; m++) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

    if (rule.type === "monthly_day_of_week" && rule.daysOfWeek?.length && rule.weeksOfMonth?.length) {
      for (const dow of rule.daysOfWeek) {
        const occurrences: number[] = [];
        for (let d = 1; d <= daysInMonth; d++) {
          if (new Date(Date.UTC(year, month, d)).getUTCDay() === dow) {
            occurrences.push(d);
          }
        }
        for (const week of rule.weeksOfMonth) {
          const day = occurrences[week - 1];
          if (day) {
            const slotDate = new Date(Date.UTC(year, month, day));
            if (slotDate >= fromDate) {
              slots.push({ date: slotDate, startTime: rule.startTime, endTime: rule.endTime, durationHours: rule.durationHours, capacity: rule.capacity });
            }
          }
        }
      }
      // Sort slots within the month by date
      slots.sort((a, b) => a.date.getTime() - b.date.getTime());
    } else if (rule.type === "monthly_dates" && rule.datesOfMonth?.length) {
      for (const dateNum of rule.datesOfMonth) {
        if (dateNum <= daysInMonth) {
          const slotDate = new Date(Date.UTC(year, month, dateNum));
          if (slotDate >= fromDate) {
            slots.push({ date: slotDate, startTime: rule.startTime, endTime: rule.endTime, durationHours: rule.durationHours, capacity: rule.capacity });
          }
        }
      }
    }

    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return slots;
}

const recurrenceRuleSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("monthly_day_of_week"),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
    weeksOfMonth: z.array(z.number().int().min(1).max(5)).min(1),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    durationHours: z.number().positive(),
    capacity: z.number().int().positive(),
    monthsAhead: z.number().int().min(1).max(12),
  }),
  z.object({
    type: z.literal("monthly_dates"),
    datesOfMonth: z.array(z.number().int().min(1).max(31)).min(1),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    durationHours: z.number().positive(),
    capacity: z.number().int().positive(),
    monthsAhead: z.number().int().min(1).max(12),
  }),
]);

const opportunityTimeSlotSchema = z.object({
  date: z.string().min(1, "Choose a date for each time slot.").refine((d) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return new Date(d) >= today;
  }, "Slot date must be today or in the future."),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Choose a valid start time for each time slot."),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Choose a valid end time for each time slot."),
  durationHours: z.number().positive("End time must be after start time."),
  capacity: z.number().int().positive("Enter a valid volunteer capacity.").default(10),
}).superRefine((slot, ctx) => {
  if (slot.startTime >= slot.endTime) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endTime"], message: "End time must be after start time." });
  }
});

function addCategoryValidation(
  data: { category?: string; customCategory?: string | null },
  ctx: z.RefinementCtx,
  required: boolean,
) {
  const resolved = resolveOpportunityCategory(data.category, data.customCategory);
  if (!resolved) {
    if (required) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["category"],
        message: "Enter a category.",
      });
    }
    return;
  }
}
// GET /api/beneficiaries/:id/opportunities — list opportunities for a beneficiary
router.get("/:id/opportunities", authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, role: true, beneficiaryId: true, schoolId: true, cohort: { select: { schoolId: true } }, classroom: { select: { schoolId: true } } },
    });

    if (user?.role === "BENEFICIARY_ADMIN") {
      if (user.beneficiaryId !== req.params.id) return res.status(403).json({ error: "Not your beneficiary" });
    } else {
      const schoolId = user ? await resolveStudentSchoolId(user.id) ?? user.schoolId : null;
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
        attachments: {
          select: { id: true, originalName: true, mimeType: true, size: true },
          orderBy: { createdAt: "asc" },
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

// POST /api/beneficiaries/:id/opportunities — create opportunity (beneficiary admin or school admin for their private beneficiary)
router.post("/:id/opportunities", authenticate, requireRole("BENEFICIARY_ADMIN", "SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    if (!await canManageBeneficiary(req.user!.userId, req.params.id)) return res.status(403).json({ error: "Not your beneficiary" });

    const schema = z.object({
      title: z.string().trim().min(1).max(255),
      description: z.string().max(2000),
      category: z.string().max(100),
      customCategory: z.string().max(100).optional(),
      location: z.string().max(255).optional(),
      address: z.string().max(255).optional(),
      startDate: z.string(),
      endDate: z.string().optional(),
      requirementsNote: z.string().max(1000).optional(),
      schoolRestrictions: z.array(z.string()).optional(),
      recurrenceRule: recurrenceRuleSchema.optional(),
      timeSlots: z.array(opportunityTimeSlotSchema).optional().default([]),
    }).superRefine((d, ctx) => {
      if (!d.recurrenceRule && d.timeSlots.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["timeSlots"],
          message: "Add at least one time slot or switch to recurring schedule.",
        });
      }
      addCategoryValidation(d, ctx, true);
    });
    const data = schema.parse(req.body);
    const resolvedCategory = resolveOpportunityCategory(data.category, data.customCategory);
    if (!resolvedCategory) {
      return res.status(400).json({ error: "Category is required" });
    }

    let slotsToCreate: { date: Date; startTime: string; endTime: string; durationHours: number; capacity: number; recurringGroupId?: string }[];
    let recurringGroupId: string | undefined;

    if (data.recurrenceRule) {
      recurringGroupId = crypto.randomUUID();
      const fromDate = new Date(data.startDate);
      const generated = generateRecurringSlots(data.recurrenceRule as RecurrenceRule, fromDate);
      if (generated.length === 0) {
        return res.status(400).json({ error: "Recurrence rule produced no slots for the given start date and months ahead" });
      }
      slotsToCreate = generated.map((s) => ({ ...s, recurringGroupId }));
    } else {
      slotsToCreate = data.timeSlots!.map((ts) => ({
        date: new Date(ts.date),
        startTime: ts.startTime,
        endTime: ts.endTime,
        durationHours: ts.durationHours,
        capacity: ts.capacity,
      }));
    }

    const opp = await prisma.beneficiaryOpportunity.create({
      data: {
        title: data.title,
        description: data.description,
        beneficiaryId: req.params.id,
        category: resolvedCategory,
        location: data.location || null,
        address: data.address || null,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        requirementsNote: data.requirementsNote || null,
        schoolRestrictions: data.schoolRestrictions ? JSON.stringify(data.schoolRestrictions) : null,
        recurrenceRule: data.recurrenceRule ? JSON.stringify(data.recurrenceRule) : null,
        status: "ACTIVE",
        timeSlots: {
          create: slotsToCreate,
        },
      },
      include: { timeSlots: true },
    });

    res.status(201).json(opp);
  } catch (err) {
    if (err instanceof z.ZodError) {
      console.error("Create opportunity validation error:", {
        beneficiaryId: req.params.id,
        issues: err.errors,
        body: req.body,
      });
      return res.status(400).json({ error: "Validation failed", details: err.errors });
    }
    console.error("Create opportunity error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/beneficiaries/:id/opportunities/:oppId — edit opportunity metadata
router.patch("/:id/opportunities/:oppId", authenticate, requireRole("BENEFICIARY_ADMIN", "SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    if (!await canManageBeneficiary(req.user!.userId, req.params.id)) return res.status(403).json({ error: "Not your beneficiary" });

    const opp = await prisma.beneficiaryOpportunity.findUnique({ where: { id: req.params.oppId } });
    if (!opp || opp.beneficiaryId !== req.params.id) return res.status(404).json({ error: "Opportunity not found" });
    if (opp.status === "CANCELLED") return res.status(400).json({ error: "Cannot edit a cancelled opportunity" });

    const schema = z.object({
      title: z.string().trim().min(1).max(255).optional(),
      description: z.string().max(2000).optional(),
      category: z.string().max(100).optional(),
      customCategory: z.string().max(100).nullable().optional(),
      location: z.string().max(255).nullable().optional(),
      requirementsNote: z.string().max(1000).nullable().optional(),
      schoolRestrictions: z.array(z.string()).nullable().optional(),
      recurrenceRule: recurrenceRuleSchema.optional(),
      timeSlots: z.array(opportunityTimeSlotSchema).optional(),
    }).superRefine((d, ctx) => {
      if (d.category !== undefined || d.customCategory !== undefined) {
        addCategoryValidation(
          { category: d.category, customCategory: d.customCategory ?? undefined },
          ctx,
          true,
        );
      }
    });
    const data = schema.parse(req.body);
    const resolvedCategory =
      data.category !== undefined || data.customCategory !== undefined
        ? resolveOpportunityCategory(data.category, data.customCategory ?? undefined)
        : undefined;

    const updated = await prisma.beneficiaryOpportunity.update({
      where: { id: req.params.oppId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(resolvedCategory !== undefined && { category: resolvedCategory }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.requirementsNote !== undefined && { requirementsNote: data.requirementsNote }),
        ...(data.schoolRestrictions !== undefined && {
          schoolRestrictions: data.schoolRestrictions ? JSON.stringify(data.schoolRestrictions) : null,
        }),
        ...(data.recurrenceRule !== undefined && {
          recurrenceRule: JSON.stringify(data.recurrenceRule),
        }),
      },
      include: { timeSlots: { include: { _count: { select: { signups: true } } }, orderBy: { date: "asc" } } },
    });

    // Regenerate future slots when a recurrenceRule update is submitted.
    // Only deletes unbooked future slots (>24h); signed-up slots are preserved.
    if (data.recurrenceRule) {
      const cutoff = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const anySlot = await prisma.beneficiaryTimeSlot.findFirst({
        where: { opportunityId: req.params.oppId },
        select: { recurringGroupId: true },
      });
      const recurringGroupId = anySlot?.recurringGroupId ?? crypto.randomUUID();

      const futureSlots = await prisma.beneficiaryTimeSlot.findMany({
        where: { opportunityId: req.params.oppId, date: { gt: cutoff } },
        include: { signups: { select: { id: true } } },
      });
      const toDelete = futureSlots.filter((s) => s.signups.length === 0).map((s) => s.id);
      if (toDelete.length > 0) {
        await prisma.beneficiaryTimeSlot.deleteMany({ where: { id: { in: toDelete } } });
      }

      const generated = generateRecurringSlots(data.recurrenceRule as RecurrenceRule, new Date());
      if (generated.length > 0) {
        await prisma.beneficiaryTimeSlot.createMany({
          data: generated.map((s) => ({ opportunityId: req.params.oppId, recurringGroupId, ...s })),
        });
      }
    }

    // Add new manual slots if provided
    if (data.timeSlots && data.timeSlots.length > 0) {
      await prisma.beneficiaryTimeSlot.createMany({
        data: data.timeSlots.map((ts) => ({
          opportunityId: req.params.oppId,
          date: new Date(ts.date),
          startTime: ts.startTime,
          endTime: ts.endTime,
          durationHours: ts.durationHours,
          capacity: ts.capacity,
        })),
      });
    }

    // Re-fetch with fresh slots after any additions/deletions
    const final = await prisma.beneficiaryOpportunity.findUnique({
      where: { id: req.params.oppId },
      include: { timeSlots: { include: { _count: { select: { signups: true } } }, orderBy: { date: "asc" } } },
    });

    res.json(final ?? updated);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    console.error("Update opportunity error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/beneficiaries/:id/opportunities/:oppId — soft-delete (CANCELLED)
router.delete("/:id/opportunities/:oppId", authenticate, requireRole("BENEFICIARY_ADMIN", "SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    if (!await canManageBeneficiary(req.user!.userId, req.params.id)) return res.status(403).json({ error: "Not your beneficiary" });

    const opp = await prisma.beneficiaryOpportunity.findUnique({
      where: { id: req.params.oppId },
      include: {
        beneficiary: { select: { name: true } },
        timeSlots: {
          include: {
            signups: {
              where: { status: { in: ["CONFIRMED", "WAITLISTED"] } },
              select: { id: true, studentId: true },
            },
          },
        },
      },
    });
    if (!opp || opp.beneficiaryId !== req.params.id) return res.status(404).json({ error: "Opportunity not found" });

    const now = new Date();

    // Collect all active signups across all time slots
    const activeSignups = opp.timeSlots.flatMap((slot) => slot.signups);

    // Only notify students signed up for future time slots
    const futureSlotIds = new Set(opp.timeSlots.filter((slot) => slot.date > now).map((s) => s.id));
    const futureSignups = opp.timeSlots
      .filter((slot) => futureSlotIds.has(slot.id))
      .flatMap((slot) => slot.signups);
    const affectedStudentIds = [...new Set(futureSignups.map((s) => s.studentId))];

    // Cancel all active signups and mark the opportunity cancelled in one transaction
    await prisma.$transaction([
      prisma.beneficiarySignup.updateMany({
        where: { id: { in: activeSignups.map((s) => s.id) } },
        data: { status: "CANCELLED" },
      }),
      prisma.beneficiaryOpportunity.update({
        where: { id: req.params.oppId },
        data: { status: "CANCELLED" },
      }),
    ]);

    // Notify students with future signups that the opportunity was deleted
    if (affectedStudentIds.length > 0) {
      await prisma.notification.createMany({
        data: affectedStudentIds.map((studentId) => ({
          userId: studentId,
          type: "OPPORTUNITY_CANCELLED",
          title: "Opportunity deleted",
          body: `${opp.beneficiary.name} has deleted "${opp.title}". Your signup has been removed.`,
        })),
      });
    }

    res.json({ message: "Opportunity deleted" });
  } catch (err) {
    console.error("Delete opportunity error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/beneficiaries/:id/opportunities/:oppId/attachments — upload files (hardened)
router.post(
  "/:id/opportunities/:oppId/attachments",
  authenticate,
  requireRole("BENEFICIARY_ADMIN", "SCHOOL_ADMIN"),
  (req, res, next) => {
    attachmentUpload.array("files", MAX_FILES_PER_UPLOAD)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          // Record abuse strike for oversized upload attempt (beneficiaryId not yet verified, use best-effort)
          const benId = req.params.id;
          if (benId) void recordAbuseStrike(benId);
          // Clean up any partially uploaded files
          const partial = (req.files ?? []) as Express.Multer.File[];
          for (const f of partial) { try { fs.unlinkSync(f.path); } catch {} }
          return res.status(413).json({ error: "One or more files exceed the 10 MB per-file limit." });
        }
        if (err.code === "LIMIT_FILE_COUNT") return res.status(400).json({ error: `Maximum ${MAX_FILES_PER_UPLOAD} files per upload.` });
        return res.status(400).json({ error: err.message });
      }
      if (err) return res.status(400).json({ error: "File upload failed." });
      next();
    });
  },
  async (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files provided." });
    }

    const cleanupFiles = (paths: string[]) => { for (const p of paths) { try { fs.unlinkSync(p); } catch {} } };
    const allPaths = files.map((f) => f.path);

    try {
      // --- Authorization ---
      if (!await canManageBeneficiary(req.user!.userId, req.params.id)) {
        cleanupFiles(allPaths);
        return res.status(403).json({ error: "Not your beneficiary" });
      }

      // --- Suspension check ---
      const benRecord = await prisma.beneficiary.findUnique({
        where: { id: req.params.id },
        select: { planTier: true, uploadSuspendedUntil: true },
      });
      if (benRecord?.uploadSuspendedUntil && benRecord.uploadSuspendedUntil > new Date()) {
        cleanupFiles(allPaths);
        return res.status(429).json({ error: "Upload access temporarily suspended due to repeated policy violations." });
      }

      const tier = (isDevMode() ? "PRO" : (benRecord?.planTier ?? "FREE")) as keyof typeof TIER_LIMITS;
      const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.FREE;

      // --- Opportunity ownership ---
      const opp = await prisma.beneficiaryOpportunity.findUnique({ where: { id: req.params.oppId }, select: { beneficiaryId: true } });
      if (!opp || opp.beneficiaryId !== req.params.id) {
        cleanupFiles(allPaths);
        return res.status(404).json({ error: "Opportunity not found" });
      }

      // --- Verify actual file sizes from disk (never trust multer's f.size) ---
      const verifiedFiles: Array<{ file: Express.Multer.File; size: number }> = [];
      for (const f of files) {
        const stat = fs.statSync(f.path);
        if (stat.size > MAX_FILE_SIZE) {
          await recordAbuseStrike(req.params.id);
          cleanupFiles(allPaths);
          return res.status(413).json({ error: `File "${f.originalname}" exceeds the 10 MB per-file limit.` });
        }
        verifiedFiles.push({ file: f, size: stat.size });
      }

      // --- Verify MIME types from magic bytes (never trust f.mimetype) ---
      const mimeResults: Array<{ file: Express.Multer.File; size: number; mimeType: string }> = [];
      for (const { file, size } of verifiedFiles) {
        const { mimeType, allowed } = await detectMimeType(file.path, file.originalname);
        if (!allowed) {
          await recordAbuseStrike(req.params.id);
          cleanupFiles(allPaths);
          return res.status(415).json({ error: `File type not allowed: ${file.originalname}` });
        }
        mimeResults.push({ file, size, mimeType });
      }

      // --- Total size check ---
      const totalSize = mimeResults.reduce((sum, r) => sum + r.size, 0);
      if (totalSize > MAX_TOTAL_PER_UPLOAD) {
        cleanupFiles(allPaths);
        return res.status(413).json({ error: "Total upload size exceeds the 25 MB limit." });
      }

      // --- Rate limit ---
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentUploads = await prisma.beneficiaryOpportunityAttachment.count({
        where: { beneficiaryId: req.params.id, createdAt: { gte: oneHourAgo } },
      });
      if (recentUploads + files.length > limits.uploadsPerHour) {
        cleanupFiles(allPaths);
        return res.status(429).json({ error: `Upload rate limit reached. Your plan allows ${limits.uploadsPerHour} files per hour.` });
      }

      // --- Storage quota ---
      const usageAgg = await prisma.beneficiaryOpportunityAttachment.aggregate({
        where: { beneficiaryId: req.params.id },
        _sum: { size: true },
      });
      const currentUsage = usageAgg._sum.size ?? 0;
      if (currentUsage + totalSize > limits.storageBytes) {
        cleanupFiles(allPaths);
        const usedMB = (currentUsage / 1024 / 1024).toFixed(1);
        const limitMB = (limits.storageBytes / 1024 / 1024).toFixed(0);
        return res.status(413).json({ error: `Storage quota exceeded. Used ${usedMB} MB of ${limitMB} MB.` });
      }

      // --- SHA-256 deduplication & DB record creation ---
      const newAttachments: Array<{
        opportunityId: string;
        beneficiaryId: string;
        filename: string;
        originalName: string;
        mimeType: string;
        size: number;
        sha256: string;
        contentBytes: Uint8Array;
      }> = [];

      for (const { file, size, mimeType } of mimeResults) {
        const hash = await sha256ofFile(file.path);
        const fileBytes = fs.readFileSync(file.path);

        // Check if an identical file already exists for this beneficiary
        const existing = await prisma.beneficiaryOpportunityAttachment.findFirst({
          where: { sha256: hash, beneficiaryId: req.params.id },
          select: { filename: true, contentBytes: true },
        });

        const storedFilename = existing?.filename ?? path.basename(file.path);
        const contentBytes = existing?.contentBytes
          ? toStoredBytes(existing.contentBytes)
          : toStoredBytes(fileBytes);

        newAttachments.push({
          opportunityId: req.params.oppId,
          beneficiaryId: req.params.id,
          filename: storedFilename,
          originalName: file.originalname,
          mimeType,
          size,
          sha256: hash,
          contentBytes,
        });

        try { fs.unlinkSync(file.path); } catch {}
      }

      for (const attachment of newAttachments) {
        await prisma.beneficiaryOpportunityAttachment.create({
          data: {
            opportunity: { connect: { id: attachment.opportunityId } },
            beneficiary: { connect: { id: attachment.beneficiaryId } },
            filename: attachment.filename,
            originalName: attachment.originalName,
            mimeType: attachment.mimeType,
            size: attachment.size,
            sha256: attachment.sha256,
            contentBytes: attachment.contentBytes as any,
          },
        });
      }

      const attachments = await prisma.beneficiaryOpportunityAttachment.findMany({
        where: { opportunityId: req.params.oppId },
        select: { id: true, originalName: true, mimeType: true, size: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      });

      res.status(201).json({ count: newAttachments.length, attachments });
    } catch (err) {
      cleanupFiles(allPaths);
      console.error("Upload attachment error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// DELETE /api/beneficiaries/:id/opportunities/:oppId/attachments/:attachmentId — delete one attachment
router.delete("/:id/opportunities/:oppId/attachments/:attachmentId", authenticate, requireRole("BENEFICIARY_ADMIN", "SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    if (!await canManageBeneficiary(req.user!.userId, req.params.id)) return res.status(403).json({ error: "Not your beneficiary" });

    const attachment = await prisma.beneficiaryOpportunityAttachment.findUnique({
      where: { id: req.params.attachmentId },
      select: { id: true, filename: true, opportunityId: true, beneficiaryId: true, contentBytes: true },
    });
    if (!attachment || attachment.beneficiaryId !== req.params.id || attachment.opportunityId !== req.params.oppId) {
      return res.status(404).json({ error: "Attachment not found" });
    }

    await prisma.beneficiaryOpportunityAttachment.delete({ where: { id: req.params.attachmentId } });

    // Only unlink the physical file if no other DB record shares the same filename (dedup).
    const remaining = await prisma.beneficiaryOpportunityAttachment.count({ where: { filename: attachment.filename } });
    if (remaining === 0 && !attachment.contentBytes) {
      try { fs.unlinkSync(path.join(UPLOAD_DIR, attachment.filename)); } catch {}
    }

    res.status(204).send();
  } catch (err) {
    console.error("Delete attachment error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/beneficiaries/:id/slots/:slotId — edit a future time slot for one beneficiary
router.patch("/:id/slots/:slotId", authenticate, requireRole("BENEFICIARY_ADMIN", "SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const slot = await prisma.beneficiaryTimeSlot.findUnique({
      where: { id: req.params.slotId },
      include: { opportunity: { select: { beneficiaryId: true } } },
    });
    if (!slot || slot.opportunity.beneficiaryId !== req.params.id) {
      return res.status(404).json({ error: "Time slot not found" });
    }

    if (!await canManageBeneficiary(req.user!.userId, req.params.id)) {
      return res.status(403).json({ error: "Not your beneficiary" });
    }

    const now = new Date();
    const cutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    if (slot.date <= cutoff) {
      return res.status(400).json({ error: "Can only edit slots more than 24 hours in the future" });
    }

    const schema = z.object({
      date: z.string().optional(),
      startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      capacity: z.number().int().positive().optional(),
      propagateFuture: z.boolean().optional(),
    });
    const data = schema.parse(req.body);

    const originalDate = slot.date;
    const newDate = data.date ? new Date(data.date) : slot.date;
    const newStartTime = data.startTime ?? slot.startTime;
    const newEndTime = data.endTime ?? slot.endTime;
    const newCapacity = data.capacity ?? slot.capacity;
    const newDuration = calcDurationHours(newStartTime, newEndTime) || slot.durationHours;
    const updated = await runSerializableTransaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM "BeneficiaryTimeSlot" WHERE id = ${req.params.slotId} FOR UPDATE`;

      const confirmedCount = await tx.beneficiarySignup.count({
        where: { slotId: req.params.slotId, status: "CONFIRMED" },
      });
      if (newCapacity < confirmedCount) {
        throw new Error(`CAPACITY_FLOOR:${confirmedCount}`);
      }

      return tx.beneficiaryTimeSlot.update({
        where: { id: req.params.slotId },
        data: {
          date: newDate,
          startTime: newStartTime,
          endTime: newEndTime,
          durationHours: newDuration,
          capacity: newCapacity,
        },
      });
    });

    if (data.propagateFuture && slot.recurringGroupId) {
      const dayDelta = Math.round((newDate.getTime() - originalDate.getTime()) / (24 * 60 * 60 * 1000));

      const [origSH, origSM] = slot.startTime.split(":").map(Number);
      const [newSH, newSM] = newStartTime.split(":").map(Number);
      const startMinuteDelta = (newSH * 60 + newSM) - (origSH * 60 + origSM);

      const [origEH, origEM] = slot.endTime.split(":").map(Number);
      const [newEH, newEM] = newEndTime.split(":").map(Number);
      const endMinuteDelta = (newEH * 60 + newEM) - (origEH * 60 + origEM);

      const futureSlots = await prisma.beneficiaryTimeSlot.findMany({
        where: {
          recurringGroupId: slot.recurringGroupId,
          id: { not: req.params.slotId },
          date: { gt: cutoff },
        },
      });

      for (const fs of futureSlots) {
        const fsDate = new Date(fs.date);
        fsDate.setUTCDate(fsDate.getUTCDate() + dayDelta);

        const [fsSH, fsSM] = fs.startTime.split(":").map(Number);
        const newFsSM = fsSH * 60 + fsSM + startMinuteDelta;
        const newFsStartH = Math.floor(((newFsSM % 1440) + 1440) % 1440 / 60);
        const newFsStartMin = ((newFsSM % 1440) + 1440) % 1440 % 60;

        const [fsEH, fsEM] = fs.endTime.split(":").map(Number);
        const newFsEMins = fsEH * 60 + fsEM + endMinuteDelta;
        const newFsEndH = Math.floor(((newFsEMins % 1440) + 1440) % 1440 / 60);
        const newFsEndMin = ((newFsEMins % 1440) + 1440) % 1440 % 60;

        await prisma.beneficiaryTimeSlot.update({
          where: { id: fs.id },
          data: {
            date: fsDate,
            startTime: `${String(newFsStartH).padStart(2, "0")}:${String(newFsStartMin).padStart(2, "0")}`,
            endTime: `${String(newFsEndH).padStart(2, "0")}:${String(newFsEndMin).padStart(2, "0")}`,
          },
        });
      }
    }

    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    if (err instanceof Error && err.message.startsWith("CAPACITY_FLOOR:")) {
      const confirmedCount = Number(err.message.split(":")[1] || "0");
      return res.status(400).json({ error: `Capacity cannot be lower than the ${confirmedCount} confirmed volunteer(s).` });
    }
    console.error("Edit beneficiary slot error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/beneficiaries/:id/slots/:slotId — delete a future time slot
router.delete("/:id/slots/:slotId", authenticate, requireRole("BENEFICIARY_ADMIN", "SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const forceCancel =
      req.body?.forceCancel === true ||
      req.query.forceCancel === "true" ||
      req.query.forceCancel === "1";
    const result = await cancelBeneficiarySlot(req.params.slotId, req.params.id, req.user!.userId, forceCancel);
    res.status(result.status).json(result.body);
  } catch (err) {
    console.error("Delete slot error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/beneficiaries/:id/slots/:slotId/cancel — cancel and remove a future time slot
router.post("/:id/slots/:slotId/cancel", authenticate, requireRole("BENEFICIARY_ADMIN", "SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const forceCancel = req.body?.forceCancel === true;
    const result = await cancelBeneficiarySlot(req.params.slotId, req.params.id, req.user!.userId, forceCancel);
    res.status(result.status).json(result.body);
  } catch (err) {
    console.error("Cancel slot error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
// PATCH /api/beneficiaries/slots/:slotId — edit a future time slot
router.patch("/slots/:slotId", authenticate, requireRole("BENEFICIARY_ADMIN", "SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const slot = await prisma.beneficiaryTimeSlot.findUnique({
      where: { id: req.params.slotId },
      include: { opportunity: { select: { beneficiaryId: true } } },
    });
    if (!slot) return res.status(404).json({ error: "Time slot not found" });

    if (!await canManageBeneficiary(req.user!.userId, slot.opportunity.beneficiaryId)) {
      return res.status(403).json({ error: "Not your beneficiary" });
    }

    const now = new Date();
    const cutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    if (slot.date <= cutoff) {
      return res.status(400).json({ error: "Can only edit slots more than 24 hours in the future" });
    }

    const schema = z.object({
      date: z.string().optional(),
      startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      capacity: z.number().int().positive().optional(),
      propagateFuture: z.boolean().optional(),
    });
    const data = schema.parse(req.body);

    const originalDate = slot.date;
    const newDate = data.date ? new Date(data.date) : slot.date;
    const newStartTime = data.startTime ?? slot.startTime;
    const newEndTime = data.endTime ?? slot.endTime;
    const newCapacity = data.capacity ?? slot.capacity;
    const newDuration = calcDurationHours(newStartTime, newEndTime) || slot.durationHours;
    const updated = await runSerializableTransaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM "BeneficiaryTimeSlot" WHERE id = ${req.params.slotId} FOR UPDATE`;

      const confirmedCount = await tx.beneficiarySignup.count({
        where: { slotId: req.params.slotId, status: "CONFIRMED" },
      });
      if (newCapacity < confirmedCount) {
        throw new Error(`CAPACITY_FLOOR:${confirmedCount}`);
      }

      return tx.beneficiaryTimeSlot.update({
        where: { id: req.params.slotId },
        data: {
          date: newDate,
          startTime: newStartTime,
          endTime: newEndTime,
          durationHours: newDuration,
          capacity: newCapacity,
        },
      });
    });

    // Propagate to other future slots in the same recurring series
    if (data.propagateFuture && slot.recurringGroupId) {
      const dayDelta = Math.round((newDate.getTime() - originalDate.getTime()) / (24 * 60 * 60 * 1000));

      const [origSH, origSM] = slot.startTime.split(":").map(Number);
      const [newSH, newSM] = newStartTime.split(":").map(Number);
      const startMinuteDelta = (newSH * 60 + newSM) - (origSH * 60 + origSM);

      const [origEH, origEM] = slot.endTime.split(":").map(Number);
      const [newEH, newEM] = newEndTime.split(":").map(Number);
      const endMinuteDelta = (newEH * 60 + newEM) - (origEH * 60 + origEM);

      const futureSlots = await prisma.beneficiaryTimeSlot.findMany({
        where: {
          recurringGroupId: slot.recurringGroupId,
          id: { not: req.params.slotId },
          date: { gt: cutoff },
        },
      });

      for (const fs of futureSlots) {
        const fsDate = new Date(fs.date);
        fsDate.setUTCDate(fsDate.getUTCDate() + dayDelta);

        const [fsSH, fsSM] = fs.startTime.split(":").map(Number);
        const newFsSM = fsSH * 60 + fsSM + startMinuteDelta;
        const newFsStartH = Math.floor(((newFsSM % 1440) + 1440) % 1440 / 60);
        const newFsStartMin = ((newFsSM % 1440) + 1440) % 1440 % 60;

        const [fsEH, fsEM] = fs.endTime.split(":").map(Number);
        const newFsEM = fsEH * 60 + fsEM + endMinuteDelta;
        const newFsEndH = Math.floor(((newFsEM % 1440) + 1440) % 1440 / 60);
        const newFsEndMin = ((newFsEM % 1440) + 1440) % 1440 % 60;

        const fsStart = `${String(newFsStartH).padStart(2, "0")}:${String(newFsStartMin).padStart(2, "0")}`;
        const fsEnd = `${String(newFsEndH).padStart(2, "0")}:${String(newFsEndMin).padStart(2, "0")}`;

        await prisma.beneficiaryTimeSlot.update({
          where: { id: fs.id },
          data: {
            date: fsDate,
            startTime: fsStart,
            endTime: fsEnd,
            durationHours: calcDurationHours(fsStart, fsEnd) || fs.durationHours,
          },
        });
      }
    }

    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    if (err instanceof Error && err.message.startsWith("CAPACITY_FLOOR:")) {
      const confirmedCount = Number(err.message.split(":")[1] || "0");
      return res.status(400).json({ error: `Capacity cannot be lower than the ${confirmedCount} confirmed volunteer(s).` });
    }
    console.error("Edit time slot error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/beneficiaries/slots/:slotId/signup — student signs up for a time slot
router.post("/slots/:slotId/signup", authenticate, requireRole("STUDENT"), async (req: Request, res: Response) => {
  try {
    const slot = await prisma.beneficiaryTimeSlot.findUnique({
      where: { id: req.params.slotId },
      include: {
        opportunity: { select: { beneficiaryId: true, status: true, schoolRestrictions: true, category: true } },
      },
    });
    if (!slot) return res.status(404).json({ error: "Time slot not found" });
    if (slot.opportunity.status !== "ACTIVE") return res.status(400).json({ error: "This opportunity is no longer active" });

    // Resolve the student's school
    const studentSchoolId = await resolveStudentSchoolId(req.user!.userId);
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

    const blockedCategoryKeys = await getBlockedCategoryKeysForStudent(req.user!.userId);
    if (blockedCategoryKeys.has(normalizeCategoryKey(slot.opportunity.category))) {
      const categoryLabel = slot.opportunity.category || "this category";
      return res.status(403).json({
        error: `Your school is preventing you from doing more ${categoryLabel}. You have already completed the maximum allowed hours in that category.`,
        categoryBlocked: true,
        category: categoryLabel,
      });
    }

    const result = await runSerializableTransaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM "BeneficiaryTimeSlot" WHERE id = ${slot.id} FOR UPDATE`;

      const existing = await tx.beneficiarySignup.findUnique({
        where: { slotId_studentId: { slotId: slot.id, studentId: req.user!.userId } },
      });
      if (existing) return { kind: "error" as const, status: 409, body: { error: "Already signed up for this slot" } };

      const liveSlot = await tx.beneficiaryTimeSlot.findUnique({
        where: { id: slot.id },
        select: { capacity: true },
      });
      if (!liveSlot) return { kind: "error" as const, status: 404, body: { error: "Time slot not found" } };

      const confirmedCount = await tx.beneficiarySignup.count({
        where: { slotId: slot.id, status: "CONFIRMED" },
      });
      const status = confirmedCount >= liveSlot.capacity ? "WAITLISTED" : "CONFIRMED";

      const signup = await tx.beneficiarySignup.create({
        data: {
          slotId: slot.id,
          studentId: req.user!.userId,
          status,
          cancellationToken: crypto.randomUUID(),
        },
      });

      await tx.beneficiaryAuditLog.create({
        data: {
          action: status === "WAITLISTED" ? "SIGNUP_WAITLISTED" : "SIGNUP_CONFIRMED",
          actorId: req.user!.userId,
          signupId: signup.id,
          details: JSON.stringify({
            slotId: slot.id,
            status,
          }),
        },
      });

      return { kind: "success" as const, signup };
    });

    if (result.kind === "error") {
      return res.status(result.status).json(result.body);
    }

    res.status(201).json(result.signup);
  } catch (err) {
    if (isPrismaKnownRequestError(err)) {
      if (err.code === "P2002") {
        return res.status(409).json({ error: "Already signed up for this slot" });
      }
      if (err.code === "P2034") {
        res.setHeader("Retry-After", "1");
        return res.status(503).json({ error: "Server busy, please retry" });
      }
    }
    console.error("Slot signup error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/beneficiaries/:id/signups — list signups for a beneficiary (beneficiary admin or school admin)
router.get("/:id/signups", authenticate, requireRole("BENEFICIARY_ADMIN", "SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    if (!await canManageBeneficiary(req.user!.userId, req.params.id)) return res.status(403).json({ error: "Not your beneficiary" });

    const statusFilter = req.query.status as string | undefined;
    const signups = await prisma.beneficiarySignup.findMany({
      where: {
        slot: { opportunity: { beneficiaryId: req.params.id } },
        ...(statusFilter ? { verificationStatus: statusFilter } : {}),
      },
      include: {
        slot: {
          include: {
            opportunity: { select: { id: true, title: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const studentIds = [...new Set(signups.map((signup) => signup.studentId))];
    const students = studentIds.length
      ? await prisma.user.findMany({
          where: { id: { in: studentIds } },
          select: { id: true, name: true },
        })
      : [];
    const studentMap = new Map(students.map((student) => [student.id, student.name]));

    // FERPA disclosure log: beneficiary admin accessed student signup list
    logDataAccess({
      actorId: req.user!.userId,
      action: "VIEW_BENEFICIARY_SIGNUPS",
      targetType: "beneficiary",
      targetId: req.params.id,
      details: { studentCount: signups.length, statusFilter: statusFilter ?? "all" },
    }).catch(() => {});

    const result = signups.map((s) => ({
      ...s,
      student: { id: s.studentId, label: pseudonymousStudentLabel(s.studentId) },
    }));

    res.json(result);
  } catch (err) {
    console.error("List beneficiary signups error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/beneficiaries/signups/:signupId/approve — beneficiary admin approves hours
router.post("/signups/:signupId/approve", authenticate, requireRole("BENEFICIARY_ADMIN", "SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const signup = await prisma.beneficiarySignup.findUnique({
      where: { id: req.params.signupId },
      include: { slot: { include: { opportunity: true } } },
    });
    if (!signup) return res.status(404).json({ error: "Signup not found" });

    if (!await canManageBeneficiary(req.user!.userId, signup.slot.opportunity.beneficiaryId)) {
      return res.status(403).json({ error: "Not your beneficiary's signup" });
    }
    if (!["CONFIRMED", "NO_SHOW"].includes(signup.status)) {
      return res.status(400).json({ error: "Only confirmed or no-show signups can be approved" });
    }
    if (signup.status === "CANCELLED" || signup.status === "WAITLISTED") {
      return res.status(400).json({ error: "This signup cannot be approved" });
    }
    if (getSlotEndAt(signup.slot.date, signup.slot.endTime) > new Date()) {
      return res.status(400).json({ error: "Hour approval is only available after the time slot has ended" });
    }

    const { approvedHours, overrideCap } = z.object({
      approvedHours: z.number().positive().optional(),
      overrideCap: z.boolean().optional(),
    }).parse(req.body);
    if (approvedHours !== undefined && approvedHours > signup.slot.durationHours) {
      return res.status(400).json({ error: `approvedHours cannot exceed the slot duration of ${signup.slot.durationHours}h` });
    }
    const hours = approvedHours ?? signup.slot.durationHours;
    const currentApprovedHours = signup.verificationStatus === "APPROVED" ? (signup.totalHours ?? signup.slot.durationHours) : 0;
    const additionalApprovedHours = Math.max(0, hours - currentApprovedHours);

    // Category cap check
    if (!overrideCap && additionalApprovedHours > 0) {
      const category = signup.slot.opportunity.category;
      const capCheck = await checkCategoryCap(signup.studentId, category, additionalApprovedHours);
      if (capCheck.exceeded) {
        return res.status(400).json({
          error: `Approval would exceed the "${capCheck.category}" category cap of ${capCheck.cap} hours (current: ${capCheck.current.toFixed(1)}h, adding: ${additionalApprovedHours}h). Pass overrideCap: true to bypass.`,
          capExceeded: true,
          cap: capCheck.cap,
          current: capCheck.current,
          category: capCheck.category,
        });
      }
    }

    const fromStatus = getBeneficiarySignupDisplayStatus(signup);

    const updated = await prisma.beneficiarySignup.update({
      where: { id: req.params.signupId },
      data: {
        status: "CONFIRMED",
        verificationStatus: "APPROVED",
        totalHours: hours,
        rejectionReason: null,
        verifiedBy: req.user!.userId,
        verifiedAt: new Date(),
      },
    });

    await prisma.beneficiaryAuditLog.create({
      data: {
        action: signup.verificationStatus === "APPROVED" ? "APPROVAL_UPDATED" : overrideCap ? "CAP_OVERRIDE" : "APPROVE",
        actorId: req.user!.userId,
        signupId: signup.id,
        details: JSON.stringify({
          previousStatus: fromStatus,
          approvedHours: hours,
          originalHours: signup.slot.durationHours,
          ...(overrideCap ? { capOverride: true } : {}),
        }),
      },
    });

    await notifyBeneficiarySignupReviewChange({
      studentId: signup.studentId,
      opportunityTitle: signup.slot.opportunity.title,
      slotDate: signup.slot.date,
      fromStatus,
      toStatus: "Approved",
      approvedHours: hours,
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

    await prisma.schoolBeneficiaryApproval.upsert({
      where: { schoolId_beneficiaryId: { schoolId: inv.schoolId, beneficiaryId: inv.beneficiaryId } },
      update: action === "ACCEPTED"
        ? { status: "APPROVED", approvedAt: new Date() }
        : { status: "REJECTED", approvedAt: null },
      create: {
        schoolId: inv.schoolId,
        beneficiaryId: inv.beneficiaryId,
        status: action === "ACCEPTED" ? "APPROVED" : "REJECTED",
        ...(action === "ACCEPTED" ? { approvedAt: new Date() } : {}),
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
router.post("/signups/:signupId/reject", authenticate, requireRole("BENEFICIARY_ADMIN", "SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const signup = await prisma.beneficiarySignup.findUnique({
      where: { id: req.params.signupId },
      include: { slot: { include: { opportunity: true } } },
    });
    if (!signup) return res.status(404).json({ error: "Signup not found" });

    if (!await canManageBeneficiary(req.user!.userId, signup.slot.opportunity.beneficiaryId)) {
      return res.status(403).json({ error: "Not your beneficiary's signup" });
    }
    if (signup.status === "CANCELLED" || signup.status === "WAITLISTED") {
      return res.status(400).json({ error: "This signup cannot be denied" });
    }
    if (getSlotEndAt(signup.slot.date, signup.slot.endTime) > new Date()) {
      return res.status(400).json({ error: "Hour review is only available after the time slot has ended" });
    }

    const { reason } = z.object({ reason: z.string().min(1) }).parse(req.body);
    const fromStatus = getBeneficiarySignupDisplayStatus(signup);

    const updated = await prisma.beneficiarySignup.update({
      where: { id: req.params.signupId },
      data: {
        status: "CONFIRMED",
        verificationStatus: "REJECTED",
        rejectionReason: reason,
        verifiedBy: req.user!.userId,
        verifiedAt: new Date(),
      },
    });

    await prisma.beneficiaryAuditLog.create({
      data: {
        action: signup.verificationStatus === "REJECTED" ? "REJECTION_UPDATED" : "REJECT",
        actorId: req.user!.userId,
        signupId: signup.id,
        details: JSON.stringify({ previousStatus: fromStatus, reason }),
      },
    });

    await notifyBeneficiarySignupReviewChange({
      studentId: signup.studentId,
      opportunityTitle: signup.slot.opportunity.title,
      slotDate: signup.slot.date,
      fromStatus,
      toStatus: "Denied",
      rejectionReason: reason,
    });

    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    console.error("Reject signup error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/beneficiaries/signups/:signupId/reset-review — beneficiary admin undoes a past review choice
router.post("/signups/:signupId/reset-review", authenticate, requireRole("BENEFICIARY_ADMIN", "SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const signup = await prisma.beneficiarySignup.findUnique({
      where: { id: req.params.signupId },
      include: { slot: { include: { opportunity: true } } },
    });
    if (!signup) return res.status(404).json({ error: "Signup not found" });

    if (!await canManageBeneficiary(req.user!.userId, signup.slot.opportunity.beneficiaryId)) {
      return res.status(403).json({ error: "Not your beneficiary's signup" });
    }
    if (signup.status === "CANCELLED" || signup.status === "WAITLISTED") {
      return res.status(400).json({ error: "This signup cannot be reset" });
    }

    const fromStatus = getBeneficiarySignupDisplayStatus(signup);
    if (fromStatus === "Pending") {
      return res.status(400).json({ error: "This signup is already pending review" });
    }

    const updated = await prisma.beneficiarySignup.update({
      where: { id: signup.id },
      data: {
        status: "CONFIRMED",
        verificationStatus: "PENDING",
        rejectionReason: null,
        verifiedBy: null,
        verifiedAt: null,
        ...(signup.status === "NO_SHOW" ? { totalHours: null } : {}),
      },
    });

    await prisma.beneficiaryAuditLog.create({
      data: {
        action: "REVIEW_RESET",
        actorId: req.user!.userId,
        signupId: signup.id,
        details: JSON.stringify({ previousStatus: fromStatus, nextStatus: "Pending" }),
      },
    });

    await notifyBeneficiarySignupReviewChange({
      studentId: signup.studentId,
      opportunityTitle: signup.slot.opportunity.title,
      slotDate: signup.slot.date,
      fromStatus,
      toStatus: "Pending",
    });

    res.json(updated);
  } catch (err) {
    console.error("Reset beneficiary review error:", err);
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

    const student = await prisma.user.findUnique({
      where: { id: signup.studentId },
      select: { id: true, name: true },
    });

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
        student: student ? { id: student.id, label: actor.role === "BENEFICIARY_ADMIN" ? pseudonymousStudentLabel(student.id) : student.name } : { id: signup.studentId, label: "Unknown student" },
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

    const result = await runSerializableTransaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM "BeneficiaryTimeSlot" WHERE id = ${signup.slotId} FOR UPDATE`;

      const liveSignup = await tx.beneficiarySignup.findUnique({
        where: { id: signup.id },
      });
      if (!liveSignup) return { kind: "error" as const, status: 404, body: { error: "Signup not found" } };
      if (liveSignup.status === "CANCELLED") {
        return { kind: "error" as const, status: 400, body: { error: "Already cancelled" } };
      }
      if (liveSignup.verificationStatus === "APPROVED") {
        return { kind: "error" as const, status: 400, body: { error: "Cannot cancel an already-approved signup" } };
      }

      await tx.beneficiarySignup.update({
        where: { id: signup.id },
        data: { status: "CANCELLED" },
      });

      await tx.beneficiaryAuditLog.create({
        data: {
          action: "SIGNUP_CANCELLED",
          actorId: req.user!.userId,
          signupId: signup.id,
          details: JSON.stringify({ previousStatus: liveSignup.status }),
        },
      });

      let promotedStudentId: string | null = null;
      if (liveSignup.status === "CONFIRMED") {
        const nextWaitlisted = await tx.beneficiarySignup.findFirst({
          where: { slotId: signup.slotId, status: "WAITLISTED" },
          orderBy: { createdAt: "asc" },
        });
        if (nextWaitlisted) {
          await tx.beneficiarySignup.update({
            where: { id: nextWaitlisted.id },
            data: { status: "CONFIRMED" },
          });
          await tx.beneficiaryAuditLog.create({
            data: {
              action: "WAITLIST_PROMOTED",
              actorId: req.user!.userId,
              signupId: nextWaitlisted.id,
              details: JSON.stringify({
                previousStatus: "WAITLISTED",
                nextStatus: "CONFIRMED",
              }),
            },
          });
          promotedStudentId = nextWaitlisted.studentId;
        }
      }

      return { kind: "success" as const, promotedStudentId };
    });

    if (result.kind === "error") {
      return res.status(result.status).json(result.body);
    }

    if (result.promotedStudentId) {
      await prisma.notification.create({
        data: {
          userId: result.promotedStudentId,
          type: "SIGNUP_CONFIRMED",
          title: "You're off the waitlist!",
          body: `A spot opened up and you're now confirmed for "${signup.slot.startTime}–${signup.slot.endTime}" on ${new Date(signup.slot.date).toLocaleDateString()}.`,
        },
      });
    }

    res.json({ message: "Signup cancelled" });
  } catch (err) {
    console.error("Cancel signup error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/beneficiaries/cancel/:token — public one-click cancellation link (no auth required)
router.get("/cancel/:token", async (req: Request, res: Response) => {
  try {
    const signup = await prisma.beneficiarySignup.findUnique({
      where: { cancellationToken: req.params.token },
      include: {
        slot: {
          include: {
            opportunity: { select: { title: true, beneficiaryId: true } },
          },
        },
      },
    });

    if (!signup) return res.status(404).json({ error: "Cancellation link not found or already used." });
    if (signup.verificationStatus === "APPROVED") {
      return res.status(400).json({ error: "Cannot cancel an already-approved signup." });
    }

    const result = await runSerializableTransaction(async (tx) => {
      // Lock the slot row first to serialize concurrent cancellations for the same slot
      await tx.$executeRaw`SELECT 1 FROM "BeneficiaryTimeSlot" WHERE id = ${signup.slotId} FOR UPDATE`;

      // Re-read the signup under lock to catch the double-submit race: two requests
      // may both pass the pre-transaction check above, but only the first one should win
      const liveSignup = await tx.beneficiarySignup.findUnique({
        where: { id: signup.id },
        select: { status: true, cancellationToken: true, verificationStatus: true },
      });
      if (!liveSignup || liveSignup.status === "CANCELLED" || !liveSignup.cancellationToken) {
        return { kind: "already_cancelled" as const };
      }
      if (liveSignup.verificationStatus === "APPROVED") {
        return { kind: "already_approved" as const };
      }

      await tx.beneficiarySignup.update({
        where: { id: signup.id },
        data: { status: "CANCELLED", cancellationToken: null },
      });

      await tx.beneficiaryAuditLog.create({
        data: {
          action: "SIGNUP_CANCELLED",
          actorId: signup.studentId,
          signupId: signup.id,
          details: JSON.stringify({ source: "one_click_cancel", previousStatus: signup.status }),
        },
      });

      let promotedStudentId: string | null = null;
      if (signup.status === "CONFIRMED") {
        const next = await tx.beneficiarySignup.findFirst({
          where: { slotId: signup.slotId, status: "WAITLISTED" },
          orderBy: { createdAt: "asc" },
        });
        if (next) {
          await tx.beneficiarySignup.update({
            where: { id: next.id },
            data: { status: "CONFIRMED" },
          });
          await tx.beneficiaryAuditLog.create({
            data: {
              action: "WAITLIST_PROMOTED",
              actorId: signup.studentId,
              signupId: next.id,
              details: JSON.stringify({ source: "one_click_cancel_promotion" }),
            },
          });
          promotedStudentId = next.studentId;
        }
      }

      return { kind: "cancelled" as const, promotedStudentId };
    });

    if (result.kind === "already_cancelled") {
      return res.status(200).json({ message: "You were already cancelled from this event." });
    }
    if (result.kind === "already_approved") {
      return res.status(400).json({ error: "Cannot cancel an already-approved signup." });
    }

    if (result.promotedStudentId) {
      await prisma.notification.create({
        data: {
          userId: result.promotedStudentId,
          type: "SIGNUP_CONFIRMED",
          title: "You're off the waitlist!",
          body: `A spot opened up for "${signup.slot.opportunity.title}" — you're now confirmed!`,
          data: JSON.stringify({ href: "/dashboard" }),
        },
      });
    }

    res.json({ message: `You've been successfully removed from "${signup.slot.opportunity.title}". Thank you for letting us know!` });
  } catch (err) {
    console.error("One-click cancel error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/beneficiaries/:id/opportunities/:oppId/attendance — org records attendance (Free)
router.post("/:id/opportunities/:oppId/attendance", authenticate, requireRole("BENEFICIARY_ADMIN", "SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    if (!await canManageBeneficiary(req.user!.userId, req.params.id)) {
      return res.status(403).json({ error: "Not your beneficiary" });
    }

    const opp = await prisma.beneficiaryOpportunity.findUnique({
      where: { id: req.params.oppId },
      select: { beneficiaryId: true },
    });
    if (!opp || opp.beneficiaryId !== req.params.id) {
      return res.status(404).json({ error: "Opportunity not found" });
    }

    // Expect body: { records: Array<{ signupId: string; attendance: "ATTENDED" | "NO_SHOW" }> }
    const { records } = req.body as { records?: Array<{ signupId: string; attendance: string }> };
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: "records array is required" });
    }

    const VALID = new Set(["ATTENDED", "NO_SHOW"]);
    const invalid = records.find((r) => !r.signupId || !VALID.has(r.attendance));
    if (invalid) {
      return res.status(400).json({ error: "Each record must have signupId and attendance (ATTENDED | NO_SHOW)" });
    }

    const signupIds = records.map((r) => r.signupId);
    const existing = await prisma.beneficiarySignup.findMany({
      where: { id: { in: signupIds }, slot: { opportunity: { id: req.params.oppId } } },
      select: { id: true },
    });
    const validIds = new Set(existing.map((s) => s.id));

    const updates = await Promise.all(
      records
        .filter((r) => validIds.has(r.signupId))
        .map((r) =>
          prisma.beneficiarySignup.update({
            where: { id: r.signupId },
            data: { attendance: r.attendance },
          })
        )
    );

    res.json({ updated: updates.length });
  } catch (err) {
    console.error("Attendance record error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/beneficiaries/:id/analytics — Pro attendance + reminder analytics
router.get("/:id/analytics", authenticate, requireRole("BENEFICIARY_ADMIN", "SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    if (!await canManageBeneficiary(req.user!.userId, req.params.id)) {
      return res.status(403).json({ error: "Not your beneficiary" });
    }

    try {
      await requireOrgFeature(req.params.id, "attendanceAnalytics");
    } catch (err) {
      if (err instanceof ForbiddenFeatureError) return sendForbiddenFeature(res as any, err);
      throw err;
    }

    // Date range filter (optional)
    const since = req.query.since ? new Date(req.query.since as string) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const [signupStats, reminderStats] = await Promise.all([
      // Attendance summary
      prisma.beneficiarySignup.groupBy({
        by: ["attendance"],
        where: {
          slot: {
            opportunity: { beneficiaryId: req.params.id },
            date: { gte: since },
          },
          status: { in: ["CONFIRMED", "NO_SHOW"] },
        },
        _count: { id: true },
      }),
      // Reminder delivery summary
      prisma.orgEventReminderLog.groupBy({
        by: ["deliveryStatus"],
        where: {
          beneficiaryId: req.params.id,
          createdAt: { gte: since },
        },
        _count: { id: true },
      }),
    ]);

    // Cancellations initiated through one-click cancel
    const oneClickCancels = await prisma.beneficiaryAuditLog.count({
      where: {
        action: "SIGNUP_CANCELLED",
        details: { contains: "one_click_cancel" },
        createdAt: { gte: since },
        signup: { slot: { opportunity: { beneficiaryId: req.params.id } } },
      },
    });

    // Waitlist promotions
    const waitlistPromotions = await prisma.beneficiaryAuditLog.count({
      where: {
        action: "WAITLIST_PROMOTED",
        createdAt: { gte: since },
        signup: { slot: { opportunity: { beneficiaryId: req.params.id } } },
      },
    });

    const attendedCount = signupStats.find((s) => s.attendance === "ATTENDED")?._count.id ?? 0;
    const noShowCount = signupStats.find((s) => s.attendance === "NO_SHOW")?._count.id ?? 0;
    const unrecordedCount = signupStats.find((s) => s.attendance === null)?._count.id ?? 0;
    const totalRecorded = attendedCount + noShowCount;

    const reminderSent = reminderStats.find((s) => s.deliveryStatus === "SENT")?._count.id ?? 0;
    const reminderFailed = reminderStats.find((s) => s.deliveryStatus === "FAILED")?._count.id ?? 0;
    const reminderTotal = reminderSent + reminderFailed;

    res.json({
      period: { since: since.toISOString() },
      attendance: {
        attended: attendedCount,
        noShow: noShowCount,
        unrecorded: unrecordedCount,
        totalRecorded,
        attendanceRate: totalRecorded > 0 ? (attendedCount / totalRecorded) : null,
        noShowRate: totalRecorded > 0 ? (noShowCount / totalRecorded) : null,
      },
      reminders: {
        sent: reminderSent,
        failed: reminderFailed,
        total: reminderTotal,
        deliveryRate: reminderTotal > 0 ? (reminderSent / reminderTotal) : null,
      },
      cancellations: {
        oneClickCancels,
        waitlistReplacementsCompleted: waitlistPromotions,
      },
    });
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/beneficiaries/:id/tier — return tier info + feature flags for this org
router.get("/:id/tier", authenticate, requireRole("BENEFICIARY_ADMIN", "SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    if (!await canManageBeneficiary(req.user!.userId, req.params.id)) {
      return res.status(403).json({ error: "Not your beneficiary" });
    }
    const tier = await getOrgTier(req.params.id);
    const limits = getOrgTierLimits(tier);
    res.json({ tier, limits });
  } catch (err) {
    console.error("Tier info error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/beneficiaries/:id/branding — update org email branding (Pro)
router.patch("/:id/branding", authenticate, requireRole("BENEFICIARY_ADMIN"), async (req: Request, res: Response) => {
  try {
    if (!await canManageBeneficiary(req.user!.userId, req.params.id)) {
      return res.status(403).json({ error: "Not your beneficiary" });
    }
    try {
      await requireOrgFeature(req.params.id, "customEmailBranding");
    } catch (err) {
      if (err instanceof ForbiddenFeatureError) return sendForbiddenFeature(res as any, err);
      throw err;
    }

    const { brandColor, logoUrl, emailSignature } = req.body as {
      brandColor?: string;
      logoUrl?: string;
      emailSignature?: string;
    };

    const updated = await prisma.beneficiary.update({
      where: { id: req.params.id },
      data: {
        ...(brandColor !== undefined ? { brandColor: brandColor || null } : {}),
        ...(logoUrl !== undefined ? { logoUrl: logoUrl || null } : {}),
        ...(emailSignature !== undefined ? { emailSignature: emailSignature || null } : {}),
      },
      select: { id: true, brandColor: true, logoUrl: true, emailSignature: true },
    });

    res.json(updated);
  } catch (err) {
    console.error("Branding update error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/beneficiaries/:id/reminder-config — get reminder configuration
router.get("/:id/reminder-config", authenticate, requireRole("BENEFICIARY_ADMIN"), async (req: Request, res: Response) => {
  try {
    if (!await canManageBeneficiary(req.user!.userId, req.params.id)) {
      return res.status(403).json({ error: "Not your beneficiary" });
    }

    const tier = await getOrgTier(req.params.id);
    let config = await prisma.orgReminderConfig.findUnique({ where: { beneficiaryId: req.params.id } });

    if (!config) {
      // Return defaults without persisting (lazy creation happens on first save)
      const defaultReminders = tier === "PRO" ? DEFAULT_PRO_REMINDERS : DEFAULT_FREE_REMINDERS;
      return res.json({
        beneficiaryId: req.params.id,
        reminders: defaultReminders,
        waitlistCutoffHours: null,
        requireApprovalForPromotion: false,
        disableAutoPromotion: false,
        promoMessageTemplate: null,
        tier,
      });
    }

    res.json({
      ...config,
      reminders: JSON.parse(config.reminders),
      tier,
    });
  } catch (err) {
    console.error("Reminder config fetch error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/beneficiaries/:id/reminder-config — update reminder configuration
router.put("/:id/reminder-config", authenticate, requireRole("BENEFICIARY_ADMIN"), async (req: Request, res: Response) => {
  try {
    if (!await canManageBeneficiary(req.user!.userId, req.params.id)) {
      return res.status(403).json({ error: "Not your beneficiary" });
    }

    const tier = await getOrgTier(req.params.id);
    const body = req.body as {
      reminders?: Array<{ minutesBefore: number; enabled: boolean; label: string }>;
      waitlistCutoffHours?: number | null;
      requireApprovalForPromotion?: boolean;
      disableAutoPromotion?: boolean;
      promoMessageTemplate?: string | null;
    };

    // Free orgs can only have the one standardized 24h reminder
    if (tier === "FREE") {
      if (body.reminders && (body.reminders.length > 1 || body.reminders.some((r) => r.minutesBefore !== 1440))) {
        try { await requireOrgFeature(req.params.id, "configurableReminders"); } catch (err) {
          if (err instanceof ForbiddenFeatureError) return sendForbiddenFeature(res as any, err);
          throw err;
        }
      }
      if (body.waitlistCutoffHours != null || body.requireApprovalForPromotion || body.disableAutoPromotion) {
        try { await requireOrgFeature(req.params.id, "advancedWaitlistControls"); } catch (err) {
          if (err instanceof ForbiddenFeatureError) return sendForbiddenFeature(res as any, err);
          throw err;
        }
      }
    }

    const remindersJson = body.reminders ? JSON.stringify(body.reminders) : undefined;

    const config = await prisma.orgReminderConfig.upsert({
      where: { beneficiaryId: req.params.id },
      create: {
        beneficiaryId: req.params.id,
        reminders: remindersJson ?? JSON.stringify(tier === "PRO" ? DEFAULT_PRO_REMINDERS : DEFAULT_FREE_REMINDERS),
        waitlistCutoffHours: body.waitlistCutoffHours ?? null,
        requireApprovalForPromotion: body.requireApprovalForPromotion ?? false,
        disableAutoPromotion: body.disableAutoPromotion ?? false,
        promoMessageTemplate: body.promoMessageTemplate ?? null,
      },
      update: {
        ...(remindersJson !== undefined ? { reminders: remindersJson } : {}),
        ...(body.waitlistCutoffHours !== undefined ? { waitlistCutoffHours: body.waitlistCutoffHours } : {}),
        ...(body.requireApprovalForPromotion !== undefined ? { requireApprovalForPromotion: body.requireApprovalForPromotion } : {}),
        ...(body.disableAutoPromotion !== undefined ? { disableAutoPromotion: body.disableAutoPromotion } : {}),
        ...(body.promoMessageTemplate !== undefined ? { promoMessageTemplate: body.promoMessageTemplate } : {}),
      },
    });

    res.json({ ...config, reminders: JSON.parse(config.reminders), tier });
  } catch (err) {
    console.error("Reminder config update error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/beneficiaries/signups/:signupId/no-show — beneficiary admin marks student as no-show
router.post("/signups/:signupId/no-show", authenticate, requireRole("BENEFICIARY_ADMIN", "SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    const signup = await prisma.beneficiarySignup.findUnique({
      where: { id: req.params.signupId },
      include: { slot: { include: { opportunity: true } } },
    });
    if (!signup) return res.status(404).json({ error: "Signup not found" });

    if (!await canManageBeneficiary(req.user!.userId, signup.slot.opportunity.beneficiaryId)) {
      return res.status(403).json({ error: "Not your beneficiary's signup" });
    }
    if (signup.status === "CANCELLED") return res.status(400).json({ error: "Cannot mark a cancelled signup as no-show" });
    if (signup.status === "WAITLISTED") return res.status(400).json({ error: "Waitlisted signups cannot be marked as no-show" });
    if (signup.status === "NO_SHOW") return res.status(400).json({ error: "Student is already marked as a no-show" });
    const fromStatus = getBeneficiarySignupDisplayStatus(signup);

    const updated = await prisma.beneficiarySignup.update({
      where: { id: signup.id },
      data: {
        status: "NO_SHOW",
        attendance: "NO_SHOW",
        verificationStatus: "PENDING",
        rejectionReason: null,
        verifiedBy: null,
        verifiedAt: null,
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
        details: JSON.stringify({ studentId: signup.studentId, previousStatus: fromStatus }),
      },
    });

    await notifyBeneficiarySignupReviewChange({
      studentId: signup.studentId,
      opportunityTitle: signup.slot.opportunity.title,
      slotDate: signup.slot.date,
      fromStatus,
      toStatus: "No-Show",
    });

    res.json(updated);
  } catch (err) {
    console.error("No-show error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Beneficiary administrator management ──────────────────────────────────
// Returns the minimum data required for a front-desk attendance checklist.
router.get("/:id/opportunities/:oppId/attendance-checklist", authenticate, requireRole("BENEFICIARY_ADMIN"), async (req, res) => {
  const actor = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (actor?.beneficiaryId !== req.params.id) return res.status(403).json({ error: "Forbidden" });
  const slotId = typeof req.query.slotId === "string" ? req.query.slotId : "";
  if (!slotId) return res.status(400).json({ error: "slotId is required" });
  const slot = await prisma.beneficiaryTimeSlot.findFirst({
    where: { id: slotId, opportunityId: req.params.oppId, opportunity: { beneficiaryId: req.params.id } },
    select: { id: true, date: true, startTime: true, endTime: true, opportunity: { select: { id: true, title: true } } },
  });
  if (!slot) return res.status(404).json({ error: "Time slot not found" });
  const records = await prisma.beneficiarySignup.findMany({
    where: { slotId, status: { in: ["CONFIRMED", "NO_SHOW"] } },
    select: { id: true, attendance: true, studentId: true },
  });
  const students = await prisma.user.findMany({ where: { id: { in: records.map((record) => record.studentId) } }, select: { id: true, name: true } });
  const namesByStudentId = new Map(students.map((student) => [student.id, student.name]));
  res.json({
    opportunity: slot.opportunity,
    slot: { id: slot.id, date: slot.date, startTime: slot.startTime, endTime: slot.endTime },
    records: records.map(({ id, attendance, studentId }) => ({ signupId: id, name: namesByStudentId.get(studentId) ?? "Volunteer", attendance })).sort((a, b) => a.name.localeCompare(b.name)),
  });
});

router.get("/:id/admins", authenticate, requireRole("BENEFICIARY_ADMIN"), async (req, res) => {
  const actor = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (actor?.beneficiaryId !== req.params.id) return res.status(403).json({ error: "Forbidden" });
  const admins = await prisma.user.findMany({
    where: { beneficiaryId: req.params.id, role: "BENEFICIARY_ADMIN" },
    select: { id: true, name: true, email: true, beneficiaryAdminRole: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  res.json(admins);
});

router.get("/:id/admin-invitations", authenticate, requireRole("BENEFICIARY_ADMIN"), async (req, res) => {
  const actor = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (actor?.beneficiaryId !== req.params.id || actor.beneficiaryAdminRole !== "OWNER") {
    return res.status(403).json({ error: "Owner access required" });
  }
  const invitations = await prisma.beneficiaryAdminInvitation.findMany({
    where: { beneficiaryId: req.params.id, status: "PENDING" },
    select: { id: true, email: true, expiresAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(invitations);
});

router.post("/:id/admin-invitations", authenticate, requireRole("BENEFICIARY_ADMIN"), async (req, res) => {
  const actor = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (actor?.beneficiaryId !== req.params.id || actor.beneficiaryAdminRole !== "OWNER") return res.status(403).json({ error: "Owner access required" });
  const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "A valid email is required" });
  const email = parsed.data.email.trim().toLowerCase();
  const [existingAdmin, existingInvitation] = await Promise.all([
    prisma.user.findFirst({ where: { email, beneficiaryId: req.params.id, role: "BENEFICIARY_ADMIN" }, select: { id: true } }),
    prisma.beneficiaryAdminInvitation.findFirst({
      where: { beneficiaryId: req.params.id, email, status: "PENDING", expiresAt: { gt: new Date() } },
      select: { id: true },
    }),
  ]);
  if (existingAdmin) return res.status(409).json({ error: "That person is already an administrator" });
  if (existingInvitation) return res.status(409).json({ error: "A pending invitation already exists for that email" });
  const token = crypto.randomBytes(32).toString("hex");
  const invitation = await prisma.beneficiaryAdminInvitation.create({ data: {
    beneficiaryId: req.params.id, email, token: hashToken(token), invitedById: actor.id,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  }});
  const beneficiary = await prisma.beneficiary.findUnique({ where: { id: req.params.id }, select: { name: true } });
  sendBeneficiaryAdminInvitationEmail(email, beneficiary?.name ?? "an organization", `${CLIENT_URL}/join/admin?token=${token}`).catch(() => {});
  res.status(201).json({ id: invitation.id, email, expiresAt: invitation.expiresAt });
});

router.post("/admin-invitations/:token/accept", authenticate, async (req, res) => {
  const invitation = await prisma.beneficiaryAdminInvitation.findUnique({ where: { token: hashToken(req.params.token) } });
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!invitation || !user || invitation.status !== "PENDING" || invitation.expiresAt <= new Date() || user.email.toLowerCase() !== invitation.email) return res.status(404).json({ error: "Invitation not available" });
  // An admin invitation must never silently convert a student or school user.
  if (user.role !== "BENEFICIARY_ADMIN" && user.role !== "ORG_ADMIN") {
    return res.status(409).json({ error: "Sign in with an existing organization administrator account to accept this invitation" });
  }
  if (user.beneficiaryId && user.beneficiaryId !== invitation.beneficiaryId) {
    return res.status(409).json({ error: "Leave your current organization before accepting an invitation to another organization" });
  }
  await prisma.$transaction(async (tx) => {
    const accepted = await tx.beneficiaryAdminInvitation.updateMany({
      where: { id: invitation.id, status: "PENDING", expiresAt: { gt: new Date() } },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });
    if (accepted.count !== 1) throw Object.assign(new Error("Invitation is no longer available"), { status: 409 });
    await tx.user.update({ where: { id: user.id }, data: { role: "BENEFICIARY_ADMIN", beneficiaryId: invitation.beneficiaryId, beneficiaryAdminRole: "ADMIN" } });
  });
  res.json({ ok: true, beneficiaryId: invitation.beneficiaryId });
});

router.delete("/:id/admins/:adminId", authenticate, requireRole("BENEFICIARY_ADMIN"), async (req, res) => {
  const [actor, target] = await Promise.all([prisma.user.findUnique({ where: { id: req.user!.userId } }), prisma.user.findUnique({ where: { id: req.params.adminId } })]);
  if (actor?.beneficiaryId !== req.params.id || actor.beneficiaryAdminRole !== "OWNER" || target?.beneficiaryId !== req.params.id) return res.status(403).json({ error: "Owner access required" });
  const owners = await prisma.user.count({ where: { beneficiaryId: req.params.id, role: "BENEFICIARY_ADMIN", beneficiaryAdminRole: "OWNER" } });
  if (!canRemoveBeneficiaryAdmin({ targetRole: target.beneficiaryAdminRole as "OWNER" | "ADMIN" | null, ownerCount: owners, targetUserId: target.id, actorUserId: actor.id })) {
    return res.status(400).json({ error: "An organization must retain an owner" });
  }
  await prisma.user.update({ where: { id: target.id }, data: { beneficiaryId: null, beneficiaryAdminRole: null } });
  res.json({ ok: true });
});

router.delete("/:id/admin-invitations/:invitationId", authenticate, requireRole("BENEFICIARY_ADMIN"), async (req, res) => {
  const actor = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (actor?.beneficiaryId !== req.params.id || actor.beneficiaryAdminRole !== "OWNER") return res.status(403).json({ error: "Owner access required" });
  await prisma.beneficiaryAdminInvitation.updateMany({ where: { id: req.params.invitationId, beneficiaryId: req.params.id, status: "PENDING" }, data: { status: "REVOKED" } });
  res.json({ ok: true });
});

export default router;
