# GoodHours QA Results

Generated: 2026-02-24T01:50:05.795Z

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

- [ ] **Signup — Student** · Select "I would like to volunteer" → fill form → "Create Account" — PASS
  _Expect: redirected to `/dashboard` showing "Verify your email" screen with the correct address_
- [ ] **Verification email delivered** · Check `mailinator.com/v4/public/inboxes.jsp?to=qa-test-01` — PASS
  _Expect: email from `noreply@notifications.goodhours.app`, subject "Verify your GoodHours account"_
- [ ] **Email link works** · Click "Verify Email" button in email — PASS
  _Expect: app shows ✅ "Email verified!" then redirects to "Join a Classroom"_
- [ ] **Login with wrong password** · Try logging in with bad credentials — PASS
  _Expect: "Invalid email or password" error, no token issued_
- [ ] **Forgot password** · `/login` → "Forgot password?" → enter email → check mailinator — PASS
  _Expect: reset email arrives; clicking link lands on `/reset-password` form_
- [ ] **Reset password** · Enter new password matching all rules → submit — PASS
  _Expect: success message; can log in with new password_
- [ ] **Duplicate signup** · Try signing up with an already-registered email — PASS
  _Expect: 409 "Email already registered"_

---

## 2 · Student Flow

> **Log in as:** john@student.edu

### 2a · Dashboard
- [ ] Hour summary cards show (Committed, Verified, Activities Done) — PASS
- [ ] Progress bar reflects verified hours vs school goal — PASS
- [ ] "Upcoming Opportunities" lists future events — PASS
- [ ] "Recent Activity" shows past sessions with statuses — PASS

### 2b · Browse
- [ ] Opportunities load on arrival — PASS
- [ ] **Search** · Type a partial title → list filters in real time — PASS
- [ ] **Tag filter** · Select a tag → only matching opps shown; clear → all return — PASS
- [ ] **Sort: Date** · Events appear in chronological order — PASS
- [ ] **Sort: Most Popular** · Higher-signup events appear first — PASS
- [ ] **Approved Orgs Only** toggle · List narrows to school-approved orgs — PASS
- [ ] **Save** · Click Save on an opp → appears in "Saved" tab — PASS
- [ ] **Skip** · Click Skip on another opp → appears in "Skipped" tab — PASS
- [ ] **Discard** · Click Discard → appears in "Discarded" tab — PASS
- [ ] **Recover** · From Skipped/Discarded tab, recover → moves back to main list — PASS

### 2c · Opportunity Detail & Signup
- [ ] Click an opportunity → detail view shows org name, date, time, location, capacity, tags, custom fields — PASS
- [ ] **Sign up** · Click "Sign Up" → button changes; confirm appears in student's signups — PASS
- [ ] **Capacity full → Waitlist** · If opp is at capacity, button reads "Join Waitlist"; status shows WAITLISTED — PASS
- [ ] **Cancel signup** · Cancel a CONFIRMED signup → slot freed, confirmation shown — PASS
- [ ] **Waitlist promotion** · If another student cancels and a waitlisted student exists, waitlisted student becomes CONFIRMED (check DB or re-browse) — PASS

### 2d · Check-In / Check-Out
- [ ] **Check in** · From dashboard or activity, click "Check In" on a confirmed session — PASS
  _Expect: session status → CHECKED_IN; check-in time recorded_
- [ ] **Check out** · Click "Check Out" — PASS
  _Expect: status → CHECKED_OUT; `totalHours` auto-calculated from elapsed time_

### 2e · Submit Verification
- [ ] **Drawn signature** · On a CHECKED_OUT session, open "Submit Verification" → draw signature → submit — PASS
  _Expect: status → PENDING_VERIFICATION; org & school notified_
- [ ] **File upload** · Submit verification with a PDF/PNG/JPG upload — PASS
  _Expect: accepted; unsupported types (e.g. `.exe`) rejected_
- [ ] **Before event date** · Try submitting verification before event date — PASS
  _Expect: blocked with appropriate error_

### 2f · Hour History & Reports
- [ ] Settings → Profile → "Export Hours (CSV)" downloads a `.csv` with correct columns (Date, Opportunity, Organization, Hours, Status) — PASS
- [ ] Settings → Profile → "Export as PDF" generates a PDF report — PASS

### 2g · Messages
- [ ] Navigate to Messages → inbox loads — PASS
- [ ] **Compose** · Send message to `volunteer@greenearth.org` — appears in Sent folder — PASS
- [ ] **Mark as read** · Unread message → click it → badge clears — MANUAL REQUIRED
  - Reason: No unread messages exist to mark as read in this environment state.
  - Manual Step: Create or receive an unread message, open it, and confirm unread badge clears.
- [ ] **Notifications tab** · System notifications listed; clicking one marks it read — PASS

### 2h · Settings
- [ ] **Profile** · Edit name, phone, bio (check 300-char limit) → Save → refresh → changes persist — PASS
- [ ] **Avatar upload** · Upload a profile image → avatar updates — PASS
- [ ] **Social links** · Enter Instagram handle → Save → persists — PASS
- [ ] **Notifications** · Toggle off "Hour Approvals" email → save → setting persists on refresh — PASS
- [ ] **Privacy** · Set "Who can message me" to "Orgs Only" → save → persists — PASS
- [ ] **Change password** · Enter current + valid new password → success — MANUAL REQUIRED
  - Reason: Changing john@student.edu password inside this run can break later required seed-account logins and downstream checklist continuity.
  - Manual Step: In Student Settings > Security, change password with current+valid new password, confirm success, and restore original credential for seed-account stability.
- [ ] **Classroom tab** · Displays current classroom and invite code; "Leave Classroom" button present — PASS
- [ ] **Delete account** · Type DELETE in confirmation → account removed → redirected to landing — MANUAL REQUIRED
  - Reason: Deleting john@student.edu would invalidate remaining checklist steps that require this seeded account.
  - Manual Step: Run this step separately: Student Settings > Security > Delete account, type DELETE, confirm redirect to landing and account removal.

---

## 3 · Organization Flow

> **Log in as:** volunteer@greenearth.org

### 3a · Dashboard
- [ ] Stats cards show (Total Opportunities, Signups, Approved Hours, Unique Volunteers) — PASS
- [ ] "Pending Verifications" section lists sessions awaiting action — PASS
- [ ] Recent activity feed shows last notifications — PASS

### 3b · Create & Manage Opportunities
- [ ] **Create** · Click "Create Opportunity" → fill all fields including address → Save — PASS
  _Expect: opp appears in Opportunities list with ACTIVE status_
- [ ] **Auto-geocode** · Created opp with address → lat/lng populated (visible to students as distance sort) — PASS
- [ ] **Edit** · Edit title/description/capacity → Save → changes reflected immediately — PASS
- [ ] **Cancel** · Cancel the opp → status → CANCELLED; signed-up students receive notification — PASS
- [ ] **Recurring pattern field** · Enable "Recurring" toggle → recurring pattern field appears; saved correctly — PASS

### 3c · Verify Hours
- [ ] **Approve** · From Dashboard pending list or verification queue, click Approve on a PENDING_VERIFICATION session — PASS
  _Expect: status → VERIFIED; student receives email notification_
- [ ] **Approve with override** · Approve with a custom hours value (different from totalHours) — PASS
  _Expect: `verifiedHours` reflects overridden value_
- [ ] **Reject** · Click Reject → enter reason (required) → submit — PASS
  _Expect: status → REJECTED; reason stored; student notified_
- [ ] **Self-verification blocked** · Org admin who is also verifier cannot verify their own session — MANUAL REQUIRED
  - Reason: Seed data does not include a user who is both org verifier and session owner; self-verification cannot be produced from available UI states.
  - Manual Step: Create an org-admin account that can log volunteer sessions for itself, then attempt to verify that own session and confirm "Cannot verify your own session".
  _Expect: error "Cannot verify your own session"_

### 3d · Announcements
- [ ] Click "Make Announcement" → select opp → type message → send — PASS
  _Expect: all confirmed signups for that opp receive a notification/message_

### 3e · Messages & Notifications
- [ ] Compose message to john@student.edu → appears in Sent — PASS
- [ ] Student's message from 2g appears in Inbox → mark read — PASS

### 3f · Settings
- [ ] **Profile** · Edit description (500-char limit), website, phone → Save → persists — PASS
- [ ] **ZIP codes** · Add a ZIP code → appears in list; remove it → gone — PASS
- [ ] **Schools tab** · Search for "Lincoln" → request approval — PASS
  _Expect: "Pending" status shown; school admin sees request_
- [ ] **Analytics** · Volunteer count and total hours display correctly — PASS
- [ ] **Export CSV** · Downloads volunteer data file — PASS
- [ ] **Change password** · Works correctly — MANUAL REQUIRED
  - Reason: Changing volunteer@greenearth.org password in-suite risks invalidating later required quick-smoke credentials.
  - Manual Step: In Organization Settings > Security, change password and confirm login, then restore seed password for shared test-account continuity.
- [ ] **Notifications** · Toggle off "New Signup" → save → persists — PASS

---

## 4 · School Admin Flow

> **Log in as:** admin@lincoln.edu

### 4a · Onboarding (first-time)
- [ ] On first login (clear `school_onboarding_*` from localStorage), graduation hours goal screen appears — PASS
- [ ] Enter hours (e.g. 40) → Save → lands on Dashboard — PASS

### 4b · Dashboard
- [ ] School stats: Total Students, Total Hours, Goal Completion %, At Risk count — PASS
- [ ] Classroom grid shows each classroom with: student count, completion count, at-risk count, invite code — PASS
- [ ] **Copy invite code** · Click copy button → clipboard contains the code — MANUAL REQUIRED
  - Reason: Clipboard API read is unavailable in this run environment.
  - Manual Step: Click copy invite code and manually paste to verify copied code is correct.
- [ ] **Org requests** · Org request from 3f appears in "Pending Requests" → Approve it — PASS
  _Expect: org status → APPROVED; org receives notification_
- [ ] **Reject org** · Reject a different pending org → status → REJECTED — PASS
- [ ] **Block org** · Block an approved org → confirmation modal → blocked; org disappears from approved list — PASS

### 4c · Groups (Student Management)
- [ ] Left sidebar shows "All Students" + individual classrooms — PASS
- [ ] **Search** · Type student name → list filters — PASS
- [ ] **Filter: Completed** · Shows only students at/above goal — PASS
- [ ] **Filter: At Risk** · Shows students with < 50% of goal — PASS
- [ ] **Filter: Not Started** · Shows 0-hour students — PASS
- [ ] **Select student** · Click a student → right panel shows name, email, hours progress bar, status badge — PASS
- [ ] **Send Reminder** · Opens compose window pre-filled with student as recipient — PASS
- [ ] **View Hour History** · Shows up to 5 sessions; each has date, opp, hours, status — PASS
- [ ] **Remove Hours** · On a VERIFIED session, click Remove → optionally enter reason → confirm — PASS
  _Expect: session status → REJECTED; student receives email notification; school hours total decreases_

### 4d · Add Staff
- [ ] Click "Add Staff Member" → fill name, email, optional classroom → Submit — PASS
  _Expect: success message with temporary password displayed; new teacher can log in_

### 4e · Settings
- [ ] **Profile** · Edit school name, domain, required hours, ZIP codes → Save → persists — PASS
- [ ] **Classrooms** · "Create Classroom" → enter name → created; appears in list with invite code — PASS
- [ ] **Data Export** · Export activity log CSV → downloads file with Student, Opportunity, Date, Hours, Status columns — PASS
- [ ] **Change password** · Works correctly — MANUAL REQUIRED
  - Reason: Changing admin@lincoln.edu password in-suite can break subsequent seeded login checks and shared test credentials.
  - Manual Step: In School Settings > Security, change password and verify login, then restore seed password before shared quick-smoke runs.
- [ ] **Notifications** · Toggle off an option → save → persists — PASS

---

## 5 · Cross-Role & Edge Cases

> These require switching accounts. Do them last.

- [ ] **Message preference enforcement** · Set student privacy to "Admins Only" → log in as org → attempt to message that student — PASS
  _Expect: blocked with "Message preferences do not allow this"_
- [ ] **Audit trail** · School admin views audit log for a session that was approved then had hours removed — PASS
  _Expect: two entries — APPROVE (by org/school) then OVERRIDE (by school)_
- [ ] **Rate limit** · Attempt 6+ signups from same IP within 1 hour — PASS
  _Expect: 429 "Too many signup attempts"_
- [ ] **Expired verification token** · Use a verify-email link older than 24h — MANUAL REQUIRED
  - Reason: Token-expiry >24h cannot be time-traveled from UI and no exposed admin control was found to mint an already-expired verification token.
  - Manual Step: Generate a verification token, wait past 24 hours (or use backend/admin tooling to mint expired token), then open link and confirm "Invalid or expired verification token".
  _Expect: "Invalid or expired verification token" error_
- [ ] **Resend verification** · On email verification screen, click "Resend" → new email arrives — PASS
  _Expect: new email in inbox; old token no longer works_

---

## 6 · Quick Smoke (post-deploy)

> Run after every deploy. Should take < 5 min.

- [ ] `GET /api/health` returns `{"status":"ok"}` — PASS
- [ ] Login as john@student.edu → Dashboard loads with no errors — PASS
- [ ] Browse page loads opportunities — PASS
- [ ] Login as volunteer@greenearth.org → Opportunities list loads — PASS
- [ ] Login as admin@lincoln.edu → Dashboard stats load — PASS
- [ ] No console errors on any of the above pages — PASS
