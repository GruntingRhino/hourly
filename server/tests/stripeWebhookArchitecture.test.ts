import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const serverRoot = path.resolve(__dirname, "..");
const webhookRoute = fs.readFileSync(path.join(serverRoot, "src/routes/stripeWebhooks.ts"), "utf8");
const billingRoute = fs.readFileSync(path.join(serverRoot, "src/routes/billing.ts"), "utf8");

test("all entitlement-changing Stripe lifecycle events are handled", () => {
  for (const eventType of [
    "checkout.session.completed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.paid",
    "invoice.payment_failed",
  ]) {
    assert.match(webhookRoute, new RegExp(`case \\"${eventType.replaceAll(".", "\\.")}\\"`));
  }
});

test("missing metadata falls back to server-owned subscription/customer associations instead of being acknowledged silently", () => {
  assert.match(webhookRoute, /stripeSubscriptionId: subscriptionId/);
  assert.match(webhookRoute, /stripeCustomerId: customerId/);
  assert.match(webhookRoute, /matches\.length !== 1/);
  assert.doesNotMatch(webhookRoute, /if \(!beneficiaryId\) break/);
});

test("webhook projection and receipt commit atomically and reject stale subscription lifecycles", () => {
  assert.match(webhookRoute, /shouldApplySubscriptionEvent/);
  assert.match(webhookRoute, /assertApprovedProSubscription/);
  assert.match(webhookRoute, /stripeMonthlyPriceId/);
  assert.match(webhookRoute, /stripeAnnualPriceId/);
  assert.match(webhookRoute, /processStripeEventAtomically\(prisma, event\.id, applyUpdate\)/);
});

test("subscription lifecycle events retrieve authoritative Stripe state before projecting a period end", () => {
  const lifecycleStart = webhookRoute.indexOf('case "customer.subscription.created"');
  const lifecycleEnd = webhookRoute.indexOf('case "customer.subscription.deleted"', lifecycleStart);
  const lifecycle = webhookRoute.slice(lifecycleStart, lifecycleEnd);
  assert.match(lifecycle, /stripe\.subscriptions\.retrieve\(eventSubscription\.id\)/);
  assert.match(lifecycle, /new Date\(sub\.current_period_end \* 1000\)/);
});

test("checkout customer and session creation use server-selected prices and idempotency keys", () => {
  assert.match(billingRoute, /const priceId = interval === "annual" \? config\.stripeAnnualPriceId : config\.stripeMonthlyPriceId/);
  assert.match(billingRoute, /line_items: \[\{ price: priceId, quantity: 1 \}\]/);
  assert.match(billingRoute, /goodhours_customer_/);
  assert.match(billingRoute, /goodhours_checkout_/);
});
