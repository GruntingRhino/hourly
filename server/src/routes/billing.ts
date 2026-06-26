import { Router, Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { BILLING_CONFIG } from "../lib/billingConfig";
import { getStripe } from "../lib/stripe";

const router = Router();

const CLIENT_URL = process.env.CLIENT_URL ?? "http://localhost:5173";

// ── Authorization helper ────────────────────────────────────────────────────
async function requireBeneficiaryAdmin(userId: string, beneficiaryId: string): Promise<void> {
  const member = await prisma.user.findFirst({
    where: { id: userId, beneficiaryId, role: "BENEFICIARY_ADMIN" },
  });
  if (!member) throw Object.assign(new Error("Forbidden"), { status: 403 });
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
          take: 3,
          select: { id: true, status: true, legalName: true, createdAt: true },
        },
      },
    });
    if (!ben) return res.status(404).json({ error: "Organization not found" });

    const config = BILLING_CONFIG.organization;
    res.json({
      ...ben,
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

    const request = await prisma.organizationInvoiceRequest.create({
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

    res.status(201).json({ id: request.id, status: request.status });
  } catch (err: any) {
    if (err.status === 403) return res.status(403).json({ error: "Forbidden" });
    console.error("[billing] invoice-request error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
