#!/usr/bin/env bash
set -euo pipefail

mode="${1:?usage: readiness-check.sh <non-billing|billing|production>}"
root="$(cd "$(dirname "$0")/.." && pwd)"

fail() { printf '%s: fail — %s\n' "$mode" "$1"; exit 1; }
pass() { printf '%s: pass\n' "$mode"; }

case "$mode" in
  non-billing)
    : "${DATABASE_URL:?non-billing gate requires an isolated QA DATABASE_URL}"
    : "${JWT_SECRET:?non-billing gate requires an ephemeral QA JWT_SECRET}"
    # The full suite skips the destructive cross-process database check; run it
    # below against a newly-created disposable database instead of inheriting a
    # stale RATE_LIMIT_TEST_DATABASE_URL from a prior shell.
    (cd "$root/server" && env -u RATE_LIMIT_TEST_DATABASE_URL npm test && npm run build)
    (cd "$root/client" && npm run lint && npm run security:verify-no-rsc && npm run security:verify-react-router-rsc-advisory && npm run build)
    (cd "$root/server" && bash "$root/scripts/verify-cross-process-rate-limit.sh")
    git -C "$root" diff --check
    ! rg -n 'TODO|FIXME|XXX|HACK' "$root/server/src" "$root/client/src"
    pass
    ;;
  billing)
    test -f "$root/docs/qa/STRIPE_TEST_REPORT.md" || fail "missing Stripe QA evidence"
    # This gate intentionally stays closed until a redacted test-mode sandbox report
    # records Checkout, signed delivery, entitlement, replay, signature failure,
    # cancellation/deletion, and Test Clock past_due evidence.
    rg -q '^Billing lifecycle QA: PASS$' "$root/docs/qa/STRIPE_TEST_REPORT.md" || fail "Stripe lifecycle evidence incomplete"
    pass
    ;;
  production)
    test -f "$root/docs/qa/PRODUCTION_CHECKLIST.md" || fail "missing production checklist"
    rg -q '^Production deployment SHA: [0-9a-f]{40}$' "$root/docs/qa/PRODUCTION_CHECKLIST.md" || fail "missing deployed-SHA evidence"
    rg -q '^Production release readiness: PASS$' "$root/docs/qa/PRODUCTION_CHECKLIST.md" || fail "production checklist incomplete"
    pass
    ;;
  *) fail "unknown readiness gate" ;;
esac
