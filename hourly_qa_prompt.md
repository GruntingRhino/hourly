# Hourly App — Full QA & Deployment Readiness Audit

You are a senior QA engineer. Your job is to verify that the Hourly app is completely ready for production deployment. You are not building anything new — you are stress-testing everything that exists. Be ruthless. Assume nothing works until you have personally confirmed it does.

Do not stop until every single item in this document is verified. If something is broken, fix it and re-verify. At the end, produce a deployment readiness report.

---

## Environment

- Frontend: `localhost:5173`
- Prisma Studio: `localhost:5555`
- Use Chrome for all UI testing
- Check terminal logs throughout for server errors

---

## Ground Rules

- Never assume something works because the code looks correct. You must see it work in the browser with real data in the database.
- Never skip a step. If a feature requires setup (e.g. a classroom must exist before a student can join), do the setup first.
- After every significant action in the browser, open Prisma Studio at `localhost:5555` and confirm the correct data was written.
- Watch the browser console and network tab throughout. Any 4xx, 5xx, or unhandled JS errors must be fixed before proceeding.
- After fixing anything, re-test the thing you just fixed plus anything that might be related.
- Run two full consecutive passes of the entire checklist. Only report done after both passes are clean.

---

## Phase 1 — Environment & Code Health

### 1.1 Server & Build
- [ ] `npm run dev` starts without errors
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] No ESLint errors (`npx eslint .`)
- [ ] All environment variables are set and correct in `.env`
- [ ] Prisma schema is in sync with database (`npx prisma migrate status` shows no pending migrations)
- [ ] `npx prisma generate` runs without errors
- [ ] Prisma Studio opens at `localhost:5555` and all tables are visible

### 1.2 Database Health
- [ ] All expected tables exist in Prisma Studio: User, Student, School, Organization, Classroom, Opportunity, HourSubmission, ApprovedOrg, BlockedOrg, Message, Notification — and any others in the schema
- [ ] No orphaned records or broken foreign key relationships
- [ ] All required fields have proper constraints (NOT NULL where appropriate)
- [ ] Indexes exist on foreign keys and frequently queried fields

### 1.3 Dependencies
- [ ] `zipcodes` package is installed and resolves a ZIP code correctly (test in Node: `require('zipcodes').lookup('02101')` returns lat/lng)
- [ ] `geolib` package is installed and `getDistance` works correctly
- [ ] No `npm audit` critical vulnerabilities

---

## Phase 2 — Account Creation & Auth

### 2.1 Create a School Account
- [ ] Navigate to Get Started → School
- [ ] Fill in: School Name "Lincoln High School", Email `owner@lincoln.edu`, Password `TestPass123!`, ZIP `02101`
- [ ] Submit — confirmation screen appears
- [ ] Verify email (simulate or use real link)
- [ ] After verification: prompted to set graduation hours goal (enter 40)
- [ ] Goal saved — check Prisma Studio: School record exists with correct name, ZIP, and hoursGoal = 40
- [ ] Redirected to School Dashboard

### 2.2 Create an Organization Account
- [ ] Navigate to Get Started → Organization
- [ ] Fill in: Org Name "Boston Food Bank", Email `contact@bfb.org`, Password `TestPass123!`, ZIP codes `02101, 02102`, Collaborators left empty
- [ ] Submit, verify email, access dashboard
- [ ] Check Prisma Studio: Organization record exists with correct ZIP codes

### 2.3 Create a Student Account
- [ ] Navigate to Get Started → Student
- [ ] Fill in: Name "Jane Doe", Email `jane@student.com`, Age 16, Password `TestPass123!`
- [ ] Submit, verify email
- [ ] After verification: holding state appears — blank screen with only a code input field, nothing else visible
- [ ] Check Prisma Studio: Student record exists, classroomId is null

### 2.4 Sign In / Sign Out
- [ ] Sign out of all accounts
- [ ] Sign in with each account type — each routes to the correct dashboard
- [ ] Wrong password shows an error message
- [ ] Unverified email blocked from dashboard access
- [ ] Password reset flow works end-to-end

### 2.5 Edge Cases
- [ ] Duplicate email on sign-up shows a clear error
- [ ] Empty required fields show validation errors
- [ ] SQL injection attempt in name/email field is safely handled (does not crash or expose data)
- [ ] Very long strings in fields don't break layout or database write

---

## Phase 3 — School Owner Flow

### 3.1 Dashboard
- [ ] School-wide stats visible: total hours, % on track, at-risk count, graduation goal completion
- [ ] Stats show 0 correctly when no students exist yet (no broken UI)
- [ ] Per-classroom summary cards render (empty state handled gracefully)

### 3.2 Classroom Creation
- [ ] Owner creates a classroom named "Period 3 Homeroom"
- [ ] Classroom auto-generates a unique code — code is displayed and copyable
- [ ] Check Prisma Studio: Classroom record exists, linked to School, has a code, owner is listed as admin
- [ ] Owner creates a second classroom "NHS Club" — second code is different from the first
- [ ] Both classrooms appear in the owner's dashboard

### 3.3 Owner Acting as Admin
- [ ] Owner can enter a classroom and see the classroom dashboard (stats, roster)
- [ ] Owner can perform admin actions (send reminder, remove hours) within any classroom

### 3.4 Approved Orgs
- [ ] Owner can search for "Boston Food Bank" by name
- [ ] Owner can add it to the Approved Orgs list
- [ ] Check Prisma Studio: ApprovedOrg record links School to Organization
- [ ] Owner can remove an org from the list — record is deleted in database
- [ ] Owner can block an org — check Prisma Studio: BlockedOrg record exists
- [ ] Blocked org's opportunities do not appear for school's students (verify in student browse view)
- [ ] Org is not notified of the block

### 3.5 Org Approval Requests
- [ ] Log in as Organization, find Lincoln High School, send an approval request
- [ ] Log in as School Owner — notification or inbox item shows the request
- [ ] Owner approves — org appears in Approved list, Prisma Studio shows record
- [ ] Owner denies a second test request — org is not added to list

### 3.6 Hours Goal
- [ ] Owner changes the graduation hours goal from 40 to 50 in Settings
- [ ] Student dashboard progress indicator updates to reflect 50 as the new goal
- [ ] Only owner can see and change this setting (not classroom admin)

### 3.7 Role Transfer — Owner
- [ ] Owner initiates transfer to another school member
- [ ] Explicit warning prompt appears: "You will lose all access. This cannot be undone."
- [ ] Owner confirms — previous owner account is immediately locked out of school dashboard
- [ ] New owner has full access
- [ ] Attempt to access school dashboard with old owner credentials is blocked

### 3.8 School Settings
- [ ] Change Password works
- [ ] ZIP codes are editable and saved
- [ ] Notification toggles save state correctly (check database)
- [ ] Export activity log produces a valid CSV or PDF file
- [ ] Log Out terminates session and redirects to landing page

---

## Phase 4 — Classroom Admin Flow

### 4.1 Classroom Dashboard
- [ ] Admin sees only their classroom (not other classrooms)
- [ ] Stats: total hours, % on track, at-risk count, goal completion — all accurate
- [ ] Empty state (no students yet) handled gracefully

### 4.2 Student Roster
- [ ] After Jane Doe joins (done in Phase 5), she appears in the roster
- [ ] Filter by: All, Completed, On Track, At Risk, Not Started — each returns correct results
- [ ] Search by name works
- [ ] Per-student row shows: name, verified hours vs goal, pending hours, Last Activity

### 4.3 Student Actions
- [ ] Send Reminder to a student — student receives a notification
- [ ] View Hour History — shows all hour submissions for that student
- [ ] Remove Hours — removes a verified hour entry, student is notified, Prisma Studio reflects the change

### 4.4 Role Transfer — Admin
- [ ] Admin initiates transfer request
- [ ] Owner receives the request (notification or inbox)
- [ ] Owner approves — admin loses classroom access immediately
- [ ] New admin has classroom access
- [ ] Owner denies a test request — admin retains access

### 4.5 Notifications
- [ ] Admin receives notification when a student leaves the classroom
- [ ] Notification includes student name

---

## Phase 5 — Student Flow

### 5.1 Holding State
- [ ] Jane Doe sees only the code input screen after verification
- [ ] Enter an invalid code — "Invalid code" message appears, input clears, can retry
- [ ] Enter the correct code for "Period 3 Homeroom" — Jane is enrolled
- [ ] Check Prisma Studio: Jane's Student record now has classroomId set correctly
- [ ] Jane is redirected to her full dashboard

### 5.2 Dashboard
- [ ] Committed Hours, Verified Hours, Activities Done all show 0 initially
- [ ] Progress bar toward 40-hour goal shows correctly (0/40)
- [ ] Upcoming Events list is empty initially — empty state handled gracefully
- [ ] After signing up for an opportunity (done later), the event appears in upcoming events

### 5.3 Browse Opportunities

First, create at least two opportunities as the Organization:
- Opportunity A: "Food Drive", tags: [community, food], ZIP 02101, 10 slots
- Opportunity B: "Park Cleanup", tags: [environment], ZIP 90210 (far away), 5 slots

Then as Jane:
- [ ] Browse screen loads with opportunities displayed
- [ ] Boston Food Bank (approved org) appears before the far-away org
- [ ] Opportunities sorted by distance within non-approved results
- [ ] Swipe right on Food Drive — it appears in Saved Opportunities tab
- [ ] Swipe left on another — it appears in Skipped/Discarded tab
- [ ] Skipped/Discarded tab: can recover a discarded item
- [ ] Filter by tag "environment" — only Park Cleanup appears
- [ ] Filter by "Approved Orgs only" — only Boston Food Bank opportunities appear
- [ ] Filter by distance radius — adjusting range includes/excludes far-away org correctly
- [ ] Signing up for an event creates a participant record in Prisma Studio

### 5.4 Hour Submission
- [ ] After attending an event, Jane submits hours for "Food Drive": 4 hours
- [ ] Check Prisma Studio: HourSubmission record exists with status "pending"
- [ ] Log in as Organization — approval request appears: "Jane Doe asked for approval of 4 hours at Food Drive"
- [ ] Org approves — HourSubmission status changes to "verified" in Prisma Studio
- [ ] Jane's Verified Hours stat on dashboard increments to 4
- [ ] Jane receives a notification: "[Boston Food Bank] approved your hours"

### 5.5 Hour Removal by School
- [ ] Log in as classroom admin — Jane's roster row shows 4 verified hours
- [ ] Admin removes the 4 hours
- [ ] Jane's Verified Hours drops back to 0 on her dashboard
- [ ] Jane receives a notification that her hours were removed
- [ ] Prisma Studio: HourSubmission status updated or record reflects removal

### 5.6 Switching Classrooms
- [ ] Jane leaves "Period 3 Homeroom" and enters the code for "NHS Club"
- [ ] Period 3 admin receives notification: "Jane Doe has left the classroom"
- [ ] Jane's verified hours carry over to NHS Club (hours are not reset)
- [ ] NHS Club admin can see Jane's full hour history
- [ ] Check Prisma Studio: Jane's classroomId updated correctly

### 5.7 Profile
- [ ] All fields display correctly
- [ ] Edit Profile saves changes — check Prisma Studio
- [ ] Change Photo uploads and displays correctly
- [ ] Current classroom shows "NHS Club" (updated after switch)
- [ ] Social links are clickable

### 5.8 Settings
- [ ] All notification toggles save state
- [ ] Privacy: change to Public — verify setting saved in database
- [ ] Change Password works
- [ ] Export activity log works
- [ ] Delete Account: enter email, confirm warning, account deleted — user cannot log back in, Prisma Studio shows record removed or marked deleted

---

## Phase 6 — Organization Flow

### 6.1 Dashboard
- [ ] Recent Activity Feed shows real events (Jane's sign-up, hour request)
- [ ] Create Opportunity and Make Announcement buttons work

### 6.2 Opportunity Management
- [ ] Create Opportunity with all fields filled — saved to database
- [ ] Recurring toggle saves state
- [ ] Tags are multi-select and addable
- [ ] Edit Details updates the record in database
- [ ] Opportunity appears in student browse view after creation

### 6.3 Messages
- [ ] Inbox shows messages from Jane (sent in next step)
- [ ] Filter by students / schools / organizations works
- [ ] Priority flag can be toggled on a message
- [ ] Compose and send a reply — Jane receives it
- [ ] Jane can compose and send a message to the org — org receives it
- [ ] Check Prisma Studio: Message records exist with correct sender/receiver/timestamps

### 6.4 School Relationship
- [ ] Org can search for schools by name and ZIP
- [ ] Org sends approval request to Lincoln High School
- [ ] After owner approves, school shows in org's "Approved Schools" list

### 6.5 Settings
- [ ] All settings save correctly
- [ ] Analytics section loads without errors (even if data is sparse)
- [ ] Volunteer data export produces a valid file
- [ ] Add/Remove Collaborators works — new collaborator can log in with their own credentials and access the org dashboard

---

## Phase 7 — Cross-Role & Integration Tests

- [ ] A student's hours goal progress updates in real time as hours are approved
- [ ] School dashboard stats update when a new student joins a classroom
- [ ] Blocking an org actually hides their opportunities from all students in that school (test with two different student accounts)
- [ ] Approved org's opportunities appear at the top for students in the approving school, but not for students in a different school
- [ ] Distance sorting: create an org with a ZIP far from the school — confirm it sorts below the nearby approved org
- [ ] Notification system: every triggered notification type has been received and displayed at least once during this audit
- [ ] Email notifications: verify at least one email notification is sent and received correctly
- [ ] All navigation routes resolve — no 404s on any page within the app
- [ ] Browser back/forward buttons do not break app state
- [ ] Refreshing the page on any route keeps the user logged in and on the correct page
- [ ] App works correctly at mobile viewport width (375px) and desktop (1280px)

---

## Phase 8 — Security & Edge Cases

- [ ] Unauthenticated user trying to access `/dashboard` is redirected to sign in
- [ ] Student trying to access org dashboard URL directly is blocked
- [ ] Org trying to access school dashboard URL directly is blocked
- [ ] Classroom admin trying to access another classroom's URL directly is blocked
- [ ] API routes return 401/403 for unauthorized requests (test with browser DevTools network tab)
- [ ] Passwords are not stored in plaintext — check Prisma Studio: password field should be a hash
- [ ] Tokens/sessions expire correctly — expiring a session manually redirects to sign in
- [ ] No sensitive data (passwords, tokens) visible in browser local storage or URL params
- [ ] File uploads (profile photos) are validated — attempt to upload a non-image file and confirm rejection
- [ ] Large file upload is rejected with a clear error
- [ ] All forms have CSRF protection or equivalent

---

## Phase 9 — Performance & Stability

- [ ] Initial page load under 3 seconds on localhost
- [ ] No memory leaks visible in Chrome DevTools Performance tab after navigating through multiple pages
- [ ] Database queries are not doing full table scans on large datasets — check Prisma query logs for N+1 issues
- [ ] App does not crash when database returns empty results for any query
- [ ] App handles a network error gracefully (disable network in DevTools — should show an error state, not a blank screen or crash)

---

## Phase 10 — Deployment Readiness Checklist

- [ ] All `.env` variables are documented in a `.env.example` file with no real secrets
- [ ] `NODE_ENV=production` build runs without errors (`npm run build`)
- [ ] Production build serves correctly (preview it with `npm run preview`)
- [ ] No hardcoded `localhost` URLs in the codebase — all API URLs use environment variables
- [ ] Database connection string uses environment variable, not hardcoded
- [ ] Prisma migrations folder is committed and complete
- [ ] No `console.log` debug statements left in production code
- [ ] Error boundaries exist in the React app — a component crash does not take down the entire page
- [ ] 404 page exists for unknown routes
- [ ] All third-party packages (`zipcodes`, `geolib`, etc.) are in `dependencies`, not `devDependencies`

---

## Final Deliverable

After completing two consecutive clean passes, produce a report in this format:

```
## Hourly App — Deployment Readiness Report

**Date:** [today]
**Passes completed:** 2
**Total issues found:** [n]
**Total issues fixed:** [n]
**Remaining issues:** [list any, or "None"]

### Verified Features
[list every major feature confirmed working]

### Database State
[confirm all tables have correct data]

### Known Limitations
[anything intentionally deferred or not fully implemented]

### Deployment Recommendation
[Ready / Not Ready — and why]
```
