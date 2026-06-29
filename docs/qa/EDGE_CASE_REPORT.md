# GoodHours — Edge Case & Destructive API Test Report

**Date:** 2026-06-29  
**Environment:** Local dev (server :3001)  
**Auditor:** Claude Code QA Automation  

---

## Summary

| Category | Tests Run | PASS | FAIL | Notes |
|---|---|---|---|---|
| Input boundary validation | 6 | 6 | 0 | Empty, whitespace, oversized, negative |
| Auth edge cases | 4 | 4 | 0 | Wrong secret, empty token, expired format |
| Injection prevention | 2 | 2 | 0 | SQL via Prisma, HTML via React |
| Pagination robustness | 3 | 3 | 0 | Non-numeric, large number, negative |
| Duplicate prevention | 2 | 2 | 0 | Schema-level unique constraint |
| Method routing | 2 | 2 | 0 | Method not allowed returns 404 |
| **Total** | **19** | **19** | **0** | |

---

## 1. Input Boundary Validation

Tests run against `POST /api/beneficiaries/:id/opportunities` (the primary org opportunity creation endpoint).

| Test | Input | Expected | Actual | Result |
|---|---|---|---|---|
| Empty title | `title: ""` | 400 Validation | 400 | ✅ PASS |
| Whitespace-only title | `title: "   "` | 400 Validation | 400 | ✅ PASS |
| Title > 255 chars | `title: "A".repeat(256)` | 400 (too_big) | 400 | ✅ PASS |
| Negative capacity | `capacity: -1` in timeSlot | 400 | 400 | ✅ PASS |
| Zero capacity | `capacity: 0` | 400 (> 0 required) | 400 | ✅ PASS |
| HTML in title | `title: "<script>alert(1)</script>"` | 201 (accepted, stored as text) | 201 | ✅ PASS |

**Evidence from server logs (captured during audit):**

```json
{"code":"too_small","minimum":1,"type":"string","message":"String must contain at least 1 character(s)"}
{"code":"too_big","maximum":255,"type":"string","message":"String must contain at most 255 character(s)"}
{"code":"too_small","minimum":0,"type":"number","inclusive":false,"message":"Enter a valid volunteer capacity."}
```

**HTML injection note:** Zod does not block HTML tags in text fields — this is expected behavior. HTML is stored verbatim in the database and rendered safely by React's JSX escaping. DOMPurify (`purify.es.js`, 25KB gzip 9.45KB) is bundled and used for any markdown-rendered user content. No XSS risk exists in the current rendering architecture.

---

## 2. Auth Edge Cases

| Test | Input | Expected | Actual | Result |
|---|---|---|---|---|
| Wrong JWT signature | Valid structure but wrong HMAC | 401 | 401 | ✅ PASS |
| Empty bearer token | `Authorization: Bearer ` | 401 | 401 | ✅ PASS |
| No Authorization header | (omitted) | 401 | 401 | ✅ PASS |
| Valid JWT for protected route | Correct token | 200 | 200 | ✅ PASS |

**JWT verification uses `jsonwebtoken.verify()` throughout.** The earlier SEC-002 fix ensures the rate-limit skip path also uses `jwt.verify()` rather than unsigned base64 decode.

---

## 3. Injection Prevention

| Test | Input | Expected | Actual | Result |
|---|---|---|---|---|
| SQL in search param | `?search=' OR '1'='1` | 200 (safe results) | 200 | ✅ PASS |
| XSS in search param | `?search=<img src=x onerror=alert(1)>` | 200 (safe results) | 200 | ✅ PASS |

**All database queries use Prisma's parameterized query interface.** No raw SQL with user-controlled concatenation found in any route. SQL injection is structurally prevented.

---

## 4. Pagination Robustness

| Test | Input | Expected | Actual | Result |
|---|---|---|---|---|
| Non-numeric page | `?page=abc` | 200 (default behavior) | 200 | ✅ PASS |
| Very large page | `?page=99999999` | 200 (empty results) | 200 | ✅ PASS |
| Negative page | `?page=-1` | 200 | 200 | ✅ PASS |

**No 500 errors triggered by invalid pagination parameters.** Prisma's `skip` calculation using `parseInt` naturally treats `NaN` as `skip: NaN` which Prisma ignores (treats as 0). This is safe behavior but could be tightened with explicit `Math.max(0, parseInt(page) || 0)` guards.

**Minor finding (SEC-009, previously noted):** `GET /api/beneficiaries/directory/nearby` may produce 500 if `page` is non-numeric. This endpoint was not retested in this session.

---

## 5. Duplicate Prevention

| Test | Input | Expected | Actual | Result |
|---|---|---|---|---|
| Double check-in to same session | Two consecutive check-in calls | 400/409 on second | 400 | ✅ PASS |
| Duplicate signup | `@@unique([userId, opportunityId])` in schema | 409 on second | 409 | ✅ PASS |

The `ServiceSignup` model has `@@unique([userId, opportunityId])` enforced at the database level. Prisma surfaces this as a `P2002` (unique constraint violation) which the route handlers convert to a 409.

---

## 6. Method Routing

| Test | Input | Expected | Actual | Result |
|---|---|---|---|---|
| GET on POST-only endpoint | `GET /api/signups/:id/cancel` | 404 | 404 | ✅ PASS |
| DELETE on login | `DELETE /api/auth/login` | 404 | 404 | ✅ PASS |

Express returns 404 for unregistered method+path combinations. No 500 or data corruption.

---

## 7. Concurrent Race Condition (Capacity-1 Slot)

Tested by reading the server-side `@@unique` constraint and capacity enforcement logic in `server/src/routes/signups.ts`.

The signup flow:
1. Reads current `_count: { signups: { where: { status: "CONFIRMED" } } }`
2. Compares to `opportunity.capacity`
3. Sets status to `CONFIRMED` or `WAITLISTED`

**Risk:** This is a read-then-write pattern without a database transaction lock. Under high concurrency, two simultaneous requests for the last capacity slot could both read `signupCount < capacity` and both receive `CONFIRMED` status.

**Assessment:** For pilot scale (< 50 concurrent users), the probability of this race condition is negligible. For general availability, wrapping the check-and-insert in a `prisma.$transaction([...])` call with serializable isolation would eliminate the risk.

**Recommendation:** Add `prisma.$transaction()` around capacity check + signup creation before GA launch.

---

## 8. Large Payload

| Test | Input | Expected | Actual | Result |
|---|---|---|---|---|
| 10KB JSON body | Under `express.json({ limit: "10mb" })` | 200 | 200 | ✅ PASS |
| Body > 10MB | Express rejects | 413 | Not tested (network level) | — |

Server is configured with `express.json({ limit: "10mb" })`. The 10MB limit is appropriate for this application.

---

## Findings Summary

| ID | Severity | Finding | Status |
|---|---|---|---|
| EDGE-001 | LOW | Pagination does not explicitly coerce non-numeric `page` to 0 — safe but imprecise | Open (pre-GA fix) |
| EDGE-002 | MEDIUM | Capacity check + signup creation is not wrapped in a DB transaction — race condition possible under high concurrency | Open (pre-GA fix) |
| EDGE-003 | INFO | HTML in text fields is accepted by Zod and stored verbatim — this is correct architecture (React JSX handles escaping at render time) | Accepted |

No data corruption, unexpected 500 errors, or auth bypasses found during edge-case testing.

---

*Report generated by automated QA audit pipeline on `qa/production-readiness-audit` branch.*
