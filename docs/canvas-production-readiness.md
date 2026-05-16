# Canvas Production Readiness

Date: 2026-05-11

## What Changed

The Canvas integration is now production-capable at the code level instead of being hard-disabled outside development.

Key changes:

- live Canvas OAuth and sync paths are allowed in production-like environments
- mock mode is explicitly gated behind `CANVAS_ENABLE_MOCK=true`
- Canvas base URLs must use HTTPS in production-like environments
- live requests now use bounded timeouts
- status responses expose integration capabilities so the UI can reflect whether mock mode is available and that the supported rollout shape is single-school
- live course sync now includes unpublished courses in addition to available/completed courses

## Rollout Scope

This implementation is intentionally scoped to individual school pilots, not district-wide deployment.

Operational contract:

- one GoodHours school connects to one Canvas school tenant
- one school admin team owns the connection for that school
- sync mutates only that school's cohorts, teacher assignments, invitations, user links, and memberships
- CSV onboarding remains the fallback path if Canvas is unavailable or not approved

## Required Environment Variables

Server:

- `CANVAS_CLIENT_ID`
- `CANVAS_CLIENT_SECRET`
- `CANVAS_CALLBACK_URL`
- `FIELD_ENCRYPTION_KEY`
- `JWT_SECRET`

Optional server controls:

- `CANVAS_ENABLE_MOCK=false`
  - recommended in production
- `CANVAS_REQUEST_TIMEOUT_MS=15000`
- `CANVAS_PAGE_SIZE=100`

## Recommended Production Settings

- set `CANVAS_ENABLE_MOCK=false`
- use an HTTPS `CANVAS_CALLBACK_URL`
- use a dedicated production Canvas developer key for the school's Canvas tenant
- store secrets only in the deployment platform secret manager
- rotate `CANVAS_CLIENT_SECRET` through your normal secret rotation process
- set `FIELD_ENCRYPTION_KEY` to a stable, high-entropy value before any real connection is created

## Canvas API Expectations

The current implementation uses:

- OAuth 2.0 authorization code flow
- refresh-token rotation when access tokens expire
- paginated `courses`, `sections`, and `enrollments` reads
- teacher and student roster sync from enrollments

Relevant official references:

- [Canvas LMS API Overview](https://developerdocs.instructure.com/services/canvas)
- [Canvas OAuth2](https://canvas.instructure.com/doc/api/file.oauth.html)
- [Canvas Sections API](https://developerdocs.instructure.com/services/canvas/resources/sections)
- [Canvas Enrollments API](https://developerdocs.instructure.com/services/canvas/resources/enrollments)

## Remaining Non-Code Production Work

The code is no longer the main blocker. The remaining production tasks are operational:

1. Validate against a real Canvas sandbox or pilot school tenant.
2. Confirm the production developer key has the scopes needed by the current sync endpoints.
3. Finish the repo-wide migration away from legacy primary `cohortId` assumptions.
4. Complete school privacy/legal onboarding before using real student data.

Operational follow-up now implemented:

- production startup validation for Canvas env completeness and HTTPS callback enforcement
- school-admin Canvas ops summary with last-24h failure counters and warning state
- internal Canvas ops endpoint for cron/monitoring integrations
- deployment and real-tenant test runbook in [docs/canvas-operations-runbook.md](/Users/abhay/RTB/GoodHours/docs/canvas-operations-runbook.md:1)

## Validation Completed

The updated code passed:

- server build
- client build
- Canvas integration API tests
- Canvas OAuth tests
- Canvas settings UI test

This confirms that the production-capable code path did not regress the existing integration foundation.
