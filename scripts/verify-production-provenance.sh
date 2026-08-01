#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
expected_sha="$(git -C "$root" rev-parse HEAD)"
production_url="${PRODUCTION_URL:-https://goodhours.app}"

command -v vercel >/dev/null || { printf 'vercel CLI is required for production provenance verification\n' >&2; exit 1; }

deployment="$(vercel inspect "$production_url" --json)"
deployment_id="$(node -e 'const d=JSON.parse(process.argv[1]); console.log(d.id ?? "")' "$deployment")"
[[ -n "$deployment_id" ]] || { printf 'live production deployment ID is unavailable\n' >&2; exit 1; }

# `vercel inspect --json` intentionally returns a compact deployment summary and
# omits Git metadata. Query the deployment API for the immutable source metadata
# instead of treating the compact response as evidence that no SHA exists.
deployment_details="$(vercel api "/v13/deployments/$deployment_id")"
deployment_commit="$(node -e 'const d=JSON.parse(process.argv[1]); console.log(d.meta?.gitCommitSha ?? d.meta?.githubCommitSha ?? "")' "$deployment_details")"
if [[ "$deployment_commit" != "$expected_sha" ]]; then
  printf 'live production deployment does not prove commit %s\n' "$expected_sha" >&2
  exit 1
fi

printf 'production provenance verified: %s\n' "$expected_sha"
