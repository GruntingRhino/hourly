# GoodHours Vercel production migration path

## Scope

The GoodHours Vercel project (`prj_ZP9k4HEjRT8sMEKzsvcSsHXVMVai`) now uses
`scripts/vercel-production-build.sh` as its build command. This is a narrow
in-platform recovery path for the confirmed production login incident: the
production build runs the official Prisma `migrate deploy` against the
platform-provided production `DATABASE_URL`, then runs `migrate status` and an
actual schema-to-datamodel diff before the client build can complete.

The script fails closed unless Vercel provides `VERCEL_ENV`, the exact project
ID, a valid 40-character `VERCEL_GIT_COMMIT_SHA`, and `DATABASE_URL`. It does
not pull, print, copy, or expose the database secret. Before any Prisma command,
it verifies `scripts/vercel-production-migration-manifest.json`: the exact sorted
70 migration SQL relative paths and SHA-256 hashes, plus the Prisma schema
SHA-256. Any added/removed/renamed/modified migration or schema fails closed.
The six migrations added in the current release line contain no
DROP/TRUNCATE/DELETE operations. It never runs `db push`, `migrate reset`, or a
public migration endpoint.

Preview/development builds explicitly skip migration and proceed with the
existing generate/client build. They therefore cannot touch production. The
production target is intentionally migration-on-build until the login incident
is closed; every future production deployment will re-run idempotent
`migrate deploy` and schema verification, and any new migration history causes
the fail-closed review gate to stop the build until this reviewed set/count is
updated.

## Verification requirements

A production deployment is not considered fixed from READY or `/api/health`
alone. Require the build log markers `PRODUCTION_MIGRATION_TARGET=goodhours:...`
and `PRODUCTION_SCHEMA_MATCH=verified`, then inspect the exact deployment and
repeat the bounded live login check. A real authorized account login is still
required before declaring restoration.

## Documentation basis

Prisma's production workflow is `prisma migrate deploy` (apply pending,
committed migrations; do not use development reset/push commands). Vercel's
project configuration supports a repository `buildCommand`; this project
configuration preserves the existing install/output/rewrites and replaces only
the build command with the guarded script.
