# GoodHours Concurrency and Owner Lifecycle Verification — 2026-09-05

## Scope and status

Independent verification was completed on branch `terra/fix-sol-findings-20260826` in the pre-existing dirty worktree. No production database, credentials, deployment, commit, reset, stash, or branch switch was used. The disposable database was PostgreSQL `127.0.0.1/goodhours_test` from `.env.test`; URL contents were not printed.

| Gate | Result | Evidence |
|---|---|---|
| Student invitation real HTTP acceptance | PASS | Focused suite test 1: HTTP responses 201/409; one user, membership, eligibility attestation, invitation-derived hour row |
| Concurrent same-invitation acceptance | PASS | Two simultaneous POSTs produced exactly one 201 and one 409; database counts were exactly one for account, membership, attestation, and `sourceStudentInvitationId` row |
| Cross-school denial/no writes | PASS | Existing student assigned to a different school received 409; invitation remained PENDING, existing school remained unchanged, and no membership/hour row was created |
| Injected dependent-write rollback | PASS | Pre-existing unique lineage row forced the dependent write to fail; HTTP 500; created user/membership and invitation claim were rolled back |
| Expired/replay acceptance | PASS | Expired POST returned 400 without a user; accepted replay returned 400 without additional writes |
| Owner approval GET non-mutation | PASS | GET returned 200; status and `ownershipApprovalTokenUsedAt` were unchanged |
| Concurrent owner approve/reject | PASS | Simultaneous POST decisions produced exactly one 200 and one 409; final school was reviewed, token consumed/null, and stale session was denied with 401 (accepted contract is 401 or 403) |
| Approved owner protected access | PASS | After approved POST, a freshly signed owner session received HTTP 200 from `/api/reports/school` |
| Pending-school protected denial | PASS in public/preview-mode proof | With `VERCEL_ENV=preview`, pending school admin received HTTP 403 from `/api/reports/school`; local development intentionally treats SCHOOL_ADMIN as an internal fixture operator, so canonical local full-suite expectation is 200 for that one fixture |
| Rejected email block retention after school deletion | PASS | Rejection created the hashed block; cleanup deleted the school/user while the block remained and was then explicitly removed by the test cleanup |
| Focused lifecycle suite | PASS | `VERCEL_ENV=preview NODE_ENV=development node --env-file=.env.test --import tsx --test tests/invitationOwnerLifecycle.integration.test.ts`: **7 tests, 7 pass, 0 fail, 0 skip** |
| Canonical full server suite | PASS | `env -u DATABASE_URL -u DEV_DATABASE_URL -u APP_ENV -u VERCEL_ENV NODE_ENV=development npm test`: **451 tests, 450 pass, 0 fail, 1 skip** |
| Server build | PASS | `npm run build` / TypeScript compiler exit 0 |
| Client build | PASS | `npm run build` / Vite exit 0 (`✓ built in 8.76s`) |
| Live DB → schema diff | PASS | `prisma migrate diff --from-url ... --to-schema-datamodel ... --script`: 32 bytes, empty migration script |
| Fresh migrations/shadow DB → schema diff | PASS | Fresh shadow `goodhours_shadow_verify_20260905` replayed migration history; diff was 32 bytes, same SHA as live diff (`e69c9f21be2b53770b13ea52bf6c4f304a9fc86b41f1e932729ec2de45574341`) |

## Findings and changes

* The worker's special revoked SCHOOL_ADMIN response was not retained. Revoked tokens now use the uniform 401 invalid/expired-token response; the lifecycle regression accepts the documented 401/403 denial contract for rejected/stale sessions.
* The lifecycle test cleanup was corrected to remove audit logs, school beneficiary approvals, classroom references, and ownership blocks in dependency-safe order. This prevents cleanup FK failures from masquerading as behavioral failures.
* Added a real approved-owner HTTP access assertion and a cross-school existing-account invitation regression.
* No production behavior change was required for the invitation or ownership transaction paths; the existing serializable transaction and unique invitation-lineage constraint passed the real PostgreSQL race/rollback checks.
* The focused pending-school 403 proof is intentionally run with `VERCEL_ENV=preview`, because the existing local-only `isInternalAdminUser` fallback treats local SCHOOL_ADMIN fixtures as internal operators. The canonical full suite was run with inherited deployment variables unset and passed under its intended local behavior.

## Files modified by this verification

* `server/tests/invitationOwnerLifecycle.integration.test.ts`
* `server/src/middleware/auth.ts` (removed the worker-only special-case response; all other pre-existing dirty auth changes preserved)
* `docs/qa/CONCURRENCY_LIFECYCLE_VERIFICATION_2026-09-05.md`

All other dirty files in the repository predated this verification and were not attributed to it.
