# Canvas Integration Security Findings

Date: 2026-05-10

## Scope

- implemented Canvas integration
- fresh local Postgres database
- `FIELD_ENCRYPTION_KEY` enabled
- development environment only

## Security Conclusion

Current security posture: ACCEPTABLE FOR DEVELOPMENT PILOT VALIDATION

Production posture: NOT READY

The Canvas implementation now has the minimum serious controls expected for a development pilot:

- school-bound integration state
- single-school rollout scope made explicit in API/UI behavior
- school-admin-only route surface
- encrypted credential storage
- OAuth callback handling with refresh-before-sync behavior
- revoked-token and invalid-code handling
- sync job and sync error persistence
- audit-log coverage for integration actions
- school isolation on status, preview, apply, and disconnect flows
- school-controlled parent/guardian sharing posture because self-service parent progress links are disabled
- membership-aware school scoping across the highest-signal student access paths

## Findings

### 1. Credential payload is encrypted at rest

Severity: positive control

Observed:

- `IntegrationConnection.credentialsEncrypted` stored with `enc:v1:` prefix
- OAuth token payload is not returned by status APIs
- disconnect clears stored credentials

Assessment:

- correct for the implemented development flow

### 2. Canvas route surface enforces role and school isolation

Severity: positive control

Observed:

- routes require `authenticate` and `requireRole("SCHOOL_ADMIN")`
- callers derive school context from their own session, not client-provided school IDs
- school B cannot view or act on school A connection state
- integration tables are keyed by `schoolId`
- status capabilities explicitly advertise `integrationScope=SINGLE_SCHOOL`

Assessment:

- no cross-school leakage was observed in API or UI validation
- the product surface now better matches the real trust boundary: one school, one Canvas tenant

### 3. OAuth failure paths are handled explicitly

Severity: positive control

Observed:

- invalid OAuth callback code is rejected
- revoked Canvas access marks the connection errored
- error state is exposed to the admin UI without exposing credential payload

Assessment:

- a meaningful improvement over the earlier mock-only placeholder state

### 4. Sync operations are auditable

Severity: positive control

Observed:

- `IntegrationSyncJob` records preview/apply runs
- `IntegrationSyncError` records sync failures such as duplicate-email collisions
- `DataAccessLog` contains integration actions including connect, preview, apply, and disconnect

Assessment:

- adequate auditability for the current development implementation

### 5. Multi-membership architecture is improved but not fully normalized across the app

Severity: medium

Observed:

- `StudentCohortMembership` now exists and is used by the Canvas sync path
- several downstream reads were migrated to membership-aware access
- some legacy features still center on primary `user.cohortId`

Impact:

- authorization and data-consistency edge cases can still survive in untouched paths as LMS usage expands

Assessment:

- not a direct exploit in the validated path, but still a real correctness and security pressure point

### 6. Audit logging remains best-effort

Severity: low

Observed:

- `logDataAccess()` still swallows persistence failures

Impact:

- transient DB failures can drop audit records without failing the request

Assessment:

- defensible for availability, weak for stronger compliance guarantees

## No Critical Exploit Was Observed In The Validated Flow

Validated negatives:

- no hardcoded production secret was introduced
- no production-only path was enabled
- no non-admin access to Canvas routes was observed
- no cross-school connection disclosure was observed
- no plaintext credential storage was observed with `FIELD_ENCRYPTION_KEY` set

## Required Before Any Production Claim

1. Validate against a real Canvas sandbox or pilot school tenant.
2. Finish product-wide migration from primary `cohortId` assumptions to membership-aware reads.
3. Decide whether audit logging must become fail-closed or retry-backed for compliance.
4. Add operational monitoring around sync failures, token refresh failures, and repeated provider errors.
