# GoodHours QA Results

Generated: 2026-05-18T13:51:44.513Z

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

- [ ] **Signup — Student** · Select "I would like to volunteer" → fill form → "Create Account" — PASS — FAIL
  - Error: Volunteer signup role selector not found on /signup
  - URL: http://127.0.0.1:5174/signup
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-001-2026-05-18T13-40-28-589Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/auth-flow-2026-05-18T13-40-27-710Z.zip
  _Expect: redirected to `/dashboard` showing "Verify your email" screen with the correct address_
- [ ] **Verification email delivered** · Check `mailinator.com/v4/public/inboxes.jsp?to=qa-test-01` — PASS — FAIL
  - Error: Mailinator message not found for inbox  with subject /Verify your GoodHours account/i (Mailinator list API HTTP 506)
  - URL: http://127.0.0.1:5174/signup
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-002-2026-05-18T13-43-30-353Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/auth-flow-2026-05-18T13-40-27-710Z.zip
  _Expect: email from `noreply@notifications.goodhours.app`, subject "Verify your GoodHours account"_
- [ ] **Email link works** · Click "Verify Email" button in email — PASS — FAIL
  - Error: Missing verification link from previous step
  - URL: http://127.0.0.1:5174/signup
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-003-2026-05-18T13-43-30-405Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/auth-flow-2026-05-18T13-40-27-710Z.zip
  _Expect: app shows ✅ "Email verified!" then redirects to "Join a Classroom"_
- [ ] **Login with wrong password** · Try logging in with bad credentials — PASS — FAIL
  - Error: locator.fill: Error: strict mode violation: locator('input[type="email"]') resolved to 2 elements:
    1) <input value="" required="" type="email" autocomplete="email" placeholder="you@school.edu" class="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"/> aka getByRole('textbox', { name: 'you@school.edu' })
    2) <input value="" type="email" placeholder="dev@any-domain.test" class="flex-1 h-9 px-3 border border-amber-200 rounded-md focus:outline-none focus:border-amber-400 text-[13.5px]"/> aka getByRole('textbox', { name: 'dev@any-domain.test' })

Call log:
[2m  - waiting for locator('input[type="email"]')[22m

  - URL: http://127.0.0.1:5174/login
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-004-2026-05-18T13-43-30-602Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/auth-flow-2026-05-18T13-40-27-710Z.zip
  _Expect: "Invalid email or password" error, no token issued_
- [ ] **Forgot password** · `/login` → "Forgot password?" → enter email → check mailinator — PASS — FAIL
  - Error: page.waitForResponse: Timeout 60000ms exceeded while waiting for event "response"
  - URL: http://127.0.0.1:5174/forgot-password
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-005-2026-05-18T13-44-31-215Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/auth-flow-2026-05-18T13-40-27-710Z.zip
  _Expect: reset email arrives; clicking link lands on `/reset-password` form_
- [ ] **Reset password** · Enter new password matching all rules → submit — PASS — FAIL
  - Error: Missing reset link from previous step
  - URL: http://127.0.0.1:5174/forgot-password
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-006-2026-05-18T13-44-31-268Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/auth-flow-2026-05-18T13-40-27-710Z.zip
  _Expect: success message; can log in with new password_
- [ ] **Duplicate signup** · Try signing up with an already-registered email — PASS — FAIL
  - Error: Volunteer signup role selector not found on /signup
  - URL: http://127.0.0.1:5174/signup
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-007-2026-05-18T13-44-31-907Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/auth-flow-2026-05-18T13-40-27-710Z.zip
  _Expect: 409 "Email already registered"_

---

## 2 · Student Flow

> **Log in as:** john@student.edu

### 2a · Dashboard
- [ ] Hour summary cards show (Committed, Verified, Activities Done) — PASS — FAIL
  - Error: Committed Hours card missing
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-008-2026-05-18T13-44-34-357Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
- [ ] Progress bar reflects verified hours vs school goal — PASS — PASS
- [ ] "Upcoming Opportunities" lists future events — PASS — FAIL
  - Error: Upcoming Opportunities section missing
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-010-2026-05-18T13-44-34-412Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
- [ ] "Recent Activity" shows past sessions with statuses — PASS — PASS

### 2b · Browse
- [ ] Opportunities load on arrival — PASS — FAIL
  - Error: No opportunities loaded on Browse page
  - URL: http://127.0.0.1:5174/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-012-2026-05-18T13-44-35-087Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
  - Console/Network Logs Snippet:

```text
[2026-05-18T13:44:34.539Z] response: 404 GET http://127.0.0.1:5174/api/schools/my-rules
[2026-05-18T13:44:34.539Z] console.error: Failed to load resource: the server responded with a status of 404 (Not Found)
[2026-05-18T13:44:34.541Z] response: 404 GET http://127.0.0.1:5174/api/schools/my-rules
[2026-05-18T13:44:34.541Z] console.error: Failed to load resource: the server responded with a status of 404 (Not Found)
```
- [ ] **Search** · Type a partial title → list filters in real time — PASS — FAIL
  - Error: No opportunities available for search test
  - URL: http://127.0.0.1:5174/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-013-2026-05-18T13-44-35-150Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
- [ ] **Tag filter** · Select a tag → only matching opps shown; clear → all return — PASS — FAIL
  - Error: Tag filter select not found
  - URL: http://127.0.0.1:5174/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-014-2026-05-18T13-44-35-208Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
- [ ] **Sort: Date** · Events appear in chronological order — PASS — FAIL
  - Error: locator.selectOption: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for locator('select').first()[22m

  - URL: http://127.0.0.1:5174/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-015-2026-05-18T13-45-05-264Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
- [ ] **Sort: Most Popular** · Higher-signup events appear first — PASS — FAIL
  - Error: locator.selectOption: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for locator('select').first()[22m

  - URL: http://127.0.0.1:5174/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-016-2026-05-18T13-45-35-330Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
- [ ] **Approved Orgs Only** toggle · List narrows to school-approved orgs — PASS — FAIL
  - Error: Approved Orgs Only toggle not found
  - URL: http://127.0.0.1:5174/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-017-2026-05-18T13-45-35-392Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
- [ ] **Save** · Click Save on an opp → appears in "Saved" tab — PASS — FAIL
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^All$/i })[22m

  - URL: http://127.0.0.1:5174/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-018-2026-05-18T13-45-50-440Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
- [ ] **Skip** · Click Skip on another opp → appears in "Skipped" tab — PASS — FAIL
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^All$/i })[22m

  - URL: http://127.0.0.1:5174/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-019-2026-05-18T13-46-05-488Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
- [ ] **Discard** · Click Discard → appears in "Discarded" tab — PASS — FAIL
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^All$/i })[22m

  - URL: http://127.0.0.1:5174/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-020-2026-05-18T13-46-20-540Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
- [ ] **Recover** · From Skipped/Discarded tab, recover → moves back to main list — PASS — FAIL
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^Skipped$/i })[22m

  - URL: http://127.0.0.1:5174/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-021-2026-05-18T13-46-35-610Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip

### 2c · Opportunity Detail & Signup
- [ ] Click an opportunity → detail view shows org name, date, time, location, capacity, tags, custom fields — PASS — FAIL
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^All$/i })[22m

  - URL: http://127.0.0.1:5174/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-022-2026-05-18T13-46-50-681Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
- [ ] **Sign up** · Click "Sign Up" → button changes; confirm appears in student's signups — PASS — FAIL
  - Error: No opportunity with Sign Up button found
  - URL: http://127.0.0.1:5174/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-023-2026-05-18T13-46-51-373Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
  - Console/Network Logs Snippet:

```text
[2026-05-18T13:46:50.853Z] response: 404 GET http://127.0.0.1:5174/api/schools/my-rules
[2026-05-18T13:46:50.853Z] console.error: Failed to load resource: the server responded with a status of 404 (Not Found)
[2026-05-18T13:46:50.859Z] response: 404 GET http://127.0.0.1:5174/api/schools/my-rules
[2026-05-18T13:46:50.859Z] console.error: Failed to load resource: the server responded with a status of 404 (Not Found)
```
- [ ] **Capacity full → Waitlist** · If opp is at capacity, button reads "Join Waitlist"; status shows WAITLISTED — PASS — FAIL
  - Error: No capacity-full opportunity with Join Waitlist button found
  - URL: http://127.0.0.1:5174/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-024-2026-05-18T13-46-54-393Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-jane-2026-05-18T13-46-51-459Z.zip
- [ ] **Cancel signup** · Cancel a CONFIRMED signup → slot freed, confirmation shown — PASS — FAIL
  - Error: No signed opportunity title recorded from item 23
  - URL: http://127.0.0.1:5174/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-025-2026-05-18T13-46-54-473Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
- [ ] **Waitlist promotion** · If another student cancels and a waitlisted student exists, waitlisted student becomes CONFIRMED (check DB or re-browse) — PASS — FAIL
  - Error: No waitlist opportunity recorded from item 24
  - URL: http://127.0.0.1:5174/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-026-2026-05-18T13-46-54-520Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-jane-2026-05-18T13-46-51-459Z.zip

### 2d · Check-In / Check-Out
- [ ] **Check in** · From dashboard or activity, click "Check In" on a confirmed session — PASS — FAIL
  - Error: Check In button not found on dashboard/activity for confirmed session
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-027-2026-05-18T13-46-55-214Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
  _Expect: session status → CHECKED_IN; check-in time recorded_
- [ ] **Check out** · Click "Check Out" — PASS — FAIL
  - Error: Check Out button not found after check-in
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-028-2026-05-18T13-46-55-281Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
  _Expect: status → CHECKED_OUT; `totalHours` auto-calculated from elapsed time_

### 2e · Submit Verification
- [ ] **Drawn signature** · On a CHECKED_OUT session, open "Submit Verification" → draw signature → submit — PASS — FAIL
  - Error: No signable opportunity found to create a verification session
  - URL: http://127.0.0.1:5174/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-029-2026-05-18T13-46-56-535Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
  - Console/Network Logs Snippet:

```text
[2026-05-18T13:46:55.398Z] response: 404 GET http://127.0.0.1:5174/api/schools/my-rules
[2026-05-18T13:46:55.398Z] console.error: Failed to load resource: the server responded with a status of 404 (Not Found)
[2026-05-18T13:46:55.409Z] response: 404 GET http://127.0.0.1:5174/api/schools/my-rules
[2026-05-18T13:46:55.409Z] console.error: Failed to load resource: the server responded with a status of 404 (Not Found)
[2026-05-18T13:46:56.015Z] response: 404 GET http://127.0.0.1:5174/api/schools/my-rules
[2026-05-18T13:46:56.015Z] console.error: Failed to load resource: the server responded with a status of 404 (Not Found)
[2026-05-18T13:46:56.021Z] response: 404 GET http://127.0.0.1:5174/api/schools/my-rules
[2026-05-18T13:46:56.021Z] console.error: Failed to load resource: the server responded with a status of 404 (Not Found)
```
  _Expect: status → PENDING_VERIFICATION; org & school notified_
- [ ] **File upload** · Submit verification with a PDF/PNG/JPG upload — PASS — FAIL
  - Error: No suitable opportunity found for file upload verification test
  - URL: http://127.0.0.1:5174/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-030-2026-05-18T13-46-57-770Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
  - Console/Network Logs Snippet:

```text
[2026-05-18T13:46:56.651Z] response: 404 GET http://127.0.0.1:5174/api/schools/my-rules
[2026-05-18T13:46:56.651Z] console.error: Failed to load resource: the server responded with a status of 404 (Not Found)
[2026-05-18T13:46:56.659Z] response: 404 GET http://127.0.0.1:5174/api/schools/my-rules
[2026-05-18T13:46:56.659Z] console.error: Failed to load resource: the server responded with a status of 404 (Not Found)
[2026-05-18T13:46:57.245Z] response: 404 GET http://127.0.0.1:5174/api/schools/my-rules
[2026-05-18T13:46:57.245Z] console.error: Failed to load resource: the server responded with a status of 404 (Not Found)
[2026-05-18T13:46:57.253Z] response: 404 GET http://127.0.0.1:5174/api/schools/my-rules
[2026-05-18T13:46:57.253Z] console.error: Failed to load resource: the server responded with a status of 404 (Not Found)
```
  _Expect: accepted; unsupported types (e.g. `.exe`) rejected_
- [ ] **Before event date** · Try submitting verification before event date — PASS — FAIL
  - Error: Could not verify blocking behavior for verification before event date
  - URL: http://127.0.0.1:5174/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-031-2026-05-18T13-46-58-411Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
  - Console/Network Logs Snippet:

```text
[2026-05-18T13:46:57.892Z] response: 404 GET http://127.0.0.1:5174/api/schools/my-rules
[2026-05-18T13:46:57.892Z] console.error: Failed to load resource: the server responded with a status of 404 (Not Found)
[2026-05-18T13:46:57.898Z] response: 404 GET http://127.0.0.1:5174/api/schools/my-rules
[2026-05-18T13:46:57.898Z] console.error: Failed to load resource: the server responded with a status of 404 (Not Found)
```
  _Expect: blocked with appropriate error_

### 2f · Hour History & Reports
- [ ] Settings → Profile → "Export Hours (CSV)" downloads a `.csv` with correct columns (Date, Opportunity, Organization, Hours, Status) — PASS — PASS
- [ ] Settings → Profile → "Export as PDF" generates a PDF report — PASS — PASS

### 2g · Messages
- [ ] Navigate to Messages → inbox loads — PASS — PASS
- [ ] **Compose** · Send message to `volunteer@greenearth.org` — appears in Sent folder — PASS — FAIL
  - Error: Sent folder does not include message sent to org
  - URL: http://127.0.0.1:5174/messages
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-035-2026-05-18T13-47-01-359Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
  - Console/Network Logs Snippet:

```text
[2026-05-18T13:46:59.919Z] response: 404 POST http://127.0.0.1:5174/api/messages
[2026-05-18T13:46:59.919Z] console.error: Failed to load resource: the server responded with a status of 404 (Not Found)
```
- [ ] **Mark as read** · Unread message → click it → badge clears — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: No unread messages exist to mark as read in this environment state.
  - Manual Step: Create or receive an unread message, open it, and confirm unread badge clears.
  - Reason: No unread messages exist to mark as read in this environment state.
  - Manual Step: Create or receive an unread message, open it, and confirm unread badge clears.
- [ ] **Notifications tab** · System notifications listed; clicking one marks it read — PASS — PASS

### 2h · Settings
- [ ] **Profile** · Edit name, phone, bio (check 300-char limit) → Save → refresh → changes persist — PASS — FAIL
  - Error: locator.fill: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for locator('input[type="tel"]').first()[22m

  - URL: http://127.0.0.1:5174/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-038-2026-05-18T13-47-18-817Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
- [ ] **Avatar upload** · Upload a profile image → avatar updates — PASS — PASS
- [ ] **Social links** · Enter Instagram handle → Save → persists — PASS — FAIL
  - Error: Instagram input not found
  - URL: http://127.0.0.1:5174/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-040-2026-05-18T13-47-21-893Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
- [ ] **Notifications** · Toggle off "Hour Approvals" email → save → setting persists on refresh — PASS — FAIL
  - Error: Hour Approvals email toggle did not persist OFF state
  - URL: http://127.0.0.1:5174/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-041-2026-05-18T13-47-24-862Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
- [ ] **Privacy** · Set "Who can message me" to "Orgs Only" → save → persists — PASS — FAIL
  - Error: Expected message restriction ORGS_ONLY, got EVERYONE
  - URL: http://127.0.0.1:5174/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-042-2026-05-18T13-47-26-928Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
- [ ] **Change password** · Enter current + valid new password → success — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Changing john@student.edu password inside this run can break later required seed-account logins and downstream checklist continuity.
  - Manual Step: In Student Settings > Security, change password with current+valid new password, confirm success, and restore original credential for seed-account stability.
  - Reason: Changing john@student.edu password inside this run can break later required seed-account logins and downstream checklist continuity.
  - Manual Step: In Student Settings > Security, change password with current+valid new password, confirm success, and restore original credential for seed-account stability.
- [ ] **Classroom tab** · Displays current classroom and invite code; "Leave Classroom" button present — PASS — FAIL
  - Error: Leave Classroom button missing
  - URL: http://127.0.0.1:5174/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-044-2026-05-18T13-47-27-597Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
- [ ] **Delete account** · Type DELETE in confirmation → account removed → redirected to landing — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Deleting john@student.edu would invalidate remaining checklist steps that require this seeded account.
  - Manual Step: Run this step separately: Student Settings > Security > Delete account, type DELETE, confirm redirect to landing and account removal.
  - Reason: Deleting john@student.edu would invalidate remaining checklist steps that require this seeded account.
  - Manual Step: Run this step separately: Student Settings > Security > Delete account, type DELETE, confirm redirect to landing and account removal.

---

## 3 · Organization Flow

> **Log in as:** volunteer@greenearth.org

### 3a · Dashboard
- [ ] Stats cards show (Total Opportunities, Signups, Approved Hours, Unique Volunteers) — PASS — FAIL
  - Error: Missing org stat card: Total Opportunities
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-046-2026-05-18T13-47-29-977Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-05-18T13-47-27-661Z.zip
- [ ] "Pending Verifications" section lists sessions awaiting action — PASS — FAIL
  - Error: Pending Verifications section missing
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-047-2026-05-18T13-47-30-021Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-05-18T13-47-27-661Z.zip
- [ ] Recent activity feed shows last notifications — PASS — FAIL
  - Error: Recent activity feed missing
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-048-2026-05-18T13-47-30-071Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-05-18T13-47-27-661Z.zip

### 3b · Create & Manage Opportunities
- [ ] **Create** · Click "Create Opportunity" → fill all fields including address → Save — PASS — FAIL
  - Error: locator.fill: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for locator('input[name="title"]')[22m

  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-049-2026-05-18T13-47-45-727Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-05-18T13-47-27-661Z.zip
  _Expect: opp appears in Opportunities list with ACTIVE status_
- [ ] **Auto-geocode** · Created opp with address → lat/lng populated (visible to students as distance sort) — PASS — FAIL
  - Error: No create-opportunity API response available for geocode validation
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-050-2026-05-18T13-47-45-788Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-05-18T13-47-27-661Z.zip
- [ ] **Edit** · Edit title/description/capacity → Save → changes reflected immediately — PASS — FAIL
  - Error: Created opportunity card not found for edit
  - URL: http://127.0.0.1:5174/opportunities
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-051-2026-05-18T13-47-46-456Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-05-18T13-47-27-661Z.zip
- [ ] **Cancel** · Cancel the opp → status → CANCELLED; signed-up students receive notification — PASS — FAIL
  - Error: Cancel button missing on updated opportunity
  - URL: http://127.0.0.1:5174/opportunities
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-052-2026-05-18T13-47-46-520Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-05-18T13-47-27-661Z.zip
- [ ] **Recurring pattern field** · Enable "Recurring" toggle → recurring pattern field appears; saved correctly — PASS — FAIL
  - Error: Recurring toggle checkbox not found
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-053-2026-05-18T13-47-47-177Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-05-18T13-47-27-661Z.zip

### 3c · Verify Hours
- [ ] **Approve** · From Dashboard pending list or verification queue, click Approve on a PENDING_VERIFICATION session — PASS — FAIL
  - Error: No pending verification available to approve
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-054-2026-05-18T13-47-47-821Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-05-18T13-47-27-661Z.zip
  _Expect: status → VERIFIED; student receives email notification_
- [ ] **Approve with override** · Approve with a custom hours value (different from totalHours) — PASS — FAIL
  - Error: No pending verification available for override approval
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-055-2026-05-18T13-47-47-875Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-05-18T13-47-27-661Z.zip
  _Expect: `verifiedHours` reflects overridden value_
- [ ] **Reject** · Click Reject → enter reason (required) → submit — PASS — FAIL
  - Error: No pending verification available to reject
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-056-2026-05-18T13-47-47-921Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-05-18T13-47-27-661Z.zip
  _Expect: status → REJECTED; reason stored; student notified_
- [ ] **Self-verification blocked** · Org admin who is also verifier cannot verify their own session — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Seed data does not include a user who is both org verifier and session owner; self-verification cannot be produced from available UI states.
  - Manual Step: Create an org-admin account that can log volunteer sessions for itself, then attempt to verify that own session and confirm "Cannot verify your own session".
  - Reason: Seed data does not include a user who is both org verifier and session owner; self-verification cannot be produced from available UI states.
  - Manual Step: Create an org-admin account that can log volunteer sessions for itself, then attempt to verify that own session and confirm "Cannot verify your own session".
  _Expect: error "Cannot verify your own session"_

### 3d · Announcements
- [ ] Click "Make Announcement" → select opp → type message → send — PASS — FAIL
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /Make Announcement/i })[22m

  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-058-2026-05-18T13-48-03-555Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-05-18T13-47-27-661Z.zip
  _Expect: all confirmed signups for that opp receive a notification/message_

### 3e · Messages & Notifications
- [ ] Compose message to john@student.edu → appears in Sent — PASS — FAIL
  - Error: Org message to john not present in Sent folder
  - URL: http://127.0.0.1:5174/messages
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-059-2026-05-18T13-48-05-299Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-05-18T13-47-27-661Z.zip
  - Console/Network Logs Snippet:

```text
[2026-05-18T13:48:04.368Z] response: 404 POST http://127.0.0.1:5174/api/messages
[2026-05-18T13:48:04.368Z] console.error: Failed to load resource: the server responded with a status of 404 (Not Found)
```
- [ ] Student's message from 2g appears in Inbox → mark read — PASS — FAIL
  - Error: Student message from item 2g not present in org inbox
  - URL: http://127.0.0.1:5174/messages
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-060-2026-05-18T13-48-06-096Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-05-18T13-47-27-661Z.zip

### 3f · Settings
- [ ] **Profile** · Edit description (500-char limit), website, phone → Save → persists — PASS — FAIL
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^profile$/i })[22m

  - URL: http://127.0.0.1:5174/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-061-2026-05-18T13-48-21-750Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-05-18T13-47-27-661Z.zip
- [ ] **ZIP codes** · Add a ZIP code → appears in list; remove it → gone — PASS — FAIL
  - Error: ZIP input not found in org profile
  - URL: http://127.0.0.1:5174/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-062-2026-05-18T13-48-21-829Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-05-18T13-47-27-661Z.zip
- [ ] **Schools tab** · Search for "Lincoln" → request approval — PASS — FAIL
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^schools$/i })[22m

  - URL: http://127.0.0.1:5174/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-063-2026-05-18T13-48-36-873Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-05-18T13-47-27-661Z.zip
  _Expect: "Pending" status shown; school admin sees request_
- [ ] **Analytics** · Volunteer count and total hours display correctly — PASS — FAIL
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^analytics$/i })[22m

  - URL: http://127.0.0.1:5174/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-064-2026-05-18T13-48-51-939Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-05-18T13-47-27-661Z.zip
- [ ] **Export CSV** · Downloads volunteer data file — PASS — FAIL
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^data$/i })[22m

  - URL: http://127.0.0.1:5174/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-065-2026-05-18T13-49-07-013Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-05-18T13-47-27-661Z.zip
- [ ] **Change password** · Works correctly — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Changing volunteer@greenearth.org password in-suite risks invalidating later required quick-smoke credentials.
  - Manual Step: In Organization Settings > Security, change password and confirm login, then restore seed password for shared test-account continuity.
  - Reason: Changing volunteer@greenearth.org password in-suite risks invalidating later required quick-smoke credentials.
  - Manual Step: In Organization Settings > Security, change password and confirm login, then restore seed password for shared test-account continuity.
- [ ] **Notifications** · Toggle off "New Signup" → save → persists — PASS — FAIL
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^notifications$/i })[22m

  - URL: http://127.0.0.1:5174/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-067-2026-05-18T13-49-22-097Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-05-18T13-47-27-661Z.zip

---

## 4 · School Admin Flow

> **Log in as:** admin@lincoln.edu

### 4a · Onboarding (first-time)
- [ ] On first login (clear `school_onboarding_*` from localStorage), graduation hours goal screen appears — PASS — FAIL
  - Error: Onboarding goal screen did not appear after clearing school_onboarding_* localStorage keys
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-068-2026-05-18T13-49-24-062Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-05-18T13-49-22-197Z.zip
  - Console/Network Logs Snippet:

```text
[2026-05-18T13:49:23.999Z] requestfailed: GET http://127.0.0.1:5174/api/messages/interventions/history?limit=6 -> net::ERR_ABORTED
[2026-05-18T13:49:23.999Z] requestfailed: GET http://127.0.0.1:5174/api/schools/cmpb8t5v90002mupvua6iuln0/students/at-risk -> net::ERR_ABORTED
[2026-05-18T13:49:23.999Z] requestfailed: GET http://127.0.0.1:5174/api/cohorts -> net::ERR_ABORTED
[2026-05-18T13:49:23.999Z] requestfailed: GET http://127.0.0.1:5174/api/messages/notifications/unread-count -> net::ERR_ABORTED
[2026-05-18T13:49:23.999Z] requestfailed: GET http://127.0.0.1:5174/api/messages/notifications/unread-count -> net::ERR_ABORTED
[2026-05-18T13:49:23.999Z] requestfailed: GET http://127.0.0.1:5174/api/schools/cmpb8t5v90002mupvua6iuln0/students/at-risk -> net::ERR_ABORTED
[2026-05-18T13:49:23.999Z] requestfailed: GET http://127.0.0.1:5174/api/cohorts/school-students -> net::ERR_ABORTED
[2026-05-18T13:49:23.999Z] requestfailed: GET http://127.0.0.1:5174/api/cohorts/school-students -> net::ERR_ABORTED
[2026-05-18T13:49:23.999Z] requestfailed: GET http://127.0.0.1:5174/api/auth/me -> net::ERR_ABORTED
[2026-05-18T13:49:23.999Z] requestfailed: GET http://127.0.0.1:5174/api/beneficiaries?status=APPROVED -> net::ERR_ABORTED
[2026-05-18T13:49:24.082Z] console.error: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. /cohorts
[2026-05-18T13:49:24.090Z] console.error: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. /cohorts
```
- [ ] Enter hours (e.g. 40) → Save → lands on Dashboard — PASS — FAIL
  - Error: Continue to Dashboard button not present for onboarding step
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-069-2026-05-18T13-49-24-133Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-05-18T13-49-22-197Z.zip

### 4b · Dashboard
- [ ] School stats: Total Students, Total Hours, Goal Completion %, At Risk count — PASS — FAIL
  - Error: Dashboard stat missing: Total Students
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-070-2026-05-18T13-49-24-231Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-05-18T13-49-22-197Z.zip
- [ ] Classroom grid shows each classroom with: student count, completion count, at-risk count, invite code — PASS — FAIL
  - Error: Classroom grid section missing
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-071-2026-05-18T13-49-24-330Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-05-18T13-49-22-197Z.zip
- [ ] **Copy invite code** · Click copy button → clipboard contains the code — MANUAL REQUIRED — FAIL
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^Copy$/i }).first()[22m

  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-072-2026-05-18T13-49-39-418Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-05-18T13-49-22-197Z.zip
  - Reason: Clipboard API read is unavailable in this run environment.
  - Manual Step: Click copy invite code and manually paste to verify copied code is correct.
- [ ] **Org requests** · Org request from 3f appears in "Pending Requests" → Approve it — PASS — FAIL
  - Error: No pending org request found to approve from step 3f
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-073-2026-05-18T13-49-39-532Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-05-18T13-49-22-197Z.zip
  _Expect: org status → APPROVED; org receives notification_
- [ ] **Reject org** · Reject a different pending org → status → REJECTED — PASS — FAIL
  - Error: No second pending org request found to reject
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-074-2026-05-18T13-49-39-632Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-05-18T13-49-22-197Z.zip
- [ ] **Block org** · Block an approved org → confirmation modal → blocked; org disappears from approved list — PASS — FAIL
  - Error: No approved org available to block
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-075-2026-05-18T13-49-39-733Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-05-18T13-49-22-197Z.zip

### 4c · Groups (Student Management)
- [ ] Left sidebar shows "All Students" + individual classrooms — PASS — FAIL
  - Error: All Students sidebar entry missing
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-076-2026-05-18T13-49-40-518Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-05-18T13-49-22-197Z.zip
  - Console/Network Logs Snippet:

```text
[2026-05-18T13:49:39.995Z] console.error: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. /cohorts
[2026-05-18T13:49:40.001Z] console.error: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. /cohorts
```
- [ ] **Search** · Type student name → list filters — PASS — FAIL
  - Error: Student search input missing
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-077-2026-05-18T13-49-40-619Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-05-18T13-49-22-197Z.zip
- [ ] **Filter: Completed** · Shows only students at/above goal — PASS — FAIL
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /Completed/i })[22m

  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-078-2026-05-18T13-49-55-718Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-05-18T13-49-22-197Z.zip
- [ ] **Filter: At Risk** · Shows students with < 50% of goal — PASS — FAIL
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^At Risk/i })[22m

  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-079-2026-05-18T13-50-10-838Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-05-18T13-49-22-197Z.zip
- [ ] **Filter: Not Started** · Shows 0-hour students — PASS — FAIL
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /Not Started/i })[22m

  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-080-2026-05-18T13-50-25-957Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-05-18T13-49-22-197Z.zip
- [ ] **Select student** · Click a student → right panel shows name, email, hours progress bar, status badge — PASS — FAIL
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /All Students/i })[22m

  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-081-2026-05-18T13-50-56-079Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-05-18T13-49-22-197Z.zip
- [ ] **Send Reminder** · Opens compose window pre-filled with student as recipient — PASS — FAIL
  - Error: Send Reminder button not found
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-082-2026-05-18T13-50-56-205Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-05-18T13-49-22-197Z.zip
- [ ] **View Hour History** · Shows up to 5 sessions; each has date, opp, hours, status — PASS — FAIL
  - Error: View Hour History control not found
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-083-2026-05-18T13-50-56-300Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-05-18T13-49-22-197Z.zip
- [ ] **Remove Hours** · On a VERIFIED session, click Remove → optionally enter reason → confirm — PASS — FAIL
  - Error: Remove Hours action not found on a VERIFIED session
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-084-2026-05-18T13-50-56-401Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-05-18T13-49-22-197Z.zip
  _Expect: session status → REJECTED; student receives email notification; school hours total decreases_

### 4d · Add Staff
- [ ] Click "Add Staff Member" → fill name, email, optional classroom → Submit — PASS — FAIL
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /Add Staff Member/i })[22m

  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-085-2026-05-18T13-51-12-177Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-05-18T13-49-22-197Z.zip
  - Console/Network Logs Snippet:

```text
[2026-05-18T13:50:56.650Z] console.error: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. /cohorts
[2026-05-18T13:50:56.661Z] console.error: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. /cohorts
[2026-05-18T13:50:56.667Z] console.error: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. /cohorts
```
  _Expect: success message with temporary password displayed; new teacher can log in_

### 4e · Settings
- [ ] **Profile** · Edit school name, domain, required hours, ZIP codes → Save → persists — PASS — PASS
- [ ] **Classrooms** · "Create Classroom" → enter name → created; appears in list with invite code — PASS — FAIL
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^classrooms$/i })[22m

  - URL: http://127.0.0.1:5174/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-087-2026-05-18T13-51-29-576Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-05-18T13-49-22-197Z.zip
- [ ] **Data Export** · Export activity log CSV → downloads file with Student, Opportunity, Date, Hours, Status columns — PASS — PASS
- [ ] **Change password** · Works correctly — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Changing admin@lincoln.edu password in-suite can break subsequent seeded login checks and shared test credentials.
  - Manual Step: In School Settings > Security, change password and verify login, then restore seed password before shared quick-smoke runs.
  - Reason: Changing admin@lincoln.edu password in-suite can break subsequent seeded login checks and shared test credentials.
  - Manual Step: In School Settings > Security, change password and verify login, then restore seed password before shared quick-smoke runs.
- [ ] **Notifications** · Toggle off an option → save → persists — PASS — FAIL
  - Error: Admin notification toggle did not persist OFF after refresh
  - URL: http://127.0.0.1:5174/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-090-2026-05-18T13-51-32-315Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-05-18T13-49-22-197Z.zip

---

## 5 · Cross-Role & Edge Cases

> These require switching accounts. Do them last.

- [ ] **Message preference enforcement** · Set student privacy to "Admins Only" → log in as org → attempt to message that student — PASS — FAIL
  - Error: Org-to-student message was not blocked by student privacy Admins Only setting
  - URL: http://127.0.0.1:5174/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-091-2026-05-18T13-51-34-570Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
  _Expect: blocked with "Message preferences do not allow this"_
- [ ] **Audit trail** · School admin views audit log for a session that was approved then had hours removed — PASS — FAIL
  - Error: No audit trail UI found for approved-then-removed session history verification
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-092-2026-05-18T13-51-35-213Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-05-18T13-49-22-197Z.zip
  - Console/Network Logs Snippet:

```text
[2026-05-18T13:51:34.679Z] console.error: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. /cohorts
[2026-05-18T13:51:34.687Z] console.error: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. /cohorts
[2026-05-18T13:51:34.695Z] console.error: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. /cohorts
```
  _Expect: two entries — APPROVE (by org/school) then OVERRIDE (by school)_
- [ ] **Rate limit** · Attempt 6+ signups from same IP within 1 hour — PASS — FAIL
  - Error: No 429 returned after 6+ signup attempts. Statuses: 400, 400, 400, 400, 400, 400, 400
  - URL: n/a
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-093-2026-05-18T13-51-35-379Z.png
  - Trace: n/a
  _Expect: 429 "Too many signup attempts"_
- [ ] **Expired verification token** · Use a verify-email link older than 24h — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Token-expiry >24h cannot be time-traveled from UI and no exposed admin control was found to mint an already-expired verification token.
  - Manual Step: Generate a verification token, wait past 24 hours (or use backend/admin tooling to mint expired token), then open link and confirm "Invalid or expired verification token".
  - Reason: Token-expiry >24h cannot be time-traveled from UI and no exposed admin control was found to mint an already-expired verification token.
  - Manual Step: Generate a verification token, wait past 24 hours (or use backend/admin tooling to mint expired token), then open link and confirm "Invalid or expired verification token".
  _Expect: "Invalid or expired verification token" error_
- [ ] **Resend verification** · On email verification screen, click "Resend" → new email arrives — PASS — FAIL
  - Error: Volunteer signup role selector not found on /signup
  - URL: http://127.0.0.1:5174/signup
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-095-2026-05-18T13-51-35-963Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/auth-flow-2026-05-18T13-40-27-710Z.zip
  _Expect: new email in inbox; old token no longer works_

---

## 6 · Quick Smoke (post-deploy)

> Run after every deploy. Should take < 5 min.

- [ ] `GET /api/health` returns `{"status":"ok"}` — PASS — PASS
- [ ] Login as john@student.edu → Dashboard loads with no errors — PASS — PASS
- [ ] Browse page loads opportunities — PASS — FAIL
  - Error: Browse page did not load opportunities in quick smoke
  - URL: http://127.0.0.1:5174/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-098-2026-05-18T13-51-39-001Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/quick-john-2026-05-18T13-51-36-026Z.zip
  - Console/Network Logs Snippet:

```text
[2026-05-18T13:51:38.463Z] response: 404 GET http://127.0.0.1:5174/api/schools/my-rules
[2026-05-18T13:51:38.463Z] console.error: Failed to load resource: the server responded with a status of 404 (Not Found)
[2026-05-18T13:51:38.471Z] response: 404 GET http://127.0.0.1:5174/api/schools/my-rules
[2026-05-18T13:51:38.471Z] console.error: Failed to load resource: the server responded with a status of 404 (Not Found)
```
- [ ] Login as volunteer@greenearth.org → Opportunities list loads — PASS — FAIL
  - Error: Org opportunities list did not load in quick smoke
  - URL: http://127.0.0.1:5174/opportunities
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-099-2026-05-18T13-51-41-480Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/quick-org-2026-05-18T13-51-39-103Z.zip
- [ ] Login as admin@lincoln.edu → Dashboard stats load — PASS — PASS
- [ ] No console errors on any of the above pages — PASS — FAIL
  - Error: Console errors found on smoke pages:
Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. /cohorts
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-101-2026-05-18T13-51-43-912Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/quick-admin-2026-05-18T13-51-41-589Z.zip
