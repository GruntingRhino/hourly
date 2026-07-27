import test from "node:test";
import assert from "node:assert/strict";
import {
  getInvoiceEntitlementPeriodEnd,
  shouldExpireInvoiceEntitlement,
} from "../src/lib/invoiceEntitlementPolicy";

test("paid monthly and annual invoices receive explicit entitlement deadlines", () => {
  const activatedAt = new Date("2026-01-31T12:00:00.000Z");
  assert.equal(getInvoiceEntitlementPeriodEnd(activatedAt, "monthly").toISOString(), "2026-02-28T12:00:00.000Z");
  assert.equal(getInvoiceEntitlementPeriodEnd(activatedAt, "annual").toISOString(), "2027-01-31T12:00:00.000Z");
});

test("only expired non-Stripe invoice entitlement is eligible for downgrade", () => {
  const now = new Date("2026-08-01T00:00:00.000Z");
  const expiredAt = new Date("2026-07-31T23:59:59.000Z");
  assert.equal(shouldExpireInvoiceEntitlement({ subscriptionStatus: "INVOICE_ACTIVE", currentPeriodEnd: expiredAt, stripeSubscriptionId: null, hasSchoolComplimentaryPro: false }, now), true);
  assert.equal(shouldExpireInvoiceEntitlement({ subscriptionStatus: "INVOICE_ACTIVE", currentPeriodEnd: expiredAt, stripeSubscriptionId: "sub_paid", hasSchoolComplimentaryPro: false }, now), false);
  assert.equal(shouldExpireInvoiceEntitlement({ subscriptionStatus: "INVOICE_ACTIVE", currentPeriodEnd: expiredAt, stripeSubscriptionId: null, hasSchoolComplimentaryPro: true }, now), false);
  assert.equal(shouldExpireInvoiceEntitlement({ subscriptionStatus: "ACTIVE", currentPeriodEnd: expiredAt, stripeSubscriptionId: null, hasSchoolComplimentaryPro: false }, now), false);
});
