# Security Audit — 2026-08-25

Scope: evidence gathered tonight (2026-08-25) against `launch-prep`, local environment.
Rules honored: no compliance claims (no FERPA/COPPA assertions), no fabricated evidence. Every finding below was directly verified by command output or code read tonight.

## Environment verified

- Podman container `goodhours-test-pg` up; database `goodhours_test` contains the two-school isolation seed:
  - `School`: "Playwright School A" (`cmt81w97j0002bj3f7mwpy1wc`), "Playwright School B" (`cmt81w98v0008bj3fta5p490t`)
  - `User` roles: 2 SCHOOL_ADMIN, 2 BENEFICIARY_ADMIN, 4 STUDENT
- Playwright security suite: **117/117 PASSED** against a live local server with this seed (prior run, same evening).
- Server test suite: ~260 tests, 252–259 passing depending on env.

## Findings

| # | Severity | Finding | Evidence |
|---|----------|---------|----------|
| F1 | High | **Audit-log writes can be silently lost.** `logDataAccess()` (`server/src/lib/dataAccessLog.ts`) wraps the Prisma audit write in try/catch that only logs to console and swallows the failure — access-audit records are best-effort, not guaranteed. | Code read tonight: `catch (err) { console.error("[FERPA] DataAccessLog write failed:", err); }` |
| F2 | High | **JWT stored in localStorage** (`goodhours_token`), readable by any injected script; also mirrored to sessionStorage. Files: `client/src/lib/authSession.ts:18–26`, `client/src/pages/organization/CreateOpportunity.tsx:196`. | Code read tonight |
| F3 | Medium-High | **7-day JWT expiry default for all users including minors.** `server/src/middleware/auth.ts:84` — `expiresIn ?? "7d"`; no shorter-lived token path for student/minor accounts observed. | Code read tonight |
| F4 | Medium | **Email rate-limit test failed during full-suite run** ("not ok 94 - email send limited to one request per recipient every 60 seconds") but **passes in isolation (3/3)** on re-run tonight against the PG-backed limiter. Indicates test-order/shared-state interference rather than a confirmed product bug — but the limiter's correctness under concurrent/full-suite load is unproven. | Re-run tonight: `node --import tsx --test tests/emailRateLimit.test.ts` → pass 3 / fail 0. Original failure captured in earlier full-suite run log. |
| F5 | Low-Medium | **Prisma version mismatch advisory**: `prisma` CLI pinned `^6.3.1` vs `@prisma/client` `^6.19.2` in `server/package.json`; lockfile resolves engines-version `7.1.1-3…`. CLI/runtime drift can cause schema/client divergence. Upgrade advisory surfaced previously; not remediated. | package.json + package-lock.json read tonight |
| F6 | Info (positive) | Security suite green: **117/117 PASSED**, covering tenant isolation, RBAC, relationship enforcement, messaging safety, reports/exports, tokens, input validation, rule enforcement. | Prior full-suite run tonight |

## Isolation matrix — what the 117 tests cover

Suite files (`tests/security/`): 01-tenant-isolation (16), 02-role-authorization (19), 03-relationship-enforcement (11), 04-messaging-safety (13), 05-reports-exports (16), 06-tokens (6), 07-input-validation (20), 08-rule-enforcement (12) = 113 declared `test()` blocks (+ helpers).

Concrete cross-tenant checks covered:

1. School A admin cannot GET School B student report via `?studentId` → 403 (TI-01, ER-04a/b both directions)
2. School A admin cannot approve/reject/request-revision on School B submissions → 403 (TI-04/05/06)
3. School A admin cannot read School B school record or its student roster → 403 (TI-07/08)
4. Reports contain only own-school students; CSV export scoped to requesting student only (ER-01a/b, ER-02)
5. Unauthenticated access rejected across reports/school/export endpoints → 401 (TI-15, ER-11a–c)

Route-class coverage vs the C3 route-class checklist: the C3 checklist file was **not found in the repo** (searched all `.md`). Coverage above maps to these route classes actually exercised: reports read, exports/CSV, verification approvals, self-submission review, cohort creation, school roster reads, messaging bulk-send, parent-link/token endpoints, session audit logs.

## Coverage gaps

- No C3 checklist artifact in repo to diff coverage against — route-class completeness is asserted only by the suite itself.
- Known gap encoded in a test name: "ER-07: school A admin with ?organizationId=orgBId should be 403 (**known gap**)". Verify whether this is an open hole or a skipped expectation.
- Email rate limiter has no stable passing evidence under full-suite conditions (F4).
- Audit-log durability untested — no test asserts an audit row exists after a data-access event (compounds F1).
- No XSS-relevant usage found server-side: grep of `server/src` and `client/src` for `dangerouslySetInnerHTML`/`innerHTML` returned **0 matches** — good, but no automated guard enforces this.
- Token lifetime policy (F3) has no test asserting short expiry for minors.
- Suite is API-level (`request` fixture); no browser-context checks of localStorage token exposure (F2) or CSP.

## Verdict: READY FOR CONTROLLED SYNTHETIC PILOT — **Yes, conditionally**

Controlled synthetic pilot may proceed given tenant-isolation and RBAC suites are green against the two-school seed. Conditions / what would change it to unconditional:

1. Resolve ER-07 (cross-org `?organizationId=` access) — confirm fixed or ticketed as blocking.
2. Make audit-log failures non-silent or alerting (F1) before real-student data.
3. Add regression stability for the email rate-limit test under full-suite runs (F4).
4. Before expanding beyond synthetic data: shorten minor token lifetimes (F3), move JWT out of localStorage or add mitigating CSP (F2), align Prisma CLI/client versions (F5).

*No compliance claims are made in this document.*
