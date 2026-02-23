# GoodHours QA Results

Generated: 2026-02-23T00:05:15.081Z

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
- [ ] **Verification email delivered** · Check `mailinator.com/v4/public/inboxes.jsp?to=qa-test-01` — FAIL
  - Error: Mailinator message not found for inbox qa-test-04 with subject /Verify your GoodHours account/i
  - URL: https://goodhours.app/dashboard
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-002-2026-02-22T23-56-28-637Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/auth-flow-2026-02-22T23-53-14-442Z.zip
  _Expect: email from `noreply@notifications.goodhours.app`, subject "Verify your GoodHours account"_
- [ ] **Email link works** · Click "Verify Email" button in email — FAIL
  - Error: Missing verification link from previous step
  - URL: https://goodhours.app/dashboard
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-003-2026-02-22T23-56-28-655Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/auth-flow-2026-02-22T23-53-14-442Z.zip
  _Expect: app shows ✅ "Email verified!" then redirects to "Join a Classroom"_
- [ ] **Login with wrong password** · Try logging in with bad credentials — PASS
  _Expect: "Invalid email or password" error, no token issued_
- [ ] **Forgot password** · `/login` → "Forgot password?" → enter email → check mailinator — FAIL
  - Error: Mailinator message not found for inbox qa-test-04 with subject /Reset/i
  - URL: https://goodhours.app/forgot-password
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-005-2026-02-22T23-59-35-281Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/auth-flow-2026-02-22T23-53-14-442Z.zip
  _Expect: reset email arrives; clicking link lands on `/reset-password` form_
- [ ] **Reset password** · Enter new password matching all rules → submit — FAIL
  - Error: Missing reset link from previous step
  - URL: https://goodhours.app/forgot-password
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-006-2026-02-22T23-59-35-308Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/auth-flow-2026-02-22T23-53-14-442Z.zip
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
- [ ] **Sort: Most Popular** · Higher-signup events appear first — FAIL
  - Error: Higher-signup opportunities are not first in Most Popular sort
  - URL: https://goodhours.app/browse
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-016-2026-02-22T23-59-44-734Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/student-john-2026-02-22T23-59-36-494Z.zip
- [ ] **Approved Orgs Only** toggle · List narrows to school-approved orgs — PASS
- [ ] **Save** · Click Save on an opp → appears in "Saved" tab — FAIL
  - Error: locator.click: Error: strict mode violation: getByRole('button', { name: /^Saved$/i }) resolved to 6 elements:
    1) <button class="px-4 py-2 rounded-md text-sm font-medium capitalize bg-gray-100 text-gray-700 hover:bg-gray-200">Saved</button> aka getByRole('button', { name: 'Saved' }).first()
    2) <button class="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">Saved</button> aka getByRole('button', { name: 'Saved' }).nth(1)
    3) <button class="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">Saved</button> aka getByRole('button', { name: 'Saved' }).nth(2)
    4) <button class="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">Saved</button> aka getByRole('button', { name: 'Saved' }).nth(3)
    5) <button class="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">Saved</button> aka getByRole('button', { name: 'Saved' }).nth(4)
    6) <button class="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">Saved</button> aka getByRole('button', { name: 'Saved' }).nth(5)

Call log:
[2m  - waiting for getByRole('button', { name: /^Saved$/i })[22m

  - URL: https://goodhours.app/browse
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-018-2026-02-22T23-59-46-562Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/student-john-2026-02-22T23-59-36-494Z.zip
- [ ] **Skip** · Click Skip on another opp → appears in "Skipped" tab — PASS
- [ ] **Discard** · Click Discard → appears in "Discarded" tab — PASS
- [ ] **Recover** · From Skipped/Discarded tab, recover → moves back to main list — PASS

### 2c · Opportunity Detail & Signup
- [ ] Click an opportunity → detail view shows org name, date, time, location, capacity, tags, custom fields — FAIL
  - Error: Opportunity detail missing custom fields display
  - URL: https://goodhours.app/opportunity/cmlyd9edy0002k104mybl5fdx
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-022-2026-02-22T23-59-52-051Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/student-john-2026-02-22T23-59-36-494Z.zip
- [ ] **Sign up** · Click "Sign Up" → button changes; confirm appears in student's signups — FAIL
  - Error: No opportunity with Sign Up button found
  - URL: https://goodhours.app/opportunity/cmlyccawq0010munxishkzkg5
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-023-2026-02-23T00-00-01-691Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/student-john-2026-02-22T23-59-36-494Z.zip
- [ ] **Capacity full → Waitlist** · If opp is at capacity, button reads "Join Waitlist"; status shows WAITLISTED — FAIL
  - Error: Join Waitlist button is disabled
  - URL: https://goodhours.app/opportunity/cmlyd47zq0001jl04m7e4p8bx
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-024-2026-02-23T00-00-16-119Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/student-jane-2026-02-23T00-00-01-774Z.zip
- [ ] **Cancel signup** · Cancel a CONFIRMED signup → slot freed, confirmation shown — FAIL
  - Error: No signed opportunity title recorded from item 23
  - URL: https://goodhours.app/opportunity/cmlyccawq0010munxishkzkg5
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-025-2026-02-23T00-00-16-146Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/student-john-2026-02-22T23-59-36-494Z.zip
- [ ] **Waitlist promotion** · If another student cancels and a waitlisted student exists, waitlisted student becomes CONFIRMED (check DB or re-browse) — FAIL
  - Error: Waitlisted student was not promoted to CONFIRMED after cancellation
  - URL: https://goodhours.app/opportunity/cmlyd47zq0001jl04m7e4p8bx
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-026-2026-02-23T00-00-18-212Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/student-jane-2026-02-23T00-00-01-774Z.zip

### 2d · Check-In / Check-Out
- [ ] **Check in** · From dashboard or activity, click "Check In" on a confirmed session — FAIL
  - Error: Check In button not found on dashboard/activity for confirmed session
  - URL: https://goodhours.app/dashboard
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-027-2026-02-23T00-00-19-013Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/student-john-2026-02-22T23-59-36-494Z.zip
  _Expect: session status → CHECKED_IN; check-in time recorded_
- [ ] **Check out** · Click "Check Out" — FAIL
  - Error: Check Out button not found after check-in
  - URL: https://goodhours.app/dashboard
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-028-2026-02-23T00-00-19-073Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/student-john-2026-02-22T23-59-36-494Z.zip
  _Expect: status → CHECKED_OUT; `totalHours` auto-calculated from elapsed time_

### 2e · Submit Verification
- [ ] **Drawn signature** · On a CHECKED_OUT session, open "Submit Verification" → draw signature → submit — FAIL
  - Error: No signable opportunity found to create a verification session
  - URL: https://goodhours.app/opportunity/cmlyccawq0010munxishkzkg5
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-029-2026-02-23T00-00-39-904Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/student-john-2026-02-22T23-59-36-494Z.zip
  _Expect: status → PENDING_VERIFICATION; org & school notified_
- [ ] **File upload** · Submit verification with a PDF/PNG/JPG upload — FAIL
  - Error: No suitable opportunity found for file upload verification test
  - URL: https://goodhours.app/opportunity/cmlyccawq0010munxishkzkg5
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-030-2026-02-23T00-01-00-970Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/student-john-2026-02-22T23-59-36-494Z.zip
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
- [ ] "Pending Verifications" section lists sessions awaiting action — FAIL
  - Error: Pending Verifications section missing
  - URL: https://goodhours.app/dashboard
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-047-2026-02-23T00-01-29-904Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/org-volunteer-2026-02-23T00-01-26-545Z.zip
- [ ] Recent activity feed shows last notifications — PASS

### 3b · Create & Manage Opportunities
- [ ] **Create** · Click "Create Opportunity" → fill all fields including address → Save — PASS
  _Expect: opp appears in Opportunities list with ACTIVE status_
- [ ] **Auto-geocode** · Created opp with address → lat/lng populated (visible to students as distance sort) — PASS
- [ ] **Edit** · Edit title/description/capacity → Save → changes reflected immediately — FAIL
  - Error: Updated opportunity title not reflected immediately in list
  - URL: https://goodhours.app/opportunities/cmlyccauk000wmunxm6r05gwn/edit
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-051-2026-02-23T00-01-33-146Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/org-volunteer-2026-02-23T00-01-26-545Z.zip
- [ ] **Cancel** · Cancel the opp → status → CANCELLED; signed-up students receive notification — FAIL
  - Error: Updated opportunity card not found for cancel action
  - URL: https://goodhours.app/opportunities/cmlyccauk000wmunxm6r05gwn/edit
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-052-2026-02-23T00-01-33-199Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/org-volunteer-2026-02-23T00-01-26-545Z.zip
- [ ] **Recurring pattern field** · Enable "Recurring" toggle → recurring pattern field appears; saved correctly — FAIL
  - Error: Recurring pattern field did not appear after enabling Recurring toggle
  - URL: https://goodhours.app/opportunities/new
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-053-2026-02-23T00-01-34-563Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/org-volunteer-2026-02-23T00-01-26-545Z.zip

### 3c · Verify Hours
- [ ] **Approve** · From Dashboard pending list or verification queue, click Approve on a PENDING_VERIFICATION session — FAIL
  - Error: No pending verification available to approve
  - URL: https://goodhours.app/dashboard
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-054-2026-02-23T00-01-35-388Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/org-volunteer-2026-02-23T00-01-26-545Z.zip
  _Expect: status → VERIFIED; student receives email notification_
- [ ] **Approve with override** · Approve with a custom hours value (different from totalHours) — FAIL
  - Error: Approve-with-override UI/control not present in organization verification flow
  - URL: https://goodhours.app/dashboard
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-055-2026-02-23T00-01-35-433Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/org-volunteer-2026-02-23T00-01-26-545Z.zip
  _Expect: `verifiedHours` reflects overridden value_
- [ ] **Reject** · Click Reject → enter reason (required) → submit — FAIL
  - Error: No pending verification available to reject
  - URL: https://goodhours.app/dashboard
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-056-2026-02-23T00-01-35-461Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/org-volunteer-2026-02-23T00-01-26-545Z.zip
  _Expect: status → REJECTED; reason stored; student notified_
- [ ] **Self-verification blocked** · Org admin who is also verifier cannot verify their own session — MANUAL REQUIRED
  - Reason: Seed data does not include a user who is both org verifier and session owner; self-verification cannot be produced from available UI states.
  - Manual Step: Create an org-admin account that can log volunteer sessions for itself, then attempt to verify that own session and confirm "Cannot verify your own session".
  _Expect: error "Cannot verify your own session"_

### 3d · Announcements
- [ ] Click "Make Announcement" → select opp → type message → send — PASS
  _Expect: all confirmed signups for that opp receive a notification/message_

### 3e · Messages & Notifications
- [ ] Compose message to john@student.edu → appears in Sent — FAIL
  - Error: Org message to john not present in Sent folder
  - URL: https://goodhours.app/messages
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-059-2026-02-23T00-01-39-648Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/org-volunteer-2026-02-23T00-01-26-545Z.zip
- [ ] Student's message from 2g appears in Inbox → mark read — PASS

### 3f · Settings
- [ ] **Profile** · Edit description (500-char limit), website, phone → Save → persists — PASS
- [ ] **ZIP codes** · Add a ZIP code → appears in list; remove it → gone — FAIL
  - Error: Removed ZIP code still present in list
  - URL: https://goodhours.app/settings
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-062-2026-02-23T00-01-44-655Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/org-volunteer-2026-02-23T00-01-26-545Z.zip
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
- [ ] On first login (clear `school_onboarding_*` from localStorage), graduation hours goal screen appears — FAIL
  - Error: Onboarding goal screen did not appear after clearing school_onboarding_* localStorage keys
  - URL: https://goodhours.app/
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-068-2026-02-23T00-01-52-796Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/school-admin-2026-02-23T00-01-50-287Z.zip
  - Console/Network Logs Snippet:

```text
[2026-02-23T00:01:52.652Z] requestfailed: POST https://goodhours.app/api/auth/set-graduation-goal -> net::ERR_ABORTED
[2026-02-23T00:01:52.734Z] requestfailed: GET https://goodhours.app/api/auth/me -> net::ERR_ABORTED
```
- [ ] Enter hours (e.g. 40) → Save → lands on Dashboard — FAIL
  - Error: Continue to Dashboard button not present for onboarding step
  - URL: https://goodhours.app/
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-069-2026-02-23T00-01-52-847Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/school-admin-2026-02-23T00-01-50-287Z.zip

### 4b · Dashboard
- [ ] School stats: Total Students, Total Hours, Goal Completion %, At Risk count — FAIL
  - Error: Dashboard stat missing: Total Students
  - URL: https://goodhours.app/
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-070-2026-02-23T00-01-52-896Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/school-admin-2026-02-23T00-01-50-287Z.zip
- [ ] Classroom grid shows each classroom with: student count, completion count, at-risk count, invite code — FAIL
  - Error: Classroom grid section missing
  - URL: https://goodhours.app/
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-071-2026-02-23T00-01-52-945Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/school-admin-2026-02-23T00-01-50-287Z.zip
- [ ] **Copy invite code** · Click copy button → clipboard contains the code — FAIL
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^Copy$/i }).first()[22m

  - URL: https://goodhours.app/
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-072-2026-02-23T00-02-08-000Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/school-admin-2026-02-23T00-01-50-287Z.zip
- [ ] **Org requests** · Org request from 3f appears in "Pending Requests" → Approve it — FAIL
  - Error: No pending org request found to approve from step 3f
  - URL: https://goodhours.app/
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-073-2026-02-23T00-02-08-088Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/school-admin-2026-02-23T00-01-50-287Z.zip
  _Expect: org status → APPROVED; org receives notification_
- [ ] **Reject org** · Reject a different pending org → status → REJECTED — FAIL
  - Error: No second pending org request found to reject
  - URL: https://goodhours.app/
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-074-2026-02-23T00-02-08-149Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/school-admin-2026-02-23T00-01-50-287Z.zip
- [ ] **Block org** · Block an approved org → confirmation modal → blocked; org disappears from approved list — FAIL
  - Error: No approved org available to block
  - URL: https://goodhours.app/
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-075-2026-02-23T00-02-08-196Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/school-admin-2026-02-23T00-01-50-287Z.zip

### 4c · Groups (Student Management)
- [ ] Left sidebar shows "All Students" + individual classrooms — FAIL
  - Error: All Students sidebar entry missing
  - URL: https://goodhours.app/
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-076-2026-02-23T00-02-08-943Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/school-admin-2026-02-23T00-01-50-287Z.zip
- [ ] **Search** · Type student name → list filters — FAIL
  - Error: Student search input missing
  - URL: https://goodhours.app/
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-077-2026-02-23T00-02-09-006Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/school-admin-2026-02-23T00-01-50-287Z.zip
- [ ] **Filter: Completed** · Shows only students at/above goal — FAIL
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /Completed/i })[22m

  - URL: https://goodhours.app/
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-078-2026-02-23T00-02-24-067Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/school-admin-2026-02-23T00-01-50-287Z.zip
- [ ] **Filter: At Risk** · Shows students with < 50% of goal — FAIL
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^At Risk/i })[22m

  - URL: https://goodhours.app/
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-079-2026-02-23T00-02-39-137Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/school-admin-2026-02-23T00-01-50-287Z.zip
- [ ] **Filter: Not Started** · Shows 0-hour students — FAIL
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /Not Started/i })[22m

  - URL: https://goodhours.app/
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-080-2026-02-23T00-02-54-205Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/school-admin-2026-02-23T00-01-50-287Z.zip
- [ ] **Select student** · Click a student → right panel shows name, email, hours progress bar, status badge — FAIL
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /All Students/i })[22m

  - URL: https://goodhours.app/
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-081-2026-02-23T00-03-24-311Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/school-admin-2026-02-23T00-01-50-287Z.zip
- [ ] **Send Reminder** · Opens compose window pre-filled with student as recipient — FAIL
  - Error: Send Reminder button not found
  - URL: https://goodhours.app/
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-082-2026-02-23T00-03-24-392Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/school-admin-2026-02-23T00-01-50-287Z.zip
- [ ] **View Hour History** · Shows up to 5 sessions; each has date, opp, hours, status — FAIL
  - Error: View Hour History control not found
  - URL: https://goodhours.app/
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-083-2026-02-23T00-03-24-449Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/school-admin-2026-02-23T00-01-50-287Z.zip
- [ ] **Remove Hours** · On a VERIFIED session, click Remove → optionally enter reason → confirm — FAIL
  - Error: Remove Hours action not found on a VERIFIED session
  - URL: https://goodhours.app/
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-084-2026-02-23T00-03-24-498Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/school-admin-2026-02-23T00-01-50-287Z.zip
  _Expect: session status → REJECTED; student receives email notification; school hours total decreases_

### 4d · Add Staff
- [ ] Click "Add Staff Member" → fill name, email, optional classroom → Submit — FAIL
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /Add Staff Member/i })[22m

  - URL: https://goodhours.app/
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-085-2026-02-23T00-03-40-139Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/school-admin-2026-02-23T00-01-50-287Z.zip
  _Expect: success message with temporary password displayed; new teacher can log in_

### 4e · Settings
- [ ] **Profile** · Edit school name, domain, required hours, ZIP codes → Save → persists — FAIL
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^profile$/i })[22m

  - URL: https://goodhours.app/
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-086-2026-02-23T00-03-55-817Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/school-admin-2026-02-23T00-01-50-287Z.zip
- [ ] **Classrooms** · "Create Classroom" → enter name → created; appears in list with invite code — FAIL
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^classrooms$/i })[22m

  - URL: https://goodhours.app/
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-087-2026-02-23T00-04-10-887Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/school-admin-2026-02-23T00-01-50-287Z.zip
- [ ] **Data Export** · Export activity log CSV → downloads file with Student, Opportunity, Date, Hours, Status columns — FAIL
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^data$/i })[22m

  - URL: https://goodhours.app/
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-088-2026-02-23T00-04-25-973Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/school-admin-2026-02-23T00-01-50-287Z.zip
- [ ] **Change password** · Works correctly — MANUAL REQUIRED
  - Reason: Changing admin@lincoln.edu password in-suite can break subsequent seeded login checks and shared test credentials.
  - Manual Step: In School Settings > Security, change password and verify login, then restore seed password before shared quick-smoke runs.
- [ ] **Notifications** · Toggle off an option → save → persists — FAIL
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^notifications$/i })[22m

  - URL: https://goodhours.app/
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-090-2026-02-23T00-04-41-075Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/school-admin-2026-02-23T00-01-50-287Z.zip

---

## 5 · Cross-Role & Edge Cases

> These require switching accounts. Do them last.

- [ ] **Message preference enforcement** · Set student privacy to "Admins Only" → log in as org → attempt to message that student — FAIL
  - Error: Org-to-student message was not blocked by student privacy Admins Only setting
  - URL: https://goodhours.app/settings
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-091-2026-02-23T00-04-44-143Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/student-john-2026-02-22T23-59-36-494Z.zip
  _Expect: blocked with "Message preferences do not allow this"_
- [ ] **Audit trail** · School admin views audit log for a session that was approved then had hours removed — FAIL
  - Error: No audit trail UI found for approved-then-removed session history verification
  - URL: https://goodhours.app/
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-092-2026-02-23T00-04-45-240Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/school-admin-2026-02-23T00-01-50-287Z.zip
  _Expect: two entries — APPROVE (by org/school) then OVERRIDE (by school)_
- [ ] **Rate limit** · Attempt 6+ signups from same IP within 1 hour — PASS
  _Expect: 429 "Too many signup attempts"_
- [ ] **Expired verification token** · Use a verify-email link older than 24h — MANUAL REQUIRED
  - Reason: Token-expiry >24h cannot be time-traveled from UI and no exposed admin control was found to mint an already-expired verification token.
  - Manual Step: Generate a verification token, wait past 24 hours (or use backend/admin tooling to mint expired token), then open link and confirm "Invalid or expired verification token".
  _Expect: "Invalid or expired verification token" error_
- [ ] **Resend verification** · On email verification screen, click "Resend" → new email arrives — FAIL
  - Error: Failed to create resend-test account. status=429
  - URL: https://goodhours.app/signup
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-095-2026-02-23T00-04-50-034Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/auth-flow-2026-02-22T23-53-14-442Z.zip
  - Console/Network Logs Snippet:

```text
[2026-02-23T00:04:49.029Z] response: 429 POST https://goodhours.app/api/auth/signup
[2026-02-23T00:04:49.030Z] console.error: Failed to load resource: the server responded with a status of 429 ()
```
  _Expect: new email in inbox; old token no longer works_

---

## 6 · Quick Smoke (post-deploy)

> Run after every deploy. Should take < 5 min.

- [ ] `GET /api/health` returns `{"status":"ok"}` — PASS
- [ ] Login as john@student.edu → Dashboard loads with no errors — PASS
- [ ] Browse page loads opportunities — PASS
- [ ] Login as volunteer@greenearth.org → Opportunities list loads — PASS
- [ ] Login as admin@lincoln.edu → Dashboard stats load — FAIL
  - Error: locator.innerText: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for locator('main')[22m

  - URL: https://goodhours.app/dashboard
  - Screenshot: /Users/abhay/Hourly/tests/artifacts/screenshots/item-100-2026-02-23T00-05-14-386Z.png
  - Trace: /Users/abhay/Hourly/tests/artifacts/traces/quick-admin-2026-02-23T00-04-56-552Z.zip
  - Console/Network Logs Snippet:

```text
[2026-02-23T00:04:58.757Z] requestfailed: POST https://goodhours.app/api/auth/set-graduation-goal -> net::ERR_ABORTED
```
- [ ] No console errors on any of the above pages — PASS
