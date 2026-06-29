# GoodHours Repository Audit

**Generated:** 2026-06-29  
**Branch:** main  
**Scope:** Full codebase inventory for QA baseline

---

## 1. Frontend Pages

All pages live under `client/src/pages/`. Routes are defined in `client/src/App.tsx`.

### 1.1 Public Pages (No authentication required)

| File | Route Path | Description |
|------|-----------|-------------|
| `Landing.tsx` | `/` | Marketing landing page |
| `Login.tsx` | `/login` | Email/password login |
| `Signup.tsx` | `/signup` | School admin self-registration (only SCHOOL_ADMIN role allowed) |
| `ForgotPassword.tsx` | `/forgot-password` | Request password reset link |
| `ResetPassword.tsx` | `/reset-password` | Consume reset token and set new password |
| `VerifyEmail.tsx` | `/verify-email` | Consume email verification token |
| `EmailVerificationRequired.tsx` | `/email-verification-required` | Gate shown when user is logged in but unverified |
| `ParentProgress.tsx` | `/parent-progress` | Public parent-facing progress view |
| `FAQ.tsx` | `/faq` | FAQ page |
| `Terms.tsx` | `/terms` | Terms of service |
| `Privacy.tsx` | `/privacy` | Privacy policy |
| `student/JoinCohort.tsx` | `/join/student` | Magic-link student enrollment (invitation token) |
| `beneficiary/JoinBeneficiary.tsx` | `/join/beneficiary` | Magic-link beneficiary onboarding (invitation token) |
| `school/Register.tsx` | `/school/register` | School magic-link registration start |
| `school/VerifyRegistration.tsx` | `/school/verify-registration` | Consume school registration magic link |
| `school/ConfirmTransfer.tsx` | `/school/confirm-transfer` | Confirm school admin ownership transfer |

### 1.2 Student Pages (role = STUDENT)

| File | Route Path | Description |
|------|-----------|-------------|
| `student/Dashboard.tsx` | `/dashboard` | Student hours summary, progress tracking |
| `student/Browse.tsx` | `/browse` | Browse available volunteer opportunities |
| `student/OpportunityDetail.tsx` | `/opportunity/:id` | Legacy opportunity detail (Opportunity model) |
| `student/SlotDetail.tsx` | `/slot/:id` | New slot detail (BeneficiaryTimeSlot model) |
| `student/SelfSubmit.tsx` | `/submit` | Self-submit volunteer hours |
| `student/Messages.tsx` | `/messages` | Inbox/outbox messages |
| `student/Settings.tsx` | `/settings` | Profile, notifications, account settings |
| `student/ClassroomJoin.tsx` | — | Legacy classroom join (not actively routed) |

### 1.3 School Admin / Teacher Pages (role = SCHOOL_ADMIN or TEACHER)

| File | Route Path | Notes |
|------|-----------|-------|
| `school/Dashboard.tsx` | `/dashboard` | School overview, student stats, at-risk flags |
| `school/Onboarding.tsx` | `/onboarding` | SCHOOL_ADMIN only; required before dashboard if incomplete |
| `school/StudentList.tsx` | `/students`, `/students/on-track`, `/students/off-track`, `/cohorts/:id/on-track`, `/cohorts/:id/off-track` | Filterable student list |
| `school/Cohorts.tsx` | `/cohorts` | Manage cohorts |
| `school/CohortDetail.tsx` | `/cohorts/:id` | Cohort detail with student roster |
| `school/Beneficiaries.tsx` | `/beneficiaries`, `/partners` | SCHOOL_ADMIN only; manage partner organizations |
| `school/Discover.tsx` | `/discover` | SCHOOL_ADMIN only; geo-search beneficiary directory |
| `school/SchoolOpportunities.tsx` | `/opportunities` | SCHOOL_ADMIN only; view school's published opportunities |
| `school/SelfSubmissions.tsx` | `/submissions` | Review student self-submitted hours |
| `school/Messages.tsx` | `/messages` | School staff messages / intervention campaigns |
| `school/Settings.tsx` | `/settings` | School settings, integrations, account |
| `school/LaunchCenter.tsx` | `/launch` | SCHOOL_ADMIN only; launch monitoring/support dashboard |
| `school/SchoolBilling.tsx` | — | School billing/procurement (not actively routed) |
| `school/Groups.tsx` | — | Legacy student groups (not actively routed) |
| `admin/Impersonate.tsx` | `/admin/impersonate` | SCHOOL_ADMIN only; impersonate a student (dev-only guard on server) |

**Sub-components (not standalone pages):**  
`school/components/BugsTab.tsx`, `MonitoringTab.tsx`, `OnboardingTab.tsx`, `RollbackTab.tsx`, `SupportTab.tsx`, `types.tsx` — all used within `LaunchCenter.tsx`.

### 1.4 Beneficiary Admin Pages (role = BENEFICIARY_ADMIN)

| File | Route Path | Description |
|------|-----------|-------------|
| `beneficiary/Dashboard.tsx` | `/dashboard` | Beneficiary overview: signups, hours pending |
| `beneficiary/Opportunities.tsx` | `/opportunities` | Manage volunteer opportunities and time slots |
| `organization/Messages.tsx` | `/messages` | Shared message component (used for beneficiary) |
| `beneficiary/Settings.tsx` | `/settings` | Org profile, billing, branding settings |
| `beneficiary/OrgBilling.tsx` | — | Billing detail sub-view |

### 1.5 Legacy ORG_ADMIN Pages

Users with role `ORG_ADMIN` receive a hardcoded "Account Upgrade Required" message on all routes. No functional pages are rendered.

---

## 2. API Routes

All routes are prefixed `/api`. Middleware stack: `helmet` → CORS → rate limiting → route-specific middleware.  
Authentication uses `authenticate` (JWT Bearer token + DB ACTIVE status check).  
Authorization uses `requireRole(...roles)` (exact role match).

### 2.1 Auth — `/api/auth`

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| POST | `/signup` | Public | — | Create SCHOOL_ADMIN account; creates School, default Classroom, default private Beneficiary; sends verification email |
| POST | `/login` | Public | — | Email/password login; returns JWT + full user profile |
| GET | `/me` | Required | Any | Return current user profile |
| PUT | `/profile` | Required | Any | Update name, phone, grade, notification/message preferences |
| PUT | `/password` | Required | Any | Change password (current password required) |
| GET | `/verify-email` | Public | — | Consume email verification token |
| POST | `/resend-verification` | Required | Any | Resend verification email (rate-limited: 3/hour) |
| POST | `/forgot-password` | Public | — | Request password reset link (rate-limited: 5/15min) |
| POST | `/reset-password` | Public | — | Consume reset token and set new password |
| DELETE | `/account` | Required | Any | Permanently delete account and all associated data (cascading) |
| POST | `/set-graduation-goal` | Required | SCHOOL_ADMIN | Set school required hours |
| GET | `/__test-email` | Public | — | **Dev-only:** Retrieve captured mailinator inbox |
| POST | `/dev/bypass-email-verification` | Required | Any | **Dev-only (ENABLE_IMPERSONATION=true):** Mark current user as email verified |
| POST | `/impersonate` | Required | SCHOOL_ADMIN | **Dev-only (ENABLE_IMPERSONATION=true):** Generate token for any user; writes FERPA DataAccessLog |

### 2.2 Google OAuth — `/api/auth/google`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/classify-domain` | Public | Check if email domain belongs to known school |
| GET | `/url` | Public | Generate Google OAuth URL |
| GET | `/callback` | Public | Legacy OAuth callback redirect |
| POST | `/callback` | Public | Google OAuth callback; creates/links account |
| POST | `/dev-signin` | Public | Dev-only Google sign-in bypass |
| GET | `/schools` | Public | Search school directory for signup |
| POST | `/register-school` | Public | Send school magic-link registration email |
| POST | `/complete-registration` | Public | Consume school registration magic link and create account |
| GET | `/verify-school` | Public | Verify school registration token validity |

### 2.3 Opportunities (Legacy) — `/api/opportunities`

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | `/` | Public | — | Browse opportunities (supports `?search`, `?date`, `?tag`, `?organizationId`, `?schoolId`, `?approvedOnly`) |
| GET | `/:id` | Public | — | Get single opportunity |
| POST | `/` | Required | ORG_ADMIN | Create opportunity (auto-geocodes address) |
| PUT | `/:id` | Required | ORG_ADMIN | Update opportunity (own org only) |
| POST | `/:id/cancel` | Required | ORG_ADMIN | Cancel opportunity; notifies confirmed students |
| POST | `/:id/announce` | Required | ORG_ADMIN | Send announcement notification to all confirmed signups |

### 2.4 Signups (Legacy) — `/api/signups`

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| POST | `/` | Required | STUDENT | Sign up for opportunity with capacity/waitlist enforcement |
| DELETE | `/:id` | Required | STUDENT | Cancel signup; promotes waitlist |

### 2.5 Service Sessions (Legacy) — `/api/sessions`

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | `/my` | Required | STUDENT | Student's own sessions |
| GET | `/organization` | Required | ORG_ADMIN | Sessions for org's opportunities |
| GET | `/school` | Required | SCHOOL_ADMIN, TEACHER | Sessions for school's students |
| POST | `/:id/checkin` | Required | STUDENT | Check in to a session |
| POST | `/:id/checkout` | Required | STUDENT | Check out; auto-calculates hours |
| POST | `/:id/submit-verification` | Required | STUDENT | Submit for verification; accepts drawn signature (base64) or file upload (multer) |

### 2.6 Verification (Legacy) — `/api/verification`

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| POST | `/:sessionId/approve` | Required | ORG_ADMIN, SCHOOL_ADMIN, TEACHER | Approve hours; writes AuditLog; sends email; prevents self-approval; school enforces requireOrgVerification rule |
| POST | `/:sessionId/reject` | Required | ORG_ADMIN, SCHOOL_ADMIN, TEACHER | Reject hours with reason; writes AuditLog |
| GET | `/pending` | Required | ORG_ADMIN | List pending verifications for org |
| GET | `/school-pending` | Required | SCHOOL_ADMIN, TEACHER | List pending verifications for school staff's students |

### 2.7 Organizations (Legacy) — `/api/organizations`

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | `/` | Public | — | List organizations |
| GET | `/:id` | Public | — | Get organization detail |
| PUT | `/:id` | Required | ORG_ADMIN | Update org profile (own org only) |
| GET | `/:id/sessions` | Required | ORG_ADMIN | Sessions for an organization |
| GET | `/:id/stats` | Required | Any | Organization stats |

### 2.8 Schools — `/api/schools`

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | `/` | Required | Any | School info for current user's school |
| GET | `/location` | Required | SCHOOL_ADMIN, TEACHER | School location/zip data |
| GET | `/settings` | Required | SCHOOL_ADMIN, TEACHER | School settings |
| PUT | `/onboarding` | Required | SCHOOL_ADMIN | Complete school onboarding |
| PATCH | `/settings` | Required | SCHOOL_ADMIN | Update school settings |
| GET | `/my-rules` | Required | STUDENT | Effective service rules for student's school |
| GET | `/launch` | Required | SCHOOL_ADMIN, TEACHER | Launch center config |
| PUT | `/launch` | Required | SCHOOL_ADMIN, TEACHER | Update launch config |
| POST | `/launch/bugs` | Required | SCHOOL_ADMIN, TEACHER | File a launch bug |
| PUT | `/launch/bugs/:bugId` | Required | SCHOOL_ADMIN, TEACHER | Update a launch bug |
| GET | `/my-beneficiary` | Required | SCHOOL_ADMIN | School's own private Beneficiary record |
| GET | `/:id` | Required | SCHOOL_ADMIN, TEACHER | Get school detail |
| PUT | `/:id` | Required | SCHOOL_ADMIN | Update school |
| GET | `/:id/staff` | Required | SCHOOL_ADMIN | List school staff |
| POST | `/:id/ownership-transfer` | Required | SCHOOL_ADMIN | Initiate ownership transfer; sends confirmation email |
| POST | `/confirm-transfer` | Required | Any | Consume transfer token |
| GET | `/:id/students` | Required | SCHOOL_ADMIN, TEACHER | List students with progress |
| GET | `/:id/students/:studentId/verification-history` | Required | SCHOOL_ADMIN, TEACHER | Student's verification history |
| GET | `/:id/students/:studentId/hour-breakdown` | Required | SCHOOL_ADMIN, TEACHER | Student's hours breakdown |
| GET | `/:id/stats` | Required | SCHOOL_ADMIN, TEACHER | School aggregate stats |
| POST | `/:id/organizations/:orgId/approve` | Required | SCHOOL_ADMIN | Approve legacy org for school |
| POST | `/:id/organizations/:orgId/reject` | Required | SCHOOL_ADMIN | Reject/block legacy org |
| GET | `/:id/organizations` | Required | SCHOOL_ADMIN, TEACHER | List orgs with approval status |
| GET | `/:id/partner-opportunities` | Required | SCHOOL_ADMIN, TEACHER | Opportunities from approved orgs |
| GET | `/:id/groups` | Required | SCHOOL_ADMIN, TEACHER | List student groups |
| POST | `/:id/groups` | Required | SCHOOL_ADMIN, TEACHER | Create student group |
| GET | `/:id/groups/:groupId/students` | Required | SCHOOL_ADMIN, TEACHER | List group members |
| POST | `/:id/groups/:groupId/students` | Required | SCHOOL_ADMIN, TEACHER | Add student to group |

### 2.9 Messages — `/api/messages`

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | `/` | Required | Any | Get inbox (role-filtered) |
| POST | `/` | Required | Any | Send message (rate-limited) |
| PUT | `/:id/read` | Required | Any | Mark message as read |
| GET | `/notifications` | Required | Any | Get notifications for current user |
| GET | `/notifications/unread-count` | Required | Any | Count of unread notifications |
| PUT | `/notifications/:id/read` | Required | Any | Mark notification as read |
| GET | `/interventions/cases` | Required | SCHOOL_ADMIN, TEACHER | List intervention cases for school |
| PUT | `/interventions/cases/:studentId` | Required | SCHOOL_ADMIN, TEACHER | Create/update intervention case |
| GET | `/interventions/history` | Required | SCHOOL_ADMIN, TEACHER | Intervention message history |
| POST | `/bulk` | Required | SCHOOL_ADMIN, TEACHER | Send bulk intervention messages to cohort |
| POST | `/reminders/run` | Required | SCHOOL_ADMIN, TEACHER | Trigger event reminder for a slot |

### 2.10 Reports — `/api/reports`

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | `/student` | Required | Any (role-checked inline) | Student's own hour summary |
| GET | `/organization` | Required | Any (role-checked inline) | Org volunteer history |
| GET | `/school` | Required | Any (role-checked inline) | School aggregate report |
| GET | `/export/csv` | Required | Any (role-checked inline) | Export data as CSV (role determines scope) |
| POST | `/parent-link` | Required | STUDENT | Generate parent-progress link token |
| GET | `/parent-progress` | Public | — | View student progress via parent token |
| GET | `/audit/:sessionId` | Required | Any (role-checked inline) | Audit log for a session |

### 2.11 Saved Opportunities (Legacy) — `/api/saved`

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | `/` | Required | STUDENT | List saved/skipped opportunities |
| POST | `/` | Required | STUDENT | Save, skip, or discard an opportunity |
| DELETE | `/:id` | Required | STUDENT | Remove saved opportunity |

### 2.12 Cohorts — `/api/cohorts`

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | `/` | Required | SCHOOL_ADMIN, TEACHER | List cohorts (teacher sees only assigned cohorts) |
| GET | `/export` | Required | SCHOOL_ADMIN, TEACHER | Export cohort summaries as CSV |
| POST | `/` | Required | SCHOOL_ADMIN | Create cohort |
| GET | `/school-students` | Required | SCHOOL_ADMIN, TEACHER | All students across school with progress + intervention case data |
| POST | `/teachers/import` | Required | SCHOOL_ADMIN | CSV import teacher-to-cohort assignments (format: name,email,cohort) |
| GET | `/:id` | Required | SCHOOL_ADMIN, TEACHER | Cohort detail with student progress |
| PUT | `/:id` | Required | SCHOOL_ADMIN, TEACHER | Update cohort settings |
| POST | `/:id/import` | Required | SCHOOL_ADMIN, TEACHER | CSV import students → creates invitations + sends email |
| POST | `/:id/publish` | Required | SCHOOL_ADMIN, TEACHER | Resend pending invitations; mark cohort PUBLISHED |
| POST | `/:id/add-student` | Required | SCHOOL_ADMIN, TEACHER | Add single student invitation |
| POST | `/:id/teachers` | Required | SCHOOL_ADMIN | Assign/create teacher for cohort |
| POST | `/:id/teachers/import` | Required | SCHOOL_ADMIN | CSV import cohort teachers (format: name,email) |
| DELETE | `/:id/teachers/:teacherId` | Required | SCHOOL_ADMIN | Unassign teacher from cohort |
| DELETE | `/:id` | Required | SCHOOL_ADMIN | Delete cohort (deactivates all memberships, cascades invitations) |
| DELETE | `/:id/students/:studentId` | Required | SCHOOL_ADMIN, TEACHER | Remove student from cohort |

### 2.13 Beneficiaries — `/api/beneficiaries`

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | `/` | Required | Any | List beneficiaries (role-scoped: BENEFICIARY_ADMIN sees own, school staff see school's, students see school's approved) |
| GET | `/directory` | Required | SCHOOL_ADMIN, TEACHER | Search BeneficiaryDirectory (text/zip/city/category) |
| GET | `/directory/nearby` | Required | SCHOOL_ADMIN, TEACHER | Geo-proximity search with haversine SQL; includes nearby schools and school partner request status |
| POST | `/` | Required | SCHOOL_ADMIN | Create custom/private beneficiary |
| PUT | `/:id` | Required | SCHOOL_ADMIN | Edit school-created beneficiary |
| GET | `/my-signups` | Required | STUDENT | Student's own BeneficiarySignup records |
| GET | `/available-slots` | Required | STUDENT | Future slots from school-approved beneficiaries |
| POST | `/import-csv` | Required | SCHOOL_ADMIN | Bulk import community partners from CSV |
| GET | `/slots/:slotId` | Required | Any | Slot detail (BENEFICIARY_ADMIN for own org; school-approved access for others) |
| GET | `/attachments/:attachmentId` | Required | Any | Serve attachment file |
| GET | `/:id` | Required | Any | Beneficiary detail (school-approval check enforced) |
| POST | `/approve-from-directory` | Required | SCHOOL_ADMIN | Create/upsert approval and send invitation from BeneficiaryDirectory |
| POST | `/:id/invite` | Required | SCHOOL_ADMIN | Send/resend partnership invitation email |
| POST | `/:id/approve` | Required | SCHOOL_ADMIN | Approve pending beneficiary |
| POST | `/:id/drop` | Required | SCHOOL_ADMIN | Remove beneficiary from approved list |
| GET | `/:id/schools` | Required | BENEFICIARY_ADMIN, SCHOOL_ADMIN | List schools approved for this beneficiary |
| GET | `/:id/opportunities` | Required | Any | List opportunities for a beneficiary (approval check) |
| POST | `/:id/opportunities` | Required | BENEFICIARY_ADMIN, SCHOOL_ADMIN | Create opportunity with time slots or recurrence rule |
| PATCH | `/:id/opportunities/:oppId` | Required | BENEFICIARY_ADMIN, SCHOOL_ADMIN | Edit opportunity metadata; optionally regenerate recurring slots |
| DELETE | `/:id/opportunities/:oppId` | Required | BENEFICIARY_ADMIN, SCHOOL_ADMIN | Soft-delete (CANCELLED); notifies students |
| POST | `/:id/opportunities/:oppId/attachments` | Required | BENEFICIARY_ADMIN, SCHOOL_ADMIN | Upload file attachments (multer, 10 MB/file, 5 files, 25 MB total) |
| DELETE | `/:id/opportunities/:oppId/attachments/:attachmentId` | Required | BENEFICIARY_ADMIN, SCHOOL_ADMIN | Delete attachment from disk and DB |
| GET | `/:id/signups` | Required | BENEFICIARY_ADMIN | List all signups for beneficiary's events |
| POST | `/:id/slots/:slotId/signup` | Required | STUDENT | Sign up for a time slot (with capacity/waitlist) |
| DELETE | `/:id/slots/:slotId/signup` | Required | STUDENT | Cancel signup (via token or auth) |
| POST | `/:id/slots/:slotId/checkin` | Required | STUDENT | Check in to a slot |
| POST | `/:id/slots/:slotId/checkout` | Required | STUDENT | Check out of a slot |
| POST | `/:id/slots/:slotId/review` | Required | BENEFICIARY_ADMIN, SCHOOL_ADMIN, TEACHER | Approve/reject/mark-no-show a signup's hours |
| DELETE | `/:id/slots/:slotId` | Required | BENEFICIARY_ADMIN, SCHOOL_ADMIN | Delete a future slot (>24h ahead; warns if signups exist) |
| PUT | `/:id/branding` | Required | BENEFICIARY_ADMIN | Update Pro branding (color, logo, signature) |
| GET | `/:id/reminder-config` | Required | BENEFICIARY_ADMIN | Get reminder configuration |
| PUT | `/:id/reminder-config` | Required | BENEFICIARY_ADMIN | Update reminder configuration (Pro-gated: multiple reminders) |
| GET | `/:id/analytics` | Required | BENEFICIARY_ADMIN | Volunteer analytics for org |

### 2.14 Invitations — `/api/invitations`

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | `/student` | Public | — | Look up student invitation by token |
| POST | `/student/accept` | Public | — | Accept student invitation; creates STUDENT account |
| GET | `/beneficiary` | Public | — | Look up beneficiary invitation by token |
| POST | `/beneficiary/accept` | Public | — | Accept beneficiary invitation; creates BENEFICIARY_ADMIN account |
| POST | `/beneficiary/decline` | Public | — | Decline beneficiary invitation |

### 2.15 Self-Submissions — `/api/self-submissions`

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| POST | `/` | Required | STUDENT | Submit self-reported hours |
| POST | `/import` | Required | SCHOOL_ADMIN, TEACHER | Bulk import self-submissions from CSV |
| GET | `/` | Required | Any | List self-submissions (student sees own; school sees all school's) |
| POST | `/:id/approve` | Required | SCHOOL_ADMIN, TEACHER | Approve submission (converts to ServiceSession) |
| POST | `/:id/reject` | Required | SCHOOL_ADMIN, TEACHER | Reject with reason |
| POST | `/:id/request-revision` | Required | SCHOOL_ADMIN, TEACHER | Request revision with note |
| POST | `/:id/cancel` | Required | STUDENT | Cancel pending submission |
| PUT | `/:id` | Required | STUDENT | Update pending/revision-requested submission |

### 2.16 Classrooms (Legacy) — `/api/classrooms`

Kept for backward compatibility; new schools use Cohorts. Supports join-by-code flows for legacy students.

### 2.17 Billing — `/api/billing/organizations`

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | `/:id/summary` | Required | BENEFICIARY_ADMIN (own org only) | Billing summary: tier, subscription status, invoice requests |
| POST | `/:id/checkout` | Required | BENEFICIARY_ADMIN (own org only) | Create Stripe Checkout session (monthly or annual) |
| POST | `/:id/portal` | Required | BENEFICIARY_ADMIN (own org only) | Create Stripe Customer Portal session |
| POST | `/:id/invoice-request` | Required | BENEFICIARY_ADMIN (own org only) | Submit invoice request (enterprise billing) |

### 2.18 School Procurement — `/api/school-procurement`

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | `/:id/summary` | Required | SCHOOL_ADMIN | School billing/procurement summary |
| POST | `/:id/quote-request` | Required | SCHOOL_ADMIN | Submit quote request |
| POST | `/:id/documents` | Required | SCHOOL_ADMIN | Upload procurement document (multer) |
| GET | `/:id/documents/:docId` | Required | SCHOOL_ADMIN | Download procurement document |

### 2.19 School Partners — `/api/school-partners`

Routes for cross-school partner requests (see `schoolPartners.ts`). Used by the Discover page to send/manage partnership requests between schools.

### 2.20 Integrations — `/api/integrations`

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| POST | `/canvas/connect` | Required | SCHOOL_ADMIN | Connect Canvas LMS |
| GET | `/canvas/oauth/url` | Required | SCHOOL_ADMIN | Get Canvas OAuth URL |
| GET | `/canvas/oauth/callback` | Public | — | Canvas OAuth callback |
| POST | `/canvas/disconnect` | Required | SCHOOL_ADMIN | Disconnect Canvas |
| GET | `/canvas/status` | Required | SCHOOL_ADMIN | Canvas connection status |
| GET | `/canvas/errors` | Required | SCHOOL_ADMIN | Canvas sync errors |
| POST | `/canvas/preview` | Required | SCHOOL_ADMIN | Preview Canvas sync (dry run) |
| POST | `/canvas/apply` | Required | SCHOOL_ADMIN | Apply Canvas sync (creates invitations) |
| GET | `/canvas/ops` | Required | SCHOOL_ADMIN | Canvas operational data |
| POST | `/googleClassroom/connect` | Required | SCHOOL_ADMIN | Connect Google Classroom |
| GET | `/googleClassroom/oauth/url` | Required | SCHOOL_ADMIN | Get Google Classroom OAuth URL |
| GET | `/googleClassroom/oauth/callback` | Public | — | Google Classroom OAuth callback |
| POST | `/googleClassroom/disconnect` | Required | SCHOOL_ADMIN | Disconnect Google Classroom |
| GET | `/googleClassroom/status` | Required | SCHOOL_ADMIN | Google Classroom connection status |
| GET | `/googleClassroom/errors` | Required | SCHOOL_ADMIN | Google Classroom sync errors |
| POST | `/googleClassroom/preview` | Required | SCHOOL_ADMIN | Preview Google Classroom sync |
| POST | `/googleClassroom/apply` | Required | SCHOOL_ADMIN | Apply Google Classroom sync |
| GET | `/googleClassroom/ops` | Required | SCHOOL_ADMIN | Google Classroom operational data |

### 2.21 Internal — `/api/internal`

Guarded by `CRON_SECRET` header. Used for scheduled job invocations (e.g., from Vercel Cron).

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/reminders/run` | Trigger reminder scheduler |
| GET | `/canvas/ops` | Internal Canvas operations |
| GET | `/googleClassroom/ops` | Internal Google Classroom operations |

### 2.22 Stripe Webhook — `/api/webhooks/stripe`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/` | Stripe signature | Receives and processes Stripe events (see §8) |

### 2.23 Geocode Proxy — `/api/geocode`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/geocode?address=...` | Public | Proxy Nominatim geocode; rate-limited 30/min/IP |

### 2.24 Health Check

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | Public | Returns `{status: "ok", timestamp}` |

---

## 3. Database Models

Source: `server/prisma/schema.prisma`. Database: PostgreSQL (SQLite in dev).

### 3.1 Identity & Users

| Model | Key Fields | Relationships |
|-------|-----------|---------------|
| **User** | id (cuid), email (unique), passwordHash (nullable), name, role (string), status (ACTIVE/SUSPENDED/REVOKED), emailVerified, googleId (unique, nullable), isTestAccount, grade, house, cohortId, classroomId, schoolId, beneficiaryId, organizationId | Belongs to Cohort, Classroom (legacy), School (staff), Beneficiary, Organization (legacy); has Signups, ServiceSessions, Messages, Notifications, AuditLogs, DataAccessLogs, SavedOpportunities, SelfSubmittedRequests, CohortMemberships |

**UserRole enum:** STUDENT, TEACHER, SCHOOL_ADMIN, BENEFICIARY_ADMIN, ORG_ADMIN

### 3.2 Schools

| Model | Key Fields | Relationships |
|-------|-----------|---------------|
| **School** | id, name, directoryId, type, address/city/state/zip, domain, verified, registrationToken, requiredHours (default 40), verificationStandard, serviceStartDate/EndDate, allowSelfSubmission, ferpaBeneficiaryPiiEnabled, requireOrgVerification, categoryHourCaps (JSON), onboardingComplete, billingStatus, accessStatus, pilotExpiresAt | Has staff (Users), Cohorts, Classrooms, beneficiaryApprovals, groups, verifiedDomains, selfSubmissions, launchBugs, integrations, interventions, billingRecord, quoteRequests, partnerRequests |
| **SchoolDirectory** | id, name, type, address, ncessId (unique), emailDomain, claimed, claimedBySchoolId, source | Has Schools |
| **VerifiedDomain** | id, schoolId, domain | Belongs to School |
| **SchoolPartnerRequest** | id, fromSchoolId, toSchoolId, status (PENDING/APPROVED/REJECTED) | Links two Schools |

### 3.3 Cohorts & Memberships

| Model | Key Fields | Relationships |
|-------|-----------|---------------|
| **Cohort** | id, name, schoolId, requiredHours, serviceStartDate/EndDate, allowSelfSubmission, categoryHourCaps (JSON), usesHouseField, graduationYear, status (DRAFT/PUBLISHED/ARCHIVED) | Belongs to School; has Students (Users), StudentCohortMemberships, StudentInvitations, CohortTeacherAssignments |
| **StudentCohortMembership** | id, studentId, cohortId, source, isActive | Links User ↔ Cohort (many-to-many with metadata) |
| **CohortTeacherAssignment** | id, cohortId, teacherId | Links Cohort ↔ Teacher (User) |
| **StudentInvitation** | id, cohortId, email, name, grade, house, startingHours, token (unique), expiresAt, status (PENDING/ACCEPTED/EXPIRED/REVOKED) | Belongs to Cohort |

### 3.4 Beneficiaries (New Architecture)

| Model | Key Fields | Relationships |
|-------|-----------|---------------|
| **Beneficiary** | id, name, email, phone, category, address, directoryId, status, visibility, createdBySchoolId, planTier (FREE/PRO), stripeCustomerId, stripeSubscriptionId, subscriptionStatus, billingInterval, uploadAbuseStrikes, brandColor, logoUrl, emailSignature | Has Users (members), BeneficiaryOpportunities, SchoolBeneficiaryApprovals, BeneficiaryInvitations, attachments, reminderConfig, invoiceRequests |
| **BeneficiaryDirectory** | id, name, ein (unique), category, address, ncessId (unique), nteeCode, source | Has Beneficiaries |
| **SchoolBeneficiaryApproval** | id, schoolId, beneficiaryId, status (PENDING/APPROVED/REJECTED/BLOCKED), approvedAt | Links School ↔ Beneficiary |
| **BeneficiaryInvitation** | id, schoolId, beneficiaryId, token (unique), expiresAt, status, sentTo | Belongs to Beneficiary |
| **BeneficiaryOpportunity** | id, title, description, beneficiaryId, category, location, address, startDate/endDate, status, requirementsNote, customFields (JSON), schoolRestrictions (JSON), recurrenceRule (JSON), preparationNotes, arrivalInstructions, contactInfo, requiredFormUrl/Name/IsRequired | Belongs to Beneficiary; has TimeSlots, Attachments |
| **BeneficiaryOpportunityAttachment** | id, opportunityId, beneficiaryId, filename (UUID), originalName, mimeType, size, sha256 | Belongs to BeneficiaryOpportunity |
| **BeneficiaryTimeSlot** | id, opportunityId, date, startTime, endTime, durationHours, capacity, recurringGroupId | Belongs to BeneficiaryOpportunity; has BeneficiarySignups |
| **BeneficiarySignup** | id, slotId, studentId, status (CONFIRMED/WAITLISTED/CANCELLED/NO_SHOW), checkedIn/Out, totalHours, verificationStatus, verifiedBy, cancellationToken (unique), attendance | Belongs to BeneficiaryTimeSlot; has BeneficiaryAuditLogs, OrgEventReminderLogs |
| **BeneficiaryAuditLog** | id, action, actorId, signupId | Immutable audit record |
| **OrgReminderConfig** | id, beneficiaryId (unique), reminders (JSON array), waitlistCutoffHours, disableAutoPromotion | Belongs to Beneficiary |
| **OrgEventReminderLog** | id, signupId, reminderType, scheduledFor, sentAt, deliveryStatus | Idempotency log for reminder sends |
| **OrganizationInvoiceRequest** | id, beneficiaryId, status, legalName, address, billingContactName/Email, purchaseOrderRequired, taxExempt | Belongs to Beneficiary |

### 3.5 Service Sessions & Verification (Legacy)

| Model | Key Fields | Relationships |
|-------|-----------|---------------|
| **Opportunity** | id, title, description, location, date, startTime, endTime, durationHours, capacity, organizationId, status (ACTIVE/CANCELLED/COMPLETED) | Belongs to Organization; has Signups, ServiceSessions, SavedOpportunities |
| **Signup** | id, userId, opportunityId, status (CONFIRMED/WAITLISTED/CANCELLED/NO_SHOW) | Links User ↔ Opportunity |
| **ServiceSession** | id, userId, opportunityId, checkInTime, checkOutTime, totalHours, status, verificationStatus, verifiedBy, rejectionReason, signatureType, signatureData, signatureFileName, submittedAt | Links User ↔ Opportunity; has AuditLogs |
| **AuditLog** | id, action, actorId, sessionId, details (JSON) | Immutable; belongs to User (actor) and optionally ServiceSession |
| **SavedOpportunity** | id, userId, opportunityId, status (SAVED/SKIPPED/DISCARDED) | Links User ↔ Opportunity |

### 3.6 Legacy Organizations

| Model | Key Fields | Relationships |
|-------|-----------|---------------|
| **Organization** | id, name, email, phone, description, website, status (PENDING/APPROVED/REJECTED/SUSPENDED), zipCodes (JSON) | Has Users (members), Opportunities, SchoolOrganizations |
| **SchoolOrganization** | id, schoolId, organizationId, status (PENDING/APPROVED/REJECTED/BLOCKED) | Legacy approval link |

### 3.7 Self-Submissions

| Model | Key Fields | Relationships |
|-------|-----------|---------------|
| **SelfSubmittedRequest** | id, studentId, schoolId, organizationName, description, date, hours, evidenceNote, status (PENDING/APPROVED/REJECTED/REVISION_REQUESTED), reviewedBy, rejectionReason, revisionNote, convertedSessionId, category | Belongs to User (student) and School |

### 3.8 School Groups (Legacy)

| Model | Key Fields | Relationships |
|-------|-----------|---------------|
| **StudentGroup** | id, name, schoolId | Has StudentGroupMembers |
| **StudentGroupMember** | id, groupId, studentId | Links StudentGroup ↔ User |

### 3.9 Messaging & Interventions

| Model | Key Fields | Relationships |
|-------|-----------|---------------|
| **Message** | id, subject, body, senderId, receiverId, priority, read | Links User (sender) ↔ User (receiver) |
| **Notification** | id, userId, type, title, body, read, data (JSON) | Belongs to User |
| **InterventionCampaign** | id, schoolId, actorId, actionType, audienceType, subject, bodyPreview, priority, recipientCount | Belongs to School and actor User; has InterventionRecipients |
| **InterventionRecipient** | id, campaignId, studentId, messageId | Links campaign ↔ student ↔ message |
| **InterventionCase** | id, schoolId, studentId, ownerId, status, priority, reason, summary, nextStepForStudent/Staff, dueDate | Links School, student User, owner User |

### 3.10 Data Access Audit (FERPA)

| Model | Key Fields | Description |
|-------|-----------|-------------|
| **DataAccessLog** | id, actorId, action, targetType, targetId, schoolId, details (JSON) | FERPA-required read-access trail; written on student data access, exports, impersonation |

### 3.11 Integrations

| Model | Key Fields | Relationships |
|-------|-----------|---------------|
| **IntegrationConnection** | id, provider (CANVAS/GOOGLE_CLASSROOM), schoolId, status, credentialsEncrypted, config, lastSyncedAt | Belongs to School |
| **IntegrationExternalMapping** | id, connectionId, provider, schoolId, externalType, externalId, localType, localId | Maps external LMS IDs to local entities |
| **IntegrationSyncJob** | id, connectionId, provider, schoolId, mode (PREVIEW/APPLY), status, startedById | Records each sync run |
| **IntegrationSyncError** | id, syncJobId, connectionId, code, message, details | Error records per sync job |

### 3.12 School Billing / Procurement

| Model | Key Fields | Relationships |
|-------|-----------|---------------|
| **SchoolBillingRecord** | id, schoolId (unique), billingStatus, pricePerStudentCents, contractAmountCents, contractStart/EndDate | Belongs to School; has audit logs and documents |
| **SchoolQuoteRequest** | id, schoolId, enrollment, primaryContactName/Email, billingContactName/Email, purchaseOrderRequired, w9Required, coiRequired | Belongs to School |
| **SchoolProcurementDocument** | id, billingRecordId, schoolId, documentType, filename, storedPath, mimeType, uploadedByUserId | File attachment for procurement |
| **SchoolBillingAuditLog** | id, billingRecordId, schoolId, previousStatus, newStatus, changedByUserId | Billing status change trail |

### 3.13 Launch Management

| Model | Key Fields | Relationships |
|-------|-----------|---------------|
| **SchoolLaunchBug** | id, schoolId, title, description, severity (LOW/MEDIUM/HIGH/CRITICAL), status (OPEN/INVESTIGATING/FIXED/etc.), area, source, ownerName | Belongs to School |

---

## 4. Authentication Middleware

**File:** `server/src/middleware/auth.ts`

- **Strategy:** Bearer JWT (jsonwebtoken).
- **Token TTL:** 7 days (configurable via `signToken` options).
- **Validation:** On every authenticated request, verifies JWT signature, then executes a DB lookup (`prisma.user.findUnique`) to confirm the user still exists and has `status === "ACTIVE"`. Suspended or revoked users are rejected with 401 even if the JWT is valid.
- **Payload stored on `req.user`:** `{ userId, email, role }`.
- **Token signing:** `signToken(payload, options?)` — used at login, signup, and impersonation.
- **Hard dependency:** Server refuses to start if `JWT_SECRET` is missing (handled by `lib/env.ts`).

---

## 5. Authorization Functions

**File:** `server/src/middleware/rbac.ts`

- **`requireRole(...roles: string[])`** — Express middleware factory. Returns 401 if `req.user` is absent, 403 if `req.user.role` is not in the provided list. Used inline on route definitions.

**Additional inline authorization patterns (not centralized middleware):**

- **Ownership checks:** Routes that modify beneficiary or school-specific data perform DB lookups to confirm the acting user belongs to the relevant entity (e.g., `user.beneficiaryId === beneficiaryId`, `user.schoolId === school.id`).
- **Cohort-scoped access:** `lib/cohortAccess.ts` — helpers `getStaffAccessScope`, `canAccessCohort`, `assertStudentAccessibleToStaff`, `buildCohortScopedStudentWhere`. Teachers only see their assigned cohorts; SCHOOL_ADMIN sees all school cohorts.
- **Anti-self-verification:** Verification routes check `session.userId !== req.user.userId` to prevent self-approval.
- **FERPA controls:** `ferpaBeneficiaryPiiEnabled` flag on School controls whether student PII is revealed to beneficiary admins in signup lists.
- **Tier gating:** `lib/orgTierGates.ts` — `requireOrgFeature(feature, beneficiary)` blocks Pro-only features (multiple reminders, custom branding, etc.) for FREE-tier beneficiaries.
- **Rate limiting:** Per-route `express-rate-limit` instances guard: signup (100/hr browser, 5/hr API), login (8/15min per IP+email pair), forgot-password (5/15min), resend-verification (3/hr), beneficiary invitations (10/hr), cohort invitations (20/hr per cohort).

---

## 6. File Upload Endpoints

All uploads use `multer` with disk storage (files never held in memory).

| Route | Handler File | Storage Path | Constraints | Notes |
|-------|-------------|-------------|-------------|-------|
| `POST /api/beneficiaries/:id/opportunities/:oppId/attachments` | `routes/beneficiaries.ts` | `uploads/beneficiary-attachments/` | 10 MB/file, 5 files, 25 MB total per request | MIME validated from magic bytes post-upload; SHA-256 dedup; abuse strikes tracked on oversized uploads; storage quota enforced by tier (FREE: 50 MB, PRO: 500 MB) |
| `POST /api/sessions/:id/submit-verification` | `routes/sessions.ts` | `uploads/signatures/` (disk) | Single file | Used when `signatureType === "FILE"`; drawn signatures use base64 body field instead |
| `POST /api/school-procurement/:id/documents` | `routes/schoolProcurement.ts` | `uploads/procurement/` (disk) | — | Procurement document upload for school billing |
| `GET /uploads/*` (static files) | `index.ts` | `uploads/` (static) | `authenticate` middleware required | All upload assets are gated behind authentication |

---

## 7. Email Flows

**Service:** Resend (`resend` SDK). **Fallback:** log-only in dev; local capture for `@mailinator.com` addresses.  
**Provider:** `server/src/services/email.ts`

| Function | Subject | Trigger |
|----------|---------|---------|
| `sendVerificationEmail` | "Verify your GoodHours account" | On signup, on resend-verification request |
| `sendPasswordResetEmail` | "Reset your GoodHours password" | On forgot-password request |
| `sendHourApprovedEmail` | "Your volunteer hours have been approved" | When ServiceSession is approved (legacy verification flow) |
| `sendHourRemovedEmail` | "Your volunteer hours have been removed" | When previously approved hours are administratively removed |
| `sendStudentLeftClassroomEmail` | `"${studentName} has left your classroom"` | When student leaves a classroom |
| `sendOrgApprovalRequestEmail` | "New organization approval request" | When org requests school approval (legacy) |
| `sendOrgRequestApprovedEmail` | "Your organization has been approved" | When school approves org (legacy) |
| `sendAdminTransferRequestEmail` | "Classroom admin transfer request" | When classroom admin transfer is initiated |
| `sendEventReminderEmail` | `"Reminder: ${eventName} is coming up"` | Triggered by event reminder scheduler; supports ICS attachment, Pro branding |
| `sendStudentInvitationEmail` | `"You've been invited to join ${schoolName} on GoodHours"` | On cohort student invitation (import or add-student) |
| `sendBeneficiaryInvitationEmail` | `"${schoolName} invited ${beneficiaryName} to partner on GoodHours"` | When school invites a beneficiary to partner |
| `sendSchoolRegistrationMagicLink` | "Complete your GoodHours school registration" | On school magic-link registration |
| `sendSelfSubmissionApprovedEmail` | "Your self-submitted hours have been approved" | On self-submission approval |
| `sendSelfSubmissionRejectedEmail` | "Your self-submitted hours were not approved" | On self-submission rejection |
| `sendNewSubmissionAlertEmail` | `"New self-submitted hours pending review — ${studentName}"` | When student submits hours; sent to school admin |
| `sendSubmissionRevisionEmail` | "Your submission needs revision" | When school requests revision on a self-submission |
| `sendServiceDeadlineReminderEmail` | `"${schoolName} service deadline reminder"` | Triggered by reminder scheduler for students behind on hours |
| `sendBehindScheduleEmail` | "You are behind on service hours" | Triggered by reminder scheduler; includes risk factors |
| `sendOwnershipTransferConfirmationEmail` | `"Confirm ownership transfer for ${schoolName}"` | When school admin initiates ownership transfer |
| `sendAdminPendingReviewAlertEmail` | `"${schoolName} has items waiting for review"` | Triggered by reminder scheduler; alerts admin of pending review queue |
| `sendTeacherInvitationEmail` | `"You've been invited to teach at ${schoolName} on GoodHours"` | When new teacher is created via cohort teacher import |
| `sendTeacherAssignmentEmail` | `"You've been assigned to teach ${cohortName} at ${schoolName}"` | When existing teacher is assigned to a cohort |

---

## 8. Stripe Routes and Webhook Handlers

### Billing API (`routes/billing.ts`, mounted at `/api/billing/organizations`)

- **Authorization:** Inline `requireBeneficiaryAdmin(userId, beneficiaryId)` check (not `requireRole`); confirms user has role `BENEFICIARY_ADMIN` and is associated with the specific beneficiary.
- **Checkout:** Creates or reuses Stripe Customer, creates Checkout Session for subscription (monthly or annual price from `BILLING_CONFIG`).
- **Portal:** Creates Customer Portal Session for subscription management.
- **Invoice Request:** Records enterprise billing request in `OrganizationInvoiceRequest` table (no Stripe interaction).

### Stripe Webhook Handler (`routes/stripeWebhooks.ts`, mounted at `/api/webhooks/stripe`)

- Receives raw body for signature verification (`express.raw`).
- Validates `Stripe-Signature` header against `STRIPE_WEBHOOK_SECRET`.
- All handlers are idempotency-safe (safe to replay).

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Sets `planTier = PRO`, `proActivatedAt`, `subscriptionStatus = ACTIVE`, stores subscription ID and price ID on Beneficiary |
| `customer.subscription.created` | Updates subscription metadata (status, tier, interval, period end, cancel flag) |
| `customer.subscription.updated` | Same as created; handles cancellation scheduling (`cancel_at_period_end`) |
| `customer.subscription.deleted` | Sets `planTier = FREE`, `subscriptionStatus = CANCELLED`, clears subscription fields |
| `invoice.paid` | Updates `subscriptionStatus = ACTIVE`, refreshes `currentPeriodEnd` |
| `invoice.payment_failed` | Sets `subscriptionStatus = PAST_DUE` |

---

## 9. Scheduled / Background Jobs

Three `setInterval`-based background jobs are started when the Express server boots (`index.ts → app.listen` callback). They are suppressed in serverless/runtime-managed environments.

| Job | File | Interval | Description |
|-----|------|----------|-------------|
| **Reminder Scheduler** | `lib/reminders.ts` | Configurable (default ~60 min) | Sends service deadline reminder emails to students behind on hours; sends admin pending-review alerts; controlled by `APP_ENV` and serverless flag |
| **Upload Cleanup Job** | `lib/uploadCleanup.ts` | 60 min | Scans `uploads/` directory for orphaned files (not referenced in DB) and deletes them |
| **Event Reminder Scheduler** | `lib/eventReminders.ts` | 15 min | Sends pre-event reminder emails to confirmed BeneficiarySignup students based on `OrgReminderConfig`; writes idempotency records to `OrgEventReminderLog` |

The `/api/internal/reminders/run` endpoint (guarded by `CRON_SECRET`) allows external schedulers (e.g., Vercel Cron) to trigger the reminder job on serverless deployments.

---

## 10. Environment Variables

Source: `server/.env.example`

| Variable | Sensitive | Description |
|----------|-----------|-------------|
| `DATABASE_URL` | **YES** | PostgreSQL connection string (production) |
| `DEV_DATABASE_URL` | **YES** | PostgreSQL connection string (dev override) |
| `JWT_SECRET` | **YES** | JWT signing secret — required at startup |
| `FIELD_ENCRYPTION_KEY` | **YES** | AES encryption key for PII fields (phone, integration credentials) |
| `PORT` | No | Express server port (default: 3001) |
| `APP_URL` | No | Frontend URL for CORS and redirects |
| `RESEND_API_KEY` | **YES** | Resend email service API key |
| `EMAIL_FROM` | No | Sender address for transactional emails |
| `EMAIL_DELIVERY_MODE` | No | `auto` / `send` / `log` — controls email delivery behavior |
| `CLIENT_URL` | No | Frontend base URL used in email links |
| `ALLOWED_ORIGINS` | No | Comma-separated allowed CORS origins |
| `APPROVED_SCHOOL_DOMAINS` | No | Comma-separated approved email domains for signup (prod only) |
| `ALLOW_PERSONAL_EMAIL_DOMAINS` | No | `true` in dev to bypass personal-email block |
| `ALLOW_QA_SIGNUP_BYPASS` | No | `true` only for QA alias testing |
| `APP_ENV` | No | `development` / `production` — controls email mode, rate limits, devtools |
| `ALLOW_SHARED_DEV_DATABASE` | No | Safety flag; prevents accidental writes to shared/prod DB in dev |
| `CRON_SECRET` | **YES** | Shared secret for internal scheduled job endpoints |
| `STRIPE_SECRET_KEY` | **YES** | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | **YES** | Stripe webhook signing secret |
| `STRIPE_PRO_MONTHLY_PRICE_ID` | No | Stripe Price ID for monthly Pro subscription |
| `STRIPE_PRO_ANNUAL_PRICE_ID` | No | Stripe Price ID for annual Pro subscription |
| `ENABLE_IMPERSONATION` | No | `true` enables dev-only impersonation routes (non-prod only) |
| `TEMP_PASSWORD_BCRYPT_ROUNDS` | No | bcrypt rounds for teacher temp password hashing (default: 8) |
| `CANVAS_CLIENT_ID` | **YES** | Canvas LMS OAuth client ID |
| `CANVAS_CLIENT_SECRET` | **YES** | Canvas LMS OAuth client secret |
| `CANVAS_CALLBACK_URL` | No | Canvas OAuth redirect URI |
| `CANVAS_ENABLE_MOCK` | No | `true` uses mock Canvas responses in dev |
| `CANVAS_REQUEST_TIMEOUT_MS` | No | Canvas API request timeout |
| `CANVAS_PAGE_SIZE` | No | Canvas API pagination size |
| `GOOGLE_CLASSROOM_CLIENT_ID` | **YES** | Google Classroom OAuth client ID |
| `GOOGLE_CLASSROOM_CLIENT_SECRET` | **YES** | Google Classroom OAuth client secret |
| `GOOGLE_CLASSROOM_CALLBACK_URL` | No | Google Classroom OAuth redirect URI |
| `GOOGLE_CLASSROOM_ENABLE_MOCK` | No | `true` uses mock Google Classroom responses in dev |
| `GOOGLE_CLASSROOM_REQUEST_TIMEOUT_MS` | No | Google Classroom API request timeout |
| `GOOGLE_CLASSROOM_PAGE_SIZE` | No | Google Classroom API pagination size |
| `GOOGLE_CLASSROOM_API_BASE_URL` | No | Google Classroom API base URL |
| `GOOGLE_CLASSROOM_AUTH_BASE_URL` | No | Google auth base URL |
| `GOOGLE_CLASSROOM_TOKEN_BASE_URL` | No | Google token endpoint base URL |
| `VERCEL_ENV` | No | Set by Vercel; `production` enables production mode |
| `VERCEL_URL` | No | Set by Vercel; used as CLIENT_URL fallback |
| `NEXT_PUBLIC_CLIENT_URL` | No | Alternative CLIENT_URL env var |
| `MAILINATOR_EMAIL_FROM` | No | From address for Mailinator test emails |

---

## 11. Existing Tests

### 11.1 End-to-End Tests (`tests/`)

**Framework:** Playwright (`@playwright/test`)  
**Config:** `playwright.config.ts` (root)

| File | Coverage Area |
|------|--------------|
| `tests/pw-e2e.spec.ts` | Core e2e flows |
| `tests/goodhours.qa.spec.ts` | General QA smoke tests |
| `tests/ui-surface-audit.spec.ts` | UI surface / button coverage audit |
| `tests/ui-interaction-audit.spec.ts` | UI interaction patterns |
| `tests/ui-stateful-audit.spec.ts` | Stateful UI flows (uncommitted file) |
| `tests/button-coverage.current.spec.ts` | Button coverage snapshot |
| `tests/dashboard-stats.spec.ts` | Dashboard statistics display |
| `tests/launch-center.spec.ts` | Launch center page flows |
| `tests/join-by-code-gate.spec.ts` | Join-by-code invitation gate |
| `tests/intervention-workflow.spec.ts` | Intervention case creation and messaging |
| `tests/canvas-integration.spec.ts` | Canvas LMS integration sync |
| `tests/canvas-oauth.spec.ts` | Canvas OAuth flow |
| `tests/canvas-settings-ui.spec.ts` | Canvas settings UI |
| `tests/google-classroom-integration.spec.ts` | Google Classroom integration sync |
| `tests/google-classroom-oauth.spec.ts` | Google Classroom OAuth flow |
| `tests/google-classroom-settings-ui.spec.ts` | Google Classroom settings UI |

### 11.2 Security Tests (`tests/security/`)

**Framework:** Playwright

| File | Coverage Area |
|------|--------------|
| `01-tenant-isolation.spec.ts` | Cross-school data isolation |
| `02-role-authorization.spec.ts` | Role-based access enforcement |
| `03-relationship-enforcement.spec.ts` | Ownership / relationship checks |
| `04-messaging-safety.spec.ts` | Message sender/receiver restrictions |
| `05-reports-exports.spec.ts` | Report access and CSV export authorization |
| `06-tokens.spec.ts` | JWT and invitation token security |
| `07-input-validation.spec.ts` | Input validation and injection resistance |
| `08-rule-enforcement.spec.ts` | School rule enforcement (requireOrgVerification, categoryHourCaps) |

### 11.3 Server Unit / Integration Tests (`server/tests/`)

**Framework:** Jest (via `package.json` scripts in `/server`)

| File | Coverage Area |
|------|--------------|
| `server/tests/billing.test.ts` | Billing route logic |
| `server/tests/orgTier.test.ts` | Org tier gate logic |
| `server/tests/prismaErrors.test.ts` | Prisma error handling utilities |
| `server/tests/signupEmailPolicy.test.ts` | Email domain validation policy |
