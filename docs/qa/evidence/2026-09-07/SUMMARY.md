# Evidence summary — 2026-09-07

Base commit: `238b611f05ada5c0953d5e41cc09e74bc09e0f19` (branch `main`).
Scope: student-only age eligibility, pending school-approval UI, and the
business-owner approval email.

## Defects found and fixed

### 1. Pending school admins were reported as age-blocked (production only)
`server/src/middleware/auth.ts` derived the setup-only 403's code and message from
whether an `EligibilityAttestation` row existed. Once staff stopped receiving one,
every pending `SCHOOL_ADMIN` on a publicly deployed instance got
`AGE_ELIGIBILITY_REQUIRED` / "Age eligibility confirmation is required before
continuing." Not reproducible locally: `isInternalAdminUser` treats every local
`SCHOOL_ADMIN` as an internal admin, which skips the ownership gate.

Fix: `evaluateSessionEligibility` now returns
`setupReason: "AGE_ELIGIBILITY" | "SCHOOL_OWNERSHIP"`, and the middleware maps that
reason to the code/message instead of re-deriving policy at the call site.

### 2. The production owner-approval resend never sent anything
`POST /api/auth/ownership-approval/resend` selected its production branch with

    /(^|\\.)goodhours\\.app$/i

Doubled backslashes: in a regex literal `\\` matches a literal backslash, so the
pattern could never match `goodhours.app`. In production the route therefore always
took the development-bypass branch and answered `200 { delivery: "bypass" }` while
mailing nothing — *after* rotating `ownershipApprovalToken` and stamping
`ownershipApprovalLastSentAt`. So each resend also destroyed the approval link that
had already been delivered to the business owner at signup, and claimed a
15-minute cooldown for an email that was never sent.

The two sibling call sites (password signup, Google register-school) had the correct
literal. This was drift between three inlined copies — the same failure mode
`lib/isProdLike.ts` exists to prevent.

Fix: canonical `isProductionOwnerApprovalTarget(clientUrl)` in
`server/src/lib/isProdLike.ts`, used by all three call sites, with an explicit
`VERCEL_ENV === "preview"` guard (Vercel sets `NODE_ENV=production` on previews, so
`isProdLike()` alone is true there and a preview could otherwise mail the real
business owner). A source scan test fails the build if any route re-derives the
host check locally.

### 3. Resend failure handling
A provider failure previously fell through to the generic 500 with the cooldown
already claimed and the old token already destroyed. The route now restores the
previous `ownershipApprovalToken`/`ownershipApprovalTokenExpires`, shortens the
cooldown to ~60s rather than releasing it, and answers `502 { delivery: "failed" }`.
The cooldown is deliberately not cleared: `send()` retries internally up to 4 times
and treats timeouts/5xx as retryable, so a reported failure can still have been
accepted by the provider. A per-applicant `createEmailSendRateLimit` was also added
— the route previously had no middleware limiter at all, leaving the DB stamp as its
only throttle.

### 4. Rollout compatibility
`eligible13Plus` was removed from three `strictObject` schemas, which reject unknown
keys. A browser still running the previous bundle would have received
`400 Unrecognized key(s)`. The key is now accepted and ignored on the school
registration and beneficiary-staff invitation schemas. The student invitation schema
still requires it.

### 5. Stale cached age prompt
`client/src/App.tsx` routed to `<AgeEligibility/>` purely on
`requiresEligibilityAttestation`, which `AuthProvider` renders optimistically from
`localStorage`. A staff account cached before this policy shipped would have flashed
the age screen. The check is now `role === "STUDENT"` as well.

## Verification

| Gate | Result |
|---|---|
| server suite (`npm test -- --test-reporter=tap`) | **478 tests / 478 pass / 0 fail / 0 skip** (`server-suite.tap`) |
| — two-process PostgreSQL rate-limit test | ran, not skipped (`RATE_LIMIT_TEST_DATABASE_URL` bound; 0 skipped) |
| Playwright, real Chromium, production client build | 13 / 13 pass (`pending-approval-ui.spec.ts` 11, `onboarding-browser-verification.spec.ts` 2) |
| `server npm run build` (tsc) | clean |
| `client tsc --noEmit` / `vite build` / `eslint --max-warnings 0` | clean |
| `npm audit --include=dev` root / server / client | 0 vulnerabilities each |
| `git diff --check` | clean |
| prisma migrations → schema (fresh shadow DB) | empty, no drift |
| prisma schema → live disposable test DB | empty, no drift |
| migrations on disk | 70, unchanged — no schema change, no new migration |

Local tests were run against the disposable PostgreSQL container
`goodhours-test-pg` at `127.0.0.1:5433/goodhours_test`, validated in process before
each run. No production data was read or written.

## Evidence boundary

These are local and build-time results. They do not prove provider email delivery to
the business owner's mailbox, real OAuth/LMS behaviour, backup recovery, legal review,
or pilot authorisation. In particular, **actual delivery of the school-ownership
approval email is still unproven** and requires a provider message ID plus mailbox
confirmation after this change is deployed.
