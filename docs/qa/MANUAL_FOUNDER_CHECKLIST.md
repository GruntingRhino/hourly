# GoodHours Manual Founder Testing Checklist

**Version:** 1.0  
**Last Updated:** 2026-06-29  
**For:** Founder — to be completed personally before each major milestone (pilot launch, general availability)

---

## Purpose

Automated tests verify that the system behaves correctly in controlled, scripted conditions. This checklist covers what automated testing cannot: does it feel right? Does it work in the real world, on real devices, with real people? Only a human — specifically, the person who knows the product vision most deeply — can answer these questions.

Complete every item yourself. Do not delegate to engineering. Note your findings and any issues in the column provided.

---

## How to Use

- Run against the staging or production environment, not localhost
- Use fresh accounts or a freshly re-seeded database; do not rely on lingering test state
- Complete each journey end-to-end without skipping ahead
- Note the date completed and any friction points observed

---

## Journey 1: Complete Student Lifecycle

**Goal:** Validate the full student experience from first visit to verified hours on record.

**Setup:** Use a fresh email address (e.g., a Mailinator address or your own email if testing with real Resend key).

| # | Step | Notes | Done |
|---|------|-------|------|
| 1 | Navigate to the landing page. Confirm: logo, tagline, CTA buttons render correctly. No broken images. | | [ ] |
| 2 | Click "Sign Up". Select "I want to volunteer" (student role). Fill in name, school email address, password. Submit. | | [ ] |
| 3 | Check inbox for verification email. Confirm: email arrives within 2 minutes, sender address is correct (not localhost), subject line is clear, no broken HTML. | | [ ] |
| 4 | Click the "Verify Email" button in the email. Confirm: you land on the app (not localhost), account is marked verified, you are redirected to dashboard or login. | | [ ] |
| 5 | Log in with the new account. Confirm: you reach the student dashboard. Stats cards show (Committed, Verified, Activities Done). | | [ ] |
| 6 | Navigate to Browse Opportunities. Confirm: opportunity cards load with title, org name, date, location, and a sign-up button. | | [ ] |
| 7 | Use the search box. Type a partial title. Confirm: list filters in real time. Clear search. Confirm: all opportunities return. | | [ ] |
| 8 | Use a tag filter. Confirm: only matching opportunities show. Remove filter. | | [ ] |
| 9 | Toggle "Approved Orgs Only". Confirm: list narrows to school-approved organizations only. | | [ ] |
| 10 | Save one opportunity. Navigate to the Saved tab. Confirm: it appears there. | | [ ] |
| 11 | Skip one opportunity. Navigate to the Skipped tab. Confirm: it appears there. Recover it. Confirm: it moves back to the main list. | | [ ] |
| 12 | Click an opportunity to open its detail view. Confirm: org name, date, time, location, capacity, tags, and description all display correctly. | | [ ] |
| 13 | Click "Sign Up" on the opportunity. Confirm: button state changes, a confirmation message appears. | | [ ] |
| 14 | Return to Dashboard. Confirm: the signed-up opportunity appears in the Upcoming Opportunities section. | | [ ] |
| 15 | Simulate check-in: navigate to the session and click "Check In". Confirm: status updates to CHECKED_IN. | | [ ] |
| 16 | Simulate check-out: click "Check Out". Confirm: status updates to CHECKED_OUT and time elapsed is displayed. | | [ ] |
| 17 | Submit verification: draw a signature in the signature pad and submit. Confirm: status updates and submission is acknowledged. | | [ ] |
| 18 | Navigate to Settings > Profile. Confirm: verified hours appear in the summary. | | [ ] |
| 19 | Export hours as CSV. Open the downloaded file in both Excel and Google Sheets. Confirm: all columns present (Date, Opportunity, Organization, Hours, Status), data is correct, no encoding issues. | | [ ] |
| 20 | Export hours as PDF. Open the file. Confirm: it renders correctly, student name is present, hours are listed. | | [ ] |

---

## Journey 2: Complete Organization Lifecycle

**Goal:** Validate the org experience from creating an opportunity to verifying student hours.

**Setup:** Log in as `volunteer@greenearth.org` (or create a new org account if testing signup).

| # | Step | Notes | Done |
|---|------|-------|------|
| 1 | Log in as the org admin. Confirm: you reach the org dashboard. Stats cards load (Total Opportunities, Signups, Approved Hours, Unique Volunteers). | | [ ] |
| 2 | Navigate to Opportunities. Confirm: existing opportunities listed with status badges. | | [ ] |
| 3 | Click "Create Opportunity". Fill in all fields: title, description, date, start/end time, location (full address), capacity, tags, custom fields. Save. | | [ ] |
| 4 | Confirm: new opportunity appears in the list with correct details. | | [ ] |
| 5 | Click the opportunity. Confirm: detail view shows what a student would see. | | [ ] |
| 6 | Navigate to a session that a student has checked out on. Confirm: it appears in the "Pending Verifications" section. | | [ ] |
| 7 | Approve the session. Confirm: status updates to VERIFIED. Note: once verified, there should be no way to edit or delete the time record. | | [ ] |
| 8 | Navigate to another session. Reject it with a reason. Confirm: rejection reason is saved and visible. | | [ ] |
| 9 | Navigate to Messages. Compose a message to a student. Confirm: message appears in Sent. | | [ ] |
| 10 | Navigate to Settings. Update org profile (description, contact info). Save. Refresh. Confirm: changes persist. | | [ ] |

---

## Journey 3: Complete School Admin Lifecycle

**Goal:** Validate the school admin experience from login through reporting.

**Setup:** Log in as `admin@lincoln.edu`.

| # | Step | Notes | Done |
|---|------|-------|------|
| 1 | Log in as school admin. Confirm: you reach the school dashboard. Student enrollment counts and hours stats are visible. | | [ ] |
| 2 | Navigate to Groups. Confirm: existing student groups listed. | | [ ] |
| 3 | Create a new group. Add a student to it. Confirm: student appears under the group. | | [ ] |
| 4 | Navigate to Organizations. Confirm: pending org approval requests listed (if any). Approve an org. Confirm: the org now appears in the Approved list. | | [ ] |
| 5 | Navigate to Reports. Confirm: student hours data is displayed. Filter by date range. Confirm: results update. | | [ ] |
| 6 | Export the report as CSV. Open in Excel and Google Sheets. Confirm: all expected columns present, data is accurate. | | [ ] |
| 7 | Navigate to Messages. Send a message to a student. Confirm: it appears in Sent. | | [ ] |
| 8 | Navigate to Settings. Confirm school profile details. Update the service hour goal. Save. Refresh. Confirm: goal persists and student dashboards now reflect the updated goal. | | [ ] |

---

## Device and Browser Testing

All of the following must be tested manually. Use real devices, not browser simulators.

| Device / Browser | Login | Browse | Sign Up for Opp | Dashboard | Notes | Done |
|-----------------|-------|--------|-----------------|-----------|-------|------|
| iPhone (Safari) | | | | | | [ ] |
| iPhone (Chrome) | | | | | | [ ] |
| Android phone (Chrome) | | | | | | [ ] |
| Desktop — Chrome (macOS or Windows) | | | | | | [ ] |
| Desktop — Safari (macOS) | | | | | | [ ] |
| Desktop — Firefox | | | | | | [ ] |

For each: check that layout does not break, text is readable, buttons are tappable at normal screen sizes, and no horizontal scroll occurs on mobile.

---

## Email Flow Verification

| # | Test | Expected | Notes | Done |
|---|------|----------|-------|------|
| 1 | Trigger account signup verification email | Email arrives within 2 minutes | | [ ] |
| 2 | Confirm "Verify Email" link points to production domain (not localhost) | URL in email starts with `https://app.goodhours.app` or equivalent | | [ ] |
| 3 | Trigger "Forgot Password" flow | Password reset email arrives; reset link works end-to-end | | [ ] |
| 4 | Complete full password reset: click link → enter new password → log in with new password | Login succeeds with new password; old password rejected | | [ ] |
| 5 | Verify that no email links contain `localhost` or `127.0.0.1` | All links resolve to production domain | | [ ] |
| 6 | Check email rendering on mobile mail client (Gmail app, Apple Mail) | No broken layout, images load, CTA button is visible | | [ ] |

---

## CSV and PDF Export Verification

| # | File | Opened In | Columns / Content Correct | Notes | Done |
|---|------|-----------|--------------------------|-------|------|
| 1 | Student hours CSV | Excel (Windows or macOS) | Date, Opportunity, Organization, Hours, Status | | [ ] |
| 2 | Student hours CSV | Google Sheets | Same columns | | [ ] |
| 3 | Student hours PDF | Preview (macOS) or Acrobat | Student name, hours, org, dates | | [ ] |
| 4 | School report CSV | Excel | All students listed, hours accurate | | [ ] |
| 5 | School report CSV | Google Sheets | Same | | [ ] |

---

## Usability Observation Sessions

These sessions cannot be scripted. Find real users. Watch silently. Do not prompt or help unless they are completely stuck.

| # | Participant | Task Given | Friction Points Observed | Time to Complete | Done |
|---|------------|-----------|--------------------------|-----------------|------|
| 1 | A real student (high school or college age) | "Sign up and find a volunteering opportunity near you." | | | [ ] |
| 2 | A real student | "Check in to a session you signed up for." | | | [ ] |
| 3 | A nonprofit coordinator or volunteer manager | "Create a new volunteering opportunity for next Saturday." | | | [ ] |
| 4 | A school administrator (or someone familiar with admin software) | "Find how many hours your students have logged this semester." | | | [ ] |

Document all friction points. Any task that takes more than 3 minutes without the user reading instructions is a UX problem worth addressing before broad launch.

---

## Stripe Payment Flow (After Stripe Activation Only)

Do not complete this section until Stripe live mode is fully configured and tested in staging.

| # | Step | Notes | Done |
|---|------|-------|------|
| 1 | Navigate to the subscription or payment page | Page renders, no console errors | | [ ] |
| 2 | Enter a live test card (small amount, e.g., $1) | Payment completes successfully | | [ ] |
| 3 | Confirm subscription state reflected in app | Account shows correct plan/status | | [ ] |
| 4 | Issue a refund from Stripe dashboard | Confirm refund propagates correctly | | [ ] |
| 5 | Cancel subscription | App reflects cancellation at period end | | [ ] |

---

## Support and Legal

| # | Item | Notes | Done |
|---|------|-------|------|
| 1 | Send an email to `support@goodhours.app` (or the configured support address) | Confirm it arrives in a monitored inbox within 5 minutes | | [ ] |
| 2 | Read the Privacy Policy end-to-end | Confirm it accurately reflects what data is collected and how it is used | | [ ] |
| 3 | Read the Terms of Service end-to-end | Confirm it covers all user roles (students, orgs, schools) | | [ ] |
| 4 | Review Privacy Policy and ToS with a legal professional | FERPA, COPPA, and state-specific requirements reviewed | | [ ] |
| 5 | Confirm FERPA compliance for minor student data | School admin access scope reviewed; data sharing with third parties documented | | [ ] |
| 6 | Verify all student-facing copy uses plain language | No legal jargon in onboarding flows or error messages | | [ ] |

---

## Final Sign-Off

I, the founder, have personally completed or supervised every item in this checklist against the production (or staging equivalent) environment.

**Founder signature:** ___________________________  
**Date:** ___________________________  
**Environment tested:** ___________________________  
**Outstanding items to address before GA (if any):**

1.
2.
3.
