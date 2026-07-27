import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { getStripe } from "../lib/stripe";
import { processStripeEventAtomically } from "../lib/stripeWebhookProcessor";
import { hasExactApprovedProPrice, projectSubscriptionEntitlement, shouldApplySubscriptionEvent } from "../lib/stripeSubscriptionPolicy";
import { isPermanentSchoolPro, resolveBeneficiaryPlanTier } from "../lib/schoolBeneficiaryPolicy";
import { BILLING_CONFIG } from "../lib/billingConfig";

const router = Router();

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

function stripeObjectId(value: string | { id: string } | null): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function assertApprovedProSubscription(sub: import("stripe").Stripe.Subscription): void {
  const approvedPriceIds = new Set([
    BILLING_CONFIG.organization.stripeMonthlyPriceId,
    BILLING_CONFIG.organization.stripeAnnualPriceId,
  ].filter(Boolean));
  const subscriptionItems = sub.items.data.map((item) => ({
    priceId: item.price.id,
    quantity: item.quantity,
  }));
  if (!hasExactApprovedProPrice(subscriptionItems, approvedPriceIds)) {
    throw new Error(`Stripe subscription ${sub.id} must contain exactly one quantity-one approved organization Pro price`);
  }
}

async function resolveBeneficiaryForSubscription(
  tx: any,
  metadataBeneficiaryId: string | undefined,
  subscriptionId: string,
  customerId: string | null,
): Promise<string> {
  if (metadataBeneficiaryId) {
    const beneficiary = await tx.beneficiary.findUnique({
      where: { id: metadataBeneficiaryId },
      select: { id: true, stripeCustomerId: true },
    });
    if (!beneficiary) throw new Error(`Stripe metadata references missing beneficiary ${metadataBeneficiaryId}`);
    if (!customerId || beneficiary.stripeCustomerId !== customerId) {
      throw new Error(`Stripe customer mismatch for beneficiary ${metadataBeneficiaryId}`);
    }
    return beneficiary.id;
  }

  const matches = await tx.beneficiary.findMany({
    where: {
      OR: [
        { stripeSubscriptionId: subscriptionId },
        ...(customerId ? [{ stripeCustomerId: customerId }] : []),
      ],
    },
    select: { id: true },
    take: 2,
  });
  if (matches.length !== 1) {
    throw new Error(`Unable to resolve exactly one beneficiary for Stripe subscription ${subscriptionId}`);
  }
  return matches[0].id;
}

async function projectEntitlementForBeneficiary(
  tx: any,
  beneficiaryId: string,
  input: Parameters<typeof projectSubscriptionEntitlement>[0],
  incomingSubscriptionId: string,
  incomingEventCreatedAt: Date,
) {
  const beneficiary = await tx.beneficiary.findUnique({
    where: { id: beneficiaryId },
    select: {
      createdBySchoolId: true,
      visibility: true,
      hasSchoolComplimentaryPro: true,
      planTier: true,
      stripeSubscriptionId: true,
      subscriptionStatus: true,
      stripeEventCreatedAt: true,
    },
  });
  if (!beneficiary) throw new Error(`Beneficiary ${beneficiaryId} not found`);
  if (!shouldApplySubscriptionEvent({
    event: input.event,
    incomingSubscriptionId,
    incomingEventCreatedAt,
    currentSubscriptionId: beneficiary.stripeSubscriptionId,
    currentSubscriptionStatus: beneficiary.subscriptionStatus,
    currentEventCreatedAt: beneficiary.stripeEventCreatedAt,
  })) {
    return null;
  }
  const permanentPro = isPermanentSchoolPro(beneficiary);
  if (input.event === "deleted") {
    return {
      ...projectSubscriptionEntitlement({ event: "deleted", permanentPro }),
      stripeEventCreatedAt: incomingEventCreatedAt,
    };
  }
  return {
    ...projectSubscriptionEntitlement({
      ...input,
      permanentPro,
      currentPlanTier: resolveBeneficiaryPlanTier(
        beneficiary,
        beneficiary.planTier === "PRO" ? "PRO" : "FREE",
      ),
    }),
    stripeEventCreatedAt: incomingEventCreatedAt,
  };
}

router.post("/", async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"];
  if (!sig || !WEBHOOK_SECRET) {
    return res.status(400).json({ error: "Missing Stripe signature or webhook secret" });
  }

  let event: import("stripe").Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, WEBHOOK_SECRET);
  } catch (err: any) {
    console.error("[stripeWebhook] signature verification failed:", err.message);
    return res.status(400).json({ error: "Webhook signature invalid" });
  }
  const eventCreatedAt = new Date(event.created * 1000);

  // Fast-path already completed deliveries. The transactional helper below remains
  // the concurrency-safe deduplication boundary.
  try {
    const existing = await prisma.stripeProcessedEvent.findUnique({ where: { id: event.id } });
    if (existing) {
      return res.json({ received: true, skipped: true });
    }
  } catch (err) {
    console.error("[stripeWebhook] idempotency check failed:", err);
    return res.status(500).json({ error: "Internal error" });
  }

  try {
    let applyUpdate: (tx: any) => Promise<void> = async () => {};
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as import("stripe").Stripe.Checkout.Session;
        if (session.subscription) {
          const stripe = getStripe();
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          assertApprovedProSubscription(sub);
          const customerId = stripeObjectId(sub.customer);
          applyUpdate = async (tx) => {
            const beneficiaryId = await resolveBeneficiaryForSubscription(
              tx,
              session.metadata?.beneficiaryId ?? sub.metadata?.beneficiaryId,
              sub.id,
              customerId,
            );
            const entitlement = await projectEntitlementForBeneficiary(tx, beneficiaryId, {
              event: "checkout_completed",
              stripeStatus: sub.status,
              cancelAtPeriodEnd: sub.cancel_at_period_end,
            }, sub.id, eventCreatedAt);
            if (!entitlement) return;
            await tx.beneficiary.update({
              where: { id: beneficiaryId },
              data: {
                ...entitlement,
                proActivatedAt: new Date(),
                stripeCustomerId: customerId,
                stripeSubscriptionId: sub.id,
                stripePriceId: sub.items.data[0]?.price.id ?? null,
                billingInterval: sub.items.data[0]?.price.recurring?.interval === "year" ? "annual" : "monthly",
                currentPeriodEnd: new Date(sub.current_period_end * 1000),
                cancelAtPeriodEnd: sub.cancel_at_period_end,
              },
            });
          };
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        // Subscription webhook payloads can omit fields such as current_period_end
        // under newer Stripe API versions. Fetch the authoritative object before
        // deriving an entitlement projection or opening the DB transaction.
        const eventSubscription = event.data.object as import("stripe").Stripe.Subscription;
        const stripe = getStripe();
        const sub = await stripe.subscriptions.retrieve(eventSubscription.id);
        assertApprovedProSubscription(sub);
        const customerId = stripeObjectId(sub.customer);

        applyUpdate = async (tx) => {
          const beneficiaryId = await resolveBeneficiaryForSubscription(
            tx,
            sub.metadata?.beneficiaryId,
            sub.id,
            customerId,
          );
          const entitlement = await projectEntitlementForBeneficiary(tx, beneficiaryId, {
            event: event.type === "customer.subscription.created" ? "created" : "updated",
            stripeStatus: sub.status,
            cancelAtPeriodEnd: sub.cancel_at_period_end,
          }, sub.id, eventCreatedAt);
          if (!entitlement) return;
          await tx.beneficiary.update({
            where: { id: beneficiaryId },
            data: {
              ...entitlement,
              stripeCustomerId: customerId,
              stripeSubscriptionId: sub.id,
              stripePriceId: sub.items.data[0]?.price.id ?? null,
              billingInterval: sub.items.data[0]?.price.recurring?.interval === "year" ? "annual" : "monthly",
              currentPeriodEnd: new Date(sub.current_period_end * 1000),
              cancelAtPeriodEnd: sub.cancel_at_period_end,
            },
          });
        };
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as import("stripe").Stripe.Subscription;
        const customerId = stripeObjectId(sub.customer);

        applyUpdate = async (tx) => {
          const beneficiaryId = await resolveBeneficiaryForSubscription(
            tx,
            sub.metadata?.beneficiaryId,
            sub.id,
            customerId,
          );
          const entitlement = await projectEntitlementForBeneficiary(
            tx,
            beneficiaryId,
            { event: "deleted" },
            sub.id,
            eventCreatedAt,
          );
          if (!entitlement) return;
          await tx.beneficiary.update({
            where: { id: beneficiaryId },
            data: {
              ...entitlement,
              stripeSubscriptionId: null,
              stripePriceId: null,
              currentPeriodEnd: null,
              cancelAtPeriodEnd: false,
            },
          });
        };
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as import("stripe").Stripe.Invoice;
        if (invoice.subscription) {
          const stripe = getStripe();
          const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
          assertApprovedProSubscription(sub);
          const customerId = stripeObjectId(sub.customer);
          applyUpdate = async (tx) => {
            const beneficiaryId = await resolveBeneficiaryForSubscription(
              tx,
              sub.metadata?.beneficiaryId,
              sub.id,
              customerId,
            );
            const entitlement = await projectEntitlementForBeneficiary(tx, beneficiaryId, {
              event: "updated",
              stripeStatus: sub.status,
              cancelAtPeriodEnd: sub.cancel_at_period_end,
            }, sub.id, eventCreatedAt);
            if (!entitlement) return;
            await tx.beneficiary.update({
              where: { id: beneficiaryId },
              data: {
                ...entitlement,
                stripeCustomerId: customerId,
                stripeSubscriptionId: sub.id,
                stripePriceId: sub.items.data[0]?.price.id ?? null,
                billingInterval: sub.items.data[0]?.price.recurring?.interval === "year" ? "annual" : "monthly",
                currentPeriodEnd: new Date(sub.current_period_end * 1000),
                cancelAtPeriodEnd: sub.cancel_at_period_end,
              },
            });
          };
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as import("stripe").Stripe.Invoice;
        if (invoice.subscription) {
          const stripe = getStripe();
          const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
          assertApprovedProSubscription(sub);
          const customerId = stripeObjectId(sub.customer);
          applyUpdate = async (tx) => {
            const beneficiaryId = await resolveBeneficiaryForSubscription(
              tx,
              sub.metadata?.beneficiaryId,
              sub.id,
              customerId,
            );
            const entitlement = await projectEntitlementForBeneficiary(tx, beneficiaryId, {
              event: "updated",
              stripeStatus: sub.status,
              cancelAtPeriodEnd: sub.cancel_at_period_end,
            }, sub.id, eventCreatedAt);
            if (!entitlement) return;
            await tx.beneficiary.update({
              where: { id: beneficiaryId },
              data: {
                ...entitlement,
                stripeCustomerId: customerId,
                stripeSubscriptionId: sub.id,
                stripePriceId: sub.items.data[0]?.price.id ?? null,
                billingInterval: sub.items.data[0]?.price.recurring?.interval === "year" ? "annual" : "monthly",
                currentPeriodEnd: new Date(sub.current_period_end * 1000),
                cancelAtPeriodEnd: sub.cancel_at_period_end,
              },
            });
          };
        }
        break;
      }

      default:
        break;
    }

    const result = await processStripeEventAtomically(prisma, event.id, applyUpdate);
    return res.json({ received: true, ...(result.processed ? {} : { skipped: true }) });
  } catch (err) {
    console.error("[stripeWebhook] handler error for", event.type, err);
    return res.status(500).json({ error: "Webhook processing failed" });
  }
});

export default router;
