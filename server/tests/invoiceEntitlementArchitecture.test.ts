import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const serverRoot = path.resolve(__dirname, "..");
const billingRoute = fs.readFileSync(path.join(serverRoot, "src/routes/billing.ts"), "utf8");
const reminders = fs.readFileSync(path.join(serverRoot, "src/lib/reminders.ts"), "utf8");

test("marking an invoice paid activates Pro with an explicit period end", () => {
  assert.match(billingRoute, /parse\.data\.status === "PAID"/);
  assert.match(billingRoute, /subscriptionStatus: "INVOICE_ACTIVE"/);
  assert.match(billingRoute, /getInvoiceEntitlementPeriodEnd/);
  assert.match(billingRoute, /already has a Stripe subscription/);
});

test("the runtime-managed reminder cron expires invoice entitlement", () => {
  assert.match(reminders, /expireInvoiceEntitlements\(prisma\)/);
});
