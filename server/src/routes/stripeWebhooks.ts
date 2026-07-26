import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { getStripe } from "../lib/stripe";
import { processStripeEventAtomically } from "../lib/stripeWebhookProcessor";
import { projectSubscriptionEntitlement } from "../lib/stripeSubscriptionPolicy";

const router = Router();

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

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
        const beneficiaryId = session.metadata?.beneficiaryId;
        if (beneficiaryId && session.subscription) {
          const stripe = getStripe();
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          applyUpdate = async (tx) => {
            await tx.beneficiary.update({
              where: { id: beneficiaryId },
              data: {
                planTier: "PRO",
                proActivatedAt: new Date(),
                subscriptionStatus: "ACTIVE",
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
        const sub = event.data.object as import("stripe").Stripe.Subscription;
        const beneficiaryId = sub.metadata?.beneficiaryId;
        if (!beneficiaryId) break;

        const entitlement = projectSubscriptionEntitlement({
          event: "updated",
          stripeStatus: sub.status,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        });

        applyUpdate = async (tx) => {
          await tx.beneficiary.update({
            where: { id: beneficiaryId },
            data: {
              ...entitlement,
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
        const beneficiaryId = sub.metadata?.beneficiaryId;
        if (!beneficiaryId) break;
        const entitlement = projectSubscriptionEntitlement({ event: "deleted" });

        applyUpdate = async (tx) => {
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
          const beneficiaryId = sub.metadata?.beneficiaryId;
          if (beneficiaryId) {
            applyUpdate = async (tx) => {
              await tx.beneficiary.update({
                where: { id: beneficiaryId },
                data: {
                  subscriptionStatus: "ACTIVE",
                  currentPeriodEnd: new Date(sub.current_period_end * 1000),
                },
              });
            };
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as import("stripe").Stripe.Invoice;
        if (invoice.subscription) {
          const stripe = getStripe();
          const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
          const beneficiaryId = sub.metadata?.beneficiaryId;
          if (beneficiaryId) {
            applyUpdate = async (tx) => {
              await tx.beneficiary.update({
                where: { id: beneficiaryId },
                data: { subscriptionStatus: "PAST_DUE" },
              });
            };
          }
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
