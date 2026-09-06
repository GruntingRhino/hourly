#!/usr/bin/env bash
set -euo pipefail

# Vercel invokes this from the repository root. Preview/development builds must
# never receive or use production DATABASE_URL. Production builds are the
# authenticated in-platform migration boundary for this exact Vercel project.
: "${VERCEL_ENV:?Refusing build: VERCEL_ENV is missing}"
case "$VERCEL_ENV" in
  production|preview|development) ;;
  *) echo "Refusing build: unknown VERCEL_ENV '$VERCEL_ENV'." >&2; exit 1 ;;
esac
: "${VERCEL_PROJECT_ID:?Refusing build: VERCEL_PROJECT_ID is missing}"

if [[ "$VERCEL_ENV" == "production" ]]; then
  test "$VERCEL_PROJECT_ID" = "prj_ZP9k4HEjRT8sMEKzsvcSsHXVMVai" || {
    echo "Refusing migration: Vercel project identity is not GoodHours production." >&2
    exit 1
  }
  [[ "${VERCEL_GIT_COMMIT_SHA:-}" =~ ^[0-9a-f]{40}$ ]] || {
    echo "Refusing migration: Vercel commit identity is missing or malformed." >&2
    exit 1
  }
  test -n "${DATABASE_URL:-}" || {
    echo "Refusing migration: production DATABASE_URL is unavailable in-platform." >&2
    exit 1
  }

  manifest="scripts/vercel-production-migration-manifest.json"
  test -f "$manifest" || { echo "Refusing migration: reviewed manifest is absent." >&2; exit 1; }
  # The manifest freezes the complete sorted migration file set and schema bytes.
  # Verify it before invoking any Prisma command.
  node - "$manifest" <<'NODE'
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const manifestPath = process.argv[2];
const root = process.cwd();
const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const dirs = fs.readdirSync(path.join(root, 'server/prisma/migrations'), {withFileTypes:true})
  .filter(e => e.isDirectory()).map(e => e.name).sort();
if (dirs.length !== m.migration_directory_count || m.migration_files.length !== dirs.length) throw new Error('migration directory count/set mismatch');
const expected = dirs.flatMap(d => `server/prisma/migrations/${d}/migration.sql`);
const actual = m.migration_files.map(x => x.path);
if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('migration paths are not the frozen sorted history');
for (const item of m.migration_files) {
  const got = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, item.path))).digest('hex');
  if (got !== item.sha256) throw new Error(`migration hash mismatch: ${item.path}`);
}
const schema = m.schema;
const got = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, schema.path))).digest('hex');
if (got !== schema.sha256) throw new Error('schema hash mismatch');
console.log(`PRODUCTION_REVIEWED_HISTORY_MATCH=verified count=${dirs.length}`);
console.log('PRODUCTION_SCHEMA_SOURCE_HASH=verified');
NODE

  echo "PRODUCTION_MIGRATION_TARGET=goodhours:${VERCEL_PROJECT_ID}"
  npx prisma migrate deploy --schema=server/prisma/schema.prisma
  npx prisma migrate status --schema=server/prisma/schema.prisma
  diff_output="$(npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel server/prisma/schema.prisma --script)"
  normalized_diff="$(printf '%s' "$diff_output" | sed '/^[[:space:]]*$/d')"
  if [[ -n "$normalized_diff" && "$normalized_diff" != "-- This is an empty migration." ]]; then
    echo "Refusing build: production schema differs from repository datamodel." >&2
    printf '%s\n' "$diff_output" >&2
    exit 1
  fi
  echo "PRODUCTION_SCHEMA_MATCH=verified"
else
  echo "PRODUCTION_MIGRATION=skipped target=$VERCEL_ENV"
fi

npx prisma generate --schema=server/prisma/schema.prisma
cd client
npm install --include=dev
npm run build
