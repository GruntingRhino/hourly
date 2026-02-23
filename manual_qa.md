# GoodHours — Manual QA Checklist

**Live URL:** https://goodhours.app
**Strategy:** Minimum account switches. Each session flows top-to-bottom through one role.

### Test Accounts (seed data)
| Role | Email | Password |
|---|---|---|
| Student A | john@student.edu | password123 |
| Student B | jane@student.edu | password123 |
| Org | volunteer@greenearth.org | password123 |
| School Admin | admin@lincoln.edu | password123 |

---

## 1 · Auth

> One-time flows. Use a fresh mailinator address (e.g. `qa-test-01@mailinator.com`).

- [ ] **Signup — Student** · Select "I would like to volunteer" → fill form → "Create Account"
  _Expect: redirected to `/dashboard` showing "Verify your email" screen with the correct address_
- [ ] **Verification email delivered** · Check `mailinator.com/v4/public/inboxes.jsp?to=qa-test-01`
  _Expect: email from `noreply@notifications.goodhours.app`, subject "Verify your GoodHours account"_
- [ ] **Email link works** · Click "Verify Email" button in email
  _Expect: app shows ✅ "Email verified!" then redirects to "Join a Classroom"_
- [ ] **Login with wrong password** · Try logging in with bad credentials
  _Expect: "Invalid email or password" error, no token issued_
- [ ] **Forgot password** · `/login` → "Forgot password?" → enter email → check mailinator
  _Expect: reset email arrives; clicking link lands on `/reset-password` form_
- [ ] **Reset password** · Enter new password matching all rules → submit
  _Expect: success message; can log in with new password_
- [ ] **Duplicate signup** · Try signing up with an already-registered email
  _Expect: 409 "Email already registered"_

---

## 2 · Student Flow

> **Log in as:** john@student.edu

### 2a · Dashboard
- [ ] Hour summary cards show (Committed, Verified, Activities Done)
- [ ] Progress bar reflects verified hours vs school goal
- [ ] "Upcoming Opportunities" lists future events
- [ ] "Recent Activity" shows past sessions with statuses

### 2b · Browse
- [ ] Opportunities load on arrival
- [ ] **Search** · Type a partial title → list filters in real time
- [ ] **Tag filter** · Select a tag → only matching opps shown; clear → all return
- [ ] **Sort: Date** · Events appear in chronological order
- [ ] **Sort: Most Popular** · Higher-signup events appear first
- [ ] **Approved Orgs Only** toggle · List narrows to school-approved orgs
- [ ] **Save** · Click Save on an opp → appears in "Saved" tab
- [ ] **Skip** · Click Skip on another opp → appears in "Skipped" tab
- [ ] **Discard** · Click Discard → appears in "Discarded" tab
- [ ] **Recover** · From Skipped/Discarded tab, recover → moves back to main list

### 2c · Opportunity Detail & Signup
- [ ] Click an opportunity → detail view shows org name, date, time, location, capacity, tags, custom fields
- [ ] **Sign up** · Click "Sign Up" → button changes; confirm appears in student's signups
- [ ] **Capacity full → Waitlist** · If opp is at capacity, button reads "Join Waitlist"; status shows WAITLISTED
- [ ] **Cancel signup** · Cancel a CONFIRMED signup → slot freed, confirmation shown
- [ ] **Waitlist promotion** · If another student cancels and a waitlisted student exists, waitlisted student becomes CONFIRMED (check DB or re-browse)

### 2d · Check-In / Check-Out
- [ ] **Check in** · From dashboard or activity, click "Check In" on a confirmed session
  _Expect: session status → CHECKED_IN; check-in time recorded_
- [ ] **Check out** · Click "Check Out"
  _Expect: status → CHECKED_OUT; `totalHours` auto-calculated from elapsed time_

### 2e · Submit Verification
- [ ] **Drawn signature** · On a CHECKED_OUT session, open "Submit Verification" → draw signature → submit
  _Expect: status → PENDING_VERIFICATION; org & school notified_
- [ ] **File upload** · Submit verification with a PDF/PNG/JPG upload
  _Expect: accepted; unsupported types (e.g. `.exe`) rejected_
- [ ] **Before event date** · Try submitting verification before event date
  _Expect: blocked with appropriate error_

### 2f · Hour History & Reports
- [ ] Settings → Profile → "Export Hours (CSV)" downloads a `.csv` with correct columns (Date, Opportunity, Organization, Hours, Status)
- [ ] Settings → Profile → "Export as PDF" generates a PDF report

### 2g · Messages
- [ ] Navigate to Messages → inbox loads
- [ ] **Compose** · Send message to `volunteer@greenearth.org` — appears in Sent folder
- [ ] **Mark as read** · Unread message → click it → badge clears
- [ ] **Notifications tab** · System notifications listed; clicking one marks it read

### 2h · Settings
- [ ] **Profile** · Edit name, phone, bio (check 300-char limit) → Save → refresh → changes persist
- [ ] **Avatar upload** · Upload a profile image → avatar updates
- [ ] **Social links** · Enter Instagram handle → Save → persists
- [ ] **Notifications** · Toggle off "Hour Approvals" email → save → setting persists on refresh
- [ ] **Privacy** · Set "Who can message me" to "Orgs Only" → save → persists
- [ ] **Change password** · Enter current + valid new password → success
- [ ] **Classroom tab** · Displays current classroom and invite code; "Leave Classroom" button present
- [ ] **Delete account** · Type DELETE in confirmation → account removed → redirected to landing

---

## 3 · Organization Flow

> **Log in as:** volunteer@greenearth.org

### 3a · Dashboard
- [ ] Stats cards show (Total Opportunities, Signups, Approved Hours, Unique Volunteers)
- [ ] "Pending Verifications" section lists sessions awaiting action
- [ ] Recent activity feed shows last notifications

### 3b · Create & Manage Opportunities
- [ ] **Create** · Click "Create Opportunity" → fill all fields including address → Save
  _Expect: opp appears in Opportunities list with ACTIVE status_
- [ ] **Auto-geocode** · Created opp with address → lat/lng populated (visible to students as distance sort)
- [ ] **Edit** · Edit title/description/capacity → Save → changes reflected immediately
- [ ] **Cancel** · Cancel the opp → status → CANCELLED; signed-up students receive notification
- [ ] **Recurring pattern field** · Enable "Recurring" toggle → recurring pattern field appears; saved correctly

### 3c · Verify Hours
- [ ] **Approve** · From Dashboard pending list or verification queue, click Approve on a PENDING_VERIFICATION session
  _Expect: status → VERIFIED; student receives email notification_
- [ ] **Approve with override** · Approve with a custom hours value (different from totalHours)
  _Expect: `verifiedHours` reflects overridden value_
- [ ] **Reject** · Click Reject → enter reason (required) → submit
  _Expect: status → REJECTED; reason stored; student notified_
- [ ] **Self-verification blocked** · Org admin who is also verifier cannot verify their own session
  _Expect: error "Cannot verify your own session"_

### 3d · Announcements
- [ ] Click "Make Announcement" → select opp → type message → send
  _Expect: all confirmed signups for that opp receive a notification/message_

### 3e · Messages & Notifications
- [ ] Compose message to john@student.edu → appears in Sent
- [ ] Student's message from 2g appears in Inbox → mark read

### 3f · Settings
- [ ] **Profile** · Edit description (500-char limit), website, phone → Save → persists
- [ ] **ZIP codes** · Add a ZIP code → appears in list; remove it → gone
- [ ] **Schools tab** · Search for "Lincoln" → request approval
  _Expect: "Pending" status shown; school admin sees request_
- [ ] **Analytics** · Volunteer count and total hours display correctly
- [ ] **Export CSV** · Downloads volunteer data file
- [ ] **Change password** · Works correctly
- [ ] **Notifications** · Toggle off "New Signup" → save → persists

---

## 4 · School Admin Flow

> **Log in as:** admin@lincoln.edu

### 4a · Onboarding (first-time)
- [ ] On first login (clear `school_onboarding_*` from localStorage), graduation hours goal screen appears
- [ ] Enter hours (e.g. 40) → Save → lands on Dashboard

### 4b · Dashboard
- [ ] School stats: Total Students, Total Hours, Goal Completion %, At Risk count
- [ ] Classroom grid shows each classroom with: student count, completion count, at-risk count, invite code
- [ ] **Copy invite code** · Click copy button → clipboard contains the code
- [ ] **Org requests** · Org request from 3f appears in "Pending Requests" → Approve it
  _Expect: org status → APPROVED; org receives notification_
- [ ] **Reject org** · Reject a different pending org → status → REJECTED
- [ ] **Block org** · Block an approved org → confirmation modal → blocked; org disappears from approved list

### 4c · Groups (Student Management)
- [ ] Left sidebar shows "All Students" + individual classrooms
- [ ] **Search** · Type student name → list filters
- [ ] **Filter: Completed** · Shows only students at/above goal
- [ ] **Filter: At Risk** · Shows students with < 50% of goal
- [ ] **Filter: Not Started** · Shows 0-hour students
- [ ] **Select student** · Click a student → right panel shows name, email, hours progress bar, status badge
- [ ] **Send Reminder** · Opens compose window pre-filled with student as recipient
- [ ] **View Hour History** · Shows up to 5 sessions; each has date, opp, hours, status
- [ ] **Remove Hours** · On a VERIFIED session, click Remove → optionally enter reason → confirm
  _Expect: session status → REJECTED; student receives email notification; school hours total decreases_

### 4d · Add Staff
- [ ] Click "Add Staff Member" → fill name, email, optional classroom → Submit
  _Expect: success message with temporary password displayed; new teacher can log in_

### 4e · Settings
- [ ] **Profile** · Edit school name, domain, required hours, ZIP codes → Save → persists
- [ ] **Classrooms** · "Create Classroom" → enter name → created; appears in list with invite code
- [ ] **Data Export** · Export activity log CSV → downloads file with Student, Opportunity, Date, Hours, Status columns
- [ ] **Change password** · Works correctly
- [ ] **Notifications** · Toggle off an option → save → persists

---

## 5 · Cross-Role & Edge Cases

> These require switching accounts. Do them last.

- [ ] **Message preference enforcement** · Set student privacy to "Admins Only" → log in as org → attempt to message that student
  _Expect: blocked with "Message preferences do not allow this"_
- [ ] **Audit trail** · School admin views audit log for a session that was approved then had hours removed
  _Expect: two entries — APPROVE (by org/school) then OVERRIDE (by school)_
- [ ] **Rate limit** · Attempt 6+ signups from same IP within 1 hour
  _Expect: 429 "Too many signup attempts"_
- [ ] **Expired verification token** · Use a verify-email link older than 24h
  _Expect: "Invalid or expired verification token" error_
- [ ] **Resend verification** · On email verification screen, click "Resend" → new email arrives
  _Expect: new email in inbox; old token no longer works_

---

## 6 · Quick Smoke (post-deploy)

> Run after every deploy. Should take < 5 min.

- [ ] `GET /api/health` returns `{"status":"ok"}`
- [ ] Login as john@student.edu → Dashboard loads with no errors
- [ ] Browse page loads opportunities
- [ ] Login as volunteer@greenearth.org → Opportunities list loads
- [ ] Login as admin@lincoln.edu → Dashboard stats load
- [ ] No console errors on any of the above pages
