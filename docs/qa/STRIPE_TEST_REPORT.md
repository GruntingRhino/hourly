# Stripe Integration Audit — GoodHours
**Date:** 2026-06-29  
**Auditor:** Release Engineering  
**Scope:** Organization (Beneficiary) Stripe billing integration  
**Files reviewed:**
- `server/src/routes/billing.ts`
- `server/src/routes/stripeWebhooks.ts`
- `server/src/routes/schoolProcurement.ts`
- `client/src/pages/beneficiary/OrgBilling.tsx`
- `client/src/pages/school/SchoolBilling.tsx`
- `server/.env` and `server/.env.example`
- `server/prisma/schema.prisma` (Beneficiary model, lines 412–463)
- `server/src/lib/stripe.ts`
- `server/src/lib/billingConfig.ts`
- `server/src/index.ts` (route mounting, lines 84–110)

---

## 1. Architecture Compliance

### 1.1 Checkout Sessions created server-side only
**PASS**

`POST /api/billing/organizations/:id/checkout` creates the Stripe Checkout Session entirely in `billing.ts`. The client (`OrgBilling.tsx`) calls this endpoint and receives a `{ url }` response; it never constructs a Checkout Session URL itself.

### 1.2 Price IDs selected server-side (client cannot inject price)
**PASS**

The price ID is resolved in `billing.ts` from `BILLING_CONFIG.organization`, which reads `STRIPE_ORG_PRO_MONTHLY_PRICE_ID` and `STRIPE_ORG_PRO_ANNUAL_PRICE_ID` environment variables. The client submits only `{ interval: "monthly" | "annual" }`, validated with Zod. There is no mechanism by which the client can supply a price ID.

### 1.3 Pro access controlled by webhook state, not redirect URL
**PASS with caveat**

`planTier` is set to `"PRO"` only inside `stripeWebhooks.ts` handlers (`checkout.session.completed`, `customer.subscription.created/updated`). The success redirect URL (`/settings?tab=billing&checkout=success`) triggers a UI banner only. `OrgBilling.tsx` derives `isPro` from `summary.planTier`, which comes from the server-side database record — not the URL.

**Caveat:** There is a development override on line 145 of `OrgBilling.tsx`:
```ts
const isPro = import.meta.env.DEV || summary.planTier === "PRO";
```
This means every user running the dev build sees Pro-gated UI regardless of their actual subscription state. This is intentional for local development but must be verified that `import.meta.env.DEV` is `false` in all production builds (Vite sets this correctly by default on `npm run build`).

### 1.4 Webhook signatures validated with raw body
**PASS**

`server/src/index.ts` mounts the webhook route before the generic `express.json()` middleware:
```ts
// Stripe webhook needs raw body for signature verification
app.use("/api/webhooks/stripe", express.raw({ type: "application/json" }), stripeWebhookRoutes);
app.use(express.json({ limit: "10mb" }));
```
`stripeWebhooks.ts` calls `stripe.webhooks.constructEvent(req.body as Buffer, sig, WEBHOOK_SECRET)`, which correctly uses the raw Buffer.

### 1.5 Stripe customer IDs stored in DB
**PASS**

`Beneficiary.stripeCustomerId` (nullable `String?`, schema line 448) is written in the checkout route when a new customer is created, and the `stripeCustomerId` is persisted to the database immediately before the Checkout Session is created.

### 1.6 Stripe subscription IDs stored in DB
**PASS**

`Beneficiary.stripeSubscriptionId` (nullable `String?`, schema line 449) is written in both `checkout.session.completed` and `customer.subscription.created/updated` handlers. It is set to `null` on `customer.subscription.deleted`.

### 1.7 Subscription status stored and synchronized
**PASS**

`Beneficiary.subscriptionStatus` is updated by five distinct webhook handlers:
- `checkout.session.completed` → `ACTIVE`
- `customer.subscription.created/updated` → mapped from Stripe status enum
- `customer.subscription.deleted` → `CANCELLED`
- `invoice.paid` → `ACTIVE`
- `invoice.payment_failed` → `PAST_DUE`

`currentPeriodEnd` and `cancelAtPeriodEnd` are also kept in sync on each relevant event.

### 1.8 Processed event IDs stored (idempotency)
**FAIL**

There is no `StripeEvent` or equivalent model in the schema. Processed Stripe event IDs are never persisted. The code comment in `stripeWebhooks.ts` states "Idempotency: all handlers are safe to replay," but this relies on database upsert behavior rather than true event-ID deduplication. A replayed or duplicated event — for example, `checkout.session.completed` fired twice — will call `prisma.beneficiary.update` twice, which is safe only because the updates are idempotent writes of the same values. However, a `customer.subscription.deleted` event replayed after a new subscription was created would clear the new subscription's data. **This is a production risk if Stripe retries accumulate on a transient 500.**

### 1.9 Billing portal created server-side
**PASS**

`POST /api/billing/organizations/:id/portal` creates the Stripe Billing Portal Session in `billing.ts`, guarded by `requireBeneficiaryAdmin`. The client receives only a `{ url }` redirect.

---

## 2. Webhook Event Coverage

The following events are registered in `stripeWebhooks.ts`:

| Event | Action |
|---|---|
| `checkout.session.completed` | Retrieves subscription, sets `planTier=PRO`, `subscriptionStatus=ACTIVE`, stores `stripeSubscriptionId`, `stripePriceId`, `billingInterval`, `currentPeriodEnd`, `cancelAtPeriodEnd`, sets `proActivatedAt` |
| `customer.subscription.created` | Maps Stripe status to internal enum, updates `planTier`, `subscriptionStatus`, `stripeSubscriptionId`, `stripePriceId`, `billingInterval`, `currentPeriodEnd`, `cancelAtPeriodEnd` |
| `customer.subscription.updated` | Same as above — handles cancellation-at-period-end, plan changes, reactivation |
| `customer.subscription.deleted` | Sets `planTier=FREE`, `subscriptionStatus=CANCELLED`, clears subscription and price IDs, `currentPeriodEnd`, resets `cancelAtPeriodEnd` |
| `invoice.paid` | Sets `subscriptionStatus=ACTIVE`, updates `currentPeriodEnd` (handles renewal) |
| `invoice.payment_failed` | Sets `subscriptionStatus=PAST_DUE` |
| All others | Acknowledged with HTTP 200 (no action, prevents Stripe retry) |

**Gaps in event coverage:**
- `customer.subscription.trial_will_end` — no handler; users on trials will not receive any in-app warning (may be acceptable if no trial mode is offered)
- `invoice.upcoming` — not handled (acceptable; informational only)
- `payment_intent.payment_failed` — not explicitly handled; covered indirectly through `invoice.payment_failed`
- `customer.updated` / `customer.deleted` — no handler; if a customer is deleted in Stripe Dashboard, the DB will retain a stale `stripeCustomerId`

---

## 3. Environment Variable Audit

### Variables consumed by Stripe integration

| Variable | Location | Current value in `.env` | Value in `.env.example` | Mode |
|---|---|---|---|---|
| `STRIPE_SECRET_KEY` | `server/src/lib/stripe.ts` | **NOT SET** | Not present | — |
| `STRIPE_WEBHOOK_SECRET` | `server/src/routes/stripeWebhooks.ts` | **NOT SET** | Not present | — |
| `STRIPE_ORG_PRO_MONTHLY_PRICE_ID` | `server/src/lib/billingConfig.ts` | **NOT SET** | Not present | — |
| `STRIPE_ORG_PRO_ANNUAL_PRICE_ID` | `server/src/lib/billingConfig.ts` | **NOT SET** | Not present | — |

**Critical finding:** All four Stripe environment variables are completely absent from both `server/.env` and `server/.env.example`. The `.env.example` was never updated to include Stripe configuration. The Stripe integration code is fully implemented but entirely unconfigured for any environment.

### Behavior when variables are missing

- `STRIPE_SECRET_KEY` absent: `getStripe()` throws `"STRIPE_SECRET_KEY environment variable is not set"` at first Stripe call. Any checkout or portal request returns HTTP 500.
- `STRIPE_WEBHOOK_SECRET` absent: webhook handler returns HTTP 400 `"Missing Stripe signature or webhook secret"` for every incoming webhook.
- `STRIPE_ORG_PRO_MONTHLY_PRICE_ID` / `STRIPE_ORG_PRO_ANNUAL_PRICE_ID` absent: `priceId` evaluates to `""` (empty string); the checkout route returns HTTP 503 `"Billing not configured"`.

### Mode consistency
Cannot be assessed — no keys are present. There are no live-mode vs. test-mode keys to compare.

---

## 4. Current Integration Status

**Stripe is not configured for use in any environment.**

- No Stripe keys are present in `.env` or `.env.example`.
- The integration code is complete and architecturally correct, but dead — no checkout can be initiated, no webhooks can be verified, no billing portal can be opened.
- The school billing path (`schoolProcurement.ts`, `SchoolBilling.tsx`) does not use Stripe at all. It is a manual quote-and-invoice procurement workflow with no Stripe dependency. This is intentional and complete.
- The `OrganizationInvoiceRequest` model provides a non-Stripe manual billing fallback for organizations that need formal procurement, which is also fully functional without Stripe.

---

## 5. Missing Test Cases

The following scenarios cannot be automated or reliably tested without real Stripe test-mode credentials (`sk_test_*`, a configured webhook endpoint with `STRIPE_WEBHOOK_SECRET`, and at least two Price objects):

| Scenario | Blocker |
|---|---|
| Successful monthly subscription checkout | No `STRIPE_SECRET_KEY` or price IDs |
| Successful annual subscription checkout | No `STRIPE_SECRET_KEY` or price IDs |
| `checkout.session.completed` webhook fires and upgrades org to Pro | No webhook secret; no way to sign test events |
| Declined card during checkout | Requires Stripe-hosted checkout with test card `4000000000000002` |
| Subscription cancellation (cancel-at-period-end) | Requires active subscription in test mode |
| Subscription reactivation before period end | Requires canceled subscription in test mode |
| Renewal payment (`invoice.paid`) updates `currentPeriodEnd` | Requires clock advancement in Stripe test mode |
| Payment failure → `PAST_DUE` state | Requires `invoice.payment_failed` event from test environment |
| Billing portal loads and allows plan management | Requires `stripeCustomerId` from a real checkout session |
| `customer.subscription.deleted` clears Pro access | Requires active subscription + deletion event |
| Duplicate webhook delivery (idempotency validation) | Would expose the missing event-ID deduplication gap |

---

## 6. Production Activation Checklist

Steps required to go from current state to live Stripe billing:

1. **Create Stripe account** (or use existing) and retrieve secret key from Stripe Dashboard.
2. **Create two Price objects** in Stripe:
   - Recurring monthly price at $30/month
   - Recurring annual price at $300/year
   - Note both `price_xxx` IDs.
3. **Add Stripe variables to `server/.env.example`** so all developers know the required configuration:
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_ORG_PRO_MONTHLY_PRICE_ID=price_...
   STRIPE_ORG_PRO_ANNUAL_PRICE_ID=price_...
   ```
4. **Configure local webhook forwarding** using Stripe CLI (`stripe listen --forward-to localhost:3001/api/webhooks/stripe`) to obtain a local `STRIPE_WEBHOOK_SECRET` for development.
5. **Add all four variables to `.env`** (local) and to the production secrets manager / hosting environment variables (production).
6. **Configure the Stripe Billing Portal** in the Stripe Dashboard (required before `billingPortal.sessions.create` will succeed — an unconfigured portal returns a Stripe API error).
7. **Register the production webhook endpoint** in Stripe Dashboard pointing to `https://<production-domain>/api/webhooks/stripe`, subscribe to at minimum: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.
8. **Implement event-ID idempotency** (see Critical Gaps below) before enabling production traffic.
9. **Run the full test scenario matrix** (Section 5) in Stripe test mode before switching to live keys.
10. **Verify `import.meta.env.DEV` is `false`** in the production client build to eliminate the `OrgBilling.tsx` dev override.

---

## 7. Critical Gaps

### GAP-1: No event-ID deduplication (HIGH severity)

**File:** `server/src/routes/stripeWebhooks.ts`

Stripe guarantees at-least-once delivery and may replay events. The current implementation has no `StripeEvent` table or equivalent to record processed event IDs. The code comment claims handlers are "safe to replay," which holds for most cases but **fails for `customer.subscription.deleted`**: if this event is replayed after a user has subscribed again, it will clear the new subscription's `stripeSubscriptionId`, `stripePriceId`, and downgrade `planTier` to `"FREE"`.

**Recommended fix:** Add a `StripeProcessedEvent` model with `eventId String @unique` and check-then-insert at the top of the webhook handler before dispatching to any case.

### GAP-2: All four Stripe env vars absent from `.env.example` (MEDIUM severity)

**File:** `server/.env.example`

New developers and CI environments have no documentation of required Stripe configuration. This is guaranteed to produce silent failures (HTTP 503 from the billing endpoint) whenever the server is run without Stripe configured.

**Recommended fix:** Add all four variables with placeholder values and comments to `.env.example`.

### GAP-3: Stripe Billing Portal requires manual Dashboard configuration (LOW-MEDIUM severity)

**File:** `server/src/routes/billing.ts` (line 134)

`stripe.billingPortal.sessions.create` will throw a Stripe API error if the Billing Portal has not been configured in the Stripe Dashboard. This step is not documented anywhere in the codebase and will cause a silent 500 on the first portal request in a new environment.

**Recommended fix:** Document this prerequisite in `.env.example` and the production activation runbook.

### GAP-4: `subscriptionStatus` default value inconsistency (LOW severity)

**File:** `server/prisma/schema.prisma` (line 451)

`Beneficiary.subscriptionStatus` defaults to `"FREE"`, but the UI status label map in `OrgBilling.tsx` has no entry for `"FREE"` — it only maps `FREE` as a `planTier` value, not a `subscriptionStatus`. An org that has never subscribed will show `subscriptionStatus = "FREE"` which falls through to `{ label: "FREE", color: "text-[var(--text-sec)]" }` (the raw string). This is cosmetically inelegant but not a functional bug.

**Recommended fix:** Either default `subscriptionStatus` to `"NONE"` and add a `NONE` entry to the status map, or add `"FREE"` to the status map with label `"Free"`.

### GAP-5: School billing has no Stripe integration (informational, not a gap)

`schoolProcurement.ts` is a purely manual quote-and-invoice workflow. This is intentional — schools procure via institutional purchase orders, not consumer credit cards. No Stripe gap exists here. The absence of Stripe in the school flow is correct by design.

---

## Summary

The Stripe integration is **architecturally sound but entirely unconfigured**. All security-critical requirements (server-side session creation, server-side price selection, webhook signature validation with raw body, portal creation server-side) are correctly implemented. The primary blocking issue for production is the complete absence of Stripe environment variables from both `.env` and `.env.example`. The one genuine architecture defect — missing event-ID idempotency — should be addressed before enabling production traffic.
