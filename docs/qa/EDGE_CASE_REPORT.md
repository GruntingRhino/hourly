# GoodHours API Edge Case & Destructive Test Report

**Date:** 2026-06-29  
**Server:** `http://localhost:3001` (Express + PostgreSQL)  
**Tester:** Claude Code automated test run  
**Scope:** Input boundaries, duplicate prevention, race conditions, auth edge cases, parameter injection, large payloads, method routing

---

## Summary

| Category | Tests Run | PASS | FAIL / Defect |
|---|---|---|---|
| Input Boundaries | 12 | 9 | 3 |
| Duplicate Prevention | 6 | 6 | 0 |
| Race Conditions | 1 | 0 | 1 |
| Auth Edge Cases | 5 | 5 | 0 |
| Parameter Injection | 5 | 5 | 0 |
| Large Payloads | 2 | 2 | 0 |
| Method Routing | 4 | 0 | 4 (minor) |
| Extra | 5 | 5 | 0 |
| **Total** | **40** | **32** | **8** |

**4 distinct defects found** — 2 HIGH severity, 2 MEDIUM severity, 1 MINOR (4 instances).

---

## Defects Found

### DEFECT-001 — Whitespace-only title accepted [HIGH]

- **Endpoint:** `POST /api/beneficiaries/:id/opportunities`
- **Input:** `{"title":"   ", ...}` (3 spaces)
- **Expected:** 400 Validation failed
- **Actual:** 201 Created — stored title is `"   "` (pure whitespace)
- **Root cause:** Zod schema uses `z.string().min(1)` which passes for `"   "` because string length ≥ 1. No `.trim()` is applied before the min-length check.
- **Impact:** Opportunities with invisible titles appear in listings; confusing for students browsing.
- **Fix:** Change to `z.string().trim().min(1).max(255)` at line 1445 of `server/src/routes/beneficiaries.ts`. Same fix applies to the PATCH schema at line 1540.

---

### DEFECT-002 — Past dates accepted for opportunities [MEDIUM]

- **Endpoint:** `POST /api/beneficiaries/:id/opportunities`
- **Input:** `{"startDate":"2020-01-01", "timeSlots":[{"date":"2020-01-01", ...}]}`
- **Expected:** 400 — slot date must be today or in the future
- **Actual:** 201 Created — opportunity stored with 2020 date
- **Root cause:** No date validation in the Zod schema or handler logic for `startDate` or `timeSlots[].date`.
- **Impact:** Organizations can accidentally create opportunities dated years ago. Students browsing upcoming events could see stale records.
- **Fix:** Add a `.refine()` to the timeSlots schema and/or `startDate` field ensuring dates are ≥ today (UTC).

---

### DEFECT-003 — End time before start time accepted [MEDIUM]

- **Endpoint:** `POST /api/beneficiaries/:id/opportunities`
- **Input:** `{"timeSlots":[{"startTime":"11:00","endTime":"09:00","durationHours":2, ...}]}`
- **Expected:** 400 — end time must be after start time
- **Actual:** 201 Created — slot stored with logically impossible times (start 11:00, end 09:00)
- **Root cause:** `opportunityTimeSlotSchema` validates time format with regex (`/^\d{2}:\d{2}$/`) but does not compare startTime vs endTime ordering.
- **Additional concern:** The `durationHours` field is client-supplied and not computed from startTime/endTime. A malicious or mistaken client can submit mismatched durations with no server rejection.
- **Fix:** Add a `.superRefine()` to the time slot schema comparing the two HH:MM strings (lexicographic comparison works for 24h zero-padded format).

---

### DEFECT-004 — Race condition produces 500 errors instead of 409/503 [HIGH]

- **Endpoint:** `POST /api/beneficiaries/slots/:slotId/signup`
- **Scenario:** 5 concurrent signup requests, capacity=1 slot, 3 different users (some duplicates)
- **Expected:** 1 CONFIRMED, rest WAITLISTED or 409 — all responses well-formed JSON
- **Actual:**
  - 2 requests succeeded (1 CONFIRMED, 1 WAITLISTED) — data integrity intact
  - 3 requests returned `500 {"error":"Internal server error"}`
- **Root cause:** `runSerializableTransaction` retries serializable isolation failures (P2034) up to 3 times, then re-throws the Prisma error. The outer `catch (err)` in the route handler has no Prisma-aware handling, so it falls through to a generic 500. Additionally, for duplicate-user concurrent attempts, a unique constraint violation (P2002 on `slotId_studentId`) also reaches the generic handler as 500.
- **Data integrity:** INTACT — the DB shows exactly 1 CONFIRMED, 1 WAITLISTED after the race. The 500s did not corrupt data.
- **Fix (two parts):**
  1. In `catch (err)` of the signup handler (~line 2251, `beneficiaries.ts`): detect `PrismaClientKnownRequestError` with code `P2002` (unique constraint) and return 409 `{"error":"Already signed up for this slot"}`.
  2. For P2034 exhausted after max retries, return 503 `{"error":"Server busy, please retry"}` with header `Retry-After: 1`.

---

### DEFECT-005 — Method-not-allowed returns HTML 404, not JSON [MINOR]

- **Endpoints:** `DELETE /api/auth/login`, `PUT /api/auth/login`, `PATCH /api/auth/login`, `GET /api/verification/:id/approve`
- **Expected:** 404 or 405 with `Content-Type: application/json`
- **Actual:** 404 with `Content-Type: text/html; charset=utf-8` — Express default HTML error page (`Cannot DELETE /api/auth/login`)
- **Impact:** API clients expecting JSON receive unparseable HTML. Development tooling and monitoring that expects JSON from the API will choke.
- **Fix:** Add a catch-all 404 handler at the end of `server/src/index.ts` (after all `app.use()` route mounts):
  ```ts
  app.use((_req, res) => res.status(404).json({ error: "Not found" }));
  ```

---

## Full Test Results

### Category 1 — Input Boundary Tests

**Endpoint:** `POST /api/beneficiaries/:id/opportunities` (BENEFICIARY_ADMIN role)  
**Beneficiary ID:** `cmquusyba00078o5ymh0326yn` (Green Earth Foundation)

| # | Test | Input | Expected | HTTP | Response Snippet | Result |
|---|---|---|---|---|---|---|
| 1.1 | Empty string title | `title: ""` | 400 | 400 | `Validation failed` (too_small) | PASS |
| 1.2 | Whitespace-only title | `title: "   "` | 400 | **201** | Created, id returned | **FAIL — DEFECT-001** |
| 1.3 | 10,000 char title | `title: "A"*10000` | 400 | 400 | `Validation failed` (too_big, max 255) | PASS |
| 1.4 | HTML/XSS in title | `title: "<script>alert(1)</script>"` | 201 (stored safely) | 201 | Stored verbatim, not sanitized server-side | PASS |
| 1.5 | Unicode/emoji in title | `title: "🎉 Volunteer Day 🌱"` | 201 | 201 | Stored verbatim | PASS |
| 1.6 | Negative capacity | `capacity: -1` | 400 | 400 | `Validation failed` (too_small, must be > 0) | PASS |
| 1.7 | Zero capacity | `capacity: 0` | 400 | 400 | `Validation failed` (too_small) | PASS |
| 1.8 | Past date | `date: "2020-01-01"` | 400 | **201** | Created with 2020 date | **FAIL — DEFECT-002** |
| 1.9 | End time before start time | `startTime:"11:00", endTime:"09:00"` | 400 | **201** | Created with invalid times | **FAIL — DEFECT-003** |
| 1.10 | Self-submission hours=99999 | `hours: 99999` via `/api/self-submissions` | 400 | 400 | `Validation failed` (too_big, max 24) | PASS |
| 1.11 | Self-submission hours=24 | `hours: 24` (boundary) | 201 | 201 | Created | PASS |
| 1.12 | Self-submission hours=25 | `hours: 25` (over max) | 400 | 400 | `Validation failed` (too_big) | PASS |

**Note on 1.4 (HTML in title):** Storing raw HTML is acceptable server-side; the XSS risk is at the rendering layer. React's JSX escapes by default, so this is only a risk in raw `dangerouslySetInnerHTML` usage. A Content Security Policy enforces this defense in depth.

---

### Category 2 — Duplicate Submission Prevention

**Capacity-1 slot used:** `cmqzaqck30017mulg1lr0v11s` (Edge Case Test Signup Opp)

| # | Test | Description | Expected | HTTP | Response | Result |
|---|---|---|---|---|---|---|
| 2.1 | First signup | John signs up for capacity-1 slot | 201 CONFIRMED | 201 | `status: "CONFIRMED"` | PASS |
| 2.2 | Duplicate signup | John signs up again for same slot | 409 | 409 | `Already signed up for this slot` | PASS |
| 2.3 | Signup at capacity | Jane signs up (slot full) | 201 WAITLISTED | 201 | `status: "WAITLISTED"` | PASS |
| 2.4 | Valid checkin | John checks into PENDING_CHECKIN session | 200 | 200 | `status: "CHECKED_IN"` | PASS |
| 2.5 | Double checkin | John checks into already-CHECKED_IN session | 400 | 400 | `Already checked in or completed` | PASS |
| 2.6 | Re-approve VERIFIED session | School admin approves already-VERIFIED session | 400 | 400 | `Already approved` | PASS |

---

### Category 3 — Concurrent Race Condition Simulation

**Capacity-1 slot:** `cmqzat3uw000cmu0qde1utnvx` (Race Test Opp)  
**Method:** 5 simultaneous `curl &` background processes, `wait` for all

| Request | User | Expected | HTTP | DB Status | Result |
|---|---|---|---|---|---|
| RACE1 | John | 201 CONFIRMED or WAITLISTED | 201 | WAITLISTED | PASS |
| RACE2 | Jane | 201 CONFIRMED or WAITLISTED | **500** | — | **FAIL — DEFECT-004** |
| RACE3 | Alex | 201 CONFIRMED or WAITLISTED | 201 | CONFIRMED | PASS |
| RACE4 | John (dup) | 409 Already signed up | **500** | — | **FAIL — DEFECT-004** |
| RACE5 | Jane (dup) | 409 Already signed up | **500** | — | **FAIL — DEFECT-004** |

**Post-race DB state:** 1 CONFIRMED, 1 WAITLISTED — data integrity maintained.  
**Verdict:** Correctness was preserved but 3 users received `500 Internal Server Error` with no actionable message.

---

### Category 4 — Auth Edge Cases

| # | Test | Input | Expected | HTTP | Response | Result |
|---|---|---|---|---|---|---|
| 4.1 | Wrong HMAC secret | JWT signed with different secret | 401 | 401 | `Invalid or expired token` | PASS |
| 4.2 | Expired JWT | JWT with `exp: 1` (Jan 1970) | 401 | 401 | `Invalid or expired token` | PASS |
| 4.3 | Empty Authorization header | `Authorization: ` (empty value) | 401 | 401 | `Missing or invalid authorization header` | PASS |
| 4.4 | Bearer with empty token | `Authorization: Bearer ` | 401 | 401 | `Missing or invalid authorization header` | PASS |
| 4.5 | No Authorization header | (omitted entirely) | 401 | 401 | `Missing or invalid authorization header` | PASS |

---

### Category 5 — Parameter Injection

**Endpoint:** `GET /api/opportunities`

| # | Test | Query String | Expected | HTTP | Response | Result |
|---|---|---|---|---|---|---|
| 5.1 | Negative page | `?page=-1` | 200 or 400, no 500 | 200 | 6 results (param not used) | PASS |
| 5.2 | Non-numeric page | `?page=abc` | 200 or 400, no 500 | 200 | 6 results (param ignored) | PASS |
| 5.3 | Very large page | `?page=99999999` | 200 or 400, no 500 | 200 | 6 results (param ignored) | PASS |
| 5.4 | SQL injection in search | `?search=' OR '1'='1` | 200 safe results | 200 | 0 results (Prisma parameterized) | PASS |
| 5.5 | XSS in search | `?search=<img src=x onerror=alert(1)>` | 200 safe results | 200 | 0 results | PASS |

**Note on 5.1–5.3:** The `/api/opportunities` endpoint ignores the `page` query parameter entirely and returns all results. Pagination is not implemented server-side. This is a separate scalability concern, not a security issue.

---

### Category 6 — Large Payload Tests

| # | Test | Payload Size | Expected | HTTP | Content-Type | Response | Result |
|---|---|---|---|---|---|---|---|
| 6.1 | 50KB body to `POST /api/messages` | ~50 KB | 400 (validation), no crash | 400 | `application/json` | `Recipient and body are required` | PASS |
| 6.2 | 15MB body to `POST /api/messages` | ~15 MB | 413 | 413 | `application/json` | `{"error":"request entity too large"}` | PASS |

---

### Category 7 — Method Not Allowed

| # | Test | Method + Path | Expected | HTTP | Content-Type | Result |
|---|---|---|---|---|---|---|
| 7.1 | DELETE login | `DELETE /api/auth/login` | 404/405 JSON | 404 | `text/html` | **MINOR — DEFECT-005** |
| 7.2 | GET approve | `GET /api/verification/fake-id/approve` | 404/405 JSON | 404 | `text/html` | **MINOR — DEFECT-005** |
| 7.3 | PUT login | `PUT /api/auth/login` | 404/405 JSON | 404 | `text/html` | **MINOR — DEFECT-005** |
| 7.4 | PATCH login | `PATCH /api/auth/login` | 404/405 JSON | 404 | `text/html` | **MINOR — DEFECT-005** |

---

### Extra Tests

| # | Test | Input | HTTP | Response | Result |
|---|---|---|---|---|---|
| E.1 | Malformed JSON body | `{bad json}` to `POST /api/self-submissions` | 400 | JSON parse error message | PASS |
| E.2 | Content-Type mismatch | `Content-Type: text/plain` with JSON body | 400 | Validation failed (body not parsed as JSON) | PASS |
| E.3 | Null body fields | `{"organizationName":null,...}` | 400 | Validation failed | PASS |
| E.4 | RBAC: STUDENT creates opportunity | `POST /api/beneficiaries/:id/opportunities` as STUDENT | 403 | `Insufficient permissions` | PASS |
| E.5 | Non-existent resource ID | `GET /api/beneficiaries/nonexistent-id/opportunities` | 403 | `This beneficiary is not available to your school` | PASS |

---

## Priority Fix Order

| Priority | Defect | File | Effort | Severity |
|---|---|---|---|---|
| P0 | DEFECT-004: Race condition 500s | `server/src/routes/beneficiaries.ts` ~line 2251 | Low | HIGH |
| P1 | DEFECT-001: Whitespace-only title | `server/src/routes/beneficiaries.ts` line 1445, 1540 | Trivial | HIGH |
| P2 | DEFECT-002: Past dates accepted | `server/src/routes/beneficiaries.ts` timeSlots schema | Low | MEDIUM |
| P3 | DEFECT-003: End > start time | `server/src/routes/beneficiaries.ts` `opportunityTimeSlotSchema` | Low | MEDIUM |
| P4 | DEFECT-005: HTML 404s | `server/src/index.ts` (add catch-all middleware) | Trivial | MINOR |

---

## Test Artifacts Created in DB

The following records were inserted into `goodhours_qa_latest` during testing. Safe to delete.

| Model | ID | Notes |
|---|---|---|
| BeneficiaryOpportunity | `cmqzap06a000jmulgdorcwdp5` | Whitespace title `"   "` — DEFECT-001 evidence |
| BeneficiaryOpportunity | `cmqzap0a1000mmulgc80u3ykz` | XSS title `<script>alert(1)</script>` |
| BeneficiaryOpportunity | `cmqzap0bt000pmulgale5rec4` | Emoji title `🎉 Volunteer Day 🌱` |
| BeneficiaryOpportunity | `cmqzapcu0000wmulgnnucadek` | Past date 2020-01-01 — DEFECT-002 evidence |
| BeneficiaryOpportunity | `cmqzapcvv000zmulgcixrom55` | End time 09:00 before start 11:00 — DEFECT-003 evidence |
| BeneficiaryOpportunity | `cmqzaqck30016mulgle4jhfof` | Capacity-1 duplicate/signup test |
| BeneficiaryOpportunity | `cmqzat3uw000bmu0qkgryrrh6` | Race condition test (capacity-1) |
| SelfSubmittedRequest | `cmqzav7nc000smu0q09cd3art` | 24-hour self-submission boundary test |
