# Hourly App — Email Integration (Resend) + Polish Pass

The app is functional as an MVP. Your job is to wire up a real email service using Resend, then do a full polish pass on everything non-blocking. Use Chrome to verify every step works in the browser with real emails being sent and received.

---

## Part 1 — Resend Email Integration

### 1.1 Install Resend

```bash
cd server
npm install resend
```

### 1.2 Environment Setup

Add to `server/.env`:
```
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@yourdomain.com
```

Add the same keys (with placeholder values) to `server/.env.example`:
```
RESEND_API_KEY=re_your_resend_api_key_here
EMAIL_FROM=noreply@yourdomain.com
```

**Note:** The RESEND_API_KEY will need to be provided by the user. If it is not already in `server/.env`, pause and ask the user to add it before proceeding. Do not proceed with email integration until the key is present.

### 1.3 Create an Email Service Module

Create `server/src/services/email.ts`. Implement the following functions — each should use Resend to send a real email:

```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? 'noreply@hourly.app';

// 1. Email verification on sign-up
export async function sendVerificationEmail(to: string, verificationLink: string): Promise<void>

// 2. Password reset
export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<void>

// 3. Hour approved notification
export async function sendHourApprovedEmail(to: string, orgName: string, hours: number, eventName: string): Promise<void>

// 4. Hour removed notification
export async function sendHourRemovedEmail(to: string, hours: number, eventName: string): Promise<void>

// 5. Student left classroom notification (to admin)
export async function sendStudentLeftClassroomEmail(to: string, studentName: string, classroomName: string): Promise<void>

// 6. Org approval request received (to school owner)
export async function sendOrgApprovalRequestEmail(to: string, orgName: string): Promise<void>

// 7. Org request approved (to org)
export async function sendOrgRequestApprovedEmail(to: string, schoolName: string): Promise<void>

// 8. Admin transfer request (to owner, for approval)
export async function sendAdminTransferRequestEmail(to: string, adminName: string, classroomName: string): Promise<void>

// 9. Event reminder (configurable hours before)
export async function sendEventReminderEmail(to: string, eventName: string, eventTime: string, location: string): Promise<void>
```

All emails should have clean, minimal HTML — just the Hourly name, a short message, and a clear CTA button or link. No need for heavy design. Plain and readable is fine.

### 1.4 Wire Into Existing Routes

Replace any placeholder/console.log email calls in the existing server routes with the real functions from `email.ts`. Specifically, find and replace every place in the server code where:
- An email should be sent but isn't (look for TODO comments, console.log("sending email..."), or empty stubs)
- Verification links are generated — make sure they point to the correct frontend URL using a `CLIENT_URL` environment variable

Add to `server/.env`:
```
CLIENT_URL=http://localhost:5173
```

And to `.env.example`:
```
CLIENT_URL=https://yourdomain.com
```

### 1.5 Verify Email Flows in Chrome

For each flow below, perform the action in Chrome and confirm a real email is received:

- [ ] Sign up as a new student — verification email arrives, link works, account is verified
- [ ] Sign up as a new org — same
- [ ] Sign up as a new school — same
- [ ] Trigger password reset — reset email arrives, link works, password is changed successfully
- [ ] Org approves student hours — student receives hour approval email
- [ ] School admin removes hours — student receives hour removed email
- [ ] Student leaves classroom — classroom admin receives notification email
- [ ] Org sends approval request to school — school owner receives email
- [ ] School owner approves org — org receives confirmation email

---

## Part 2 — Polish Pass

Work through every item below. Use Chrome to verify each one visually and functionally.

### 2.1 Empty States
Every list or data view in the app must have a proper empty state — not a blank screen, not an error, not a spinner that never resolves. Check and fix:
- [ ] Student dashboard — no upcoming events
- [ ] Browse Opportunities — no results after filtering
- [ ] Saved Opportunities — nothing saved yet
- [ ] Skipped/Discarded — nothing there yet
- [ ] Org dashboard — no opportunities created yet
- [ ] Org — no hour approval requests pending
- [ ] Org — no messages
- [ ] School dashboard — no classrooms created yet
- [ ] Classroom dashboard — no students enrolled yet
- [ ] Student roster — filter returns no results
- [ ] Messages inbox — no messages for any role

### 2.2 Loading States
Every async data fetch must show a loading indicator while waiting. No screen should flash blank content before data loads. Check:
- [ ] Dashboard stats
- [ ] Opportunity list
- [ ] Student roster
- [ ] Messages inbox
- [ ] Hour approval list
- [ ] Approved orgs list

### 2.3 Error States
Every form submission and data fetch must handle errors gracefully. Test by temporarily breaking a request (wrong endpoint, network off in DevTools) and confirm:
- [ ] Forms show a readable error message on failure (not a raw JSON dump or blank screen)
- [ ] Data fetches show "Something went wrong. Try again." style message with a retry option where appropriate

### 2.4 Form Validation — Client Side
All forms must validate on the client before submitting. Check each form has:
- [ ] Required field indicators
- [ ] Inline error messages on blur for invalid fields (not just on submit)
- [ ] Email format validation
- [ ] Password minimum length shown clearly (not discovered after rejection)
- [ ] ZIP code format validation (5 digits)
- [ ] Character counters on bio/description fields that have a max length

### 2.5 Confirmation Dialogs
The following destructive or irreversible actions must show a confirmation dialog before executing:
- [ ] Delete account
- [ ] Remove student hours
- [ ] Block an org
- [ ] Transfer owner role (must explicitly state "You will permanently lose all access")
- [ ] Transfer admin role (must explicitly state "You will permanently lose classroom access")
- [ ] Student leaving a classroom (warn that they'll need a new code to re-join any classroom)

### 2.6 Notifications UI
- [ ] Unread notification badge visible in navigation for all three roles
- [ ] Notifications panel or page shows all unread notifications
- [ ] Marking a notification as read works and badge count decrements
- [ ] Notifications are sorted newest first

### 2.7 Responsive Layout
Open Chrome DevTools and test at these widths. Fix any broken layouts:
- [ ] 375px (iPhone SE) — swipe card view for Browse, no overflowing text
- [ ] 768px (tablet)
- [ ] 1280px (desktop) — filter/list view for Browse

### 2.8 Navigation & Routing
- [ ] All nav links work and highlight the active route
- [ ] Browser back/forward does not break app state or log the user out
- [ ] Refreshing any authenticated route keeps the user logged in and on the correct page
- [ ] A 404 page exists for unknown routes — not a blank screen
- [ ] Unauthenticated access to any protected route redirects to sign in (not a blank screen or error)
- [ ] After sign in, user is redirected to their role-appropriate dashboard (not a generic home)

### 2.9 Accessibility Basics
- [ ] All form inputs have associated labels (not just placeholders)
- [ ] Buttons have descriptive text (not just icons with no aria-label)
- [ ] Color contrast is sufficient for primary text (check in Chrome Lighthouse)
- [ ] Tab navigation works through forms in a logical order

### 2.10 Console & Network Cleanliness
Open Chrome DevTools and navigate through every page for all three roles. Confirm:
- [ ] Zero JS errors in the console
- [ ] Zero unhandled promise rejections
- [ ] Zero 4xx or 5xx network responses during normal use
- [ ] No `console.log` debug output remaining in production-bound code

---

## Part 3 — Final Checks

- [ ] `npm run build` produces zero errors and zero warnings
- [ ] `npx tsc --noEmit` clean in both client and server
- [ ] `npx prisma migrate status` shows all migrations applied
- [ ] `server/.env.example` has entries for `RESEND_API_KEY`, `EMAIL_FROM`, and `CLIENT_URL`
- [ ] Run Chrome Lighthouse audit on the landing page and student dashboard — fix any accessibility or performance issues flagged as high severity

---

## Deliverable

When complete, report back with:
1. Confirmation that every email type sends and is received correctly
2. List of any polish items that needed fixes
3. Lighthouse scores for landing page and student dashboard
4. Final verdict: ready for real launch or remaining blockers
