# GoodHours Functionality List (Manual QA)

Use this as a complete manual QA checklist for the current app behavior.

## 1) App Shell, Navigation, and Session State
- [ ] App loads with `GoodHours` branding in header.
- [ ] Unauthenticated users see public routes only.
- [ ] Authenticated users are redirected to role dashboard routes.
- [ ] Role-based top navigation renders correct items for `STUDENT`.
- [ ] Role-based top navigation renders correct items for `ORG_ADMIN`.
- [ ] Role-based top navigation renders correct items for `SCHOOL_ADMIN`.
- [ ] Role-based top navigation renders correct items for `TEACHER`.
- [ ] Role-based top navigation renders correct items for `DISTRICT_ADMIN`.
- [ ] Active nav tab styling updates based on route.
- [ ] Header shows avatar image when `avatarUrl` exists.
- [ ] Header shows initial avatar fallback when no avatar image exists.
- [ ] Header shows logged-in user name.
- [ ] Clicking `Log out` clears auth and routes to landing.
- [ ] Notification unread badge appears on Messages nav when unread notifications exist.
- [ ] Notification badge updates via polling (30 second interval).
- [ ] Opening `/messages` clears local unread badge state.

## 2) Public Marketing and Entry
- [ ] Landing page hero renders with primary CTA.
- [ ] Landing page `Sign In` CTA routes to `/login`.
- [ ] Landing page `Get Started` CTA routes to `/signup`.
- [ ] Landing page role CTAs route to `signup?role=STUDENT`.
- [ ] Landing page role CTAs route to `signup?role=ORG_ADMIN`.
- [ ] Landing page role CTAs route to `signup?role=SCHOOL_ADMIN`.
- [ ] Landing page value proposition cards render for students, organizations, and schools.
- [ ] Landing footer renders support/terms/privacy links.

## 3) Authentication, Identity, and Account Lifecycle
- [ ] Signup role picker screen renders when `role` is not preselected.
- [ ] Signup allows role change before submit.
- [ ] Signup (student) requires name, email, password, and supports age.
- [ ] Signup (org) requires organization name and supports service-area ZIP chips.
- [ ] Signup (school) requires school name and supports optional domain.
- [ ] Signup ZIP chip input accepts 5-digit ZIP only.
- [ ] Signup ZIP chip input supports add/remove.
- [ ] Signup enforces password rules (8+, upper, lower, number, special).
- [ ] Signup invalid password blocks submit with error.
- [ ] Signup duplicate email returns `409 Email already registered`.
- [ ] Signup success returns auth token and authenticated state.
- [ ] Signup sends verification email with subject `Verify your GoodHours account`.
- [ ] Email verification required gate blocks non-verified users from app routes.
- [ ] Email verification required screen displays target email.
- [ ] `Resend verification email` sends a new verification token.
- [ ] Resend verification rate limit enforces maximum attempts per IP window.
- [ ] Verification link success sets `emailVerified=true` and routes to dashboard flow.
- [ ] Verification link with invalid token shows `Invalid token`/verification error.
- [ ] Verification link with expired token shows `Invalid or expired verification token`.
- [ ] Old verification token fails after resend (token rotation).
- [ ] Login with valid credentials returns token and role-aware session.
- [ ] Login with wrong password returns `Invalid email or password`.
- [ ] Login blocked for non-`ACTIVE` account status.
- [ ] Forgot password accepts email and always returns non-enumerating success message.
- [ ] Forgot password sends reset email with subject `Reset your GoodHours password`.
- [ ] Forgot password rate limit enforces per-IP threshold.
- [ ] Reset password page rejects missing token.
- [ ] Reset password rejects mismatched passwords.
- [ ] Reset password enforces minimum password length.
- [ ] Reset password rejects invalid/expired token.
- [ ] Reset password success allows login with new password.
- [ ] Auth `me` refresh hydrates role, school/org/classroom links, and preferences.
- [ ] Change password requires current password.
- [ ] Change password enforces strong password rules.
- [ ] Change password fails on bad current password.
- [ ] Delete account permanently removes user and signs out.

## 4) Route Guards and Role Gating
- [ ] Unauthenticated wildcard routes redirect to landing.
- [ ] Verified student without classroom is forced to classroom-join flow.
- [ ] Verified school admin without onboarding completion is forced to onboarding flow.
- [ ] `school_onboarding_<schoolId>` localStorage key controls onboarding gate.
- [ ] Student app routes available only to `STUDENT`.
- [ ] Organization app routes available only to `ORG_ADMIN`.
- [ ] School app routes available to `SCHOOL_ADMIN`, `TEACHER`, and `DISTRICT_ADMIN`.

## 5) Student: Classroom Join Flow
- [ ] Join classroom page renders for students without classroom.
- [ ] Join classroom requires exactly 8-character invite code.
- [ ] Join classroom lowercases code input.
- [ ] Join classroom success links student to classroom and school.
- [ ] Join classroom rejects invalid code.
- [ ] Join classroom rejects inactive classroom.
- [ ] Join classroom rejects if already enrolled in a classroom.
- [ ] Classroom join screen provides sign-out action.

## 6) Student: Dashboard
- [ ] Dashboard shows cards for Committed, Verified, and Activities Done.
- [ ] Dashboard progress bar shows verified hours vs required goal.
- [ ] Dashboard reads required hours from linked school.
- [ ] Upcoming Opportunities list shows future confirmed signups sorted by date.
- [ ] Upcoming cards show title, org, date/time, location, and capacity fill.
- [ ] Upcoming card `Check In` action appears when session is pending check-in.
- [ ] Upcoming card `Check Out` action appears when session is checked in.
- [ ] Upcoming card shows checked-out hours summary state.
- [ ] Dashboard `Recent Activity` lists recent sessions and verification status badges.
- [ ] Dashboard action feedback shows check-in/out success/failure banners.
- [ ] Dashboard handles no-upcoming and no-activity empty states.

## 7) Student: Browse Opportunities
- [ ] Browse page loads opportunities list on arrival.
- [ ] Browse search filters by title.
- [ ] Browse search filters by description.
- [ ] Browse search filters by location.
- [ ] Browse search filters by organization name.
- [ ] Browse view tabs switch among All, Saved, Skipped, and Discarded.
- [ ] Browse shows empty state for no saved opportunities.
- [ ] Browse shows empty state for no skipped opportunities.
- [ ] Browse shows empty state for no discarded opportunities.
- [ ] Browse sort supports Alphabetical.
- [ ] Browse sort supports Date.
- [ ] Browse sort supports Most Popular (signup count descending).
- [ ] Browse sort supports Distance (when school ZIP geocode available).
- [ ] Browse tag dropdown filters by selected tag.
- [ ] Clicking tag chip on card applies tag filter.
- [ ] Distance filter supports 5/10/25/50 miles thresholds.
- [ ] Approved orgs only toggle narrows results to approved organizations.
- [ ] Clear filters resets tag/distance/approved filters.
- [ ] Save action stores opportunity in Saved tab.
- [ ] Skip action stores opportunity in Skipped tab and hides from All.
- [ ] Discard action stores opportunity in Discarded tab and hides from All.
- [ ] Recover action from Skipped returns item to normal browsing state.
- [ ] Recover action from Discarded returns item to normal browsing state.
- [ ] Opportunity card link navigates to full opportunity detail page.

## 8) Student: Opportunity Detail, Signup, Waitlist, Attendance, Verification
- [ ] Opportunity detail shows title, description, org, date, time, location, and duration.
- [ ] Opportunity detail shows capacity as `confirmed/capacity`.
- [ ] Opportunity detail shows tags and custom fields.
- [ ] Opportunity detail shows optional age requirement when defined.
- [ ] Opportunity detail shows optional grade requirement when defined.
- [ ] Opportunity detail shows recurring indicator when enabled.
- [ ] `Sign Up` creates signup when capacity available.
- [ ] Signup button label changes to `Join Waitlist` when opportunity is full.
- [ ] Full-capacity signup creates `WAITLISTED` state.
- [ ] Waitlisted state shows waitlist status and `Leave Waitlist` action.
- [ ] Confirmed state shows signed-up confirmation banner.
- [ ] Confirmed signup can be canceled by student before verification complete.
- [ ] Canceled state shows `Sign Up Again` action.
- [ ] Re-signup from canceled returns to confirmed/waitlist based on current capacity.
- [ ] Check In transitions session to checked-in state.
- [ ] Check Out transitions session to checked-out state and computes elapsed hours.
- [ ] Checked-out state shows calculated hours.
- [ ] Verification submission is blocked before opportunity date.
- [ ] Verification unlock notice explains date-based lock.
- [ ] Submit Verification opens verification form.
- [ ] Draw Signature mode requires non-empty drawn signature.
- [ ] Upload File mode accepts `.pdf`, `.png`, `.jpg`, `.jpeg`.
- [ ] Upload File mode rejects unsupported file types.
- [ ] Upload File mode rejects files over 5MB.
- [ ] Verification submit transitions session to `PENDING_VERIFICATION`.
- [ ] Pending verification state renders status summary.
- [ ] Verified state renders approved hours summary.
- [ ] Rejected state renders rejection reason when present.
- [ ] Waitlist promotion occurs when a confirmed student cancels and waitlist exists.

## 9) Student: Messages and Notifications
- [ ] Messages page supports Inbox, Sent, and Notifications tabs.
- [ ] Compose message sends by recipient email.
- [ ] Compose message supports optional subject and required body.
- [ ] Sent folder includes newly sent message.
- [ ] Inbox sender role filters work for all/students/organizations/schools.
- [ ] Opening unread inbox message marks it read and clears unread style.
- [ ] Notifications tab lists system notifications.
- [ ] Notifications visually differentiate unread vs read.

## 10) Student: Settings
- [ ] Settings tabs render: Profile, Classroom, Security, Notifications, Privacy.
- [ ] Profile edit supports name, phone, grade, and bio.
- [ ] Bio counter enforces 300-character max.
- [ ] Profile supports social links (Instagram, TikTok, Twitter/X, YouTube).
- [ ] Profile save persists changes after refresh.
- [ ] Avatar picker accepts image file and updates preview.
- [ ] Avatar save persists after refresh.
- [ ] Profile shows signup count.
- [ ] Export Hours (CSV) downloads `my-service-hours.csv`.
- [ ] Export Hours (PDF) generates `service-hours.pdf`.
- [ ] Classroom tab shows current classroom/school when enrolled.
- [ ] Classroom tab supports leave classroom confirmation flow.
- [ ] Leaving classroom unlinks school/classroom and can require rejoin.
- [ ] Classroom tab join form works when not currently enrolled.
- [ ] Security tab supports password change.
- [ ] Security tab supports typed `DELETE` account deletion confirmation.
- [ ] Notifications tab toggles email channel per notification type.
- [ ] Notifications tab toggles in-app channel per notification type.
- [ ] Notifications preferences persist after refresh.
- [ ] Privacy tab supports profile visibility options.
- [ ] Privacy tab supports message restriction options.
- [ ] Privacy settings persist after refresh.

## 11) Organization: Dashboard
- [ ] Dashboard actions render: Create Opportunity, My Opportunities, Make Announcement.
- [ ] Pending Verifications section lists pending sessions.
- [ ] Pending item shows student, opportunity, and submitted hours.
- [ ] Approve action verifies pending session.
- [ ] Approve action supports override hours input.
- [ ] Reject action requires reason and updates status.
- [ ] Recent Activity Feed shows latest notifications.
- [ ] Stats cards show Total Opportunities, Total Signups, Approved Hours, Unique Volunteers.
- [ ] Upcoming Events sidebar shows active upcoming events with signup counts.
- [ ] Announcement modal sends to all confirmed signups for selected opportunity.
- [ ] Announcement modal returns sent-count confirmation.

## 12) Organization: Opportunity Management
- [ ] Opportunities page lists active opportunities by default.
- [ ] Opportunities page supports tabs for Active, Completed, and Cancelled statuses.
- [ ] Opportunity cards show date/time, location, and enrollment count.
- [ ] `Create New` routes to create form.
- [ ] Create form requires title, description, location, date, time, duration, capacity.
- [ ] Create form supports optional address.
- [ ] Create form supports optional age requirement.
- [ ] Create form supports tag chips add/remove.
- [ ] Create form supports recurring toggle and recurring pattern field.
- [ ] Create form supports custom fields add/edit/remove.
- [ ] Create success returns to opportunities list with created row.
- [ ] Create with address auto-geocodes latitude/longitude.
- [ ] Edit Details opens prefilled edit form.
- [ ] Edit save updates title/description/capacity/location/date/time fields.
- [ ] Edit save persists tag and custom field changes.
- [ ] Edit geocodes when address changes and no coordinates supplied.
- [ ] Cancel opportunity changes status to `CANCELLED`.
- [ ] Cancel opportunity notifies confirmed students.

## 13) Organization: Messages
- [ ] Org messages page supports Priority, Inbox, and Sent tabs.
- [ ] Compose message defaults to priority message creation.
- [ ] Sent folder shows newly sent message.
- [ ] Inbox supports sender role filters.
- [ ] Priority messages show priority visual indicator.

## 14) Organization: Settings
- [ ] Settings tabs render: Profile, Schools, Security, Notifications, Analytics, Data.
- [ ] Profile supports org name, phone, description, website edits.
- [ ] Description counter enforces 500-character max.
- [ ] Profile supports social links fields.
- [ ] ZIP code manager supports add/remove and ZIP validation.
- [ ] ZIP warning appears when no ZIPs are configured.
- [ ] Profile save persists after refresh.
- [ ] Schools tab shows current school connection statuses.
- [ ] Schools tab searches schools by name/domain.
- [ ] Schools tab sends approval request to selected school.
- [ ] Schools tab shows pending/approved/rejected/blocked statuses.
- [ ] Security tab supports password change with full complexity checks.
- [ ] Security tab supports typed `DELETE` account deletion confirmation.
- [ ] Notifications tab toggles email/in-app channels per org event type.
- [ ] Notification preferences persist after refresh.
- [ ] Analytics tab shows total volunteers, total hours, events posted.
- [ ] Analytics tab shows top active volunteers.
- [ ] Data tab exports volunteer data CSV.

## 15) School Staff: Onboarding and Dashboard
- [ ] First school-admin login shows graduation-hours onboarding screen.
- [ ] Onboarding requires hours goal >= 1.
- [ ] Onboarding saves required hours and sets onboarding completion state.
- [ ] Dashboard shows school-wide stats: students, hours, goal completion, at-risk count.
- [ ] Dashboard quick links filter to on-track and at-risk student views.
- [ ] Dashboard shows classroom cards with teacher, students, completed, at-risk, and progress.
- [ ] Dashboard classroom cards display invite code.
- [ ] Classroom invite code copy button copies code and shows copied feedback.
- [ ] Dashboard includes `Student Roster` navigation.
- [ ] School admin can open create-classroom inline form from dashboard.
- [ ] Create classroom returns new invite code confirmation.
- [ ] Pending organization requests list appears for reviewable orgs.
- [ ] School admin can approve organization requests.
- [ ] School admin can reject organization requests.
- [ ] Approved organizations list shows approved orgs.
- [ ] School admin can block approved organizations with confirmation modal.
- [ ] Organization search filter narrows pending and approved lists.

## 16) School Staff: Groups (Student Roster)
- [ ] Groups page shows classroom sidebar and `All Students` view.
- [ ] Selecting classroom filters roster to that classroom.
- [ ] Search filters students by name/email.
- [ ] Status filter supports All, Completed, On Track, At Risk, Not Started.
- [ ] Student cards show name, email, classroom (in all-students view), hours, and status badge.
- [ ] Student card progress bar shows completion percentage vs school requirement.
- [ ] Selecting student opens detail panel with progress and status.
- [ ] `Send Reminder` opens compose UI prefilled for selected student.
- [ ] Reminder can be sent and confirmation state appears.
- [ ] `View Hour History` toggles hour history panel.
- [ ] Hour history shows up to 5 sessions with title, status, and hours.
- [ ] `Remove Hours` appears for approved sessions in history.
- [ ] Remove Hours opens optional reason modal and confirms action.
- [ ] Removing hours updates session to rejected/override and reduces student hours.
- [ ] Audit Trail help card is visible in groups panel.
- [ ] Active classroom panel shows invite code with copy action.
- [ ] School admin can open Add Staff Member modal.
- [ ] Add Staff form accepts name/email and optional classroom assignment.
- [ ] Add Staff success displays temporary password for new teacher login.

## 17) School Staff: Messages
- [ ] School messages page supports Inbox, Sent, Notifications tabs.
- [ ] School compose message supports recipient by email, subject, and body.
- [ ] Sent folder shows newly sent messages.
- [ ] Notifications tab shows school/system notifications with read styling.

## 18) School Staff: Settings
- [ ] Settings tabs render: Profile, Classrooms, Security, Notifications, Privacy, Data.
- [ ] Profile edit supports school name, domain, required hours, ZIP codes.
- [ ] Profile save persists after refresh.
- [ ] Classrooms tab lists classrooms with teacher and invite code.
- [ ] Classrooms tab supports new classroom creation.
- [ ] Security tab supports password change.
- [ ] Security tab supports typed `DELETE` account deletion confirmation.
- [ ] Notifications tab toggles email/in-app channels per school event type.
- [ ] Notification preferences persist after refresh.
- [ ] Privacy tab supports profile visibility options.
- [ ] Privacy tab supports message restrictions options.
- [ ] Privacy settings persist after refresh.
- [ ] Data tab exports school activity log CSV.

## 19) Messaging and Notification Policy Rules (Cross-Role)
- [ ] Message send fails with 404 for unknown recipient email.
- [ ] Message send enforces receiver message preference `ORGS_ONLY`.
- [ ] Message send enforces receiver message preference `ADMINS_ONLY`.
- [ ] Sending message creates in-app notification for receiver.
- [ ] Priority message styling appears in inbox/sent lists.
- [ ] Notification center returns newest-first up to configured limit.
- [ ] Notification `mark read` endpoint updates notification read state.

## 20) Verification, Audit, and Compliance Rules (Cross-Role)
- [ ] Org/school cannot verify their own session (`Cannot verify your own session`).
- [ ] Approve action allows custom hour override.
- [ ] Approve action writes audit log entry (`APPROVE`).
- [ ] Reject action requires reason and writes audit log (`REJECT`).
- [ ] School remove-hours writes audit log (`OVERRIDE`).
- [ ] Audit endpoint returns full session action timeline in ascending order.
- [ ] Approval sends in-app notification to student.
- [ ] Hour removal sends in-app notification to student.
- [ ] Hour approval email respects student notification preference toggle.
- [ ] Hour removal email respects student notification preference toggle.

## 21) Opportunity Visibility and School Approval Logic
- [ ] Student browse excludes orgs blocked by the student's school.
- [ ] `Approved orgs only` returns only orgs approved by student's school.
- [ ] Without `approvedOnly`, approved orgs are still prioritized in sorting when school context exists.
- [ ] Distance sort uses opportunity lat/lng when available.
- [ ] Distance sort falls back to org ZIP centroid when opportunity coordinates absent.

## 22) Rate Limits and Anti-Abuse
- [ ] Signup rate limit triggers `Too many signup attempts from this IP. Please try again later.` for API/non-interactive abuse pattern.
- [ ] Signup duplicate email check returns 409 quickly.
- [ ] Forgot-password rate limit triggers appropriate error after threshold.
- [ ] Resend-verification rate limit triggers appropriate error after threshold.

## 23) Reports and Exports
- [ ] Student report endpoint returns totals and categorized sessions.
- [ ] Organization report endpoint returns total sessions and approved hours.
- [ ] School report endpoint returns per-student completion report.
- [ ] Student CSV export includes columns: Date, Opportunity, Organization, Hours, Status.
- [ ] School activity CSV export includes columns: Student, Opportunity, Date, Hours, Status.
- [ ] Org volunteer CSV export includes name, email, total hours, session count.

## 24) System and Platform Endpoints
- [ ] `GET /api/health` returns `status: ok` and timestamp.
- [ ] `GET /api/geocode?address=...` returns latitude/longitude for valid address.
- [ ] Geocode endpoint returns 400 when `address` query param is missing.
- [ ] Geocode endpoint returns 404 when address cannot be resolved.
- [ ] Uploaded signature files are served under `/uploads/*`.
- [ ] Client API layer sends auth bearer token on authenticated requests.
- [ ] Client API layer surfaces server `error` messages consistently.
- [ ] Client API layer enforces request timeout handling.
- [ ] Global error boundary renders fallback UI and refresh action on uncaught render errors.

## 25) Email Delivery Behaviors
- [ ] Verification email sender and subject are correct for production configuration.
- [ ] Password reset email sender and subject are correct for production configuration.
- [ ] Verification email contains `Verify Email` CTA with valid token link.
- [ ] Reset email contains `Reset Password` CTA with valid token link.
- [ ] Non-production Mailinator capture endpoint (`/api/auth/__test-email`) exposes captured inbox data.
- [ ] Mailinator redundancy send behavior results in reliable inbox delivery during QA.

## 26) API-Exposed Features Not Fully Surfaced in Current UI
- [ ] `GET /api/organizations` returns all organizations with opportunity/member counts.
- [ ] `GET /api/organizations/:id` returns org profile with active opportunities.
- [ ] `GET /api/classrooms/:id` returns classroom, teacher, school, and student hour summaries.
- [ ] `PUT /api/classrooms/:id` updates classroom name/activity/teacher assignments.
- [ ] `GET /api/classrooms/my/current` returns current classroom details for student.
- [ ] `GET /api/sessions/organization` returns org-filtered volunteer session history.
- [ ] `GET /api/sessions/school` returns school-filtered session history with student/org context.
- [ ] `GET /api/verification/school-pending` returns pending school-side verification queue.
- [ ] `GET /api/schools/:id/groups` returns student groups for school.
- [ ] `POST /api/schools/:id/groups` creates student group.
- [ ] `GET /api/schools/:id/groups/:groupId/students` returns group members with status and hours.
- [ ] `POST /api/schools/:id/groups/:groupId/students` adds student to group.
- [ ] `GET /api/reports/organization` supports explicit `organizationId` query override.
- [ ] `GET /api/reports/school` returns school compliance aggregate and per-student completion.
- [ ] `GET /api/saved?status=<STATUS>` supports direct status filtering of saved/skip/discard records.
