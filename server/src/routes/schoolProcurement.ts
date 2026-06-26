import { Router, Request, Response } from "express";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import multer from "multer";
import { z } from "zod";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { calculateSchoolEstimate, BILLING_CONFIG } from "../lib/billingConfig";
import { detectMimeType } from "../lib/detectMimeType";

const PROC_UPLOAD_DIR = path.join(__dirname, "../../../uploads/school-procurement");
fs.mkdirSync(PROC_UPLOAD_DIR, { recursive: true });

const MAX_DOC_SIZE = 20 * 1024 * 1024; // 20 MB

const procUpload = multer({
  storage: multer.diskStorage({
    destination: PROC_UPLOAD_DIR,
    filename: (_req, _file, cb) => cb(null, crypto.randomUUID()),
  }),
  limits: { fileSize: MAX_DOC_SIZE, files: 1 },
});

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/tiff",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const ALLOWED_DOC_TYPES = [
  "QUOTE", "SERVICE_AGREEMENT", "DATA_PRIVACY_AGREEMENT", "SECURITY_DOCUMENT",
  "W9", "CERTIFICATE_OF_INSURANCE", "PURCHASE_ORDER", "INVOICE", "OTHER",
] as const;

const router = Router();

// ── Authorization helper ────────────────────────────────────────────────────
async function requireSchoolAdmin(userId: string, schoolId: string): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { id: userId, schoolId, role: { in: ["SCHOOL_ADMIN"] } },
  });
  if (!user) throw Object.assign(new Error("Forbidden"), { status: 403 });
}

// ── GET /api/school-procurement/:id/summary ─────────────────────────────────
router.get("/:id/summary", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    await requireSchoolAdmin(req.user!.userId, req.params.id);

    const school = await prisma.school.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        billingStatus: true,
        accessStatus: true,
        pilotExpiresAt: true,
        billingRecord: {
          include: {
            documents: {
              select: { id: true, documentType: true, filename: true, originalName: true, createdAt: true, uploadedByUserId: true },
              orderBy: { createdAt: "desc" },
            },
            auditLogs: {
              select: { id: true, previousStatus: true, newStatus: true, changedAt: true, note: true },
              orderBy: { changedAt: "desc" },
              take: 20,
            },
          },
        },
        quoteRequests: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
    if (!school) return res.status(404).json({ error: "School not found" });

    const config = BILLING_CONFIG.school;
    res.json({
      ...school,
      pricingConfig: {
        pricePerStudentCents: config.pricePerStudentCents,
        annualMinimumCents: config.annualMinimumCents,
      },
    });
  } catch (err: any) {
    if (err.status === 403) return res.status(403).json({ error: "Forbidden" });
    console.error("[schoolProcurement] summary error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/school-procurement/:id/quote-request ──────────────────────────
const quoteRequestSchema = z.object({
  schoolName: z.string().min(1),
  districtName: z.string().optional(),
  schoolWebsite: z.string().url().optional().or(z.literal("")),
  schoolAddress: z.string().optional(),
  schoolState: z.string().optional(),
  enrollment: z.number().int().min(1).max(100000),
  gradeLevels: z.string().optional(),
  primaryContactName: z.string().min(1),
  primaryContactTitle: z.string().optional(),
  primaryContactEmail: z.string().email(),
  primaryContactPhone: z.string().optional(),
  billingContactName: z.string().optional(),
  billingContactEmail: z.string().email().optional().or(z.literal("")),
  billingContactPhone: z.string().optional(),
  billingAddress: z.string().optional(),
  purchaseOrderRequired: z.boolean().default(false),
  vendorRegistrationRequired: z.boolean().default(false),
  w9Required: z.boolean().default(false),
  certificateOfInsuranceRequired: z.boolean().default(false),
  dataPrivacyAgreementRequired: z.boolean().default(false),
  preferredStartDate: z.string().optional(),
  procurementNotes: z.string().optional(),
});

router.post("/:id/quote-request", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    await requireSchoolAdmin(req.user!.userId, req.params.id);

    const parse = quoteRequestSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.issues[0]?.message });

    const school = await prisma.school.findUnique({
      where: { id: req.params.id },
      select: { billingStatus: true, accessStatus: true },
    });
    if (!school) return res.status(404).json({ error: "School not found" });

    // Do not allow re-requesting if already past NONE/QUOTE_REQUESTED
    const activeStatuses = ["QUOTE_IN_REVIEW", "QUOTE_SENT", "PRIVACY_REVIEW", "SECURITY_REVIEW",
      "CONTRACT_REVIEW", "AWAITING_SIGNATURE", "AWAITING_PURCHASE_ORDER",
      "PURCHASE_ORDER_RECEIVED", "INVOICED", "PAYMENT_PENDING", "ACTIVE"];
    if (activeStatuses.includes(school.billingStatus ?? "")) {
      return res.status(400).json({ error: "Procurement already in progress" });
    }

    // Server-side price calculation — never trust client-submitted price
    const estimatedAnnualCents = calculateSchoolEstimate(parse.data.enrollment);

    const result = await prisma.$transaction(async (tx) => {
      const quoteReq = await tx.schoolQuoteRequest.create({
        data: {
          school: { connect: { id: req.params.id } },
          schoolName: parse.data.schoolName,
          districtName: parse.data.districtName,
          schoolWebsite: parse.data.schoolWebsite,
          schoolAddress: parse.data.schoolAddress,
          schoolState: parse.data.schoolState,
          enrollment: parse.data.enrollment,
          gradeLevels: parse.data.gradeLevels,
          primaryContactName: parse.data.primaryContactName,
          primaryContactTitle: parse.data.primaryContactTitle,
          primaryContactEmail: parse.data.primaryContactEmail,
          primaryContactPhone: parse.data.primaryContactPhone,
          billingContactName: parse.data.billingContactName,
          billingContactEmail: parse.data.billingContactEmail,
          billingContactPhone: parse.data.billingContactPhone,
          billingAddress: parse.data.billingAddress,
          purchaseOrderRequired: parse.data.purchaseOrderRequired,
          vendorRegistrationRequired: parse.data.vendorRegistrationRequired,
          w9Required: parse.data.w9Required,
          certificateOfInsuranceRequired: parse.data.certificateOfInsuranceRequired,
          dataPrivacyAgreementRequired: parse.data.dataPrivacyAgreementRequired,
          preferredStartDate: parse.data.preferredStartDate ? new Date(parse.data.preferredStartDate) : null,
          procurementNotes: parse.data.procurementNotes,
          estimatedAnnualCents,
        },
      });

      // Update school billing status — but NOT access status
      await tx.school.update({
        where: { id: req.params.id },
        data: { billingStatus: "QUOTE_REQUESTED" },
      });

      return quoteReq;
    });

    res.status(201).json({
      id: result.id,
      estimatedAnnualCents,
      message: "Quote request submitted. We will be in touch within 2 business days.",
    });
  } catch (err: any) {
    if (err.status === 403) return res.status(403).json({ error: "Forbidden" });
    console.error("[schoolProcurement] quote-request error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/school-procurement/:id/documents ──────────────────────────────
router.post("/:id/documents",
  authenticate,
  requireRole("SCHOOL_ADMIN"),
  procUpload.single("file"),
  async (req: Request, res: Response) => {
    try {
      await requireSchoolAdmin(req.user!.userId, req.params.id);

      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const documentType = req.body.documentType;
      if (!ALLOWED_DOC_TYPES.includes(documentType)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: "Invalid document type" });
      }

      // Magic-byte MIME verification
      const mimeResult = await detectMimeType(req.file.path, req.file.originalname);
      const detectedMime = mimeResult.mimeType;
      if (!mimeResult.allowed || !ALLOWED_MIME_TYPES.has(detectedMime)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: "File type not permitted. Upload PDF, Word, or image files." });
      }

      const school = await prisma.school.findUnique({
        where: { id: req.params.id },
        select: { billingRecord: { select: { id: true } }, billingStatus: true },
      });
      if (!school) { fs.unlinkSync(req.file.path); return res.status(404).json({ error: "School not found" }); }
      if (!school.billingRecord) { fs.unlinkSync(req.file.path); return res.status(400).json({ error: "No active procurement record. Submit a quote request first." }); }

      const doc = await prisma.schoolProcurementDocument.create({
        data: {
          billingRecord: { connect: { id: school.billingRecord.id } },
          schoolId: req.params.id,
          documentType,
          filename: req.file.filename,
          originalName: req.file.originalname,
          storedPath: req.file.path,
          fileSizeBytes: req.file.size,
          mimeType: detectedMime,
          uploadedByUserId: req.user!.userId,
        },
      });

      res.status(201).json({ id: doc.id, documentType: doc.documentType, originalName: doc.originalName });
    } catch (err: any) {
      if (req.file?.path) { try { fs.unlinkSync(req.file.path); } catch {} }
      if (err.status === 403) return res.status(403).json({ error: "Forbidden" });
      console.error("[schoolProcurement] document upload error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ── GET /api/school-procurement/:id/documents/:docId ────────────────────────
router.get("/:id/documents/:docId", authenticate, requireRole("SCHOOL_ADMIN"), async (req: Request, res: Response) => {
  try {
    await requireSchoolAdmin(req.user!.userId, req.params.id);

    const doc = await prisma.schoolProcurementDocument.findFirst({
      where: { id: req.params.docId, schoolId: req.params.id },
    });
    if (!doc) return res.status(404).json({ error: "Document not found" });
    if (!fs.existsSync(doc.storedPath)) return res.status(404).json({ error: "File not found on server" });

    res.setHeader("Content-Disposition", `attachment; filename="${doc.originalName}"`);
    res.setHeader("Content-Type", doc.mimeType);
    res.sendFile(doc.storedPath);
  } catch (err: any) {
    if (err.status === 403) return res.status(403).json({ error: "Forbidden" });
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
