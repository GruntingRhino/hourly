#!/usr/bin/env bash
#
# ensure-test-db.sh — reproducible local test database for `npm test`.
#
# Contract:
#   * If DATABASE_URL is already exported (CI service container, or a
#     developer pointing at their own instance), this is a no-op.
#   * Otherwise it starts a disposable postgres:16 container on
#     127.0.0.1:5433 with throwaway credentials matching server/.env.test,
#     waits for readiness, and applies Prisma migrations so the
#     database-backed tests (hybrid rate limiter) find the schema they use.
#   * If podman is missing we warn and exit 0 so machines without containers
#     can still run the non-database majority of the suite.
#
# Credentials here are throwaway by design — the database only ever listens
# on loopback and holds no real data. Never put real secrets in this file.

set -euo pipefail

CONTAINER_NAME="goodhours-test-pg"
HOST_PORT="5433"
POSTGRES_USER="goodhours_test"
POSTGRES_PASSWORD="goodhours-local-test-only" # throwaway, loopback-only
POSTGRES_DB="goodhours_test"

if [ -n "${DATABASE_URL:-}" ]; then
  echo "[ensure-test-db] DATABASE_URL already set — skipping local test database setup."
  exit 0
fi

if ! command -v podman >/dev/null 2>&1; then
  echo "[ensure-test-db] podman not found and DATABASE_URL unset — skipping database setup."
  echo "[ensure-test-db] WARNING: database-backed tests may fail on this machine."
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

container_running() {
  [ "$(podman inspect -f '{{.State.Running}}' "$CONTAINER_NAME" 2>/dev/null)" = "true" ]
}

if ! container_running; then
  if podman container exists "$CONTAINER_NAME" 2>/dev/null; then
    echo "[ensure-test-db] Starting existing $CONTAINER_NAME container..."
    podman start "$CONTAINER_NAME" >/dev/null
  else
    echo "[ensure-test-db] Starting postgres:16 container $CONTAINER_NAME on 127.0.0.1:$HOST_PORT/$POSTGRES_DB..."
    if ! podman run -d --name "$CONTAINER_NAME" \
      -e POSTGRES_USER="$POSTGRES_USER" \
      -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
      -e POSTGRES_DB="$POSTGRES_DB" \
      -p "127.0.0.1:$HOST_PORT:5432" \
      docker.io/library/postgres:16 >/dev/null; then
      echo "[ensure-test-db] ERROR: could not start postgres container." >&2
      echo "[ensure-test-db] Hint: is something else already bound to 127.0.0.1:$HOST_PORT?" >&2
      exit 1
    fi
  fi
fi

# Wait for readiness (max ~60s).
ready=0
for _ in $(seq 1 60); do
  if podman exec "$CONTAINER_NAME" pg_isready -q -U "$POSTGRES_USER" -d "$POSTGRES_DB" 2>/dev/null; then
    ready=1
    break
  fi
  sleep 1
done

if [ "$ready" -ne 1 ]; then
  echo "[ensure-test-db] ERROR: postgres did not become ready within 60s." >&2
  exit 1
fi

echo "[ensure-test-db] postgres is ready on 127.0.0.1:$HOST_PORT/$POSTGRES_DB."

# Apply migrations so schema-dependent tests pass. Idempotent: re-running is a
# no-op once the database is up to date. Output shown only on failure so
# `npm test` stays quiet.
MIGRATE_LOG="$(mktemp)"
trap 'rm -f "$MIGRATE_LOG"' EXIT
if ! (cd "$SERVER_DIR" && DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@127.0.0.1:$HOST_PORT/$POSTGRES_DB?schema=public" \
      npx prisma migrate deploy) >"$MIGRATE_LOG" 2>&1; then
  echo "[ensure-test-db] ERROR: prisma migrate deploy failed against the local test database:" >&2
  cat "$MIGRATE_LOG" >&2
  exit 1
fi
echo "[ensure-test-db] Prisma migrations applied."
