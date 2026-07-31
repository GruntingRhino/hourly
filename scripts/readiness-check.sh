#!/usr/bin/env bash
set -euo pipefail

mode="${1:?usage: readiness-check.sh <non-billing|billing|production>}"
root="$(cd "$(dirname "$0")/.." && pwd)"

fail() { printf '%s: fail — %s\n' "$mode" "$1"; exit 1; }
pass() { printf '%s: pass\n' "$mode"; }

case "$mode" in
  non-billing)
    (cd "$root/server" && npm test && npm run build)
    (cd "$root/client" && npm run build)
    git -C "$root" diff --check
    ! rg -n 'TODO|FIXME|XXX|HACK' "$root/server/src" "$root/client/src"
    pass
    ;;
  billing)
    test -f "$root/docs/qa/STRIPE_TEST_REPORT.md" || fail "missing Stripe QA evidence"
    # This gate intentionally stays closed until a redacted live sandbox report
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
