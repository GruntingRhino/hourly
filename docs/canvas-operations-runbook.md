# Canvas Operations Runbook

Date: 2026-05-11

## Purpose

This runbook covers the remaining operational work for the GoodHours Canvas integration in the current single-school rollout model.

Scope:

- one GoodHours school
- one Canvas school tenant
- school-admin-managed OAuth connection
- roster sync into cohorts, teacher assignments, invitations, and memberships

## Production Environment Checklist

Set these server environment variables:

- `CANVAS_CLIENT_ID`
- `CANVAS_CLIENT_SECRET`
- `CANVAS_CALLBACK_URL`
- `FIELD_ENCRYPTION_KEY`
- `JWT_SECRET`
- `CRON_SECRET`

Recommended:

- `CANVAS_ENABLE_MOCK=false`
- `CANVAS_REQUEST_TIMEOUT_MS=15000`
- `CANVAS_PAGE_SIZE=100`
- `EMAIL_DELIVERY_MODE=send`

Hard requirements enforced by startup validation in production-like environments:

- `FIELD_ENCRYPTION_KEY` must be 64 hex characters
- `CRON_SECRET` must be present
- `CANVAS_ENABLE_MOCK` must not be `true`
- if any Canvas OAuth env var is set, all three must be set
- `CANVAS_CALLBACK_URL` must use HTTPS

## Operational Endpoints

Health:

- `GET /api/health`

Internal reminder trigger:

- `GET /api/internal/reminders/run`
- `POST /api/internal/reminders/run`

Internal Canvas ops snapshot:

- `GET /api/internal/canvas/ops`
- optional query: `schoolId=<goodhours-school-id>`
- production access requires `Authorization: Bearer <CRON_SECRET>`

School-admin Canvas status:

- `GET /api/integrations/canvas/status`
- `GET /api/integrations/canvas/errors`
- `GET /api/integrations/canvas/ops`

## What To Monitor

Use `/api/internal/canvas/ops` as the canonical machine-readable status surface.

Watch these fields:

- `totals.errored`
- `totals.repeatedFailures`
- `totals.staleSyncs`
- per-connection `ops.recentJobFailures24h`
- per-connection `ops.recentSyncErrors24h`
- per-connection `ops.tokenRefreshFailures24h`
- per-connection `ops.warnings`

Alert thresholds:

- alert immediately if any connection enters `ERROR`
- alert if `ops.tokenRefreshFailures24h > 0`
- alert if `ops.recentJobFailures24h >= 3`
- alert if `ops.staleSync === true` for an OAuth connection

## Support Triage

If a school reports Canvas sync problems:

1. Open GoodHours school settings and check the Canvas warning banner.
2. Inspect recent jobs and recent sync errors.
3. Call `/api/internal/canvas/ops?schoolId=<id>`.
4. Classify the issue:
   - OAuth setup problem
   - revoked developer key or revoked user authorization
   - missing Canvas scopes
   - upstream Canvas roster/data problem
   - duplicate email / roster conflict
5. If the issue is credentials or scopes, disconnect and reconnect only after the school confirms the developer key is still enabled.

## Secret Rotation

Rotate:

- `CANVAS_CLIENT_SECRET`
- `FIELD_ENCRYPTION_KEY` only with a planned credential migration window
- `CRON_SECRET`

Rules:

- rotate `CANVAS_CLIENT_SECRET` through the deployment secret manager only
- after rotating `CANVAS_CLIENT_SECRET`, run a real OAuth reconnect test with a school admin
- do not rotate `FIELD_ENCRYPTION_KEY` casually; existing encrypted Canvas credentials depend on it

## Real Canvas Tenant Test Plan

This is the safest way to validate a real tenant when you gain access.

Preferred environments:

1. the school's Canvas beta or test environment
2. a pilot school production tenant with test courses and test users only

Ask the school's Canvas root admin for:

- the Canvas base URL
- a Canvas developer key for GoodHours
- the exact redirect URI registered on that developer key
- the enabled scopes for the GoodHours key
- a school admin test account
- at least:
  - 2 courses
  - 3 sections
  - 2 teachers
  - 4 students
  - 1 archived/completed section
  - 1 renamed course or section change during validation

Validation steps:

1. Set production-like env vars in a non-production GoodHours deployment.
2. Set `CANVAS_ENABLE_MOCK=false`.
3. Confirm `CANVAS_CALLBACK_URL` exactly matches the redirect URI on the Canvas developer key.
4. As a GoodHours school admin, open School Settings → Integrations.
5. Connect Canvas with the real school tenant base URL.
6. Complete OAuth using the school admin test Canvas account.
7. Run preview sync and confirm:
   - courses/sections map to expected cohorts
   - teachers map to teacher assignments
   - students link by external ID or email
8. Run apply sync.
9. Check `/api/integrations/canvas/status`, `/api/integrations/canvas/errors`, and `/api/integrations/canvas/ops`.
10. In Canvas, change one section name and archive one section.
11. Re-run preview and apply.
12. Confirm rename and archive reconciliation works.
13. Revoke the app authorization or disable the developer key.
14. Re-run preview and confirm GoodHours surfaces an error state cleanly.

## How To Test A Real Canvas Tenant Without Broad School Access

If you personally do not have a Canvas user:

- ask the school Canvas admin to create one dedicated admin test user for the pilot school
- or ask them to screen-share the OAuth authorization step while you watch the GoodHours side
- or have them complete the OAuth step themselves while you monitor GoodHours logs and the Canvas ops endpoint

The minimum viable real-tenant test does not require broad district access. It requires one school-scoped Canvas admin account and a developer key enabled for that school's root account.

## Official Canvas References

- [Canvas LMS API Overview](https://developerdocs.instructure.com/services/canvas)
- [Canvas OAuth2 Overview](https://developerdocs.instructure.com/services/canvas/oauth2/file.oauth)
- [Canvas OAuth2 Endpoints](https://developerdocs.instructure.com/services/canvas/oauth2/file.oauth_endpoints)
- [Canvas Developer Keys](https://developerdocs.instructure.com/services/canvas/oauth2/file.developer_keys)
- [Canvas Developer Keys API](https://developerdocs.instructure.com/services/canvas/resources/developer_keys)

Relevant official points:

- developer keys created in a root account work for that account and its sub-accounts
- developer key scopes are controlled by the Canvas root admin
- if a scope is removed, existing tokens can be invalidated
- the OAuth redirect URI domain must match the URI registered on the developer key
- Canvas supports non-production key usage via `test_cluster_only` for test/beta environments
