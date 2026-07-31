#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
expected_sha="$(git -C "$root" rev-parse HEAD)"
expected_short_sha="${expected_sha:0:7}"
production_url="${PRODUCTION_URL:-https://goodhours.app}"

command -v vercel >/dev/null || { printf 'vercel CLI is required for production provenance verification\n' >&2; exit 1; }

logs="$(vercel inspect "$production_url" --logs 2>&1)"
printf '%s\n' "$logs" | rg -F "Commit: $expected_short_sha" >/dev/null || {
  printf 'live production deployment does not prove commit %s\n' "$expected_sha" >&2
  exit 1
}

printf 'production provenance verified: %s\n' "$expected_sha"
