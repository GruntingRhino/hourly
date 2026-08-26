# Sol Independent Security Audit — 2026-08-26

## Scope and audited revision

- Repository: `/home/opc/RTB/projects/goodhours`
- Audited branch: `main` at `937301d6b43c71db0900721920e61750ebf9edda`
- Preconditions: launch-readiness work is present on `main`; `git log -1` identifies the commit as the launch-readiness update and records 431 tests / 430 pass / 0 fail / 1 skip, with the remaining Sol audit called out. The audit was performed against the checked-out `main` HEAD before creating this report branch.
- No production deployment or push was performed.

## Verification evidence

| Check | Result |
|---|---|
| `unset DATABASE_URL; NODE_ENV=development npm test` | PASS — TAP `1..431`, `# pass 430`, `# fail 0`, `# skipped 1` |
| `npm audit --audit-level=high` in `server` | PASS — `found 0 vulnerabilities` |
| `npm audit --audit-level=high` in `client` | PASS — `found 0 vulnerabilities` |
| `npm run build` in `server` | PASS — TypeScript build completed with exit 0 |
| `npm run build` in `client` | PASS — Vite transformed 414 modules and built in 9.32s |
| Client RSC/advisory checks | PASS — both security scripts passed |
| `npx prisma validate` | PASS |
| `npx prisma migrate status` against disposable test DB | PASS — 63 migrations found; database schema up to date |
| `prisma migrate diff --from-url ... --to-schema-datamodel ... --script` | PASS — `-- This is an empty migration.` |
| Migrations replayed into isolated shadow DB then diffed to schema | PASS — `-- This is an empty migration.` |
| `git diff --check` | PASS |
| Tracked secret-like files | No tracked `.env`/private-key file found; tracked `.env.example` and `server/.env.test` are present. The latter contains static non-production test values, including a 64-character field-encryption key; values were not printed. |

## Findings

### HIGH — SOL-01: Cross-school IDOR remains in student milestones report

**Evidence:** `server/src/routes/reports.ts:49-65`.

`GET /api/reports/student/milestones` accepts `studentId` from the query at line 52. Lines 53-55 only reject callers who are not `SCHOOL_ADMIN` or `TEACHER`; they do not call `getStaffAccessScope()` or `assertStudentAccessibleToStaff()`. The handler then loads the requested student and calculates/returns that student's milestone data at lines 56-65. In contrast, the neighboring `/student` report performs the staff scope check at lines 140-152.

**Impact:** An authenticated school administrator or teacher who knows another student's ID can request milestone/progress data across schools. This is an authorization boundary failure, not merely a missing audit event.

**Concrete fix:** Apply the same `getStaffAccessScope(req.user.userId)` plus `assertStudentAccessibleToStaff(scope, studentId)` gate used by `/api/reports/student` before loading the target student. Return 403/404 on failure, and add an API regression test with two schools (including a teacher assigned to a cohort) proving cross-school and out-of-cohort access is denied.

**Status:** UNMITIGATED on audited HEAD.

### MEDIUM — SOL-02: Canvas OAuth state is signed and expiring but not single-use or browser-bound

**Evidence:** `server/src/services/canvasIntegration.ts:275-284` signs the state as a JWT with a 15-minute expiry and verifies only its signature and `purpose`. The callback at lines 1450-1478 consumes `state.schoolId` and `state.actorId`, but there is no nonce persistence, consumed-state record, or atomic one-time claim. `server/tests/canvasSecurityArchitecture.test.ts:15-23` labels this mechanism “persistent single-use,” but its assertions only check that the builder/verifier functions exist; they do not establish persistence or single-use behavior.

**Impact:** A valid state value can be replayed during its 15-minute lifetime. The provider authorization code is normally one-time, which limits practical replay of a complete OAuth exchange, but the application does not enforce the stated single-use property and the state is not tied to the initiating browser session.

**Concrete fix:** Store a cryptographically random nonce/state record server-side with actor, school, redirect origin, expiry, and consumed timestamp; atomically mark it consumed before accepting the callback. Bind the flow to an HttpOnly, SameSite cookie or equivalent browser session. Replace the architecture test with a behavioral test that proves replay is rejected.

**Status:** UNMITIGATED on audited HEAD; no direct cross-school authorization bypass was demonstrated from this issue alone.

### MEDIUM — SOL-03: Static test encryption material is committed in `server/.env.test`

**Evidence:** `git ls-files "*.env*" ...` reports tracked `server/.env.test`. A redacted inventory of that file reports a nonempty 64-character `FIELD_ENCRYPTION_KEY` at line 15, plus static placeholder values for the disposable database, JWT, and cron settings. No values were printed or copied into this report.

**Impact:** Anyone with repository read access can decrypt test fixtures or accidentally reuse the committed key if test configuration is promoted or copied into an environment. This is not evidence that a production credential is exposed, but it violates secret hygiene and creates environment-confusion risk.

**Concrete fix:** Remove real-looking key material from tracked test env files; use clearly documented deterministic test fixtures only where cryptography requires a value, or generate it in test setup. Add a CI secret scanner that rejects non-example credential material and rotate any key that has ever been used outside disposable tests.

**Status:** UNMITIGATED on audited HEAD.

## Scope observations (not counted as exploitable findings)

- JWT authentication verifies the current user, status, email verification/eligibility, and `tokenVersion` in `server/src/middleware/auth.ts:61-114`; role middleware is fail-closed when no user is present (`server/src/middleware/rbac.ts:3-12`). However, `signToken` defaults every generic token to 7 days (`server/src/middleware/auth.ts:118-120`); this is a hardening concern for student sessions, not an accepted high-severity finding for this audit.
- The QR implementation currently provides signed, expiring, hashed-token primitives in `server/src/lib/attendanceQr.ts:23-79`, and migration constraints include a unique token hash and unique `(tokenId, studentId)` redemption. The audited source has no QR mint/redeem route wired to Express, so there is no active QR endpoint to exploit; wiring it later must enforce opportunity/school ownership and an atomic redemption transaction.
- CORS uses exact origin matching in `server/src/index.ts:81-122`; no wildcard origin was found.
- Sensitive login/signup limiters are configured fail-closed in `server/src/routes/auth.ts:121-180`. The general rate limiter can fail open when a store fails (`server/src/middleware/rateLimit.ts:415-426`), so operational monitoring should ensure the durable store is healthy; this was not escalated because the credential limiters explicitly use `failClosed: true`.
- The CI workflow uses explicit non-production test placeholders for `DATABASE_URL` and `JWT_SECRET` in `.github/workflows/app-verification.yml:15-18`, not production credentials. They should remain unmistakably non-production and must never be reused by a deployed environment.
- Migration safety checks were clean against both the disposable database and a fresh migrations-replayed shadow database. The static migration inventory found historical destructive operations in older migrations, but no pending destructive diff and no new migration on the audited HEAD.

## Overall assessment

The test/build/dependency/schema gates are green, but the authorization failure in SOL-01 is a directly exploitable cross-school student-data IDOR and remains unmitigated on `main`. Therefore this revision is not launch-ready under the stated rule that ACCEPTED requires no unmitigated CRITICAL/HIGH findings.

SECURITY VERDICT: REJECTED — unmitigated cross-school IDOR in `/api/reports/student/milestones`.
