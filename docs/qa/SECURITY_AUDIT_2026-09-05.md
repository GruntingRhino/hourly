# GoodHours Security Findings — consolidated verification — 2026-09-05

## Verdict and scope

This report consolidates the current engineering findings and fresh local verification for the dirty checkout `/home/opc/RTB/projects/goodhours`, branch `terra/fix-sol-findings-20260826`, HEAD `9c32bb6`. It is not a complete independent security clearance, FERPA/COPPA certification, legal opinion, pilot approval, production deployment proof, or provider verification. All database evidence used disposable loopback PostgreSQL; no production credentials or records were accessed. No commit, push, deploy, reset, stash, or branch switch was performed.

The working tree contained substantial pre-existing changes. The findings below attribute only the limiter and reset-token changes made in this verification; the other remediation reports remain separate evidence documents.

## Findings and dispositions

### GH-RATE-01 — distributed limiter lease identity — HIGH before fix; FIXED locally

**Risk:** response completion after a fixed-window rollover could release the new bucket rather than the bucket acquired by the request; shared-store release could also decrement a missing/zero key or silently fail to release durable leases. A rejected request that had acquired multiple dimensions could leak quota.

**Source and fix:** `server/src/middleware/rateLimit.ts` now carries a lease containing store identity, exact bucket key, and acquired reset boundary. PostgreSQL release requires matching key and reset boundary plus positive count. Upstash release uses guarded atomic EVAL and does not recreate missing keys. Response finalization is idempotent, and all acquired leases are released when a later dimension rejects the request.

**Behavioral evidence:**

- `tests/durableRateLimit.test.ts`: actual two separately booted Node processes against the same disposable PostgreSQL store; **10/10 pass**, including two allowed acquisitions followed by a cross-process 429.
- `tests/rateLimitLease.behavior.test.ts`: local HTTP mock of the Upstash pipeline/EVAL protocol; **5/5 pass** for cross-window release, concurrent nonnegative release, expired-key non-recreation, HTTP-200 script-error conservative over-count, and failed-response accounting.
- The mock does not execute Redis Lua and no disposable Redis executable/image was available; live Upstash/Redis execution remains unverified.

**Status:** PostgreSQL distributed behavior fixed and proven locally. Upstash protocol behavior is mock-proven only; production provider configuration remains an external residual.

### GH-AUTH-RESET-01 — concurrent reset-token double use — HIGH before fix; FIXED locally

**Risk:** the old reset route performed a non-conditional lookup followed by a separate update. Two concurrent requests could both observe the same valid hashed token and both return success, with repeated password/session-version mutation.

**Source and fix:** `server/src/routes/auth.ts` hashes the supplied token, computes the new password hash, then performs one conditional `updateMany` requiring the exact digest and unexpired token while clearing the token and incrementing `tokenVersion`. A count other than one returns the same invalid/expired response. The token remains hashed and no plaintext token is logged.

**RED evidence:** `tests/resetTokenConcurrency.integration.test.ts` against disposable PostgreSQL produced **200 and 200** before the fix.

**GREEN evidence:** the same real HTTP test after the fix produced **200 and 400** concurrently; postconditions showed null reset token/expiry and exactly one `tokenVersion` increment. Final focused result: **1/1 pass**.

**Status:** fixed and behaviorally proven against disposable PostgreSQL. Email delivery and production deployment remain unverified.

### GH-COHORT — staff cohort authorization — FIXED locally

The dated teacher-cohort remediation report records real HTTP regressions for audit history, beneficiary history, and group roster/membership routes, with **4/4 pass**, plus the full-suite and build evidence. See `docs/qa/TEACHER_COHORT_REMEDIATION_2026-09-05.md`.

### GH-LIFECYCLE — invitation/owner/account deletion races — FIXED or intentionally retained by policy

`docs/qa/CONCURRENCY_LIFECYCLE_VERIFICATION_2026-09-05.md` records disposable-PostgreSQL HTTP proof for invitation acceptance, rollback, owner approval, stale-session denial, block retention, and concurrent personal school-admin deletion. Personal deletion intentionally preserves the school and blocks last-admin departure pending transfer; owner approval intentionally relies on the independently delivered hashed, single-use, non-expiring approval token rather than requiring `ownershipEvidenceVerifiedAt`.

### GH-AGE — eligibility/session and onboarding findings — dispositions recorded

`docs/qa/AGE_REVIEW_DISPOSITION_2026-09-05.md` records fixed eligibility/invitation/token-hashing paths and rejected recommendations that would broaden personal deletion or change the intentional owner-token authorization boundary. Provider callback execution, legal review, and real-school behavior remain external boundaries.

### GH-DEP — dependency graph residual — OPEN, root tooling only

- Root online audit after the integrated, version-selective remediation: **10 vulnerabilities: 9 moderate, 1 high, 0 critical**.
- Server online audit: **0 vulnerabilities**; client online audit: **0 vulnerabilities**.
- Actual root `npm ls --all --json` exited 0 with no problems. Express `4.22.2` retains its required `path-to-regexp@0.1.13`; Vercel 8.x/6.x consumers resolve to `8.4.2`/`6.3.0`. The old minimatch 3.x `@ts-morph/common` consumer is preserved.
- `tar@7.5.22`, `@tootallnate/once@2.0.1`, `smol-toml@1.6.1`, `ajv@8.18.0`, `js-yaml@4.3.2`, and Vercel-scoped `minimatch@10.2.6` are materialized and verified. The isolated candidate's unsafe global `path-to-regexp@8.4.2` override was rejected before integration.
- Residuals are in the Vercel CLI/build graph and `undici` 5.x. `undici` was not forced to 6.x because that crosses the current Vercel dependency contract; no clean root-audit claim is made.
- Details and exact commands are in `docs/qa/DEPENDENCY_FINAL_REMEDIATION_2026-09-05.md` and `docs/qa/DEPENDENCY_ADVISORY_EXCEPTIONS.md`.

## Fresh final gate ledger

All final commands used Node **v24.20.0** / npm **11.19.0** and the disposable PostgreSQL target where applicable.

| Gate | Result | Evidence |
|---|---|---|
| Canonical server suite | PASS | **461 tests / 461 pass / 0 fail / 0 skip** (database process gate enabled) |
| Limiter durable focused suite | PASS | **10 / 10 / 0 / 0**, actual multi-process PostgreSQL |
| Limiter lease behavior suite | PASS | **5 / 5 / 0 / 0**, local Upstash protocol mock |
| Reset-token concurrency | PASS | **1 / 1 / 0 / 0**, real concurrent HTTP + PostgreSQL postconditions |
| Server TypeScript build | PASS | `npm run build`, `tsc` exit 0 |
| Client lint | PASS | `npm run lint -- --max-warnings 0` |
| Client production build | PASS | Vite build exit 0 |
| Server online audit | PASS | 0 vulnerabilities |
| Client online audit | PASS | 0 vulnerabilities |
| Root online audit | RESIDUAL | **10 vulnerabilities: 9 moderate, 1 high, 0 critical**; Vercel/tooling graph only |
| Live migration diff | PASS | Empty migration script |
| Fresh shadow migration diff | PASS | Empty migration script after replaying migrations |
| Live Upstash/Redis Lua execution | UNEXECUTED | No local Redis executable/image; no production provider token/config used |

## Files added or modified by this verification

- `server/src/middleware/rateLimit.ts` — lease-identity and guarded release implementation.
- `server/src/routes/auth.ts` — atomic reset-token claim/update.
- `server/tests/rateLimitLease.behavior.test.ts` and `server/tests/rateLimitLease.helper.ts` — lease behavior tests and local protocol harness.
- `server/tests/resetTokenConcurrency.integration.test.ts` — real concurrent HTTP/PostgreSQL regression.
- `docs/qa/SHARED_LIMITER_VERIFICATION_2026-09-05.md` — detailed limiter evidence.
- `docs/qa/SECURITY_AUDIT_2026-09-05.md` — this consolidated report.

Other dirty and untracked files were preserved and are not silently attributed here.

## Remaining claims and required follow-up

Do not issue an all-clear security claim. Remaining engineering residuals are the root Vercel/tooling dependency graph and unexecuted live Redis/Upstash Lua/provider evidence. Remaining operational/external boundaries include deployment provenance, production environment mapping, real provider OAuth/Classroom/Canvas behavior, email delivery, backup/restore, school authorization, qualified legal/privacy review, and real-student/pilot approval.

## Final evidence correction addendum

The earlier final-review ledger contained stale claims of a clean root audit and a skipped PostgreSQL process gate. Those claims are superseded by the final closure run: the canonical server suite used the actual validated `.env.test` loopback target with `RATE_LIMIT_TEST_DATABASE_URL` bound and finished **461 tests / 461 pass / 0 fail / 0 skip**. The focused PostgreSQL limiter and owner/lifecycle runs finished **17 / 17 / 0 / 0** (10 durable limiter + 7 lifecycle). The fresh root audit used `npm audit --include=dev --json`, exited 1, and reported **10 total vulnerabilities: 1 high, 9 moderate, 0 critical**; server and client each reported 0. Raw sanitized JSON and the closure summary are under `docs/qa/evidence/2026-09-05/`. Historical reports and their original evidence are retained unchanged.
