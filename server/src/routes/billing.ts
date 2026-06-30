import fs from "fs";
import crypto from "crypto";
import multer from "multer";
import { Router, Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { BILLING_CONFIG } from "../lib/billingConfig";
import { getStripe } from "../lib/stripe";
import { isInternalAdminUser } from "../lib/internalAdmin";
import { detectMimeType } from "../lib/detectMimeType";
import { resolveWritableUploadDir } from "../lib/runtimeStorage";
import { sendOrganizationProcurementUpdateEmail } from "../services/email";

const router = Router();

const CLIENT_URL = process.env.CLIENT_URL ?? "http://localhost:5173";
const OPEN_INVOICE_REQUEST_STATUSES = ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "INVOICE_SENT"] as const;
const INTERNAL_REQUEST_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "INVOICE_SENT",
  "PAID",
  "REJECTED",
  "CANCELLED",
] as const;
const INTERNAL_STATUS_TRANSITIONS: Record<(typeof INTERNAL_REQUEST_STATUSES)[number], Array<(typeof INTERNAL_REQUEST_STATUSES)[number]>> = {
  SUBMITTED: ["UNDER_REVIEW", "APPROVED", "REJECTED", "CANCELLED"],
  UNDER_REVIEW: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["INVOICE_SENT", "PAID", "REJECTED", "CANCELLED"],
  INVOICE_SENT: ["PAID", "CANCELLED"],
  PAID: [],
  REJECTED: [],
  CANCELLED: [],
};
const ORG_PROCUREMENT_UPLOAD_DIR = resolveWritableUploadDir("organization-procurement");
const MAX_ARTIFACT_SIZE = 20 * 1024 * 1024;
const ALLOWED_ARTIFACT_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/tiff",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
]);
const ARTIFACT_DOC_TYPES = [
  "QUOTE",
  "INVOICE",
  "PURCHASE_ORDER",
  "W9",
  "SERVICE_AGREEMENT",
  "DATA_PRIVACY_AGREEMENT",
  "SECURITY_DOCUMENT",
  "CERTIFICATE_OF_INSURANCE",
  "NOTE",
  "OTHER",
] as const;
const artifactUpload = multer({
  storage: multer.diskStorage({
    destination: ORG_PROCUREMENT_UPLOAD_DIR,
    filename: (_req, _file, cb) => cb(null, crypto.randomUUID()),
  }),
  limits: { fileSize: MAX_ARTIFACT_SIZE, files: 1 },
});
const internalInvoiceRequestUpdateSchema = z.object({
  status: z.enum(INTERNAL_REQUEST_STATUSES).optional(),
  ownerUserId: z.string().cuid().nullable().optional(),
  internalNotes: z.string().max(5000).nullable().optional(),
  quoteAmountCents: z.coerce.number().int().min(0).nullable().optional(),
  invoiceNumber: z.string().trim().max(255).nullable().optional(),
  rejectedReason: z.string().trim().max(2000).nullable().optional(),
  auditNote: z.string().trim().max(2000).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" });
const internalCustomerUpdateSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(5000),
  visibleToCustomer: z.boolean().default(true),
});

const organizationInvoiceRequestSelect = {
  id: true,
  status: true,
  legalName: true,
  address: true,
  billingContactName: true,
  billingContactEmail: true,
  purchaseOrderRequired: true,
  taxExempt: true,
  preferredPaymentMethod: true,
  additionalNotes: true,
  internalNotes: true,
  quoteAmountCents: true,
  quoteSentAt: true,
  invoiceNumber: true,
  invoiceSentAt: true,
  paidAt: true,
  rejectedReason: true,
  lastContactedAt: true,
  createdAt: true,
  updatedAt: true,
  ownerUser: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  beneficiary: {
    select: {
      id: true,
      name: true,
      email: true,
      planTier: true,
    },
  },
  auditLogs: {
    orderBy: { changedAt: "desc" as const },
    select: {
      id: true,
      previousStatus: true,
      newStatus: true,
      note: true,
      subject: true,
      entryType: true,
      visibleToCustomer: true,
      changedAt: true,
      changedByUser: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  },
  artifacts: {
    orderBy: { createdAt: "desc" as const },
    select: {
      id: true,
      documentType: true,
      originalName: true,
      mimeType: true,
      fileSizeBytes: true,
      createdAt: true,
      uploadedByUser: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  },
} as const;

// ── Authorization helper ────────────────────────────────────────────────────
async function requireBeneficiaryAdmin(userId: string, beneficiaryId: string): Promise<void> {
  const member = await prisma.user.findFirst({
    where: { id: userId, beneficiaryId, role: "BENEFICIARY_ADMIN" },
  });
  if (!member) throw Object.assign(new Error("Forbidden"), { status: 403 });
}

async function requireInternalAdmin(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, role: true },
  });
  if (!user || !isInternalAdminUser(user)) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
}

async function listInternalAdminUsers() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });
  return users.filter((user) => isInternalAdminUser(user)).map(({ id, name, email }) => ({ id, name, email }));
}

async function requireBeneficiaryAdminOrInternalAdmin(userId: string, beneficiaryId: string): Promise<"beneficiary" | "internal"> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, role: true, beneficiaryId: true },
  });
  if (!user) throw Object.assign(new Error("Forbidden"), { status: 403 });
  if (user.role === "BENEFICIARY_ADMIN" && user.beneficiaryId === beneficiaryId) return "beneficiary";
  if (isInternalAdminUser(user)) return "internal";
  throw Object.assign(new Error("Forbidden"), { status: 403 });
}

function isAllowedInternalStatusTransition(current: string, next: string): boolean {
  const allowed = INTERNAL_STATUS_TRANSITIONS[current as keyof typeof INTERNAL_STATUS_TRANSITIONS];
  return Array.isArray(allowed) && allowed.includes(next as (typeof INTERNAL_REQUEST_STATUSES)[number]);
}

function redactRequestForBeneficiary<T extends Record<string, any>>(request: T): Omit<T, "internalNotes" | "ownerUser" | "beneficiary"> {
  const {
    internalNotes: _internalNotes,
    ownerUser: _ownerUser,
    beneficiary: _beneficiary,
    auditLogs,
    ...rest
  } = request;
  return {
    ...rest,
    auditLogs: Array.isArray(auditLogs)
      ? auditLogs.map((log: any) => ({
          id: log.id,
          previousStatus: log.previousStatus,
          newStatus: log.newStatus,
          subject: log.subject,
          entryType: log.entryType,
          note: log.visibleToCustomer ? log.note : null,
          changedAt: log.changedAt,
        })).filter((log: any) => log.entryType === "STATUS" || log.note || log.subject)
      : [],
  } as Omit<T, "internalNotes" | "ownerUser" | "beneficiary">;
}

function toStoredBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(Array.from(bytes));
}

// ── GET /api/billing/organizations/:id/summary ──────────────────────────────
router.get("/:id/summary", authenticate, async (req: Request, res: Response) => {
  try {
    await requireBeneficiaryAdmin(req.user!.userId, req.params.id);

    const ben = await prisma.beneficiary.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        planTier: true,
        proActivatedAt: true,
        subscriptionStatus: true,
        billingInterval: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        invoiceRequests: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: organizationInvoiceRequestSelect,
        },
      },
    });
    if (!ben) return res.status(404).json({ error: "Organization not found" });

    const config = BILLING_CONFIG.organization;
    res.json({
      ...ben,
      invoiceRequests: ben.invoiceRequests.map(redactRequestForBeneficiary),
      proMonthlyPriceCents: config.proMonthlyPriceCents,
      proAnnualPriceCents: config.proAnnualPriceCents,
      hasStripeCustomer: !!ben.stripeCustomerId,
    });
  } catch (err: any) {
    if (err.status === 403) return res.status(403).json({ error: "Forbidden" });
    console.error("[billing] summary error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/billing/organizations/:id/checkout ────────────────────────────
const checkoutSchema = z.object({
  interval: z.enum(["monthly", "annual"]),
});

router.post("/:id/checkout", authenticate, async (req: Request, res: Response) => {
  try {
    await requireBeneficiaryAdmin(req.user!.userId, req.params.id);

    const parse = checkoutSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: "interval must be 'monthly' or 'annual'" });
    const { interval } = parse.data;

    const ben = await prisma.beneficiary.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, planTier: true, stripeCustomerId: true },
    });
    if (!ben) return res.status(404).json({ error: "Organization not found" });
    if (ben.planTier === "PRO") return res.status(400).json({ error: "Already on Pro plan" });

    const stripe = getStripe();
    const config = BILLING_CONFIG.organization;
    const priceId = interval === "annual" ? config.stripeAnnualPriceId : config.stripeMonthlyPriceId;
    if (!priceId) return res.status(503).json({ error: "Billing not configured" });

    // Find or create Stripe customer
    let customerId = ben.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: ben.name,
        metadata: { beneficiaryId: ben.id },
      });
      customerId = customer.id;
      await prisma.beneficiary.update({
        where: { id: ben.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${CLIENT_URL}/settings?tab=billing&checkout=success`,
      cancel_url: `${CLIENT_URL}/settings?tab=billing`,
      subscription_data: {
        metadata: { beneficiaryId: ben.id },
      },
      metadata: { beneficiaryId: ben.id },
      allow_promotion_codes: true,
    });

    res.json({ url: session.url });
  } catch (err: any) {
    if (err.status === 403) return res.status(403).json({ error: "Forbidden" });
    console.error("[billing] checkout error:", err);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

// ── POST /api/billing/organizations/:id/portal ──────────────────────────────
router.post("/:id/portal", authenticate, async (req: Request, res: Response) => {
  try {
    await requireBeneficiaryAdmin(req.user!.userId, req.params.id);

    const ben = await prisma.beneficiary.findUnique({
      where: { id: req.params.id },
      select: { stripeCustomerId: true, subscriptionStatus: true },
    });
    if (!ben) return res.status(404).json({ error: "Organization not found" });
    if (!ben.stripeCustomerId) return res.status(400).json({ error: "No active subscription to manage" });

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: ben.stripeCustomerId,
      return_url: `${CLIENT_URL}/settings?tab=billing`,
    });

    res.json({ url: session.url });
  } catch (err: any) {
    if (err.status === 403) return res.status(403).json({ error: "Forbidden" });
    console.error("[billing] portal error:", err);
    res.status(500).json({ error: "Failed to create portal session" });
  }
});

// ── POST /api/billing/organizations/:id/invoice-request ────────────────────
const invoiceRequestSchema = z.object({
  legalName: z.string().min(1),
  address: z.string().min(1),
  billingContactName: z.string().min(1),
  billingContactEmail: z.string().email(),
  purchaseOrderRequired: z.boolean().default(false),
  taxExempt: z.boolean().default(false),
  preferredPaymentMethod: z.string().optional(),
  additionalNotes: z.string().optional(),
});

router.post("/:id/invoice-request", authenticate, async (req: Request, res: Response) => {
  try {
    await requireBeneficiaryAdmin(req.user!.userId, req.params.id);

    const parse = invoiceRequestSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.issues[0]?.message });

    const ben = await prisma.beneficiary.findUnique({ where: { id: req.params.id } });
    if (!ben) return res.status(404).json({ error: "Organization not found" });

    const existingOpenRequest = await prisma.organizationInvoiceRequest.findFirst({
      where: {
        beneficiaryId: req.params.id,
        status: { in: [...OPEN_INVOICE_REQUEST_STATUSES] },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true },
    });
    if (existingOpenRequest) {
      return res.status(409).json({
        error: "A procurement request is already in progress. Track its status below or contact GoodHours to update it.",
        requestId: existingOpenRequest.id,
        status: existingOpenRequest.status,
      });
    }

    const request = await prisma.$transaction(async (tx) => {
      const created = await tx.organizationInvoiceRequest.create({
        data: {
          beneficiary: { connect: { id: req.params.id } },
          legalName: parse.data.legalName,
          address: parse.data.address,
          billingContactName: parse.data.billingContactName,
          billingContactEmail: parse.data.billingContactEmail,
          purchaseOrderRequired: parse.data.purchaseOrderRequired,
          taxExempt: parse.data.taxExempt,
          preferredPaymentMethod: parse.data.preferredPaymentMethod,
          additionalNotes: parse.data.additionalNotes,
        },
      });
      await tx.organizationInvoiceAuditLog.create({
        data: {
          invoiceRequestId: created.id,
          previousStatus: null,
          newStatus: "SUBMITTED",
          changedByUserId: req.user!.userId,
          entryType: "STATUS",
          visibleToCustomer: true,
          note: "Request submitted by organization admin",
        },
      });
      return created;
    });

    res.status(201).json({ id: request.id, status: request.status });
  } catch (err: any) {
    if (err.status === 403) return res.status(403).json({ error: "Forbidden" });
    console.error("[billing] invoice-request error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PATCH /api/billing/organizations/internal/invoice-requests/:requestId ──
router.patch("/internal/invoice-requests/:requestId", authenticate, async (req: Request, res: Response) => {
  try {
    await requireInternalAdmin(req.user!.userId);

    const parse = internalInvoiceRequestUpdateSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.issues[0]?.message || "Invalid status" });

    const existing = await prisma.organizationInvoiceRequest.findUnique({
      where: { id: req.params.requestId },
      select: {
        id: true,
        status: true,
        ownerUserId: true,
      },
    });
    if (!existing) return res.status(404).json({ error: "Invoice request not found" });

    if (parse.data.status && existing.status !== parse.data.status && !isAllowedInternalStatusTransition(existing.status, parse.data.status)) {
      return res.status(400).json({
        error: `Cannot move request from ${existing.status} to ${parse.data.status}`,
      });
    }

    if (parse.data.ownerUserId) {
      const owner = await prisma.user.findUnique({
        where: { id: parse.data.ownerUserId },
        select: { email: true, role: true },
      });
      if (!owner || !isInternalAdminUser(owner)) {
        return res.status(400).json({ error: "Assigned owner must be an internal admin" });
      }
    }

    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const data: Record<string, any> = {};
      if (parse.data.status !== undefined) {
        data.status = parse.data.status;
        if (parse.data.status === "APPROVED") {
          data.quoteSentAt = now;
        }
        if (parse.data.status === "INVOICE_SENT") {
          data.invoiceSentAt = now;
        }
        if (parse.data.status === "PAID") {
          data.paidAt = now;
        }
        if (parse.data.status !== "REJECTED") {
          data.rejectedReason = null;
        }
      }
      if (parse.data.ownerUserId !== undefined) data.ownerUserId = parse.data.ownerUserId;
      if (parse.data.internalNotes !== undefined) data.internalNotes = parse.data.internalNotes;
      if (parse.data.quoteAmountCents !== undefined) data.quoteAmountCents = parse.data.quoteAmountCents;
      if (parse.data.invoiceNumber !== undefined) data.invoiceNumber = parse.data.invoiceNumber;
      if (parse.data.rejectedReason !== undefined) data.rejectedReason = parse.data.rejectedReason;

      await tx.organizationInvoiceRequest.update({
        where: { id: req.params.requestId },
        data,
      });

      const shouldCreateAuditLog =
        parse.data.status !== undefined && parse.data.status !== existing.status ||
        parse.data.auditNote !== undefined ||
        parse.data.ownerUserId !== undefined;

      if (shouldCreateAuditLog) {
        const noteParts = [
          parse.data.auditNote || null,
          parse.data.ownerUserId !== undefined
            ? parse.data.ownerUserId
              ? "Owner assigned"
              : "Owner cleared"
            : null,
        ].filter(Boolean);
        await tx.organizationInvoiceAuditLog.create({
          data: {
            invoiceRequestId: req.params.requestId,
            previousStatus: parse.data.status !== undefined ? existing.status : existing.status,
            newStatus: parse.data.status ?? existing.status,
            changedByUserId: req.user!.userId,
            entryType: "STATUS",
            visibleToCustomer: false,
            note: noteParts.join(" — ") || null,
          },
        });
      }

      return tx.organizationInvoiceRequest.findUniqueOrThrow({
        where: { id: req.params.requestId },
        select: organizationInvoiceRequestSelect,
      });
    });

    res.json(updated);
  } catch (err: any) {
    if (err.status === 403) return res.status(403).json({ error: "Forbidden" });
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues[0]?.message || "Invalid payload" });
    console.error("[billing] internal invoice-request update error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/billing/organizations/internal/invoice-requests/:requestId/artifacts ──
router.post(
  "/internal/invoice-requests/:requestId/artifacts",
  authenticate,
  artifactUpload.single("file"),
  async (req: Request, res: Response) => {
    try {
      await requireInternalAdmin(req.user!.userId);
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const documentType = String(req.body.documentType || "");
      if (!ARTIFACT_DOC_TYPES.includes(documentType as typeof ARTIFACT_DOC_TYPES[number])) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: "Invalid document type" });
      }

      const requestRecord = await prisma.organizationInvoiceRequest.findUnique({
        where: { id: req.params.requestId },
        select: { id: true },
      });
      if (!requestRecord) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ error: "Invoice request not found" });
      }

      const mimeResult = detectMimeType(req.file.path, req.file.originalname);
      if (!mimeResult.allowed || !ALLOWED_ARTIFACT_MIME_TYPES.has(mimeResult.mimeType)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: "File type not permitted. Upload PDF, Word, spreadsheet, text, or image files." });
      }

      const verifiedStat = fs.statSync(req.file.path);
      const contentBytes = toStoredBytes(fs.readFileSync(req.file.path));

      const artifact = await prisma.organizationInvoiceArtifact.create({
        data: {
          invoiceRequestId: req.params.requestId,
          documentType,
          filename: req.file.filename,
          originalName: req.file.originalname,
          storedPath: req.file.path,
          fileSizeBytes: verifiedStat.size,
          mimeType: mimeResult.mimeType,
          contentBytes: contentBytes as any,
          uploadedByUserId: req.user!.userId,
        },
        select: {
          id: true,
          documentType: true,
          originalName: true,
          mimeType: true,
          fileSizeBytes: true,
          createdAt: true,
          uploadedByUser: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      await prisma.organizationInvoiceAuditLog.create({
        data: {
          invoiceRequestId: req.params.requestId,
          previousStatus: null,
          newStatus: "ARTIFACT_UPLOADED",
          changedByUserId: req.user!.userId,
          entryType: "ARTIFACT",
          visibleToCustomer: true,
          subject: documentType,
          note: `Uploaded ${documentType}: ${req.file.originalname}`,
        },
      });

      try { fs.unlinkSync(req.file.path); } catch {}

      res.status(201).json(artifact);
    } catch (err: any) {
      if (req.file?.path) { try { fs.unlinkSync(req.file.path); } catch {} }
      if (err.status === 403) return res.status(403).json({ error: "Forbidden" });
      console.error("[billing] artifact upload error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ── DELETE /api/billing/organizations/internal/invoice-requests/:requestId/artifacts/:artifactId ──
router.delete("/internal/invoice-requests/:requestId/artifacts/:artifactId", authenticate, async (req: Request, res: Response) => {
  try {
    await requireInternalAdmin(req.user!.userId);

    const artifact = await prisma.organizationInvoiceArtifact.findFirst({
      where: { id: req.params.artifactId, invoiceRequestId: req.params.requestId },
      select: { id: true, originalName: true, storedPath: true },
    });
    if (!artifact) return res.status(404).json({ error: "Artifact not found" });

    await prisma.$transaction(async (tx) => {
      await tx.organizationInvoiceArtifact.delete({ where: { id: artifact.id } });
      await tx.organizationInvoiceAuditLog.create({
        data: {
          invoiceRequestId: req.params.requestId,
          previousStatus: null,
          newStatus: "ARTIFACT_REMOVED",
          changedByUserId: req.user!.userId,
          entryType: "ARTIFACT",
          visibleToCustomer: false,
          note: `Removed artifact: ${artifact.originalName}`,
        },
      });
    });

    try {
      if (artifact.storedPath && fs.existsSync(artifact.storedPath)) fs.unlinkSync(artifact.storedPath);
    } catch {}

    res.status(204).send();
  } catch (err: any) {
    if (err.status === 403) return res.status(403).json({ error: "Forbidden" });
    console.error("[billing] artifact delete error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/billing/organizations/internal/invoice-requests/:requestId/contact ──
router.post("/internal/invoice-requests/:requestId/contact", authenticate, async (req: Request, res: Response) => {
  try {
    await requireInternalAdmin(req.user!.userId);
    const parse = internalCustomerUpdateSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ error: parse.error.issues[0]?.message || "Invalid payload" });

    const requestRecord = await prisma.organizationInvoiceRequest.findUnique({
      where: { id: req.params.requestId },
      select: {
        id: true,
        legalName: true,
        billingContactEmail: true,
        status: true,
      },
    });
    if (!requestRecord) return res.status(404).json({ error: "Invoice request not found" });

    await sendOrganizationProcurementUpdateEmail({
      to: requestRecord.billingContactEmail,
      organizationName: requestRecord.legalName,
      subject: parse.data.subject,
      message: parse.data.message,
    });

    await prisma.$transaction(async (tx) => {
      await tx.organizationInvoiceRequest.update({
        where: { id: req.params.requestId },
        data: { lastContactedAt: new Date() },
      });
      await tx.organizationInvoiceAuditLog.create({
        data: {
          invoiceRequestId: req.params.requestId,
          previousStatus: requestRecord.status,
          newStatus: requestRecord.status,
          changedByUserId: req.user!.userId,
          entryType: "CONTACT",
          visibleToCustomer: parse.data.visibleToCustomer,
          subject: parse.data.subject,
          note: parse.data.message,
        },
      });
    });

    const updated = await prisma.organizationInvoiceRequest.findUniqueOrThrow({
      where: { id: req.params.requestId },
      select: organizationInvoiceRequestSelect,
    });
    res.json(updated);
  } catch (err: any) {
    if (err.status === 403) return res.status(403).json({ error: "Forbidden" });
    console.error("[billing] customer contact error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// ── GET /api/billing/organizations/invoice-requests/:requestId/artifacts/:artifactId ──
router.get("/invoice-requests/:requestId/artifacts/:artifactId", authenticate, async (req: Request, res: Response) => {
  try {
    const artifact = await prisma.organizationInvoiceArtifact.findFirst({
      where: { id: req.params.artifactId, invoiceRequestId: req.params.requestId },
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        storedPath: true,
        contentBytes: true,
        invoiceRequest: {
          select: {
            beneficiaryId: true,
          },
        },
      },
    });
    if (!artifact) return res.status(404).json({ error: "Artifact not found" });

    await requireBeneficiaryAdminOrInternalAdmin(req.user!.userId, artifact.invoiceRequest.beneficiaryId);

    res.setHeader("Content-Disposition", `attachment; filename=\"${artifact.originalName}\"`);
    res.setHeader("Content-Type", artifact.mimeType);
    if (artifact.contentBytes) {
      res.send(Buffer.from(artifact.contentBytes));
      return;
    }
    if (!fs.existsSync(artifact.storedPath)) return res.status(404).json({ error: "File not found" });
    res.sendFile(artifact.storedPath);
  } catch (err: any) {
    if (err.status === 403) return res.status(403).json({ error: "Forbidden" });
    console.error("[billing] artifact download error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/billing/organizations/internal/operators ──────────────────────
router.get("/internal/operators", authenticate, async (req: Request, res: Response) => {
  try {
    await requireInternalAdmin(req.user!.userId);
    const operators = await listInternalAdminUsers();
    res.json({ operators });
  } catch (err: any) {
    if (err.status === 403) return res.status(403).json({ error: "Forbidden" });
    console.error("[billing] internal operators error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/billing/organizations/internal/invoice-requests ───────────────
router.get("/internal/invoice-requests", authenticate, async (req: Request, res: Response) => {
  try {
    await requireInternalAdmin(req.user!.userId);

    const query = z.object({
      limit: z.coerce.number().int().min(1).max(100).optional(),
      status: z.string().trim().min(1).optional(),
    }).parse(req.query);

    const requests = await prisma.organizationInvoiceRequest.findMany({
      where: query.status ? { status: query.status } : undefined,
      orderBy: { createdAt: "desc" },
      take: query.limit ?? 25,
      select: organizationInvoiceRequestSelect,
    });

    res.json({ requests });
  } catch (err: any) {
    if (err.status === 403) return res.status(403).json({ error: "Forbidden" });
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues[0]?.message || "Invalid query" });
    console.error("[billing] internal invoice-requests error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
