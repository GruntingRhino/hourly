# Shared rate limiter verification — 2026-09-05

## Scope and safety

This is local engineering evidence for the distributed limiter lease fix on branch `terra/fix-sol-findings-20260826`. The worktree was already dirty; unrelated changes were preserved. Tests used only the disposable PostgreSQL container `127.0.0.1:5433/goodhours_test` loaded from `.env.test`; connection credentials and secret values were never printed. No Upstash URL/token was configured, and no production data, commit, push, deploy, reset, stash, or branch switch was used.

## RED → GREEN evidence

### Existing PostgreSQL process proof (baseline and final)

`server/tests/durableRateLimit.test.ts` was run with `RATE_LIMIT_TEST_DATABASE_URL` explicitly set to the same redacted loopback PostgreSQL target as `DATABASE_URL` and `DEV_DATABASE_URL`.

- Baseline source run: **10 tests, 10 pass, 0 fail, 0 skip**. The pre-existing test already proved the basic two-child-process shared bucket behavior; it did not cover lease identity during a window boundary.
- Final source run after integration: **10 tests, 10 pass, 0 fail, 0 skip**.
- The process test launches two separately booted Node workers against the same database and namespace. It produced two allowed requests followed by a 429 from a separately booted process, then cleaned its rows by namespace.

### Integrated lease behavior

Applied `/tmp/goodhours-rate-limit-candidate/rateLimit-upstash-lease-fix.patch` after independently checking `git apply --check --verbose` against the current checkout. The integrated behavior suite was corrected to use the active Node runtime (`process.execPath`) and to avoid incompatible top-level await in the tsx CJS child helper.

Final command:

```text
/tmp/goodhours-node24/bin/node --env-file-if-exists=.env.test --import tsx --test tests/rateLimitLease.behavior.test.ts
```

Result: **5 tests, 5 pass, 0 fail, 0 skip**:

- release uses the acquired Upstash bucket across a window boundary;
- concurrent releases never decrement below zero;
- release does not recreate an expired Upstash key;
- an HTTP-200 EVAL error remains conservative (over-count rather than under-count);
- failed responses remain counted when successful responses are skipped.

This is a local HTTP mock of the Upstash pipeline/EVAL protocol. It does **not** execute Redis Lua or prove a live Upstash deployment. No local `redis-server`, `redis-cli`, or Redis container image was available, so a real disposable Redis script-execution gate is **BLOCKED/UNEXECUTED** rather than claimed.

### Source behavior integrated

`server/src/middleware/rateLimit.ts` now carries the acquired store identity, bucket identity, and reset boundary through request finalization. PostgreSQL release predicates on the exact key and acquired reset boundary; Upstash release uses an atomic guarded EVAL decrement; missing/expired/zero buckets are not recreated or decremented below zero; response finalization is idempotent; and leases acquired by a request later rejected by another limit are released. Store errors remain fail-closed only where the option requests it, with conservative release failure behavior.

## Database and final gates

- Node runtime: **v24.20.0** from the existing temporary runtime; npm: **11.19.0**.
- Canonical server suite after limiter and reset-token changes: **461 tests / 461 pass / 0 fail / 0 skip** (the prior database-only skip was enabled).
- Server TypeScript build: **PASS**.
- Client lint with `--max-warnings 0`: **PASS**.
- Client production build: **PASS** (`vite`, 416 modules transformed in the recorded run).
- Server online npm audit: **0 vulnerabilities**.
- Client online npm audit: **0 vulnerabilities**.
- Root online npm audit: **28 vulnerabilities** (**1 critical, 19 high, 7 moderate, 1 low**), residual Vercel CLI/build graph plus `@tootallnate/once`; not a clean root audit.
- Live database → schema Prisma diff: **PASS**, empty migration script.
- Fresh migrations-replayed shadow database → schema diff: **PASS**, empty migration script. Shadow database was disposable and dropped after the check.

## Residuals

Production Upstash configuration and live Redis/Lua execution remain unverified. The PostgreSQL limiter path is verified with actual independent processes and the disposable database. The repository is not an all-clear security result because the root dependency graph still has the documented 28-vulnerability residual and external/provider/legal/production gates are outside this local proof.
