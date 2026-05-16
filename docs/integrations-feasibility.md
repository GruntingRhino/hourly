# SIS/LMS Integrations Feasibility

Date: 2026-05-09

Status: research only. No integrations implemented.

## Executive Summary

GoodHours is currently optimized for school-controlled, invitation-driven enrollment rather than direct SIS provisioning. The current student onboarding path is:

1. school staff create a cohort
2. school staff import a CSV or add students manually
3. GoodHours creates `StudentInvitation` records
4. invitation emails are sent
5. students accept invitations and create or link accounts

That architecture matters. It means the lowest-risk first integration wave is not "full SIS account provisioning." The first useful integration wave is:

1. inbound roster sync for students, cohorts/classes, and teacher assignments
2. optional email-based invitation creation from synced rosters
3. outbound CSV/export compatibility for school reporting

Direct LMS sync is materially easier than most SIS sync because the mainstream LMS vendors publish usable APIs and OAuth flows. SIS feasibility is uneven. PowerSchool, Infinite Campus, Skyward, Aspen, and Alma all appear to support integration paths, but in practice most districts will require admin setup, vendor-specific enablement, and in several cases partner-program or support-gated access.

Recommended first priorities:

1. Canvas
2. Google Classroom
3. Schoology
4. Infinite Campus
5. PowerSchool
6. Alma
7. Skyward
8. Blackboard
9. Aspen

That order is based on current GoodHours architecture, public API quality, sandbox/dev practicality, and likely implementation speed.

## Current GoodHours Architecture

### Data model

Primary identity and enrollment records live in Prisma:

- `User`
  - single user table for `SCHOOL_ADMIN`, `TEACHER`, `STUDENT`, `BENEFICIARY_ADMIN`
  - student-specific fields already exist on `User`: `grade`, `house`, `cohortId`
  - staff school association uses `schoolId`
  - optional Google login via `googleId`
- `School`
  - school-level defaults and policy controls
  - includes `requiredHours`, service window, self-submission policy, category caps
- `Cohort`
  - current primary student grouping model
  - belongs to a school
  - can override school defaults
  - supports `usesHouseField`
- `CohortTeacherAssignment`
  - maps teachers to cohorts
- `StudentInvitation`
  - invitation-based roster onboarding
  - stores `email`, `name`, `grade`, `house`, token, expiration, status
- `Classroom`
  - legacy model kept for backward compatibility
  - new architecture is cohort-first

Relevant schema locations:

- [server/prisma/schema.prisma](/Users/abhay/RTB/GoodHours/server/prisma/schema.prisma:13)
- [server/prisma/schema.prisma](/Users/abhay/RTB/GoodHours/server/prisma/schema.prisma:72)
- [server/prisma/schema.prisma](/Users/abhay/RTB/GoodHours/server/prisma/schema.prisma:167)
- [server/prisma/schema.prisma](/Users/abhay/RTB/GoodHours/server/prisma/schema.prisma:203)

### Auth system

Current auth is JWT bearer auth backed by the `User` table.

- `authenticate` verifies a bearer token and reloads the user from the database
- inactive users are rejected
- role-based authorization is enforced by `requireRole(...)`
- Google OAuth already exists, but only for GoodHours login/registration, not SIS/LMS sync

Relevant code:

- [server/src/middleware/auth.ts](/Users/abhay/RTB/GoodHours/server/src/middleware/auth.ts:1)
- [server/src/middleware/rbac.ts](/Users/abhay/RTB/GoodHours/server/src/middleware/rbac.ts:1)
- [server/src/routes/auth.ts](/Users/abhay/RTB/GoodHours/server/src/routes/auth.ts:1)
- [server/src/routes/googleAuth.ts](/Users/abhay/RTB/GoodHours/server/src/routes/googleAuth.ts:1)

### Student/cohort structure

The effective school-side model is:

- schools own cohorts
- school admins can access all cohorts in their school
- teachers are scoped to assigned cohorts
- students are attached to cohorts, not primarily to classrooms
- classroom routes still exist, but the codebase explicitly marks them as legacy

Relevant code:

- [server/src/lib/cohortAccess.ts](/Users/abhay/RTB/GoodHours/server/src/lib/cohortAccess.ts:1)
- [server/src/routes/cohorts.ts](/Users/abhay/RTB/GoodHours/server/src/routes/cohorts.ts:380)
- [server/src/routes/classrooms.ts](/Users/abhay/RTB/GoodHours/server/src/routes/classrooms.ts:1)

### CSV import flow

Current roster import is invitation-driven, not direct student creation.

Student import:

- route: `POST /api/cohorts/:id/import`
- accepted headers: `name,email,grade` or `name,email,grade,house`
- validates rows, enforces a 2000 row limit
- creates `StudentInvitation` records
- sends invitation emails
- marks the cohort published

Student acceptance:

- route: `POST /api/invitations/student/accept`
- creates a new student account or links an existing student account
- attaches `cohortId`, `schoolId`, `grade`, and `house`

Teacher import:

- route: `POST /api/cohorts/teachers/import`
- accepted headers: `name,email,cohort`
- can create teacher users and assign them to cohorts

Relevant code:

- [server/src/routes/cohorts.ts](/Users/abhay/RTB/GoodHours/server/src/routes/cohorts.ts:839)
- [server/src/routes/cohorts.ts](/Users/abhay/RTB/GoodHours/server/src/routes/cohorts.ts:541)
- [server/src/routes/invitations.ts](/Users/abhay/RTB/GoodHours/server/src/routes/invitations.ts:19)

### Existing API surface relevant to integrations

The app already has enough internal primitives to support future integrations without changing the product surface first:

- auth: `/api/auth/*`, `/api/auth/google/*`
- cohorts: `/api/cohorts/*`
- schools: `/api/schools/*`
- classrooms: `/api/classrooms/*` legacy
- reports: `/api/reports/*`
- invitations: `/api/invitations/*`

Notable existing endpoints:

- `GET /api/cohorts`
- `POST /api/cohorts`
- `POST /api/cohorts/:id/import`
- `POST /api/cohorts/teachers/import`
- `GET /api/cohorts/:id`
- `GET /api/schools/:id/export`
- `GET /api/reports/export/csv`

Route mounting:

- [server/src/index.ts](/Users/abhay/RTB/GoodHours/server/src/index.ts:1)

### Architectural implications for integrations

This repo is ready for these sync shapes:

- sync school roster into GoodHours cohorts and invitations
- sync LMS courses/sections into GoodHours cohorts
- sync teacher-course membership into `CohortTeacherAssignment`
- export completed-hour data out of GoodHours as CSV or vendor-specific records later

This repo is not yet naturally optimized for:

- SIS-driven silent student account provisioning without student invite acceptance
- robust source-of-truth reconciliation with external IDs
- delta sync ledgers, sync jobs, conflict records, or integration credentials storage
- multi-provider OAuth app management

Before implementation, expect new tables for:

- `IntegrationConnection`
- `IntegrationSyncJob`
- `IntegrationExternalMapping`
- `IntegrationSyncError`

## Platform Feasibility

Difficulty scale:

- Low: well-documented public API, standard OAuth, easy dev/test path
- Medium: public API exists but setup/admin coordination is non-trivial
- High: docs or access are gated, partner/vendor involvement likely, or product fit is weak

### SIS

| Platform | API availability | Required credentials/access | What GoodHours can sync | Difficulty | Risks/blockers | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| PowerSchool | Yes, but practical access is often plugin/OAuth and customer-portal driven | District PowerSchool admin, enabled plugin/data provider config, OAuth client ID/secret, base SIS URL | Students, teachers, classes/sections/cohorts, likely emails and grades/identifiers depending on available endpoints | High | Docs/support heavily customer-gated; district-by-district variance; likely vendor coordination | Feasible, but not the first SIS to build unless a launch customer demands it |
| Infinite Campus | Yes, OneRoster API with OAuth 2; explicit digital learning partner ecosystem | District admin setup, client ID/secret, base URL; grading services may require approved vendor keys | Users, classes, enrollments, roster data; maybe limited additional fields depending on district config | Medium-High | Partner-program support matters; vendor support differs for partner vs non-partner integrations | Strong SIS candidate if target schools use it |
| Skyward | Yes, OneRoster API, but API is a separate install/support flow | District setup of separate Skyward API/IIS app, generated key/secret, support portal involvement | Students, courses, enrollments, roster data | High | Setup is operationally heavy; docs/support appear gated; more district IT friction | Feasible but expensive to support |
| Aspen | Yes, OneRoster support exists; Follett also advertises custom REST APIs | District/Follett coordination, client ID/secret or custom API enablement | Rosters, courses, enrollments; exact field availability likely vendor-specific | High | Public docs are weak; likely relationship-manager setup; custom APIs create per-district variance | Avoid as an early build unless customer-driven |
| Alma | Public APIs and OneRoster are marketed; public docs are not easy to discover | District admin access, likely API credentials and/or OneRoster config | Student biographical data, classes/courses, rosters, possibly guardians depending on product plan | Medium-High | Public technical docs are sparse; practical access likely depends on customer account/setup | Better than Skyward/Aspen if a customer confirms access early |

#### PowerSchool

- API availability
  - Official docs show OAuth 2.0 client credentials for plugins/data exchange.
  - PowerSchool support/docs are largely behind customer/partner portals.
- Required credentials/access
  - System admin access to plugin/data provider configuration
  - client ID
  - client secret
  - district PowerSchool base URL
- What GoodHours can realistically sync
  - students
  - teacher/staff accounts
  - school classes/sections that can map to GoodHours cohorts
  - school email addresses
  - likely SIS identifiers for stable external mapping
- Implementation notes
  - GoodHours should treat PowerSchool as an upstream roster source, not as an auth provider in v1.
  - First implementation should create/update cohorts and invitations, not provision silent student accounts.
- Risks/blockers
  - operational access may depend on district admin competency
  - documentation is not truly public/self-serve
  - implementation can diverge across districts

Sources:

- [PowerSchool: View OAuth Client Credentials](https://ps.powerschool-docs.com/pssis-admin/24.3/view-oauth-client-credentials)
- [PowerSource developer portal](https://support.powerschool.com/developer/)
- [PowerSource terms of use](https://support.powerschool.com/tos.action)

#### Infinite Campus

- API availability
  - Official knowledge base exposes OneRoster API documentation and configuration.
  - Infinite Campus explicitly distinguishes partner and non-partner integrations.
- Required credentials/access
  - district admin configuration
  - OneRoster OAuth client ID/secret
  - for some grading endpoints, approved vendor key/secret
- What GoodHours can realistically sync
  - students
  - teachers
  - courses/classes/sections
  - enrollments
  - emails when exposed in user records
- Implementation notes
  - This is the strongest SIS candidate because the vendor clearly supports OneRoster and documents it.
  - GoodHours can map classes/sections to cohorts and teacher assignments.
- Risks/blockers
  - districts may prefer supported partners
  - some support/escalation paths appear better for formal digital learning partners

Sources:

- [Infinite Campus knowledge base](https://kb.infinitecampus.com/help)
- [Digital Learning Applications Configuration](https://kb.infinitecampus.com/help/learning-interoperability)
- [Infinite Campus partners](https://www.infinitecampus.com/about/partners)
- [Infinite Campus OneRoster docs example](https://partnertest.infinitecampus.org/campus/onerosterdocs/?app=microsofttest)

#### Skyward

- API availability
  - Skyward publicly advertises OneRoster and LMS APIs.
  - Microsoft documents Skyward OneRoster provider requirements.
- Required credentials/access
  - Skyward API installation
  - separate IIS web application from the main app
  - generated key/secret
  - support-center guidance
- What GoodHours can realistically sync
  - rosters
  - students
  - classes/sections
  - enrollments
- Implementation notes
  - Purely feasible.
  - Operationally worse than Infinite Campus or Alma because district setup is heavier.
- Risks/blockers
  - support/docs are gated
  - on-prem and district-managed installs increase variance
  - likely higher customer-success burden per school

Sources:

- [Skyward OneRoster & LMS APIs](https://www.skyward.com/apioffer)
- [Microsoft SDS OneRoster provider overview: Skyward](https://learn.microsoft.com/en-us/schooldatasync/oneroster-synergy)
- [Skyward partner portal](https://partners.skyward.com/support/api-definition)

#### Aspen

- API availability
  - Follett markets Aspen OneRoster support and custom RESTful APIs.
  - Public release notes and help artifacts indicate OneRoster endpoints and client credential setup.
- Required credentials/access
  - district/Follett configuration
  - likely client ID/secret
  - sometimes direct coordination with a customer relationship manager
- What GoodHours can realistically sync
  - students
  - classes
  - enrollments
  - possibly more, but field-level portability is unclear
- Implementation notes
  - Technically possible.
  - Productized implementation is risky because vendor surface appears less standardized publicly.
- Risks/blockers
  - weak public documentation
  - possible reliance on custom APIs
  - likely per-customer enablement friction

Sources:

- [Follett Aspen product page](https://follettsoftware.com/student-information-suite/aspen/)
- [Aspen login page with API statement](https://follettsoftware.com/aspen-login/)
- [Microsoft SDS provider overview snippet for Follett Aspen](https://learn.microsoft.com/it-it/schooldatasync/oneroster-provider-overview)

#### Alma

- API availability
  - Alma publicly markets public APIs and OneRoster API/SFTP integrations.
  - Public developer documentation is not easy to discover from the open web.
- Required credentials/access
  - district admin credentials/access
  - likely tenant-specific API keys or OneRoster credentials
  - likely customer-account-specific setup
- What GoodHours can realistically sync
  - students
  - class/course structures
  - roster membership
  - likely student profile and family/contact metadata depending on plan and API exposure
- Implementation notes
  - Potentially good mid-tier target if a pilot customer can validate credential access early.
- Risks/blockers
  - public technical surface is under-documented
  - implementation planning without a real Alma sandbox is speculative

Sources:

- [Alma solutions page](https://www.getalma.com/solutions/)
- [Alma district page](https://www.getalma.com/district)

### LMS

| Platform | API availability | Required credentials/access | What GoodHours can sync | Difficulty | Risks/blockers | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Google Classroom | Excellent public API | Google Cloud OAuth app, school admin approval for domain-wide usage, Classroom scopes | Courses, aliases, teachers, students, course membership, basic profile email access | Low | Google scope verification and admin consent; Classroom is course-oriented, not SIS-complete | Best lightweight LMS launch target |
| Canvas | Excellent public API | Canvas developer key, institution admin enablement, OAuth2 | Courses, sections, enrollments, users, SIS IDs where permissions allow | Low | Multi-tenant key management, school-specific admin setup | Strongest LMS target overall |
| Schoology | Strong public API | Schoology developer account/app, OAuth 1.0 credentials or app config, district approval | Courses, sections, enrollments, users, external IDs, some grade/course metadata | Medium | Older auth model; app approval/install workflow adds friction | Good third LMS target |
| Blackboard | Public developer portal and REST APIs; sandbox/dev network exists | Anthology developer registration, app registration, tenant approval | Courses, users, memberships, likely organizations and gradebook-related entities | Medium-High | Integration and tenant setup are heavier; weaker K-12 fit than Canvas/Classroom | Feasible, but not worth first-wave effort |

#### Google Classroom

- API availability
  - Excellent public REST API.
  - Supports courses, students, teachers, aliases, and push notifications.
- Required credentials/access
  - Google Cloud project
  - OAuth 2.0 client configuration
  - school or district admin consent for domain-wide use in many real deployments
  - potentially Google app verification depending on scopes
- What GoodHours can realistically sync
  - courses as GoodHours cohorts
  - course aliases as stable external IDs
  - teachers and students in each class
  - email addresses and profile metadata available through Classroom scopes
- Implementation notes
  - Strong fit for syncing class rosters into cohorts.
  - Weak fit as the only source of truth for whole-school demographics.
  - GoodHours should not assume Classroom covers all students in a school.
- Risks/blockers
  - requires Workspace for Education admin buy-in
  - scope verification can slow production rollout
  - no dedicated "school SIS" semantics

Sources:

- [Google Classroom scopes](https://developers.google.com/workspace/classroom/guides/auth)
- [Google Classroom courses resource](https://developers.google.com/workspace/classroom/reference/rest/v1/courses)
- [Google Classroom students resource](https://developers.google.com/workspace/classroom/reference/rest/v1/courses.students)
- [Google Classroom course aliases](https://developers.google.com/workspace/classroom/reference/rest/v1/courses.aliases)
- [Google Classroom API structure](https://developers.google.com/workspace/classroom/guides/key-concepts/api-structure)

#### Canvas

- API availability
  - Excellent public REST API and OAuth2 docs.
  - Supports courses, sections, enrollments, users, and developer-key scoping.
- Required credentials/access
  - Canvas developer key
  - institution admin enablement
  - OAuth2 authorization flow
  - for vendor-style multi-school rollout, potentially global developer key from Instructure
- What GoodHours can realistically sync
  - courses/sections into cohorts
  - teachers and students in course/section membership
  - SIS IDs where permission and configuration allow
  - possibly outbound status/grade-style records later, though not needed for v1
- Implementation notes
  - Best LMS target overall.
  - Docs are strong and dev/test environments exist.
  - Sync shape aligns directly with GoodHours cohorts and teacher assignments.
- Risks/blockers
  - each institution controls developer-key enablement
  - permissions vary by account

Sources:

- [Canvas LMS API overview](https://developerdocs.instructure.com/services/canvas)
- [Canvas developer keys](https://developerdocs.instructure.com/services/canvas/oauth2/file.developer_keys)
- [Canvas OAuth2 overview](https://developerdocs.instructure.com/services/canvas/oauth2/file.oauth)
- [Canvas courses](https://developerdocs.instructure.com/services/canvas/resources/courses)
- [Canvas sections](https://developerdocs.instructure.com/services/canvas/resources/sections)
- [Canvas enrollments](https://developerdocs.instructure.com/services/canvas/resources/enrollments)
- [Canvas beta environment](https://community.canvaslms.com/t5/Canvas-Releases/What-is-the-Canvas-beta-environment/ta-p/255260)

#### Schoology

- API availability
  - Strong public API.
  - Supports courses, sections, enrollments, external IDs, and app workflows.
- Required credentials/access
  - Schoology developer account or district app config
  - OAuth 1.0 credentials for API access
  - district install/approval workflow
- What GoodHours can realistically sync
  - courses and sections into cohorts
  - teachers/students through enrollments
  - external IDs for stable mapping back to SIS/LMS identifiers
- Implementation notes
  - Better than Blackboard for K-12 fit.
  - Slightly worse than Canvas because auth is older and the app workflow is more specialized.
- Risks/blockers
  - OAuth 1.0 is legacy compared with modern OAuth2
  - app approval and district installation flows add support cost

Sources:

- [Schoology developer home](https://developers.schoology.com/)
- [Schoology authentication](https://developers.schoology.com/api-documentation/authentication/)
- [Schoology REST API overview](https://developers.schoology.com/api-documentation/rest-api-v1/)
- [Schoology course API](https://developers.schoology.com/api-documentation/rest-api-v1/course/)
- [Schoology enrollment API](https://developers.schoology.com/api-documentation/rest-api-v1/enrollment/)
- [Schoology testing your app](https://developers.schoology.com/app-platform/testing-your-app/)
- [Schoology LTI/app setup](https://developers.schoology.com/app-platform/lti-apps/)

#### Blackboard

- API availability
  - Public developer portal and REST API program exist.
  - Anthology offers developer registration and non-production developer environments.
- Required credentials/access
  - developer account registration
  - REST application registration
  - institution/tenant-side approval
- What GoodHours can realistically sync
  - likely courses
  - users
  - memberships/enrollments
  - potentially organizations and gradebook metadata later
- Implementation notes
  - Technically viable.
  - Lower priority because K-12 demand is likely lower than Canvas/Classroom/Schoology.
- Risks/blockers
  - heavier enterprise workflow
  - more cumbersome testing and tenancy setup
  - public docs are less convenient than Canvas or Google

Sources:

- [Anthology developer portal](https://developer.blackboard.com/)
- [Anthology API explorer](https://developer.blackboard.com/portal/displayApi)
- [Blackboard developer agreement / DVBA terms](https://developer.blackboard.com/portal/applications/termsAndConditions?createdByAdmin=true)

## Realistic GoodHours Sync Scope

Across all providers, the realistic v1 sync targets are:

- school connection metadata
- students
  - name
  - email
  - grade when available
  - external SIS/LMS ID
- cohorts/classes/sections
  - name
  - external course ID
  - optional school year / term metadata
- teacher assignments
  - teacher email
  - teacher display name
  - course/cohort relationship

Potential but not reliable across all providers:

- house/homeroom/custom grouping metadata
- guardians/parent contacts
- demographic flags
- service-hour export back into SIS/LMS gradebooks

For GoodHours specifically, the clean v1 behavior is:

1. upsert local cohorts from external classes/sections
2. upsert teacher assignments
3. create/update `StudentInvitation` records for unmatched students
4. optionally attach already-existing GoodHours student users by matching external ID or normalized email

That preserves the current trust model without inventing silent student account creation.

## Recommended Priority Order

### 1. Canvas

Why first:

- best public API quality
- clean OAuth2
- direct mapping of courses/sections/enrollments to cohorts/teachers/students
- realistic test/beta environments

### 2. Google Classroom

Why second:

- strongest public developer surface after Canvas
- easy mapping to cohorts
- widely used in K-12
- particularly good for class-level sync even if not whole-school SIS

### 3. Schoology

Why third:

- real K-12 penetration
- course/section/enrollment model fits GoodHours
- public docs are usable

### 4. Infinite Campus

Why fourth:

- strongest SIS candidate in this list from a documentation and standards standpoint
- OneRoster support is explicit
- good chance of customer demand

### 5. PowerSchool

Why fifth:

- probably highest market prevalence
- but the operational/documentation friction is worse than Infinite Campus for an early build

### 6. Alma

Why sixth:

- promising API story
- weaker open documentation
- should move up only if a pilot customer can validate admin access

### 7. Skyward

Why seventh:

- feasible but operationally cumbersome
- likely high support burden

### 8. Blackboard

Why eighth:

- technically fine
- worse product leverage for K-12 community-service use cases

### 9. Aspen

Why ninth:

- feasible on paper
- public surface and standardization are weak
- likely highest variance per district

## Recommended Implementation Shape After Approval

Not implementing now. This is the plan shape that fits the repo.

### Phase 1

- add integration domain tables
- support one LMS provider first
- sync external classes into cohorts
- sync students by external ID/email into invitations
- sync teachers into `CohortTeacherAssignment`
- keep student account creation invitation-based

### Phase 2

- add one SIS provider
- add delta sync jobs and job history
- add admin UI for connect, preview, and sync results
- add external-ID mapping and conflict handling

### Phase 3

- add outbound exports
- add optional parent/contact sync
- add scheduled sync and retry tooling

## Key Risks To Resolve Before Writing Code

1. Source of truth
   - decide whether SIS/LMS sync owns cohort membership absolutely, or only seeds invitations and staff mappings
2. External identity
   - decide whether matching is by external ID first, email fallback second
3. Deprovisioning
   - decide what happens when a student disappears from the upstream roster
4. Multi-class students
   - current model assumes a primary `cohortId` on the user, not many concurrent cohort memberships
5. Secrets and credential storage
   - this repo currently has no integration-credential subsystem

## Recommendation

Do not start with a generic "supports every SIS/LMS" abstraction. That is premature.

Start with one LMS and one SIS:

1. Canvas
2. Infinite Campus

Those two give the best balance of:

- likely customer usefulness
- implementation tractability
- documentation quality
- standards alignment

Google Classroom is the best fast-follow LMS if your earliest schools are Google-heavy and do not need full SIS semantics.
