# Hourly — Core Product Specification (Refined, Single-File)

## High-Level Summary (What Hourly Is)

Hourly is a **community service coordination, tracking, and verification platform** designed to be the **system of record for student volunteer hours**. It enables students to find legitimate community service opportunities, organizations to manage and verify volunteers, and schools to audit and accept service hours with confidence.

Hourly’s core value is **trust**. Every service hour recorded in Hourly is explicitly tied to:
- a real student,
- a real organization,
- a real opportunity,
- a real time and place,
- and a named verifier.

By standardizing how service opportunities are posted, how attendance is captured, and how hours are verified and reported, Hourly removes ambiguity, reduces fraud, and eliminates administrative overhead. The result is higher participation, higher confidence, and institutional adoption by schools.

Hourly is not a directory, a spreadsheet, or a generic time tracker. It is **infrastructure** for student community service, built to produce records that schools can accept without manual re-verification.

---

## Conceptual Model (What Matters Most)

Hourly is organized around four core pillars, listed in order of priority:

1. **Legitimacy** — Only approved organizations and verifiable opportunities exist in the system.
2. **Verification** — Hours are earned through controlled attendance and explicit approval.
3. **Compliance** — Records are structured to meet school and district requirements.
4. **Adoption** — All flows are simple enough for students, strict enough for schools.

Everything else in the product exists to support these four pillars.

---

## Screens & Visual Context (How to Read the Screenshots)

- Screens labeled `0`, `1`, `2`, `3` represent **authentication and onboarding flows**.
- Screens labeled `#a` correspond to **student-facing functionality**.
- Screens labeled `#b` correspond to **organization-facing functionality**.
- Screens labeled `#c` correspond to **school / administrator-facing functionality**.
- Layout, styling, and visual hierarchy are not authoritative; **functional presence is authoritative**.
- If a function exists in this specification, the UI must support it regardless of layout.

---

## Core Actors

### Students
Discover opportunities, commit to service, check in and out, track verified hours, and generate official reports.

### Service Organizations
Post opportunities, manage capacity, verify attendance, and maintain accurate volunteer records.

### Schools / Administrators
Approve organizations, define service rules, audit hours, and accept records as official.

---

## Functional Requirements (Complete System Scope)

### 1. User & Identity Management
- Student account creation
- Organization account creation
- School / administrator account creation
- Role-based permissions
- Student-to-school affiliation
- Organization approval by schools
- Parent/guardian consent management (when required)
- Account status enforcement (active, suspended, revoked)

---

### 2. Opportunity Creation & Management (Organizations)
- Create community service opportunities
- Define physical location (address + map pin)
- Set date, start time, end time, and expected duration
- Set capacity limits
- Define eligibility requirements (age, grade, skills)
- Specify verification method
- Edit or cancel opportunities
- View registered students
- Communicate updates to registered students

---

### 3. Opportunity Discovery (Students)
- Browse nearby opportunities
- Search by keyword
- Filter by date, duration, cause, and organization
- View opportunity details
- View organization profiles
- Save or bookmark opportunities

---

### 4. Signup & Commitment
- Sign up for an opportunity
- Enforce capacity limits
- Waitlist handling
- Signup confirmation notifications
- Calendar integration
- Cancellation by student or organization
- No-show tracking

---

### 5. Attendance & Check-In
- Check-in at opportunity start
- Check-out at opportunity end
- QR code scanning
- GPS-based location validation
- Time-window enforcement
- Offline check-in with delayed sync
- Attendance status tracking

---

### 6. Service Session Creation
- Automatically create a service session from attendance
- Calculate total service hours
- Attach session to opportunity and organization
- Prevent student-side edits to raw time data

---

### 7. Verification & Approval
- Organization review of attendance
- Approve service hours
- Reject service hours with reason
- Partial hour approval (if applicable)
- Optional school-level review or override
- Immutable audit trail of all actions

---

### 8. Student Service Records
- View completed, pending, and rejected hours
- View verification status per session
- View cumulative approved hours
- Filter records by date, organization, or status
- Download official service history

---

### 9. Organization Volunteer Management
- View volunteer history
- View attendance and no-show rates
- Export volunteer logs
- Manage organization staff and verifiers
- View impact summaries

---

### 10. School Administration & Compliance
- Approve or deny organizations
- Define service hour requirements
- Set verification standards
- View individual and aggregate student records
- Audit individual or bulk hours
- Flag suspicious activity
- Generate compliance-ready reports

---

### 11. Reporting & Exports
- Student-facing hour summaries
- Organization volunteer reports
- School compliance reports
- CSV and PDF exports
- Custom date ranges
- Clear verification status indicators

---

### 12. Notifications & Communication
- Signup confirmations
- Event reminders
- Check-in reminders
- Verification status updates
- Opportunity changes or cancellations
- Administrative alerts for flagged activity

---

### 13. Trust, Safety & Integrity
- Strict role-based data access control
- Fraud prevention checks
- Location and time anomaly detection
- Edit history and audit logs
- Dispute and appeal workflow

---

### 14. Platform & System Capabilities
- Multi-school support
- Multi-organization support
- FERPA-aware data privacy controls
- Account suspension and enforcement
- System logging and monitoring
- API access for integrations (optional)

---

### 15. User Experience & Quality Standards
- Mobile-first interface
- Low-friction, fast flows
- Accessibility support
- Clear state and status indicators
- Robust error handling and recovery

---

## Definition of Success

Hourly is successful when:
- Schools accept Hourly records as authoritative.
- Organizations rely on Hourly to manage volunteers.
- Students default to Hourly for all service hours.
- Service hours outside Hourly are treated as exceptions.

At that point, Hourly is no longer an app — it is **infrastructure**.
