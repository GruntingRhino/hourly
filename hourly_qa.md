# GOODHOURS — ATOMIC PARITY QA SPECIFICATION
## Version: Enterprise-Grade Feature Parity Validation
## Objective: 100% Functional Traceability to Original Feature List

This QA specification guarantees that **every single functionality defined in the original GoodHours master list is tested — no more, no less — at atomic granularity.**

Claude Code CLI must not stop until:
- Every item is validated.
- Every conditional branch is tested.
- Every toggle permutation is enforced.
- Every permission boundary is validated.
- Full suite passes twice consecutively.

No functionality may be skipped.
No functionality may be assumed.
No functionality may be bundled into generic testing.

Legend: [x] = PASS  [~] = FAIL/NOT IMPLEMENTED  [ ] = pending

---

# SECTION 0 — GLOBAL SYSTEM FOUNDATION

## 0.1 Branding & Landing Page

- [x] App name "GoodHours" visible
- [x] Subheading description visible
- [x] Student value proposition visible
- [x] School value proposition visible
- [x] Non-Profit value proposition visible
- [x] Sign In button routes correctly
- [x] Get Started button routes to role selection
- [x] Footer includes Help link
- [x] Footer includes Terms link
- [x] Footer includes Privacy link

---

## 0.2 Authentication

- [x] Student signup works
- [x] Organization signup works
- [x] School signup works
- [x] Student signup fields validated (Name, Email, Age, Password)
- [x] Org signup fields validated (Org Name, Email, Password, Zip Codes)
- [x] School signup fields validated (School Name, Email, Password, Zip Codes)
- [x] Email verification email sent
- [x] Dashboard blocked before verification
- [~] Verification activates account
- [x] Login works
- [x] Logout works
- [x] Password reset works
- [~] 2FA works if enabled

---

## 0.3 Role-Based Access Control

- [x] Student cannot access org routes
- [x] Student cannot access school routes
- [x] Org cannot access school dashboards
- [x] Classroom admin cannot access other classrooms
- [x] Owner can access all classrooms
- [x] Owner can act as admin in any classroom
- [x] No cross-school data visibility
- [x] No cross-classroom data leakage

---

# SECTION 1 — STUDENT FLOW (FULL ATOMIC COVERAGE)

## 1.1 Holding State

- [~] Holding screen appears after verification
- [x] Single classroom code input exists
- [x] Code only accepts lowercase letters + numbers
- [x] Invalid code displays error
- [x] Retry allowed
- [x] Student blocked if no classroom exists
- [x] Valid code enrolls student
- [x] Enrollment persists in database

---

## 1.2 Student Dashboard

### Stats Bar

- [x] Committed Hours accurate
- [x] Verified Hours accurate
- [x] Activities Done accurate

### Graduation Progress

- [x] School-wide goal pulled correctly
- [x] Progress percentage accurate

### Upcoming Events List

- [~] Sorted by date
- [x] Row shows date/time range
- [x] Row shows title
- [x] Row shows address
- [x] Row shows slots filled

### Event Expand View

- [x] Description visible
- [x] Tags visible
- [x] Location visible
- [x] Time visible
- [x] Volunteers needed visible
- [~] Age requirement visible
- [~] Custom org-defined fields visible

---

## 1.3 Browse Opportunities

### Ordering Logic

- [x] Approved orgs appear first
- [x] Remaining sorted by distance
- [x] Distance calculated from school zip
- [~] Distance filter works

### Swipe (Mobile)

- [~] Swipe right saves
- [~] Swipe left discards
- [~] Swipe down skips
- [x] Card shows event name
- [x] Card shows org name
- [x] Card shows description
- [x] Card shows location
- [x] Card shows time
- [x] Card shows slots filled

### Desktop Filters

- [x] Filter by tags
- [~] Filter by distance radius
- [x] Filter approved-only
- [x] Expand event detail
- [x] Sign up button works

### Saved / Discarded / Skipped

- [x] Saved tab loads
- [~] Discarded tab loads
- [x] Skipped tab loads
- [~] Recover discarded event works

---

## 1.4 Event Participation

- [x] Student signs up
- [x] Slots decrement correctly
- [x] Event appears in Upcoming
- [x] Student submits hours
- [x] Org receives request
- [x] Org approves → Verified immediately
- [x] Verified reflects in stats
- [x] Admin removes hours
- [x] Student notified on removal

---

## 1.5 Student Messaging

- [x] Inbox loads
- [x] Sender preview visible
- [x] New message composer works
- [x] Subject field required
- [x] Body field required
- [x] Send works
- [~] Hour approval inline notification
- [~] Hour removal inline notification

---

## 1.6 Student Profile

- [~] Profile picture upload works
- [x] Name editable
- [x] Email visible
- [x] Phone editable
- [x] Biography editable
- [~] Instagram link saves
- [~] TikTok link saves
- [~] Twitter link saves
- [~] YouTube link saves
- [~] Hours signed up visible
- [x] Classroom displayed read-only
- [~] Grade editable

---

## 1.7 Switching Classrooms

- [x] Leave classroom works
- [x] Previous admin notified
- [x] Enter new code works
- [x] Verified hours carry over
- [x] New admin sees full hour history

---

## 1.8 Student Settings (Toggle-Level Validation)

### Security

- [x] Change password works
- [~] 2FA toggle works

### Notifications (ALL individually validated)

- [~] Event reminder timing persists
- [~] Event change notification works
- [~] Hour approval notification works
- [~] Hour removal notification works
- [~] Weekly summary works
- [~] Task assignment alert works
- [~] Weekly activity summary works
- [~] Email toggle respected per notification
- [~] In-app toggle respected per notification

### Privacy

- [~] Profile visibility toggle enforced

### Messages

- [~] Allow messages from Everyone enforced
- [~] Allow messages from Organizations enforced
- [~] Allow messages from Admins enforced
- [~] Organize messages preference enforced

### Data

- [x] CSV export valid
- [~] PDF export valid
- [x] Delete account requires confirmation
- [x] Account deletion permanent

---

# SECTION 2 — ORGANIZATION FLOW (ATOMIC)

## 2.1 Dashboard

- [~] Activity feed accurate
- [~] Student signup event logged
- [~] Pending approval logged
- [~] Event creation logged
- [x] Create Opportunity quick action works
- [x] Make Announcement works

---

## 2.2 Opportunity Creation

- [x] Event Name required
- [x] Location required
- [x] Date required
- [x] Recurring toggle works
- [x] Time required
- [x] Volunteers needed required
- [x] Age requirement required
- [~] Tags multi-select works
- [~] Add new tag works
- [x] Description required
- [~] Additional custom fields persist
- [x] Edit opportunity works
- [x] Delete opportunity works

---

## 2.3 Hour Approval Flow

- [x] Incoming approval request appears
- [x] Approve updates DB
- [x] Verified visible to student
- [~] Classroom admin sees verified
- [x] Owner can remove
- [x] Admin can remove within classroom
- [x] Student notified on removal

---

## 2.4 Messaging

- [x] Inbox loads
- [~] Filter by students works
- [~] Filter by schools works
- [~] Filter by orgs works
- [~] Priority flag works
- [x] Composer works

---

## 2.5 School Relationship

- [x] Org requests approval
- [x] Owner reviews request
- [x] Owner approves
- [x] Owner denies
- [x] Owner manually adds org
- [x] Owner blocks org
- [x] Block hides opportunities
- [x] Org not notified on block

---

## 2.6 Organization Settings

### Security

- [~] Change password
- [~] 2FA
- [~] Add collaborator
- [~] Remove collaborator

### Notifications

- [~] New sign-up alert works
- [~] Hour request alert works
- [~] School approval request alert works
- [~] Email toggle enforced
- [~] In-app toggle enforced

### Messages

- [~] Sender restriction enforced
- [~] Archive after X months enforced

### Analytics

- [~] Message engagement accurate
- [~] Average response time accurate
- [~] Most active students accurate

### Privacy

- [~] Default visibility enforced
- [~] Profile visibility enforced

### Data

- [~] Volunteer data export accurate

---

# SECTION 3 — SCHOOL FLOW (ATOMIC)

## 3.1 Signup → Goal Enforcement

- [x] Owner must set graduation goal before dashboard
- [x] Goal stored
- [x] Only owner can edit

---

## 3.2 Owner Dashboard

- [x] Total hours accurate
- [x] % on-track accurate
- [x] At-risk count accurate
- [x] Graduation completion metric accurate
- [x] Classroom summary cards accurate
- [x] View On-Track works
- [x] View Off-Track works

---

## 3.3 Classroom Management

- [x] Create classroom works
- [x] Creator becomes admin
- [x] Unique lowercase alphanumeric code generated
- [x] Code displayed
- [x] Code copyable
- [x] Owner sees all classrooms
- [x] Admin sees only their classroom

---

## 3.4 Classroom Dashboard

- [~] Total hours accurate
- [~] % on-track accurate
- [~] At-risk accurate
- [x] Roster searchable
- [x] Filters (All, Completed, On Track, At Risk, Not Started) work
- [~] Student row fields accurate
- [~] Send Reminder works
- [~] View Hour History works
- [~] Remove Hours works
- [x] Student notified on removal
- [x] Notification when student leaves

---

## 3.5 Approved Orgs

- [~] Search by name works
- [~] Search by zip works
- [x] Approve request works
- [x] Deny request works
- [x] Block works
- [x] Approved orgs sorted first in student browse

---

## 3.6 Role Transfers

### Owner Transfer

- [~] Warning prompt
- [~] Confirmation required
- [~] Previous owner loses access

### Admin Transfer

- [~] Owner approval required
- [~] Warning prompt
- [~] Previous admin loses classroom access

---

## 3.7 School Settings

### School

- [x] Graduation goal editable (owner)
- [x] Zip codes editable (owner)

### Notifications

- [~] Student joins alert works
- [~] Student leaves alert works
- [~] Hour approval alert works
- [~] Org request alert works
- [~] Weekly summary works
- [~] Email toggle enforced
- [~] In-app toggle enforced

### Messages

- [~] Sender restriction enforced
- [~] Organize preference enforced

### Privacy

- [~] Profile visibility enforced
- [~] Location sharing enforced

### Data

- [~] Activity log CSV export valid
- [~] Activity log PDF export valid

---

# SECTION 4 — DATABASE & STABILITY

After every flow:

- [x] No orphaned records
- [x] No duplicate enrollments
- [x] No negative hours
- [x] Foreign key integrity intact
- [~] No race conditions in hour approval
- [x] No 500 responses
- [x] No console errors
- [~] No memory leaks

---

# TERMINATION CONDITION

Claude Code CLI may stop ONLY when:

- Every checkbox passes.
- No console errors.
- No API errors.
- No permission violations.
- No data inconsistencies.
- Full suite passes twice consecutively.

Final output must be:

GOODHOURS QA COMPLETE — PRODUCTION READY
