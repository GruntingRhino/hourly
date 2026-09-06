# GoodHours 13+ eligibility implementation evidence — 2026-09-05

## Scope and policy

User-directed policy is 13+ only for every GoodHours role and entry path. The control is a server-bound self-attestation, not verified age. No DOB or identity-document collection is introduced. No school-admin, teacher, beneficiary-admin, OAuth, invitation, roster/import, or LMS path may bypass it.

## Implementation status (working-tree evidence)

The eligibility schema/migration, authentication session gate, password signup, Google completion, invitation paths, existing-account attestation route, and client entry controls are present in the current dirty working tree. This report intentionally distinguishes source presence from executed verification; the authoritative status below is updated only from commands run in this worktree.

- [x] persisted attestation schema and additive migration (migration applied to disposable test DB; Prisma status clean)
- [x] password signup enforcement (source present; focused regression included in final suite)
- [x] Google new-account completion and returning-account enforcement (returning Google payload now includes the explicit requirement flag; HTTP callback/provider exchange remains separately unexecuted)
- [x] invitation acceptance enforcement (student acceptance is transactional with conditional claim and imported-hour lineage; beneficiary paths retain transactional claims)
- [ ] imported/staged activation enforcement — source inventory only; each roster/LMS activation path was not behaviorally exercised here
- [x] existing-account setup gate and recovery path (source present; covered by existing final-suite coverage)
- [x] real HTTP behavioral regression tests added (password signup HTTP regression; invitation/decline focused route coverage is reported separately when executed)
- [x] client wording and unchecked control (beneficiary and additional-admin invitation clients submit actual checkbox state; client build green)
- [x] migration/schema/build/full-suite verification

## Executed evidence

- Ad-hoc changed-behavior verification: a temporary `/tmp/hermes-verify-*.py` script was created with `tempfile`, ran the affected integration/HTTP/architecture files against the disposable test DB, asserted the TAP footer, and removed itself successfully. Result: **104 tests, 104 pass, 0 fail, 0 skipped**; `AD_HOC_PASS focused_changed_behavior tests=104 pass=104 fail=0 skip=0`; `TEMP_SCRIPT_REMOVED True`.
- Focused fixture migration regression run: **92 tests, 92 pass, 0 fail, 0 skipped**.
- Focused final behavioral/architecture run (`canonicalEventTimeModel.test.ts` and `previewDeploymentGatingArchitecture.test.ts`): **12 tests, 12 pass, 0 fail, 0 skipped**.
- Canonical final server suite: `unset DATABASE_URL DEV_DATABASE_URL; NODE_ENV=development npm test`; disposable `goodhours-test-pg` at `127.0.0.1:5433/goodhours_test`; **442 tests, 441 pass, 0 fail, 1 skipped**, duration `66090.789728 ms`. The single skip is pre-existing; no test failures remain.
- Server build: `npm run build` — PASS (`tsc`).
- Client build: `npm run build` — PASS (`tsc -b && vite build`, 416 modules transformed).
- Prisma validation/status with `.env.test` loaded without printing values and `DEV_DATABASE_URL` bound to the same URL: schema valid; **69 migrations found; database schema up to date**.

## Fixture migration disposition

The initial canonical run was **442 tests / 358 pass / 83 fail / 1 skip**. Every failure was traced to the new authenticated-session eligibility invariant: authorized synthetic users and mocked authenticated principals lacked an explicit positive attestation. Fixtures were migrated narrowly with `eligibilityAttestation: { eligible13Plus: true }`; the real database fixture uses a nested persisted attestation with `method: "test_fixture"`. Missing/false-attestation tests and pending/rejected-school negative cases were not marked eligible. One unrelated architecture test was corrected to accept the shipped combined named import while retaining the production-gating assertions; no production guard was weakened.

## Initial inventory

- Password signup: `server/src/routes/auth.ts` (`POST /api/auth/signup`); creates `User` and school.
- Password login/session: `server/src/routes/auth.ts`, `server/src/middleware/auth.ts`.
- Google identity/login and new school registration: `server/src/routes/googleAuth.ts`.
- Student and beneficiary invitations: `server/src/routes/invitations.ts`.
- Roster teacher pre-provisioning: `server/src/routes/cohorts.ts`, `server/src/routes/schools.ts`.
- LMS user provisioning: `server/src/services/canvasIntegration.ts`, `server/src/services/googleClassroomIntegration.ts`.
- Other JWT issuance: `server/src/routes/auth.ts` impersonation/admin paths and invitation routes.
- Client public entry points: `client/src/pages/Signup.tsx`, login, school registration, and invitation onboarding pages.

## Evidence log

- 2026-09-05 initial state: branch `terra/fix-sol-findings-20260826`, HEAD `9c32bb6`, dirty tree includes the eligibility implementation, migration, tests, and unrelated pre-existing work. Node `v22.23.2`; `goodhours-test-pg` is running. No test totals are claimed until the canonical test command completes against the disposable database.

## Evidence / outstanding boundaries

No production, deployment, real-student, or legal-review claims are made by this engineering artifact. Any fixture migration must add explicit positive `eligible13Plus: true` plus persisted attestation only to authorized synthetic users; missing/false-age and rejected/inactive-school tests remain negative cases. Security guards must not be weakened to make unrelated fixtures pass.
