# GoodHours Authorization Security Audit

**Date:** 2026-06-29  
**Auditor:** Security Review (automated + manual)  
**Scope:** Server-side authorization, authentication, and access control  
**Server version tested:** commit `dae1b22`  
**Test accounts used:**
- `john@student.edu` / `password123` — STUDENT, Lincoln High
- `jane@student.edu` / `password123` — STUDENT, Lincoln High
- `volunteer@greenearth.org` / `password123` — BENEFICIARY_ADMIN
- `admin@lincoln.edu` / `password123` — SCHOOL_ADMIN, Lincoln High

---

## Executive Summary

Overall the authorization posture is **strong**. Role-based access control (RBAC) is consistently enforced server-side, cross-tenant data isolation holds across all tested cases, and self-verification is blocked at the route level. One **High** vulnerability was discovered (signup rate-limit bypass via unsigned JWT), along with two **Medium** findings and several Low/Informational items.

---

## Findings

### FINDING-001 — High: Signup Rate Limit Bypass via Unsigned JWT

**Endpoint:** `POST /api/auth/signup`  
**File:** `server/src/routes/auth.ts` lines 135–147

**Description:**  
The signup rate limiter includes a `skip` function that exempts requests that carry a valid-looking Bearer token. The token is decoded to check for a `userId` field, but the **JWT signature is never verified**. An attacker can forge a JWT payload containing `userId` with any garbage signature and completely bypass the signup rate limit.

**Test performed:**
```bash
# Craft fake JWT with userId but invalid signature
FAKE_PAYLOAD='{"userId":"fake-user-id","email":"attacker@evil.com","role":"STUDENT","iat":1700000000,"exp":9999999999}'
FAKE_PAYLOAD_B64=$(echo -n "$FAKE_PAYLOAD" | python3 -c "import sys, base64; ...")
FAKE_JWT="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.$FAKE_PAYLOAD_B64.fake_invalid_signature"

curl -X POST http://localhost:3001/api/auth/signup \
  -H "Authorization: Bearer $FAKE_JWT" \
  -H "Content-Type: application/json" \
  -d '{"email":"test_bypass_<timestamp>@school.edu","password":"TestPass123!","name":"Test","role":"SCHOOL_ADMIN"}'
```

**Result:** HTTP 201 — account created successfully. The rate limiter was skipped because `payload.userId` was truthy in the decoded (unverified) JWT.

**Impact:**  
An attacker can mass-create `SCHOOL_ADMIN` accounts (the only role allowed via self-signup), flooding the database with school records. While the signup flow requires email verification for full access, the account creation itself succeeds and triggers a verification email per signup — enabling email spam abuse as well.

**Recommendation:**  
Replace the unsafe payload decode with a proper `jwt.verify()` call inside the skip function. Use the application's `JWT_SECRET`:

```typescript
// server/src/routes/auth.ts — inside the signupLimiter skip callback
import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET as string;

skip: (req) => {
  const authHeader = req.get("authorization") || "";
  if (!/^Bearer\s+/i.test(authHeader)) return false;
  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as any;
    return !!payload.userId;
  } catch {
    return false;
  }
},
```

---

### FINDING-002 — Medium: Wildcard Subdomain CORS with Credentials

**File:** `server/src/index.ts` lines 72–74

**Description:**  
The CORS configuration grants credentialed cross-origin access to any subdomain of `goodhours.app`:

```typescript
origin.endsWith(".goodhours.app") ||
origin === "https://goodhours.app"
```

`credentials: true` is also set, meaning the browser will include session cookies/tokens with cross-origin requests from any `*.goodhours.app` origin.

**Test performed:**
```bash
curl -sI -H "Origin: https://attacker.goodhours.app" http://localhost:3001/api/auth/me
# Response:
# Access-Control-Allow-Origin: https://attacker.goodhours.app
# Access-Control-Allow-Credentials: true
```

**Impact:**  
If an attacker can control any subdomain of `goodhours.app` — via a subdomain takeover on a stale DNS CNAME pointing to an unclaimed deployment (e.g., on Vercel, Netlify, or a feature-branch deployment), through an XSS on another `goodhours.app` subdomain, or via a preview/PR deployment that is later deleted — they can make credentialed API calls on behalf of any logged-in user. This could expose PII, session data, and enable account actions.

**Test confirmed:** `https://evil.goodhours.app` and `https://attacker.goodhours.app` are both allowed.

**Recommendation:**  
Enumerate the exact origins that are legitimately needed and allowlist them explicitly. For deployments (e.g., Vercel preview URLs), use a pattern-validated allowlist rather than a broad subdomain wildcard. At minimum, audit all `*.goodhours.app` DNS records for dangling CNAMEs that could be claimed by a third party.

```typescript
// Replace the endsWith check with an explicit set or tighter regex
const GOODHOURS_SUBDOMAINS = new Set([
  "https://app.goodhours.app",
  "https://www.goodhours.app",
  // add staging, etc.
]);

if (
  EXPLICIT_ALLOWED_ORIGINS.includes(origin) ||
  GOODHOURS_SUBDOMAINS.has(origin) ||
  origin === "https://goodhours.app" ||
  (!IS_PRODUCTION && isLocalDevOrigin(origin))
) {
  return callback(null, true);
}
```

---

### FINDING-003 — Medium: `IS_PROD_LIKE` Definition Inconsistency Across Files

**Files:**  
- `server/src/index.ts` line 40–43
- `server/src/routes/auth.ts` line 35–36
- `server/src/routes/schools.ts` line 41–42

**Description:**  
`IS_PROD_LIKE` is defined differently in different files:

```typescript
// index.ts (correct — includes APP_ENV)
const IS_PROD_LIKE =
  process.env.APP_ENV === "production" ||
  process.env.NODE_ENV === "production" ||
  process.env.VERCEL_ENV === "production";

// auth.ts (INCOMPLETE — missing APP_ENV)
const IS_PROD_LIKE =
  process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
```

The Vercel production deployment is configured with `APP_ENV=production` but `NODE_ENV` is typically `"development"` or unset in some Vercel setups. If the production environment uses only `APP_ENV=production` to distinguish environments, then `auth.ts`'s narrower definition of `IS_PROD_LIKE` could incorrectly evaluate to `false`, causing:

1. The `/__test-email` endpoint to be exposed publicly in production
2. The dev email-verification bypass and impersonation routes to become accessible (if `ENABLE_IMPERSONATION=true`)
3. Personal email domain restrictions and QA bypass controls to be inconsistently applied

**Impact:**  
If an attacker discovers the `/__test-email` endpoint in production, they can read email verification tokens sent to any email address (e.g., for accounts using a Mailinator-style inbox), enabling account takeover. Impersonation exposure would be severity Critical.

**Recommendation:**  
Extract `IS_PROD_LIKE` into a shared utility module (`server/src/lib/env.ts`) with the full three-condition check, and import it everywhere.

```typescript
// server/src/lib/env.ts
export const IS_PROD_LIKE =
  process.env.APP_ENV === "production" ||
  process.env.NODE_ENV === "production" ||
  process.env.VERCEL_ENV === "production";
```

---

### FINDING-004 — Low: Dev Email Inbox Endpoint Accessible Without Authentication

**Endpoint:** `GET /api/auth/__test-email?inbox=<name>`  
**File:** `server/src/routes/auth.ts` lines 345–355  
**Applies when:** `IS_PROD_LIKE === false`

**Description:**  
In non-production environments, this endpoint returns any email messages captured by the Mailinator-style inbox service for a given inbox name, with no authentication required.

**Test performed:**
```bash
curl "http://localhost:3001/api/auth/__test-email?inbox=john"
# Returns: {"inbox":"john","messages":[]}
```

**Impact (dev/staging):**  
An unauthenticated attacker with network access to a staging server can retrieve email verification tokens and password reset links for any user, enabling account takeover on that environment. Especially risky if a staging database contains real user data.

**Recommendation:**  
Require an internal API key or `CRON_SECRET` style bearer token even for this dev endpoint. At minimum, add a comment noting that this endpoint should never be reachable from public networks.

---

### FINDING-005 — Low: NaN Propagation in SQL OFFSET Causes 500 Error

**Endpoint:** `GET /api/beneficiaries/directory/nearby`  
**File:** `server/src/routes/beneficiaries.ts` line 452  
**Requires role:** `SCHOOL_ADMIN` or `TEACHER`

**Description:**  
The query parameter `page` is parsed with `parseInt` but not validated before being used to compute `offset`, which is then directly interpolated into raw SQL:

```typescript
const page = parseInt((req.query.page as string) || "1", 10);
const limit = parseInt((req.query.limit as string) || "10000", 10);
const offset = (page - 1) * limit;
// ...
const sql = `... LIMIT $${limitParamIdx} OFFSET ${offset}`;  // offset is interpolated
```

When `page` is a non-numeric string (e.g., `"abc"`), `parseInt` returns `NaN`, `offset` becomes `NaN`, and the SQL becomes `OFFSET NaN`, causing a database error and a 500 response rather than a clean 400.

**Test performed:**
```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3001/api/beneficiaries/directory/nearby?lat=41.8781&lng=-87.6298&radius=10&page=abc"
# Returns: {"error":"Internal server error"}
```

**Impact:**  
No SQL injection is possible here (only numeric values or NaN can result from `parseInt`), but the 500 response leaks that an internal error occurred and can be triggered at will by any authenticated school staff member. While not directly exploitable for data exfiltration, it is also a Denial of Service surface for authenticated users.

**Recommendation:**  
Validate `page` and `limit` before computing `offset`, and return a 400 for invalid values:

```typescript
const page = Math.max(1, parseInt((req.query.page as string) || "1", 10) || 1);
const limit = Math.min(10000, Math.max(1, parseInt((req.query.limit as string) || "10000", 10) || 10000));
```

---

### FINDING-006 — Informational: JWT Lifetime of 7 Days, No Revocation Mechanism

**File:** `server/src/middleware/auth.ts` line 55

```typescript
return jwt.sign(payload, JWT_SECRET, { expiresIn: options?.expiresIn ?? "7d" } as any);
```

**Description:**  
Tokens are valid for 7 days. There is no refresh-token mechanism or server-side token revocation list (denylist). If a token is stolen (e.g., via XSS or network interception), the attacker retains access for up to 7 days unless the victim's account is suspended (which does trigger a 401 on the next request, since `authenticate` checks `user.status`).

**Note:** The `authenticate` middleware does perform a live database lookup on every request (`prisma.user.findUnique`) and checks `user.status !== "ACTIVE"`. This provides partial mitigation — deactivating a user immediately invalidates all their tokens in practice.

**Recommendation:**  
Consider reducing the token lifetime to 1–2 days and implementing a refresh-token pattern for long-lived sessions. Alternatively, add a `tokenVersion` field to the User model that gets incremented on password change/logout, and include it in the JWT claim so old tokens can be invalidated server-side on demand.

---

### FINDING-007 — Informational: BENEFICIARY_ADMIN Role Cannot Approve Verifications

**Endpoint:** `POST /api/verification/:sessionId/approve`

**Description:**  
The `volunteer@greenearth.org` account has role `BENEFICIARY_ADMIN`. The verification approval endpoint requires `ORG_ADMIN`, `SCHOOL_ADMIN`, or `TEACHER`. `BENEFICIARY_ADMIN` is **not** in the list. This means the user who manages the service opportunity (as a beneficiary) cannot approve volunteer sessions through this legacy route.

**Test result:**
```json
{"error":"Insufficient permissions"}
```

This appears to be correct behavior for the new beneficiary-centric architecture — approvals are handled via the `/api/self-submissions` and `/api/beneficiaries` routes. However, any legacy opportunities still using the `/api/verification` path would be unverifiable by `BENEFICIARY_ADMIN` accounts. No security risk, but worth confirming operationally.

---

## Passed / Confirmed-Secure Tests

| Test | Endpoint | Result |
|------|----------|--------|
| No token on protected endpoint | `GET /api/auth/me` | 401 ✓ |
| Invalid/fake JWT | `GET /api/auth/me` | 401 ✓ |
| Expired JWT | `GET /api/auth/me` | 401 ✓ |
| JWT `alg:none` attack | `GET /api/auth/me` | 401 ✓ |
| Student → school students list | `GET /api/schools/:id/students` | 403 ✓ |
| Student → verification approve | `POST /api/verification/:id/approve` | 403 ✓ |
| Student → view another student's report | `GET /api/reports/student?studentId=other` | 403 ✓ |
| Org admin → school student list | `GET /api/schools/:id/students` | 403 ✓ |
| School admin → student from different school | `GET /api/reports/student?studentId=other` | 403 ✓ |
| Student → sign up under another user's ID | `POST /api/signups` | Ignored — JWT userId used server-side ✓ |
| Forgot-password user enumeration | `POST /api/auth/forgot-password` | Same response for existing/non-existing email ✓ |
| Internal cron routes without secret | `GET /api/internal/reminders/run` | 401 ✓ |
| Login rate limiting (per credential) | `POST /api/auth/login` | Triggered at attempt 9 (max 8) ✓ |
| Stack trace in error response | Various | Only generic `"Internal server error"` exposed ✓ |
| Cross-origin request from unknown origin | `http://localhost:3001/api/auth/me` with `Origin: evil.example.com` | No CORS headers returned ✓ |
| Beneficiary admin cross-tenant | `GET /api/schools/:id/students` | 403 ✓ |
| Self-verification blocked | `POST /api/verification/:id/approve` | 403 ✓ |
| SQL injection via Zod-validated inputs | `POST /api/auth/login` with `{"email": {"$where": "1=1"}}` | 400 validation error ✓ |

---

## Source Code Audit

### Passwords/Secrets in Logs

No `console.log` calls containing `password`, `token`, `secret`, or `hash` were found. Some `console.error` calls log error objects from password-related operations (e.g., bcrypt failures, email send failures), but these do not log the actual credentials.

### SQL Injection

All database operations use Prisma's parameterized ORM methods. Six raw SQL queries in `server/src/routes/beneficiaries.ts` use `$queryRawUnsafe` and `$executeRawUnsafe`, but user-supplied values are consistently passed as parameterized arguments (`$1`, `$2`, etc.), not string-interpolated. The one exception is `OFFSET ${offset}` (see FINDING-005), which is safe from injection but not from NaN errors.

### JWT Configuration

- **Algorithm:** HS256 (default for `jsonwebtoken.sign()`) — appropriate ✓
- **Secret:** Must be set at startup (`env.ts` exits if missing) ✓
- **Expiry:** 7 days (see FINDING-006) ⚠
- **`alg:none` attack:** Rejected ✓
- **User status checked on every request:** Yes (live DB lookup in `authenticate`) ✓

### CORS Configuration

- Known origins (`localhost:5173`, `localhost:3000`) explicit ✓
- Evil third-party origins rejected ✓
- Wildcard subdomain for `*.goodhours.app` with credentials — see FINDING-002 ⚠

### Security Headers (Helmet)

All tested and present:

| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `SAMEORIGIN` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `X-XSS-Protection` | `0` (correct — modern recommendation) |
| `Content-Security-Policy` | Set with `default-src 'self'` |

### Rate Limiting

| Endpoint | Window | Max | Notes |
|----------|--------|-----|-------|
| `POST /api/auth/login` (IP) | 15 min | 50 failed | Per IP + user agent |
| `POST /api/auth/login` (credential) | 15 min | 8 failed | Per IP + email pair |
| `POST /api/auth/signup` (API) | 1 hour | 5 | **Bypassable via unsigned JWT** — FINDING-001 |
| `POST /api/auth/signup` (browser) | 1 hour | 100 | |
| `POST /api/auth/forgot-password` | 15 min | 5 | Per IP + email |
| `POST /api/auth/resend-verification` | 1 hour | 3 | Per user |
| Global `/api` | 5 min | 300/IP, 600/user | Skipped in non-prod |

---

## Summary Table

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| FINDING-001 | **High** | Signup rate limit bypass via unsigned JWT | Open |
| FINDING-002 | **Medium** | Wildcard CORS `*.goodhours.app` with credentials | Open |
| FINDING-003 | **Medium** | `IS_PROD_LIKE` inconsistency exposes dev endpoints in some prod configs | Open |
| FINDING-004 | Low | Dev email inbox endpoint unauthenticated | Open |
| FINDING-005 | Low | NaN propagation in SQL OFFSET causes 500 error | Open |
| FINDING-006 | Informational | JWT 7-day lifetime, no revocation | Accepted risk |
| FINDING-007 | Informational | `BENEFICIARY_ADMIN` cannot approve via legacy verification route | Accepted / by-design |
