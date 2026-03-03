# GoodHours QA Specification Checklist

Derived from `spec.md` Section 11 (Acceptance Criteria) and the full specification.

---

## A. No Public Signup

- [ ] **A1** Visiting `/signup` shows informational-only page (no form) — no public student or beneficiary signup
- [ ] **A2** No "Create Account" button is accessible for students or beneficiaries from any public route
- [ ] **A3** `POST /api/auth/signup` only accepts `SCHOOL_ADMIN` role — other roles return 400
- [ ] **A4** `/join/student` and `/join/beneficiary` require a valid invitation token, not self-signup

---

## B. School Registration Flow

- [ ] **B1** Landing page shows only "Sign In as School" / school-focused CTA
- [ ] **B2** `/school/register` loads the school registration flow (no auth required)
- [ ] **B3** Step 1: Google OAuth sign-in button initiates OAuth → `GET /api/auth/google/url` returns valid URL
- [ ] **B4** OAuth callback exchanges `code` for user info; existing school admins get JWT directly
- [ ] **B5** New admin sees school search step (type-ahead directory search)
- [ ] **B6** `GET /api/auth/google/schools?search=` returns results from SchoolDirectory
- [ ] **B7** Admin picks a school → enters contact email → clicks "Send Registration Email"
- [ ] **B8** `POST /api/auth/google/register-school` creates school, sends magic link to contact email
- [ ] **B9** Visiting `/school/verify-registration?token=` verifies token, creates School record, returns JWT
- [ ] **B10** After verification, admin is logged in and sees school dashboard

---

## C. School Admin Functionality

### Cohorts
- [ ] **C1** `GET /api/cohorts` returns cohorts for authenticated school admin's school
- [ ] **C2** `POST /api/cohorts` creates a cohort with name, requiredHours, startYear
- [ ] **C3** `/cohorts` page shows cohort list with stats (students, pending invites, completed, at-risk)
- [ ] **C4** `/cohorts/:id` shows cohort detail with Students, Invitations, and Import tabs
- [ ] **C5** Students tab: manual add-student form (`POST /api/cohorts/:id/add-student`) creates invitation
- [ ] **C6** Import tab: CSV upload with columns name, email, grade, house → `POST /api/cohorts/:id/import` creates StudentInvitation records
- [ ] **C7** Import returns `{ added, skipped, errors }` summary
- [ ] **C8** "Publish & Send Invites" button → `POST /api/cohorts/:id/publish` sends invitation emails to all PENDING students
- [ ] **C9** Published invitations show PENDING status in Invitations tab; update to ACCEPTED after student joins

### Beneficiary Management
- [ ] **C10** `/beneficiaries` loads Partners page for school admin
- [ ] **C11** Approved tab shows school's approved community partners
- [ ] **C12** "Add from Directory" tab: search by name/city returns BeneficiaryDirectory results
- [ ] **C13** `POST /api/beneficiaries/approve-from-directory` approves a directory entry and sends invitation email
- [ ] **C14** Send Invite button (`POST /api/beneficiaries/:id/invite`) sends invitation email to custom email
- [ ] **C15** Remove button (`POST /api/beneficiaries/:id/drop`) removes beneficiary from approved list
- [ ] **C16** "Create Custom" tab: form with name, category, city, state, email, description, visibility (PUBLIC/PRIVATE)
- [ ] **C17** `POST /api/beneficiaries` creates custom beneficiary — auto-approved for creating school
- [ ] **C18** PUBLIC visibility creates beneficiary with visibility=PUBLIC (flagged for global directory review)
- [ ] **C19** PRIVATE visibility creates beneficiary visible only to this school

### Self-Submissions
- [ ] **C20** `/submissions` shows school's student self-submitted hour requests
- [ ] **C21** PENDING tab shows requests awaiting review
- [ ] **C22** Review panel: admin can set hours to approve and optional note
- [ ] **C23** `POST /api/self-submissions/:id/approve` approves with hours, sends email to student
- [ ] **C24** `POST /api/self-submissions/:id/reject` rejects with reason, sends email to student
- [ ] **C25** APPROVED and REJECTED tabs show historical decisions

---

## D. Beneficiary Functionality

- [ ] **D1** Beneficiary cannot register from landing page or `/signup` — no public registration
- [ ] **D2** `GET /api/invitations/beneficiary?token=` returns `{ beneficiaryName, schoolName, sentTo }` for valid token
- [ ] **D3** `/join/beneficiary?token=` page shows invitation details — Accept or Decline options
- [ ] **D4** Accept form: enter admin name + password → `POST /api/invitations/beneficiary/accept` creates BENEFICIARY_ADMIN account
- [ ] **D5** After accepting, user is logged in as BENEFICIARY_ADMIN and redirected to dashboard
- [ ] **D6** Decline → `POST /api/invitations/beneficiary/decline` marks invitation as declined
- [ ] **D7** Beneficiary dashboard shows pending hour approvals count, link to manage opportunities
- [ ] **D8** `/opportunities` page lists beneficiary's opportunities with slots
- [ ] **D9** "New Opportunity" form: title, description, location, time slots (date, start, end, capacity)
- [ ] **D10** `POST /api/beneficiaries/:id/opportunities` creates opportunity with nested time slots
- [ ] **D11** `POST /api/beneficiaries/slots/:slotId/signup` allows student to sign up for a slot
- [ ] **D12** `POST /api/beneficiaries/signups/:id/approve` approves hours with audit log entry
- [ ] **D13** `POST /api/beneficiaries/signups/:id/reject` rejects hours with reason and audit log

---

## E. Student Functionality

- [ ] **E1** Student cannot self-enroll — no public signup form for students
- [ ] **E2** `GET /api/invitations/student?token=` returns invitation info (cohortName, schoolName, email) for valid token
- [ ] **E3** `/join/student?token=` page shows school + cohort name, enrollment form
- [ ] **E4** Enrollment form: name (pre-filled if provided), grade (optional), house (optional), password
- [ ] **E5** `POST /api/invitations/student/accept` creates STUDENT account linked to cohort
- [ ] **E6** After accepting, student is logged in and redirected to `/dashboard`
- [ ] **E7** Student dashboard shows approved hours, pending hours, cohort info
- [ ] **E8** Student dashboard shows progress bar toward cohort required hours
- [ ] **E9** `/browse` shows only opportunities from school-approved beneficiaries (not global)
- [ ] **E10** Student can sign up for time slots of approved beneficiary opportunities
- [ ] **E11** `/submit` page allows student to submit self-selected volunteering
- [ ] **E12** Submit form: organization name, date of service, description, hours requested
- [ ] **E13** `POST /api/self-submissions` creates request linked to student's school via cohort
- [ ] **E14** Student can view status of all their submissions (PENDING / APPROVED / REJECTED)
- [ ] **E15** Student sees review note when submission is rejected

---

## F. Security & Data Integrity

- [ ] **F1** Magic link tokens expire (student invitations, beneficiary invitations, school registration tokens)
- [ ] **F2** Invitation tokens are cryptographically random (not guessable)
- [ ] **F3** `requireRole()` middleware enforces RBAC on all sensitive endpoints
- [ ] **F4** Students can only see their school's approved beneficiaries
- [ ] **F5** School admin can only manage cohorts/beneficiaries for their own school
- [ ] **F6** Beneficiary admin can only manage their own beneficiary's opportunities
- [ ] **F7** All hour approval/rejection actions are audit logged with actor + timestamp + reason
- [ ] **F8** Google OAuth users cannot use password-based login (no passwordHash set)
- [ ] **F9** JWT tokens use 7-day expiry; registration tokens use 1-hour expiry

---

## G. Naming & Terminology

- [ ] **G1** "Organization" / "Org" terminology does not appear in any new UI pages
- [ ] **G2** All new API routes use `/beneficiaries` (not `/organizations`)
- [ ] **G3** Email templates use "partner" / "beneficiary" language, not "organization"

---

## H. Build & Deploy Checks

- [ ] **H1** `cd client && npx tsc --noEmit` passes with 0 errors
- [ ] **H2** `cd server && npx tsc --noEmit` passes with 0 errors
- [ ] **H3** `cd client && npm run build` produces dist/ with no build errors
- [ ] **H4** Required env vars documented in `.env.example`
- [ ] **H5** Runtime env validator (`server/src/lib/env.ts`) catches missing DATABASE_URL / JWT_SECRET at startup

---

## Current Status (as of architecture rework)

### Implemented ✅
- A1-A4: No public signup
- B2-B10: School registration flow (frontend + backend)
- C1-C9: Cohort management (full CRUD + CSV import + publish)
- C10-C19: Beneficiary management (directory search, custom creation, approve/drop)
- C20-C25: Self-submission review queue
- D1-D13: Beneficiary invitation flow + dashboard + opportunities + hour approval
- E1-E15: Student invitation flow + dashboard + self-submit
- F1-F9: Security controls
- G1-G3: Naming
- H1-H5: Build checks

### Actions Required From School Admin (You) 🔧
- **B1**: Verify Google OAuth app is configured with correct redirect URIs in Google Cloud Console
- **B3/B7**: Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in production `.env`
- **SchoolDirectory data**: Import `private_schools.csv` and `public_schools.csv` into `SchoolDirectory` table
- **BeneficiaryDirectory data**: Import `eo_ma.csv` into `BeneficiaryDirectory` table
- **Resend domain**: Ensure `notifications.goodhours.app` sending domain is verified in Resend dashboard
