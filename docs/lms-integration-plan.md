# LMS Integration Plan

Date: 2026-05-09

Status: planning only. No implementation in this change.

## Scope Decision

For early school pilots, GoodHours should not build deep SIS integrations yet.

MVP direction:

1. keep CSV onboarding as the default path
2. add lightweight LMS integrations first
3. implement Canvas before Google Classroom
4. keep every other SIS/LMS as roadmap only

## Current GoodHours Onboarding Model

### What exists today

GoodHours is already built around school-controlled onboarding with five relevant primitives:

1. cohorts
2. student invitations
3. teacher assignments
4. exports
5. audit logging

This matters because the LMS integrations should plug into those primitives instead of bypassing them.

### CSV import

Student onboarding is currently invitation-driven.

- `POST /api/cohorts/:id/import`
- accepts `name,email,grade` or `name,email,grade,house`
- validates records
- creates `StudentInvitation` rows
- sends invitation emails
- marks the cohort as published

Relevant code:

- [server/src/routes/cohorts.ts](/Users/abhay/RTB/GoodHours/server/src/routes/cohorts.ts:839)

### Cohorts

The current primary grouping model is `Cohort`, not `Classroom`.

- cohorts belong to a school
- students point at a single `cohortId`
- teachers are assigned through `CohortTeacherAssignment`
- classrooms remain as legacy compatibility

Relevant code:

- [server/prisma/schema.prisma](/Users/abhay/RTB/GoodHours/server/prisma/schema.prisma:167)
- [server/src/lib/cohortAccess.ts](/Users/abhay/RTB/GoodHours/server/src/lib/cohortAccess.ts:1)

### Student invitations

Student invitations are the current trust boundary for roster onboarding.

- `GET /api/invitations/student`
- `POST /api/invitations/student/accept`
- accepting an invitation creates or links the student account
- accepted students inherit `cohortId`, `schoolId`, `grade`, and `house`

Relevant code:

- [server/src/routes/invitations.ts](/Users/abhay/RTB/GoodHours/server/src/routes/invitations.ts:19)

### Teacher assignments

Teacher assignment already exists and is LMS-compatible.

- school-wide CSV teacher import: `POST /api/cohorts/teachers/import`
- cohort-level teacher import: `POST /api/cohorts/:id/teachers/import`
- manual assignment: `POST /api/cohorts/:id/teachers`

These routes can already:

- create teacher users
- assign existing teachers
- attach teachers to cohorts

Relevant code:

- [server/src/routes/cohorts.ts](/Users/abhay/RTB/GoodHours/server/src/routes/cohorts.ts:541)
- [server/src/routes/cohorts.ts](/Users/abhay/RTB/GoodHours/server/src/routes/cohorts.ts:1164)

### Exports

Exports already exist at the school and student level.

- school roster/hour export: `GET /api/schools/:id/export`
- student CSV export: `GET /api/reports/export/csv`
- cohort export: `GET /api/cohorts/export`

This is enough for MVP pilots because outbound CSV remains the fallback when inbound LMS sync exists but outbound LMS pushback does not.

Relevant code:

- [server/src/routes/schools.ts](/Users/abhay/RTB/GoodHours/server/src/routes/schools.ts:1896)
- [server/src/routes/reports.ts](/Users/abhay/RTB/GoodHours/server/src/routes/reports.ts:303)
- [server/src/routes/cohorts.ts](/Users/abhay/RTB/GoodHours/server/src/routes/cohorts.ts:393)

### Audit logs

GoodHours already records both operational and FERPA-style access events.

- invitation dispatch is recorded in `AuditLog` using `COHORT_INVITE_DISPATCHED`
- school/student export access is recorded with `logDataAccess(...)`
- data access logging is intentionally non-blocking

Relevant code:

- [server/src/routes/cohorts.ts](/Users/abhay/RTB/GoodHours/server/src/routes/cohorts.ts:28)
- [server/src/lib/dataAccessLog.ts](/Users/abhay/RTB/GoodHours/server/src/lib/dataAccessLog.ts:1)
- [server/src/routes/schools.ts](/Users/abhay/RTB/GoodHours/server/src/routes/schools.ts:1981)

## Architectural Decision

Do not introduce a second student provisioning model for MVP.

For LMS sync, the clean behavior is:

1. sync LMS classes into GoodHours cohorts
2. sync LMS teachers into cohort teacher assignments
3. sync LMS students into `StudentInvitation` rows when the student is not already linked
4. optionally link existing GoodHours students by normalized email
5. keep CSV import available as the default and fallback path

This preserves the current product model and avoids a risky rewrite of account creation.

## Canvas Feasibility

### Current API state

Canvas is the best first LMS target.

Why:

- strong public REST API
- standard OAuth2
- clear course, section, and enrollment resources
- institution-managed developer key model
- direct mapping to cohorts and teacher assignments

Official docs confirm:

- OAuth2 access flow
- developer keys with scope restrictions
- courses API
- enrollments API

Sources:

- [Canvas LMS API overview](https://developerdocs.instructure.com/services/canvas)
- [Canvas developer keys](https://developerdocs.instructure.com/services/canvas/oauth2/file.developer_keys)
- [Canvas OAuth2 overview](https://developerdocs.instructure.com/services/canvas/oauth2/file.oauth)
- [Canvas OAuth2 endpoints](https://developerdocs.instructure.com/services/canvas/oauth2/file.oauth_endpoints)
- [Canvas courses API](https://developerdocs.instructure.com/services/canvas/resources/courses)
- [Canvas enrollments API](https://developerdocs.instructure.com/services/canvas/resources/enrollments)

### Required credentials

Per school connection:

- Canvas base URL, e.g. `https://district.instructure.com`
- client ID
- client secret
- approved redirect URI
- an admin or other authorized user to complete OAuth

Operationally, the school must:

- create or enable a developer key
- allow the GoodHours integration to request the needed scopes
- connect the institution-specific Canvas tenant

### OAuth setup

Canvas uses OAuth2 with developer keys.

MVP design:

1. GoodHours school admin starts a "Connect Canvas" flow
2. redirect to Canvas OAuth authorize endpoint on that school's Canvas domain
3. receive access token and refresh token
4. store only dev/test credentials in development during implementation
5. never hardcode production tenant credentials

Recommended MVP scopes:

- read course list
- read section list
- read enrollments
- read user profile fields returned through those APIs

Do not request write scopes in MVP.

### GoodHours data mapping

Canvas object to GoodHours mapping:

- Canvas course or section
  - maps to `Cohort`
- Canvas teacher enrollments
  - map to `CohortTeacherAssignment`
- Canvas student enrollments
  - map to `StudentInvitation` unless already linked

Recommended mapping rules:

- `Cohort.name`
  - use section name when available
  - otherwise use course name
- `Cohort.startYear` / `endYear`
  - leave null in MVP unless district naming convention is explicitly parsed
- `StudentInvitation.email`
  - from Canvas user data if present
- `StudentInvitation.name`
  - from Canvas display/sortable name
- `StudentInvitation.grade`
  - only if available through district SIS-linked Canvas fields or custom permissions; otherwise null
- teacher user
  - match by normalized email first

### Risks

- every institution has its own Canvas domain and admin controls
- some fields, especially SIS IDs and grade-level metadata, may not be exposed with the same permissions everywhere
- students may be enrolled in multiple Canvas sections while GoodHours currently supports one primary `cohortId`
- token management and refresh handling need new credential storage

### MVP recommendation

Canvas MVP should be read-only sync into existing onboarding primitives:

1. import courses/sections
2. import teacher assignments
3. create student invitations
4. show preview and sync results

Do not:

- create student accounts automatically
- push grades or hours back to Canvas
- replace CSV onboarding

## Google Classroom Feasibility

### Current API state

Google Classroom is the second-best LMS target.

Why:

- strong public API
- standard Google OAuth2 flow
- explicit resources for courses, students, teachers, and aliases
- good fit for class-based pilot schools

Official docs confirm:

- OAuth setup and scopes
- courses resource
- students resource
- aliases
- course roster model

Sources:

- [Google Classroom scopes](https://developers.google.com/workspace/classroom/guides/auth)
- [Google Classroom API structure](https://developers.google.com/workspace/classroom/guides/key-concepts/api-structure)
- [Manage courses](https://developers.google.com/workspace/classroom/guides/manage-courses)
- [Courses resource](https://developers.google.com/workspace/classroom/reference/rest/v1/courses)
- [Students resource](https://developers.google.com/workspace/classroom/reference/rest/v1/courses.students)
- [Classroom REST reference](https://developers.google.com/workspace/classroom/reference/rest)

### Required credentials

Per GoodHours environment:

- Google Cloud project
- OAuth client ID
- OAuth client secret
- configured redirect URI
- Classroom API enabled

Per school or district:

- Google Workspace for Education tenant
- school admin approval for the requested scopes in real deployments
- potentially app verification if non-trivial scopes are requested publicly

### OAuth setup

Google Classroom uses OAuth 2.0 through Google Cloud.

MVP design:

1. school admin starts a "Connect Google Classroom" flow
2. redirect to Google OAuth consent
3. request the narrowest read-oriented Classroom scopes possible
4. store refresh token for ongoing sync
5. avoid domain-wide admin complexity in the first dev implementation unless required

Recommended MVP scopes:

- `classroom.courses.readonly`
- `classroom.rosters.readonly`
- `classroom.profile.emails`

If teacher/course creation is deferred, do not request write scopes.

### GoodHours data mapping

Google Classroom object to GoodHours mapping:

- Classroom `Course`
  - maps to `Cohort`
- Classroom teachers
  - map to `CohortTeacherAssignment`
- Classroom students
  - map to `StudentInvitation`
- Classroom alias
  - should become the preferred external identifier when present

Recommended mapping rules:

- `Cohort.name`
  - use Classroom course name
- `Cohort` external key
  - use Classroom course ID
  - store alias too when available
- `StudentInvitation.email`
  - from Classroom profile email
- `StudentInvitation.name`
  - from profile name
- `StudentInvitation.grade`
  - not reliably available from Classroom, so null in MVP

### Risks

- Classroom is course-centric, not a complete school SIS
- it may not cover all students or all classes
- grade-level and other student metadata are weak compared with SIS systems
- admin consent and app verification can slow production rollout
- consumer Gmail behavior differs from Workspace for Education behavior

### MVP recommendation

Google Classroom MVP should be treated as class roster import only.

Use it to:

1. create or update cohorts from Classroom courses
2. assign teachers
3. create invitations for rostered students

Do not use it in MVP to:

- infer whole-school enrollment
- replace school-level CSV bulk import
- become the source of truth for student demographics

## Required New Integration Concepts

Not implementing yet, but the plan requires four new concepts.

### 1. Connection records

Needed to store:

- provider type: `CANVAS` or `GOOGLE_CLASSROOM`
- school ID
- tenant/base URL where applicable
- encrypted access token
- encrypted refresh token
- token expiry
- sync status

### 2. External mapping records

Needed to map:

- external course ID to local cohort ID
- external teacher user ID to local user ID
- external student user ID to local invitation or user ID

### 3. Sync jobs

Needed to track:

- who started the sync
- when it ran
- what it created/updated/skipped
- API errors
- matching conflicts

### 4. Preview mode

Needed for pilot safety.

Admin should be able to see:

- cohorts to create
- teachers to assign
- students to invite
- conflicts

before applying the sync.

## Recommended Data Matching Rules

### Cohorts

Primary key strategy:

1. external provider course/section ID
2. fallback by normalized name only during first import preview

Do not rely on cohort name alone for long-term reconciliation.

### Teachers

Primary match:

1. external user ID if already mapped
2. normalized email

If no match:

- create a teacher user using the existing cohort teacher provisioning flow

### Students

Primary match:

1. external user ID if already mapped
2. normalized email

If no match:

- create or update `StudentInvitation`

Do not silently create a `User` in MVP.

## Implementation Phases

### Phase 0: internal plumbing

- add integration tables
- add encrypted credential storage
- add sync job records
- add external mapping records
- add preview/apply service layer

No provider-specific UI beyond simple connect + preview.

### Phase 1: Canvas

- add Canvas OAuth connect flow
- fetch courses/sections
- fetch enrollments
- map teachers into cohort assignments
- map students into invitations
- write sync result/audit entries

This is the first implementation phase after approval.

### Phase 2: Google Classroom

- add Google OAuth connect flow
- fetch courses
- fetch teachers/students
- map into the same service layer used by Canvas
- support aliases as external IDs

This is second after Canvas is stable.

### Phase 3: polish

- add scheduled sync in development only
- add conflict UI
- add export helper docs for pilot schools
- add retry/reconnect handling

## Risks That Must Stay Explicit

1. Single-cohort constraint
   - GoodHours currently assigns a student to one `cohortId`
   - LMS data often has many concurrent sections per student
2. Metadata gaps
   - Canvas and especially Classroom are not reliable sources for grade/house data
3. Consent/admin friction
   - both providers require real school admin setup
4. Token security
   - credentials must be encrypted and never committed
5. Pilot safety
   - sync must start with preview mode and clear auditability

## Recommended MVP Product Behavior

For pilot schools, the user-facing message should be simple:

- CSV remains the default onboarding path
- Canvas can import rosters into cohorts and invitations
- Google Classroom can import rosters into cohorts and invitations
- GoodHours remains the system that owns service-hour tracking, verification, exports, and final student activation

## Recommendation

After approval, implement in this order:

1. Canvas
2. Google Classroom

Do not attempt:

- SIS parity
- outbound LMS writeback
- automatic student account creation
- multi-provider abstraction beyond what Canvas and Classroom actually share

The highest-leverage MVP is a shared LMS sync pipeline that feeds existing GoodHours onboarding primitives rather than replacing them.
