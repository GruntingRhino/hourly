import test from "node:test";
import assert from "node:assert/strict";
import {
  hasExactApprovedProPrice,
  projectSubscriptionEntitlement,
  shouldApplySubscriptionEvent,
} from "../src/lib/stripeSubscriptionPolicy";

test("only one quantity-one approved Pro price is accepted", () => {
  const approved = new Set(["price_monthly", "price_annual"]);
  assert.equal(hasExactApprovedProPrice([{ priceId: "price_monthly", quantity: 1 }], approved), true);
  assert.equal(hasExactApprovedProPrice([{ priceId: "price_monthly", quantity: 2 }], approved), false);
  assert.equal(hasExactApprovedProPrice([
    { priceId: "price_monthly", quantity: 1 },
    { priceId: "price_unapproved", quantity: 1 },
  ], approved), false);
  assert.equal(hasExactApprovedProPrice([{ priceId: "price_unapproved", quantity: 1 }], approved), false);
});

test("an active subscription grants Pro access", () => {
  assert.deepEqual(
    projectSubscriptionEntitlement({ event: "updated", stripeStatus: "active", cancelAtPeriodEnd: false }),
    { planTier: "PRO", subscriptionStatus: "ACTIVE" },
  );
});

test("a past-due subscription update preserves Pro access", () => {
  assert.deepEqual(
    projectSubscriptionEntitlement({ event: "updated", stripeStatus: "past_due", cancelAtPeriodEnd: false }),
    { planTier: "PRO", subscriptionStatus: "PAST_DUE" },
  );
});

test("cancellation at period end preserves Pro access through the paid period", () => {
  assert.deepEqual(
    projectSubscriptionEntitlement({ event: "updated", stripeStatus: "active", cancelAtPeriodEnd: true }),
    { planTier: "PRO", subscriptionStatus: "CANCEL_AT_PERIOD_END" },
  );
});

test("a canceled subscription update retains Pro until the deletion event", () => {
  assert.deepEqual(
    projectSubscriptionEntitlement({
      event: "updated",
      stripeStatus: "canceled",
      cancelAtPeriodEnd: false,
      currentPlanTier: "PRO",
    }),
    { planTier: "PRO", subscriptionStatus: "CANCELLED" },
  );
});

test("subscription deletion removes paid Pro access after the past-due grace period", () => {
  assert.deepEqual(
    projectSubscriptionEntitlement({ event: "deleted" }),
    { planTier: "FREE", subscriptionStatus: "CANCELLED" },
  );
});

test("subscription deletion cannot remove permanent school Pro", () => {
  assert.deepEqual(
    projectSubscriptionEntitlement({ event: "deleted", permanentPro: true }),
    { planTier: "PRO", subscriptionStatus: "CANCELLED" },
  );
});

test("checkout completion grants Pro using the retrieved subscription state", () => {
  assert.deepEqual(
    projectSubscriptionEntitlement({ event: "checkout_completed", stripeStatus: "active", cancelAtPeriodEnd: false }),
    { planTier: "PRO", subscriptionStatus: "ACTIVE" },
  );
});

test("an incomplete subscription does not grant paid Pro", () => {
  assert.deepEqual(
    projectSubscriptionEntitlement({ event: "updated", stripeStatus: "incomplete", cancelAtPeriodEnd: false }),
    { planTier: "FREE", subscriptionStatus: "INCOMPLETE" },
  );
});

test("non-deletion lifecycle events cannot revoke existing paid Pro", () => {
  for (const event of ["created", "updated", "checkout_completed"] as const) {
    assert.deepEqual(
      projectSubscriptionEntitlement({
        event,
        stripeStatus: "incomplete",
        cancelAtPeriodEnd: false,
        currentPlanTier: "PRO",
      }),
      { planTier: "PRO", subscriptionStatus: "INCOMPLETE" },
    );
  }
});

test("canceled updates and delayed canceled checkout events cannot grant new Pro", () => {
  assert.deepEqual(
    projectSubscriptionEntitlement({
      event: "updated",
      stripeStatus: "canceled",
      cancelAtPeriodEnd: false,
      currentPlanTier: "FREE",
    }),
    { planTier: "FREE", subscriptionStatus: "CANCELLED" },
  );
  assert.deepEqual(
    projectSubscriptionEntitlement({
      event: "checkout_completed",
      stripeStatus: "canceled",
      cancelAtPeriodEnd: false,
      currentPlanTier: "FREE",
    }),
    { planTier: "FREE", subscriptionStatus: "CANCELLED" },
  );
});

test("delayed events cannot overwrite a completed or replacement subscription lifecycle", () => {
  assert.equal(shouldApplySubscriptionEvent({
    event: "updated",
    incomingSubscriptionId: "sub_old",
    currentSubscriptionId: null,
    currentSubscriptionStatus: "CANCELLED",
  }), false);
  assert.equal(shouldApplySubscriptionEvent({
    event: "deleted",
    incomingSubscriptionId: "sub_old",
    currentSubscriptionId: "sub_new",
    currentSubscriptionStatus: "ACTIVE",
  }), false);
  assert.equal(shouldApplySubscriptionEvent({
    event: "checkout_completed",
    incomingSubscriptionId: "sub_new",
    currentSubscriptionId: null,
    currentSubscriptionStatus: "CANCELLED",
  }), false);
  assert.equal(shouldApplySubscriptionEvent({
    event: "checkout_completed",
    incomingSubscriptionId: "sub_new",
    currentSubscriptionId: null,
    currentSubscriptionStatus: "CANCELLED",
    incomingEventCreatedAt: new Date("2026-07-26T20:30:01Z"),
    currentEventCreatedAt: new Date("2026-07-26T20:30:00Z"),
  }), true);
  assert.equal(shouldApplySubscriptionEvent({
    event: "checkout_completed",
    incomingSubscriptionId: "sub_old",
    currentSubscriptionId: "sub_new",
    currentSubscriptionStatus: "ACTIVE",
  }), false);
});

test("Stripe occurrence time permits a newer replacement but rejects delayed old lifecycle events", () => {
  const older = new Date("2026-07-01T00:00:00.000Z");
  const newer = new Date("2026-07-02T00:00:00.000Z");
  assert.equal(shouldApplySubscriptionEvent({
    event: "created",
    incomingSubscriptionId: "sub_new",
    incomingEventCreatedAt: newer,
    currentSubscriptionId: "sub_old",
    currentSubscriptionStatus: "ACTIVE",
    currentEventCreatedAt: older,
  }), true);
  assert.equal(shouldApplySubscriptionEvent({
    event: "deleted",
    incomingSubscriptionId: "sub_old",
    incomingEventCreatedAt: older,
    currentSubscriptionId: "sub_new",
    currentSubscriptionStatus: "ACTIVE",
    currentEventCreatedAt: newer,
  }), false);
  assert.equal(shouldApplySubscriptionEvent({
    event: "checkout_completed",
    incomingSubscriptionId: "sub_old",
    incomingEventCreatedAt: older,
    currentSubscriptionId: null,
    currentSubscriptionStatus: "CANCELLED",
    currentEventCreatedAt: newer,
  }), false);
});
