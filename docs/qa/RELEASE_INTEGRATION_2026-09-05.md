# Release integration evidence — 2026-09-05 (superseded by 2026-09-06 correction)

The original 2026-09-05 record is retained for history. Its 462-test totals, 0-vulnerability root claim, and statement that concurrency/fault tests were missing are superseded by the independent correction below. No commit, push, deployment, production database/data, credentials, or legal artifacts were changed.

## 2026-09-06 independent correction

Checkout: `terra/fix-sol-findings-20260826`, dirty candidate based on HEAD `9c32bb6a84c9ac6f5e115e8e7bc250b2cdef03f2`. Runtime used for final gates: Node `v24.20.0`, npm `11.19.0`; cached Chromium revision 1208. Disposable PostgreSQL was loopback `127.0.0.1:5433/goodhours_test`, loaded from `server/.env.test` without printing its URL. No production-like inherited database/deployment variables were used.

| Gate | Fresh result |
|---|---|
| Focused `cancelledBeneficiaryExport.test.ts` + `canonicalEventTimeModel.test.ts` | **PASS**, 7/7, 0 fail, 0 skipped. Includes real HTTP/PostgreSQL correction/reset concurrency: one serializable winner and expected `P2034`; injected ledger failure rolls back source, audit, and ledger rows; cancelled export excluded. |
| Canonical server suite | **PASS**, 464 total / 464 pass / 0 fail / 0 skipped; `durableRateLimit.test.ts` process gate enabled with validated `RATE_LIMIT_TEST_DATABASE_URL` bound to the same loopback disposable DB; TAP footer captured in `/tmp/goodhours-process-enabled-20260906.log`. |
| Server build | **PASS**, `tsc` exit 0. |
| Client build | **PASS**, Vite 7.3.6, 416 modules transformed. |
| Client lint | **PASS**, `--max-warnings 0`, exit 0. |
| Root/server/client npm audits | **PASS**, `npm audit --include=dev --json`; all three metadata totals 0. |
| Live PostgreSQL → schema diff | **PASS**, 32-byte `empty migration`. |
| Rendered public axe sweep | **PASS** for `/`, `/login`, `/signup`, `/privacy`, `/terms`, `/faq`: 0 critical, 0 serious violations; no page exceptions. |
| Login keyboard gate | **PASS**, corrected harness now matches rendered DOM order: logo → email → forgot-password → password; all landing/login accessibility tests 6/6 pass. |
| Browser onboarding | **PASS**, `tests/onboarding-browser-verification.spec.ts`: 2/2 pass. This is intentionally intercepted/synthetic API evidence, not persistence/provider success. |
| API/UI readiness | **PASS**, API `3011 /api/health` 200 with `db:ok`; Vite `5174` 200; strict paired proxy target `127.0.0.1:3011`. |
| `git diff --check` | **PASS**. |

## Precise residuals

- The rendered login page's Google URL probe returns **503** against the disposable local API because provider credentials/configuration are intentionally absent. This is an external/provider configuration boundary, not a page exception or generic application 500; it remains unverified and must not be reported as Google sign-in success.
- Authenticated dashboards, real Google OAuth/Classroom/Canvas, external email delivery, deployment provenance/runtime, managed backup/restore, operator monitoring, manual home-device QA, school authorization, and qualified adult/legal review remain external/unverified. Legal remains the final human gate; drafts are not approval or certification.
- No claim here turns intercepted browser success into database persistence or provider evidence.

## Candidate provenance

The final relevant dirty source/test/schema/package/config hash snapshot is `/tmp/goodhours-final-hashes-20260906.txt` (15 files; SHA-256 values). The report was updated after the final test/build/audit/browser changes. No deployment action occurred.
