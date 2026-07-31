# Stripe Billing Lifecycle QA — GoodHours

**Status:** BLOCKED — evidence is partial; this document is not a billing-release approval.

**Environment:** isolated local PostgreSQL database and local API on `127.0.0.1:3003`, using Stripe test-mode credentials and an ephemeral Stripe CLI webhook-forwarding secret. No production key, `goodhours.app` endpoint, production database, or live charge was used.

## Configuration preflight — PASS

- Test-mode secret-key validation succeeded without exposing values.
- Configured monthly and annual price IDs were confirmed active, recurring, and test-mode.
- The isolated database replayed all 25 Prisma migrations.
- Local health check returned `status: ok` and `db: ok`.
- Webhook route was mounted with raw JSON handling before generic JSON parsing (`server/src/index.ts`).

## Executed sandbox evidence — PASS

| Scenario | Result |
|---|---|
| Unauthenticated/unsigned webhook | Controlled HTTP 400 signature rejection |
| Signed Stripe CLI event delivery | Accepted through the local ephemeral forwarder |
| Hosted Stripe Checkout creation | Test-mode hosted Checkout Session created through the authenticated application endpoint |
| Hosted Checkout completion | Stripe reported test-mode session `complete` and `paid` |
| Checkout webhook entitlement projection | Processed-event receipt persisted; beneficiary reached `PRO` |
| Annual hosted Checkout completion | Stripe reported annual test-mode session `complete` and `paid`; beneficiary reached durable annual `PRO:ACTIVE` |
| Billing Portal | Authenticated application route created a Stripe test-mode hosted portal session |
| Subscription cancellation | Stripe test subscription confirmed canceled |
| Deletion projection | Signed webhook projected cancellation and revoked paid entitlement to `FREE` |
| Test Clock past-due lifecycle | Isolated Test Clock advanced three days; durable application state reached `PAST_DUE:PRO` |

All session URLs, event IDs, customer IDs, subscription IDs, webhook secrets, and credentials were redacted and are not stored in this report.

## Remaining release-blocking billing evidence

1. **Same-event replay/idempotency:** execute a duplicate delivery of the exact provider event and prove one durable receipt/projection outcome.
2. **Final clean artifact:** after the final code/config artifact is committed and deployed to a dedicated test alias, rerun the lifecycle matrix against that exact artifact.
3. **Production separation:** production uses live Stripe configuration and must receive a separate approved, non-charging wiring verification. Test credentials must never be deployed to `goodhours.app`.

## Gate conclusion

`Billing lifecycle QA: BLOCKED`

Do not change this to PASS until every remaining scenario above has fresh, redacted executable evidence tied to the final release artifact.
