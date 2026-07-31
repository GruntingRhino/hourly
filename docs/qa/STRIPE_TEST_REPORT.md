# Stripe Billing Lifecycle QA — GoodHours

**Status:** PASS — isolated Stripe test-mode billing lifecycle QA is complete for release commit `e09fddeea454dd51390fe374dcc5e1ad4d03b00e`.

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
| Exact same-event replay/idempotency | The same real test-mode `checkout.session.completed` event was signed and delivered twice more; both deliveries returned HTTP 200 with `received: true, skipped: true`, while the durable receipt count remained exactly one |

All session URLs, event IDs, customer IDs, subscription IDs, webhook secrets, and credentials were redacted and are not stored in this report.

## Final-artifact and environment-separation evidence — PASS

- The source tree used for the final signed replay and automated billing regression is release commit `e09fddeea454dd51390fe374dcc5e1ad4d03b00e`.
- That commit is pushed to `origin/main` and deployed as Vercel production deployment `dpl_9vEoDTw2PGWLpdew1ZDMDvDkscwF`, aliased to `https://goodhours.app`.
- The production deployment is `Ready`; its health endpoint reports application and database status `ok`; all 25 Prisma migrations are applied with none pending.
- The account owner confirmed that production uses live Stripe configuration and the canonical webhook endpoint. No live Checkout, charge, replay, cancellation, Test Clock, or customer mutation was performed during QA.
- Test credentials remained local and ignored. Billing lifecycle mutations were confined to Stripe Test mode and the isolated local QA database.

## Gate conclusion

Billing lifecycle QA: PASS

This PASS approves the isolated test-mode billing QA gate. It does not authorize uncontrolled live-provider lifecycle testing or production-customer mutations.
