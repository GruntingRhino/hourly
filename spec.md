# GoodHours Specification

Last updated: 2026-04-20

This document is the implementation-grounded product and system specification for GoodHours. It is derived from `CONTEXT.md`, the current client and server code, Prisma schema, and test coverage. Where product intent and implementation diverge, this spec describes the current implemented behavior and explicitly flags the mismatch.

## 1. Product Definition

GoodHours is a school-controlled community service tracking platform. The system exists to make student service-hour accounting more trustworthy, more auditable, and easier to operate than spreadsheet, email, and paper workflows.

The primary architecture is school-centric:

- Schools define service rules, supervise compliance, and control student participation.
- Students discover opportunities, log hours, and track progress.
- Beneficiary organizations publish opportunities and verify attendance.
- Parents or guardians can consume a time-limited read-only progress link.

The platform is hybrid:

- The primary architecture is `School -> Cohort -> Student` plus `School <-> Beneficiary`.
- A legacy `Organization -> Opportunity -> ServiceSession -> Verification` stack still exists and remains mounted for compatibility.

## 2. Product Goals

- Produce hour totals that schools can treat as a system of record.
- Enforce school-defined service policies instead of treating settings as cosmetic.
- Reduce manual review work through dashboards, imports, reminders, reports, and messaging.
- Preserve auditability for disputes, compliance reviews, and data-access tracking.
- Support early-school rollout with operational tooling, not just end-user workflows.

## 3. Runtime and Architecture

### 3.1 Stack

- Frontend: React 19, Vite, TypeScript, Tailwind, React Router.
- Backend: Express 4, TypeScript.
- Persistence: PostgreSQL via Prisma.
- Auth: JWT bearer tokens, bcrypt password auth, Google OAuth for school registration flows.
- Email: Resend-backed email service.
- Mapping: Leaflet client-side, server geocode proxy.
- Reports: CSV exports, browser-generated PDFs via `jsPDF`.
- Deployment shape: static frontend plus Vercel serverless `/api` entrypoint re-exporting Express.

### 3.2 Environments

- Local development: Vite on `localhost:5173`, Express on `localhost:3001`, Vite proxies `/api`.
- Production shape: static client build plus `/api/*` rewrite to `api/index.ts`.
- Scheduled jobs: Vercel Cron hits `GET /api/internal/reminders/run` daily at 8 AM UTC using `CRON_SECRET`.

### 3.3 System Boundaries

- The frontend is role-gated but backend authorization remains the actual enforcement boundary.
- Prisma is the canonical persistence layer.
- Business logic for hour aggregation, school rules, reminders, launch readiness, and FERPA-style audit logging lives in `server/src/lib`.

## 4. Roles and Permissions

### 4.1 `STUDENT`

- View progress, deadlines, approved hours, pending hours, and risk state.
- Browse approved beneficiary opportunities and slot details.
- Sign up, cancel, and see waitlist/confirmation state.
- Submit self-reported hours and revise submissions when asked.
- Send direct messages within allowed relationship boundaries.
- Export personal CSV and PDF reports.
- Generate a time-limited parent progress link.
- Use legacy classroom join/leave flows when enabled.

### 4.2 `SCHOOL_ADMIN`

- Full school administration role.
- Configure school profile and service rules.
- Manage cohorts, student invitations, staff, groups, reports, and exports.
- Review self-submissions and legacy verification queues.
- Approve, invite, drop, and import beneficiary relationships.
- Run reminder cycles and send bulk announcements.
- Access launch center and launch bug tracking.
- Delete or anonymize student accounts.

### 4.3 `TEACHER`

- Access most school dashboards and oversight surfaces.
- Review self-submissions, run reminders, send bulk messages, and access launch center.
- Some backend routes remain admin-only, especially settings mutations and certain export or destructive flows.

### 4.4 `BENEFICIARY_ADMIN`

- Manage the beneficiary profile.
- Accept or decline school invitations.
- Create, edit, and cancel beneficiary opportunities and slots.
- View signup rosters.
- Approve, reject, or mark no-show on beneficiary signups.
- View approved school relationships and verification history they own.

### 4.5 `ORG_ADMIN` (legacy)

- Legacy organization role is still supported on the backend.
- Legacy route groups remain mounted for opportunities, signups, sessions, verification, organization reports, and announcements.
- The primary client route surface no longer treats `ORG_ADMIN` as a first-class active role.

## 5. Core Domain Model

### 5.1 Primary entities

- `School`: administrative boundary, service rules, launch state, service area, verified domains.
- `Cohort`: student grouping with optional overrides for school rules.
- `User`: role-bearing principal; students may link to a cohort and/or legacy classroom; staff link to a school; beneficiary admins link to a beneficiary.
- `Beneficiary`: partner entity that can be directory-backed or school-created.
- `SchoolBeneficiaryApproval`: per-school partnership record with `PENDING`, `APPROVED`, `REJECTED`, `BLOCKED`.
- `BeneficiaryOpportunity` and `BeneficiaryTimeSlot`: published service work and schedulable attendance windows.
- `BeneficiarySignup`: student attendance reservation and verification record for a slot.
- `SelfSubmittedRequest`: school-reviewed off-platform service request.

### 5.2 Audit and support entities

- `AuditLog`: school-side and legacy verification audit trail.
- `BeneficiaryAuditLog`: beneficiary verification and attendance audit trail.
- `DataAccessLog`: FERPA-style read/export/update audit trail.
- `Message` and `Notification`: direct messaging, announcements, reminders, state-change notifications.
- `SchoolLaunchBug`: rollout and support issue tracking for launch center.

### 5.3 Compatibility entities

- `Classroom`, `Organization`, `Opportunity`, `Signup`, `ServiceSession`, `SchoolOrganization`, `SavedOpportunity`.
- These remain relevant because hour totals, exports, session audits, join-by-code, and older teacher/org flows still depend on them.

## 6. Public and Authentication Requirements

### 6.1 Public routes

- Landing page.
- Login, forgot password, reset password.
- Email verification page.
- School registration and school registration verification.
- Student invitation acceptance.
- Beneficiary invitation acceptance.
- Parent progress page.

### 6.2 Auth rules

- JWT bearer auth secures protected API routes.
- Email/password login is rate limited.
- Forgot-password and resend-verification are rate limited.
- Email verification tokens expire after 24 hours.
- Parent progress tokens expire after 30 days.
- Direct self-signup is currently restricted to `SCHOOL_ADMIN`.
- Students and beneficiary admins are invitation-based.
- Dev-only auth utilities exist for test email capture, dev email-verification bypass, and impersonation.

### 6.3 School registration via Google

- School registration begins with Google identity proof.
- School directory search supports fuzzy search and domain match.
- Production blocks personal-email domains for school registration flows.
- Directory-claimed schools reject duplicate registration and return the registered contact email when possible.
- Registration creates a pending school record plus a private self-beneficiary for the school.
- Completion happens through a magic-link verification flow.

## 7. Student Requirements

### 7.1 Student dashboard

- Show approved, pending, remaining, and required hours.
- Resolve required hours from cohort override first, then school default.
- Resolve deadlines from cohort override first, then school default.
- Show cohort metadata, recent activity, and upcoming/confirmed activity.
- Show revision-needed self-submission state.
- Show recommended opportunities based on remaining hours, history, open spots, and timing.

### 7.2 Opportunity discovery and signup

- Students browse only opportunities available to their school.
- Slot detail requires an approved school-beneficiary relationship.
- Signups create `CONFIRMED` or `WAITLISTED` records depending on capacity.
- Duplicate slot signups are rejected.
- Canceling a confirmed signup promotes the oldest waitlisted signup for that slot.
- Waitlisted signups do not count toward pending hours.

### 7.3 Beneficiary attendance and verification

- Students can view their beneficiary signups.
- Beneficiary admins approve signups with final hours, reject signups with a reason, or mark no-show.
- Approved signup hours may not exceed slot duration.
- Verification history is visible to the owning student, owning beneficiary, and the student’s school staff.

### 7.4 Self-submitted hours

- Students submit organization name, description, date, hours, evidence note, and category.
- Hours must be positive and at most 24.
- Submission is blocked if self-submission is disabled by effective rules.
- Submission is blocked outside the effective service date window.
- Revision-requested submissions can be edited and resubmitted; approved or rejected submissions cannot.
- Revision resubmission re-runs school rule checks.

### 7.5 Student settings and self-service

- Edit profile, phone, grade, house, bio, avatar, and social links.
- Change password.
- Manage notification and privacy/message preferences at the profile level.
- Export personal CSV of approved hours across all approved sources.
- Generate PDF report in browser.
- Generate and copy a parent progress link.
- Use legacy classroom join/leave flows when the school allows join-by-code.

### 7.6 Saved opportunities and legacy browse state

- API support exists for saving, listing, and removing saved opportunities in the legacy opportunity model.
- QA coverage indicates `Saved`, `Skipped`, `Discarded`, and recovery behavior remain part of the browse experience, even though this is not a primary top-level route in the new architecture.

## 8. School Requirements

### 8.1 Dashboard and student oversight

- Show school totals, progress metrics, and at-risk counts.
- List all students in the school across cohorts and legacy classrooms.
- Provide on-track and off-track filtered views.
- Show approved hours, pending hours, required hours, percent complete, no-show count, deadline proximity, and risk reasons.
- Allow school staff to inspect a student’s beneficiary verification history and hour breakdown.

### 8.2 School settings and rules

- Manage school profile, domain, required hours, service-area ZIP codes, address, and geocoded location.
- Manage service start/end dates.
- Manage self-submission policy.
- Manage verification standard and explicit org-verification requirement.
- Manage per-category hour caps.
- Manage join-by-code enablement.
- Mark onboarding complete.

### 8.3 Rule enforcement

- Effective rules resolve by merging cohort overrides over school defaults.
- `verificationStandard === BENEFICIARY_REQUIRED` is treated as requiring org verification.
- Self-submission approval checks category caps unless `overrideCap=true`.
- Category cap logic counts already approved beneficiary hours plus approved self-submitted hours for the same category.
- Service dates and self-submission enablement are enforced both on create and resubmit.

### 8.4 Cohort management

- Create, edit, publish, and delete cohorts.
- Configure cohort-level required hours and service-rule overrides.
- Add a single student to a cohort.
- Import invitations from CSV.
- Remove students from cohorts.
- Export cohort-scoped CSV and at-risk CSV.
- Publish state controls whether the cohort is treated as live.

### 8.5 Student administration

- Create teacher accounts with secure random temporary passwords.
- Create student groups and add members.
- Remove verified legacy hours with an audit trail.
- Delete/anonymize student accounts while preserving auditability.
- View FERPA-style data access logs.

### 8.6 Self-submission review

- List all self-submissions for the school, optionally filtered by status.
- Approve with original or adjusted hours.
- Reject with required reason.
- Request revision with note.
- Generate notifications and email hooks for approval, rejection, revision, and new pending work.
- Bulk import pre-approved prior hours from CSV.

### 8.7 Beneficiary relationship management

- Browse directory beneficiaries and nearby geocoded results.
- Create custom beneficiaries.
- Import beneficiaries by CSV.
- Invite beneficiaries to partner.
- Approve, re-approve, or drop beneficiaries.
- List approved or pending partners.

### 8.8 Reporting and export

- View school compliance report with per-student risk and completion state.
- Export school-wide student CSV.
- Export cohort-filtered CSV.
- Export at-risk students as JSON or CSV, optionally cohort-filtered.
- Audit log accesses are written for school report and export actions.

### 8.9 Launch center

- View launch workspace with readiness summary, checklist, metrics, launch plan, and bug list.
- Configure onboarding instructions, support process, rollback plan, and first-user monitoring.
- Create and update launch bugs with severity, status, owner, workaround, and next action.
- Metrics aggregate partners, cohort state, student funnel, pending review queue, at-risk counts, no-shows, and rollout bug counts.

## 9. Beneficiary Requirements

### 9.1 Onboarding and partnerships

- Accept or decline invitation tokens.
- Existing beneficiary-admin accounts can be linked to additional invited beneficiaries or school relationships.
- Accepting an invitation auto-promotes the school-beneficiary approval to `APPROVED`.
- Beneficiaries can list approved school relationships.

### 9.2 Opportunity and slot management

- Create opportunities with one or more time slots.
- Edit non-cancelled opportunities inline.
- Cancel opportunities only when no active student signups remain.
- Restrict opportunities to specific schools or make them available to all approved schools.
- Provide location, requirements, and slot capacity metadata.

### 9.3 Signup and verification operations

- View signups across owned opportunities.
- Approve signups with final hours.
- Reject signups with required reason.
- Mark no-show.
- Persist verification events to `BeneficiaryAuditLog`.
- Expose chronological verification history with actor attribution.

## 10. Messaging, Notifications, and Reminder Requirements

### 10.1 Direct messaging

- Inbox and sent folder.
- Send by receiver ID or receiver email.
- Mark messages as read.
- Create notification on receipt.

### 10.2 Relationship rules for messaging

- Same-school staff-to-staff and staff-to-student is allowed.
- Student-to-student messaging is blocked.
- School-side users can message a beneficiary admin only when the school-beneficiary relationship is approved.
- Beneficiary admins can message school staff, not students, and only when the relationship is approved.
- Receiver lookup uses a non-enumerable error response.

### 10.3 Bulk school messaging

- Audience options: all students, at-risk students, or one cohort.
- Bulk sends create both `Message` and `Notification` rows.
- At-risk targeting uses `buildStudentProgressRecords(...)`, not a naive static threshold.

### 10.4 Reminder cycle

- Manual reminder run is available to school staff and rate limited to one per user per hour.
- Automated reminder cycle can target a single school or all schools.
- Reminder types: approaching deadline, at-risk progress, pending review alerts to admins.
- Duplicate notifications of the same type are suppressed within a 24-hour freshness window.

## 11. Reporting, Sharing, and Audit Requirements

### 11.1 Student report

- Returns all service sessions plus approved/pending/committed/rejected legacy slices.
- Approved and pending totals come from all three sources: beneficiary signups, self-submissions, and legacy service sessions.
- School staff can access a student report only for students in their own school.

### 11.2 School report

- Returns required hours, total students, completed count, and per-student progress/risk state.
- Uses the same risk engine as oversight lists and reminder targeting.

### 11.3 CSV and PDF export

- Student CSV export is student-only and always exports the caller’s own approved data regardless of requested `type`.
- Student PDF export is browser-generated.
- School CSV exports are separate school routes, not the student report export route.

### 11.4 Parent progress sharing

- Student generates a signed `PARENT_PROGRESS` token valid for 30 days.
- Public endpoint returns read-only student, school, cohort, progress, and deadline data.
- Public endpoint is rate limited and requires a valid token purpose.

### 11.5 Audit trails

- Session audit logs are visible to the owning student, school staff in the student’s school, and the owning legacy org admin.
- School report/list/export and settings-update accesses generate `DataAccessLog` rows.
- Beneficiary verification actions generate beneficiary audit records.

## 12. Security and Compliance Requirements

- Helmet must be enabled.
- CORS must be restricted to configured origins, localhost in non-production, and approved `goodhours.app` origins.
- Auth-sensitive routes must be rate limited with IPv6-safe keys via `ipKeyGenerator`.
- Tenant isolation must be enforced by `schoolId`, `beneficiaryId`, or `organizationId` scoping as appropriate.
- Student right-to-delete is anonymization, not hard delete.
- Field encryption support exists for sensitive values via AES-256-GCM when `FIELD_ENCRYPTION_KEY` is configured.
- Production must require `FIELD_ENCRYPTION_KEY` and `CRON_SECRET`.
- Input validation is enforced with Zod on mutating routes.

## 13. Operational and Data Requirements

- School directory and beneficiary directory are imported from source CSV datasets.
- Beneficiary nearby search uses server-side distance calculation with a 50-mile max radius and can trigger background geocoding by state when directory rows lack coordinates.
- Geocode proxy is rate limited to 30 requests per IP per minute.
- School registration can claim a directory row and link it to a beneficiary-directory entry for dual-use discovery.

## 14. Legacy Compatibility Requirements

- Legacy classrooms remain active because join-by-code, teacher assignment, and some seeded data still depend on them.
- Legacy service sessions still count toward approved and pending hours.
- Legacy organizations, opportunities, signups, and verification routes remain mounted and tested.
- The system must be treated as hybrid until the legacy stack is explicitly retired.

## 15. Implementation Caveats and Spec Notes

- The current frontend and backend permission surfaces are not perfectly symmetric. Some school UI affordances are visible to `TEACHER`, but backend writes remain admin-only.
- The primary client route surface does not expose legacy `ORG_ADMIN` flows, but backend support still exists and test coverage still exercises portions of that stack.
- Public `/signup` historically suggested broader self-signup, but the current backend allows only `SCHOOL_ADMIN` direct signup. Student and beneficiary creation is invitation-based.
- Product intent says beneficiary approval should require beneficiary acceptance. Current code mostly supports that flow through invitation acceptance, but a direct school admin approval endpoint still exists and can force `APPROVED`.
- Message/privacy preferences exist on user records, but direct-message enforcement is relationship-based in current code, not preference-based.
- School-scoped reporting and export paths are split across `/api/reports/*` and `/api/schools/:id/*`; they are not a single unified reporting subsystem.
- Launch center is not a design stub. It is persisted in the `School` record plus `SchoolLaunchBug` records and should be treated as first-class product functionality.

## 16. Current Route Surface Summary

### 16.1 Public client routes

- `/`
- `/login`
- `/signup`
- `/forgot-password`
- `/reset-password`
- `/verify-email`
- `/school/register`
- `/school/verify-registration`
- `/join/student`
- `/join/beneficiary`
- `/parent-progress`

### 16.2 Authenticated client routes

- Student: `/dashboard`, `/browse`, `/opportunity/:id`, `/slot/:id`, `/submit`, `/messages`, `/settings`
- School staff: `/dashboard`, `/onboarding`, `/students`, `/students/on-track`, `/students/off-track`, `/cohorts`, `/cohorts/:id`, `/cohorts/:id/on-track`, `/cohorts/:id/off-track`, `/beneficiaries`, `/partners`, `/discover`, `/submissions`, `/launch`, `/messages`, `/settings`, `/admin/impersonate`
- Beneficiary: `/dashboard`, `/opportunities`, `/settings`

### 16.3 Primary backend route groups

- `/api/auth`
- `/api/auth/google`
- `/api/cohorts`
- `/api/beneficiaries`
- `/api/invitations`
- `/api/self-submissions`
- `/api/schools`
- `/api/messages`
- `/api/reports`
- `/api/internal`
- Legacy: `/api/opportunities`, `/api/signups`, `/api/sessions`, `/api/verification`, `/api/organizations`, `/api/saved`, `/api/classrooms`

## 17. Canonical System Statement

GoodHours is not just a volunteer-opportunity board. It is a school-operated compliance system with discovery, attendance verification, policy enforcement, audit logging, exports, reminders, and launch operations. Any future design or refactor should preserve that core identity and explicitly account for the hybrid legacy layer until migration is complete.
