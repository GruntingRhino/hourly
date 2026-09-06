# Root advisory and CI verification — 2026-09-05

## Scope

Local-only verification of the dirty GoodHours release candidate at `terra/fix-sol-findings-20260826`, based on the existing working-tree dependency remediation. No commit, push, deploy, credential change, or production-data access was performed.

The root dependency correction keeps consumer-scoped major versions rather than applying a blanket cross-major replacement:

- root `undici`: `6.28.0`
- `@vercel/node`: `12.0.1`, resolving its Undici import to the root `6.28.0`
- `@vercel/blob`: `2.8.0`, with nested `undici@6.28.1`
- `@vercel/sandbox`: `3.1.0`, with nested `undici@7.29.1`
- `npm ls --include=dev --all --json`: `problems: []`

`package.json` and `package-lock.json` are pre-existing session changes from the dependency remediation worker; this report records the independent compatibility proof rather than treating resolver success as runtime proof.

## Compatibility proof

A disposable `/tmp/goodhours-verify-undici.mjs` probe exercised the installed Undici exports `Headers`, `request`, `FormData`, and `ProxyAgent`; it made a local loopback HTTP request and asserted the response. It also resolved the actual Undici package paths for `@vercel/node`, `@vercel/blob`, and `@vercel/sandbox`. Result:

`UNDICI_VERCEL_COMPAT_PASS {"resolved":{"rootUndici":"6.28.0","vercelNode":"12.0.1","vercelNodeUndici":"/home/opc/RTB/projects/goodhours/node_modules/undici/index.js","vercelBlob":"2.8.0","vercelBlobUndici":"/home/opc/RTB/projects/goodhours/node_modules/@vercel/blob/node_modules/undici/index.js","sandbox":"3.1.0","sandboxUndici":"/home/opc/RTB/projects/goodhours/node_modules/@vercel/sandbox/node_modules/undici/index.js"},"api":["Headers","request","FormData","ProxyAgent"],"localHttp":["headers","request"]}`

The probe was removed and confirmed absent after execution. No cloud/provider call was made.

## CI correction integrated

`.github/workflows/app-verification.yml` now:

1. Binds `DATABASE_URL`, `DEV_DATABASE_URL`, and `RATE_LIMIT_TEST_DATABASE_URL` to the disposable CI PostgreSQL service (`goodhours_ci`).
2. Runs the two-file onboarding browser regression instead of discovery-only `--list` for this coverage.
3. Installs Chromium, starts Vite on `127.0.0.1:5173` with `VITE_API_PROXY_TARGET` and `--strictPort`, waits for readiness, and cleans up the process.
4. Uploads Playwright artifacts when present.
5. Audits root, server, and client with `npm audit --include=dev --audit-level=high`.

The existing `tests/onboarding-browser-verification.spec.ts` was executed locally: **2 passed, 0 failed**. The candidate patch's malformed duplicate-file hunk was not blindly applied; only the validated repository-relative workflow correction was integrated.

## Fresh gates

All commands below used Node `v24.20.0`. Database tests used the disposable loopback PostgreSQL target `127.0.0.1:5433/goodhours_test`; the URL itself was never printed.

| Gate | Result |
|---|---|
| Server canonical `npm test` with all three DB variables explicitly bound | **PASS** — TAP `461 tests`, `461 pass`, `0 fail`, `0 skipped` |
| Server build (`npm run build`) | **PASS** |
| Client lint (`npm run lint -- --max-warnings 0`) | **PASS** |
| Client build (`npm run build`) | **PASS** — Vite transformed 416 modules |
| Prisma validate/status | **PASS** — schema valid; database up to date; 70 migrations found |
| Root audit, include dev | **PASS** — 0 total vulnerabilities |
| Server audit, include dev | **PASS** — 0 total vulnerabilities |
| Client audit, include dev | **PASS** — 0 total vulnerabilities |
| Installed tree (`npm ls --include=dev --all --json`) | **PASS** — `problems: []` |
| CI YAML content checks | **PASS** — DB bindings, include-dev audits, browser execution, strict port present |
| `git diff --check` | **PASS** |
| `actionlint` | **NOT RUN** — executable unavailable on this host |

One earlier canonical run was interrupted by a concurrent environment mutation and reported `460 pass / 1 fail` in `durableRateLimit.test.ts`; the isolated durable-rate-limit file passed `10/10`, and the clean canonical rerun above passed `461/461`. The earlier run is retained only as diagnosis, not final evidence.

## Migration evidence

Both live and migrations-replayed shadow diffs were run against disposable PostgreSQL. Prisma emits the canonical empty-migration marker (`-- This is an empty migration.`) for both directions; the live and shadow files are byte-identical (32 bytes each). Copies are persisted under `docs/qa/evidence/2026-09-05/`.

## Persisted evidence

- `docs/qa/evidence/2026-09-05/root-npm-audit-include-dev.json`
- `docs/qa/evidence/2026-09-05/server-npm-audit-include-dev.json`
- `docs/qa/evidence/2026-09-05/client-npm-audit-include-dev.json`
- `docs/qa/evidence/2026-09-05/migration-diff-live.sql`
- `docs/qa/evidence/2026-09-05/migration-diff-shadow.sql`

## Remaining scope boundary

This local verification does not integrate or adjudicate the separately prepared hours/export or accessibility candidates. It also does not establish GitHub-hosted CI execution, deployment readiness, real provider authorization, legal review, or pilot approval. Those remain separate gates for the parent integration/review phase.
