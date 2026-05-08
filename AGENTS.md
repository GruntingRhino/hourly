<claude-mem-context>
# Memory Context

# [GoodHours] recent context, 2026-05-08 10:19am EDT

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (18,864t read) | 856,226t work | 98% savings

### May 3, 2026
111 9:35a 🔵 BeneficiarySignup Status Enum Values Confirmed — Capacity Floor Check Uses Correct Status
112 9:36a 🔵 calcDurationHours Can Return 0 for Same or Inverted Start/End Times
113 " 🔵 Server Not Running Locally — Bug Is Production-Only
114 " 🔵 Dev Server Started Locally Against Production Neon Database
115 " 🔵 Seed BENEFICIARY_ADMIN Credentials Found for Local Reproduction
116 " 🔵 Seed Slots Are in the Past — Cannot Reproduce 500 via Seed Data Directly
117 9:37a 🔵 Slot PATCH Succeeds for Seed Data — 500 Is Data-Specific to Production Slot
118 " 🔵 Serializable Transaction with FOR UPDATE Works on Neon — Mechanism Not the Root Cause
119 9:38a 🔵 Failing Slot Data Is Valid — Admin User Identified for Exact Reproduction
120 " 🔵 Direct DB Transaction on Failing Slot Succeeds — Root Cause Is in HTTP Route Layer Not DB
121 9:39a 🔵 normalizeEmail Strips Plus-Addressing — Login Fails for Plus-Addressed Accounts
122 " 🔵 openEditSlot Initializes slotForm Date via toISOString — Date String Format Is Always Valid
123 " 🔵 Slot Edit Routes Are Uncommitted Local Changes — May Not Be Deployed to Production
124 9:41a 🔵 Committed Code Uses Plain prisma.update for Slot Edits — Working Directory Adds runSerializableTransaction
### May 4, 2026
192 1:00p 🔴 Student Browse Feed: Slots Hidden Too Early Due to Inverted 1-Hour Filter
193 1:01p 🔴 Available-Slots Endpoint: Date Filter Excluded Today's Future Slots
225 1:02p 🟣 Waitlist Support Added to Student Slot Signup Flow
226 " 🟣 Weighted Smart Search Scoring Added to Student Browse Page
### May 5, 2026
227 9:55a 🔵 SelfSubmittedRequest System Architecture Mapped for Cancel Feature
228 " 🟣 Student Self-Submission Cancel Endpoint Added
229 " 🟣 Cancel Button Added to Student Self-Submit UI
230 9:56a 🔵 School SelfSubmissions Admin Page Doesn't Show CANCELLED Status
231 9:57a 🔵 Hour-Breakdown Endpoint Shows CANCELLED Self-Submissions to Admins But Counts Zero Hours
232 " 🔴 Resubmit Preserves Audit Fields (reviewedBy/reviewedAt/revisionNote)
233 " 🟣 Self-Submission Cancel Feature + Dashboard Activity Feed Complete
234 " 🟣 New User Request: Customizable CSV Student Import Headers (Field House Toggle)
235 10:10a 🔵 CSV Student Import Architecture Mapped for Field House Toggle Feature
236 " 🟣 CSV Import Header Validation Added — Accepts name/email/grade or name/email/grade/house
237 " 🟣 CohortDetail CSV Import UI Gets Field House Toggle Checkbox
238 10:11a 🔵 CohortDetail House Toggle Implementation Verified — All References Consistent
### May 8, 2026
251 9:51a 🔵 GoodHours Report/Dashboard/Export File Locations
252 " 🔵 GoodHours Server Route Inventory
253 " 🔵 GoodHours Hours Calculation: Three-Source Aggregation Model
254 " 🔵 GoodHours Reports API: Four Endpoints with Distinct Data Scopes
255 " 🔵 GoodHours Client: Student and School Dashboard Pages Located
256 " 🔵 studentProgress.ts: Risk Assessment and Progress Status Logic
257 9:52a 🔵 Student Dashboard Calculates Hours Client-Side, Not from /api/reports/student
258 " 🔵 School Dashboard Hours Come from Cohorts API, Not Reports API
259 " 🔵 Totals Cross-View Consistency Audit: Summary of Findings
260 9:54a 🔵 GoodHours Prisma Schema: Three Hour-Tracking Model Lineage
261 9:55a 🔵 SelfSubmittedRequest.convertedSessionId Field is Unused Dead Schema Column
262 " 🔵 Full GoodHours Prisma Schema for Hour-Tracking Models Documented
263 " 🔵 Approval Flows Confirmed: No Cross-Model Record Creation, No Double-Counting Risk
264 9:56a 🔵 Reminder getPendingReviewCount Misses BeneficiarySignup Pending Reviews
265 " 🔴 Reminder Admin Alert Count Now Includes Pending BeneficiarySignup Reviews
266 " 🔵 BeneficiarySignup Has No `student` Relation in Prisma Schema — Only `studentId` Scalar
S15 Verify totals match across student dashboard, school dashboard, reports, and exports — full audit complete, two bugs fixed, one operational gap identified (May 8 at 9:57 AM)
S17 Verify totals match across student dashboard, school dashboard, reports, and exports — all bugs fixed, cron infrastructure confirmed complete (May 8 at 9:58 AM)
267 9:59a 🔵 GoodHours Server Architecture: Express App with Internal Routes and Reminder Scheduler
268 " 🔵 Vercel Cron and Internal Reminder Endpoint Were Already Implemented
S16 Verify totals match across student dashboard, school dashboard, reports, and exports — full audit and fixes complete, cron schedule adjusted (May 8 at 9:59 AM)
S18 GoodHours hour consistency audit — verify totals match across student dashboard, school dashboard, reports, and exports; fix all discrepancies (May 8 at 9:59 AM)
S19 GoodHours security audit — investigating dev-only endpoints and production guards across auth, impersonation, and internal cron routes (May 8 at 10:00 AM)
S20 GoodHours security audit — reviewing production guards, dev-only backdoors, unauthenticated routes, and hardcoded secrets across all server routes (May 8 at 10:02 AM)
S21 GoodHours security audit — deep review of production guards, dev backdoors, unauthenticated routes, field encryption, RBAC, and sensitive data logging (May 8 at 10:02 AM)
S22 GoodHours security audit — dependency review and rate limiter skip function enumeration (May 8 at 10:03 AM)
S23 GoodHours security audit — fixing schools.ts tempPassword guard to use IS_PROD_LIKE instead of NODE_ENV-only check (May 8 at 10:03 AM)
S24 GoodHours security audit and fix — comprehensive audit of dev shortcuts leaking to production; one genuine fix applied to schools.ts tempPassword guard (May 8 at 10:04 AM)
269 10:14a 🔵 GoodHours Repository-Wide Security Audit Initiated
270 10:15a 🚨 Production Credentials Committed in server/.env

Access 856k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>