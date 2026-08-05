# GoodHours Remediation Tracker

Living checklist for the master security/architecture/release-readiness goal
(see the `/goal` invocation history for the full 23-section brief, and
`security_findings.md` for the original numbered audit findings). This file
is the source of truth for **what's done vs. still open** — update it every
time a session finishes a chunk of this work instead of re-deriving status
from scratch.

**Last updated:** 2026-08-04, commit `03ef4b4`.

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
| 6 | Beneficiary signup list leaks real student names/IDs and cancellation capability to partners | ✅ | `pseudonymousStudentLabel` used in `beneficiaries.ts` signup responses; DTO trimmed to non-identifying fields. **Found while pattern-auditing for dead code this session**: there's a `School.ferpaBeneficiaryPiiEnabled` schema field (`@default(false)`, comment: "when true, student names are shared with beneficiary admins") and a matching helper, `isBeneficiaryPiiEnabled(beneficiaryId)` in `beneficiaries.ts`, that reads it — but the helper is never called anywhere, the field is never written by any route, and there's no client UI for it at all. The single place that decides real-name-vs-pseudonym (`beneficiaries.ts:3126`) branches only on `actor.role === "BENEFICIARY_ADMIN"`, never consulting this flag. **Not a live vulnerability** — the actual behavior (always pseudonymize for beneficiary admins) is the safe default, strictly more protective than what the half-built opt-in feature would have allowed — but it is a genuinely orphaned, three-layer-deep incomplete feature (schema + doc comment + helper function, all unreachable) representing a real product/privacy decision (should schools be able to opt in to sharing real student names with approved beneficiary partners, and under what governance?) that I'm not making unilaterally. Left as-is; flagging for explicit product scoping rather than either silently completing (a privacy-relevant behavior change) or silently deleting (could destroy intentional half-finished work) it. |
| 7 | Accepted beneficiary invitation token remains reusable as a login credential | ✅ | All invitation accept branches now return "already accepted"/409, no session-minting on repeat use — verified across `invitations.ts` |
| 8 | Public `GET /cancel/:token` mutates state (cancels signup, promotes waitlist) — scanner/crawler-triggerable | ✅ | Fixed 2026-08-03 (commit `e5651f5`): split into non-mutating GET + confirming POST; added missing client page `CancelSignup.tsx` (email link pointed at a route that never existed); audit now records actor as a bearer-link capability, not an authenticated student action. Test: `beneficiaryCancellationLink.integration.test.ts` |
| 9 | FERPA `dataAccessLog` write is fail-open (swallows errors, response still returns real data); audit details duplicate student PII | ✅ | Fixed 2026-08-04 (commit `8db748a`): `logDataAccess` no longer swallows write errors — every caller already awaits it before `res.json`, so a failed audit write now correctly 500s via the route's existing catch block. `summarizeStudentSubjects` no longer stores raw student names/emails; stores only a count + keyed HMAC digest of the subject-ID set. Test: `dataAccessLogFailClosed.test.ts` |
| 10 | LMS sync pulls every course/roster visible to the connected identity — no course allowlist before fetching identities | ✅ | `selectedExternalCourseIds` present in `canvasIntegration.ts` config/sync path |

## Additional issues found this session (2026-08-04, not in the original 10)

| Issue | Status | Evidence |
|---|---|---|
| `IS_PROD_LIKE` duplicated independently in 7 files; `routes/schools.ts`'s copy tested only `NODE_ENV`/`VERCEL_ENV` and missed `APP_ENV`, so an `APP_ENV`-only production config would leak a newly created teacher's temp password in the create-staff API response | ✅ | Centralized into `server/src/lib/isProdLike.ts` (deliberately NOT `env.ts`, which runs `process.exit(1)` at import time and would break any lightweight importer). All 7 files now import it. Test: `isProdLike.test.ts`. Commit `273f531`. **Follow-up, found later this session**: a repo-wide sweep for the same anti-pattern found 2 more files the original "7 files" centralization missed — `routes/internal.ts` (gated whether 5 internal cron endpoints require `CRON_SECRET` to be configured; a defense-in-depth policy gap, not an auth bypass, since `hasValidSchedulerAuth()` independently required valid scheduler auth regardless) and, **more seriously, `lib/fieldEncryption.ts`** (gated whether a missing/malformed `FIELD_ENCRYPTION_KEY` throws at startup or silently falls through to storing PII — specifically phone numbers, per `routes/auth.ts` — in **plaintext** with only a console warning; an `APP_ENV`-only production deployment without the key configured would have silently stored phone numbers unencrypted). Both fixed (commit `c356372`) by importing the canonical module. Added a repo-wide architecture test (`isProdLikeNoDuplicateDefinitions.test.ts`) scanning every route/lib/service file for a local `function isProdLike` definition, so this exact class of drift can't silently reoccur in any future file — the narrower existing tests only covered the specific sites already known at the time they were written. |
| `beneficiaries.ts:527-529` — `page`/`limit` on `GET /directory/nearby` not validated before use in a raw-SQL `OFFSET`; non-numeric input → `NaN` → 500 | ✅ | Fixed: rejects non-integer/out-of-range page or limit with 400 before building the query. Test: `beneficiaryDirectoryNearbyPagination.test.ts`. Commit `3cbf01a` |
| No DB-level `CHECK` constraint preventing `ServiceSession.status = 'VERIFIED'` with a null `checkOutTime` | ✅ | Migration `20260804153210_service_session_verified_requires_checkout` adds a `NOT VALID` CHECK constraint (won't fail on pre-existing violations, blocks all new ones). Verified by replaying all migrations into a fresh disposable Postgres DB and confirming by direct insert that the invalid case is rejected. Commit `ee123fd` |
| `server/src/services/email.ts` had **zero HTML escaping anywhere** — every email function interpolates caller-controlled strings (student/org/school/cohort names, custom messages, notes, org branding `brandColor`/`orgLogoUrl`/`emailSignature`) directly into HTML sent to real recipients, with no sanitizer. `brandColor` and `orgLogoUrl` are org-branding (Pro) fields reachable by any beneficiary/org admin, giving attribute-breakout HTML injection and a `javascript:`/arbitrary-scheme URL as an `<img src>`. Matches goal §13.1 exactly. | ✅ | Added `escapeHtml`/`escapeHtmlMultiline`/`sanitizeHexColor`/`sanitizeHttpUrl` helpers; applied across all ~25 email functions in the file (every dynamic text field escaped, `brandColor` restricted to `#hex` or falls back to default, `orgLogoUrl`/`requiredFormUrl`/CTA URLs restricted to http(s) or dropped). Verified with a real capture test (not just log-mode, which strips tags before logging and would pass trivially) — sends to a `@mailinator.com` address and inspects the actual captured HTML. Test: `emailHtmlEscaping.test.ts` |
| Seed script doesn't create `AuditLog` rows for seeded `VERIFIED` sessions | ✅ | Cosmetic, test-data only — but genuinely a real gap (every seeded VERIFIED session was indistinguishable from one with no approval trail). Fixed: each of the 4 `serviceSession.create` call sites that seed `status: "VERIFIED"` now also creates a matching `AuditLog` row (`action: "APPROVE"`, matching `actorId`/`sessionId`/`details` shape used by the real `POST /verification/:sessionId/approve` route). Verified by running `prisma/seed.ts` end-to-end against a real disposable Postgres DB and querying for orphaned VERIFIED sessions — none found. |
| `security_findings.md` §3.2: `prisma/seed.ts` had **zero safety checks** before running `TRUNCATE CASCADE` on every core table (User, School, Organization, Beneficiary, ServiceSession, etc.) and replacing data with fixed test accounts. Also found while fixing it: CLAUDE.md documents test-account passwords as "(set via SEED_PASSWORD env var)" but the script never read that env var — hardcoded `bcrypt.hash("password123", 12)` six times instead. `seed-playwright.ts` (non-destructive, upsert-only) had a fixed source-visible password and no environment check either. | ✅ | Extracted `assertSafeToRunDestructiveSeed()` (`src/lib/destructiveSeedGuard.ts`, unit tested) requiring: not production-like, `ALLOW_DESTRUCTIVE_TEST_SEED=yes` explicit opt-in, and a `DATABASE_URL` host/name that looks local or clearly disposable. `seed.ts` now requires `SEED_PASSWORD` (no fallback) and uses it everywhere; `seed-playwright.ts` gained an `isProdLike()` guard. Verified end-to-end against real disposable Postgres DBs: each guard condition independently blocks, and the script still seeds successfully once satisfied. Documented both new env vars in `server/.env.example`. Test: `destructiveSeedGuard.test.ts`. Commit `40af038` |
| `GET /api/geocode` had no `authenticate` middleware — a fully open, unauthenticated proxy to Nominatim, even though its own rate limiter was already configured with a `maxPerUser` tier that could never apply. No client code calls it directly (geocoding happens server-side inside other authenticated routes). Matches goal §16.1. | ✅ | Added `authenticate`; hardened `lib/geocode.ts` with an 8s outbound timeout (previously none) and a bounded/TTL cache (previously an unbounded `Map` that grew forever and never expired). Test: `geocode.test.ts`. Commit `44ce4b0` |
| `calculateStudentHours`/`buildStudentProgressRecords` silently treated a failed data source as zero rows (console warning only) — a temporary DB hiccup on one source made a student's hours look genuinely lower than they are, with the response indistinguishable from a real zero. Matches goal §9.4/§12.2 exactly ("reports must never return legitimate-looking zeros when calculation failed"). | ✅ | Both functions now attach `dataState`("COMPLETE"\|"PARTIAL")/`failedSources` as extra properties on their existing Map/array return values (zero breakage for the 13 existing call sites). Wired into the 3 report/compliance-facing responses: `GET /api/reports/student`, `GET /api/reports/school`, and the per-student hour-breakdown reconciliation block in `schools.ts`. The plain-array `GET /api/schools/:id/students` list endpoint keeps its existing response shape (client consumes it as a bare array) but still benefits from the underlying fix — one failed source no longer zeroes every student's progress. Test: `hoursDataStatePartialFailure.test.ts`. Commit `6585c30` |
| **Critical:** `isProdLike()` only excludes `VERCEL_ENV=production`, not `"preview"` — every dev-only bypass gated by `!isProdLike()` was reachable on any public Vercel preview deployment URL, not just a developer's own machine. Directly violates goal §4.5's explicit "impossible to enable on public preview or staging deployments." Found 5 instances of the same root cause: `POST /api/auth/impersonate` + `/dev/bypass-email-verification` (any `SCHOOL_ADMIN` could impersonate any user/role/school without a password, if `ENABLE_IMPERSONATION=true` were ever set on a preview env), `isInternalAdminUser()`'s local fallback (every `SCHOOL_ADMIN` silently became an internal operator on preview), `GET /__test-email` (unauthenticated inbox reader), and the `LMS_ALLOW_TEST_ORIGINS`/Google-Classroom-custom-origin escape hatches (could bypass this session's own SSRF protections on preview). | ✅ | Added `isPubliclyDeployed()` (`isProdLike() \|\| VERCEL_ENV === "preview"`) and switched all 5 call sites to it. Left `isProdLike()` and the Canvas/Google-Classroom mock-mode defaults unchanged — defaulting to mock data on preview is safe, not a bypass. 11 new tests: unit coverage for the environment matrix + an architecture test that fails if any of the 5 sites regresses back to `isProdLike()`. Commit `f82d200` |
| `routes/auth.ts` had a dead (never-called) function, `isInteractiveSignupRequest`, checking `origin.includes("goodhours.app")` — broader than even the SEC-003 wildcard-subdomain CORS bug (`.endsWith(".goodhours.app")`), matching any Origin containing that substring anywhere (`https://evil-goodhours.app.attacker.com`, `https://attacker.com/?x=goodhours.app`). Found while auditing for other instances of the SEC-003 bug shape. | ✅ | Confirmed via repo-wide grep the function was never called (its sibling `signupRateLimitChannel`, defined right above it, is live and used) — deleted the dead function entirely rather than fixing in place, removing both the unreachable code and the latent bug together. Added an architecture test scanning server source for the same substring-origin-matching shape so it can't quietly reappear. Commit `5b5e889` |
| `listCanvasPages`/`listGoogleClassroomPages` — old pagination helpers with no token-refresh handling, superseded by `...ForConnection` siblings that add 401/403 refresh-and-retry, but never removed. Found via a repo-wide dead-function sweep. | ✅ | Confirmed unused anywhere via grep; deleted both, confirmed their shared helpers (`parseCanvasLinkHeader`, `GoogleClassroomApiPage`) remain used by the surviving code. Commit `4426f22` |
| `School.ferpaBeneficiaryPiiEnabled` (schema field + doc comment: "when true, student names are shared with beneficiary admins") and its reader `isBeneficiaryPiiEnabled()` in `beneficiaries.ts` are both orphaned — never called, never written by any route, no client UI. The real-name-vs-pseudonym decision (`beneficiaries.ts:3126`) never consults this flag. Found via the same dead-function sweep. | ❓ | **Not fixed — flagged for product scoping, not a live vulnerability.** Current behavior (always pseudonymize for beneficiary admins) is the safe default, strictly more protective than the half-built opt-in feature would allow. Completing it (wiring the flag into the decision + adding a settings UI) is a real privacy/product decision about whether schools should be able to share real student names with approved beneficiary partners; deleting it could destroy intentional half-finished work. Left as-is pending explicit scoping. |
| `User.isTestAccount` (schema field + doc comment: "hidden from all lists") is written by both LMS integration services (Canvas/Google Classroom sync test-account creation) but was never read/filtered anywhere — QA/Playwright fixture students would appear mixed into real staff-facing rosters, reports, and messaging audiences. Found via the same dead-field sweep. | ✅ | **Fully fixed — every `role: "STUDENT"` list/roster/cron query site in `server/src` now excludes test accounts.** Commit `58876ec` added `isTestAccount: false` to `buildCohortScopedStudentWhere()` (`lib/cohortAccess.ts`), the central cohort-scoping helper 6 route files build their staff-facing student queries from. Commit `f77293f` found and fixed 6 more sites in `routes/*.ts` that build their `where` clause independently of that helper: `cohorts.ts:345` (`loadCohortSummaries`), `cohorts.ts:849` (`GET /:id` cohort roster), `classrooms.ts:94` (classroom roster), and 3 in `schools.ts` (`buildCategoryCapWarningsForSchool`, `GET /:id/export`, `GET /:id/students/at-risk`). Considered deduplicating these onto the shared helper, but its `isSchoolAdmin` branch filters on `User.schoolId` directly while these bespoke clauses match via the `Cohort.schoolId`/`Classroom.schoolId` relation — real dev-DB data showed the 3 canonical seeded students have `schoolId` set but no cohort assignment at all, so behavioral equivalence between the two filter shapes couldn't be confirmed. Applied the minimal, risk-free fix instead: added `isTestAccount: false` directly to each bespoke `where` clause without touching its existing cohort-matching logic. Commit `34e4c1d` then found 2 more sites the route-only sweep missed, in `server/src/lib/`: `lib/reminders.ts`'s `runSchoolReminderCycle` — a background cron, not a display list — was missing the exclusion on both its deadline/at-risk student roster and its pending-review-count student lookup, meaning test accounts would actually receive real reminder emails and inflate admin-facing pending-review alert counts (more severe than the read-only bugs, since it's side-effecting); and `lib/launchCenter.ts`'s `buildLaunchWorkspace` (school onboarding dashboard) had the same gap. Also added the exclusion to 3 defensive `scope ? buildCohortScopedStudentWhere(scope) : { OR: [...] }` fallback branches (`reports.ts`, `schools.ts` ×2) that skip the helper when `scope` is unexpectedly null — currently unreachable given the routes' existing guards, but cheap and correctness-preserving to fix anyway. Confirmed via a final repo-wide grep that every remaining `role: "STUDENT"` site is either now covered or correctly out of scope: the Canvas/Google Classroom sync services' `role: "STUDENT"` lookups are identity-matching (find-by-external-ID-or-email during roster sync), not list filtering, and `invitations.ts`'s is a `user.create()` data object. Tests: `testAccountExclusionBespokeQueries.test.ts` (5 tests), `testAccountExclusionCronAndDashboards.test.ts` (2 tests) — each asserts the captured Prisma `where` clause passed to `user.findMany` includes `isTestAccount: false`. |

---

## security_findings.md: full read-through complete (2026-08-04)

As of this session, every section of `security_findings.md` (§1 threat model,
§2 the 10 numbered findings, §3 attack surface expansion, §4 hardening/
verification plan, §5 student security, §6 SIS/procurement compliance) has
been read and checked against current code — not just the numbered findings.
Notes from §3–§6:

- **§3.2 (insecure seed defaults)** — was genuinely unfixed; closed this
  session (see additional-issues table above, commit `40af038`).
- **§4 Criterion 2's exact SQL invariant** (`StudentCohortMembership` rows
  where the student's school ≠ the cohort's school) was run directly against
  the real dev database. Found **one** violating row — a Playwright test
  fixture (`isTestAccount: true`) whose `schoolId` is `NULL` (not a
  different school), predating `ensureStudentCohortMembership`'s write-time
  enforcement (Finding 4, already fixed and tested in
  `studentCohortsSecurity.test.ts`). Confirmed this is stale QA data, not a
  live bypass — the enforcement blocks this exact case for any new write.
  Not cleaned up (test-data hygiene in a QA-only database, not a security
  fix).
- **§4 Criterion 4's "audit-write failure → 503"**: the fail-closed fix
  (Finding 9, commit `8db748a`) returns `500` via each route's existing
  generic catch block, not a dedicated `503`. The security property the
  criterion cares about — no student data is released on audit-write
  failure — is satisfied and tested; the specific status code is a minor,
  optional refinement, not fixed.
- **§5 "Parent access" bearer links** — already securely disabled
  (`POST /reports/parent-link` and `GET /reports/parent-progress` both
  return a fixed 403 with no token logic reachable at all), matching the
  goal's "disable until redesigned" directive. Nothing to fix.
- **§3 (rest), §4 (rest), §5.3–§5.4, §6 entirely** — MFA/SSO/SCIM enforcement,
  malware scanning, SBOM, penetration testing, DPAs, VPAT/ACR, SOC 2,
  incident response plans, backup/DR testing, subprocessor governance,
  insurance certificates, and similar — these are organizational/legal/
  compliance evidence, not code. No code-level fix applies; out of scope per
  this goal's own instruction to work from evidence in the code, not produce
  paperwork.

---

## Other audit docs — cross-checked against current code (2026-08-04)

A background research pass read every other security/QA markdown file in the
repo and verified each claim against current source (not just transcribed).
Full detail lives in this session's history; summary:

- **`docs/qa/SECURITY_AUDIT.md`** (2026-06-29): all 5 numbered findings checked.
  FINDING-001 (rate-limit bypass via unverified JWT decode) — fixed.
  FINDING-002 (wildcard CORS) — fixed. FINDING-003 (`IS_PROD_LIKE` drift) —
  now fully fixed (see above). FINDING-004 (dev-only test-email endpoint) —
  **corrected 2026-08-04: already fixed**, not open — `routes/auth.ts`'s
  `/__test-email` route is gated behind `!isPubliclyDeployed()` (part of the
  `isPubliclyDeployed()` fix above), confirmed by direct code read.
  FINDING-005 (NaN in `/directory/nearby` OFFSET) — **corrected 2026-08-04:
  already fixed** (commit `3cbf01a`, see additional-issues table above); this
  bullet's earlier "still open" note was stale documentation, not a live bug
  — confirmed by direct code read of `beneficiaries.ts`'s `/directory/nearby`
  handler, which already rejects non-integer/out-of-range `page`/`limit`.
- **`docs/qa/FINAL_RELEASE_REPORT.md`** (2026-06-29): SEC-001 (Stripe fields
  leaked via beneficiary GET), SEC-002/003 (dupes of SECURITY_AUDIT
  FINDING-001/002), SEC-005 (Stripe webhook replay), SEC-006 (attachment
  download auth) — fixed. DEFECT-001..005 — see the corrected
  `EDGE_CASE_REPORT.md` entry below (2 of the 5 turned out only partially
  fixed, now fully fixed as of commit `a5ffdb5`). SEC-004/SEC-009 are dupes
  of the two SECURITY_AUDIT items above, both confirmed fixed. **The
  report's own "Remaining Open Findings (Non-Blocking)" section — SEC-007
  through SEC-010, never previously individually cross-checked in this
  tracker — verified this session, one by one**: SEC-007 (no JWT
  revocation mechanism) — fixed, `User.tokenVersion` is bumped on password
  change/reset and checked on every request (`middleware/auth.ts`),
  exactly the remediation the report itself suggests. SEC-008
  (`/__test-email` reachable without auth in non-prod) — fixed, and more
  robustly than the report's suggested fix: the route is not registered at
  all (not just auth-gated) whenever `isPubliclyDeployed()` is true,
  confirmed by reading the `if (!isPubliclyDeployed()) { router.get(...) }`
  wrapper in `auth.ts`. SEC-009 — already covered above (dupe). SEC-010
  (no server-side MIME sniffing on uploads) — still true, but remains
  legitimately accepted-risk exactly as the report itself already argued:
  confirmed uploaded files are still stored under a UUID filename with no
  extension (`crypto.randomUUID()` in both `beneficiaries.ts` and
  `schoolProcurement.ts`'s multer storage config), so an uploaded file
  cannot be executed regardless of its claimed MIME type. The report's
  "Launch Blockers" and "Post-Pilot" tables are otherwise operational/
  infrastructure items (API keys, production DB provisioning, HTTPS,
  backups, Stripe activation) with no code-level fix possible — items #9
  (color contrast) and #12 (SEC-007–010) are the only two with a code
  component, and both are now resolved as documented above.
- **`docs/qa/DATA_INTEGRITY_REPORT.md`** (2026-06-29): missing VERIFIED/
  checkOutTime constraint — **corrected 2026-08-04: already fixed** (migration
  `20260804153210_service_session_verified_requires_checkout`, see additional-
  issues table above); this bullet's earlier "still open" note was stale.
  Seeded-session audit gap — genuinely was open, **fixed 2026-08-04**
  (commit pending): `prisma/seed.ts` now creates a matching `AuditLog`
  `APPROVE` row for every `ServiceSession` it seeds with `status: "VERIFIED"`
  (previously none did). Verified by running the seed script end-to-end
  against a real disposable Postgres DB and confirming all 4 seeded VERIFIED
  sessions have a matching audit row. **This doc's own "Issues Requiring
  Attention" section had 2 more items never individually cross-checked
  here — verified this session**: Issue 2 (seeded `PENDING_CHECKIN` session
  has non-null `totalHours`, representing estimated not actual hours) — the
  report itself already confirms `/api/reports/student` correctly excludes
  this from `approved[]`, so this is cosmetic seed-data hygiene, not a live
  correctness bug; not fixed, genuinely low priority as the report says.
  Issue 3 (CHECK constraint enforces only `checkOutTime`, not the report's
  full "both `checkInTime` and `checkOutTime`" invariant) — **found to be a
  real, exploitable gap in the constraint added earlier this session, fixed
  this round** (commit `061c4f2`): strengthened the constraint to require
  both fields, confirmed by direct raw-SQL insert that the exact invalid
  state the report describes is now rejected. 2 regression tests connect to
  the real (test) database directly, since a mocked Prisma client can't
  verify a DB-level CHECK constraint. Also discovered while applying this:
  neither real local database (`goodhours_qa_latest`,
  `goodhours_local_disposable_accounts`) had even the original weaker
  constraint — `prisma db push` never applies raw-SQL-only migration
  content with no `schema.prisma` representation, so both now have the
  constraint for the first time.
- **`docs/qa/ACCESSIBILITY_REPORT.md`**: contrast and label findings (V-01,
  V-02, V-03, V-06) — fixed (confirmed V-06 again this session: no
  `bg-red-500` badge remains anywhere in `client/src`). **V-05 (Login tab
  order) and V-04 (link-in-text-block on School Dashboard) — followed up
  this session and confirmed fixed by direct code read** (no live browser
  available, but both remediations are structurally verifiable from source):
  V-05 — the logo `<Link>` on the login page already has `tabIndex={-1}`
  and nothing else focusable sits between it and the email input, so the
  first real Tab press lands on the email field as the report's
  remediation option 3 intended. V-04 — audited every `<Link>` on School
  Dashboard with action-colored text; the one genuinely inline-within-a-
  sentence example ("No cohorts yet. **Create your first cohort** to get
  started.") already has `underline underline-offset-2`; the remaining
  action-colored links ("Manage →", "View All (N) →") are standalone
  header-action links, not text embedded in a body-text block, so WCAG
  1.4.1's use-of-color concern doesn't apply to them.
- **`docs/qa/PERFORMANCE_REPORT.md`**: route-level code splitting — fixed
  (`React.lazy()` used throughout `App.tsx`).
- **`docs/student-privacy-compliance.md`, `docs/canvas-production-readiness.md`,
  `integration_failures.md`, `qa_results.md`** (all Canvas-era, 2026-05-10/11):
  mostly marked resolved in the docs themselves and spot-checked as such.
  **Followed up this session — no bug found.** The `user.cohortId` reads at
  `googleAuth.ts:178` and `auth.ts:324` sit alongside a separate `cohorts:
  serializeCohorts(user.cohortMemberships)` field in the same response
  object — both the single primary-cohort FK and the full multi-membership
  list are returned together, so nothing is lost. `invitations.ts:213` is
  the JWT-issuance response for a brand-new user immediately after
  `ensureStudentCohortMembership({ forcePrimary: true, ... })` was called
  for their one and only membership — `cohortId` is accurate by
  construction at that point, and this response is a minimal signup
  bootstrap payload, not the full profile (the client re-fetches via
  `/api/auth/me`, which returns the full `cohorts` array). No fix needed.
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
  `docs/qa/BACKUP_RESTORE_REPORT.md`, `docs/qa/REPOSITORY_AUDIT.md`.
- **`docs/qa/EDGE_CASE_REPORT.md`**: previously marked "superseded by
  FINAL_RELEASE_REPORT fixes" without individually re-checking each of its
  5 numbered defects — **actually re-verified this session, one by one,
  against current code**: DEFECT-001 (whitespace-only title) — fixed
  (`z.string().trim().min(1)`). DEFECT-004 (race condition → 500 instead of
  409/503) — fixed (`P2002`/`P2034` handled explicitly). DEFECT-005 (HTML
  404 instead of JSON) — fixed (catch-all JSON 404 handler in `index.ts`).
  DEFECT-002 (past dates accepted) and DEFECT-003 (end time before start
  time accepted) were **only partially fixed** — both protections existed
  for manually-entered time slots (`opportunityTimeSlotSchema`) but not for
  the recurrence-rule path, which generates slots programmatically from a
  never-validated `startDate` and had no `startTime < endTime` check at
  all. **Fixed this session** (commit `a5ffdb5`): floored the recurring
  series' generation start at today regardless of a past `startDate`, and
  added the same `.superRefine()` ordering check to `recurrenceRuleSchema`
  that manual slots already had. 2 regression tests. This is exactly the
  kind of gap a one-line "superseded" summary can hide — worth remembering
  for any future doc marked superseded without a fresh per-item check.

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
| §12 Reports/metrics failure states | Reports must return `PARTIAL`/`UNAVAILABLE` rather than misleading zeros on partial data-source failure | 🟡 Core hours/progress data layer propagates `dataState`/`failedSources`, wired into `GET /api/reports/student`, `GET /api/reports/school`, and the per-student breakdown. **Fixed this session** (commit `16a3bac`): audited every remaining report/export route. `GET /api/reports/organization` is single-source (one `serviceSession.findMany` call, no partial-failure mode possible — either it succeeds with real numbers or the existing try/catch returns a proper 500, never a misleading zero) — no gap. `GET /api/reports/export/csv` (student hours CSV, the last unaudited route) *did* have the exact bug this section describes: it combined 3 independent sources via `Promise.all`, so any one transient failure 500'd the whole export instead of exporting the 2 sources that succeeded. Fixed with `Promise.allSettled` + a trailing warning row naming the failed source(s) when 1-2 fail, and a 503 (not a fake empty CSV) when all 3 fail — with 3 regression tests. **Also found and fixed** (commit `1439265`): `GET /api/schools/:id/students/:studentId/hour-breakdown` (school admin per-student detail view) already correctly propagated `calculateStudentHours`' own internal partial-failure state, but combined that with 3 more raw record-list queries via a plain `Promise.all` — the same bug, one layer up. Fixed identically (`Promise.allSettled`, merged into the same `dataState`/`failedSources` fields the route already exposed), with 2 regression tests. §12 is now fully addressed for every report/export/detail route found in the codebase. |
| §13 Email/messaging | Centralized HTML escaping, transactional outbox, bulk-messaging quotas | ✅ HTML escaping: re-audited this session — `services/email.ts`'s "custom email HTML" concern (all org/beneficiary-branding fields: `emailSignature`, `brandColor`, `orgLogoUrl`, `orgName`, plus every other free-form field across all 24 email-sending functions — rejection reasons, revision notes, custom messages) is already comprehensively sanitized via `escapeHtml`/`escapeHtmlMultiline`/`sanitizeHexColor`/`sanitizeHttpUrl` (47 sanitization call sites across 24 functions) — the tracker's prior "❓ partially, P2 item" note was stale; `security_findings.md` does not actually contain this finding under its current P2 list, so the note likely predates a fix made earlier in this session before this transcript segment. Also checked for classic SMTP-header-injection via the `subject` field (used directly, not just HTML-escaped, in one function) — not exploitable, since email is sent via Resend's structured JSON API (`resend.emails.send({...})`), not raw SMTP header string construction, so a crafted `subject` cannot inject additional headers. **Bulk-messaging quotas: fixed this session** (commit `6cdf4ef`): `POST /api/messages/bulk` — capable of messaging an entire school's student body in one call — had no rate limiter at all, unlike every other message-sending route in the same file (`POST /` and `POST /reminders/run` both already had one). Added a 5-per-staff-member/10-per-IP-per-hour limiter, deliberately stricter than the single-message limiter given the blast radius; left the per-call recipient count itself uncapped since that's the legitimate school-wide-announcement feature, not the gap. Regression test exercises the real route 6× through the full Express router, confirming the 6th call is rejected. Transactional outbox (⬜ no outbox model found) remains an unassessed architectural ask, not a bug fix. |
| §14 Files/uploads | Object storage migration, quotas, malware scanning, streaming, safe `Content-Disposition` | 🟡 §14.5 (safe downloads) substantially done this session (commit `253da24`): all 8 `Content-Disposition` header sites replaced raw string interpolation with the `content-disposition` library (2 of them — `schoolProcurement.ts`, `billing.ts` — used the raw uploaded filename with zero sanitization, a real header-attribute-breakout risk); client-side confirmed every actual file download goes through `api.download()`, which already checks `response.ok` and never saves a JSON error body as a file — no other raw blob-fetch download path exists. **Not done:** object storage migration (files/signatures still stored as `Bytes` in Postgres per `signatureFileBytes` on `ServiceSession`, not external object storage), per-school/org storage quotas, malware scanning, streaming upload/download (large files still read fully into memory) — these are a genuine architecture project, not assessed further this session |
| §15 Client/server auth consistency | Single API client everywhere; no ad hoc `fetch` + manual token reads; HttpOnly cookie migration | 🟡 Fixed the 3 concrete bugs the goal names almost verbatim (commit `d585b5b`): `SchoolBilling.tsx` read the wrong localStorage key entirely (`"token"` instead of `"goodhours_token"`) so procurement-document downloads sent `Authorization: Bearer null` on every click — completely non-functional, now fixed via the existing `api.download()` helper. `CreateOpportunity.tsx`'s edit path redirected immediately regardless of write success (`keepalive` fetch + empty `.catch()`) — now awaits `api.put()` and only redirects on confirmed success. `OpportunityDetail.tsx` read the token directly from `localStorage` instead of the canonical `getAuthToken()`, breaking for session-only users — now uses the accessor. Full repo grep found no other ad hoc `fetch`/raw-localStorage-token patterns outside of legitimately-public unauthenticated flows (email verification, cancellation links). **Not done:** HttpOnly/Secure/SameSite cookie migration — bearer-token-in-storage model is still in use throughout `AuthProvider.tsx`; that's a much larger architectural change than a bug fix and wasn't attempted |
| §16 Geocoding/directory search | Rate limits, TTL cache, pagination bounds, private-network blocking on geocoding endpoint | ✅ §16.1 done (auth required, bounded TTL cache, outbound timeout — see additional-issues table above; SSRF/private-network blocking doesn't apply, the geocode destination is a hardcoded constant, not caller-controlled). §16.2 partial: nearby-directory pagination is now validated (commit `3cbf01a`) but page size is still capped at 10000, not the goal's recommended 50–100 — left as-is because the client relies on getting all results in one page and has no pagination UI; changing the default would be a product/UX decision, not a bug fix. §16.3 not applicable — no background/state-wide geocoding enrichment job exists in the codebase to fix |
| §17 Schema/DB integrity | Convert free-form status strings to enums, floating-point hours → integer minutes/Decimal, add constraints/indexes | 🟡 §17.4 (indexes) done for the goal's explicitly named columns — commit `af38e01`. §17.1 (enums): **28 of ~20 originally-scoped fields converted across every model identified this session — §17.1 sweep now complete** across twenty commits (a further handful of core-model sub-fields identified mid-session, see below, remain) using the same proven-safe methodology each time (hand-written `ALTER COLUMN ... USING` migration instead of Prisma's data-destroying auto-generated `DROP`/`ADD`, verified against seeded non-default rows + a real-data clone where applicable + full fresh migration replay + `prisma migrate diff` showing zero drift): `SchoolLaunchBug.status`/`.severity` (commit `e7a6ae2`), `SavedOpportunity.status`/`SchoolPartnerRequest.status`/`BeneficiaryAdminInvitation.status` (commit `03ef4b4`), `SchoolBeneficiaryApproval.status`/`SchoolOrganization.status` (commit `4739b02`), `OrganizationInvoiceRequest.status` (commit `c9b3f22`), `BeneficiaryInvitation.status` (commit `038c216`), `InterventionCase.status` (commit `462e695`), `OrgEventReminderLog.deliveryStatus` (commit `f4da9cd`), `Organization.status` (commit `5a417b5` — the legacy Organization model, kept for backward compat behind the newer Beneficiary model), `Opportunity.status` (commit `375e88a` — the paired legacy model), `Signup.status` (commit `df993eb` — the third of the three paired legacy models), `StudentCohortMembership.source` (commit `13fd552`), `StudentInvitation.status` (commit `6c3ab62`), `Cohort.status` (commit `4f69ee6` — 8 consumer files), `SelfSubmittedRequest.status` (commit `eced900` — 10 consumer files, the highest so far), `BeneficiaryOpportunity.status` (commit `10517e3`), `User.status` (commit `998d2fa` — 29 consumer files, the highest-risk conversion of this session; two auth-gating comparisons in `schoolAuthority.ts`/`auth.ts` confirmed as pure reads unaffected by the type change, verified by the full auth/session-eligibility test suite still passing unchanged), `School.ownershipStatus` (commit `1cc6ae2` — also gates login via `evaluateSessionEligibility`; the one caller-reachable write path is protected by a `.strict()` Zod enum), `Beneficiary.status`/`.visibility`/`.planTier` (commit `f9e1934` — 3 fields on the same model converted together), `BeneficiarySignup.status`/`.verificationStatus`/`.attendance` (commit `8089b06` — 3 more fields on one model), `ServiceSession.status`/`.verificationStatus` (commit `608fdc3` — the last model, most complex state machine, 9 status values after this round's findings). All 23 models chosen for the same low-risk profile: 1-7 consuming files, every write site either a schema default or an inline string literal (confirmed safe by a clean `tsc` after each Prisma-client regen — literal unions make this a reliable check). Found and fixed five real related gaps, all the same shape: unvalidated `req.query`/`req.body` status strings passed straight into a Prisma `where`/`data` clause, silently returning empty results or (post-conversion) risking a raw 500 instead of a 400 — `routes/saved.ts`, `routes/beneficiaries.ts`'s `GET /`, `routes/billing.ts`'s `GET /internal/invoice-requests` (internal-admin-gated, lower severity, but the same bug class), `routes/messages.ts`'s `GET /interventions/cases`, and `routes/opportunities.ts`'s `GET /` (this last one on a fully public, unauthenticated endpoint — the most exposed instance of this bug class found this session). All five fixed with matching Zod/enum validation returning 400, each with a dedicated regression test. **Also found, while auditing the same `opportunities.ts` file, a real mass-assignment vulnerability unrelated to the enum work**: `PUT /api/opportunities/:id` (ORG_ADMIN) built its Prisma update payload via `{ ...req.body }` with zero validation, so a caller could set any Opportunity field including `organizationId` — silently transferring the opportunity to a different organization the caller doesn't own. Fixed (commit `375e88a`) by validating against the same field whitelist already used for creation (`createSchema.partial()`), with a regression test asserting the exact `data` object passed to Prisma excludes `organizationId`/`status` while still applying the legitimate field change. The `BeneficiaryInvitation.status`, `OrgEventReminderLog.deliveryStatus`, and `Organization.status` rounds found no analogous status-filter gap — every write site in each case was already an inline literal or never written by the one route that accepts request input at all. The `InterventionCase.status` and `OrgEventReminderLog.deliveryStatus` conversions also confirmed (on a disposable DB, before finalizing each migration) that Postgres automatically rebuilds composite indexes covering the converted column as part of `ALTER COLUMN ... TYPE` — no explicit `DROP`/`CREATE INDEX` needed even when the column being converted is indexed. **The `StudentCohortMembership.source` and `SelfSubmittedRequest.status` rounds each caught a real doc/code mismatch** (the same pattern, twice): `StudentCohortMembership.source`'s comment documented only 3 values (MANUAL, INVITATION, CANVAS) but a real caller in `services/googleClassroomIntegration.ts` used a 4th, `GOOGLE_CLASSROOM`; `SelfSubmittedRequest.status`'s comment documented only 4 values but `POST /api/self-submissions/:id/cancel` writes a 5th, `CANCELLED`, missing from the comment entirely. Converting off either stale comment alone would have made a real, exercised code path crash at runtime the moment it wrote the undocumented value into the new enum column. Both were caught by grepping every literal write and comparison in the actual consumer files instead of trusting the schema comment, and both were specifically verified by seeding the undocumented value on a disposable DB and confirming it survives the conversion (and confirming the real dev DB clone has genuine rows using it). **Also found and fixed, in the `SelfSubmittedRequest` round, a 6th status-filter validation gap** (same shape as the five found in prior rounds): `GET /api/self-submissions` read `req.query.status as string | undefined` straight into the Prisma `where` clause; fixed with a `z.enum(...)` + `safeParse` → 400, with a dedicated regression test. **Found during the `School.ownershipStatus` round, and root-caused fully during the `Beneficiary` round**: neither of the two local databases the running application/tests actually use (`goodhours_qa_latest` = `DATABASE_URL`, and — critically — `goodhours_local_disposable_accounts` = `DEV_DATABASE_URL`, which `src/lib/env.ts` silently substitutes for `DATABASE_URL` whenever `APP_ENV` is development-like, meaning this is the *real* DB `npm test`/local dev connect to) had ever received any of this session's 18 enum-conversion migrations. Both were built via `prisma db push` with no `_prisma_migrations` bookkeeping, so schema drift accumulated invisibly and was caught only when one existing test (`beneficiaryDirectoryNearbyPagination.test.ts`) happened to exercise a real, unmocked Prisma call against a newly-converted column, throwing a live Postgres `42704: type does not exist`. Every other test in the suite mocks Prisma at the method level, which is why 17 prior rounds' `npm test` runs all showed green despite this drift. Fixed in the `Beneficiary` round (commit `f9e1934`) by backing up both databases, running `prisma db push --accept-data-loss` against each (the correct, project-documented mechanism for these specific `db push`-managed local databases per `CLAUDE.md` — not applicable to a real production database), and re-seeding. Full suite now passes against the corrected databases. **Action for any future round**: after each schema change, also run `DATABASE_URL="postgresql://abhay@localhost:5432/goodhours_local_disposable_accounts" npx prisma db push --skip-generate --accept-data-loss` (and the same against `goodhours_qa_latest`) so this drift cannot silently reaccumulate.

The `BeneficiarySignup` round found a 7th and 8th status-filter/validation gap (both in `routes/beneficiaries.ts`, fixed in commit `8089b06`): `GET /:id/signups`'s unvalidated `?status=` filter (same shape as the prior six), and a bulk attendance-recording route that validated an enum-like field with a manual `Set.has()` check instead of Zod — runtime-safe but untyped, replaced with a proper schema.

**§17.1 (enum conversions) is now complete for every model identified this session — 0 known free-form status/enum-like `String` fields remain unconverted.** The `ServiceSession` round (commit `608fdc3`) surfaced the most significant finding of the whole sweep: its 7-value documented `status` comment was missing not one but two real values — a plain literal ("CANCELLED", found by grep) and a value reached only via a shared-variable ternary ("WAITLISTED", found only because converting to a strict enum made `tsc` fail to compile until it was added). That second case is the first time this session a stale schema comment was caught by the compiler itself rather than by manually reading every write site — meaningful because it means the final enum is provably complete (a clean `tsc` after conversion guarantees no write site's literal falls outside the enum), which manual grepping alone can never fully guarantee. `ServiceSession` also required extra care: a pre-existing `CHECK` constraint referencing `status` as text blocked the naive `ALTER COLUMN ... TYPE` (had to drop and recreate the constraint with an explicit enum cast), and the real-DB verification step accidentally reset `goodhours_qa_latest`'s `ServiceSession` data to defaults via `db push --accept-data-loss` (db push does not preserve data the way the hand-written migration does) — recovered by re-seeding via `prisma/seed.ts`, confirmed via psql. **Lesson for any future schema work**: `db push` should only be used against these two local databases for columns/tables with no real non-default data worth preserving; prefer applying the hand-written migration `.sql` directly (as done for every disposable/clone verification this session) when real data matters, and always re-seed after any `db push --accept-data-loss` that touches non-default data. §17.2 (float→Decimal hours) not attempted — larger blast radius, touches every hours calculation site. §17.3 (constraints): only the `ServiceSession` VERIFIED/checkOutTime constraint added; no broader audit. |
| **Critical, found while verifying the index migration:** `schema.prisma` had fields (`SchoolRegistrationIntent` table, `School.ownershipStatus`+evidence columns, `BeneficiarySignup.schoolId`, `ServiceSession.schoolId`) with **no corresponding migration file** — committed in this session's `273f531` consolidation commit but only ever applied to dev via `prisma db push`. `prisma migrate deploy` doesn't diff against schema.prisma, so this was invisible to a plain "migrations apply" check; a genuinely fresh database (a real production deploy) would be missing these columns/tables while the app code queries them. | ✅ | Commit `966721e`. Generated the catch-up migration by diffing a DB built only from the *existing* migration history against schema.prisma. **Also required a data repair a naive autogenerated migration would have gotten wrong**: `ownershipStatus` defaults to `'PENDING'`, and `evaluateSessionEligibility` already blocks `SCHOOL_ADMIN`/`TEACHER` sessions unless `ownershipStatus = 'APPROVED'` — applied as generated, every already-verified school would have locked out its own admins/teachers the moment the migration ran. Added a backfill grandfathering existing verified schools as approved. Verified three ways: (1) full 27-migration replay into a fresh disposable Postgres DB succeeds, (2) `prisma migrate diff` against schema.prisma on that fresh DB returns empty (zero drift), (3) applied directly against a real-data **clone** of the local dev database (never touching the original) and confirmed the backfill correctly promoted both existing verified schools to `APPROVED` while leaving unverified ones at `PENDING`. Also ran `prisma/seed.ts` against a fresh migrated DB end-to-end. |
| §18 Legacy architecture consolidation | Single canonical model for grouping/opportunities/signups/attendance/hours — freeze/remove legacy dual implementations | 🟡 Assessed this session (no fix attempted — this is the actual architectural ask, a real schema-level dual-model system: `Organization`/`Opportunity`/`Signup`/`ServiceSession` (legacy) alongside `Beneficiary`/`BeneficiaryOpportunity`/`BeneficiarySignup` (current), both live and actively written to). **Good news found while assessing**: the hours-*computation* layer is already properly unified despite the dual schema — every consumer (`routes/reports.ts`, `routes/schools.ts`, `lib/studentProgress.ts`) calls the single `calculateStudentHours()` in `lib/hoursCalculator.ts`, which itself aggregates across both `beneficiarySignup` and `serviceSession` (plus `selfSubmittedRequest`) in one place; no route independently recomputes totals from raw session data. So while the schema itself has two coexisting participation/signup models — the genuine consolidation ask, not attempted, requiring a product decision on migration/sunset path for the legacy `Organization`/`Opportunity` system — there is no live double-counting or inconsistent-total bug resulting from it today. |
| §19 Build/repo reproducibility | Single package manager/lockfile, pinned Node version, no committed `node_modules`/local DBs | 🟡 Fixed this session (commit `47725a4`): no `engines.node` anywhere despite CI hardcoding `node-version: "24"` inline — added `engines.node >=24.0.0` / `engines.npm >=10.0.0` to all three `package.json` files plus a root `.nvmrc`. Also found and **fixed this session** (commit `f96ce44`): declared `@prisma/client`/`@prisma/adapter-neon`/`prisma` version ranges were internally inconsistent within each `package.json` (client library vs. CLI tool) and inconsistent with each other across root/server — confirmed via `npm ls` this was never live drift (both always resolved to the same `6.19.x` versions via the shared lockfile), but a fresh install without the current lockfile could have resolved them apart, since Prisma explicitly documents that client and CLI versions should match. Aligned all three packages to their actually-resolved `^6.19.x` ranges in both `package.json` files, regenerated both lockfiles (minimal 8-line diffs each), and confirmed via a fresh migration replay + `prisma migrate diff` (zero drift) that the regenerated client/CLI pair still behaves identically. `node_modules`/local DBs already correctly gitignored (verified earlier this session). **Not attempted — the actual architectural ask:** this repo has three separate npm installs/lockfiles (root, server, client), not the "one authoritative lockfile" goal §19 wants; consolidating into one workspace would touch CI cache paths, Vercel install/build commands, and relative script paths repo-wide — a real restructuring, not a config tweak |

---

## Verification status (2026-08-04)

- `cd server && npx tsc --noEmit` → clean
- `cd client && npx tsc --noEmit` → clean
- `cd server && npm test` → **318 pass / 0 fail / 1 skipped** (319 total). The 1 skip is infra-conditional (`RATE_LIMIT_TEST_DATABASE_URL` not set in this run) — verified separately against a real disposable Postgres DB with 0 skipped/0 failed
- `cd client && npx eslint . --max-warnings 0` on the 3 files touched for §15 → clean (no project-wide client test runner exists — build/lint/typecheck are the available verification surface)
- `cd client && npx vite build` → succeeds
- `cd server && npx tsc` (full build) → succeeds
- **Migration replay against a fresh disposable Postgres database** (`goodhours_*` throwaway DBs, all dropped after use): full 27-migration history applies cleanly to an empty database; `prisma migrate diff` between that fresh DB and `schema.prisma` returns an empty migration (zero drift) after this session's fixes — this caught the critical schema-drift gap documented in §17 above
- Applied the drift-catchup migration against a **real-data clone** of the local dev database (`CREATE DATABASE ... TEMPLATE`, original never touched) and confirmed the `ownershipStatus` backfill behaves correctly on actual existing rows
- `prisma/seed.ts` run against a fresh migrated database → succeeds end-to-end
- `.env.example` / `server/.env.example` → placeholders only, no real secrets
- `.gitignore` → covers `.env*`, `node_modules`, `dist`, local DBs, uploads, test results

- **Dependency scan**: `npm audit` in `server/` found `ip-address <=10.3.0` (transitive via `express-rate-limit`) with 3 HIGH-severity SSRF/trust-boundary-bypass advisories, and a low-severity `esbuild` (transitive via `tsx`, dev-only) advisory. Confirmed `lib/lmsOutboundSecurity.ts`'s own SSRF checks don't use this package (unaffected), but `express-rate-limit`'s IP trust logic was exposed. Both resolved via `npm update` within already-declared semver ranges (no `package.json` version bumps needed) — `npm audit` now reports **zero vulnerabilities**. Commit `4fdfacd`

### Full CI pipeline reproduced locally (2026-08-04)

`.github/workflows/app-verification.yml` is this repo's actual release-gating
CI pipeline. Rather than approximating it, every one of its 10 steps was run
locally in the same order with the same commands, the same env vars, and a
database named identically to CI's (`goodhours_ci`, dropped after use):

1. `npm ci --ignore-scripts` (root) → clean install, 510 packages
2. `npm ci` (client) → clean install, 206 packages
3. `npm ci` (server) → clean install, 215 packages
4. `npx prisma generate` → succeeds (both client-output locations)
5. `npx prisma validate` + `npx prisma migrate deploy` + `npx prisma migrate status` against a fresh `goodhours_ci` database → schema valid, all 28 migrations applied cleanly, "Database schema is up to date!"
6. `npm test` (server) with CI's exact `APP_ENV=test NODE_ENV=test VERCEL_ENV=development` → **313 pass / 0 fail / 1 skipped** (confirms this session's `isPubliclyDeployed()` fix behaves correctly under CI's actual env config, not just an assumed one)
7. `npm audit --omit=dev --audit-level=high` at root and in `server/` → **0 vulnerabilities** both. Client's audit surfaced the known `react-router` RSC-mode CSRF advisory (high) — ran both of the project's existing compensating scripts (`security:verify-react-router-rsc-advisory`, `security:verify-no-rsc`) and confirmed they still pass: the app is a `BrowserRouter` SPA with no RSC runtime, so the advisory doesn't apply. Independently re-verified `docs/qa/DEPENDENCY_ADVISORY_EXCEPTIONS.md`'s claim that no patched `react-router-dom` is published yet — still true as of today, exception not expired (recheck-by 2026-08-31)
8. `npm run build` (server) → clean
9. `npm run build` (client) → clean
10. `git diff --check` → clean; `npx playwright test tests/launch-center.spec.ts tests/intervention-workflow.spec.ts --list` → both pilot-critical specs parse and list correctly

All three `npm ci` runs left the working tree byte-for-byte clean afterward
(`git status --short` empty) — confirming the committed lockfiles are
genuinely deterministic, not just "close enough." One known deviation from
CI: this sandbox runs Node v26.4.0, not CI's pinned Node 24 — `engines.node`
is intentionally unbounded above (see §19 commit `47725a4`) so this doesn't
trigger an engine warning, but it means Node-version-specific CI behavior
wasn't reproduced exactly.

Not yet run this session: full E2E suite (`tests/*.spec.ts` — Playwright), lint (server has no configured lint script; client lint only spot-checked on touched files, not run repo-wide).

---

## How to use this file

1. Before starting a new work session on this goal, read this file first — don't re-derive status from `git log`/`grep` every time.
2. When you fix or verify an item, move it to ✅ with a one-line evidence pointer (test name or file), and note the commit SHA.
3. When you start a big section (§7–§19), convert its ❓/⬜ row into a 🟡 with a short note on what's actually in flight, so a future session doesn't duplicate work.
4. Re-run the verification block above before closing out any session and update the numbers.
5. **If you touch `schema.prisma`, always run `prisma migrate dev --create-only` against a database built from the *existing* migration history (not `db push`) before committing, and confirm the generated diff contains only what you intended.** This caught a real critical gap on 2026-08-04 (commit `966721e`): a prior session's schema.prisma changes were applied to dev via `db push` and committed without ever generating the matching migration file, so a fresh production deploy would have been missing tables/columns the application code depends on. `prisma migrate deploy` alone will NOT catch this — it only replays existing migration files and never diffs against schema.prisma.
