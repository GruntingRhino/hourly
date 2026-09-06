# GoodHours software release evidence — 2026-09-06

## Outcome

- **GitHub release:** PASS. The reviewed production source commit is `5dda9f51f76985795cf4d2a1c1ae5b839da845e2`; the current evidence document is on `origin/main`.
- **GitHub Actions CI:** PASS. The original release run [34009209241](https://github.com/GruntingRhino/Hourly/actions/runs/34009209241), evidence-doc run [34009443448](https://github.com/GruntingRhino/Hourly/actions/runs/34009443448), and final verification run [34009808471](https://github.com/GruntingRhino/Hourly/actions/runs/34009808471) all concluded `success`.
- **Vercel production deployment:** PASS for source/build provenance. The Git-linked deployment created from `main` at the exact SHA is Ready and aliased to `goodhours.app`.
- **Live read-only verification:** PASS for health, allowed/invalid-origin CORS behavior, protected auth boundaries, static privacy page, and PostgreSQL rate-limiter selection.
- **Production migration:** **BLOCKED — not executed.** The release contains six forward-only additive migrations, but this VM was not permitted to use `vercel env pull` or create/alter environment variables, and no safe authorized production connection mechanism was available without exposing or copying the production `DATABASE_URL`. No production data or credentials were read or changed.
- **Overall release status:** **DEPLOYED BUT MIGRATION-GATED / NOT PILOT-GO.** The deployed runtime is healthy, but the new schema is not independently proven applied. Do not claim the migration-backed features are production-ready until an authorized operator runs `prisma migrate deploy` against the confirmed production database through the approved secret-handling path and records the result.

## Repository and preservation checks

- Checkout: `/home/opc/RTB/projects/goodhours`
- Release source commit: `5dda9f51f76985795cf4d2a1c1ae5b839da845e2`.
- Evidence checkout matched the remote main branch during verification; this is the docs-only evidence commit on top of the reviewed source.
- The pre-existing untracked `docs/legal/` content remains untouched and untracked; no legal work was performed.
- `git diff --check HEAD`: PASS.

## Production target and authenticated Vercel evidence

- Vercel account: `gruntingrhino`.
- Project: `goodhours`; project ID `prj_ZP9k4HEjRT8sMEKzsvcSsHXVMVai`.
- Team: `team_4kYonYa3snzVM7q9WkS80cp0`.
- `goodhours.app` ownership inspection: domain belongs to the `goodhours` project. The `hourly-dev` project was not targeted.
- Production environment variable metadata was inspected by names/scopes only; values were not pulled or printed. Production names included `DATABASE_URL`, `APP_ENV`, `ALLOWED_ORIGINS`, `CLIENT_URL`, `APP_URL`, `JWT_SECRET`, `FIELD_ENCRYPTION_KEY`, `CRON_SECRET`, `RESEND_API_KEY`, Google login variables, and Google Classroom variables. `DATABASE_URL` is present in the Production scope; its value was not accessed.
- Exact production deployment: `dpl_FHVC2TFqq1qXMpsQC91R7qamnJr6`, URL `https://goodhours-fxjveffgz-gruntingrhinos-projects.vercel.app`, `readyState=READY`, target `production`.
- Deployment aliases include `goodhours.app`, `goodhours.vercel.app`, and the `main` branch alias.
- Authenticated Vercel deployment metadata reports `githubCommitRef=main`, `githubCommitRepo=GruntingRhino/Hourly`, and `githubCommitSha=5dda9f51f76985795cf4d2a1c1ae5b839da845e2`.
- Deployment build used Node `24.x`, root install with development dependencies, Prisma generation, and client build; build record `bld_mc8y40u7x` is `READY`.

## CI evidence

The exact-SHA GitHub Actions run completed successfully. All job steps concluded successfully, including:

- disposable PostgreSQL service and Prisma generation/validation/migrate deploy/status;
- full server test suite;
- actual onboarding browser regression execution (not discovery-only);
- root/server/client dependency audits including development dependencies;
- server and client builds;
- `git diff --check`; and
- pilot-critical Playwright spec parsing.

Run URL: https://github.com/GruntingRhino/Hourly/actions/runs/34009209241

## Production migration safety

The commit adds these six migration directories:

1. `20260904120000_add_school_owner_approval_tokens`
2. `20260904183000_add_school_owner_approval_resend_cooldown`
3. `20260904190000_add_school_owner_email_blocklist`
4. `20260905020000_preserve_school_email_blocks_on_school_delete`
5. `20260905100000_add_eligibility_attestation`
6. `20260905110000_add_student_invitation_hour_lineage`

Static review found only additive `ALTER TABLE`, index, table, and foreign-key operations; no `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, or `DELETE FROM` statements. CI applied this history only to its disposable PostgreSQL service. It did **not** prove the production database state.

The migration was intentionally not run from this VM: using `vercel env pull` was explicitly prohibited, and no approved in-process secret mechanism was available. Do not substitute a redacted/placeholder URL. Required next action is an authorized operator execution of `prisma migrate deploy` using the existing production secret without printing, persisting, or modifying the secret, followed by sanitized migration output and a production schema verification.

## Live read-only probes

- `GET https://goodhours.app/api/health` → HTTP `200`, body status `ok`, database status `ok`.
- `GET https://goodhours.app/api/auth/me` without credentials → HTTP `401`, `Missing or invalid authorization header`.
- `GET https://goodhours.app/api/internal/reminders/run` without credentials → HTTP `401`, `Unauthorized`.
- `GET /api/auth/me` with `Origin: https://goodhours.app` → HTTP `401` and `Access-Control-Allow-Origin: https://goodhours.app`, `Vary: Origin`.
- `GET /api/auth/me` with `Origin: https://evil.example` → HTTP `401` with no CORS allow header; no server `5xx`.
- `GET https://goodhours.app/privacy` → HTTP `200`; rendered content no longer matched the previously observed under-13 exception, absolute FERPA/COPPA compliance claim, or localStorage-auth claim.
- Sanitized Vercel runtime logs for the exact deployment explicitly report: `Upstash Redis is not configured; using the PostgreSQL-backed shared rate limiter.` No boot-crash or database connection error was observed in the inspected log lines.

## Continuation verification — documentation CI and migration mechanism

- Documentation CI run [34009443448](https://github.com/GruntingRhino/Hourly/actions/runs/34009443448) completed `success` for `b665c507a7be8fd1acb1258602893dc936812d4f`; job [101422558302](https://github.com/GruntingRhino/Hourly/actions/runs/34009443448/job/101422558302) completed every step successfully, including Prisma migration replay/status against its disposable PostgreSQL service, server tests, onboarding browser regressions, dependency audits, builds, and diff sanity.
- Current remote equality was independently rechecked: `HEAD`, `origin/main`, and `git ls-remote origin refs/heads/main` matched exactly.
- Final documentation CI run [34009808471](https://github.com/GruntingRhino/Hourly/actions/runs/34009808471) completed `success`; its job [101423529067](https://github.com/GruntingRhino/Hourly/actions/runs/34009808471/job/101423529067) completed every step successfully.
- The exact production deployment was independently rechecked with authenticated Vercel metadata: `dpl_FHVC2TFqq1qXMpsQC91R7qamnJr6`, target `production`, `readyState=READY`, aliases include `goodhours.app`, source SHA `5dda9f51f76985795cf4d2a1c1ae5b839da845e2`.
- Read-only live probes remain healthy: `/api/health` returned `200` with `status=ok` and `db=ok`; same-origin `/api/auth/me` returned `401` with the expected CORS allow header; an invalid-origin request returned `401` with no CORS allow header.
- Existing automation was inspected by workflow/script metadata only. `.github/workflows/app-verification.yml` runs `prisma migrate deploy` only against disposable CI PostgreSQL; Vercel's production build command runs `prisma generate` only; the only existing workflow that references `secrets.DATABASE_URL` is the directory-refresh job and it performs data-refresh/geocoding work, not migrations. No safe existing Vercel/GitHub mechanism was found that can apply production migrations without exposing/copying/modifying the production secret.
- **Precise hard blocker remains:** an authorized operator must run `npx prisma migrate deploy --schema=server/prisma/schema.prisma` against the confirmed production database through the approved secret-handling mechanism, then run `npx prisma migrate status` and record sanitized output. Do not use `vercel env pull`, print/persist/copy the secret, use a placeholder URL, or use `prisma db push`. No production migration was attempted in this continuation.

## Explicit remaining boundaries

This is software-release evidence only. It does not establish legal review, school authorization, pilot approval, provider delivery, real Google Classroom/Canvas authorization, Resend delivery, managed PITR/restore monitoring, home-device QA, or a real-student rollout decision. Legal files were left untouched.
