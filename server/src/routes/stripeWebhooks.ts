import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { getStripe } from "../lib/stripe";

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

  // Idempotency: all handlers are safe to replay
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as import("stripe").Stripe.Checkout.Session;
        const beneficiaryId = session.metadata?.beneficiaryId;
        if (beneficiaryId && session.subscription) {
          const stripe = getStripe();
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          await prisma.beneficiary.update({
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
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as import("stripe").Stripe.Subscription;
        const beneficiaryId = sub.metadata?.beneficiaryId;
        if (!beneficiaryId) break;

        const statusMap: Record<string, string> = {
          active: "ACTIVE",
          trialing: "TRIALING",
          past_due: "PAST_DUE",
          canceled: "CANCELLED",
          unpaid: "PAST_DUE",
          incomplete: "INCOMPLETE",
          incomplete_expired: "CANCELLED",
          paused: "PAST_DUE",
        };
        const newStatus = statusMap[sub.status] ?? "ACTIVE";
        const isActive = ["ACTIVE", "TRIALING"].includes(newStatus);

        await prisma.beneficiary.update({
          where: { id: beneficiaryId },
          data: {
            planTier: isActive || sub.cancel_at_period_end ? "PRO" : "FREE",
            subscriptionStatus: sub.cancel_at_period_end ? "CANCEL_AT_PERIOD_END" : newStatus,
            stripeSubscriptionId: sub.id,
            stripePriceId: sub.items.data[0]?.price.id ?? null,
            billingInterval: sub.items.data[0]?.price.recurring?.interval === "year" ? "annual" : "monthly",
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
            cancelAtPeriodEnd: sub.cancel_at_period_end,
          },
        });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as import("stripe").Stripe.Subscription;
        const beneficiaryId = sub.metadata?.beneficiaryId;
        if (!beneficiaryId) break;

        await prisma.beneficiary.update({
          where: { id: beneficiaryId },
          data: {
            planTier: "FREE",
            subscriptionStatus: "CANCELLED",
            stripeSubscriptionId: null,
            stripePriceId: null,
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false,
          },
        });
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as import("stripe").Stripe.Invoice;
        if (invoice.subscription) {
          const stripe = getStripe();
          const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
          const beneficiaryId = sub.metadata?.beneficiaryId;
          if (beneficiaryId) {
            await prisma.beneficiary.update({
              where: { id: beneficiaryId },
              data: {
                subscriptionStatus: "ACTIVE",
                currentPeriodEnd: new Date(sub.current_period_end * 1000),
              },
            });
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
            await prisma.beneficiary.update({
              where: { id: beneficiaryId },
              data: { subscriptionStatus: "PAST_DUE" },
            });
          }
        }
        break;
      }

      default:
        // Unhandled event — acknowledge receipt so Stripe does not retry
        break;
    }
  } catch (err) {
    console.error("[stripeWebhook] handler error for", event.type, err);
    // Return 200 to prevent Stripe retries for handler bugs; log for investigation
  }

  res.json({ received: true });
});

export default router;
