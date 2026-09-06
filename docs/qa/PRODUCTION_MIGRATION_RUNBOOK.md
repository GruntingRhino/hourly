# Production migration workflow runbook

This runbook covers the manual GitHub Actions workflow
`.github/workflows/production-migration.yml`. It is a guarded execution path,
not permission to migrate a database. Do not run it until the target identity,
GitHub environment controls, and change approval have been independently
verified.

## Required GitHub configuration

In the GitHub **`production` environment** for `GruntingRhino/Hourly`:

1. Configure required reviewers and verify the dispatching operator can both
   start the workflow and approve the environment gate. `environment: production`
   in YAML does **not** prove that reviewers are configured.
2. Configure nonsecret environment variables with these exact names and values:
   - `PRODUCTION_DATABASE_HOST` — the intended GoodHours production PostgreSQL
     hostname.
   - `PRODUCTION_DATABASE_NAME` — the intended GoodHours production database
     name.
3. Configure the environment secret with this exact name:
   - `GOODHOURS_PRODUCTION_DATABASE_URL` — the intended GoodHours production
     PostgreSQL connection URL.

The secret name is a convention, not an access-control boundary: GitHub can
still provide a repository/org secret with the same name if an environment
secret is absent. The workflow's actual protection is the `production`
environment gate plus the runtime host/database comparison. Verify the
environment's secret and variables in GitHub directly; never paste the URL
into chat or commit it.

The URL must point to the confirmed GoodHours **production Neon target**, not
staging (`hourly-dev`/any staging Neon database). Compare the hostname and
URL-decoded database name to the configured nonsecret variables before approval.

## Safe dispatch and review

1. Confirm the reviewed workflow commit is on `main` and inspect the workflow
   file at that exact SHA.
2. Open **Actions → Production database migration → Run workflow**, select
   `main`, and enter exactly `APPLY_PRODUCTION_MIGRATIONS`.
3. Review the `production` environment approval prompt. Do not approve if the
   target variables/secret, target project, or intended migration revision is
   uncertain.
4. In the run log, require both markers before treating the run as complete:
   - `PRODUCTION_DATABASE_IDENTITY=verified`
   - `PRODUCTION_SCHEMA_MATCH=verified`

The workflow records `REVIEWED_SHA` and checks out that exact commit before
installing Prisma. It runs forward-only `prisma migrate deploy`, then checks
migration status and compares the live schema with the repository datamodel.
A schema-match marker means this workflow verified the schema at that run's
configured target; it does not establish legal, backup, or pilot readiness.

If the run is not dispatched, is awaiting approval, or either marker is absent,
production schema verification is **not established**. A result saying there
were no pending migrations is still a normal outcome when the schema is already
applied, but the identity and schema markers remain required.

## Explicit non-goals

- Do not use `vercel env pull`, a repository-level `DATABASE_URL`, or a local
  production connection as a substitute for this workflow.
- Do not dispatch from a branch other than `main`.
- Do not treat a successful local fake-URL/static gate, deployment health check,
  or GitHub workflow configuration as proof of production schema state.
- Do not run production migrations until an operator has verified the GitHub
  environment configuration and target identity.
