# GoodHours Independent Final Security Review — 2026-09-05

## Historical record and 2026-09-06 correction

This report's original 2026-09-05 evidence is retained below for audit history. The original root-audit count and browser/concurrency descriptions are superseded by the independently rerun evidence in `docs/qa/RELEASE_INTEGRATION_2026-09-05.md` and `docs/qa/ACCEPTANCE_2026-09-06.md`.

The current local engineering disposition remains **verified for exercised candidate gates; rollout NO-GO**. This is not a security clearance, zero-exploit claim, FERPA/COPPA certification, legal opinion, pilot approval, provider verification, or deployment proof.

- Dirty candidate branch: `terra/fix-sol-findings-20260826`
- Base HEAD: `9c32bb6a84c9ac6f5e115e8e7bc250b2cdef03f2`
- Final gates used Node `v24.20.0`, npm `11.19.0`, cached Chromium 1208, and disposable loopback PostgreSQL only.
- No commit, push, deploy, reset, credential change, production data access, or legal-package mutation occurred.

### Corrected results

- Canonical server suite: **464 total / 463 pass / 0 fail / 1 skip**.
- Focused hours/export + date regressions: **7/7 pass**, including real PostgreSQL/HTTP concurrent correction/reset with expected `P2034` loser and injected ledger-failure rollback of source/audit/ledger.
- Server build, client build (416 modules), client lint: **PASS**.
- Root, server, and client `npm audit --include=dev`: **0 vulnerabilities each** (the former root 10-vulnerability statement is stale).
- Live schema diff: **empty migration**; prior fresh migrations-replayed shadow evidence remains recorded and no schema/source change occurred afterward.
- Rendered `/`, `/login`, `/signup`, `/privacy`, `/terms`, `/faq` axe sweep: **0 critical / 0 serious**, no page exceptions.
- Accessibility browser tests: **6/6 pass** after correcting a stale keyboard assertion to the actual rendered tab order (logo → email → forgot-password → password).
- Onboarding browser verification: **2/2 pass**, with synthetic/intercepted API responses explicitly classified as UI control evidence only.
- API `/api/health`: **200, db ok** on the paired disposable server; Vite strict port readiness: **200**.

### Remaining evidence boundaries

The local login page's Google URL request returned **503** because provider credentials/configuration are absent in the disposable environment. The page remained exception-free and axe-clean, but real Google OAuth is unverified. This is not a generic 500 finding and must not be reported as provider success.

Deployment provenance/runtime, selected deployed limiter/provider behavior, real Google OAuth/Classroom/Canvas, external email delivery, managed backup/restore, monitoring, manual home-device QA, school authorization, and qualified adult/legal review/school documentation remain outstanding. Legal remains the final human gate; legal drafts are review-ready drafts only.

The final dirty-candidate hash snapshot is `/tmp/goodhours-final-hashes-20260906.txt`; the detailed acceptance ledger is `docs/qa/ACCEPTANCE_2026-09-06.md`.

---

## Prior 2026-09-05 report

The earlier sections and evidence artifacts below are historical and are not the current totals. Refer to the 2026-09-06 correction above for acceptance.
