import test from "node:test";
import assert from "node:assert/strict";
import { shouldAutoPromoteWaitlist } from "../src/lib/waitlistPromotionPolicy";

const now = new Date("2026-08-01T12:00:00.000Z");
const base = {
  tier: "PRO" as const,
  disableAutoPromotion: false,
  requireApprovalForPromotion: false,
  waitlistCutoffHours: null,
  eventStartsAt: new Date("2026-08-03T12:00:00.000Z"),
  now,
};

test("Free organizations cannot activate persisted advanced waitlist controls", () => {
  assert.equal(shouldAutoPromoteWaitlist({
    ...base,
    tier: "FREE",
    disableAutoPromotion: true,
    requireApprovalForPromotion: true,
    waitlistCutoffHours: 72,
  }), true);
});

test("Pro can disable automatic promotion or require manual approval", () => {
  assert.equal(shouldAutoPromoteWaitlist({ ...base, disableAutoPromotion: true }), false);
  assert.equal(shouldAutoPromoteWaitlist({ ...base, requireApprovalForPromotion: true }), false);
});

test("Pro cutoff prevents last-minute automatic promotion", () => {
  assert.equal(shouldAutoPromoteWaitlist({ ...base, waitlistCutoffHours: 72 }), false);
  assert.equal(shouldAutoPromoteWaitlist({ ...base, waitlistCutoffHours: 24 }), true);
});
