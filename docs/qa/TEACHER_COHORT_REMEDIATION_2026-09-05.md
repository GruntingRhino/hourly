# Teacher cohort access remediation — 2026-09-05

## Scope

Integrated the prepared cohort authorization patch into the existing dirty checkout. The patch applies the central `getStaffAccessScope()` / `assertStudentAccessibleToStaff()` policy to:

- `GET /api/reports/audit/:sessionId`
- `GET /api/beneficiaries/signups/:signupId/history`
- `GET /api/schools/:id/groups/:groupId/students`
- `POST /api/schools/:id/groups/:groupId/students`

Teacher access is limited to assigned active cohorts in the teacher's school. School administrators retain same-school access. Student owners retain access to their own beneficiary history. Group roster reads filter unauthorized members before the student PII query, and group membership writes deny unauthorized students before mutation.

## TDD evidence

The candidate HTTP regression was executed against the baseline source before integrating the route changes. It was **RED**:

- 4 tests: 1 pass, 3 fail.
- Same-school out-of-cohort audit history returned `200` instead of `403`.
- Same-school out-of-cohort beneficiary history returned `200` instead of `403`.
- Group add reached a Prisma create and returned `500` rather than the expected authorization `403`.

After applying the source patch and correcting the candidate's malformed Authorization-header fixture, the same real HTTP boundary test was **GREEN**:

```text
✔ audit history denies same-school teacher outside assigned cohort before logs
✔ audit history allows assigned-cohort teacher and school admin
✔ beneficiary history denies same-school out-of-cohort teacher and preserves student owner
✔ group roster filters out-of-cohort members and add rejects them
ℹ tests 4
ℹ pass 4
ℹ fail 0
ℹ skipped 0
```

The test starts an Express server, sends authenticated `fetch()` requests, asserts status/body behavior, and verifies the denied audit path performs no audit-log read. It uses scoped Prisma method doubles because the focused boundary harness does not create full fixtures; it is behavioral HTTP evidence, not a substitute for the database-backed full suite.

## Verification commands and results

- `git apply --check --verbose /tmp/goodhours-cohort-remediation/PATCH.diff` — PASS.
- `git diff --check` — PASS.
- Focused cohort HTTP test on Node `v24.20.0` — PASS, 4/4.
- Prisma `validate` and `generate` — PASS, Prisma `6.19.3`.
- Server TypeScript build — PASS.
- Client lint (`--max-warnings 0`) — PASS.
- Client production build — PASS (`vite 7.3.6`, 416 modules transformed).
- Canonical server suite with disposable PostgreSQL and both `DATABASE_URL` / `DEV_DATABASE_URL` set to the same `.env.test` URL without printing credentials — PASS: **455 tests / 454 pass / 0 fail / 1 skip**.
- Live schema-to-database migration diff — empty except Prisma's informational header (32 bytes).
- Fresh migrations-replayed shadow diff — empty except Prisma's informational header (32 bytes).

## Files changed by this integration

- `server/src/routes/reports.ts`
- `server/src/routes/beneficiaries.ts`
- `server/src/routes/schools.ts`
- `server/tests/teacherCohortAccess.integration.test.ts`
- `package.json` / `package-lock.json`: root `qs` override `6.16.0`, Vercel CLI `^59.11.7`
- `client/package-lock.json`: existing-range transitive refresh to `@humanfs/node@0.16.8`, `browserslist@4.28.9`
- `docs/qa/DEPENDENCY_ADVISORY_EXCEPTIONS.md`
- this report

All other pre-existing dirty files and untracked artifacts were preserved. No commit, push, deploy, credential change, production-data access, reset, stash, or branch switch was performed.

## Dependency audit disposition

- Server online `npm audit --json`: **0 vulnerabilities**.
- Client online `npm audit --json`: **0 vulnerabilities**.
- Root online `npm audit --json`: **28 vulnerabilities** (1 critical, 19 high, 7 moderate, 1 low), remaining in the Vercel CLI/build dependency graph and `@tootallnate/once`. The root `qs` application-runtime path is resolved at `6.16.0`; `vercel@59.11.7` was verified locally with `--version` and `--help`, but its dependency graph still has upstream advisories. Root audit is therefore not clean and remains an explicit residual build-tooling issue; no unsafe forced fix or blanket nested override was used.
