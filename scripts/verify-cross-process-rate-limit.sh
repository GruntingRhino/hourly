#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
: "${DATABASE_URL:?DATABASE_URL is required for the disposable rate-limit verification database}"

base_database_url="$DATABASE_URL"
read -r database_url qa_database_url < <(node - <<'NODE'
const base = process.env.DATABASE_URL;
const parsed = new URL(base);
if (!["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) {
  throw new Error("Cross-process rate-limit verification only permits a local PostgreSQL DATABASE_URL.");
}
const databaseName = `goodhours_rate_limit_${process.pid}_${Date.now()}`;
parsed.pathname = `/${databaseName}`;
console.log(`${databaseName} ${parsed.toString()}`);
NODE
)

cleanup() {
  psql "$base_database_url" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"$database_url\";" >/dev/null 2>&1 || true
}
trap cleanup EXIT

psql "$base_database_url" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$database_url\";" >/dev/null
DATABASE_URL="$qa_database_url" npx prisma migrate deploy --schema=prisma/schema.prisma >/dev/null
RATE_LIMIT_TEST_DATABASE_URL="$qa_database_url" \
  node --import tsx --test --test-name-pattern='two separately booted processes' tests/durableRateLimit.test.ts

echo "cross-process database rate-limit verification passed"
