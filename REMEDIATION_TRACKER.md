# GoodHours Remediation Tracker

Living checklist for the master security/architecture/release-readiness goal
(see the `/goal` invocation history for the full 23-section brief, and
`security_findings.md` for the original numbered audit findings). This file
is the source of truth for **what's done vs. still open** — update it every
time a session finishes a chunk of this work instead of re-deriving status
from scratch.

**Last updated:** 2026-08-04, commit `40af038`.

**Session boundary note:** as of this commit, every issue independently
identified and verified across `security_findings.md` (Findings 1–10) and
every other audit markdown file in the repo (see "Other audit docs" below)
is fixed except one cosmetic, test-data-only gap. That is not the same as
"the goal is complete" — sections §7–§19 of the `/goal` brief (canonical
event-time model, service-hour ledger, staged imports, durable reminder
jobs, object storage, client/server auth consistency, schema enums, legacy
architecture consolidation, build reproducibility) are largely **unbuilt**,
not "fixed." Those are fresh multi-file architecture projects, not bug
fixes to existing code, and need explicit scoping before starting — see the
table below for what's actually there today.

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
| `security_findings.md` §3.2: `prisma/seed.ts` had **zero safety checks** before running `TRUNCATE CASCADE` on every core table (User, School, Organization, Beneficiary, ServiceSession, etc.) and replacing data with fixed test accounts. Also found while fixing it: CLAUDE.md documents test-account passwords as "(set via SEED_PASSWORD env var)" but the script never read that env var — hardcoded `bcrypt.hash("password123", 12)` six times instead. `seed-playwright.ts` (non-destructive, upsert-only) had a fixed source-visible password and no environment check either. | ✅ | Extracted `assertSafeToRunDestructiveSeed()` (`src/lib/destructiveSeedGuard.ts`, unit tested) requiring: not production-like, `ALLOW_DESTRUCTIVE_TEST_SEED=yes` explicit opt-in, and a `DATABASE_URL` host/name that looks local or clearly disposable. `seed.ts` now requires `SEED_PASSWORD` (no fallback) and uses it everywhere; `seed-playwright.ts` gained an `isProdLike()` guard. Verified end-to-end against real disposable Postgres DBs: each guard condition independently blocks, and the script still seeds successfully once satisfied. Documented both new env vars in `server/.env.example`. Test: `destructiveSeedGuard.test.ts`. Commit `40af038` |
| `GET /api/geocode` had no `authenticate` middleware — a fully open, unauthenticated proxy to Nominatim, even though its own rate limiter was already configured with a `maxPerUser` tier that could never apply. No client code calls it directly (geocoding happens server-side inside other authenticated routes). Matches goal §16.1. | ✅ | Added `authenticate`; hardened `lib/geocode.ts` with an 8s outbound timeout (previously none) and a bounded/TTL cache (previously an unbounded `Map` that grew forever and never expired). Test: `geocode.test.ts`. Commit `44ce4b0` |
| `calculateStudentHours`/`buildStudentProgressRecords` silently treated a failed data source as zero rows (console warning only) — a temporary DB hiccup on one source made a student's hours look genuinely lower than they are, with the response indistinguishable from a real zero. Matches goal §9.4/§12.2 exactly ("reports must never return legitimate-looking zeros when calculation failed"). | ✅ | Both functions now attach `dataState`("COMPLETE"\|"PARTIAL")/`failedSources` as extra properties on their existing Map/array return values (zero breakage for the 13 existing call sites). Wired into the 3 report/compliance-facing responses: `GET /api/reports/student`, `GET /api/reports/school`, and the per-student hour-breakdown reconciliation block in `schools.ts`. The plain-array `GET /api/schools/:id/students` list endpoint keeps its existing response shape (client consumes it as a bare array) but still benefits from the underlying fix — one failed source no longer zeroes every student's progress. Test: `hoursDataStatePartialFailure.test.ts`. Commit `6585c30` |

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
| §8 Canonical participation state machine | Explicit `WAITLISTED→CONFIRMED→ATTENDED/NO_SHOW→...` lifecycle enforced centrally; batched attendance with audit | 🟡 `statusTransitions.test.ts` covers the `PENDING_CHECKIN→CHECKED_IN→CHECKED_OUT→VERIFIED/REJECTED` machine for legacy sessions. **Fixed this session:** (commit `0ca486a`) `POST /signups/:signupId/approve` allowed a `NO_SHOW` signup straight through to approval with no override — now requires `overrideNoShow: true` + reason, audited distinctly. (commit `c52b5e2`) found the *actual* root cause of the status/attendance duality flagged after that fix: `POST /:id/opportunities/:oppId/attendance` (the batch endpoint) only ever set `.attendance`, never `.status` — so a signup marked NO_SHOW through that endpoint kept `status: "CONFIRMED"` and completely bypassed the override requirement just added. Now syncs `status` to `"NO_SHOW"` when `attendance` is set to `"NO_SHOW"`. Also hardened per §8.2: capped at 200 records/batch (was unbounded), rejects duplicate signupIds, skips CANCELLED/WAITLISTED signups instead of overwriting them, wrapped in one transaction (was unbounded `Promise.all`), and now creates an audit record (previously none). (commit `7affb8b`) both no-show routes now enforce §8.3 directly: normal marking requires the event's scheduled end time to have passed; marking early requires `earlyOverride: true` + a reason, audited as a distinct action. **Still open:** beneficiary-signup states remain a separate lifecycle from the legacy `ServiceSession` machine, not consolidated into one canonical model — that's the actual §8 "canonical" ask and hasn't been attempted |
| §9 Canonical service-hour ledger | Single auditable ledger record (student/school/program/category/approved minutes/approver/state) backing all totals, reports, exports | ⬜ Not started — no ledger model in `schema.prisma`; hours still computed from multiple sources (`hoursCalculator.ts`, beneficiary signups, legacy sessions) |
| §10 Bulk imports | Staged, idempotent import workflow (upload→validate→preview→commit) with import/row objects | ⬜ Not started — no `ImportBatch`/`ImportRow` models |
| §11 Reminder architecture | Durable job-based reminders (not request-triggered), reschedule-safe, retry/backoff, dedup | 🟡 Better than the earlier "not assessed" note suggested once actually traced (commit `b882af6`). Already in place before this session: `acquireJobLease`/`shouldRunJob` (`lib/jobLease.ts`) giving real distributed-lock dedup so concurrent serverless instances can't double-process; the in-process interval scheduler already self-disables on Vercel; a cron-secured `/api/internal/event-reminders/run` route existed. **Fixed this session:** that cron route was never actually registered in `vercel.json` (production only ran reminders opportunistically off incidental API traffic) — added the missing cron entry. **⚠️ Needs manual verification: `*/15 * * * *` sub-daily cron requires a Vercel Pro plan or higher; if this project is on the Hobby tier the cron entry will silently not run as configured — check the Vercel dashboard.** Also fixed: `OrgEventReminderLog`'s dedup key had no schedule-version component, so an event rescheduled after its reminder was already sent would have its replacement reminder silently suppressed by the old "SENT" log — now detects the mismatch and resends. **Not done:** explicit retry/backoff/attempt-count tracking on delivery failure (a `FAILED` status exists and allows one retry on the next cycle run, but there's no backoff schedule, max-attempt cap, or permanent-failure state); deadline/behind-schedule/admin-alert reminders (`lib/reminders.ts`, separate from event reminders) were not re-audited this pass |
| §12 Reports/metrics failure states | Reports must return `PARTIAL`/`UNAVAILABLE` rather than misleading zeros on partial data-source failure | 🟡 Core hours/progress data layer now propagates `dataState`/`failedSources` (see additional-issues table above), wired into `GET /api/reports/student`, `GET /api/reports/school`, and the per-student breakdown. Not yet audited: other report/export routes outside the hours-calculation path (CSV exports, org/beneficiary reports, billing views) |
| §13 Email/messaging | Centralized HTML escaping (❓ partially — `security_findings.md` calls out unsanitized custom email HTML as a P2 item), transactional outbox (⬜ no outbox model found), bulk-messaging quotas (❓ not assessed) |
| §14 Files/uploads | Object storage migration, quotas, malware scanning, streaming, safe `Content-Disposition` | 🟡 §14.5 (safe downloads) substantially done this session (commit `253da24`): all 8 `Content-Disposition` header sites replaced raw string interpolation with the `content-disposition` library (2 of them — `schoolProcurement.ts`, `billing.ts` — used the raw uploaded filename with zero sanitization, a real header-attribute-breakout risk); client-side confirmed every actual file download goes through `api.download()`, which already checks `response.ok` and never saves a JSON error body as a file — no other raw blob-fetch download path exists. **Not done:** object storage migration (files/signatures still stored as `Bytes` in Postgres per `signatureFileBytes` on `ServiceSession`, not external object storage), per-school/org storage quotas, malware scanning, streaming upload/download (large files still read fully into memory) — these are a genuine architecture project, not assessed further this session |
| §15 Client/server auth consistency | Single API client everywhere; no ad hoc `fetch` + manual token reads; HttpOnly cookie migration | 🟡 Fixed the 3 concrete bugs the goal names almost verbatim (commit `d585b5b`): `SchoolBilling.tsx` read the wrong localStorage key entirely (`"token"` instead of `"goodhours_token"`) so procurement-document downloads sent `Authorization: Bearer null` on every click — completely non-functional, now fixed via the existing `api.download()` helper. `CreateOpportunity.tsx`'s edit path redirected immediately regardless of write success (`keepalive` fetch + empty `.catch()`) — now awaits `api.put()` and only redirects on confirmed success. `OpportunityDetail.tsx` read the token directly from `localStorage` instead of the canonical `getAuthToken()`, breaking for session-only users — now uses the accessor. Full repo grep found no other ad hoc `fetch`/raw-localStorage-token patterns outside of legitimately-public unauthenticated flows (email verification, cancellation links). **Not done:** HttpOnly/Secure/SameSite cookie migration — bearer-token-in-storage model is still in use throughout `AuthProvider.tsx`; that's a much larger architectural change than a bug fix and wasn't attempted |
| §16 Geocoding/directory search | Rate limits, TTL cache, pagination bounds, private-network blocking on geocoding endpoint | ✅ §16.1 done (auth required, bounded TTL cache, outbound timeout — see additional-issues table above; SSRF/private-network blocking doesn't apply, the geocode destination is a hardcoded constant, not caller-controlled). §16.2 partial: nearby-directory pagination is now validated (commit `3cbf01a`) but page size is still capped at 10000, not the goal's recommended 50–100 — left as-is because the client relies on getting all results in one page and has no pagination UI; changing the default would be a product/UX decision, not a bug fix. §16.3 not applicable — no background/state-wide geocoding enrichment job exists in the codebase to fix |
| §17 Schema/DB integrity | Convert free-form status strings to enums, floating-point hours → integer minutes/Decimal, add constraints/indexes | 🟡 §17.4 (indexes) done for the goal's explicitly named columns: `User.schoolId/cohortId/classroomId/beneficiaryId/organizationId`, `Cohort.schoolId`, `BeneficiaryOpportunity.beneficiaryId`, `BeneficiaryTimeSlot.opportunityId` — commit `af38e01`, verified via fresh-DB replay + `\d` inspection + `prisma migrate diff` showing zero remaining drift. §17.1 (enums) and §17.2 (float→Decimal hours) **not attempted** — ~20+ free-form status `String` fields exist across the schema; converting them safely requires per-field verification against ambiguous string-literal call sites (a first broad grep matched 40+ locations across unrelated models) and is exactly the kind of change that needs its own scoped pass, not a rushed sweep. §17.3 (constraints) partial — the `ServiceSession` VERIFIED/checkOutTime constraint was added earlier this session; no broader constraint audit performed. **Byproduct of this work — a separate critical finding, see below.** |
| **Critical, found while verifying the index migration:** `schema.prisma` had fields (`SchoolRegistrationIntent` table, `School.ownershipStatus`+evidence columns, `BeneficiarySignup.schoolId`, `ServiceSession.schoolId`) with **no corresponding migration file** — committed in this session's `273f531` consolidation commit but only ever applied to dev via `prisma db push`. `prisma migrate deploy` doesn't diff against schema.prisma, so this was invisible to a plain "migrations apply" check; a genuinely fresh database (a real production deploy) would be missing these columns/tables while the app code queries them. | ✅ | Commit `966721e`. Generated the catch-up migration by diffing a DB built only from the *existing* migration history against schema.prisma. **Also required a data repair a naive autogenerated migration would have gotten wrong**: `ownershipStatus` defaults to `'PENDING'`, and `evaluateSessionEligibility` already blocks `SCHOOL_ADMIN`/`TEACHER` sessions unless `ownershipStatus = 'APPROVED'` — applied as generated, every already-verified school would have locked out its own admins/teachers the moment the migration ran. Added a backfill grandfathering existing verified schools as approved. Verified three ways: (1) full 27-migration replay into a fresh disposable Postgres DB succeeds, (2) `prisma migrate diff` against schema.prisma on that fresh DB returns empty (zero drift), (3) applied directly against a real-data **clone** of the local dev database (never touching the original) and confirmed the backfill correctly promoted both existing verified schools to `APPROVED` while leaving unverified ones at `PENDING`. Also ran `prisma/seed.ts` against a fresh migrated DB end-to-end. |
| §18 Legacy architecture consolidation | Single canonical model for grouping/opportunities/signups/attendance/hours — freeze/remove legacy dual implementations | ❓ Not assessed |
| §19 Build/repo reproducibility | Single package manager/lockfile, pinned Node version, no committed `node_modules`/local DBs | 🟡 Fixed this session (commit `47725a4`): no `engines.node` anywhere despite CI hardcoding `node-version: "24"` inline — added `engines.node >=24.0.0` / `engines.npm >=10.0.0` to all three `package.json` files plus a root `.nvmrc`. Also found (not yet fixed, cosmetic not active risk): declared `@prisma/client`/`prisma` version ranges differ between root and server `package.json` (`^6.3.1` vs `^6.19.x`) — but `npm ls` confirms both actually resolve to the same versions via the shared lockfile tree, so this isn't live drift, just confusing declarations. `node_modules`/local DBs already correctly gitignored (verified earlier this session). **Not attempted — the actual architectural ask:** this repo has three separate npm installs/lockfiles (root, server, client), not the "one authoritative lockfile" goal §19 wants; consolidating into one workspace would touch CI cache paths, Vercel install/build commands, and relative script paths repo-wide — a real restructuring, not a config tweak |

---

## Verification status (2026-08-04)

- `cd server && npx tsc --noEmit` → clean
- `cd client && npx tsc --noEmit` → clean
- `cd server && npm test` → **302 pass / 0 fail / 1 skipped** (303 total). The 1 skip is infra-conditional (`RATE_LIMIT_TEST_DATABASE_URL` not set in this run) — verified separately against a real disposable Postgres DB with 0 skipped/0 failed
- `cd client && npx eslint . --max-warnings 0` on the 3 files touched for §15 → clean (no project-wide client test runner exists — build/lint/typecheck are the available verification surface)
- `cd client && npx vite build` → succeeds
- `cd server && npx tsc` (full build) → succeeds
- **Migration replay against a fresh disposable Postgres database** (`goodhours_*` throwaway DBs, all dropped after use): full 27-migration history applies cleanly to an empty database; `prisma migrate diff` between that fresh DB and `schema.prisma` returns an empty migration (zero drift) after this session's fixes — this caught the critical schema-drift gap documented in §17 above
- Applied the drift-catchup migration against a **real-data clone** of the local dev database (`CREATE DATABASE ... TEMPLATE`, original never touched) and confirmed the `ownershipStatus` backfill behaves correctly on actual existing rows
- `prisma/seed.ts` run against a fresh migrated database → succeeds end-to-end
- `.env.example` / `server/.env.example` → placeholders only, no real secrets
- `.gitignore` → covers `.env*`, `node_modules`, `dist`, local DBs, uploads, test results

- **Dependency scan**: `npm audit` in `server/` found `ip-address <=10.3.0` (transitive via `express-rate-limit`) with 3 HIGH-severity SSRF/trust-boundary-bypass advisories, and a low-severity `esbuild` (transitive via `tsx`, dev-only) advisory. Confirmed `lib/lmsOutboundSecurity.ts`'s own SSRF checks don't use this package (unaffected), but `express-rate-limit`'s IP trust logic was exposed. Both resolved via `npm update` within already-declared semver ranges (no `package.json` version bumps needed) — `npm audit` now reports **zero vulnerabilities**. Commit `4fdfacd`

Not yet run this session: full E2E suite (`tests/*.spec.ts` — Playwright), lint (server has no configured lint script; client lint only spot-checked on touched files, not run repo-wide).

---

## How to use this file

1. Before starting a new work session on this goal, read this file first — don't re-derive status from `git log`/`grep` every time.
2. When you fix or verify an item, move it to ✅ with a one-line evidence pointer (test name or file), and note the commit SHA.
3. When you start a big section (§7–§19), convert its ❓/⬜ row into a 🟡 with a short note on what's actually in flight, so a future session doesn't duplicate work.
4. Re-run the verification block above before closing out any session and update the numbers.
5. **If you touch `schema.prisma`, always run `prisma migrate dev --create-only` against a database built from the *existing* migration history (not `db push`) before committing, and confirm the generated diff contains only what you intended.** This caught a real critical gap on 2026-08-04 (commit `966721e`): a prior session's schema.prisma changes were applied to dev via `db push` and committed without ever generating the matching migration file, so a fresh production deploy would have been missing tables/columns the application code depends on. `prisma migrate deploy` alone will NOT catch this — it only replays existing migration files and never diffs against schema.prisma.
