# CI correction verification — 2026-09-05

## Integrated source change

Modified `.github/workflows/app-verification.yml` only for this CI correction. The workflow now binds all database-backed checks to the disposable PostgreSQL service:

- `DATABASE_URL=.../goodhours_ci`
- `DEV_DATABASE_URL=.../goodhours_ci`
- `RATE_LIMIT_TEST_DATABASE_URL=.../goodhours_ci`

It now executes `tests/onboarding-browser-verification.spec.ts` after installing Chromium, starts Vite with `VITE_API_PROXY_TARGET=http://127.0.0.1:3001`, requires `--strictPort` on port 5173, waits for HTTP readiness, and uploads browser artifacts. Root/server/client audits use `npm audit --include=dev --audit-level=high`.

The existing untracked browser regression file is part of the current working candidate and was executed locally; the malformed candidate patch's duplicate-file path was not applied.

## Incremental evidence

| Check | Result |
|---|---|
| Browser regression | **PASS** — 2 tests, 2 passed, 0 failed, 7.9s |
| Root audit include dev | **PASS** — info 0, low 0, moderate 0, high 0, critical 0, total 0 |
| Server audit include dev | **PASS** — info 0, low 0, moderate 0, high 0, critical 0, total 0 |
| Client audit include dev | **PASS** — info 0, low 0, moderate 0, high 0, critical 0, total 0 |
| Server canonical suite, first run | **INCONCLUSIVE/FAIL** — 461 tests, 460 pass, 1 fail; durable process test raced with environment-mutating tests |
| Durable limiter isolated rerun | **PASS** — 10 tests, 10 pass, 0 fail |
| Server canonical suite, clean rerun | **PASS** — 461 tests, 461 pass, 0 fail, 0 skipped |
| Server build | **PASS** |
| Client lint | **PASS** — zero warnings |
| Client build | **PASS** — 416 modules transformed |
| Prisma validate/status | **PASS** — schema valid, database up to date, 70 migrations |
| Installed dependency tree | **PASS** — `npm ls --include=dev --all --json` reports `problems: []` |
| `git diff --check` | **PASS** |
| actionlint | **BLOCKED** — executable unavailable locally |

## Source changes pending the next integration phase

The checkout remains intentionally dirty with the parent/other-worker candidate changes. This task did not touch the separately prepared hours/export or accessibility source candidates. Those candidates require independent review and integration before any commit/push/deploy decision.
