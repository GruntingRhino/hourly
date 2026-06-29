# GoodHours Role Permission Matrix

**Generated:** 2026-06-29  
**Source of truth:** `server/src/middleware/auth.ts`, `server/src/middleware/rbac.ts`, and inline route-level guards across `server/src/routes/*.ts`

---

## Roles in the System

| Role | How Created | Notes |
|------|------------|-------|
| **Unauthenticated** | — | No token, or invalid/expired token |
| **STUDENT** | Via cohort invitation acceptance (`/api/invitations/student/accept`) | Scoped to a Cohort and School via membership |
| **TEACHER** | Created by SCHOOL_ADMIN via cohort teacher import or `/api/cohorts/:id/teachers` | Scoped to a School; sees only assigned cohorts |
| **SCHOOL_ADMIN** | Via self-registration (`/api/auth/signup`) or school registration magic link | Full control of their School entity |
| **BENEFICIARY_ADMIN** | Via beneficiary invitation acceptance (`/api/invitations/beneficiary/accept`) | Scoped to a single Beneficiary entity |
| **ORG_ADMIN** | Legacy role (deprecated) | Active accounts receive "upgrade required" UI; no functional routes |

> **Note:** There is no dedicated platform-level "super admin" role in the codebase. SCHOOL_ADMIN is the highest self-service role. Internal operations are controlled by `CRON_SECRET` (server-to-server) and dev-only impersonation (ENABLE_IMPERSONATION=true, gated at the route level). The `isTestAccount` flag hides accounts from lists but is not a role.

---

## Authorization Architecture

Authorization is enforced in two layers:

1. **`requireRole(...roles)`** (middleware) — role whitelist at the route level.
2. **Inline ownership checks** — after role check, the route validates the actor is associated with the specific entity (e.g., `user.beneficiaryId === req.params.id`, `cohort.schoolId === scope.schoolId`). This prevents cross-tenant data access even between users with the same role.

The tables below reflect **both layers**: a cell marked ✅ means the role passes both the role check and the typical ownership check for that resource.

**Legend:**
- ✅ = Allowed (passes role check + typical ownership check)
- ❌ = Denied (role check fails with 403)
- 🚫 = Not authenticated (401)
- ⚠️ = Conditionally allowed (see notes)
- — = Not applicable

---

## Resource Tables

### Users (User model)

| Action | Unauth | STUDENT | TEACHER | SCHOOL_ADMIN | BENEFICIARY_ADMIN | ORG_ADMIN |
|--------|--------|---------|---------|--------------|-------------------|-----------|
| View own profile (`GET /api/auth/me`) | 🚫 | ✅ | ✅ | ✅ | ✅ | ✅ |
| Update own profile (`PUT /api/auth/profile`) | 🚫 | ✅ | ✅ | ✅ | ✅ | ✅ |
| Change own password (`PUT /api/auth/password`) | 🚫 | ✅ | ✅ | ✅ | ✅ | ✅ |
| Delete own account (`DELETE /api/auth/account`) | 🚫 | ✅ | ✅ | ✅ | ✅ | ✅ |
| View student list (school) | 🚫 | ❌ | ✅ (own cohorts) | ✅ (own school) | ❌ | ❌ |
| View student detail (school) | 🚫 | ❌ | ✅ (own cohorts) | ✅ (own school) | ❌ | ❌ |
| Impersonate user (dev-only) | 🚫 | ❌ | ❌ | ✅ (ENABLE_IMPERSONATION) | ❌ | ❌ |
| Create TEACHER account | 🚫 | ❌ | ❌ | ✅ (own school) | ❌ | ❌ |
| Create STUDENT account | Public ✅ (invitation token only) | — | — | — | — | — |
| Create BENEFICIARY_ADMIN account | Public ✅ (invitation token only) | — | — | — | — | — |
| Create SCHOOL_ADMIN account | Public ✅ (self-register) | — | — | — | — | — |

---

### Schools (School model)

| Action | Unauth | STUDENT | TEACHER | SCHOOL_ADMIN | BENEFICIARY_ADMIN | ORG_ADMIN |
|--------|--------|---------|---------|--------------|-------------------|-----------|
| View school info (`GET /api/schools`) | 🚫 | ✅ (limited — rules only) | ✅ | ✅ | ❌ | ❌ |
| View school settings | 🚫 | ❌ | ✅ (own school) | ✅ (own school) | ❌ | ❌ |
| Update school settings (`PATCH /api/schools/settings`) | 🚫 | ❌ | ❌ | ✅ (own school) | ❌ | ❌ |
| Complete school onboarding | 🚫 | ❌ | ❌ | ✅ (own school) | ❌ | ❌ |
| View school stats | 🚫 | ❌ | ✅ (own school) | ✅ (own school) | ❌ | ❌ |
| Initiate ownership transfer | 🚫 | ❌ | ❌ | ✅ (own school) | ❌ | ❌ |
| Confirm ownership transfer | 🚫 | ❌ | ❌ | ✅ (token-based) | ❌ | ❌ |
| View launch center config | 🚫 | ❌ | ✅ (own school) | ✅ (own school) | ❌ | ❌ |
| Update launch center config | 🚫 | ❌ | ✅ (own school) | ✅ (own school) | ❌ | ❌ |
| File / update launch bugs | 🚫 | ❌ | ✅ (own school) | ✅ (own school) | ❌ | ❌ |

---

### Cohorts (Cohort model)

| Action | Unauth | STUDENT | TEACHER | SCHOOL_ADMIN | BENEFICIARY_ADMIN | ORG_ADMIN |
|--------|--------|---------|---------|--------------|-------------------|-----------|
| List cohorts | 🚫 | ❌ | ✅ (assigned only) | ✅ (all own school) | ❌ | ❌ |
| View cohort detail | 🚫 | ❌ | ✅ (assigned only) | ✅ (own school) | ❌ | ❌ |
| Create cohort | 🚫 | ❌ | ❌ | ✅ (own school) | ❌ | ❌ |
| Update cohort | 🚫 | ❌ | ✅ (assigned only) | ✅ (own school) | ❌ | ❌ |
| Delete cohort | 🚫 | ❌ | ❌ | ✅ (own school) | ❌ | ❌ |
| Import students via CSV | 🚫 | ❌ | ✅ (assigned only) | ✅ (own school) | ❌ | ❌ |
| Add single student | 🚫 | ❌ | ✅ (assigned only) | ✅ (own school) | ❌ | ❌ |
| Remove student from cohort | 🚫 | ❌ | ✅ (assigned only) | ✅ (own school) | ❌ | ❌ |
| Publish / resend invitations | 🚫 | ❌ | ✅ (assigned only) | ✅ (own school) | ❌ | ❌ |
| Assign teacher to cohort | 🚫 | ❌ | ❌ | ✅ (own school) | ❌ | ❌ |
| Unassign teacher from cohort | 🚫 | ❌ | ❌ | ✅ (own school) | ❌ | ❌ |
| Export cohort summaries (CSV) | 🚫 | ❌ | ✅ (assigned only) | ✅ (own school) | ❌ | ❌ |

---

### Opportunities / Slots (BeneficiaryOpportunity + BeneficiaryTimeSlot)

| Action | Unauth | STUDENT | TEACHER | SCHOOL_ADMIN | BENEFICIARY_ADMIN | ORG_ADMIN |
|--------|--------|---------|---------|--------------|-------------------|-----------|
| Browse available slots | 🚫 | ✅ (school-approved only) | ❌ | ❌ | ❌ | ❌ |
| View slot detail | 🚫 | ✅ (school-approved only) | ❌ | ❌ | ✅ (own org) | ❌ |
| Create opportunity | 🚫 | ❌ | ❌ | ✅ (own school's private beneficiary) | ✅ (own beneficiary) | ❌ |
| Edit opportunity | 🚫 | ❌ | ❌ | ✅ (own school's private beneficiary) | ✅ (own beneficiary) | ❌ |
| Delete opportunity (soft-cancel) | 🚫 | ❌ | ❌ | ✅ (own school's private beneficiary) | ✅ (own beneficiary) | ❌ |
| Delete time slot | 🚫 | ❌ | ❌ | ✅ (own school's private beneficiary) | ✅ (own beneficiary) | ❌ |
| Upload attachments to opportunity | 🚫 | ❌ | ❌ | ✅ (own school's private beneficiary) | ✅ (own beneficiary) | ❌ |
| Delete attachments | 🚫 | ❌ | ❌ | ✅ (own school's private beneficiary) | ✅ (own beneficiary) | ❌ |
| View attachment file | 🚫 | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Legacy Opportunity (ORG_ADMIN model)** | | | | | | |
| Browse opportunities | ✅ (public) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create legacy opportunity | 🚫 | ❌ | ❌ | ❌ | ❌ | ✅ (own org) |
| Edit legacy opportunity | 🚫 | ❌ | ❌ | ❌ | ❌ | ✅ (own org) |
| Cancel legacy opportunity | 🚫 | ❌ | ❌ | ❌ | ❌ | ✅ (own org) |

---

### Signups (BeneficiarySignup + Signup)

| Action | Unauth | STUDENT | TEACHER | SCHOOL_ADMIN | BENEFICIARY_ADMIN | ORG_ADMIN |
|--------|--------|---------|---------|--------------|-------------------|-----------|
| Sign up for time slot | 🚫 | ✅ (school-approved only; capacity enforced) | ❌ | ❌ | ❌ | ❌ |
| Cancel signup | 🚫 | ✅ (own only) | ❌ | ❌ | ❌ | ❌ |
| View own signups | 🚫 | ✅ | ❌ | ❌ | ❌ | ❌ |
| View all signups for org | 🚫 | ❌ | ❌ | ❌ | ✅ (own org) | ❌ |
| **Legacy Signup** | | | | | | |
| Sign up for opportunity | 🚫 | ✅ | ❌ | ❌ | ❌ | ❌ |
| Cancel legacy signup | 🚫 | ✅ (own only) | ❌ | ❌ | ❌ | ❌ |

---

### Service Sessions

| Action | Unauth | STUDENT | TEACHER | SCHOOL_ADMIN | BENEFICIARY_ADMIN | ORG_ADMIN |
|--------|--------|---------|---------|--------------|-------------------|-----------|
| Check in to session | 🚫 | ✅ (own only) | ❌ | ❌ | ❌ | ❌ |
| Check out of session | 🚫 | ✅ (own only) | ❌ | ❌ | ❌ | ❌ |
| Submit session for verification | 🚫 | ✅ (own only; signature or file) | ❌ | ❌ | ❌ | ❌ |
| View own sessions | 🚫 | ✅ | ❌ | ❌ | ❌ | ❌ |
| View org sessions | 🚫 | ❌ | ❌ | ❌ | ❌ | ✅ (own org) |
| View school sessions | 🚫 | ❌ | ✅ (own cohorts) | ✅ (own school) | ❌ | ❌ |

---

### Verification

| Action | Unauth | STUDENT | TEACHER | SCHOOL_ADMIN | BENEFICIARY_ADMIN | ORG_ADMIN |
|--------|--------|---------|---------|--------------|-------------------|-----------|
| Approve ServiceSession hours | 🚫 | ❌ | ✅ (own cohort students only; no self-approval; no override of requireOrgVerification) | ✅ (own school students; no self-approval; requireOrgVerification blocks first approval) | ❌ | ✅ (own org sessions; no self-approval) |
| Reject ServiceSession hours | 🚫 | ❌ | ✅ (own cohort students only; no self-rejection) | ✅ (own school students; no self-rejection) | ❌ | ✅ (own org sessions; no self-rejection) |
| View pending verifications (org) | 🚫 | ❌ | ❌ | ❌ | ❌ | ✅ (own org) |
| View pending verifications (school) | 🚫 | ❌ | ✅ (own cohorts) | ✅ (own school) | ❌ | ❌ |
| Approve BeneficiarySignup hours | 🚫 | ❌ | ✅ (own cohort students; canManageBeneficiary check) | ✅ (own school; canManageBeneficiary check) | ✅ (own org) | ❌ |
| Reject BeneficiarySignup hours | 🚫 | ❌ | ✅ (own cohort students) | ✅ (own school) | ✅ (own org) | ❌ |
| Mark no-show | 🚫 | ❌ | ✅ (own cohort students) | ✅ (own school) | ✅ (own org) | ❌ |

---

### Self-Submissions (SelfSubmittedRequest)

| Action | Unauth | STUDENT | TEACHER | SCHOOL_ADMIN | BENEFICIARY_ADMIN | ORG_ADMIN |
|--------|--------|---------|---------|--------------|-------------------|-----------|
| Submit hours | 🚫 | ✅ | ❌ | ❌ | ❌ | ❌ |
| View own submissions | 🚫 | ✅ | ❌ | ❌ | ❌ | ❌ |
| View school submissions | 🚫 | ❌ | ✅ (own cohorts) | ✅ (own school) | ❌ | ❌ |
| Import bulk submissions (CSV) | 🚫 | ❌ | ✅ (own cohorts) | ✅ (own school) | ❌ | ❌ |
| Approve submission | 🚫 | ❌ | ✅ (own cohort students) | ✅ (own school) | ❌ | ❌ |
| Reject submission | 🚫 | ❌ | ✅ (own cohort students) | ✅ (own school) | ❌ | ❌ |
| Request revision | 🚫 | ❌ | ✅ (own cohort students) | ✅ (own school) | ❌ | ❌ |
| Cancel own pending submission | 🚫 | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit own pending/revision submission | 🚫 | ✅ | ❌ | ❌ | ❌ | ❌ |

---

### Messages (Message + Notification + InterventionCampaign)

| Action | Unauth | STUDENT | TEACHER | SCHOOL_ADMIN | BENEFICIARY_ADMIN | ORG_ADMIN |
|--------|--------|---------|---------|--------------|-------------------|-----------|
| Send message | 🚫 | ⚠️ (rate-limited; messagePreferences of recipient may block) | ✅ | ✅ | ✅ | ❌ |
| View inbox | 🚫 | ✅ (own messages only) | ✅ (own messages) | ✅ (own messages) | ✅ (own messages) | ❌ |
| Mark message read | 🚫 | ✅ (own) | ✅ (own) | ✅ (own) | ✅ (own) | ❌ |
| View notifications | 🚫 | ✅ (own) | ✅ (own) | ✅ (own) | ✅ (own) | ❌ |
| Mark notification read | 🚫 | ✅ (own) | ✅ (own) | ✅ (own) | ✅ (own) | ❌ |
| View intervention cases | 🚫 | ❌ | ✅ (own school) | ✅ (own school) | ❌ | ❌ |
| Create/update intervention case | 🚫 | ❌ | ✅ (own school) | ✅ (own school) | ❌ | ❌ |
| Send bulk intervention messages | 🚫 | ❌ | ✅ (own school) | ✅ (own school) | ❌ | ❌ |
| Trigger event reminders | 🚫 | ❌ | ✅ (own school) | ✅ (own school) | ❌ | ❌ |

---

### Reports

| Action | Unauth | STUDENT | TEACHER | SCHOOL_ADMIN | BENEFICIARY_ADMIN | ORG_ADMIN |
|--------|--------|---------|---------|--------------|-------------------|-----------|
| View own hours summary | 🚫 | ✅ | ❌ | ❌ | ❌ | ❌ |
| View school report | 🚫 | ❌ | ✅ (own school) | ✅ (own school) | ❌ | ❌ |
| View org volunteer report | 🚫 | ❌ | ❌ | ❌ | ❌ | ✅ (own org) |
| Export CSV | 🚫 | ✅ (own data only) | ✅ (school scope) | ✅ (school scope) | ❌ | ✅ (org scope) |
| View session audit trail | 🚫 | ✅ (own sessions) | ✅ (own cohort students) | ✅ (own school) | ❌ | ✅ (own org) |
| Generate parent progress link | 🚫 | ✅ | ❌ | ❌ | ❌ | ❌ |
| View parent progress (token) | ✅ (public, token-gated) | — | — | — | — | — |
| View student hour breakdown | 🚫 | ❌ | ✅ (own cohort students) | ✅ (own school) | ❌ | ❌ |
| View student verification history | 🚫 | ❌ | ✅ (own cohort students) | ✅ (own school) | ❌ | ❌ |

---

### Beneficiary / Partner Organizations (Beneficiary model)

| Action | Unauth | STUDENT | TEACHER | SCHOOL_ADMIN | BENEFICIARY_ADMIN | ORG_ADMIN |
|--------|--------|---------|---------|--------------|-------------------|-----------|
| View approved beneficiaries | 🚫 | ✅ (school-approved only) | ✅ (school-approved) | ✅ (school's list) | ✅ (own org only) | ❌ |
| Search beneficiary directory | 🚫 | ❌ | ✅ | ✅ | ❌ | ❌ |
| Geo-search beneficiary directory | 🚫 | ❌ | ✅ | ✅ | ❌ | ❌ |
| Create custom beneficiary | 🚫 | ❌ | ❌ | ✅ (own school) | ❌ | ❌ |
| Edit school-created beneficiary | 🚫 | ❌ | ❌ | ✅ (own school-created) | ❌ | ❌ |
| Approve directory beneficiary | 🚫 | ❌ | ❌ | ✅ (own school) | ❌ | ❌ |
| Drop beneficiary approval | 🚫 | ❌ | ❌ | ✅ (own school; cannot drop school's default internal partner) | ❌ | ❌ |
| Send partnership invitation | 🚫 | ❌ | ❌ | ✅ (own school) | ❌ | ❌ |
| Import bulk beneficiaries (CSV) | 🚫 | ❌ | ❌ | ✅ (own school) | ❌ | ❌ |
| View list of approved schools for own org | 🚫 | ❌ | ❌ | ✅ (own school's beneficiaries) | ✅ (own org) | ❌ |
| Update org branding (Pro) | 🚫 | ❌ | ❌ | ❌ | ✅ (own org; Pro only) | ❌ |
| View org analytics | 🚫 | ❌ | ❌ | ❌ | ✅ (own org) | ❌ |

---

### Billing

| Action | Unauth | STUDENT | TEACHER | SCHOOL_ADMIN | BENEFICIARY_ADMIN | ORG_ADMIN |
|--------|--------|---------|---------|--------------|-------------------|-----------|
| View org billing summary | 🚫 | ❌ | ❌ | ❌ | ✅ (own org only; inline ownership check) | ❌ |
| Create Stripe checkout session | 🚫 | ❌ | ❌ | ❌ | ✅ (own org only) | ❌ |
| Access Stripe billing portal | 🚫 | ❌ | ❌ | ❌ | ✅ (own org only; requires Stripe customer) | ❌ |
| Submit invoice request | 🚫 | ❌ | ❌ | ❌ | ✅ (own org only) | ❌ |
| View school procurement summary | 🚫 | ❌ | ❌ | ✅ (own school) | ❌ | ❌ |
| Submit school quote request | 🚫 | ❌ | ❌ | ✅ (own school) | ❌ | ❌ |
| Upload procurement document | 🚫 | ❌ | ❌ | ✅ (own school) | ❌ | ❌ |
| Download procurement document | 🚫 | ❌ | ❌ | ✅ (own school) | ❌ | ❌ |

---

### Audit Logs

| Action | Unauth | STUDENT | TEACHER | SCHOOL_ADMIN | BENEFICIARY_ADMIN | ORG_ADMIN |
|--------|--------|---------|---------|--------------|-------------------|-----------|
| View ServiceSession audit trail | 🚫 | ✅ (own sessions) | ✅ (own cohort students) | ✅ (own school) | ❌ | ✅ (own org) |
| View BeneficiarySignup audit logs | 🚫 | ✅ (own signups) | ✅ (own cohort students) | ✅ (own school) | ✅ (own org) | ❌ |
| View school billing audit log | 🚫 | ❌ | ❌ | ✅ (own school) | ❌ | ❌ |
| DataAccessLog (FERPA trail) written on | — | — | — | On student data access, exports, impersonation | — | — |

---

### File Uploads

| Action | Unauth | STUDENT | TEACHER | SCHOOL_ADMIN | BENEFICIARY_ADMIN | ORG_ADMIN |
|--------|--------|---------|---------|--------------|-------------------|-----------|
| Upload opportunity attachment | 🚫 | ❌ | ❌ | ✅ (own school's private beneficiary) | ✅ (own org; tier limits apply) | ❌ |
| Delete opportunity attachment | 🚫 | ❌ | ❌ | ✅ (own school's private beneficiary) | ✅ (own org) | ❌ |
| Upload session signature/file | 🚫 | ✅ (own session only) | ❌ | ❌ | ❌ | ❌ |
| Upload procurement document | 🚫 | ❌ | ❌ | ✅ (own school) | ❌ | ❌ |
| Download/view uploaded file | 🚫 | ✅ (school-approved scope) | ✅ | ✅ | ✅ (own org) | ❌ |

---

### Integrations (Canvas / Google Classroom)

| Action | Unauth | STUDENT | TEACHER | SCHOOL_ADMIN | BENEFICIARY_ADMIN | ORG_ADMIN |
|--------|--------|---------|---------|--------------|-------------------|-----------|
| Connect integration | 🚫 | ❌ | ❌ | ✅ (own school) | ❌ | ❌ |
| Disconnect integration | 🚫 | ❌ | ❌ | ✅ (own school) | ❌ | ❌ |
| View integration status | 🚫 | ❌ | ❌ | ✅ (own school) | ❌ | ❌ |
| Preview sync (dry run) | 🚫 | ❌ | ❌ | ✅ (own school) | ❌ | ❌ |
| Apply sync (creates invitations) | 🚫 | ❌ | ❌ | ✅ (own school) | ❌ | ❌ |
| View sync errors | 🚫 | ❌ | ❌ | ✅ (own school) | ❌ | ❌ |

---

## TEACHER vs SCHOOL_ADMIN Differentiation

TEACHERs have a subset of SCHOOL_ADMIN permissions. Key restrictions:

| Capability | TEACHER | SCHOOL_ADMIN |
|-----------|---------|--------------|
| See all school cohorts | ❌ (assigned only) | ✅ |
| Create cohort | ❌ | ✅ |
| Delete cohort | ❌ | ✅ |
| Assign/unassign teachers | ❌ | ✅ |
| Modify school settings | ❌ | ✅ |
| Approve/drop beneficiaries | ❌ | ✅ |
| Send partnership invitations | ❌ | ✅ |
| Create/edit beneficiary org | ❌ | ✅ |
| Access billing/procurement | ❌ | ✅ |
| Integrations (Canvas/GC) | ❌ | ✅ |
| School ownership transfer | ❌ | ✅ |
| Impersonation (dev) | ❌ | ✅ |
| View/update school staff | ❌ | ✅ |
| Approve/reject legacy orgs | ❌ | ✅ |

---

## Cross-Cutting Invariants

These invariants apply regardless of role and are enforced at the route or data layer:

1. **No self-verification:** A user cannot approve or reject their own ServiceSession or BeneficiarySignup hours. Enforced via `session.userId !== req.user.userId` checks.

2. **requireOrgVerification:** When a School has `requireOrgVerification = true`, SCHOOL_ADMIN and TEACHER are blocked from being the *first* approver of a legacy ServiceSession. The org must approve first.

3. **Tenant isolation:** Every ownership check is keyed on the requesting user's `schoolId`, `beneficiaryId`, or `organizationId`. A SCHOOL_ADMIN at School A cannot read or modify data for School B.

4. **FERPA PII control:** Student names are pseudonymized in ORG_ADMIN / pending-verification responses unless `school.ferpaBeneficiaryPiiEnabled = true` for the student's school.

5. **Tier gating:** Multiple reminder configurations, custom branding, and other Pro features on `Beneficiary` are blocked for `planTier = FREE` via `requireOrgFeature(...)`.

6. **Cohort-scoped teacher access:** TEACHER users are limited to cohorts where they have a `CohortTeacherAssignment`. Attempts to access other cohorts return 403.

7. **Email/phone encryption:** The `phone` field on User and integration credentials on IntegrationConnection are encrypted at rest with `FIELD_ENCRYPTION_KEY` (AES). Routes that return these fields call `decryptField(...)`.

8. **Student invitation gate:** New STUDENT and BENEFICIARY_ADMIN accounts can only be created via invitation tokens — not direct self-registration. Self-registration is limited to SCHOOL_ADMIN only.
