import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const route = fs.readFileSync(path.join(process.cwd(), "src/routes/billing.ts"), "utf8");

test("checkout reserves one durable beneficiary-scoped attempt and reuses its Stripe idempotency key", () => {
  const start = route.indexOf('router.post("/:id/checkout"');
  const end = route.indexOf('// ── POST /api/billing/organizations/:id/portal', start);
  const checkout = route.slice(start, end);
  assert.match(checkout, /reserveCheckoutAttempt\(ben\.id, interval\)/);
  assert.match(route, /isolationLevel: "Serializable"/);
  assert.match(checkout, /checkoutAttempt\.checkoutUrl && checkoutAttempt\.stripeSessionId && checkoutAttempt\.expiresAt > now/);
  assert.match(checkout, /idempotencyKey: checkoutAttempt\.idempotencyKey/);
  assert.match(checkout, /stripeSessionId: session\.id/);
});

test("checkout never redirects to a Stripe session that has already closed or expired", () => {
  const start = route.indexOf('router.post("/:id/checkout"');
  const end = route.indexOf('// ── POST /api/billing/organizations/:id/portal', start);
  const checkout = route.slice(start, end);
  assert.match(checkout, /stripe\.checkout\.sessions\.retrieve\(checkoutAttempt\.stripeSessionId\)/);
  assert.match(checkout, /stripeSession\.status === "open"/);
});
