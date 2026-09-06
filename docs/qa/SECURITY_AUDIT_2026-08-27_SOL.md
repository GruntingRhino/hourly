# Sol Independent Security Audit — 2026-08-27

## Scope and evidence boundary

- Repository: `/home/opc/RTB/projects/goodhours`
- Audited revision: `9504f149fc87907bc2b96d5ac0a3a2d03c6c4fcd`
- Audited branch: `terra/fix-sol-findings-20260826`
- Worktree was clean before this report was written.
- This is an engineering security audit, not a legal or regulatory opinion. No FERPA/COPPA or launch-compliance claim is made.
- No push, merge, deployment, credential change, production-data access, or production-environment test was performed.

The review traced the current source for authentication/JWT/role enforcement, staff-to-student school/cohort authorization, OAuth state handling, attendance QR primitives, rate limits, CORS and headers, uploads, tracked secret-like files, dependencies, Prisma schema/migrations, and student-facing records. The audit used actual source and behavioral tests; architecture-test names were not treated as proof.

## Verdict

**CONDITIONALLY ACCEPTED FOR THE CODE SECURITY GATE:** no reproducible unmitigated CRITICAL or HIGH defect was found on the audited commit. The previously confirmed HIGH student-milestones IDOR is fixed on this branch and passed its focused HTTP regression test. Three residual MEDIUM/LOW engineering findings remain below. This verdict does not establish launch readiness: OAuth hardening, environment/credential verification, legal review, and real pilot/staging authorization tests remain external/manual gates.

## Command evidence

| Gate | Result |
|---|---|
| Focused student milestone HTTP authorization regression | PASS — TAP `1..1`, pass 1, fail 0; cross-school 403, same-school/out-of-cohort 403, assigned-cohort 200 |
| Full server suite: `unset DATABASE_URL; NODE_ENV=development npm test` | PASS — TAP `1..432`, pass 431, fail 0, skipped 1, duration 68.34 s |
| Server build: `npm run build` | PASS — `tsc`, exit 0 |
| Client lint | PASS — ESLint `--max-warnings 0`, exit 0 |
| Client RSC/advisory checks | PASS — both documented security scripts passed |
| Client production build | PASS — 414 modules transformed, Vite build exit 0 |
| Server `npm audit --audit-level=high` | PASS — 0 vulnerabilities |
| Client `npm audit --audit-level=high` | PASS — 0 vulnerabilities |
| `npx prisma validate` | PASS |
| Explicit disposable-DB `prisma migrate status` / `migrate deploy` | PASS — 63 migrations; schema current; no pending migration |
| Disposable live DB → schema diff | PASS — `-- This is an empty migration.` |
| Migrations replayed through fresh shadow DB → schema diff | PASS — `-- This is an empty migration.` |
| `git diff --check` before report | PASS |

One initial shadow-URL construction attempt was invalid and failed closed with Prisma P1001 before migration replay. The URL was rebuilt by changing only its parsed pathname; the independent fresh-shadow diff then passed. The shadow database was dropped after verification.

## Findings and disposition

### Fixed HIGH from the immediately preceding audited baseline — SOL-01: student milestones cross-school/cohort IDOR

- Current evidence: `server/src/routes/reports.ts:49-72` now requires a school role, obtains `getStaffAccessScope()`, and calls `assertStudentAccessibleToStaff()` before loading a staff-selected student.
- Policy evidence: `server/src/lib/cohortAccess.ts:95-123` requires the student role and exact school match, then limits teachers to assigned active cohort membership.
- Behavioral evidence: `server/tests/studentMilestonesScope.integration.test.ts:51-83` makes real HTTP requests and proves cross-school denial, same-school/out-of-cohort denial, and authorized assigned-cohort success. The focused run and full suite both passed.
- Status on audited commit: **FIXED and independently verified**. Fix commit: `9504f149fc87907bc2b96d5ac0a3a2d03c6c4fcd`.

### MEDIUM — SOL-27-01: Canvas and Google Classroom OAuth state is not single-use or initiating-browser bound

- Canvas evidence: `server/src/services/canvasIntegration.ts:275-284` signs/verifies a 15-minute JWT and checks only `purpose`; `:1450-1476` consumes the claims directly when upserting the school connection.
- Google Classroom evidence: `server/src/services/googleClassroomIntegration.ts:288-297` uses the same stateless pattern; `:1465-1492` consumes its claims directly.
- Route evidence: initiation is authenticated and restricted to `SCHOOL_ADMIN` (`server/src/routes/integrations.ts:77-94` and `:222-239`), but callbacks are public and receive no browser/session binding (`:96-103` and `:241-248`).
- Misleading-test evidence: `server/tests/canvasSecurityArchitecture.test.ts:15-23,43-51` labels the state “persistent single-use” and says the callback re-checks the administrator, while it only source-matches function and claim names. The current services do not use the existing `CanvasOAuthState` / `GoogleClassroomOAuthState` models (`server/prisma/schema.prisma:1687-1715`).
- Impact: a valid state can be replayed during its lifetime, and an authorization flow can be completed in a browser other than the one that initiated it. Provider authorization-code one-time use limits simple callback replay, and no direct unauthenticated cross-school exploit was demonstrated; therefore this remains MEDIUM, not HIGH.
- Fix: generate an opaque random state, store only its hash with actor/school/expiry, atomically claim it once, re-check that actor is still an approved administrator for that school, and bind the flow to an HttpOnly SameSite cookie. Replace source-text tests with behavioral replay, browser-mismatch, expiry, and revoked-admin tests.
- Status: **OPEN**.

### MEDIUM — SOL-27-02: student sessions use a generic seven-day JWT lifetime

- Evidence: `server/src/middleware/auth.ts:118-132` gives `signToken()` a default `7d` expiry and `signUserToken()` does not shorten it by role. Authentication does re-load the user, enforce `tokenVersion`, current role/status/email eligibility, and school ownership state (`:61-114`).
- Impact: a stolen student bearer token remains usable for up to seven days unless the account is revoked or its token version changes. HttpOnly cookie migration reduces script access, but bearer-header compatibility remains.
- Fix: use a role-aware student TTL (for example 24 hours), keep short session cookies where requested, and document/behaviorally test rotation and revocation.
- Status: **OPEN hardening finding**; no token-forgery or authorization bypass was demonstrated.

### LOW — SOL-27-03: legacy organization report does not begin with a strict role allowlist

- Evidence: `server/src/routes/reports.ts:291-338`. A user with any non-null legacy `organizationId` passes the initial check. Only `ORG_ADMIN` is forced to its own organization; school roles are constrained to approved links. A different legacy role with a stale `organizationId` could supply another `organizationId` query value.
- Impact: the response pseudonymizes students (`:332-337`) but exposes another organization's aggregate/session/opportunity metadata if an anomalous legacy user record exists. No normal account-creation path producing that record combination was demonstrated.
- Fix: reject unless the current role is `ORG_ADMIN`, `SCHOOL_ADMIN`, or `TEACHER` before evaluating organization scope; add a behavioral test for a student/other role carrying a legacy organization ID.
- Status: **OPEN, LOW**.

## Reviewed controls with no HIGH/CRITICAL defect found

- **Authentication/RBAC:** JWT signature verification supports controlled previous-secret rotation; every request reloads authoritative user state and checks `tokenVersion` (`server/src/middleware/auth.ts:22-31,61-114`). `requireRole()` fails closed (`server/src/middleware/rbac.ts:3-12`).
- **Student-data IDOR surface:** direct `studentId` query/parameter paths reviewed in reports, schools, cohorts, messages, sessions, and self-submissions. The sensitive staff read paths use exact school plus central cohort scope; full-suite behavioral tests also cover teacher session queries, evidence downloads, classroom ownership, bulk messaging, cross-school memberships, and the milestone regression (tests 403-428 and 409-419 in this run).
- **QR/token security:** current Express routes do not wire an attendance-QR mint/redeem endpoint. Existing primitives use HMAC-SHA256, timing-safe signature comparison, expiry, and token hashing (`server/src/lib/attendanceQr.ts:23-79`); schema/migrations reserve unique hash/redemption constraints. Route wiring remains a future security review gate.
- **Rate limits:** login/signup credential controls are fail-closed (`server/src/routes/auth.ts:118-180`). The global limiter can fail open on store failure (`server/src/middleware/rateLimit.ts:414-426`), and production currently warns rather than exits if shared Redis is absent (`server/src/lib/env.ts:110-113`); treat shared-store monitoring as an operations gate.
- **CORS/headers:** Helmet is enabled and CORS uses exact origin matching with credentials; localhost wildcarding is disabled in production-like environments (`server/src/index.ts:75-122`).
- **Uploads/path traversal:** disk-backed upload paths use random UUID filenames; original client names are metadata/content-disposition inputs, not filesystem path components. Magic-byte validation and size/count limits are present. Signature uploads use bounded memory storage and persist bytes only after authorization/content validation. Full tests included authorization-before-Multer and MIME/spoof checks.
- **Secrets/test environment:** tracked secret-like files are examples plus `server/.env.test`. The prior static field-encryption key was removed on the audited commit; remaining inspected entries were non-production test placeholders. Values were not printed in this audit. Historical credential rotation for any formerly committed production value remains an external operations check.
- **Dependencies:** both lockfiles returned 0 vulnerabilities at audit level HIGH.
- **Schema/migrations:** disposable live database and migrations-replayed shadow database both produced empty diffs against `schema.prisma`; no pending migration or destructive drift was found.
- **Student-facing behavior:** no client `dangerouslySetInnerHTML`/`innerHTML` sink was found. Verified-hour state-machine, transcript integrity, evidence access, and test-account exclusion tests passed. Best-effort service-hour ledger writes emit errors in expected failure tests; this is a consistency/operations risk, not an authorization bypass in this audit.

## Residual manual, operational, and legal gates

1. Implement and behaviorally verify persistent single-use, browser-bound Canvas and Google Classroom OAuth state before enabling real LMS connections for a pilot.
2. Verify production/staging secrets, previous-secret removal schedule, historical credential rotation, shared rate-limit store, HTTPS callbacks, exact allowed origins, and production environment flags without copying values into audit artifacts.
3. Run authenticated staging/pilot tests with two real isolated schools and a cohort-limited teacher, confirming negative cross-school/out-of-cohort access across reports, exports, evidence downloads, messaging, and integrations.
4. Review retention/deletion semantics, parental consent/age flows, school contracts, privacy notices, and applicable education/minor-data obligations with qualified counsel. This audit makes no legal claim.
5. QR attendance endpoints require a new threat-model and behavioral review if/when wired.

## Final evidence statement

No new source remediation was made during this 2026-08-27 audit because the current checked-out commit already contains the independently passing HIGH-IDOR fix and this review found only MEDIUM/LOW residual issues. The exact tested source commit remains `9504f149fc87907bc2b96d5ac0a3a2d03c6c4fcd`.
