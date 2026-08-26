# Sol Finding Remediation Evidence — 2026-08-26

## Revision

- Branch: `terra/fix-sol-findings-20260826`
- Scope: SOL-01 student milestone authorization; SOL-03 test-environment secret hygiene.
- No production deployment or external gate was performed.

## Changes

### SOL-01 — fixed

`server/src/routes/reports.ts` now obtains `getStaffAccessScope(req.user.userId)` and requires `assertStudentAccessibleToStaff(scope, studentId)` before loading a staff-requested student for `GET /api/reports/student/milestones`. This preserves same-school, assigned-cohort teacher access and school-admin same-school access while denying other schools and teacher out-of-cohort IDs.

Regression command:

```text
bash scripts/ensure-test-db.sh && node --env-file-if-exists=.env.test --import tsx --test tests/studentMilestonesScope.integration.test.ts
```

Result: PASS — TAP `1..1`, `# pass 1`, `# fail 0`. The test makes real HTTP requests through the route and asserts cross-school 403, out-of-cohort 403, and authorized same-school/cohort 200.

### SOL-03 — fixed for the tracked test fixture

The committed `server/.env.test` no longer contains `FIELD_ENCRYPTION_KEY`. Development/test field encryption already has an explicit no-key passthrough, while production-like startup remains fail-closed. No secret value was printed or copied. The remaining test environment values are disposable placeholders and are not production credentials.

### SOL-02 — remains open

Not changed in this remediation. The repository contains `CanvasOAuthState` and `GoogleClassroomOAuthState` schema/migration records, but the current provider services still implement signed stateless state tokens; the existing architecture tests are contract-only and do not establish a working persistence/session flow. Implementing single-use atomic consumption plus browser binding across both providers would be an auth-flow redesign rather than a safe narrow patch. It remains a strict-audit finding and must not be treated as resolved.

## Gate evidence

To be filled only from commands run on this final revision:

- Focused test: PASS — TAP `1..1`, `# pass 1`, `# fail 0`.
- Full server suite: PASS — TAP `1..432`, `# pass 431`, `# fail 0`, `# skipped 1`.
- Server build: PASS — `npm run build` / `tsc` exit 0.
- Client lint/build: PASS — ESLint with `--max-warnings 0`; Vite transformed 414 modules and built successfully.
- npm audit: PASS — server and client each reported `found 0 vulnerabilities` at `--audit-level=high`.
- Prisma validate: PASS — schema is valid.
- Migration deploy: PASS — no pending migrations to apply.
- Live database migration diff: PASS — `-- This is an empty migration.`
- Fresh migrations-replayed shadow database diff: PASS — `-- This is an empty migration.`
- `git diff --check`: PASS.
