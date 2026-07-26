import test from "node:test";
import assert from "node:assert/strict";
import { projectSubscriptionEntitlement } from "../src/lib/stripeSubscriptionPolicy";

test("a past-due subscription update preserves Pro access", () => {
  assert.deepEqual(
    projectSubscriptionEntitlement({ event: "updated", stripeStatus: "past_due", cancelAtPeriodEnd: false }),
    { planTier: "PRO", subscriptionStatus: "PAST_DUE" },
  );
});

test("subscription deletion removes Pro access after the past-due grace period", () => {
  assert.deepEqual(
    projectSubscriptionEntitlement({ event: "deleted" }),
    { planTier: "FREE", subscriptionStatus: "CANCELLED" },
  );
});
