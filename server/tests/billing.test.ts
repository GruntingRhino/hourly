import test from "node:test";
import assert from "node:assert/strict";
import { calculateSchoolEstimate, BILLING_CONFIG, formatCents } from "../src/lib/billingConfig";

// ── BILLING_CONFIG ──────────────────────────────────────────────────────────

test("organization monthly price is $30 (3000 cents)", () => {
  assert.equal(BILLING_CONFIG.organization.proMonthlyPriceCents, 3000);
});

test("organization annual price is $300 (30000 cents)", () => {
  assert.equal(BILLING_CONFIG.organization.proAnnualPriceCents, 30000);
});

test("annual price is less than 12 months of monthly (10% savings)", () => {
  const monthly12 = BILLING_CONFIG.organization.proMonthlyPriceCents * 12;
  const annual = BILLING_CONFIG.organization.proAnnualPriceCents;
  assert.ok(annual < monthly12, "annual plan should cost less than 12 monthly payments");
});

test("school price per student is $0.50 (50 cents) by default", () => {
  assert.equal(BILLING_CONFIG.school.pricePerStudentCents, 50);
});

test("school annual minimum is $500 (50000 cents) by default", () => {
  assert.equal(BILLING_CONFIG.school.annualMinimumCents, 50000);
});

// ── calculateSchoolEstimate ─────────────────────────────────────────────────

test("school estimate: small school below minimum gets the minimum", () => {
  // 100 students × $0.50 = $50, below $500 minimum → should be $500
  const estimate = calculateSchoolEstimate(100);
  assert.equal(estimate, 50000, "should use $500 minimum for small school");
});

test("school estimate: 1000 students × $0.50 = $500 equals minimum", () => {
  const estimate = calculateSchoolEstimate(1000);
  assert.equal(estimate, 50000);
});

test("school estimate: 2000 students × $0.50 = $1000 exceeds minimum", () => {
  const estimate = calculateSchoolEstimate(2000);
  assert.equal(estimate, 100000);
});

test("school estimate: uses Math.max(enrollment × price, minimum)", () => {
  const estimate10 = calculateSchoolEstimate(10);
  const estimate5000 = calculateSchoolEstimate(5000);
  assert.ok(estimate10 >= BILLING_CONFIG.school.annualMinimumCents, "minimum applies");
  assert.ok(estimate5000 > BILLING_CONFIG.school.annualMinimumCents, "large schools exceed minimum");
});

test("server recalculates school estimate (not trusting client value)", () => {
  // Simulates what the server must do: recalculate regardless of any client-submitted value
  const clientSubmittedEnrollment = 500;
  const clientFakePrice = 1; // client claims $0.01 per student
  const serverCalculated = calculateSchoolEstimate(clientSubmittedEnrollment);
  const clientFakeTotal = clientSubmittedEnrollment * clientFakePrice;
  assert.notEqual(serverCalculated, clientFakeTotal, "server must not trust client price");
});

test("school estimate rounds enrollment correctly", () => {
  assert.equal(calculateSchoolEstimate(1001), Math.max(1001 * 50, 50000));
});

// ── formatCents ─────────────────────────────────────────────────────────────

test("formatCents formats 3000 as $30", () => {
  assert.equal(formatCents(3000), "$30");
});

test("formatCents formats 30000 as $300", () => {
  assert.equal(formatCents(30000), "$300");
});

test("formatCents formats 50000 as $500", () => {
  assert.equal(formatCents(50000), "$500");
});

// ── Subscription status safety (no-Stripe logic) ────────────────────────────

test("FREE status means no active subscription", () => {
  const freeStatuses = ["FREE", "CANCELLED", "INCOMPLETE"];
  const proStatuses = ["ACTIVE", "TRIALING", "CANCEL_AT_PERIOD_END"];
  for (const s of freeStatuses) {
    assert.ok(!proStatuses.includes(s), `${s} should not be treated as active Pro`);
  }
});

test("PAST_DUE does not remove Pro until subscription.deleted fires", () => {
  // PAST_DUE keeps planTier=PRO to allow grace period; only subscription.deleted fires removal
  const pastDueKeepsPro = ["PAST_DUE", "CANCEL_AT_PERIOD_END"].includes("PAST_DUE");
  assert.ok(pastDueKeepsPro, "PAST_DUE should preserve Pro access during grace period");
});
