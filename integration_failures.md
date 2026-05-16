# Canvas Integration Remaining Failures And Gaps

Date: 2026-05-10

These are the remaining material gaps after the current validation pass. Earlier blockers around OAuth lifecycle, student-removal reconciliation, migration replay, and the settings-page banner are now closed.

## F1. Product-wide membership migration is incomplete

Severity: medium

Observed:

- Canvas sync now supports multi-cohort student memberships
- reports, reminders, launch-center, verification, school exports, self-submissions, and student dashboard/settings were updated
- some legacy app paths still assume primary `user.cohortId`

Impact:

- behavior can still diverge in untouched features when a student belongs to multiple cohorts

Status:

- partially resolved
- no failing test currently demonstrates a break in the validated Canvas path

## F2. Validation is still against a mock Canvas provider

Severity: medium

Observed:

- OAuth, refresh, revoke, and invalid-credential paths are implemented and tested
- provider responses still come from the local mock/sandbox server, not a real Canvas tenant

Impact:

- school-tenant-specific OAuth configuration issues, scopes, pagination quirks, and provider edge cases remain unvalidated

Status:

- expected for development scope

## F3. School-scope only by design

Severity: low

Observed:

- the current implementation and validation target one GoodHours school connecting to one Canvas school tenant
- there is no district-wide administration, tenant fan-out, or multi-school shared connection model

Impact:

- this is correct for the current product direction
- any future district rollout would need a separate architecture and validation pass instead of reusing assumptions from this pilot path

Status:

- intentional
## F4. Client bundle size remains high

Severity: low

Observed:

- the production client build still emits a large main bundle warning

Impact:

- potential performance drag for the settings and student-facing UX

Status:

- unrelated to Canvas correctness, but worth addressing

## Passed Areas

These are no longer failures:

- real development OAuth lifecycle behavior
- revoked-token error handling
- invalid OAuth callback handling
- multi-cohort sync persistence
- upstream single-student removal reconciliation
- migration replay via `prisma migrate deploy`
- settings-page auth-banner overlap
- school-admin authorization
- non-admin route blocking
- school isolation
- encrypted connection storage
- sync job and sync error persistence
- renamed course reconciliation
- archived/deleted section reconciliation
- duplicate email error logging
- existing user linking
- connect, preview, apply, and disconnect UI flow
