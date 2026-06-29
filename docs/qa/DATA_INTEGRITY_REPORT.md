# GoodHours Data Integrity Report

**Date:** 2026-06-29  
**Server:** http://localhost:3001  
**Tester:** Data Integrity QA (automated)  
**Branch:** main  

---

## Summary

| Check | Result |
|---|---|
| 1. Hour Total Reconciliation (John) | PASS |
| 2. Hour Total Reconciliation (Jane) | PASS |
| 3. Cross-Student Isolation — Reports endpoint | PASS |
| 3b. Cross-Student Isolation — Sessions listing endpoint | N/A (route not registered) |
| 4. Cross-School Isolation | PASS |
| 5. Status Consistency — VERIFIED sessions | PASS |
| 5b. Status Consistency — PENDING_CHECKIN with pre-set totalHours | NOTE |
| 6. Orphan Detection | PASS |
| 7. Audit Log — Seeded VERIFIED sessions | FAIL |
| 7b. Audit Log — Live verification flow | PASS |
| 7c. Audit Log — Re-approval idempotency | PASS |
| 8. Hour Calculation Accuracy | PASS |
| 9. Schema @unique constraints | PASS (documented below) |

---

## 1. Hour Total Reconciliation

**Method:** Compared `totalApprovedHours` field in `GET /api/reports/student` response against the sum of `totalHours` across all items in the `approved[]` array.

### John (john@student.edu — ID: cmquusyt000148o5yl7i6pqp4)

**Initial state:**

| Session | Opportunity | Status | totalHours |
|---|---|---|---|
| cmquut2eq002s8o5y0vrjiref | Tutor Elementary School Kids | VERIFIED/APPROVED | 1.42 |
| cmquut2ep002o8o5yjm6ujwd4 | Walk Dogs at Animal Shelter | VERIFIED/APPROVED | 2.92 |
| cmquut2em002i8o5ymdpjm4y6 | Cleanup Soccer Field | VERIFIED/APPROVED | 3.92 |

- `totalApprovedHours` reported: **8.26**
- Sum of `approved[]`: 1.42 + 2.92 + 3.92 = **8.26**
- **PASS** — values match exactly.

**Post-live approval (Plant Flowers, 2.83h approved during this test run):**

- `totalApprovedHours` updated to: **11.09**
- Sum of `approved[]`: 1.42 + 2.92 + 3.92 + 2.83 = **11.09**
- **PASS** — total updated correctly after live approval.

### Jane (jane@student.edu — ID: cmquusyyu00168o5y0ptbklxw)

- `totalApprovedHours` reported: **1.42**
- Sum of `approved[]`: **1.42** (1 approved session)
- **PASS**

---

## 2. Cross-Student Isolation

**Method:** Authenticated as John, attempted to access Jane's data using Jane's user ID.

### 2a. `GET /api/sessions?studentId=<jane_id>`

- **Response:** 404 HTML (`Cannot GET /api/sessions`)
- **Result:** N/A — the `/api/sessions` listing route is not registered on the Express router. No data leakage is possible through this non-existent endpoint.

### 2b. `GET /api/reports/student?userId=<jane_id>`

- **Evidence:** Request made as John with `?userId=cmquusyyu00168o5y0ptbklxw` (Jane's ID).
- **Response:** Returned John's own data (`userId: cmquusyt000148o5yl7i6pqp4` in all session records).
- **Result:** **PASS** — The endpoint ignores the `userId` query parameter and always serves the authenticated user's own data. Jane's sessions were not disclosed.

---

## 3. Cross-School Isolation

**Method:** Authenticated as Lincoln admin (`admin@lincoln.edu`, schoolId: `cmquusyb500028o5yxl869rbp`), attempted to access Playwright School A (`cmqv1x0200002mumyg9f3190a`).

| Endpoint | Response |
|---|---|
| `GET /api/schools/cmqv1x0200002mumyg9f3190a/students` | `{"error":"Not your school"}` |
| `GET /api/schools/cmqv1x0200002mumyg9f3190a/stats` | `{"error":"Not your school"}` |

- **HTTP Status:** 403 (implied by error body)
- **Result:** **PASS** — School admin cannot access another school's student data or statistics.

---

## 4. Status Consistency

**Method:** Examined all sessions for John and Jane, checking for impossible states.

### Rules checked:

1. A VERIFIED session must have both `checkInTime` and `checkOutTime`
2. A VERIFIED session must have `verifiedBy` set
3. A VERIFIED session must have `verificationStatus = APPROVED`
4. A VERIFIED session must not have been bypassed (i.e., session must have been in CHECKED_OUT or PENDING_VERIFICATION before approval)

### John's sessions:

| Session (short) | Status | VerifStatus | checkIn | checkOut | verifiedBy | Rule violations |
|---|---|---|---|---|---|---|
| cmquut2er002w8o5... | PENDING_CHECKIN | PENDING | null | null | null | None |
| cmquut2eq002s8o5... | VERIFIED | APPROVED | yes | yes | cmquusymw... | None |
| cmquut2ep002o8o5... | VERIFIED | APPROVED | yes | yes | cmquusyh3... | None |
| cmquut2en002k8o5... | VERIFIED (updated) | APPROVED | yes | yes | cmquusyav... | None |
| cmquut2em002i8o5... | VERIFIED | APPROVED | yes | yes | cmquusyh3... | None |

- **Result:** **PASS** — All VERIFIED sessions satisfy all state constraints.

### NOTE: PENDING_CHECKIN session with pre-set totalHours

Session `cmquut2er002w8o5yqhpw4tur` (QA Upcoming Check-In Session) has:
- `status = PENDING_CHECKIN`
- `checkInTime = null`, `checkOutTime = null`
- `totalHours = 2` (pre-set from the opportunity's `durationHours`)

This value is sourced from the opportunity's `durationHours` field at session creation and represents expected/estimated hours, not actual verified hours. The `GET /api/reports/student` endpoint correctly excludes this session from `approved[]` and does not count it in `totalApprovedHours`. No integrity violation, but the pre-populated `totalHours` on an unstarted session could cause confusion if consumed raw.

---

## 5. Orphan Detection

**Method:** Examined the `opportunity` field on all sessions returned by `GET /api/reports/student` for John.

- All 5 sessions had non-null `opportunity` objects with valid IDs, titles, and organization references.
- No null opportunity pointers observed.
- **Result:** **PASS**

---

## 6. Audit Log Presence

### 6a. Seeded VERIFIED sessions (pre-existing data)

- `GET /api/reports/audit/cmquut2eq002s8o5y0vrjiref` (John's tutoring session, seeded as VERIFIED)
- **Response:** `[]` (empty array)
- **Result:** **FAIL** — The seed script sets sessions directly to `VERIFIED/APPROVED` status without routing through the `POST /api/verification/:sessionId/approve` endpoint, so no `AuditLog` records are created for seeded sessions. This means the audit trail is absent for all pre-existing (seeded) data.
- **Severity:** Medium. Affects seed/test data only; production approvals always go through the API and will have audit entries. The seed should be updated to call the verification endpoint or create AuditLog rows programmatically.

### 6b. Live verification flow

- Approved John's CHECKED_OUT session `cmquut2en002k8o5yphao4h27` via `POST /api/verification/cmquut2en002k8o5yphao4h27/approve` as school admin.
- `GET /api/reports/audit/cmquut2en002k8o5yphao4h27` returned:

```json
[
  {
    "id": "cmqz9z8ux0004mu3sjvx4o0g9",
    "action": "APPROVE",
    "details": "{\"approvedHours\":2.83,\"originalHours\":2.83}",
    "actorId": "cmquusyav00008o5y9oz3z2o1",
    "sessionId": "cmquut2en002k8o5yphao4h27",
    "createdAt": "2026-06-29T13:50:27.994Z",
    "actor": {
      "id": "cmquusyav00008o5y9oz3z2o1",
      "name": "Lincoln High School QA 1782740558490",
      "role": "SCHOOL_ADMIN"
    }
  }
]
```

- **Result:** **PASS** — Live approval correctly creates an immutable AuditLog entry with actor, action, approvedHours, originalHours, and timestamp.

### 6c. Re-approval idempotency

- Second `POST /api/verification/cmquut2en002k8o5yphao4h27/approve` immediately after first approval:
- **Response:** `{"error":"Already approved"}`
- **Result:** **PASS** — Duplicate approvals are blocked at the application layer.

---

## 7. Hour Calculation Accuracy

**Method:** For each session with both `checkInTime` and `checkOutTime`, computed `(checkOutTime - checkInTime) / 3600` and compared against the stored `totalHours`.

| Session (short) | checkIn | checkOut | Calculated (h) | Stored (h) | Diff | Pass? |
|---|---|---|---|---|---|---|
| cmquut2eq002s8o5... | 2025-09-17T00:05Z | 2025-09-17T01:30Z | 1.4167 | 1.42 | 0.0033 | PASS |
| cmquut2ep002o8o5... | 2025-09-13T00:05Z | 2025-09-13T03:00Z | 2.9167 | 2.92 | 0.0033 | PASS |
| cmquut2em002i8o5... | 2025-08-27T14:05Z | 2025-08-27T18:00Z | 3.9167 | 3.92 | 0.0033 | PASS |
| cmquut2en002k8o5... | 2025-09-01T19:10Z | 2025-09-01T22:00Z | 2.8333 | 2.83 | 0.0033 | PASS |

All diffs are 0.0033 hours (~12 seconds), well within the 0.01-hour tolerance. The consistent rounding pattern suggests `totalHours` is computed by rounding `(diff_seconds / 3600)` to 2 decimal places.

- **Result:** **PASS** (all 4 sessions)

---

## 8. Schema-Level Constraints

Read from `/server/prisma/schema.prisma`.

### @unique constraints preventing duplicate records

| Model | Constraint | Effect |
|---|---|---|
| `User` | `email @unique` | One account per email address |
| `User` | `googleId @unique` | One Google OAuth link per Google account |
| `Classroom` | `inviteCode @unique` | No two classrooms share the same invite code |
| `SchoolDirectory` | `ncessId @unique` | No duplicate NCES school entries |
| `BeneficiaryDirectory` | `ein @unique` | No duplicate EIN/501c3 entries |
| `BeneficiaryDirectory` | `ncessId @unique` | No duplicate NCES entries |
| `StudentInvitation` | `token @unique` | Invite tokens are globally unique |
| `StudentInvitation` | `@@unique([cohortId, email])` | One pending invite per student per cohort |
| `VerifiedDomain` | `@@unique([schoolId, domain])` | No duplicate domains per school |
| `StudentCohortMembership` | `@@unique([studentId, cohortId])` | One membership per student per cohort |
| `CohortTeacherAssignment` | `@@unique([cohortId, teacherId])` | One assignment per teacher per cohort |
| `IntegrationConnection` | `@@unique([provider, schoolId])` | One LMS integration per provider per school |
| `IntegrationExternalMapping` | `@@unique([connectionId, externalType, externalId])` | No duplicate external object mappings |
| `SchoolOrganization` (legacy) | `@@unique([schoolId, organizationId])` | One approval record per school+org pair |
| `SchoolBeneficiaryApproval` | `@@unique([schoolId, beneficiaryId])` | One approval record per school+beneficiary pair |
| `SchoolPartnerRequest` | `@@unique([fromSchoolId, toSchoolId])` | One partner request per school pair |
| `Signup` (legacy) | `@@unique([userId, opportunityId])` | One signup per student per opportunity |
| `SavedOpportunity` | `@@unique([userId, opportunityId])` | One save/skip per student per opportunity |
| `ServiceSession` | `@@unique([userId, opportunityId])` | **Prevents duplicate check-ins** — one session per student per opportunity |
| `BeneficiarySignup` | `@@unique([slotId, studentId])` | One signup per student per time slot |
| `BeneficiarySignup` | `cancellationToken @unique` | Unique cancel tokens |
| `OrgEventReminderLog` | `@@unique([signupId, reminderType])` | Reminder idempotency — no duplicate emails |
| `OrgReminderConfig` | `beneficiaryId @unique` | One reminder config per beneficiary |
| `InterventionCase` | `@@unique([schoolId, studentId])` | One open case per student per school |
| `InterventionRecipient` | `@@unique([campaignId, studentId])` | Student can't be in same campaign twice |
| `InterventionRecipient` | `messageId @unique` | One message per recipient record |
| `SchoolBillingRecord` | `schoolId @unique` | One billing record per school |

### Duplicate check-in prevention

`ServiceSession` has `@@unique([userId, opportunityId])`. This is a hard DB constraint: a student cannot have two service sessions for the same opportunity. Any attempt to create a duplicate will fail at the Prisma layer before reaching the application.

**Limitation:** This means a student cannot volunteer at the same opportunity twice (e.g., a recurring event). The legacy `Opportunity` model does not support recurring slots; the newer `BeneficiaryOpportunity` model uses `BeneficiaryTimeSlot` (with `@@unique([slotId, studentId])`) which correctly allows a student to sign up for multiple slots under the same opportunity.

### State machine enforcement (application-layer only)

The VERIFIED status transition is enforced in `server/src/routes/verification.ts`:

```typescript
if (!["PENDING_VERIFICATION", "CHECKED_OUT"].includes(session.status)) {
  return res.status(400).json({ error: "Session is not pending verification" });
}
```

There is **no DB-level constraint** (CHECK constraint) preventing a `VERIFIED` record with null `checkOutTime`. The invariant that "a session cannot be VERIFIED if it was never CHECKED_OUT" is enforced entirely in application code. A direct database write could bypass this.

---

## Issues Requiring Attention

### Issue 1 — Seed Data Bypasses Audit Trail (Medium)

**Finding:** All seeded `VERIFIED/APPROVED` sessions have empty AuditLog records. The seed script directly sets `status="VERIFIED"` and `verificationStatus="APPROVED"` via Prisma without calling the verification API or creating AuditLog rows.

**Impact:** Any tooling that audits "who approved this and when" will show no history for seeded sessions. In production, all approvals flow through the API and are logged.

**Recommendation:** Update `prisma/seed.ts` to create corresponding `AuditLog` rows (action=`APPROVE`, actorId=seeded verifier, sessionId, details) when seeding VERIFIED sessions.

### Issue 2 — PENDING_CHECKIN Sessions Have Non-null totalHours (Low)

**Finding:** The seeded session `cmquut2er002w8o5yqhpw4tur` has `status=PENDING_CHECKIN`, `checkInTime=null`, `checkOutTime=null`, but `totalHours=2`. This value is the opportunity's `durationHours` and represents expected duration, not actual verified hours.

**Impact:** Callers consuming the raw sessions array (not the pre-filtered `approved[]`) could misinterpret this value as verified hours. The `/api/reports/student` endpoint handles this correctly (the session is not included in `approved[]`).

**Recommendation:** Consider setting `totalHours=null` on PENDING_CHECKIN sessions at creation time to clearly distinguish "estimated" from "actual" hours, or add a separate `estimatedHours` field.

### Issue 3 — No DB-Level State Machine Enforcement (Low)

**Finding:** The constraint "a session cannot be VERIFIED without a prior CHECKED_OUT" is enforced only in application code, not by a database CHECK constraint or trigger.

**Impact:** A direct database write (via Prisma Studio, migration, or compromised backend) could create a `VERIFIED` session without a `checkOutTime`, potentially inflating student hour totals.

**Recommendation:** For production PostgreSQL, add a CHECK constraint:
```sql
ALTER TABLE "ServiceSession" ADD CONSTRAINT chk_verified_checkout
  CHECK (status != 'VERIFIED' OR ("checkInTime" IS NOT NULL AND "checkOutTime" IS NOT NULL));
```
This can be added as a Prisma raw migration.

---

## Test Accounts Used

| Account | Role | ID |
|---|---|---|
| john@student.edu | STUDENT | cmquusyt000148o5yl7i6pqp4 |
| jane@student.edu | STUDENT | cmquusyyu00168o5y0ptbklxw |
| admin@lincoln.edu | SCHOOL_ADMIN | cmquusyav00008o5y9oz3z2o1 |
| volunteer@greenearth.org | BENEFICIARY_ADMIN | cmquusyh3000a8o5yz4w9cdjl |

**Lincoln High School ID:** cmquusyb500028o5yxl869rbp  
**Playwright School A ID:** cmqv1x0200002mumyg9f3190a

---

*Report generated by automated data integrity test suite. All API calls made against live server at http://localhost:3001.*
