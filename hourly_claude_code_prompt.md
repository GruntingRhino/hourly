# Hourly App — Build & Verification Prompt

You are building and verifying the Hourly app to production-ready state. Your job is to check every functionality listed below against the running app at `localhost:5173`, implement anything missing, then verify again. Repeat until every item is confirmed working. Do not stop until the app is deployment-ready.

---

## Stack Context

- Frontend: React + Vite at `localhost:5173`
- Database: PostgreSQL via Prisma ORM
- Prisma Studio: `localhost:5555`
- Use Chrome via browser automation to navigate and test the UI
- For ZIP code geocoding, use the `zipcodes` npm package (free, offline, no API key, US zip codes to lat/lng). If distance calculations are needed between coordinates use the `geolib` npm package. Both are free and require no external API calls.

---

## Process

Follow this loop until the app is deployment-ready:

1. **Check** — Open Chrome, navigate to `localhost:5173`, and audit the current state of the app against the functionality list below
2. **Implement** — For every missing or broken feature, implement it fully: schema changes, API routes, UI components, navigation, state management
3. **Migrate** — After any Prisma schema change, run `npx prisma migrate dev` and `npx prisma generate`
4. **Verify in browser** — Use Chrome to navigate through the implemented feature and confirm it works end-to-end
5. **Check database** — Open `localhost:5555` (Prisma Studio) to verify data is being written and read correctly after each feature
6. **Create test accounts** — Create at least one account of each type (Student, Organization, School) and exercise every flow for each role
7. **Check for errors** — Watch the browser console, terminal logs, and network tab for errors. Fix everything before moving on
8. **Repeat from step 1** — After completing a pass, start over from the top and re-audit until nothing is missing

---

## Test Accounts to Create and Verify

Create these accounts and verify all flows work for each:

**School Owner**
- School Name: Lincoln High School
- Email: owner@lincoln.edu
- Password: TestPass123!
- ZIP: 02101
- Graduation hours goal: 40

**Classroom Admin** (created by the owner after school setup)
- Name: Mr. Johnson
- Email: admin@lincoln.edu
- Classroom: "Period 3 Homeroom"

**Student**
- Name: Jane Doe
- Email: jane@student.com
- Age: 16
- Password: TestPass123!
- Join the classroom created above using the generated code

**Organization**
- Org Name: Boston Food Bank
- Email: contact@bfb.org
- Password: TestPass123!
- ZIP codes: 02101, 02102

---

## Full Functionality Checklist

Work through every item below. Mark nothing as done until it is verified working in Chrome with real data in the database.

---

### 1. Landing Page
- [ ] App name and branding displayed (Hourly)
- [ ] Subheading and app description
- [ ] Three value propositions: For Students, For Schools, For Non-Profits
- [ ] Sign In button (routes to sign in)
- [ ] Get Started button (routes to role selection)
- [ ] Footer with Help & Support and Terms/Privacy

---

### 2. Sign Up Flow

#### 2.1 Role Selection
- [ ] Three role cards: Student, Organization, School
- [ ] Each routes to the correct sign-up form

#### 2.2 Student Sign Up
- [ ] Fields: Name, Email, Age, Password
- [ ] No school/classroom selection at sign-up
- [ ] On submit: creates account, sends verification email, routes to email verification screen

#### 2.3 Organization Sign Up
- [ ] Fields: Organization Name, Email, Password, Collaborators (optional)
- [ ] ZIP code input (one or more) for proximity targeting
- [ ] On submit: creates account, sends verification email

#### 2.4 School Sign Up
- [ ] Fields: School Name, Email, Password
- [ ] ZIP code input (one or more)
- [ ] On submit: creates account, sends verification email
- [ ] After verification: prompt to set graduation hours goal before accessing dashboard
- [ ] Goal is saved to the school record in the database

#### 2.5 Email Verification
- [ ] Verification email sent on sign-up
- [ ] Dashboard access blocked until email is verified
- [ ] Clicking the link in the email marks the account as verified and routes to the correct dashboard/holding state

---

### 3. Student

#### 3.1 Holding State
- [ ] After email verification, student sees a blank screen with only a classroom code input
- [ ] Code is validated against existing classrooms in the database
- [ ] Invalid code shows "Invalid code" message
- [ ] Valid code enrolls the student in the classroom and routes to dashboard
- [ ] Student record in database is linked to the classroom

#### 3.2 Home / Dashboard
- [ ] Stats bar: Committed Hours, Verified Hours, Activities Done — all pulling live from database
- [ ] Progress bar or indicator toward graduation hours goal
- [ ] Upcoming Events list sorted by date
- [ ] Each event row shows: date/time range, activity title, address, slots filled (e.g. 5/10)
- [ ] Clicking an event expands it inline with: description, tags, location, time, volunteers needed, age requirement

#### 3.3 Browse Opportunities
- [ ] Swipe card view available (mobile layout): swipe right = save, left = discard, down = skip
- [ ] Filter / List view available (desktop layout)
- [ ] Filter options: tags (multi-select), distance radius, approved orgs only toggle
- [ ] Ordering: approved orgs (from student's school) appear first, then remaining orgs sorted by distance from school ZIP using `zipcodes` + `geolib`
- [ ] Saved Opportunities tab showing right-swiped events
- [ ] Skipped/Discarded tab showing those events, recoverable
- [ ] Signing up for an event saves the student as a participant in the database

#### 3.4 Messages
- [ ] Inbox with sender name and message preview
- [ ] Student can compose and send messages to organizations
- [ ] Inline notifications for hour approvals and removals

#### 3.5 Profile
- [ ] Displays: profile picture, Name, Email, Phone, Biography
- [ ] Social links: Instagram, TikTok, Twitter, YouTube
- [ ] Hours Signed Up For
- [ ] Current classroom (read-only)
- [ ] Edit Profile form: Name, Grade, Description, Change Photo

#### 3.6 Switching Classrooms
- [ ] Student can leave current classroom from profile or settings
- [ ] Prompted to enter a new classroom code
- [ ] Verified hours carry over (not reset)
- [ ] Previous classroom admin receives notification: "[Student Name] has left the classroom"
- [ ] New classroom admin can see student's full hour history

#### 3.7 Settings
- [ ] Security: Change Password, 2-Factor Authentication
- [ ] Notifications (all on by default): event reminders, event changes, hour approved/removed, weekly summary, task assignments, weekly activity summary — each with Email / In-App toggle
- [ ] Privacy: Profile Visibility (Public / School-only, default School-only)
- [ ] Messages: Allow messages from (Everyone / Organizations / Admins / All Staff, default Everyone)
- [ ] Data: Export activity log (CSV / PDF), Delete account with email confirmation and permanent warning
- [ ] Log Out

---

### 4. Organization

#### 4.1 Dashboard
- [ ] Recent Activity Feed with live data (sign-ups, hour requests, events)
- [ ] Create Opportunity quick action button
- [ ] Make Announcement quick action button

#### 4.2 My Opportunities
- [ ] List of all org's opportunities with Edit Details per item
- [ ] Create Opportunity form: Event Name, Location, Date, Recurring toggle, Time, Volunteers Needed, Age Requirement, Tags (multi-select/addable), Description, Select More for additional fields
- [ ] Created opportunities saved to database and visible to students

#### 4.3 Hour Approval
- [ ] Incoming hour requests listed: "[Student] asked for approval of N hours at [Event]"
- [ ] Approve action marks hours as Verified on the student's profile in the database
- [ ] Approved hours are immediately reflected on the student's dashboard
- [ ] Classroom admin and school owner can remove those verified hours
- [ ] Student receives a notification when hours are removed

#### 4.4 Messages
- [ ] Inbox with messages from students, schools, and other organizations
- [ ] Filter/sort inbox by sender type: students / schools / organizations
- [ ] Priority flag on messages
- [ ] New Message composer

#### 4.5 School Relationship Management (Approved Orgs)
- [ ] Org can search for schools and request to be added to a school's Approved Orgs list
- [ ] Org can see which schools have approved them
- [ ] If a school blocks the org, its opportunities do not appear for that school's students (no notification to org)

#### 4.6 Profile
- [ ] Organization Name, Email, Phone, Description
- [ ] Target ZIP codes (editable, used for proximity sorting)
- [ ] Social links
- [ ] Edit Profile

#### 4.7 Settings
- [ ] Security: Change Password, 2FA, Add/Remove Collaborators
- [ ] Notifications: new student sign-ups, hour approval requests, school approval requests — Email / In-App toggle
- [ ] Messages: Who can send (Everyone / Organizations / Schools, default Everyone), Archive after N months
- [ ] Analytics: message engagement/response time, average response time, most active students
- [ ] Privacy (Public by default): Default visibility (Public / Schools-only / Invite-only), Profile Visibility
- [ ] Data: Volunteer data export
- [ ] Log Out

---

### 5. School

#### 5.1 Roles and Permissions
- [ ] Owner has full school visibility: all classrooms, all stats, Approved Orgs management, hours goal setting
- [ ] Owner can act as admin in any classroom
- [ ] Classroom admin is scoped to their classroom only
- [ ] Creator of a classroom automatically becomes its admin
- [ ] Owner can transfer owner role to another school member — on confirmation (with explicit warning), previous owner loses ALL school access entirely
- [ ] Classroom admin can request to transfer their admin role — request requires owner approval — on approval, previous admin loses ALL classroom access entirely
- [ ] Both transfer flows prompt with a confirmation warning before executing

#### 5.2 School Dashboard (Owner view)
- [ ] School-wide stats: total hours, % students on track, at-risk count, graduation goal completion (e.g. 315/350)
- [ ] Per-classroom summary cards: classroom name, admin name, student count, completion %, at-risk count
- [ ] View On-Track Students (school-wide filtered list)
- [ ] View Off-Track Students (school-wide filtered list)

#### 5.3 Classroom Management
- [ ] Owner can create a classroom
- [ ] Classroom auto-generates a unique code (lowercase letters + numbers) on creation
- [ ] Code is displayed and copyable from classroom settings
- [ ] Owner sees all classrooms; classroom admin only sees their own
- [ ] Admin transfer flow: admin requests transfer → owner approves → previous admin loses access

#### 5.4 Classroom Dashboard (Admin view)
- [ ] Classroom-level stats: total hours, % on track, at-risk count, goal completion
- [ ] Student Roster: searchable, filterable by All / Completed / On Track / At Risk / Not Started
- [ ] Per-student row: name, verified hours vs goal, hours pending, Last Activity date
- [ ] Per-student actions: Send Reminder, View Hour History, Remove Hours
- [ ] Admin receives notification when a student leaves the classroom

#### 5.5 Approved Orgs (Owner only)
- [ ] Owner can search for orgs by name or ZIP code
- [ ] Owner can add an org to the Approved list
- [ ] Owner receives and can approve/deny incoming org requests
- [ ] Owner can block an org — blocked org's opportunities hidden from all school students
- [ ] Approved orgs appear first in student opportunity browsing

#### 5.6 Hour Management
- [ ] Owner can remove verified hours for any student school-wide
- [ ] Classroom admin can remove verified hours for students in their classroom only
- [ ] Removal triggers a notification to the student

#### 5.7 Messages
- [ ] Owner can message any student, admin, or org
- [ ] Admin can message students in their classroom and orgs
- [ ] At-risk alerts received by admin/owner
- [ ] Org approval requests received by owner only

#### 5.8 Settings
- [ ] School: Graduation hours goal (owner only, changeable), School ZIP codes (owner only)
- [ ] Notifications: new student joins classroom, student leaves classroom, hour activity, org approval requests (owner only), weekly summary — Email / In-App toggle
- [ ] Messages: who can send, organize messages preference
- [ ] Privacy: Profile Visibility, Location Sharing
- [ ] Data: Export activity log (CSV / PDF)
- [ ] Log Out

---

## ZIP Code / Geocoding Implementation Notes

- Install: `npm install zipcodes geolib`
- Use `zipcodes.lookup(zipCode)` to get `{ latitude, longitude }` for any US ZIP
- Use `geolib.getDistance({ latitude, longitude }, { latitude, longitude })` to compute distance in meters between two points
- Convert to miles: `meters / 1609.34`
- Apply this in the opportunity browsing sort: compute distance between org's ZIP centroid and school's ZIP centroid, sort ascending
- No API key, no rate limits, fully offline

---

## Database Verification Checklist (Prisma Studio at localhost:5555)

After creating test accounts and exercising flows, verify the following in Prisma Studio:

- [ ] Student record exists and is linked to a classroom
- [ ] Classroom record exists and is linked to a school, has a generated code
- [ ] School record has hours goal set and ZIP codes stored
- [ ] Organization record has ZIP codes stored
- [ ] Opportunity records exist and are linked to the org
- [ ] Hour submission records exist with correct status (pending / verified / removed)
- [ ] Approved Orgs relationship exists between school and org
- [ ] Block relationship exists if a block was applied
- [ ] Messages stored with correct sender/receiver references
- [ ] Notification records exist for triggered events

---

## Definition of Done

The app is deployment-ready when:
1. Every checkbox above is ticked and verified in Chrome with live data
2. No console errors, no network 4xx/5xx errors during normal use
3. All three test account types can complete their full flows end-to-end
4. Prisma Studio shows clean, correctly structured data for all flows
5. A full re-audit pass produces zero missing or broken items
