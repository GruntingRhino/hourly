# GoodHours Production Launch Checklist

**Version:** 1.0  
**Last Updated:** 2026-06-29  
**Use:** Complete every item in order. Do not mark complete until verified in the production environment, not just locally.

---

## How to Use This Checklist

Each item includes:
- A checkbox for tracking completion
- An **Owner** label (Founder / DevOps / Engineering / Legal)
- A **Status** field to fill in: `DONE` / `BLOCKED` / `IN PROGRESS`

Do not launch until every item in sections 1–8 is marked `DONE`.

---

## Section 1: Infrastructure

- [ ] **HTTPS enforced** — TLS certificate issued and auto-renewing (Let's Encrypt or CDN-managed). All HTTP traffic redirects to HTTPS. `Owner: DevOps`
- [ ] **Custom domain configured** — Production domain (e.g., `app.goodhours.app`) resolves to the correct server/CDN. DNS propagation confirmed. `Owner: Founder`
- [ ] **Database server provisioned** — PostgreSQL instance running on a managed provider (Neon, Railway, Supabase, RDS, etc.). Connection string uses `sslmode=require`. `Owner: DevOps`
- [ ] **Database backups enabled** — Automated daily backups with at least 7-day retention. Point-in-time recovery available. Backup restore tested at least once. `Owner: DevOps`
- [ ] **Uptime monitoring** — External health check (e.g., Better Uptime, UptimeRobot) pinging `/api/health` every 60 seconds. Alert goes to founder's phone. `Owner: Founder`
- [ ] **Error tracking** — Sentry (or equivalent) configured for both server and client. Source maps uploaded. Alerts routed to engineering. `Owner: Engineering`
- [ ] **Log aggregation** — Server logs shipped to a searchable store (Papertrail, Logtail, Datadog, etc.). Log retention ≥ 30 days. `Owner: DevOps`
- [ ] **Deployment pipeline** — CI/CD pipeline runs `npx tsc --noEmit`, `npm audit`, and tests before any production deploy. No direct pushes to production without a passing pipeline. `Owner: Engineering`
- [ ] **File uploads storage** — `uploads/` directory is NOT served from the application server in production. Uploads are stored in object storage (S3, Cloudflare R2, etc.) with appropriate ACLs. `Owner: Engineering`
- [ ] **CDN configured** — Static client assets served via CDN with appropriate cache headers. `Owner: DevOps`

---

## Section 2: Environment Variables

All of the following must be set in the production environment. Do not use any placeholder values.

### Required (Blocking Launch)

- [ ] `DATABASE_URL` — PostgreSQL connection string with `sslmode=require`. `Owner: DevOps`
- [ ] `JWT_SECRET` — Generated with `openssl rand -hex 64`. Never reuse the dev value. `Owner: DevOps`
- [ ] `FIELD_ENCRYPTION_KEY` — Generated with `openssl rand -hex 32`. Store in secrets manager, not in `.env` on disk. `Owner: DevOps`
- [ ] `APP_URL` — Set to the production API origin (e.g., `https://api.goodhours.app`). Used for CORS. `Owner: Engineering`
- [ ] `CLIENT_URL` — Set to the production frontend URL (e.g., `https://app.goodhours.app`). Used in email links. `Owner: Engineering`
- [ ] `RESEND_API_KEY` — Real production Resend API key (not the placeholder `re_your_resend_api_key_here`). `Owner: Founder`
- [ ] `EMAIL_FROM` — A verified sender address on the Resend-approved sending domain (e.g., `noreply@notifications.goodhours.app`). `Owner: Founder`
- [ ] `EMAIL_DELIVERY_MODE` — Set to `send` in production. `Owner: Engineering`
- [ ] `CRON_SECRET` — Generated with `openssl rand -hex 32`. Protects internal scheduled job endpoints. `Owner: DevOps`
- [ ] `APP_ENV` — Set to `production`. `Owner: Engineering`

### Required When Stripe Is Activated

- [ ] `STRIPE_SECRET_KEY` — Live mode key (`sk_live_...`). Store in secrets manager. `Owner: Founder`
- [ ] `STRIPE_PUBLISHABLE_KEY` — Live mode publishable key (`pk_live_...`). `Owner: Founder`
- [ ] `STRIPE_WEBHOOK_SECRET` — Webhook signing secret from the Stripe dashboard (`whsec_...`). `Owner: Engineering`
- [ ] All `STRIPE_PRICE_ID_*` variables — Live mode price IDs created in the Stripe dashboard. `Owner: Founder`

### Required When LMS Integrations Are Enabled

- [ ] `CANVAS_CLIENT_ID` + `CANVAS_CLIENT_SECRET` — Production Canvas OAuth credentials. Set `CANVAS_ENABLE_MOCK=false`. `Owner: Engineering`
- [ ] `GOOGLE_CLASSROOM_CLIENT_ID` + `GOOGLE_CLASSROOM_CLIENT_SECRET` — Production GCP credentials. Set `GOOGLE_CLASSROOM_ENABLE_MOCK=false`. `Owner: Engineering`
- [ ] `CANVAS_CALLBACK_URL` + `GOOGLE_CLASSROOM_CALLBACK_URL` — Updated to production domain. `Owner: Engineering`

### Security Flags (Must be Set Correctly)

- [ ] `ALLOW_PERSONAL_EMAIL_DOMAINS` — Set to `false` or omit entirely. `Owner: Engineering`
- [ ] `ALLOW_QA_SIGNUP_BYPASS` — Set to `false` or omit entirely. `Owner: Engineering`
- [ ] `ALLOW_SHARED_DEV_DATABASE` — Set to `false`. `Owner: Engineering`
- [ ] `APPROVED_SCHOOL_DOMAINS` — Set to the comma-separated list of approved school email domains for the pilot. `Owner: Founder`

---

## Section 3: Security Hardening

- [ ] **CORS restricted** — `ALLOWED_ORIGINS` set to only the production frontend origin. No wildcard `*`. `Owner: Engineering`
- [ ] **Rate limiting active** — Login endpoint rate-limited to prevent brute force. Signup rate-limited to prevent account spam. `Owner: Engineering`
- [ ] **Security headers** — HTTP response headers include: `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Content-Security-Policy`. Verify with [securityheaders.com](https://securityheaders.com). `Owner: Engineering`
- [ ] **Dev/debug endpoints disabled** — Any route prefixed `/dev`, `/debug`, `/seed`, or equivalent is disabled or removed in `APP_ENV=production`. `Owner: Engineering`
- [ ] **Prisma Studio not running** — Prisma Studio is not accessible on any public port in production. `Owner: DevOps`
- [ ] **Secrets not in codebase** — Confirm no `.env` files with real credentials are committed. Run `git log --all --full-history -- "*.env"`. `Owner: Engineering`
- [ ] **JWT expiry configured** — JWT tokens have a reasonable expiry (e.g., 7 days). No tokens with `expiresIn: 0` or very long durations. `Owner: Engineering`
- [ ] **Input validation active** — All Zod schemas are enforced on server-side route handlers. No route accepts arbitrary unvalidated input. `Owner: Engineering`
- [ ] **SQL injection protection** — All database access goes through Prisma ORM with parameterized queries. No raw SQL constructed from user input. `Owner: Engineering`
- [ ] **File upload restrictions** — Accepted MIME types and file size limits enforced server-side (not just client-side). `Owner: Engineering`
- [ ] **Dependency audit clean** — `npm audit --audit-level=high` returns no unpatched high or critical issues in either `server/` or `client/`. `Owner: Engineering`

---

## Section 4: Email Configuration

- [ ] **Resend account active** — Account verified, billing configured, sending domain added. `Owner: Founder`
- [ ] **Sending domain verified** — DNS records (SPF, DKIM, DMARC) set for the notification sending domain. Use Resend's verification dashboard to confirm. `Owner: Founder / DevOps`
- [ ] **Email templates reviewed** — All transactional email templates (verification, password reset, welcome, hour approved/rejected, notification digest) reviewed for correct production URLs and branding. `Owner: Founder`
- [ ] **Email links point to production** — `CLIENT_URL` is set to the production domain. No email links contain `localhost`. `Owner: Engineering`
- [ ] **Unsubscribe/opt-out** — Transactional emails include an unsubscribe mechanism as required by CAN-SPAM/CASL. `Owner: Legal / Founder`
- [ ] **Test delivery confirmed** — Send a test password reset email to a real inbox and confirm delivery, formatting, and link correctness. `Owner: Founder`

---

## Section 5: Stripe Activation

- [ ] **Live Stripe account approved** — Stripe account identity verification complete. Payouts enabled. `Owner: Founder`
- [ ] **Live mode keys in production environment** — Not test mode keys. `Owner: Founder`
- [ ] **Webhook endpoint registered** — Production webhook URL registered in the Stripe dashboard. All required event types subscribed (e.g., `checkout.session.completed`, `customer.subscription.*`, `invoice.*`). `Owner: Engineering`
- [ ] **Webhook signature verification active** — Server verifies `stripe-signature` header on every webhook event using `STRIPE_WEBHOOK_SECRET`. `Owner: Engineering`
- [ ] **Live price IDs correct** — All `STRIPE_PRICE_ID_*` values point to live mode prices, not test mode prices. `Owner: Founder`
- [ ] **End-to-end payment tested** — One supervised live payment made and confirmed to propagate correctly to the application. Charge immediately refunded. `Owner: Founder`
- [ ] **Refund/cancellation flow tested** — Subscription cancellation and refund tested in live mode (small amount). `Owner: Founder`

---

## Section 6: Database

- [ ] **Production migrations applied** — Run `npx prisma migrate deploy` (not `prisma db push`). Confirm all migrations applied cleanly. `Owner: Engineering`
- [ ] **`prisma db push` prohibited in production** — `db push` is for development only and can cause data loss. Only `migrate deploy` in production. `Owner: Engineering`
- [ ] **Schema matches production** — Run `npx prisma migrate status` and confirm no pending or failed migrations. `Owner: Engineering`
- [ ] **Connection pool configured** — Connection pool size appropriate for expected concurrency. Prisma Data Proxy or PgBouncer configured if using serverless. `Owner: DevOps`
- [ ] **Seed accounts removed or flagged** — Test accounts (`john@student.edu`, `jane@student.edu`, `alex@student.edu`, `volunteer@greenearth.org`, `staff@library.org`, `admin@lincoln.edu`) are either deleted or marked with `isTestAccount=true` and excluded from production statistics. `Owner: Engineering`
- [ ] **Database connection tested** — API health endpoint confirms database connectivity. `Owner: DevOps`

---

## Section 7: Frontend Build

- [ ] **Production build generated** — `cd client && npx vite build` completes without errors. `Owner: Engineering`
- [ ] **Environment variables set** — All `VITE_*` variables set in the deployment environment (not in committed files). `Owner: Engineering`
- [ ] **Dev tools disabled** — React DevTools overlay not visible in production build. No `console.log` statements in production output (or acceptable if sanitized). `Owner: Engineering`
- [ ] **Build artifact deployed** — The `dist/` output is served from CDN or static file server, not from the Vite dev server. `Owner: DevOps`
- [ ] **Source maps** — Source maps uploaded to Sentry for readable stack traces but NOT publicly accessible via the browser. `Owner: Engineering`
- [ ] **404 fallback configured** — Server/CDN serves `index.html` for all non-API routes (required for React Router). `Owner: DevOps`

---

## Section 8: Test Accounts

- [ ] **Seed accounts audited** — All seed accounts identified. Decision made: delete before launch OR mark `isTestAccount=true` in schema. `Owner: Engineering`
- [ ] **Seed accounts excluded from reports** — If retaining seed accounts, confirm they are excluded from school reports, org stats, and aggregate counts. `Owner: Engineering`
- [ ] **Seed script not runnable against production** — The seed script prompts for confirmation or checks `APP_ENV` to prevent accidental production data wipe. `Owner: Engineering`

---

## Section 9: Monitoring

- [ ] **Error tracking live** — Sentry receiving events. Test by deliberately triggering a server error and confirming it appears in Sentry. `Owner: Engineering`
- [ ] **Health endpoint verified** — `GET /api/health` returns 200 with `{ "status": "ok" }` in production. `Owner: Engineering`
- [ ] **Uptime alert tested** — Temporarily stop the server and confirm an uptime alert is received on the configured channel. `Owner: Founder`
- [ ] **Structured log format** — Server logs are structured JSON (or equivalent) for machine parsing. Log level is `info` in production (not `debug`). `Owner: Engineering`
- [ ] **Log retention confirmed** — Logs retained for at least 90 days. `Owner: DevOps`
- [ ] **On-call contact defined** — There is a defined person (likely the founder) who will receive critical alerts and knows how to respond. `Owner: Founder`

---

## Section 10: Legal and Compliance

- [ ] **Privacy Policy published** — Privacy policy accessible at `/privacy` or equivalent, reviewed by legal counsel, up to date with actual data practices. `Owner: Legal / Founder`
- [ ] **Terms of Service published** — ToS accessible at `/terms`, reviewed by legal counsel, covers all user roles (students, orgs, schools). `Owner: Legal / Founder`
- [ ] **FERPA compliance reviewed** — Platform handles student education records. FERPA compliance reviewed with legal counsel, especially for school admin access to student data and data sharing with third parties. `Owner: Legal / Founder`
- [ ] **COPPA review** — If any students may be under 13, COPPA requirements reviewed with legal counsel. Consider requiring school admin to confirm student ages before creating student accounts. `Owner: Legal / Founder`
- [ ] **Data retention policy defined** — Policy for how long student hours records are retained after a student deletes their account. `Owner: Legal / Founder`
- [ ] **Data processing agreements** — If operating in the EU or with EU students, GDPR data processing agreements in place with third-party processors (Resend, Stripe, hosting provider). `Owner: Legal / Founder`
- [ ] **Support channel live** — `support@goodhours.app` (or equivalent) routes to a monitored inbox and has a defined response time SLA. `Owner: Founder`
- [ ] **Cookie consent** — If using cookies beyond strictly necessary (analytics, etc.), cookie consent banner implemented. `Owner: Engineering / Legal`

---

## Launch Sign-Off

Before proceeding to pilot, the following sign-offs are required:

| Section | Signed Off By | Date |
|---------|--------------|------|
| Infrastructure (1) | | |
| Environment Variables (2) | | |
| Security (3) | | |
| Email (4) | | |
| Stripe (5) | | |
| Database (6) | | |
| Frontend (7) | | |
| Test Accounts (8) | | |
| Monitoring (9) | | |
| Legal (10) | | |
