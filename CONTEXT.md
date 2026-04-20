# GoodHours Context

This document describes the current development codebase in `/Users/abhay/Hourly`. It is the authoritative context document for the app as it exists in dev, including current functionality, route surface, architecture, and known caveats. It does not assume that production already matches this state.

## What GoodHours Is

GoodHours is a school-controlled community service tracking and verification platform.

The product is built around one core idea: schools need a system of record for student volunteer hours that is harder to fake, easier to audit, and easier to manage than spreadsheets, email, or paper forms.

The platform connects four actors:

- schools, which set graduation/service rules and supervise compliance
- students, who complete hours and track progress
- beneficiary organizations, which create opportunities and verify attendance
- parents/guardians, who can receive a read-only progress link

The app supports two primary hour sources:

- beneficiary-managed hours, where a beneficiary publishes opportunities and verifies attendance
- student self-submitted hours, where the school reviews outside service that happened off-platform

The app also still carries a legacy organizations/classrooms/service-sessions stack for backward compatibility while the newer school/cohort/beneficiary architecture is the primary system.

## Product Goals

- make student hour totals trustworthy
- let schools define and enforce service policies
- reduce manual review load with reminders, exports, and dashboards
- give beneficiaries a structured way to publish opportunities and approve attendance
- preserve auditability for compliance and dispute resolution

## Stack

| Layer | Current implementation |
| --- | --- |
| Frontend | React 19, Vite, TypeScript, Tailwind CSS, React Router |
| Backend | Express 4, TypeScript |
| Database | PostgreSQL via Prisma |
| Auth | JWT bearer auth, bcrypt password auth, Google OAuth for school flows |
| Email | Resend-backed email service |
| Reports | CSV exports, student-side PDF generation with `jsPDF` + `jspdf-autotable` |
| Maps | Leaflet / React Leaflet + server-side geocode proxy |
| Deployment shape | Vite static frontend + Vercel `/api` serverless entrypoint re-exporting Express |

## Runtime Shape

### Development

- frontend runs through Vite on `localhost:5173`
- API runs as a long-lived Express server on `localhost:3001`
- Vite proxies `/api` to the backend

### Production-shaped deployment in repo

- `client/dist` is deployed as the static frontend
- `/api/*` is rewritten to `api/index.ts`, which re-exports the Express app
- this is a serverless shape on Vercel
- Vercel Cron fires `GET /api/internal/reminders/run` daily at 8 AM UTC, secured with `CRON_SECRET`

## High-Level Architecture

### Frontend

- `client/src/App.tsx` defines public routes plus role-gated student, school, and beneficiary routes
- `client/src/hooks/useAuth.tsx` provides the auth context and cached current-user state
- `client/src/lib/api.ts` handles authenticated JSON requests plus authenticated blob downloads
- page components are grouped by audience: `student`, `school`, `beneficiary`, `admin`, plus public pages

### Backend

- `server/src/index.ts` mounts route groups under `/api`
- auth is enforced through JWT middleware plus `requireRole(...)`
- Prisma is the persistence layer for all application data
- service rules, hour aggregation, risk calculation, reminders, audit logging, and field encryption live under `server/src/lib`

### Primary route groups

- `/api/auth` and `/api/auth/google`
- `/api/cohorts`
- `/api/beneficiaries`
- `/api/invitations`
- `/api/self-submissions`
- `/api/schools`
- `/api/messages`
- `/api/reports`
- legacy: `/api/opportunities`, `/api/signups`, `/api/sessions`, `/api/verification`, `/api/organizations`, `/api/saved`, `/api/classrooms`

## Roles

### `STUDENT`

- views progress toward required hours
- browses opportunities and time slots
- signs up, cancels, and sees status history
- submits outside hours for school review
- exports personal data and generates parent links

### `SCHOOL_ADMIN`

- configures school rules
- manages cohorts, students, and staff
- approves beneficiary relationships
- reviews self-submissions
- runs exports, reports, reminders, and bulk messaging

### `TEACHER`

- has access to most school dashboards and student views for the associated school
- can review self-submissions, send school messages, and run reminder cycles
- some actions remain admin-only, such as certain settings changes and some export paths

### `BENEFICIARY_ADMIN`

- manages a beneficiary profile
- accepts or declines school partnership invitations
- creates opportunities and time slots
- approves, rejects, or marks no-shows for student signups
- can inspect verification history for signups owned by the beneficiary

### `ORG_ADMIN` (legacy)

- legacy role from the old organization/opportunity/session model
- backend support still exists
- current primary frontend treats this role as sunset and asks the user to upgrade/re-register

## Core Data Model

### School

The school is the main administrative boundary for the new architecture.

Current school-level rule fields include:

- `requiredHours`
- `verificationStandard`
- `serviceStartDate`
- `serviceEndDate`
- `allowSelfSubmission`
- `requireOrgVerification`
- `categoryHourCaps`
- `allowJoinByCode`
- `onboardingComplete`
- service-area zip codes and location metadata

### Cohort

A cohort is the main student grouping model. It replaces the legacy classroom model for new flows.

Cohorts support:

- `requiredHours` override
- `serviceStartDate` override
- `serviceEndDate` override
- `allowSelfSubmission` override
- `categoryHourCaps` override
- publish state and invitation-based enrollment

### Beneficiary

Beneficiaries are nonprofit/public-service entities that partner with schools.

They support:

- directory-backed discovery
- school approval / invitation workflows
- organization profiles
- opportunities and time slots
- student signup verification and audit history

### Student hour records

Hours can come from three sources:

- `BeneficiarySignup`
- `SelfSubmittedRequest`
- legacy `ServiceSession`

The hour calculator aggregates approved and pending totals across all three.

### Audit and compliance records

- `AuditLog` for school-side verification/admin actions
- `BeneficiaryAuditLog` for beneficiary signup verification actions
- `DataAccessLog` for FERPA-style access auditing

### Other notable models

- `StudentInvitation`
- `BeneficiaryInvitation`
- `SchoolBeneficiaryApproval`
- `BeneficiaryOpportunity`
- `BeneficiaryTimeSlot`
- `Notification`
- `Message`
- `SavedOpportunity`
- `StudentGroup` and `StudentGroupMember`
- `VerifiedDomain`
- `SchoolDirectory`
- `BeneficiaryDirectory`

## Functional Inventory

## Public and Authentication Features

### Public pages and routes

- landing page
- login
- signup
- forgot/reset password
- email verification page
- school registration
- school registration verification page
- student invitation acceptance
- beneficiary invitation acceptance
- parent progress page at `/parent-progress`

### Account/auth features

- email/password signup and login
- JWT session handling
- password change
- forgot password and reset password
- current-user profile fetch through `/api/auth/me`
- email verification and resend verification
- account deletion endpoint
- profile update endpoint

### Google and school registration flows

- Google OAuth callback flow
- school discovery by domain
- domain classification endpoint
- school registration initiated from a Google identity token
- school registration completion via verification link
- production-only personal-email blocking for school registration flows

### Dev-only auth utilities

- dev email-test endpoint
- dev email-verification bypass endpoint
- impersonation endpoint and UI

## Student Features

### Student dashboard

The student dashboard is a full progress surface, not just a count of hours.

Current behavior includes:

- total verified hours
- total pending hours
- total hours remaining
- required hours from cohort override or school default
- deadline banner using cohort end date first, then school end date
- overdue messaging when the service period is past
- revision-needed alert for self-submissions sent back for edits
- cohort info card
- upcoming confirmed signups
- recent activity
- recommended opportunities based on remaining hours, category history, open spots, and proximity in time

### Opportunity browsing

- browse available beneficiary slots
- search/filter available opportunities and slots
- view opportunity detail
- view slot detail
- sign up for slots
- see whether a slot is full or waitlisted

### Signup lifecycle

- create beneficiary-based signups
- cancel a signup as a student
- automatic promotion of the next waitlisted student when a confirmed student cancels
- student visibility into current signup statuses

### Progress and status accounting

Student approved and pending totals include:

- beneficiary-approved or beneficiary-pending signups
- school-approved or pending self-submissions
- legacy approved/pending service sessions

### Self-submitted hour workflow

- submit outside volunteer hours
- include organization name, description, date, hours, evidence note, and category
- school-rule enforcement on submission
- reject submissions outside the service date window
- reject submissions when self-submission is disabled
- resubmit after revision request
- re-run rule checks on revision resubmission

### Student settings

- edit profile, phone, bio, grade, avatar, and social links
- change password
- manage notification preferences
- manage privacy/message preferences
- export student CSV
- export student PDF
- generate a time-limited read-only parent progress link
- copy parent link to clipboard
- legacy classroom join/leave UI remains present

### Saved opportunities

Backend support exists for student-saved opportunities through `/api/saved`:

- save an opportunity
- list saved opportunities
- remove a saved opportunity

This support exists in the API layer even though it is not currently a major dedicated top-level UI surface.

### Student messaging

- inbox and sent folder
- send direct messages
- mark messages as read
- view notifications

## School Features

### School dashboard and reporting surfaces

School staff can access:

- school dashboard with high-level totals
- full student list
- on-track and off-track filtered list routes
- cohort list
- cohort detail pages
- approved beneficiary/partner list
- beneficiary discovery flow
- self-submission review queue
- school messaging center
- school settings

### School settings and service rules

School settings currently support:

- school profile fields
- domain and verification status display
- required hours
- service-area zip codes
- school address and location data
- service start date
- service end date
- allow/disallow self-submission
- `verificationStandard`
- `requireOrgVerification`
- per-category hour caps
- allow join-by-code toggle
- password change
- notification preferences
- privacy preferences
- account deletion flow

### Service-rule enforcement

The school rule system is not just cosmetic.

Current enforcement includes:

- self-submission enable/disable
- service date window checks
- category cap checks during self-submission approval
- cohort overrides taking precedence over school defaults
- `verificationStandard === BENEFICIARY_REQUIRED` acting as org-verification-required behavior in the effective rules resolver

### Cohort management

Current cohort functionality includes:

- create cohort
- edit cohort
- delete cohort
- publish cohort
- add students
- import students via CSV
- remove students
- list school students eligible for cohort assignment
- cohort-specific required hours and service-rule overrides
- cohort-scoped CSV export
- cohort-scoped at-risk CSV export

### Student oversight

School staff can:

- list all students for the school
- see approved hours, pending hours, required hours, status, risk reasons, no-show count, and deadline proximity
- inspect beneficiary verification history for a specific student
- remove verified legacy hours with an audit trail
- anonymize/delete a student account for right-to-delete scenarios
- view FERPA-style data access logs

### At-risk logic

The at-risk system uses `buildStudentProgressRecords(...)`.

Current risk inputs include:

- low percent completion
- large pending hour backlog
- no-shows
- being behind expected pace across the service window
- near deadline with insufficient progress
- overdue service deadline

Each progress record includes:

- approved hours
- pending hours
- required hours
- remaining hours
- percent complete
- service start and end dates
- days to deadline
- no-show count
- status: `COMPLETED`, `ON_TRACK`, or `AT_RISK`
- risk level: `NONE`, `LOW`, `MEDIUM`, `HIGH`
- human-readable risk reasons

### At-risk exports

School staff can fetch at-risk students as:

- JSON
- CSV
- optionally cohort-filtered CSV

### Beneficiary discovery and partnership management

Schools can:

- browse the beneficiary directory
- browse nearby directory results
- create a custom beneficiary
- import beneficiaries via CSV
- invite a beneficiary to partner
- approve a beneficiary
- drop a beneficiary relationship
- see linked beneficiaries/partners

### Staff and group management

Current school-side admin surfaces also include:

- create teacher accounts
- assign a teacher to a classroom in the legacy stack
- create student groups
- list groups
- view group members
- add students to groups

### Self-submission review workflow

School staff can:

- list self-submissions
- filter by status
- approve a submission
- approve with adjusted hours
- enforce or explicitly override category caps
- reject with reason
- request revision with note
- send in-app notifications and email hooks for approval, rejection, revision, and new pending submissions

### Launch operations center

School staff now have a dedicated launch/rollout surface for early deployment operations.

It includes:

- live onboarding instructions with school-specific rollout notes
- a launch checklist driven by real product state (location, partners, cohorts, invites, student activity)
- a support process definition with owner, channels, first-response SLA, and escalation window
- a rollback plan with trigger, freeze action, rollback steps, restore checks, and drill date
- a bug triage list with severity, status, owner, workaround, next action, and timestamps
- first-user monitoring with rollout target, watch list, saved monitoring notes, and one-click reminder runs

The monitoring view aggregates:

- approved and pending partners
- cohort publish state
- invited / accepted / enrolled students
- students with hours
- total approved and pending hours
- pending review queue size
- at-risk student count
- no-show count
- open and critical rollout bugs

## Beneficiary Features

### Beneficiary onboarding and partnerships

Beneficiary admins can:

- accept beneficiary invitations
- decline beneficiary invitations
- view invited/linked schools
- manage the beneficiary profile

### Opportunity and slot management

Beneficiary admins can:

- create opportunities
- create slots under opportunities
- see opportunities for a beneficiary
- see signups for a beneficiary

### Attendance verification workflow

Beneficiary admins can:

- approve signups and assign final hours
- reject signups with a reason
- mark a signup as a no-show
- record verification events into `BeneficiaryAuditLog`

### Verification history visibility

Verification history is visible to:

- the beneficiary that owns the signup
- the student who owns the signup
- school staff for students in their school

The history payload includes:

- signup status
- verification status
- hours
- rejection reason
- check-in/check-out state
- slot + opportunity context
- chronological audit history with actor attribution

## Messaging and Notifications

### Direct messaging

Current messaging features include:

- user-to-user messaging
- inbox
- sent folder
- priority messages
- mark-as-read
- notification creation on receipt

### Bulk school messaging

School staff can send announcements to:

- all students
- at-risk students
- one cohort

Bulk sends create both:

- `Message` rows
- `Notification` rows

### Reminder system

Current reminder logic can generate:

- deadline reminders for students near the service deadline
- behind-schedule alerts for at-risk students
- pending-review alerts for school admins/district admins

Manual reminder execution exists at:

- `/api/messages/reminders/run`

Reminder summaries include:

- school id and name
- deadline reminder count
- behind-alert count
- admin-alert count
- pending review count
- at-risk student count

## Reports, Exports, and Parent Visibility

### Student report

`/api/reports/student` returns a student-facing report with:

- total approved hours
- total pending hours
- total committed legacy hours
- required hours
- completed activity count
- legacy service session lists split by approved/pending/committed/rejected

### School report

`/api/reports/school` returns:

- school name
- required hours
- total students
- total students completed
- per-student status and risk information

### CSV exports

Current exports include:

- student CSV export
- school-wide student CSV export
- cohort-specific student CSV export
- at-risk student CSV export
- cohort-specific at-risk CSV export

The frontend uses authenticated blob downloads for school/cohort CSV actions.

### Student PDF export

Student settings can generate a PDF report in the browser using `jsPDF`.

### Parent progress sharing

Students can generate a read-only parent link from settings.

Current behavior:

- link is generated through `/api/reports/parent-link`
- public page is `/parent-progress?token=...`
- page shows student name, school, cohort, grade, approved hours, pending hours, required hours, remaining hours, percent complete, and deadline
- in dev, link generation preserves `localhost` / `127.0.0.1` origin when appropriate

### Audit endpoints

The reporting layer also contains:

- session audit endpoint for legacy verification review

## Compliance, Security, and Auditability

### Access control

- protected routes require JWT auth
- role checks are enforced server-side
- school data is generally scoped by `schoolId`

### Audit logging

- school/admin actions write to `AuditLog`
- beneficiary verification actions write to `BeneficiaryAuditLog`
- school report/list/export access writes to `DataAccessLog`

### Security controls

- Helmet is enabled
- CORS is restricted to allowed origins plus local dev origins in non-production
- rate limiting exists on auth-sensitive routes
- field encryption support exists for selected profile fields when the encryption key is configured

### Data governance

- student right-to-delete flow anonymizes rather than hard-deletes the user
- audit data is preserved for traceability

## Legacy Compatibility Layer

The old architecture still exists in the codebase and is still mounted:

- organizations
- opportunities
- signups
- service sessions
- verification routes
- classrooms

This legacy layer still matters because:

- some students and staff data may still reference `classroom`
- legacy `ServiceSession` hours are still included in progress calculations and reports
- some teacher-scoped permission logic still references the classroom model

The system is therefore hybrid: new school/cohort/beneficiary flows are primary, but the legacy model remains active for compatibility.

## Client Route Surface

### Public

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

### Authenticated utility

- `/email-verification-required`

### Student

- `/dashboard`
- `/browse`
- `/opportunity/:id`
- `/slot/:id`
- `/submit`
- `/messages`
- `/settings`

### School staff

- `/dashboard`
- `/students`
- `/students/on-track`
- `/students/off-track`
- `/cohorts`
- `/cohorts/:id`
- `/cohorts/:id/on-track`
- `/cohorts/:id/off-track`
- `/beneficiaries`
- `/partners`
- `/discover`
- `/submissions`
- `/launch`
- `/messages`
- `/settings`
- `/admin/impersonate`

### Beneficiary

- `/dashboard`
- `/opportunities`
- `/settings`

## Backend Route Surface

### Auth

- signup, login, me, password update, profile update
- email verification, resend verification
- forgot/reset password
- account deletion
- graduation goal setter
- dev bypass email verification
- impersonation

### Google auth

- domain classification
- Google auth URL
- Google callback
- school search
- register school
- verify school

### Cohorts

- list
- create
- school-students helper
- detail
- update
- CSV import
- publish
- add student
- delete cohort
- remove student from cohort

### Beneficiaries

- list
- nearby directory lookup
- directory browse
- create custom beneficiary
- student my-signups
- available slots
- slot detail
- beneficiary detail
- approve from directory
- invite
- approve
- drop
- linked schools
- opportunities list/create
- slot signup
- signups list
- approve signup
- reject signup
- signup history
- cancel signup
- mark no-show
- invitation list/respond
- profile update

### Self-submissions

- create
- list
- create
- list
- approve (with optional adjusted hours, category-cap enforcement or override)
- reject
- request revision
- student update/resubmit
- bulk CSV import of pre-approved prior hours (`POST /api/self-submissions/import`)

### Schools

- list current school records
- school location/settings helpers
- onboarding update
- launch center workspace
- launch plan update
- launch bug create/update
- settings patch
- effective rules helper
- school detail/update
- students list
- student verification history
- school stats
- organization approve/reject/list/block in legacy flow
- groups CRUD-lite
- staff creation
- remove hours
- student export CSV
- student delete/anonymize
- data access log view
- at-risk JSON/CSV

### Messages

- direct message list/create
- mark message read
- notification list/read
- bulk school messaging
- manual reminder run

### Reports

- student report
- organization report
- school report
- export CSV
- parent-link creation
- parent-progress read-only view
- session audit lookup

### Platform utility endpoints

- `/api/geocode` (rate-limited: 30 req/min per IP)
- `/api/health`
- `/api/internal/reminders/run` (cron-triggered reminder execution)

## Known Caveats

### Some school UI surfaces are broader than backend permissions

The frontend exposes some school actions to both `SCHOOL_ADMIN` and `TEACHER`, but a few backend routes still remain admin-only. Export paths are the clearest example.

## Recent Changes

### `DISTRICT_ADMIN` role removed

`DISTRICT_ADMIN` has been fully removed from both client and server. The role no longer exists in the Role type, route guards, or UI. The app is now school-scoped only across all staff roles.

### Reminder scheduling moved to external cron

The in-process `setInterval` scheduler has been replaced with an internal HTTP endpoint (`/api/internal/reminders/run`) that is triggered by Vercel Cron daily at 8 AM UTC. The endpoint is secured with `CRON_SECRET`. Dev environments can still trigger it manually via the school messages UI or direct HTTP call.

### Bulk prior-hours import for school admins

`POST /api/self-submissions/import` accepts a CSV with columns `student_email`, `organization`, `date`, `hours`, `category`, `description` and bulk-creates pre-approved self-submitted hour records. This lets schools migrate legacy hour records into the platform without per-student entry.

### Hour total accuracy fixes

- `REVISION_REQUESTED` self-submissions now count toward pending hours
- Waitlisted beneficiary signups are excluded from hour totals
- The student group list endpoint now uses `calculateStudentHours` for consistent aggregation

### Beneficiary admin UI improvements

- Opportunities can be edited and deleted inline without navigating away
- No-show confirmation uses a modal (not a browser dialog) to avoid blocking the extension

### Security hardening

- `approvedHours` validated as positive, max 24 on both verification and self-submission approval paths
- Approved beneficiary signup hours validated against `slot.durationHours` ceiling
- `ORG_ADMIN` blocked from querying other orgs' data via `?organizationId=` on report endpoints (IDOR fix)
- Temp passwords for staff accounts use `crypto.randomBytes` instead of `Math.random`
- Teacher assignment verifies that the target `classroomId` belongs to the school before committing
- FERPA audit logs written for settings updates and staff account creation
- All rate limiters use `ipKeyGenerator` to prevent IPv6 bypass
- Geocode endpoint rate-limited at 30 req/min per IP
- Beneficiary invitation acceptance now auto-promotes the `SchoolBeneficiaryApproval` to `APPROVED`
- `COHORT_DELETED` audit log written on cohort deletion
- `express-rate-limit` added to root `package.json` for Vercel compatibility

### Landing page redesign

`client/src/pages/Landing.tsx` has been rewritten with a new layout: sticky nav, two-column hero with inline school dashboard preview, gradient stats bar, tabbed demo section (School Admin / Student / Community Partner), How It Works, Features, gradient CTA, and dark footer. The dashboard preview tabs render inline mock components with realistic example data.

### `/launch` route added to school staff

The Launch Center is now accessible at `/launch` for `SCHOOL_ADMIN` and `TEACHER` roles. The `School` model stores the launch config in `launchOnboardingConfig` (JSON). Bug tracking is stored in `SchoolLaunchBug` records.

## Current State Summary

GoodHours in dev is a large, hybrid service-hours platform with:

- school rule configuration and enforcement
- cohort-based student management
- beneficiary discovery, approval, and opportunity publishing
- verified beneficiary attendance workflows
- school-reviewed self-submitted hours with bulk CSV import for prior hours
- direct messaging and school-wide announcements
- automated reminder logic via external Vercel Cron
- at-risk detection and exports
- student CSV/PDF export
- public parent progress sharing
- launch operations center for school rollout management
- audit logging and FERPA-style access tracking
- security hardening across rate limits, input validation, IDOR guards, and audit trails
- legacy compatibility for the earlier organization/classroom/session stack

This is the state that should be treated as current context before any production promotion work.
