# Canvas Integration QA Results

Date: 2026-05-10

## Scope

- Canvas integration only
- single-school pilot scope only
- Development environment only
- Fresh local Postgres with `FIELD_ENCRYPTION_KEY` set
- Real implemented API, OAuth callback, sync, and settings UI flow

Out of scope:

- Google Classroom
- Production credentials
- Real Canvas school tenant validation
- District-wide Canvas deployment

## Executive Result

Overall status: PASS for the current Canvas development implementation.

The validated flow now includes:

- school-admin-only Canvas connect/disconnect routes
- real development OAuth URL + callback handling
- encrypted token persistence
- refresh-before-sync behavior
- revoked-access detection
- section-to-cohort sync
- teacher assignment sync
- student invitation and existing-user linking
- multi-cohort student membership persistence
- sync job/error logging
- settings-page UI actions for connect, preview, apply, and disconnect
- explicit single-school scope signaling in the status API and settings UI

## Environment

- Database: fresh local Postgres QA database
- Server env:
  - `DATABASE_URL` set to a local Postgres QA database
  - `DEV_DATABASE_URL` set to the same local Postgres QA database
  - `FIELD_ENCRYPTION_KEY` set to a valid 64-hex-char key
  - `APP_ENV=development`
  - `CANVAS_CLIENT_ID` set
  - `CANVAS_CLIENT_SECRET` set
  - `CANVAS_CALLBACK_URL=http://localhost:3001/api/integrations/canvas/oauth/callback`
- API URL: `http://localhost:3001`
- Client URL: `http://127.0.0.1:5174`

## Setup And Build Validation

Result: PASS

Commands executed:

```bash
cd /Users/abhay/RTB/GoodHours
DATABASE_URL="$LOCAL_QA_DATABASE_URL" npx prisma generate --schema=server/prisma/schema.prisma
DATABASE_URL="$LOCAL_QA_DATABASE_URL" npx prisma migrate deploy --schema=server/prisma/schema.prisma
DATABASE_URL="$LOCAL_QA_DATABASE_URL" npx tsx server/prisma/seed-playwright.ts
npm --prefix server run build
npm --prefix client run build
API_BASE_URL=http://localhost:3001 npx playwright test tests/canvas-integration.spec.ts tests/canvas-oauth.spec.ts
UI_BASE_URL=http://127.0.0.1:5174 npx playwright test tests/canvas-settings-ui.spec.ts
```

Observed:

- migration replay succeeded on a fresh DB via `prisma migrate deploy`
- seed completed successfully
- server build passed
- client build passed
- API tests passed: `11 passed`
- UI test passed: `1 passed`
- total validated suite: `12 passed`

## Persistence Validation

Result: PASS

Verified in Postgres:

- `IntegrationConnection` row exists for provider `CANVAS`
- connection is bound to exactly one `schoolId`
- `credentialsEncrypted` is stored with `enc:v1:` prefix
- refreshed token payload is persisted after OAuth callback
- `IntegrationSyncJob` rows are created for preview and apply actions
- `IntegrationExternalMapping` rows exist for sections, users, and enrollments
- `IntegrationSyncError` rows are created for duplicate-email collisions
- `StudentCohortMembership` rows are created for synced student enrollments

Representative observations:

- connection status transitions through `CONNECTED` and `ERROR`
- latest sync status: `COMPLETED`
- duplicate error code present: `DUPLICATE_STUDENT_EMAIL`
- membership rows exist for multi-section students

## Browser UI Validation

Result: PASS

Validated in the running app:

1. Logged in as seeded school admin
2. Opened `/settings`
3. Opened the `Integrations` tab
4. Confirmed Canvas section renders
5. Exercised connect flow
6. Ran preview sync
7. Ran apply sync
8. Verified job/error/status rendering
9. Verified the old session banner no longer overlays the page

Observed UI behavior:

- connected/disconnected state renders correctly
- mock and OAuth connection modes render correctly
- single-school scope is stated clearly in the settings UI
- preview/apply actions work
- sync summary renders
- recent jobs render
- recent errors render
- callback errors are surfaced back to the settings page

## Verification Matrix

### 1. Connection setup

Result: PASS

- school admin can connect Canvas
- connection metadata persists
- reconnect updates the existing school-bound connection
- disconnect clears stored encrypted credentials and sets status to `DISCONNECTED`

### 2. Token handling

Result: PASS

- OAuth callback stores encrypted token payload
- sync paths use stored credentials without returning them to the client
- status responses omit credential payload
- disconnect clears stored credentials

### 3. Refresh behavior

Result: PASS in development mock OAuth flow

- sync refreshes token state before provider access
- refreshed token payload persists

### 4. Revoked access handling

Result: PASS in development mock OAuth flow

- revoked access is detected during sync
- connection is marked errored
- error state is visible through the API/UI

### 5. Invalid credential handling

Result: PASS in development mock OAuth flow

- invalid OAuth callback code is rejected
- failure is surfaced back to the settings page

### 6. Sync behavior

Result: PASS

Verified:

- Canvas courses/sections map to GoodHours cohorts
- renamed Canvas courses/sections update mapped cohorts
- archived/deleted sections archive mapped cohorts
- teachers map to `CohortTeacherAssignment`
- students map by external ID first, then email
- existing GoodHours student can be linked
- new students become `StudentInvitation` records when needed
- multi-section students create `StudentCohortMembership` rows

### 7. Duplicate and lifecycle handling

Result: PASS for implemented cases

Verified:

- duplicate student email collision is logged as `DUPLICATE_STUDENT_EMAIL`
- existing user linking works
- renamed course reconciliation works
- archived/deleted section reconciliation works
- upstream single-student removal revokes pending invitations without cross-cohort damage

### 8. Safety and tenant isolation

Result: PASS

Verified:

- routes require `SCHOOL_ADMIN`
- non-admin users are blocked
- school B cannot view or sync school A’s Canvas connection
- the API advertises `integrationScope=SINGLE_SCHOOL`
- the admin UI describes one Canvas tenant per GoodHours school
- integration tables are school-bound
- sync operations only mutate records within the caller’s school

### 9. Audit and error recording

Result: PASS

Verified:

- `DataAccessLog` rows are written for:
  - `CANVAS_CONNECT`
  - `CANVAS_SYNC_PREVIEW`
  - `CANVAS_SYNC_APPLY`
  - `CANVAS_DISCONNECT`
- sync jobs and sync errors are queryable from the UI/API

## School-Scope Rollout Interpretation

This validation is for school-controlled pilots only.

- one GoodHours school maps to one Canvas school tenant
- the seeded and simulated data represent school-level rosters, not district-wide federated setups
- no district admin workflow, cross-school tenant routing, or district-wide roster consolidation was validated

## Remaining Risks

- The broader product still has legacy assumptions around primary `user.cohortId`; the highest-signal reporting, access, reminder, and student-facing paths were migrated, but the entire codebase is not yet fully membership-native.
- OAuth and API behavior were validated against the local mock Canvas OAuth/API server, not a real school tenant.
- Large client bundles remain a performance concern, though not an integration correctness issue.
