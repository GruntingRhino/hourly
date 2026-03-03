# GoodHours — School-Orchestrated Volunteer Hours (Major Rework Spec)

## 0. Purpose
Rework the existing GoodHours application into a **school-orchestrated** system for managing and verifying high-school volunteer hours required for graduation. This spec replaces the current “multi-role open signup + marketplace browsing” posture with **school-first onboarding**, **invitation-only enrollment**, and **approved beneficiary visibility**.

This is a go-to-market safe version: **minimize friction for schools, minimize student data**, and avoid early monetization complexity.

---

## 1. Core Tenets (Non-Negotiable)
1) **Three-Way Relationship (Tripartite)**
- School ↔ Beneficiary
- School ↔ Student
- Student ↔ Beneficiary
School is always the orchestrator and gatekeeper.

2) **School as Primary User & Custodian**
- Schools are the system entry point and primary admin.
- Student access only exists under school sponsorship (cohorts).
- Treat student data as sensitive (minors). Store the minimum required.

3) **Minimal Friction**
- The product is free to schools for now.
- Reduce signup/role selection complexity.

4) **Minimal Data Collection**
- Students: **Name, Email, House** (optional “House” if a school doesn’t use houses; keep as a configurable field).
- Avoid profile social links, public profile visibility, etc. unless explicitly required later.

5) **Simplified Onboarding**
- **Only schools can start the system** (no public student/org signup).
- Students must still join via cohort invitation (magic link or join code). Email domain only acts as an eligibility check.
- Beneficiaries can register **only via school invitation**.
- Students can enroll **only via cohort invitation**.

6) **Delayed Monetization**
- No subscription tiers, billing, etc. in this spec.

---

## 2. Roles
- **School Admin** (primary orchestrator / custodian)
- **Student** (invited volunteer under a cohort)
- **Beneficiary Admin** (invited entity offering opportunities and approving hours)

Terminology:
- Replace “Organization” with **Beneficiary** across UI, DB labels, routes, and emails.

---

## 3. System Directories (Data Foundation)
### 3.1 Schools Directory
Create/maintain a directory of all US high schools (public/charter/private).
Store at minimum:
- school_id (internal)
- name
- type (public/charter/private)
- address / city / state / zip
- geo metadata (lat/lng or zip centroid)
- official email domain(s) if available (optional)

### 3.2 Beneficiaries Directory
Create/maintain a directory of US beneficiaries (501c3s + relevant public institutions like libraries/schools).
Store at minimum:
- beneficiary_id (internal)
- name
- category
- address / city / state / zip
- geo metadata (lat/lng or zip centroid)
- registered email (if known; else empty until discovered)
- default profile fields (description/website/phone if public)
- status: UNCLAIMED / CLAIMED (registered)

### 3.3 Categories
Maintain beneficiary categories to support browsing for school admins.

Note: If building “all US beneficiaries” is too heavy for v1, implement a directory that can be incrementally expanded and supports custom beneficiaries (Section 5.2).

---

## 4. School Registration (Google OAuth + Magic Link Validation)
### 4.1 Entry
- Landing page only shows: **“Sign in as School”**
- The app is published in Google Workspace Marketplace / Google Classroom Marketplace (where feasible).
- Auth uses **Google OAuth** for the initiating admin identity.

### 4.2 School Claim / Register Flow
1) User searches for their school via type-ahead.
2) If school is already registered:
   - Show message: “This school is already registered. Contact: <registered_email>.”
3) If school not registered:
   - Show “Register” button.
   - Clicking sends an email **to the school’s registered email address** with a **magic link** to complete registration.
   - Registration completes only when the magic link is used.

### 4.3 Post-Registration
School admin lands on School Dashboard, then proceeds to:
- Configure cohorts
- Approve beneficiaries
- Invite beneficiaries
- Manage self-submitted volunteering requests

---

## 5. School Admin Functionality
### 5.1 Beneficiary Management (School-Approved List)
- View beneficiaries near the school (zip/geo-based) organized by category.
- Select beneficiaries to approve for student access.
- Add/drop approved beneficiaries anytime.
- Approved beneficiaries define student visibility of opportunities.

### 5.2 Custom Beneficiary Creation
School admin can create a beneficiary not in the directory:
- Required: name, category, location (zip/address)
- Optional: email
- Visibility flag:
  - **PUBLIC**: candidate for global directory after GoodHours approval workflow (admin review queue).
  - **PRIVATE**: visible only to this school.

### 5.3 Student Self-Submitted Volunteering Requests
Students can submit a custom volunteering request (helping a neighbor/relative).
School admin can:
- view pending requests
- approve / reject with reason
- (if approved) convert into an hours record with verification status policy (see Section 8)

### 5.4 Cohorts (Bulk Student Management)
School admin creates cohorts (ex: “Class of 2029”).
Capabilities:
- Bulk import students from spreadsheet (CSV) + atomic add/update/delete
- Cohort settings:
  - duration/period (default 4 years)
  - required hours/credits for graduation
- “Publish cohort” triggers invitations to students via email magic links.

---

## 6. Beneficiary Registration & Operations
### 6.1 Invitation-Only Registration
- Beneficiary cannot self-register from landing page.
- When a school approves a beneficiary, GoodHours sends an email to the registered beneficiary email:
  - states: “<School Name> selected you for student volunteer hours”
  - provides a registration/claim link
- If beneficiary already claimed:
  - send notification of new school interest
  - beneficiary can Accept / Decline
  - optional: “No current opportunities”

### 6.2 Beneficiary Dashboard
- Invitation tracking: received/accepted/declined
- Opportunity creation:
  - calendar-based UX with date range + time slots
  - type of work + requirements
  - clear expectations/outcomes
- Student signups:
  - show signup counts
  - reveal student details only after first attendance event (or first check-in), per policy
- Approval of hours:
  - approve completed work
  - reject with reason
  - override hours if needed (audit logged)

---

## 7. Student Enrollment & Operations
### 7.1 Invitation-Only Enrollment
- Students cannot self-enroll from public signup.
- Students receive cohort invitation email with magic link.
- After registration, student sees:
  - their cohort
  - required hours
  - approved beneficiaries
  - opportunities from those beneficiaries

### 7.2 Student Actions
- Browse opportunities (only from school-approved beneficiaries)
- Sign up via calendar time slots
- Receive reminders
- Track progress toward requirement
- Submit self-selected volunteering for school review

---

## 8. Verification & Compliance
### 8.1 Verification States
Sessions should support:
- PLANNED / SIGNED_UP
- CHECKED_IN / CHECKED_OUT (if used)
- PENDING_VERIFICATION
- VERIFIED
- REJECTED

### 8.2 Audit Trail
Any approval/rejection/override must be audit logged with actor + timestamp + action + reason (if applicable).

### 8.3 Messaging & Notifications (Minimal)
Keep messaging limited to necessary operational notifications:
- invitations (students/beneficiaries)
- reminders
- verification approved/rejected
Avoid “social messaging” features unless required.

---

## 9. Major Changes vs Current App (De-scope / Replace)
The following current behaviors are removed or replaced:
- Public landing CTAs for student/org signup → **School-only**
- Role picker signup → **School-first; invitations create student/beneficiary accounts**
- “Organization” role and org-school request workflows → replaced by **School-approved beneficiary + beneficiary invitations**
- Student classroom join code flow → replaced by **cohort invitation enrollment**
- Student social profiles/privacy messaging settings → removed (minimal data)
- Open browse of all orgs/opportunities → limited to **school-approved beneficiaries**
- Any monetization/subscription scaffolding → omitted

---

## 10. Implementation Notes (Architecture)
- Introduce entities:
  - Cohort
  - SchoolBeneficiaryApproval (school ↔ beneficiary mapping)
  - BeneficiaryInvitation (school → beneficiary)
  - StudentInvitation (cohort → student)
  - SelfSubmittedRequest (student → school review queue)
- Update naming everywhere: Org → Beneficiary
- Provide migration strategy for existing data (map orgs → beneficiaries; map classrooms → cohorts if possible; otherwise archive).

---

## 11. Acceptance Criteria (Definition of Done)
A) No public signup for student/beneficiary exists in UI.
B) School registration works: search → register → email magic link → dashboard.
C) School admin can:
- create cohort
- import students
- publish cohort invitations
- approve beneficiaries + invite them
- manage custom beneficiaries (public/private)
- approve/reject student self-submissions
D) Beneficiary can:
- register only from invitation
- accept/decline school request
- create opportunities (calendar/time slots)
- view signup counts; reveal student identity only after first attendance event (policy)
- approve/reject hours with audit
E) Student can:
- enroll only via cohort invitation
- browse only approved beneficiaries’ opportunities
- signup and see reminders
- see progress
- submit self-selected volunteering
F) All flows are covered by automated checks + a manual QA checklist generated from this spec.
