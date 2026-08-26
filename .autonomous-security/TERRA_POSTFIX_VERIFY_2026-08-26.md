# Terra Postfix Independent Verification — 2026-08-26

## Scope and revision

Independent verification was run from isolated worktree `/tmp/goodhours-terra-verifier`, on dedicated branch `verifier/terra-postfix-20260826`, pinned to remediation commit `9504f149fc87907bc2b96d5ac0a3a2d03c6c4fcd` (source branch `terra/fix-sol-findings-20260826`). No production deployment or production database was accessed.

## Command-level evidence

All commands below were run against this revision unless noted.

| Check | Exact command | Result |
|---|---|---|
| Focused student-milestones authorization integration | `node --env-file=.env.test --import tsx --test tests/studentMilestonesScope.integration.test.ts` (from `server/`) | **PASS**, TAP `1..1`, `# pass 1`, `# fail 0`. Real loopback HTTP requests through the route returned cross-school `403`, out-of-assigned-cohort `403`, and authorized same-school/assigned-cohort `200` with `percentComplete: 0`. |
| Disposable DB setup | `env -u DATABASE_URL bash scripts/ensure-test-db.sh` | **PASS**. Existing loopback-only `goodhours-test-pg` PostgreSQL was ready at `127.0.0.1:5433/goodhours_test`; Prisma migrations applied. |
| Full server suite | `set -a; . .env.test; set +a; npm test` (from `server/`) | **PASS**, exit 0; TAP `1..432`, `# tests 432`, `# pass 431`, `# fail 0`, `# skipped 1`. The suite emitted expected test warnings/logs, but no failed tests. |
| Server TypeScript build | `npm run build` (from `server/`) | **PASS**, `tsc` exit 0. |
| Client lint and production build | `npm run lint && npm run build` (from `client/`) | **PASS**, ESLint `--max-warnings 0`; Vite transformed 414 modules and completed production build. |
| Server dependency audit | `npm audit --audit-level=high` (from `server/`) | **PASS**, exact output: `found 0 vulnerabilities`. |
| Client dependency audit | `npm audit --audit-level=high` (from `client/`) | **PASS**, exact output: `found 0 vulnerabilities`. |
| Prisma schema validation and migration status | `set -a; . .env.test; set +a; npx --no-install prisma validate && npx --no-install prisma migrate status` (from `server/`) | **PASS**. Schema valid; `63 migrations found`; `Database schema is up to date!`. |
| Live DB diff | `set -a; . .env.test; set +a; npx --no-install prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` | **PASS**, exact output: `-- This is an empty migration.` |
| Fresh migrations-replayed shadow diff | Fresh `goodhours_shadow` database created in the disposable PostgreSQL container, then `npx --no-install prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url <loopback throwaway shadow URL> --script` | **PASS**, exact output: `-- This is an empty migration.` |
| Git whitespace/scope check | `git diff --check`; `git diff --name-only 9504f149^ 9504f149` | **PASS**. No whitespace errors. Remediation scope is the documented security report, `server/.env.test` deletion, `server/src/routes/reports.ts`, and the focused integration test. |
| Secret-like tracked-file scan | Python scan over `git ls-files -z` for private-key blocks, GitHub tokens, AWS access-key IDs, and JWT-shaped bearer tokens | **PASS**, `tracked_files_scanned 573`, `high_signal_secret_hits 0`. The tracked test fixture contains disposable test placeholders only; no high-signal credential pattern was found. |

The first dependency invocation in the clean isolated worktree was blocked because dependencies were not checked out (`tsx`/`tsc` unavailable); no source change was made. Checks were rerun using locally installed dependencies copied from the existing dependency cache (not committed), and the commands above are the successful evidence. Node reported `v22.23.2` while manifests request `>=24`; this is an environment variance, not a source failure.

## Implementation review

### SOL-01 / staff scope semantics

`server/src/routes/reports.ts` now applies staff scope only when a staff member requests another student. It calls `getStaffAccessScope` and then `assertStudentAccessibleToStaff` before loading the requested report. `cohortAccess.ts` establishes:

- school-admin access is limited to the staff member's own `schoolId`;
- teachers require the student's own `schoolId` to match and require either the primary `cohortId` or an active cohort membership to be in `assignedCohortIds`;
- missing/non-student users are rejected;
- list-query scoping separately excludes `isTestAccount` and applies school/cohort restrictions.

This matches the focused adversarial test and avoids the prior ID-only authorization flaw. The focused test is a route-level integration test with mocked Prisma methods, so it proves route/policy behavior but not a production database fixture; the full suite and migration checks provide the remaining runtime/schema evidence.

### SOL-02 review: OAuth state replay/browser binding

**Still open (Medium), not falsely marked fixed.** Both provider services continue to create signed stateless JWT state with a 15-minute lifetime and verify signature/purpose only:

- `server/src/services/canvasIntegration.ts:63-69,275-284,1415-1452` includes `schoolId`, `actorId`, `baseUrl`, and `displayName`; callback verifies the JWT and immediately exchanges the authorization code.
- `server/src/services/googleClassroomIntegration.ts:64-70,288-296,1426-1467` similarly carries school/actor state and verifies only the signed token before code exchange.

The callback paths do not atomically consume a server-side nonce/state record and do not bind the state to the initiating browser session. The schema's `CanvasOAuthState`/`GoogleClassroomOAuthState` records therefore do not constitute mitigation while these services remain stateless. A valid state can be replayed during its lifetime (practical completion is additionally constrained by provider authorization-code one-time behavior). This is a remaining Medium finding, not a HIGH/CRITICAL blocker under this gate.

### SOL-03 / test environment hygiene

**Fixed for the tracked test fixture.** `server/.env.test` no longer contains `FIELD_ENCRYPTION_KEY`. The commit does not add a credential-bearing tracked file, and the high-signal tracked-file scan found zero hits. Test execution confirmed the application handles the absent optional encryption key in test mode; production-like encryption remains fail-closed according to the existing code/tests.

## Verdict

**ACCEPTED** — no unmitigated HIGH or CRITICAL finding was identified in this independent verification. SOL-02 remains an explicitly documented MEDIUM finding requiring a future stateful nonce/atomic-consumption and browser-binding redesign; acceptance must not be read as SOL-02 resolved.
