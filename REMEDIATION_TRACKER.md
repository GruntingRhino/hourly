# GoodHours Remediation Tracker

Living checklist for the master security/architecture/release-readiness goal
(see the `/goal` invocation history for the full 23-section brief, and
`security_findings.md` for the original numbered audit findings). This file
is the source of truth for **what's done vs. still open** — update it every
time a session finishes a chunk of this work instead of re-deriving status
from scratch.

**Last updated:** 2026-08-04 (pre-commit — see verification block for current state).

This file now also consolidates findings from the other, older audit markdown
files scattered around the repo (`docs/qa/SECURITY_AUDIT.md`,
`docs/qa/FINAL_RELEASE_REPORT.md`, `docs/qa/DATA_INTEGRITY_REPORT.md`,
`docs/qa/ACCESSIBILITY_REPORT.md`, `docs/qa/PERFORMANCE_REPORT.md`,
`docs/student-privacy-compliance.md`, `docs/canvas-production-readiness.md`,
`integration_failures.md`, `qa_results.md`) — see §"Other audit docs" below.
Those older files are safe to treat as historical/superseded; **this file is
the current source of truth.**

Status legend: ✅ Fixed & verified · 🟡 Partially done · ⬜ Not started · ❓ Not yet assessed this session

---

## Numbered audit findings (`security_findings.md` §2)

| # | Issue | Status | Evidence |
|---|---|---|---|
| 1 | Password signup issues a full privileged session before email verification | ✅ | `evaluateSessionEligibility` in `server/src/lib/schoolAuthority.ts`; blocks unverified/pending accounts centrally in `middleware/auth.ts`. Test: `schoolAuthority.test.ts`, `auth.ts` test "password signup creates a pending application but returns no bearer token" |
| 2 | Google identity can claim unrelated school without proving admin authority; replayable bootstrap token | ✅ | `assertExactSchoolDomain` (`schoolAuthority.ts`) enforced in `googleAuth.ts`; bootstrap tokens gated by `consumedAt: null` → set exactly once (transactional). Test: "Google bootstrap is database-backed, short-lived, and consumed once" |
| 3 | Caller-controlled Canvas/Google base URLs → SSRF + OAuth credential exfiltration | ✅ | `server/src/lib/lmsOutboundSecurity.ts` — allowlisted origins via `CANVAS_ALLOWED_ORIGINS`, `redirect: "error"`, Google hosts hardcoded (not configurable — removed from `.env.example`). Tests: `lmsOutboundSecurity.test.ts`, `lmsSecurityArchitecture.test.ts` |
| 4 | Cross-tenant cohort membership / stale LMS mapping not enforced centrally | ✅ | `ensureStudentCohortMembership` (`studentCohorts.ts`) compares student/cohort/requested schoolId. Test: "cross-school cohort membership is rejected before any mutation" |
| 5 | Teachers can read/mutate any same-school classroom, session, or message data (not just assigned cohorts) | ✅ | Central staff cohort-scope helper (`cohortAccess.ts`) applied to classrooms/messages/sessions routes. Tests: `teacherClassroomScope.integration.test.ts`, `teacherMessageScope.integration.test.ts`, `teacherSessionScope.integration.test.ts` |
| 6 | Beneficiary signup list leaks real student names/IDs and cancellation capability to partners | ✅ | `pseudonymousStudentLabel` used in `beneficiaries.ts` signup responses; DTO trimmed to non-identifying fields |
| 7 | Accepted beneficiary invitation token remains reusable as a login credential | ✅ | All invitation accept branches now return "already accepted"/409, no session-minting on repeat use — verified across `invitations.ts` |
| 8 | Public `GET /cancel/:token` mutates state (cancels signup, promotes waitlist) — scanner/crawler-triggerable | ✅ | Fixed 2026-08-03 (commit `e5651f5`): split into non-mutating GET + confirming POST; added missing client page `CancelSignup.tsx` (email link pointed at a route that never existed); audit now records actor as a bearer-link capability, not an authenticated student action. Test: `beneficiaryCancellationLink.integration.test.ts` |
| 9 | FERPA `dataAccessLog` write is fail-open (swallows errors, response still returns real data); audit details duplicate student PII | ✅ | Fixed 2026-08-04 (commit `8db748a`): `logDataAccess` no longer swallows write errors — every caller already awaits it before `res.json`, so a failed audit write now correctly 500s via the route's existing catch block. `summarizeStudentSubjects` no longer stores raw student names/emails; stores only a count + keyed HMAC digest of the subject-ID set. Test: `dataAccessLogFailClosed.test.ts` |
| 10 | LMS sync pulls every course/roster visible to the connected identity — no course allowlist before fetching identities | ✅ | `selectedExternalCourseIds` present in `canvasIntegration.ts` config/sync path |

## Additional issues found this session (2026-08-04, not in the original 10)

| Issue | Status | Evidence |
|---|---|---|
| `IS_PROD_LIKE` duplicated independently in 7 files; `routes/schools.ts`'s copy tested only `NODE_ENV`/`VERCEL_ENV` and missed `APP_ENV`, so an `APP_ENV`-only production config would leak a newly created teacher's temp password in the create-staff API response | ✅ | Centralized into `server/src/lib/isProdLike.ts` (deliberately NOT `env.ts`, which runs `process.exit(1)` at import time and would break any lightweight importer). All 7 files now import it. Test: `isProdLike.test.ts`. Commit `273f531` |
| `beneficiaries.ts:527-529` — `page`/`limit` on `GET /directory/nearby` not validated before use in a raw-SQL `OFFSET`; non-numeric input → `NaN` → 500 | ✅ | Fixed: rejects non-integer/out-of-range page or limit with 400 before building the query. Test: `beneficiaryDirectoryNearbyPagination.test.ts`. Commit `3cbf01a` |
| No DB-level `CHECK` constraint preventing `ServiceSession.status = 'VERIFIED'` with a null `checkOutTime` | ✅ | Migration `20260804153210_service_session_verified_requires_checkout` adds a `NOT VALID` CHECK constraint (won't fail on pre-existing violations, blocks all new ones). Verified by replaying all migrations into a fresh disposable Postgres DB and confirming by direct insert that the invalid case is rejected. Commit `ee123fd` |
| `server/src/services/email.ts` had **zero HTML escaping anywhere** — every email function interpolates caller-controlled strings (student/org/school/cohort names, custom messages, notes, org branding `brandColor`/`orgLogoUrl`/`emailSignature`) directly into HTML sent to real recipients, with no sanitizer. `brandColor` and `orgLogoUrl` are org-branding (Pro) fields reachable by any beneficiary/org admin, giving attribute-breakout HTML injection and a `javascript:`/arbitrary-scheme URL as an `<img src>`. Matches goal §13.1 exactly. | ✅ | Added `escapeHtml`/`escapeHtmlMultiline`/`sanitizeHexColor`/`sanitizeHttpUrl` helpers; applied across all ~25 email functions in the file (every dynamic text field escaped, `brandColor` restricted to `#hex` or falls back to default, `orgLogoUrl`/`requiredFormUrl`/CTA URLs restricted to http(s) or dropped). Verified with a real capture test (not just log-mode, which strips tags before logging and would pass trivially) — sends to a `@mailinator.com` address and inspects the actual captured HTML. Test: `emailHtmlEscaping.test.ts` |
| Seed script doesn't create `AuditLog` rows for seeded `VERIFIED` sessions | ⬜ | Cosmetic, test-data only — low priority, not yet fixed |

---

## Other audit docs — cross-checked against current code (2026-08-04)

A background research pass read every other security/QA markdown file in the
repo and verified each claim against current source (not just transcribed).
Full detail lives in this session's history; summary:

- **`docs/qa/SECURITY_AUDIT.md`** (2026-06-29): all 5 numbered findings checked.
  FINDING-001 (rate-limit bypass via unverified JWT decode) — fixed.
  FINDING-002 (wildcard CORS) — fixed. FINDING-003 (`IS_PROD_LIKE` drift) —
  now fully fixed (see above). FINDING-004 (dev-only test-email endpoint) —
  still open but low risk/intentionally dev-gated. FINDING-005 (NaN in
  `/directory/nearby` OFFSET) — still open, tracked above.
- **`docs/qa/FINAL_RELEASE_REPORT.md`** (2026-06-29): SEC-001 (Stripe fields
  leaked via beneficiary GET), SEC-002/003 (dupes of SECURITY_AUDIT
  FINDING-001/002), SEC-005 (Stripe webhook replay), SEC-006 (attachment
  download auth), DEFECT-001..005 (input validation, race conditions, JSON
  404s) — all fixed. SEC-004/SEC-009 are dupes of the two still-open items
  above.
- **`docs/qa/DATA_INTEGRITY_REPORT.md`** (2026-06-29): seeded-session audit
  gap and missing VERIFIED/checkOutTime constraint — both still open, tracked
  above; both are low severity.
- **`docs/qa/ACCESSIBILITY_REPORT.md`**: contrast and label findings (V-01,
  V-02, V-03, V-06) — fixed. V-04/V-05 (tab order, link-in-text-block) —
  unclear without a real browser check, not independently verified.
- **`docs/qa/PERFORMANCE_REPORT.md`**: route-level code splitting — fixed
  (`React.lazy()` used throughout `App.tsx`).
- **`docs/student-privacy-compliance.md`, `docs/canvas-production-readiness.md`,
  `integration_failures.md`, `qa_results.md`** (all Canvas-era, 2026-05-10/11):
  mostly marked resolved in the docs themselves and spot-checked as such.
  One unclear thread: a few profile-display reads (`googleAuth.ts:178`,
  `invitations.ts:213`, `auth.ts:327`) still read `user.cohortId` directly
  instead of the full `StudentCohortMembership` set — appears to be
  display-only, not an access-control path, but worth a closer look if
  reports/access paths get audited further.
- **`tests/qa-results.md`** (6000+ lines, repeated run history): skimmed, no
  new distinct issues found beyond the above. Some flaky-looking historical
  failures (school-settings tab/URL sync, nearby-directory partnership flow)
  look structurally fine in current code — most likely test timing, not a
  live bug, but unconfirmed without an actual browser run.
- **Skipped as pure paperwork/checklists, no code findings**:
  `docs/qa/PRODUCTION_CHECKLIST.md`, `docs/qa/PILOT_PLAN.md`,
  `docs/qa/MANUAL_FOUNDER_CHECKLIST.md`, `docs/qa/TEST_PLAN.md`,
  `docs/qa/ROLE_PERMISSION_MATRIX.md`, `docs/qa/STRIPE_TEST_REPORT.md`,
  `docs/qa/DEPENDENCY_ADVISORY_EXCEPTIONS.md`,
  `docs/qa/BACKUP_RESTORE_REPORT.md`, `docs/qa/REPOSITORY_AUDIT.md`,
  `docs/qa/EDGE_CASE_REPORT.md` (superseded by FINAL_RELEASE_REPORT fixes
  above).

---

## Goal sections not yet substantively started

These are large architectural sections from the `/goal` brief. A quick schema/code
scan (2026-08-03) found **no evidence of implementation** — each is effectively
a fresh multi-file project, not a bug fix:

| Section | What's required | Status |
|---|---|---|
| §7 Canonical event-time model | `startsAt`/`endsAt`/`timezone` UTC timestamps replacing date+time-string fields; server-derived duration; recurrence atomicity | ⬜ Not started — schema has no `startsAt`/`endsAt` fields |
| §8 Canonical participation state machine | Explicit `WAITLISTED→CONFIRMED→ATTENDED/NO_SHOW→...` lifecycle enforced centrally; batched attendance with audit | 🟡 Partial — `statusTransitions.test.ts` covers the existing `PENDING_CHECKIN→CHECKED_IN→CHECKED_OUT→VERIFIED/REJECTED` machine for sessions, but beneficiary-signup states (`WAITLISTED`/`NO_SHOW`) aren't unified with it |
| §9 Canonical service-hour ledger | Single auditable ledger record (student/school/program/category/approved minutes/approver/state) backing all totals, reports, exports | ⬜ Not started — no ledger model in `schema.prisma`; hours still computed from multiple sources (`hoursCalculator.ts`, beneficiary signups, legacy sessions) |
| §10 Bulk imports | Staged, idempotent import workflow (upload→validate→preview→commit) with import/row objects | ⬜ Not started — no `ImportBatch`/`ImportRow` models |
| §11 Reminder architecture | Durable job-based reminders (not request-triggered), reschedule-safe, retry/backoff, dedup | 🟡 Partial — `OrgReminderConfig`/`OrgEventReminderLog` exist; `reminderPolicy.test.ts`/`reminderConfigPolicy.test.ts` cover config validation, but no evidence of a durable job/worker queue with backoff |
| §12 Reports/metrics failure states | Reports must return `PARTIAL`/`UNAVAILABLE` rather than misleading zeros on partial data-source failure | ❓ Not assessed this session |
| §13 Email/messaging | Centralized HTML escaping (❓ partially — `security_findings.md` calls out unsanitized custom email HTML as a P2 item), transactional outbox (⬜ no outbox model found), bulk-messaging quotas (❓ not assessed) |
| §14 Files/uploads | Object storage migration, quotas, malware scanning, streaming, safe `Content-Disposition` | ❓ Not assessed — `signatureStorage.test.ts`/`signatureUploadArchitecture.test.ts`/`uploadAuthorizationArchitecture.test.ts` suggest *some* upload-auth hardening exists, but object-storage migration and malware scanning look unaddressed |
| §15 Client/server auth consistency | Single API client everywhere; no ad hoc `fetch` + manual token reads; HttpOnly cookie migration | ❓ Not assessed — bearer-token model still in use per `AuthProvider.tsx` |
| §16 Geocoding/directory search | Rate limits, TTL cache, pagination bounds, private-network blocking on geocoding endpoint | ❓ Not assessed |
| §17 Schema/DB integrity | Convert free-form status strings to enums, floating-point hours → integer minutes/Decimal, add constraints/indexes | ❓ Not assessed — spot check shows few `enum` blocks in schema beyond integration types; status fields likely still `String` |
| §18 Legacy architecture consolidation | Single canonical model for grouping/opportunities/signups/attendance/hours — freeze/remove legacy dual implementations | ❓ Not assessed |
| §19 Build/repo reproducibility | Single package manager/lockfile, pinned Node version, no committed `node_modules`/local DBs | ❓ Not assessed |

---

## Verification status (2026-08-04)

- `cd server && npx tsc --noEmit` → clean
- `cd client && npx tsc --noEmit` → clean
- `cd server && npm test` → **268 pass / 0 fail / 1 skipped** (269 total)
- `cd client && npx vite build` → succeeds
- `cd server && npx tsc` (full build) → succeeds
- `.env.example` / `server/.env.example` → placeholders only, no real secrets
- `.gitignore` → covers `.env*`, `node_modules`, `dist`, local DBs, uploads, test results

Not yet run this session: full E2E suite (`tests/*.spec.ts` — Playwright), migration replay against a fresh disposable Postgres, dependency/secret scan, lint.

---

## How to use this file

1. Before starting a new work session on this goal, read this file first — don't re-derive status from `git log`/`grep` every time.
2. When you fix or verify an item, move it to ✅ with a one-line evidence pointer (test name or file), and note the commit SHA.
3. When you start a big section (§7–§19), convert its ❓/⬜ row into a 🟡 with a short note on what's actually in flight, so a future session doesn't duplicate work.
4. Re-run the verification block above before closing out any session and update the numbers.
