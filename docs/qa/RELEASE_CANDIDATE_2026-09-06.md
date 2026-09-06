# GoodHours release-candidate handoff — 2026-09-06

## Decision

**Local engineering acceptance: PASS. Real-student pilot/release rollout: NO-GO pending parent acceptance and external gates.** No commit, push, deployment, production migration, credential change, or production-data action was performed in this phase.

This handoff freezes the complete changed candidate for parent review. It is not a security clearance, FERPA/COPPA certification, legal opinion, provider verification, deployment proof, or school/pilot approval.

## Candidate identity and frozen scope

- Checkout: `/home/opc/RTB/projects/goodhours`
- Branch: `terra/fix-sol-findings-20260826`
- Candidate base: `origin/main` at `937301d6b43c71db0900721920e61750ebf9edda`
- Local HEAD: `9c32bb6a84c9ac6f5e115e8e7bc250b2cdef03f2`
- Branch relation at refetch: `origin/main...HEAD` = `0` remote-only / `12` local-only commits.
- Candidate source freeze manifest: `docs/qa/evidence/2026-09-06/candidate-manifest.json`
- Manifest SHA-256: `2fc8bdb64c67553e8d0cb3bceeeaa9acd6b84e853266e0d8564e46ae8ffebb85`
- Manifest contents: **92 files**, covering every changed tracked/untracked source, test, schema, migration SQL, package manifest/lockfile, workflow, and Vercel deployment config. It excludes documentation/evidence, secrets and environment files, generated output, dependency caches, and `.vercel` metadata. The manifest is the authoritative filename/hash list; HEAD alone is not candidate provenance.

The candidate includes six forward-only, additive migration directories:

- `20260904120000_add_school_owner_approval_tokens`
- `20260904183000_add_school_owner_approval_resend_cooldown`
- `20260904190000_add_school_owner_email_blocklist`
- `20260905020000_preserve_school_email_blocks_on_school_delete`
- `20260905100000_add_eligibility_attestation`
- `20260905110000_add_student_invitation_hour_lineage`

A scan of the six candidate migration SQL files found no `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, or `DELETE FROM` statements. Applying migrations to production remains parent-authorized work only.

## Fresh local gates

All database tests used the validated URL from `server/.env.test` targeting loopback PostgreSQL `127.0.0.1:5433/goodhours_test`; the URL was not printed. Inherited `DATABASE_URL`, `DEV_DATABASE_URL`, `RATE_LIMIT_TEST_DATABASE_URL`, `APP_ENV`, `VERCEL_ENV`, and `NODE_ENV` were cleared before binding the intended target. `DATABASE_URL`, `DEV_DATABASE_URL`, and `RATE_LIMIT_TEST_DATABASE_URL` were then bound to the same disposable target.

| Gate | Result |
|---|---|
| Canonical server suite (`npm test`) | **PASS — 464 tests / 464 pass / 0 fail / 0 skipped**. The previously skipped `durableRateLimit.test.ts` separately booted-process gate ran with `RATE_LIMIT_TEST_DATABASE_URL` enabled. Raw output: `/tmp/goodhours-process-enabled-20260906.log`. |
| Focused durable limiter + hours/export/date tests | **PASS — 17 / 17**, 0 fail, 0 skipped. Raw output: `/tmp/goodhours-focused-final-20260906.log`. This includes the real PostgreSQL process limiter proof and the hours correction/reset concurrency + injected ledger-failure rollback proof. |
| Server build | **PASS** — `npm run build`, TypeScript exit 0. |
| Client build | **PASS** — Vite 7.3.6, 416 modules transformed. |
| Client lint | **PASS** — ESLint with `--max-warnings 0`, exit 0. |
| Root/server/client dependency audits | **PASS** — `npm audit --include=dev --json`; metadata totals were 0 for each graph. Raw JSON: `/tmp/goodhours-root-audit-20260906.json`, `/tmp/goodhours-server-audit-20260906.json`, `/tmp/goodhours-client-audit-20260906.json`. |
| Live schema → datamodel diff | **PASS** — 32-byte empty migration; raw output `/tmp/goodhours-live-schema-20260906.sql`. |
| Fresh migrations-replayed shadow → datamodel diff | **PASS** — 32-byte output identical to live diff; raw output `/tmp/goodhours-shadow-schema-20260906.sql`. Shadow database was disposable and removed after the check. |
| Whitespace/conflict checks | **PASS** — `git diff --check`; no unresolved merge markers. |

Previously completed browser evidence remains separately classified in `docs/qa/RELEASE_INTEGRATION_2026-09-05.md`: public rendered axe sweep for six routes (0 serious/critical, no page exceptions), landing/login accessibility 6/6, and intercepted onboarding 2/2. Intercepted onboarding proves UI gating only; it does not prove persistence or provider behavior.

## Handoff boundaries and NO-GO items

- No deployment or production provenance/runtime verification was performed. Parent must review exact contents, decide commit/push, verify the intended **GoodHours production** Vercel project/domain/database (not `hourly-dev`), and only then authorize deployment.
- Local Google URL probing returned 503 because disposable provider credentials/configuration are absent. Real Google OAuth, Classroom, and Canvas workflows are unverified.
- External email delivery, managed backup/PITR restore, monitoring/operations, manual home-device QA, school authorization, and qualified adult/legal review/school documentation remain open. Legal drafts are not approval or certification.
- The current live site may still expose superseded public policy text; corrected local pages are not live-site proof.
- No production credentials/data were read or changed. No destructive cleanup was performed.

## Related corrected evidence

- `docs/qa/ACCEPTANCE_2026-09-06.md` — corrected canonical count now records 0 skips.
- `docs/qa/RELEASE_INTEGRATION_2026-09-05.md` — superseded-history header plus current gate table.
- `docs/qa/FINAL_INDEPENDENT_SECURITY_REVIEW_2026-09-05.md` — corrected review disposition and external boundaries.

**Parent acceptance is required before any commit, push, migration application, alias change, or deployment.**
