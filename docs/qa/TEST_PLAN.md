# GoodHours QA Test Plan

**Version:** 1.0  
**Last Updated:** 2026-06-29  
**Status:** Active

---

## 1. Overview

This document defines the complete testing strategy for the GoodHours platform prior to and during its pilot launch. GoodHours is a community service coordination, tracking, and verification platform. The core priorities that testing must validate are, in order: **Legitimacy > Verification > Compliance > Adoption**. Testing failures that compromise the audit trail or allow unauthorized hour submissions are blockers; usability imperfections are not.

---

## 2. Test Environment

### 2.1 Infrastructure

| Component | Target |
|-----------|--------|
| Database  | PostgreSQL at `localhost:5432/goodhours_qa_latest` |
| API Server | `http://localhost:3001` |
| Client | `http://localhost:5173` |
| Base URL (overridable) | `QA_BASE_URL=http://localhost:5173` |

### 2.2 Environment Setup

```bash
# 1. Ensure PostgreSQL is running on :5432
# 2. Start the server
cd server && npm run dev

# 3. Start the client
cd client && npm run dev

# 4. Seed test data (drops and recreates all data)
cd server && npx tsx prisma/seed.ts

# 5. Run the Playwright suite
cd /path/to/root && npx playwright test tests/goodhours.qa.spec.ts
```

> **Note:** The seed script reads `SEED_PASSWORD` from `server/.env`. All QA accounts below use the value set by that variable (assumed `password123` in QA environments unless overridden).

### 2.3 Test Accounts

All accounts are seeded by `server/prisma/seed.ts`. Default QA password: `password123`.

| Role | Email | Notes |
|------|-------|-------|
| STUDENT | john@student.edu | Primary student; has prior session history |
| STUDENT | jane@student.edu | Secondary student |
| STUDENT | alex@student.edu | Tertiary student; used for waitlist tests |
| BENEFICIARY_ADMIN (Org) | volunteer@greenearth.org | Primary org; pre-approved by Lincoln High |
| BENEFICIARY_ADMIN (Org) | staff@library.org | Secondary org |
| SCHOOL_ADMIN | admin@lincoln.edu | Lincoln High School admin |

---

## 3. Test Scope

### 3.1 Critical Workflows (Must Pass Before Pilot)

The following workflows represent the end-to-end service guarantee of the platform:

1. **Authentication** — Signup (student/org/school), email verification, login, wrong-password rejection, forgot/reset password, duplicate signup prevention
2. **Student Lifecycle** — Browse opportunities, search/filter/sort, save/skip/discard/recover, sign up, join waitlist, cancel signup, waitlist promotion, check in, check out, submit verification (drawn signature and file upload), view verified hours
3. **Organization Lifecycle** — Create opportunity, view/manage signups, approve/reject verification, view volunteer history and stats, messaging
4. **School Admin Lifecycle** — View school dashboard, manage student groups, approve organizations, view reports, export CSV, send messages
5. **Verification State Machine** — PENDING_CHECKIN → CHECKED_IN → CHECKED_OUT → VERIFIED/REJECTED; immutability after VERIFIED; audit trail entry created on each transition
6. **Audit Trail** — Every verification action records actor, timestamp, and reason; records cannot be deleted or modified
7. **Messaging** — Compose, receive, mark as read, notifications tab
8. **Settings** — Profile edit, avatar upload, social links, notification preferences, privacy settings, change password, delete account, classroom tab

### 3.2 Secondary Workflows (Must Pass Before General Availability)

- Canvas LMS integration (mock mode)
- Google Classroom integration (mock mode)
- School invite codes and join-by-code flow
- Intervention workflow
- Dashboard stats accuracy

### 3.3 Out of Scope for Initial QA

- Live Stripe payments (requires real test keys — see Section 6.4)
- Live email delivery to real mailboxes (requires real Resend key — see Section 6.3)
- Canvas and Google Classroom live OAuth (requires real client credentials)

---

## 4. Test Coverage

### 4.1 Automated Tests — Playwright Suite

**File:** `tests/goodhours.qa.spec.ts`  
**Suite size:** 108 checklist items  
**Current results (as of 2026-06-29):** ~40 PASS, ~68 MANUAL REQUIRED

The suite is a hybrid automated/self-documenting QA runner. Each checklist item attempts automated validation and records the result. Items that require real email delivery, Stripe interaction, or subjective UI judgment are classified as `MANUAL REQUIRED` and written to the results file with the reason.

**Results output:** `tests/qa-results.md` — regenerated on each run.  
**Failure summary:** `tests/failures-summary.txt`  
**Screenshots/traces:** `tests/artifacts/screenshots/` and `tests/artifacts/traces/`

To run:

```bash
# From repo root
npx playwright test tests/goodhours.qa.spec.ts --reporter=list

# With trace on first retry
npx playwright test tests/goodhours.qa.spec.ts --trace=on-first-retry
```

#### Items Currently Automated (40 PASS)

- Login with wrong password
- Student dashboard stats cards (Committed, Verified, Activities Done)
- Progress bar reflects verified hours vs school goal
- Upcoming Opportunities list loads
- Recent Activity list loads
- Opportunities browse page loads
- Tag filter (select tag → narrow; clear → restore)
- Approved Orgs Only toggle
- Export Hours CSV (correct columns)
- Export as PDF
- Messages inbox loads
- Compose and send message to org
- Notifications tab loads; click marks read
- Avatar upload
- Notification preference toggle persists
- Privacy setting persists
- Classroom tab displays invite code
- Org dashboard pending verifications section
- Org stats cards
- Additional dashboard and navigation items

#### Items Requiring Manual Execution (68 MANUAL REQUIRED)

All `MANUAL REQUIRED` items fall into one or more of these categories:

| Category | Reason |
|----------|--------|
| Email flows | `RESEND_API_KEY` is a placeholder; mailinator polling is unreliable in CI |
| Stripe flows | No Stripe test keys configured |
| State-dependent flows | Check-in/check-out/verification require sequential cross-session state that Playwright cannot reliably chain without real timing |
| Signature/file upload | Canvas-drawn signatures and file attachment upload require interactive browser sessions |
| Subjective UI | Sort order verification ("Date", "Most Popular") requires human judgment |
| Password change | Requires entering current password in a sensitive form |
| Delete account | Destructive; excluded from automated suite to protect test data |
| Waitlist promotion | Requires two student sessions and a cancellation in the correct order |

See `tests/qa-results.md` for the full item-by-item breakdown with the exact manual step required for each.

### 4.2 API Authorization Tests

Manual `curl`-based tests to verify that RBAC middleware blocks unauthorized access:

```bash
# Attempt to access org endpoint as student — expect 403
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer <student_jwt>" \
  http://localhost:3001/api/organizations/stats

# Attempt to access school endpoint as org — expect 403
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer <org_jwt>" \
  http://localhost:3001/api/schools/groups

# Attempt unauthenticated access — expect 401
curl -s -o /dev/null -w "%{http_code}" \
  http://localhost:3001/api/reports/student
```

All critical routes must reject cross-role and unauthenticated requests. See `docs/qa/ROLE_PERMISSION_MATRIX.md` for the full matrix.

### 4.3 Static Analysis

```bash
# Type-check server
cd server && npx tsc --noEmit

# Type-check client
cd client && npx tsc --noEmit

# Lint (if configured)
cd client && npm run lint
```

Both type-checks must produce zero errors before a build is considered clean. The client lint command must also pass; the server currently has no separate lint script.

### 4.4 Dependency Security Scan

```bash
cd server && npm audit --audit-level=high
cd client && npm audit --audit-level=high
```

Any `high` or `critical` severity vulnerabilities with available patches must be resolved before launch.

---

## 5. Email Testing

### 5.1 Current State

The Resend API key is a placeholder (`re_your_resend_api_key_here`). Email delivery will not occur. The `EMAIL_DELIVERY_MODE=auto` setting will fall back to log-only mode in development when the API key is absent.

### 5.2 Development Workaround

To observe emails in development without a real key, set:

```env
EMAIL_DELIVERY_MODE=log
```

Emails will be logged to the server console instead of sent. Inspect the log output for the verification link, password reset link, etc.

### 5.3 QA Email Addresses

When a real Resend key is available, email flows use `mailinator.com` addresses. The Playwright suite polls the Mailinator public API at:

```
https://www.mailinator.com/api/v2/domains/public/inboxes
```

The suite expects the recipient address to follow the pattern `qa-test-<uuid>@mailinator.com`. This only works reliably with a Mailinator API key or under low-traffic conditions on public inboxes.

**Do not use** `@gmail.com`, `@yahoo.com`, or other personal domains for QA email tests — the server blocks personal email domains in non-dev environments unless `ALLOW_PERSONAL_EMAIL_DOMAINS=true`.

### 5.4 Production Email Readiness

Before pilot, set:
- A real `RESEND_API_KEY`
- A verified sending domain in the Resend dashboard
- `EMAIL_FROM` to an address on the verified domain (e.g., `noreply@notifications.goodhours.app`)
- `CLIENT_URL` to the production URL so email links do not point to localhost

---

## 6. Stripe Testing

### 6.1 Current State

All Stripe environment variables are unconfigured placeholders. Any feature that invokes Stripe (payments, subscription management) is blocked until real test credentials are provided.

### 6.2 Required Variables

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_...=price_...
```

### 6.3 Test Approach (Once Keys Available)

- Use Stripe test mode exclusively in QA/staging
- Use test card `4242 4242 4242 4242`, expiry `12/34`, CVC `123`
- Test webhook events using the Stripe CLI: `stripe listen --forward-to localhost:3001/api/webhooks/stripe`
- Validate that subscription state changes (created, cancelled, past_due) propagate correctly to the application

### 6.4 Full Testing Blocked

Full end-to-end Stripe testing is **blocked** until real Stripe test keys are obtained. Do not launch paid features until this testing is complete. See `docs/qa/STRIPE_TEST_REPORT.md` for current status.

---

## 7. Test Data Management

### 7.1 Seed Script

```bash
cd server
npx tsx prisma/seed.ts
```

This drops all existing rows and recreates a consistent baseline. Run this before each QA session to ensure a clean state. The script creates all test accounts, a school (Lincoln High), two organizations, multiple opportunities across different date/status states, and several sessions at various verification states.

### 7.2 Reset Frequency

- Before any automated Playwright run
- Before any manual end-to-end walkthrough
- After any destructive manual test (delete account, hard-delete data)

### 7.3 Data Isolation

Do not run QA against a shared or production database. `ALLOW_SHARED_DEV_DATABASE=false` should be set unless explicitly needed. The QA environment should use a dedicated local or branch database.

---

## 8. Pass Criteria

A build is considered QA-ready for pilot when:

- [ ] All 40+ automated Playwright items: PASS
- [ ] Zero FAIL items in `tests/qa-results.md` (MANUAL REQUIRED items are exempted if documented)
- [ ] All critical manual items from `docs/qa/MANUAL_FOUNDER_CHECKLIST.md` signed off
- [ ] `npx tsc --noEmit` exits 0 on both server and client
- [ ] `npm audit --audit-level=high` reports no unpatched high/critical issues
- [ ] All RBAC authorization tests return correct HTTP status codes
- [ ] Email verification flow confirmed working with real Resend key
- [ ] Verification state machine confirmed immutable after VERIFIED state

---

## 9. Test Roles and Responsibilities

| Area | Owner |
|------|-------|
| Automated suite maintenance | Engineering |
| Manual founder checklist | Founder |
| API authorization spot-checks | Engineering |
| Email/Stripe integration testing | Engineering + Founder |
| Pilot monitoring and escalation | Founder + Engineering |
