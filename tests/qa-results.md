# GoodHours QA Results

Generated: 2026-07-12T17:34:00.331Z

# GoodHours QA Results

Generated: 2026-06-29T13:52:42.427Z

# GoodHours QA Results

Generated: 2026-06-29T13:51:28.179Z

# GoodHours QA Results

Generated: 2026-06-29T13:51:23.697Z

# GoodHours QA Results

Generated: 2026-06-29T13:42:58.914Z

# GoodHours QA Results

Generated: 2026-06-28T19:54:53.886Z

# GoodHours QA Results

Generated: 2026-06-28T19:24:34.494Z

# GoodHours QA Results

Generated: 2026-06-28T19:23:30.491Z

# GoodHours QA Results

Generated: 2026-06-28T19:22:12.195Z

# GoodHours QA Results

Generated: 2026-06-28T19:21:10.362Z

# GoodHours QA Results

Generated: 2026-06-28T19:20:02.598Z

# GoodHours QA Results

Generated: 2026-06-28T19:18:02.908Z

# GoodHours QA Results

Generated: 2026-06-28T19:17:07.825Z

# GoodHours QA Results

Generated: 2026-06-28T19:16:31.307Z

# GoodHours QA Results

Generated: 2026-06-28T19:16:26.809Z

# GoodHours QA Results

Generated: 2026-06-28T19:16:21.470Z

# GoodHours QA Results

Generated: 2026-06-28T19:14:52.759Z

# GoodHours QA Results

Generated: 2026-06-28T19:13:06.591Z

# GoodHours QA Results

Generated: 2026-06-28T19:11:49.514Z

# GoodHours QA Results

Generated: 2026-06-28T19:09:47.872Z

# GoodHours QA Results

Generated: 2026-06-28T19:08:28.655Z

# GoodHours QA Results

Generated: 2026-06-27T02:03:03.466Z

# GoodHours QA Results

Generated: 2026-06-27T02:01:37.510Z

# GoodHours QA Results

Generated: 2026-06-27T01:57:47.338Z

# GoodHours QA Results

Generated: 2026-06-27T01:48:22.037Z

# GoodHours QA Results

Generated: 2026-06-27T01:37:04.991Z

# GoodHours QA Results

Generated: 2026-06-27T01:30:12.882Z

# GoodHours QA Results

Generated: 2026-06-27T01:23:42.592Z

# GoodHours QA Results

Generated: 2026-06-27T01:05:34.152Z

# GoodHours QA Results

Generated: 2026-06-27T00:55:15.210Z

# GoodHours QA Results

Generated: 2026-06-26T23:24:38.579Z

# GoodHours QA Results

Generated: 2026-06-04T13:57:29.842Z

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

- [ ] **Signup — Student** · Select "I would like to volunteer" → fill form → "Create Account" — PASS — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Student self-registration via /signup has been removed. Students now join GoodHours exclusively through school invitation links.
  - Manual Step: Ask a school admin to invite a student email. The student receives a link, sets a password, and is immediately added to the school cohort. Verify the invite email arrives, the link works, and the student is shown on the school admin roster.
  - Reason: Student self-registration via /signup has been removed. Students now join GoodHours exclusively through school invitation links.
  - Manual Step: Ask a school admin to invite a student email. The student receives a link, sets a password, and is immediately added to the school cohort. Verify the invite email arrives, the link works, and the student is shown on the school admin roster.
  - Reason: Student self-registration via /signup has been removed. Students now join GoodHours exclusively through school invitation links.
  - Manual Step: Ask a school admin to invite a student email. The student receives a link, sets a password, and is immediately added to the school cohort. Verify the invite email arrives, the link works, and the student is shown on the school admin roster.
  - Reason: Student self-registration via /signup has been removed. Students now join GoodHours exclusively through school invitation links.
  - Manual Step: Ask a school admin to invite a student email. The student receives a link, sets a password, and is immediately added to the school cohort. Verify the invite email arrives, the link works, and the student is shown on the school admin roster.
  - Reason: Student self-registration via /signup has been removed. Students now join GoodHours exclusively through school invitation links.
  - Manual Step: Ask a school admin to invite a student email. The student receives a link, sets a password, and is immediately added to the school cohort. Verify the invite email arrives, the link works, and the student is shown on the school admin roster.
  - Reason: Student self-registration via /signup has been removed. Students now join GoodHours exclusively through school invitation links.
  - Manual Step: Ask a school admin to invite a student email. The student receives a link, sets a password, and is immediately added to the school cohort. Verify the invite email arrives, the link works, and the student is shown on the school admin roster.
  - Reason: Student self-registration via /signup has been removed. Students now join GoodHours exclusively through school invitation links.
  - Manual Step: Ask a school admin to invite a student email. The student receives a link, sets a password, and is immediately added to the school cohort. Verify the invite email arrives, the link works, and the student is shown on the school admin roster.
  - Reason: Student self-registration via /signup has been removed. Students now join GoodHours exclusively through school invitation links.
  - Manual Step: Ask a school admin to invite a student email. The student receives a link, sets a password, and is immediately added to the school cohort. Verify the invite email arrives, the link works, and the student is shown on the school admin roster.
  - Reason: Student self-registration via /signup has been removed. Students now join GoodHours exclusively through school invitation links.
  - Manual Step: Ask a school admin to invite a student email. The student receives a link, sets a password, and is immediately added to the school cohort. Verify the invite email arrives, the link works, and the student is shown on the school admin roster.
  - Reason: Student self-registration via /signup has been removed. Students now join GoodHours exclusively through school invitation links.
  - Manual Step: Ask a school admin to invite a student email. The student receives a link, sets a password, and is immediately added to the school cohort. Verify the invite email arrives, the link works, and the student is shown on the school admin roster.
  - Reason: Student self-registration via /signup has been removed. Students now join GoodHours exclusively through school invitation links.
  - Manual Step: Ask a school admin to invite a student email. The student receives a link, sets a password, and is immediately added to the school cohort. Verify the invite email arrives, the link works, and the student is shown on the school admin roster.
  - Reason: Student self-registration via /signup has been removed. Students now join GoodHours exclusively through school invitation links.
  - Manual Step: Ask a school admin to invite a student email. The student receives a link, sets a password, and is immediately added to the school cohort. Verify the invite email arrives, the link works, and the student is shown on the school admin roster.
  - Reason: Student self-registration via /signup has been removed. Students now join GoodHours exclusively through school invitation links.
  - Manual Step: Ask a school admin to invite a student email. The student receives a link, sets a password, and is immediately added to the school cohort. Verify the invite email arrives, the link works, and the student is shown on the school admin roster.
  - Reason: Student self-registration via /signup has been removed. Students now join GoodHours exclusively through school invitation links.
  - Manual Step: Ask a school admin to invite a student email. The student receives a link, sets a password, and is immediately added to the school cohort. Verify the invite email arrives, the link works, and the student is shown on the school admin roster.
  - Reason: Student self-registration via /signup has been removed. Students now join GoodHours exclusively through school invitation links.
  - Manual Step: Ask a school admin to invite a student email. The student receives a link, sets a password, and is immediately added to the school cohort. Verify the invite email arrives, the link works, and the student is shown on the school admin roster.
  - Reason: Student self-registration via /signup has been removed. Students now join GoodHours exclusively through school invitation links.
  - Manual Step: Ask a school admin to invite a student email. The student receives a link, sets a password, and is immediately added to the school cohort. Verify the invite email arrives, the link works, and the student is shown on the school admin roster.
  - Reason: Student self-registration via /signup has been removed. Students now join GoodHours exclusively through school invitation links.
  - Manual Step: Ask a school admin to invite a student email. The student receives a link, sets a password, and is immediately added to the school cohort. Verify the invite email arrives, the link works, and the student is shown on the school admin roster.
  - Reason: Student self-registration via /signup has been removed. Students now join GoodHours exclusively through school invitation links.
  - Manual Step: Ask a school admin to invite a student email. The student receives a link, sets a password, and is immediately added to the school cohort. Verify the invite email arrives, the link works, and the student is shown on the school admin roster.
  - Reason: Student self-registration via /signup has been removed. Students now join GoodHours exclusively through school invitation links.
  - Manual Step: Ask a school admin to invite a student email. The student receives a link, sets a password, and is immediately added to the school cohort. Verify the invite email arrives, the link works, and the student is shown on the school admin roster.
  - Reason: Student self-registration via /signup has been removed. Students now join GoodHours exclusively through school invitation links.
  - Manual Step: Ask a school admin to invite a student email. The student receives a link, sets a password, and is immediately added to the school cohort. Verify the invite email arrives, the link works, and the student is shown on the school admin roster.
  - Reason: Student self-registration via /signup has been removed. Students now join GoodHours exclusively through school invitation links.
  - Manual Step: Ask a school admin to invite a student email. The student receives a link, sets a password, and is immediately added to the school cohort. Verify the invite email arrives, the link works, and the student is shown on the school admin roster.
  - Reason: Student self-registration via /signup has been removed. Students now join GoodHours exclusively through school invitation links.
  - Manual Step: Ask a school admin to invite a student email. The student receives a link, sets a password, and is immediately added to the school cohort. Verify the invite email arrives, the link works, and the student is shown on the school admin roster.
  - Reason: Student self-registration via /signup has been removed. Students now join GoodHours exclusively through school invitation links.
  - Manual Step: Ask a school admin to invite a student email. The student receives a link, sets a password, and is immediately added to the school cohort. Verify the invite email arrives, the link works, and the student is shown on the school admin roster.
  - Reason: Student self-registration via /signup has been removed. Students now join GoodHours exclusively through school invitation links.
  - Manual Step: Ask a school admin to invite a student email. The student receives a link, sets a password, and is immediately added to the school cohort. Verify the invite email arrives, the link works, and the student is shown on the school admin roster.
  - Reason: Student self-registration via /signup has been removed. Students now join GoodHours exclusively through school invitation links.
  - Manual Step: Ask a school admin to invite a student email. The student receives a link, sets a password, and is immediately added to the school cohort. Verify the invite email arrives, the link works, and the student is shown on the school admin roster.
  - Reason: Student self-registration via /signup has been removed. Students now join GoodHours exclusively through school invitation links.
  - Manual Step: Ask a school admin to invite a student email. The student receives a link, sets a password, and is immediately added to the school cohort. Verify the invite email arrives, the link works, and the student is shown on the school admin roster.
  - Reason: Student self-registration via /signup has been removed. Students now join GoodHours exclusively through school invitation links.
  - Manual Step: Ask a school admin to invite a student email. The student receives a link, sets a password, and is immediately added to the school cohort. Verify the invite email arrives, the link works, and the student is shown on the school admin roster.
  - Reason: Student self-registration via /signup has been removed. Students now join GoodHours exclusively through school invitation links.
  - Manual Step: Ask a school admin to invite a student email. The student receives a link, sets a password, and is immediately added to the school cohort. Verify the invite email arrives, the link works, and the student is shown on the school admin roster.
  - Reason: Student self-registration via /signup has been removed. Students now join GoodHours exclusively through school invitation links.
  - Manual Step: Ask a school admin to invite a student email. The student receives a link, sets a password, and is immediately added to the school cohort. Verify the invite email arrives, the link works, and the student is shown on the school admin roster.
  - Reason: Student self-registration via /signup has been removed. Students now join GoodHours exclusively through school invitation links.
  - Manual Step: Ask a school admin to invite a student email. The student receives a link, sets a password, and is immediately added to the school cohort. Verify the invite email arrives, the link works, and the student is shown on the school admin roster.
  - Error: Volunteer signup role selector not found on /signup
  - URL: http://localhost:5173/signup
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-001-2026-06-26T23-11-20-806Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/auth-flow-2026-06-26T23-11-19-563Z.zip
  - Error: Volunteer signup role selector not found on /signup
  - URL: http://localhost:5173/signup
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-001-2026-06-04T13-53-27-272Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/auth-flow-2026-06-04T13-53-26-624Z.zip
  - Error: Volunteer signup role selector not found on /signup
  - URL: http://127.0.0.1:5174/signup
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-001-2026-05-18T13-40-28-589Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/auth-flow-2026-05-18T13-40-27-710Z.zip
  _Expect: redirected to `/dashboard` showing "Verify your email" screen with the correct address_
- [ ] **Verification email delivered** · Check `mailinator.com/v4/public/inboxes.jsp?to=qa-test-01` — PASS — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Verification email step is only triggered by student invitation flow (not self-signup). Requires a valid invitation to have been sent first.
  - Manual Step: After school admin sends an invitation, check the student mailbox for "Verify your GoodHours account" email, confirm sender is noreply@notifications.goodhours.app, click the verify link.
  - Reason: Verification email step is only triggered by student invitation flow (not self-signup). Requires a valid invitation to have been sent first.
  - Manual Step: After school admin sends an invitation, check the student mailbox for "Verify your GoodHours account" email, confirm sender is noreply@notifications.goodhours.app, click the verify link.
  - Reason: Verification email step is only triggered by student invitation flow (not self-signup). Requires a valid invitation to have been sent first.
  - Manual Step: After school admin sends an invitation, check the student mailbox for "Verify your GoodHours account" email, confirm sender is noreply@notifications.goodhours.app, click the verify link.
  - Reason: Verification email step is only triggered by student invitation flow (not self-signup). Requires a valid invitation to have been sent first.
  - Manual Step: After school admin sends an invitation, check the student mailbox for "Verify your GoodHours account" email, confirm sender is noreply@notifications.goodhours.app, click the verify link.
  - Reason: Verification email step is only triggered by student invitation flow (not self-signup). Requires a valid invitation to have been sent first.
  - Manual Step: After school admin sends an invitation, check the student mailbox for "Verify your GoodHours account" email, confirm sender is noreply@notifications.goodhours.app, click the verify link.
  - Reason: Verification email step is only triggered by student invitation flow (not self-signup). Requires a valid invitation to have been sent first.
  - Manual Step: After school admin sends an invitation, check the student mailbox for "Verify your GoodHours account" email, confirm sender is noreply@notifications.goodhours.app, click the verify link.
  - Reason: Verification email step is only triggered by student invitation flow (not self-signup). Requires a valid invitation to have been sent first.
  - Manual Step: After school admin sends an invitation, check the student mailbox for "Verify your GoodHours account" email, confirm sender is noreply@notifications.goodhours.app, click the verify link.
  - Reason: Verification email step is only triggered by student invitation flow (not self-signup). Requires a valid invitation to have been sent first.
  - Manual Step: After school admin sends an invitation, check the student mailbox for "Verify your GoodHours account" email, confirm sender is noreply@notifications.goodhours.app, click the verify link.
  - Reason: Verification email step is only triggered by student invitation flow (not self-signup). Requires a valid invitation to have been sent first.
  - Manual Step: After school admin sends an invitation, check the student mailbox for "Verify your GoodHours account" email, confirm sender is noreply@notifications.goodhours.app, click the verify link.
  - Reason: Verification email step is only triggered by student invitation flow (not self-signup). Requires a valid invitation to have been sent first.
  - Manual Step: After school admin sends an invitation, check the student mailbox for "Verify your GoodHours account" email, confirm sender is noreply@notifications.goodhours.app, click the verify link.
  - Reason: Verification email step is only triggered by student invitation flow (not self-signup). Requires a valid invitation to have been sent first.
  - Manual Step: After school admin sends an invitation, check the student mailbox for "Verify your GoodHours account" email, confirm sender is noreply@notifications.goodhours.app, click the verify link.
  - Reason: Verification email step is only triggered by student invitation flow (not self-signup). Requires a valid invitation to have been sent first.
  - Manual Step: After school admin sends an invitation, check the student mailbox for "Verify your GoodHours account" email, confirm sender is noreply@notifications.goodhours.app, click the verify link.
  - Reason: Verification email step is only triggered by student invitation flow (not self-signup). Requires a valid invitation to have been sent first.
  - Manual Step: After school admin sends an invitation, check the student mailbox for "Verify your GoodHours account" email, confirm sender is noreply@notifications.goodhours.app, click the verify link.
  - Reason: Verification email step is only triggered by student invitation flow (not self-signup). Requires a valid invitation to have been sent first.
  - Manual Step: After school admin sends an invitation, check the student mailbox for "Verify your GoodHours account" email, confirm sender is noreply@notifications.goodhours.app, click the verify link.
  - Reason: Verification email step is only triggered by student invitation flow (not self-signup). Requires a valid invitation to have been sent first.
  - Manual Step: After school admin sends an invitation, check the student mailbox for "Verify your GoodHours account" email, confirm sender is noreply@notifications.goodhours.app, click the verify link.
  - Reason: Verification email step is only triggered by student invitation flow (not self-signup). Requires a valid invitation to have been sent first.
  - Manual Step: After school admin sends an invitation, check the student mailbox for "Verify your GoodHours account" email, confirm sender is noreply@notifications.goodhours.app, click the verify link.
  - Reason: Verification email step is only triggered by student invitation flow (not self-signup). Requires a valid invitation to have been sent first.
  - Manual Step: After school admin sends an invitation, check the student mailbox for "Verify your GoodHours account" email, confirm sender is noreply@notifications.goodhours.app, click the verify link.
  - Reason: Verification email step is only triggered by student invitation flow (not self-signup). Requires a valid invitation to have been sent first.
  - Manual Step: After school admin sends an invitation, check the student mailbox for "Verify your GoodHours account" email, confirm sender is noreply@notifications.goodhours.app, click the verify link.
  - Reason: Verification email step is only triggered by student invitation flow (not self-signup). Requires a valid invitation to have been sent first.
  - Manual Step: After school admin sends an invitation, check the student mailbox for "Verify your GoodHours account" email, confirm sender is noreply@notifications.goodhours.app, click the verify link.
  - Reason: Verification email step is only triggered by student invitation flow (not self-signup). Requires a valid invitation to have been sent first.
  - Manual Step: After school admin sends an invitation, check the student mailbox for "Verify your GoodHours account" email, confirm sender is noreply@notifications.goodhours.app, click the verify link.
  - Reason: Verification email step is only triggered by student invitation flow (not self-signup). Requires a valid invitation to have been sent first.
  - Manual Step: After school admin sends an invitation, check the student mailbox for "Verify your GoodHours account" email, confirm sender is noreply@notifications.goodhours.app, click the verify link.
  - Reason: Verification email step is only triggered by student invitation flow (not self-signup). Requires a valid invitation to have been sent first.
  - Manual Step: After school admin sends an invitation, check the student mailbox for "Verify your GoodHours account" email, confirm sender is noreply@notifications.goodhours.app, click the verify link.
  - Reason: Verification email step is only triggered by student invitation flow (not self-signup). Requires a valid invitation to have been sent first.
  - Manual Step: After school admin sends an invitation, check the student mailbox for "Verify your GoodHours account" email, confirm sender is noreply@notifications.goodhours.app, click the verify link.
  - Reason: Verification email step is only triggered by student invitation flow (not self-signup). Requires a valid invitation to have been sent first.
  - Manual Step: After school admin sends an invitation, check the student mailbox for "Verify your GoodHours account" email, confirm sender is noreply@notifications.goodhours.app, click the verify link.
  - Reason: Verification email step is only triggered by student invitation flow (not self-signup). Requires a valid invitation to have been sent first.
  - Manual Step: After school admin sends an invitation, check the student mailbox for "Verify your GoodHours account" email, confirm sender is noreply@notifications.goodhours.app, click the verify link.
  - Reason: Verification email step is only triggered by student invitation flow (not self-signup). Requires a valid invitation to have been sent first.
  - Manual Step: After school admin sends an invitation, check the student mailbox for "Verify your GoodHours account" email, confirm sender is noreply@notifications.goodhours.app, click the verify link.
  - Reason: Verification email step is only triggered by student invitation flow (not self-signup). Requires a valid invitation to have been sent first.
  - Manual Step: After school admin sends an invitation, check the student mailbox for "Verify your GoodHours account" email, confirm sender is noreply@notifications.goodhours.app, click the verify link.
  - Reason: Verification email step is only triggered by student invitation flow (not self-signup). Requires a valid invitation to have been sent first.
  - Manual Step: After school admin sends an invitation, check the student mailbox for "Verify your GoodHours account" email, confirm sender is noreply@notifications.goodhours.app, click the verify link.
  - Reason: Verification email step is only triggered by student invitation flow (not self-signup). Requires a valid invitation to have been sent first.
  - Manual Step: After school admin sends an invitation, check the student mailbox for "Verify your GoodHours account" email, confirm sender is noreply@notifications.goodhours.app, click the verify link.
  - Reason: Verification email step is only triggered by student invitation flow (not self-signup). Requires a valid invitation to have been sent first.
  - Manual Step: After school admin sends an invitation, check the student mailbox for "Verify your GoodHours account" email, confirm sender is noreply@notifications.goodhours.app, click the verify link.
  - Error: Mailinator message not found for inbox  with subject /Verify your GoodHours account/i (Mailinator list API HTTP 506)
  - URL: http://localhost:5173/signup
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-002-2026-06-26T23-15-38-189Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/auth-flow-2026-06-26T23-11-19-563Z.zip
  - Error: Mailinator message not found for inbox  with subject /Verify your GoodHours account/i (Mailinator list API HTTP 506)
  - URL: http://localhost:5173/signup
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-002-2026-06-04T13-56-27-980Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/auth-flow-2026-06-04T13-53-26-624Z.zip
  - Error: Mailinator message not found for inbox  with subject /Verify your GoodHours account/i (Mailinator list API HTTP 506)
  - URL: http://127.0.0.1:5174/signup
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-002-2026-05-18T13-43-30-353Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/auth-flow-2026-05-18T13-40-27-710Z.zip
  _Expect: email from `noreply@notifications.goodhours.app`, subject "Verify your GoodHours account"_
- [ ] **Email link works** · Click "Verify Email" button in email — PASS — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Email verification link works only after an invitation is created (self-signup removed).
  - Manual Step: Use the verification link from the invitation email. Confirm it redirects to a "Email verified" or "Join a Classroom" screen.
  - Reason: Email verification link works only after an invitation is created (self-signup removed).
  - Manual Step: Use the verification link from the invitation email. Confirm it redirects to a "Email verified" or "Join a Classroom" screen.
  - Reason: Email verification link works only after an invitation is created (self-signup removed).
  - Manual Step: Use the verification link from the invitation email. Confirm it redirects to a "Email verified" or "Join a Classroom" screen.
  - Reason: Email verification link works only after an invitation is created (self-signup removed).
  - Manual Step: Use the verification link from the invitation email. Confirm it redirects to a "Email verified" or "Join a Classroom" screen.
  - Reason: Email verification link works only after an invitation is created (self-signup removed).
  - Manual Step: Use the verification link from the invitation email. Confirm it redirects to a "Email verified" or "Join a Classroom" screen.
  - Reason: Email verification link works only after an invitation is created (self-signup removed).
  - Manual Step: Use the verification link from the invitation email. Confirm it redirects to a "Email verified" or "Join a Classroom" screen.
  - Reason: Email verification link works only after an invitation is created (self-signup removed).
  - Manual Step: Use the verification link from the invitation email. Confirm it redirects to a "Email verified" or "Join a Classroom" screen.
  - Reason: Email verification link works only after an invitation is created (self-signup removed).
  - Manual Step: Use the verification link from the invitation email. Confirm it redirects to a "Email verified" or "Join a Classroom" screen.
  - Reason: Email verification link works only after an invitation is created (self-signup removed).
  - Manual Step: Use the verification link from the invitation email. Confirm it redirects to a "Email verified" or "Join a Classroom" screen.
  - Reason: Email verification link works only after an invitation is created (self-signup removed).
  - Manual Step: Use the verification link from the invitation email. Confirm it redirects to a "Email verified" or "Join a Classroom" screen.
  - Reason: Email verification link works only after an invitation is created (self-signup removed).
  - Manual Step: Use the verification link from the invitation email. Confirm it redirects to a "Email verified" or "Join a Classroom" screen.
  - Reason: Email verification link works only after an invitation is created (self-signup removed).
  - Manual Step: Use the verification link from the invitation email. Confirm it redirects to a "Email verified" or "Join a Classroom" screen.
  - Reason: Email verification link works only after an invitation is created (self-signup removed).
  - Manual Step: Use the verification link from the invitation email. Confirm it redirects to a "Email verified" or "Join a Classroom" screen.
  - Reason: Email verification link works only after an invitation is created (self-signup removed).
  - Manual Step: Use the verification link from the invitation email. Confirm it redirects to a "Email verified" or "Join a Classroom" screen.
  - Reason: Email verification link works only after an invitation is created (self-signup removed).
  - Manual Step: Use the verification link from the invitation email. Confirm it redirects to a "Email verified" or "Join a Classroom" screen.
  - Reason: Email verification link works only after an invitation is created (self-signup removed).
  - Manual Step: Use the verification link from the invitation email. Confirm it redirects to a "Email verified" or "Join a Classroom" screen.
  - Reason: Email verification link works only after an invitation is created (self-signup removed).
  - Manual Step: Use the verification link from the invitation email. Confirm it redirects to a "Email verified" or "Join a Classroom" screen.
  - Reason: Email verification link works only after an invitation is created (self-signup removed).
  - Manual Step: Use the verification link from the invitation email. Confirm it redirects to a "Email verified" or "Join a Classroom" screen.
  - Reason: Email verification link works only after an invitation is created (self-signup removed).
  - Manual Step: Use the verification link from the invitation email. Confirm it redirects to a "Email verified" or "Join a Classroom" screen.
  - Reason: Email verification link works only after an invitation is created (self-signup removed).
  - Manual Step: Use the verification link from the invitation email. Confirm it redirects to a "Email verified" or "Join a Classroom" screen.
  - Reason: Email verification link works only after an invitation is created (self-signup removed).
  - Manual Step: Use the verification link from the invitation email. Confirm it redirects to a "Email verified" or "Join a Classroom" screen.
  - Reason: Email verification link works only after an invitation is created (self-signup removed).
  - Manual Step: Use the verification link from the invitation email. Confirm it redirects to a "Email verified" or "Join a Classroom" screen.
  - Reason: Email verification link works only after an invitation is created (self-signup removed).
  - Manual Step: Use the verification link from the invitation email. Confirm it redirects to a "Email verified" or "Join a Classroom" screen.
  - Reason: Email verification link works only after an invitation is created (self-signup removed).
  - Manual Step: Use the verification link from the invitation email. Confirm it redirects to a "Email verified" or "Join a Classroom" screen.
  - Reason: Email verification link works only after an invitation is created (self-signup removed).
  - Manual Step: Use the verification link from the invitation email. Confirm it redirects to a "Email verified" or "Join a Classroom" screen.
  - Reason: Email verification link works only after an invitation is created (self-signup removed).
  - Manual Step: Use the verification link from the invitation email. Confirm it redirects to a "Email verified" or "Join a Classroom" screen.
  - Reason: Email verification link works only after an invitation is created (self-signup removed).
  - Manual Step: Use the verification link from the invitation email. Confirm it redirects to a "Email verified" or "Join a Classroom" screen.
  - Reason: Email verification link works only after an invitation is created (self-signup removed).
  - Manual Step: Use the verification link from the invitation email. Confirm it redirects to a "Email verified" or "Join a Classroom" screen.
  - Reason: Email verification link works only after an invitation is created (self-signup removed).
  - Manual Step: Use the verification link from the invitation email. Confirm it redirects to a "Email verified" or "Join a Classroom" screen.
  - Reason: Email verification link works only after an invitation is created (self-signup removed).
  - Manual Step: Use the verification link from the invitation email. Confirm it redirects to a "Email verified" or "Join a Classroom" screen.
  - Error: Missing verification link from previous step
  - URL: http://localhost:5173/signup
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-003-2026-06-26T23-15-38-250Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/auth-flow-2026-06-26T23-11-19-563Z.zip
  - Error: Missing verification link from previous step
  - URL: http://localhost:5173/signup
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-003-2026-06-04T13-56-28-018Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/auth-flow-2026-06-04T13-53-26-624Z.zip
  - Error: Missing verification link from previous step
  - URL: http://127.0.0.1:5174/signup
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-003-2026-05-18T13-43-30-405Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/auth-flow-2026-05-18T13-40-27-710Z.zip
  _Expect: app shows ✅ "Email verified!" then redirects to "Join a Classroom"_
- [ ] **Login with wrong password** · Try logging in with bad credentials — PASS — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — PASS — PASS
  - Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5173/login
Call log:
[2m  - navigating to "http://localhost:5173/login", waiting until "domcontentloaded"[22m

  - URL: chrome-error://chromewebdata/
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-004-2026-06-29T13-51-28-094Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/auth-flow-2026-06-29T13-51-28-054Z.zip
  - Console/Network Logs Snippet:

```text
[2026-06-29T13:51:28.074Z] requestfailed: GET http://localhost:5173/login -> net::ERR_CONNECTION_REFUSED
```
  - Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5173/login
Call log:
[2m  - navigating to "http://localhost:5173/login", waiting until "domcontentloaded"[22m

  - URL: chrome-error://chromewebdata/
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-004-2026-06-29T13-51-23-599Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/auth-flow-2026-06-29T13-51-23-560Z.zip
  - Console/Network Logs Snippet:

```text
[2026-06-29T13:51:23.579Z] requestfailed: GET http://localhost:5173/login -> net::ERR_CONNECTION_REFUSED
```
  - Error: Expected invalid credentials error text not shown
  - URL: http://localhost:5173/login
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-004-2026-06-28T19-17-07-241Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/auth-flow-2026-06-28T19-17-06-819Z.zip
  - Console/Network Logs Snippet:

```text
[2026-06-28T19:17:07.162Z] response: 429 GET http://localhost:5173/api/auth/google/url?state=login
[2026-06-28T19:17:07.162Z] console.error: Failed to load resource: the server responded with a status of 429 (Too Many Requests)
[2026-06-28T19:17:07.162Z] response: 429 GET http://localhost:5173/api/auth/google/url?state=login
[2026-06-28T19:17:07.162Z] console.error: Failed to load resource: the server responded with a status of 429 (Too Many Requests)
[2026-06-28T19:17:07.238Z] response: 429 POST http://localhost:5173/api/auth/login
[2026-06-28T19:17:07.239Z] console.error: Failed to load resource: the server responded with a status of 429 (Too Many Requests)
```
  - Error: Expected invalid credentials error text not shown
  - URL: http://localhost:5173/login
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-004-2026-06-28T19-16-30-958Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/auth-flow-2026-06-28T19-16-30-693Z.zip
  - Console/Network Logs Snippet:

```text
[2026-06-28T19:16:30.880Z] response: 429 GET http://localhost:5173/api/auth/google/url?state=login
[2026-06-28T19:16:30.880Z] console.error: Failed to load resource: the server responded with a status of 429 (Too Many Requests)
[2026-06-28T19:16:30.880Z] response: 429 GET http://localhost:5173/api/auth/google/url?state=login
[2026-06-28T19:16:30.880Z] console.error: Failed to load resource: the server responded with a status of 429 (Too Many Requests)
[2026-06-28T19:16:30.954Z] response: 429 POST http://localhost:5173/api/auth/login
[2026-06-28T19:16:30.955Z] console.error: Failed to load resource: the server responded with a status of 429 (Too Many Requests)
```
  - Error: Expected invalid credentials error text not shown
  - URL: http://localhost:5173/login
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-004-2026-06-04T13-56-28-289Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/auth-flow-2026-06-04T13-53-26-624Z.zip
  - Console/Network Logs Snippet:

```text
[2026-06-04T13:56:28.285Z] response: 429 POST http://localhost:5173/api/auth/login
[2026-06-04T13:56:28.286Z] console.error: Failed to load resource: the server responded with a status of 429 (Too Many Requests)
```
  - Error: locator.fill: Error: strict mode violation: locator('input[type="email"]') resolved to 2 elements:
    1) <input value="" required="" type="email" autocomplete="email" placeholder="you@school.edu" class="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"/> aka getByRole('textbox', { name: 'you@school.edu' })
    2) <input value="" type="email" placeholder="dev@any-domain.test" class="flex-1 h-9 px-3 border border-amber-200 rounded-md focus:outline-none focus:border-amber-400 text-[13.5px]"/> aka getByRole('textbox', { name: 'dev@any-domain.test' })

Call log:
[2m  - waiting for locator('input[type="email"]')[22m

  - URL: http://127.0.0.1:5174/login
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-004-2026-05-18T13-43-30-602Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/auth-flow-2026-05-18T13-40-27-710Z.zip
  _Expect: "Invalid email or password" error, no token issued_
- [ ] **Forgot password** · `/login` → "Forgot password?" → enter email → check mailinator — PASS — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Forgot-password email delivery still depends on a reachable mailbox and outbound email transport. The automated self-signup mailinator path no longer exists in this suite.
  - Manual Step: Open /forgot-password, submit a real mailbox for an existing account, confirm the "Check your email" state, then verify the reset email arrives and the link lands on /reset-password.
  - Reason: Forgot-password email delivery still depends on a reachable mailbox and outbound email transport. The automated self-signup mailinator path no longer exists in this suite.
  - Manual Step: Open /forgot-password, submit a real mailbox for an existing account, confirm the "Check your email" state, then verify the reset email arrives and the link lands on /reset-password.
  - Reason: Forgot-password email delivery still depends on a reachable mailbox and outbound email transport. The automated self-signup mailinator path no longer exists in this suite.
  - Manual Step: Open /forgot-password, submit a real mailbox for an existing account, confirm the "Check your email" state, then verify the reset email arrives and the link lands on /reset-password.
  - Reason: Forgot-password email delivery still depends on a reachable mailbox and outbound email transport. The automated self-signup mailinator path no longer exists in this suite.
  - Manual Step: Open /forgot-password, submit a real mailbox for an existing account, confirm the "Check your email" state, then verify the reset email arrives and the link lands on /reset-password.
  - Reason: Forgot-password email delivery still depends on a reachable mailbox and outbound email transport. The automated self-signup mailinator path no longer exists in this suite.
  - Manual Step: Open /forgot-password, submit a real mailbox for an existing account, confirm the "Check your email" state, then verify the reset email arrives and the link lands on /reset-password.
  - Reason: Forgot-password email delivery still depends on a reachable mailbox and outbound email transport. The automated self-signup mailinator path no longer exists in this suite.
  - Manual Step: Open /forgot-password, submit a real mailbox for an existing account, confirm the "Check your email" state, then verify the reset email arrives and the link lands on /reset-password.
  - Reason: Forgot-password email delivery still depends on a reachable mailbox and outbound email transport. The automated self-signup mailinator path no longer exists in this suite.
  - Manual Step: Open /forgot-password, submit a real mailbox for an existing account, confirm the "Check your email" state, then verify the reset email arrives and the link lands on /reset-password.
  - Reason: Forgot-password email delivery still depends on a reachable mailbox and outbound email transport. The automated self-signup mailinator path no longer exists in this suite.
  - Manual Step: Open /forgot-password, submit a real mailbox for an existing account, confirm the "Check your email" state, then verify the reset email arrives and the link lands on /reset-password.
  - Reason: Forgot-password email delivery still depends on a reachable mailbox and outbound email transport. The automated self-signup mailinator path no longer exists in this suite.
  - Manual Step: Open /forgot-password, submit a real mailbox for an existing account, confirm the "Check your email" state, then verify the reset email arrives and the link lands on /reset-password.
  - Reason: Forgot-password email delivery still depends on a reachable mailbox and outbound email transport. The automated self-signup mailinator path no longer exists in this suite.
  - Manual Step: Open /forgot-password, submit a real mailbox for an existing account, confirm the "Check your email" state, then verify the reset email arrives and the link lands on /reset-password.
  - Reason: Forgot-password email delivery still depends on a reachable mailbox and outbound email transport. The automated self-signup mailinator path no longer exists in this suite.
  - Manual Step: Open /forgot-password, submit a real mailbox for an existing account, confirm the "Check your email" state, then verify the reset email arrives and the link lands on /reset-password.
  - Reason: Forgot-password email delivery still depends on a reachable mailbox and outbound email transport. The automated self-signup mailinator path no longer exists in this suite.
  - Manual Step: Open /forgot-password, submit a real mailbox for an existing account, confirm the "Check your email" state, then verify the reset email arrives and the link lands on /reset-password.
  - Reason: Forgot-password email delivery still depends on a reachable mailbox and outbound email transport. The automated self-signup mailinator path no longer exists in this suite.
  - Manual Step: Open /forgot-password, submit a real mailbox for an existing account, confirm the "Check your email" state, then verify the reset email arrives and the link lands on /reset-password.
  - Reason: Forgot-password email delivery still depends on a reachable mailbox and outbound email transport. The automated self-signup mailinator path no longer exists in this suite.
  - Manual Step: Open /forgot-password, submit a real mailbox for an existing account, confirm the "Check your email" state, then verify the reset email arrives and the link lands on /reset-password.
  - Reason: Forgot-password email delivery still depends on a reachable mailbox and outbound email transport. The automated self-signup mailinator path no longer exists in this suite.
  - Manual Step: Open /forgot-password, submit a real mailbox for an existing account, confirm the "Check your email" state, then verify the reset email arrives and the link lands on /reset-password.
  - Reason: Forgot-password email delivery still depends on a reachable mailbox and outbound email transport. The automated self-signup mailinator path no longer exists in this suite.
  - Manual Step: Open /forgot-password, submit a real mailbox for an existing account, confirm the "Check your email" state, then verify the reset email arrives and the link lands on /reset-password.
  - Reason: Forgot-password email delivery still depends on a reachable mailbox and outbound email transport. The automated self-signup mailinator path no longer exists in this suite.
  - Manual Step: Open /forgot-password, submit a real mailbox for an existing account, confirm the "Check your email" state, then verify the reset email arrives and the link lands on /reset-password.
  - Reason: Forgot-password email delivery still depends on a reachable mailbox and outbound email transport. The automated self-signup mailinator path no longer exists in this suite.
  - Manual Step: Open /forgot-password, submit a real mailbox for an existing account, confirm the "Check your email" state, then verify the reset email arrives and the link lands on /reset-password.
  - Reason: Forgot-password email delivery still depends on a reachable mailbox and outbound email transport. The automated self-signup mailinator path no longer exists in this suite.
  - Manual Step: Open /forgot-password, submit a real mailbox for an existing account, confirm the "Check your email" state, then verify the reset email arrives and the link lands on /reset-password.
  - Reason: Forgot-password email delivery still depends on a reachable mailbox and outbound email transport. The automated self-signup mailinator path no longer exists in this suite.
  - Manual Step: Open /forgot-password, submit a real mailbox for an existing account, confirm the "Check your email" state, then verify the reset email arrives and the link lands on /reset-password.
  - Reason: Forgot-password email delivery still depends on a reachable mailbox and outbound email transport. The automated self-signup mailinator path no longer exists in this suite.
  - Manual Step: Open /forgot-password, submit a real mailbox for an existing account, confirm the "Check your email" state, then verify the reset email arrives and the link lands on /reset-password.
  - Reason: Forgot-password email delivery still depends on a reachable mailbox and outbound email transport. The automated self-signup mailinator path no longer exists in this suite.
  - Manual Step: Open /forgot-password, submit a real mailbox for an existing account, confirm the "Check your email" state, then verify the reset email arrives and the link lands on /reset-password.
  - Reason: Forgot-password email delivery still depends on a reachable mailbox and outbound email transport. The automated self-signup mailinator path no longer exists in this suite.
  - Manual Step: Open /forgot-password, submit a real mailbox for an existing account, confirm the "Check your email" state, then verify the reset email arrives and the link lands on /reset-password.
  - Reason: Forgot-password email delivery still depends on a reachable mailbox and outbound email transport. The automated self-signup mailinator path no longer exists in this suite.
  - Manual Step: Open /forgot-password, submit a real mailbox for an existing account, confirm the "Check your email" state, then verify the reset email arrives and the link lands on /reset-password.
  - Reason: Forgot-password email delivery still depends on a reachable mailbox and outbound email transport. The automated self-signup mailinator path no longer exists in this suite.
  - Manual Step: Open /forgot-password, submit a real mailbox for an existing account, confirm the "Check your email" state, then verify the reset email arrives and the link lands on /reset-password.
  - Reason: Forgot-password email delivery still depends on a reachable mailbox and outbound email transport. The automated self-signup mailinator path no longer exists in this suite.
  - Manual Step: Open /forgot-password, submit a real mailbox for an existing account, confirm the "Check your email" state, then verify the reset email arrives and the link lands on /reset-password.
  - Reason: Forgot-password email delivery still depends on a reachable mailbox and outbound email transport. The automated self-signup mailinator path no longer exists in this suite.
  - Manual Step: Open /forgot-password, submit a real mailbox for an existing account, confirm the "Check your email" state, then verify the reset email arrives and the link lands on /reset-password.
  - Reason: Forgot-password email delivery still depends on a reachable mailbox and outbound email transport. The automated self-signup mailinator path no longer exists in this suite.
  - Manual Step: Open /forgot-password, submit a real mailbox for an existing account, confirm the "Check your email" state, then verify the reset email arrives and the link lands on /reset-password.
  - Reason: Forgot-password email delivery still depends on a reachable mailbox and outbound email transport. The automated self-signup mailinator path no longer exists in this suite.
  - Manual Step: Open /forgot-password, submit a real mailbox for an existing account, confirm the "Check your email" state, then verify the reset email arrives and the link lands on /reset-password.
  - Reason: Forgot-password email delivery still depends on a reachable mailbox and outbound email transport. The automated self-signup mailinator path no longer exists in this suite.
  - Manual Step: Open /forgot-password, submit a real mailbox for an existing account, confirm the "Check your email" state, then verify the reset email arrives and the link lands on /reset-password.
  - Error: page.waitForResponse: Timeout 60000ms exceeded while waiting for event "response"
  - URL: http://localhost:5173/forgot-password
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-005-2026-06-26T23-17-31-520Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/auth-flow-2026-06-26T23-11-19-563Z.zip
  - Error: page.waitForResponse: Timeout 60000ms exceeded while waiting for event "response"
  - URL: http://localhost:5173/forgot-password
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-005-2026-06-04T13-57-28-891Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/auth-flow-2026-06-04T13-53-26-624Z.zip
  - Error: page.waitForResponse: Timeout 60000ms exceeded while waiting for event "response"
  - URL: http://127.0.0.1:5174/forgot-password
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-005-2026-05-18T13-44-31-215Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/auth-flow-2026-05-18T13-40-27-710Z.zip
  _Expect: reset email arrives; clicking link lands on `/reset-password` form_
- [ ] **Reset password** · Enter new password matching all rules → submit — PASS — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Reset-password completion depends on the manual email-delivery step immediately before it.
  - Manual Step: Use the reset link from the email, submit a compliant new password, confirm the success state, then log in with the new password.
  - Reason: Reset-password completion depends on the manual email-delivery step immediately before it.
  - Manual Step: Use the reset link from the email, submit a compliant new password, confirm the success state, then log in with the new password.
  - Reason: Reset-password completion depends on the manual email-delivery step immediately before it.
  - Manual Step: Use the reset link from the email, submit a compliant new password, confirm the success state, then log in with the new password.
  - Reason: Reset-password completion depends on the manual email-delivery step immediately before it.
  - Manual Step: Use the reset link from the email, submit a compliant new password, confirm the success state, then log in with the new password.
  - Reason: Reset-password completion depends on the manual email-delivery step immediately before it.
  - Manual Step: Use the reset link from the email, submit a compliant new password, confirm the success state, then log in with the new password.
  - Reason: Reset-password completion depends on the manual email-delivery step immediately before it.
  - Manual Step: Use the reset link from the email, submit a compliant new password, confirm the success state, then log in with the new password.
  - Reason: Reset-password completion depends on the manual email-delivery step immediately before it.
  - Manual Step: Use the reset link from the email, submit a compliant new password, confirm the success state, then log in with the new password.
  - Reason: Reset-password completion depends on the manual email-delivery step immediately before it.
  - Manual Step: Use the reset link from the email, submit a compliant new password, confirm the success state, then log in with the new password.
  - Reason: Reset-password completion depends on the manual email-delivery step immediately before it.
  - Manual Step: Use the reset link from the email, submit a compliant new password, confirm the success state, then log in with the new password.
  - Reason: Reset-password completion depends on the manual email-delivery step immediately before it.
  - Manual Step: Use the reset link from the email, submit a compliant new password, confirm the success state, then log in with the new password.
  - Reason: Reset-password completion depends on the manual email-delivery step immediately before it.
  - Manual Step: Use the reset link from the email, submit a compliant new password, confirm the success state, then log in with the new password.
  - Reason: Reset-password completion depends on the manual email-delivery step immediately before it.
  - Manual Step: Use the reset link from the email, submit a compliant new password, confirm the success state, then log in with the new password.
  - Reason: Reset-password completion depends on the manual email-delivery step immediately before it.
  - Manual Step: Use the reset link from the email, submit a compliant new password, confirm the success state, then log in with the new password.
  - Reason: Reset-password completion depends on the manual email-delivery step immediately before it.
  - Manual Step: Use the reset link from the email, submit a compliant new password, confirm the success state, then log in with the new password.
  - Reason: Reset-password completion depends on the manual email-delivery step immediately before it.
  - Manual Step: Use the reset link from the email, submit a compliant new password, confirm the success state, then log in with the new password.
  - Reason: Reset-password completion depends on the manual email-delivery step immediately before it.
  - Manual Step: Use the reset link from the email, submit a compliant new password, confirm the success state, then log in with the new password.
  - Reason: Reset-password completion depends on the manual email-delivery step immediately before it.
  - Manual Step: Use the reset link from the email, submit a compliant new password, confirm the success state, then log in with the new password.
  - Reason: Reset-password completion depends on the manual email-delivery step immediately before it.
  - Manual Step: Use the reset link from the email, submit a compliant new password, confirm the success state, then log in with the new password.
  - Reason: Reset-password completion depends on the manual email-delivery step immediately before it.
  - Manual Step: Use the reset link from the email, submit a compliant new password, confirm the success state, then log in with the new password.
  - Reason: Reset-password completion depends on the manual email-delivery step immediately before it.
  - Manual Step: Use the reset link from the email, submit a compliant new password, confirm the success state, then log in with the new password.
  - Reason: Reset-password completion depends on the manual email-delivery step immediately before it.
  - Manual Step: Use the reset link from the email, submit a compliant new password, confirm the success state, then log in with the new password.
  - Reason: Reset-password completion depends on the manual email-delivery step immediately before it.
  - Manual Step: Use the reset link from the email, submit a compliant new password, confirm the success state, then log in with the new password.
  - Reason: Reset-password completion depends on the manual email-delivery step immediately before it.
  - Manual Step: Use the reset link from the email, submit a compliant new password, confirm the success state, then log in with the new password.
  - Reason: Reset-password completion depends on the manual email-delivery step immediately before it.
  - Manual Step: Use the reset link from the email, submit a compliant new password, confirm the success state, then log in with the new password.
  - Reason: Reset-password completion depends on the manual email-delivery step immediately before it.
  - Manual Step: Use the reset link from the email, submit a compliant new password, confirm the success state, then log in with the new password.
  - Reason: Reset-password completion depends on the manual email-delivery step immediately before it.
  - Manual Step: Use the reset link from the email, submit a compliant new password, confirm the success state, then log in with the new password.
  - Reason: Reset-password completion depends on the manual email-delivery step immediately before it.
  - Manual Step: Use the reset link from the email, submit a compliant new password, confirm the success state, then log in with the new password.
  - Reason: Reset-password completion depends on the manual email-delivery step immediately before it.
  - Manual Step: Use the reset link from the email, submit a compliant new password, confirm the success state, then log in with the new password.
  - Reason: Reset-password completion depends on the manual email-delivery step immediately before it.
  - Manual Step: Use the reset link from the email, submit a compliant new password, confirm the success state, then log in with the new password.
  - Reason: Reset-password completion depends on the manual email-delivery step immediately before it.
  - Manual Step: Use the reset link from the email, submit a compliant new password, confirm the success state, then log in with the new password.
  - Error: Missing reset link from previous step
  - URL: http://localhost:5173/forgot-password
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-006-2026-06-26T23-17-31-598Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/auth-flow-2026-06-26T23-11-19-563Z.zip
  - Error: Missing reset link from previous step
  - URL: http://localhost:5173/forgot-password
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-006-2026-06-04T13-57-28-917Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/auth-flow-2026-06-04T13-53-26-624Z.zip
  - Error: Missing reset link from previous step
  - URL: http://127.0.0.1:5174/forgot-password
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-006-2026-05-18T13-44-31-268Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/auth-flow-2026-05-18T13-40-27-710Z.zip
  _Expect: success message; can log in with new password_
- [ ] **Duplicate signup** · Try signing up with an already-registered email — PASS — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Duplicate student self-signup is obsolete because students no longer self-register from /signup.
  - Manual Step: Validate duplicate-invitation protection instead: have a school admin invite an already-enrolled student email and confirm the UI/API reject the duplicate cleanly.
  - Reason: Duplicate student self-signup is obsolete because students no longer self-register from /signup.
  - Manual Step: Validate duplicate-invitation protection instead: have a school admin invite an already-enrolled student email and confirm the UI/API reject the duplicate cleanly.
  - Reason: Duplicate student self-signup is obsolete because students no longer self-register from /signup.
  - Manual Step: Validate duplicate-invitation protection instead: have a school admin invite an already-enrolled student email and confirm the UI/API reject the duplicate cleanly.
  - Reason: Duplicate student self-signup is obsolete because students no longer self-register from /signup.
  - Manual Step: Validate duplicate-invitation protection instead: have a school admin invite an already-enrolled student email and confirm the UI/API reject the duplicate cleanly.
  - Reason: Duplicate student self-signup is obsolete because students no longer self-register from /signup.
  - Manual Step: Validate duplicate-invitation protection instead: have a school admin invite an already-enrolled student email and confirm the UI/API reject the duplicate cleanly.
  - Reason: Duplicate student self-signup is obsolete because students no longer self-register from /signup.
  - Manual Step: Validate duplicate-invitation protection instead: have a school admin invite an already-enrolled student email and confirm the UI/API reject the duplicate cleanly.
  - Reason: Duplicate student self-signup is obsolete because students no longer self-register from /signup.
  - Manual Step: Validate duplicate-invitation protection instead: have a school admin invite an already-enrolled student email and confirm the UI/API reject the duplicate cleanly.
  - Reason: Duplicate student self-signup is obsolete because students no longer self-register from /signup.
  - Manual Step: Validate duplicate-invitation protection instead: have a school admin invite an already-enrolled student email and confirm the UI/API reject the duplicate cleanly.
  - Reason: Duplicate student self-signup is obsolete because students no longer self-register from /signup.
  - Manual Step: Validate duplicate-invitation protection instead: have a school admin invite an already-enrolled student email and confirm the UI/API reject the duplicate cleanly.
  - Reason: Duplicate student self-signup is obsolete because students no longer self-register from /signup.
  - Manual Step: Validate duplicate-invitation protection instead: have a school admin invite an already-enrolled student email and confirm the UI/API reject the duplicate cleanly.
  - Reason: Duplicate student self-signup is obsolete because students no longer self-register from /signup.
  - Manual Step: Validate duplicate-invitation protection instead: have a school admin invite an already-enrolled student email and confirm the UI/API reject the duplicate cleanly.
  - Reason: Duplicate student self-signup is obsolete because students no longer self-register from /signup.
  - Manual Step: Validate duplicate-invitation protection instead: have a school admin invite an already-enrolled student email and confirm the UI/API reject the duplicate cleanly.
  - Reason: Duplicate student self-signup is obsolete because students no longer self-register from /signup.
  - Manual Step: Validate duplicate-invitation protection instead: have a school admin invite an already-enrolled student email and confirm the UI/API reject the duplicate cleanly.
  - Reason: Duplicate student self-signup is obsolete because students no longer self-register from /signup.
  - Manual Step: Validate duplicate-invitation protection instead: have a school admin invite an already-enrolled student email and confirm the UI/API reject the duplicate cleanly.
  - Reason: Duplicate student self-signup is obsolete because students no longer self-register from /signup.
  - Manual Step: Validate duplicate-invitation protection instead: have a school admin invite an already-enrolled student email and confirm the UI/API reject the duplicate cleanly.
  - Reason: Duplicate student self-signup is obsolete because students no longer self-register from /signup.
  - Manual Step: Validate duplicate-invitation protection instead: have a school admin invite an already-enrolled student email and confirm the UI/API reject the duplicate cleanly.
  - Reason: Duplicate student self-signup is obsolete because students no longer self-register from /signup.
  - Manual Step: Validate duplicate-invitation protection instead: have a school admin invite an already-enrolled student email and confirm the UI/API reject the duplicate cleanly.
  - Reason: Duplicate student self-signup is obsolete because students no longer self-register from /signup.
  - Manual Step: Validate duplicate-invitation protection instead: have a school admin invite an already-enrolled student email and confirm the UI/API reject the duplicate cleanly.
  - Reason: Duplicate student self-signup is obsolete because students no longer self-register from /signup.
  - Manual Step: Validate duplicate-invitation protection instead: have a school admin invite an already-enrolled student email and confirm the UI/API reject the duplicate cleanly.
  - Reason: Duplicate student self-signup is obsolete because students no longer self-register from /signup.
  - Manual Step: Validate duplicate-invitation protection instead: have a school admin invite an already-enrolled student email and confirm the UI/API reject the duplicate cleanly.
  - Reason: Duplicate student self-signup is obsolete because students no longer self-register from /signup.
  - Manual Step: Validate duplicate-invitation protection instead: have a school admin invite an already-enrolled student email and confirm the UI/API reject the duplicate cleanly.
  - Reason: Duplicate student self-signup is obsolete because students no longer self-register from /signup.
  - Manual Step: Validate duplicate-invitation protection instead: have a school admin invite an already-enrolled student email and confirm the UI/API reject the duplicate cleanly.
  - Reason: Duplicate student self-signup is obsolete because students no longer self-register from /signup.
  - Manual Step: Validate duplicate-invitation protection instead: have a school admin invite an already-enrolled student email and confirm the UI/API reject the duplicate cleanly.
  - Reason: Duplicate student self-signup is obsolete because students no longer self-register from /signup.
  - Manual Step: Validate duplicate-invitation protection instead: have a school admin invite an already-enrolled student email and confirm the UI/API reject the duplicate cleanly.
  - Reason: Duplicate student self-signup is obsolete because students no longer self-register from /signup.
  - Manual Step: Validate duplicate-invitation protection instead: have a school admin invite an already-enrolled student email and confirm the UI/API reject the duplicate cleanly.
  - Reason: Duplicate student self-signup is obsolete because students no longer self-register from /signup.
  - Manual Step: Validate duplicate-invitation protection instead: have a school admin invite an already-enrolled student email and confirm the UI/API reject the duplicate cleanly.
  - Reason: Duplicate student self-signup is obsolete because students no longer self-register from /signup.
  - Manual Step: Validate duplicate-invitation protection instead: have a school admin invite an already-enrolled student email and confirm the UI/API reject the duplicate cleanly.
  - Reason: Duplicate student self-signup is obsolete because students no longer self-register from /signup.
  - Manual Step: Validate duplicate-invitation protection instead: have a school admin invite an already-enrolled student email and confirm the UI/API reject the duplicate cleanly.
  - Reason: Duplicate student self-signup is obsolete because students no longer self-register from /signup.
  - Manual Step: Validate duplicate-invitation protection instead: have a school admin invite an already-enrolled student email and confirm the UI/API reject the duplicate cleanly.
  - Reason: Duplicate student self-signup is obsolete because students no longer self-register from /signup.
  - Manual Step: Validate duplicate-invitation protection instead: have a school admin invite an already-enrolled student email and confirm the UI/API reject the duplicate cleanly.
  - Error: Volunteer signup role selector not found on /signup
  - URL: http://localhost:5173/signup
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-007-2026-06-26T23-17-32-221Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/auth-flow-2026-06-26T23-11-19-563Z.zip
  - Error: Volunteer signup role selector not found on /signup
  - URL: http://localhost:5173/signup
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-007-2026-06-04T13-57-29-531Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/auth-flow-2026-06-04T13-53-26-624Z.zip
  - Error: Volunteer signup role selector not found on /signup
  - URL: http://127.0.0.1:5174/signup
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-007-2026-05-18T13-44-31-907Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/auth-flow-2026-05-18T13-40-27-710Z.zip
  _Expect: 409 "Email already registered"_

---

## 2 · Student Flow

> **Log in as:** john@student.edu

### 2a · Dashboard
- [ ] Hour summary cards show (Committed, Verified, Activities Done) — PASS — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — PASS — PASS
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Committed Hours card missing
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-008-2026-06-26T23-17-34-685Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-26T23-17-32-289Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Committed Hours card missing
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-008-2026-05-18T13-44-34-357Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
- [ ] Progress bar reflects verified hours vs school goal — PASS — PASS — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — PASS — PASS
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
- [ ] "Upcoming Opportunities" lists future events — PASS — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — PASS — PASS
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Upcoming Opportunities section missing
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-010-2026-06-26T23-17-34-754Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-26T23-17-32-289Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Upcoming Opportunities section missing
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-010-2026-05-18T13-44-34-412Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
- [ ] "Recent Activity" shows past sessions with statuses — PASS — PASS — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — PASS — PASS
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.

### 2b · Browse
- [ ] Opportunities load on arrival — PASS — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — PASS — PASS
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: No opportunities loaded on Browse page
  - URL: http://localhost:5173/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-012-2026-06-26T23-17-35-435Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-26T23-17-32-289Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
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
- [ ] **Search** · Type a partial title → list filters in real time — PASS — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — PASS
  - Reason: The current student account has no visible browse opportunities because no partner organizations are approved for this school in the present seed state.
  - Manual Step: Approve at least one partner organization or seed one visible slot for the student, then re-run browse search coverage.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The current student account has no visible browse opportunities because no partner organizations are approved for this school in the present seed state.
  - Manual Step: Approve at least one partner organization or seed one visible slot for the student, then re-run browse search coverage.
  - Reason: The current student account has no visible browse opportunities because no partner organizations are approved for this school in the present seed state.
  - Manual Step: Approve at least one partner organization or seed one visible slot for the student, then re-run browse search coverage.
  - Reason: The current student account has no visible browse opportunities because no partner organizations are approved for this school in the present seed state.
  - Manual Step: Approve at least one partner organization or seed one visible slot for the student, then re-run browse search coverage.
  - Reason: The current student account has no visible browse opportunities because no partner organizations are approved for this school in the present seed state.
  - Manual Step: Approve at least one partner organization or seed one visible slot for the student, then re-run browse search coverage.
  - Reason: The current student account has no visible browse opportunities because no partner organizations are approved for this school in the present seed state.
  - Manual Step: Approve at least one partner organization or seed one visible slot for the student, then re-run browse search coverage.
  - Reason: The current student account has no visible browse opportunities because no partner organizations are approved for this school in the present seed state.
  - Manual Step: Approve at least one partner organization or seed one visible slot for the student, then re-run browse search coverage.
  - Reason: The current student account has no visible browse opportunities because no partner organizations are approved for this school in the present seed state.
  - Manual Step: Approve at least one partner organization or seed one visible slot for the student, then re-run browse search coverage.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The current student account has no visible browse opportunities because no partner organizations are approved for this school in the present seed state.
  - Manual Step: Approve at least one partner organization or seed one visible slot for the student, then re-run browse search coverage.
  - Reason: The current student account has no visible browse opportunities because no partner organizations are approved for this school in the present seed state.
  - Manual Step: Approve at least one partner organization or seed one visible slot for the student, then re-run browse search coverage.
  - Reason: The current student account has no visible browse opportunities because no partner organizations are approved for this school in the present seed state.
  - Manual Step: Approve at least one partner organization or seed one visible slot for the student, then re-run browse search coverage.
  - Reason: The current student account has no visible browse opportunities because no partner organizations are approved for this school in the present seed state.
  - Manual Step: Approve at least one partner organization or seed one visible slot for the student, then re-run browse search coverage.
  - Reason: The current student account has no visible browse opportunities because no partner organizations are approved for this school in the present seed state.
  - Manual Step: Approve at least one partner organization or seed one visible slot for the student, then re-run browse search coverage.
  - Reason: The current student account has no visible browse opportunities because no partner organizations are approved for this school in the present seed state.
  - Manual Step: Approve at least one partner organization or seed one visible slot for the student, then re-run browse search coverage.
  - Reason: The current student account has no visible browse opportunities because no partner organizations are approved for this school in the present seed state.
  - Manual Step: Approve at least one partner organization or seed one visible slot for the student, then re-run browse search coverage.
  - Error: No opportunities available for search test
  - URL: http://localhost:5173/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-013-2026-06-27T02-00-42-098Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-27T02-00-38-906Z.zip
  - Error: No opportunities available for search test
  - URL: http://localhost:5173/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-013-2026-06-26T23-17-35-516Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-26T23-17-32-289Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: No opportunities available for search test
  - URL: http://127.0.0.1:5174/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-013-2026-05-18T13-44-35-150Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
- [ ] **Tag filter** · Select a tag → only matching opps shown; clear → all return — PASS — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — PASS — PASS
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Category filter combobox not found
  - URL: http://localhost:5173/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-014-2026-06-27T00-53-04-074Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-27T00-52-59-954Z.zip
  - Error: Tag filter select not found
  - URL: http://localhost:5173/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-014-2026-06-26T23-17-35-587Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-26T23-17-32-289Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Tag filter select not found
  - URL: http://127.0.0.1:5174/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-014-2026-05-18T13-44-35-208Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
- [ ] **Sort: Date** · Events appear in chronological order — PASS — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: The dedicated browse sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify Date ordering with at least two visible slots. Until then, this case should be covered by backend ordering tests or a restored UI control.
  - Reason: The dedicated browse sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify Date ordering with at least two visible slots. Until then, this case should be covered by backend ordering tests or a restored UI control.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The dedicated browse sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify Date ordering with at least two visible slots. Until then, this case should be covered by backend ordering tests or a restored UI control.
  - Reason: The dedicated browse sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify Date ordering with at least two visible slots. Until then, this case should be covered by backend ordering tests or a restored UI control.
  - Reason: The dedicated browse sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify Date ordering with at least two visible slots. Until then, this case should be covered by backend ordering tests or a restored UI control.
  - Reason: The dedicated browse sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify Date ordering with at least two visible slots. Until then, this case should be covered by backend ordering tests or a restored UI control.
  - Reason: The dedicated browse sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify Date ordering with at least two visible slots. Until then, this case should be covered by backend ordering tests or a restored UI control.
  - Reason: The dedicated browse sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify Date ordering with at least two visible slots. Until then, this case should be covered by backend ordering tests or a restored UI control.
  - Reason: The dedicated browse sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify Date ordering with at least two visible slots. Until then, this case should be covered by backend ordering tests or a restored UI control.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The dedicated browse sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify Date ordering with at least two visible slots. Until then, this case should be covered by backend ordering tests or a restored UI control.
  - Reason: The dedicated browse sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify Date ordering with at least two visible slots. Until then, this case should be covered by backend ordering tests or a restored UI control.
  - Reason: The dedicated browse sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify Date ordering with at least two visible slots. Until then, this case should be covered by backend ordering tests or a restored UI control.
  - Reason: The dedicated browse sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify Date ordering with at least two visible slots. Until then, this case should be covered by backend ordering tests or a restored UI control.
  - Reason: The dedicated browse sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify Date ordering with at least two visible slots. Until then, this case should be covered by backend ordering tests or a restored UI control.
  - Reason: The dedicated browse sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify Date ordering with at least two visible slots. Until then, this case should be covered by backend ordering tests or a restored UI control.
  - Reason: The dedicated browse sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify Date ordering with at least two visible slots. Until then, this case should be covered by backend ordering tests or a restored UI control.
  - Reason: The dedicated browse sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify Date ordering with at least two visible slots. Until then, this case should be covered by backend ordering tests or a restored UI control.
  - Reason: The dedicated browse sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify Date ordering with at least two visible slots. Until then, this case should be covered by backend ordering tests or a restored UI control.
  - Reason: The dedicated browse sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify Date ordering with at least two visible slots. Until then, this case should be covered by backend ordering tests or a restored UI control.
  - Reason: The dedicated browse sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify Date ordering with at least two visible slots. Until then, this case should be covered by backend ordering tests or a restored UI control.
  - Reason: The dedicated browse sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify Date ordering with at least two visible slots. Until then, this case should be covered by backend ordering tests or a restored UI control.
  - Reason: The dedicated browse sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify Date ordering with at least two visible slots. Until then, this case should be covered by backend ordering tests or a restored UI control.
  - Reason: The dedicated browse sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify Date ordering with at least two visible slots. Until then, this case should be covered by backend ordering tests or a restored UI control.
  - Reason: The dedicated browse sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify Date ordering with at least two visible slots. Until then, this case should be covered by backend ordering tests or a restored UI control.
  - Error: locator.selectOption: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for locator('select').first()[22m

  - URL: http://localhost:5173/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-015-2026-06-26T23-18-05-662Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-26T23-17-32-289Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: locator.selectOption: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for locator('select').first()[22m

  - URL: http://127.0.0.1:5174/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-015-2026-05-18T13-45-05-264Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
- [ ] **Sort: Most Popular** · Higher-signup events appear first — PASS — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: The dedicated popularity sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify higher-signup slots rank first. Until then, keep this covered elsewhere or restore the UI control.
  - Reason: The dedicated popularity sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify higher-signup slots rank first. Until then, keep this covered elsewhere or restore the UI control.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The dedicated popularity sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify higher-signup slots rank first. Until then, keep this covered elsewhere or restore the UI control.
  - Reason: The dedicated popularity sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify higher-signup slots rank first. Until then, keep this covered elsewhere or restore the UI control.
  - Reason: The dedicated popularity sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify higher-signup slots rank first. Until then, keep this covered elsewhere or restore the UI control.
  - Reason: The dedicated popularity sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify higher-signup slots rank first. Until then, keep this covered elsewhere or restore the UI control.
  - Reason: The dedicated popularity sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify higher-signup slots rank first. Until then, keep this covered elsewhere or restore the UI control.
  - Reason: The dedicated popularity sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify higher-signup slots rank first. Until then, keep this covered elsewhere or restore the UI control.
  - Reason: The dedicated popularity sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify higher-signup slots rank first. Until then, keep this covered elsewhere or restore the UI control.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The dedicated popularity sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify higher-signup slots rank first. Until then, keep this covered elsewhere or restore the UI control.
  - Reason: The dedicated popularity sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify higher-signup slots rank first. Until then, keep this covered elsewhere or restore the UI control.
  - Reason: The dedicated popularity sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify higher-signup slots rank first. Until then, keep this covered elsewhere or restore the UI control.
  - Reason: The dedicated popularity sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify higher-signup slots rank first. Until then, keep this covered elsewhere or restore the UI control.
  - Reason: The dedicated popularity sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify higher-signup slots rank first. Until then, keep this covered elsewhere or restore the UI control.
  - Reason: The dedicated popularity sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify higher-signup slots rank first. Until then, keep this covered elsewhere or restore the UI control.
  - Reason: The dedicated popularity sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify higher-signup slots rank first. Until then, keep this covered elsewhere or restore the UI control.
  - Reason: The dedicated popularity sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify higher-signup slots rank first. Until then, keep this covered elsewhere or restore the UI control.
  - Reason: The dedicated popularity sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify higher-signup slots rank first. Until then, keep this covered elsewhere or restore the UI control.
  - Reason: The dedicated popularity sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify higher-signup slots rank first. Until then, keep this covered elsewhere or restore the UI control.
  - Reason: The dedicated popularity sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify higher-signup slots rank first. Until then, keep this covered elsewhere or restore the UI control.
  - Reason: The dedicated popularity sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify higher-signup slots rank first. Until then, keep this covered elsewhere or restore the UI control.
  - Reason: The dedicated popularity sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify higher-signup slots rank first. Until then, keep this covered elsewhere or restore the UI control.
  - Reason: The dedicated popularity sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify higher-signup slots rank first. Until then, keep this covered elsewhere or restore the UI control.
  - Reason: The dedicated popularity sort control is no longer exposed in the current student browse UI.
  - Manual Step: If sort controls are reintroduced, verify higher-signup slots rank first. Until then, keep this covered elsewhere or restore the UI control.
  - Error: locator.selectOption: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for locator('select').first()[22m

  - URL: http://localhost:5173/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-016-2026-06-26T23-18-35-774Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-26T23-17-32-289Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: locator.selectOption: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for locator('select').first()[22m

  - URL: http://127.0.0.1:5174/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-016-2026-05-18T13-45-35-330Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
- [ ] **Approved Orgs Only** toggle · List narrows to school-approved orgs — PASS — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — PASS — PASS
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Approved Orgs Only toggle not found
  - URL: http://localhost:5173/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-017-2026-06-26T23-18-35-877Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-26T23-17-32-289Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Approved Orgs Only toggle not found
  - URL: http://127.0.0.1:5174/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-017-2026-05-18T13-45-35-392Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
- [ ] **Save** · Click Save on an opp → appears in "Saved" tab — PASS — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Saved/Skipped/Discarded browse buckets are not surfaced in the current student UI, even though backend saved routes still exist.
  - Manual Step: If this behavior is still a product requirement, restore the UI surface or add dedicated automated API coverage for save-state transitions.
  - Reason: Saved/Skipped/Discarded browse buckets are not surfaced in the current student UI, even though backend saved routes still exist.
  - Manual Step: If this behavior is still a product requirement, restore the UI surface or add dedicated automated API coverage for save-state transitions.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Saved/Skipped/Discarded browse buckets are not surfaced in the current student UI, even though backend saved routes still exist.
  - Manual Step: If this behavior is still a product requirement, restore the UI surface or add dedicated automated API coverage for save-state transitions.
  - Reason: Saved/Skipped/Discarded browse buckets are not surfaced in the current student UI, even though backend saved routes still exist.
  - Manual Step: If this behavior is still a product requirement, restore the UI surface or add dedicated automated API coverage for save-state transitions.
  - Reason: Saved/Skipped/Discarded browse buckets are not surfaced in the current student UI, even though backend saved routes still exist.
  - Manual Step: If this behavior is still a product requirement, restore the UI surface or add dedicated automated API coverage for save-state transitions.
  - Reason: Saved/Skipped/Discarded browse buckets are not surfaced in the current student UI, even though backend saved routes still exist.
  - Manual Step: If this behavior is still a product requirement, restore the UI surface or add dedicated automated API coverage for save-state transitions.
  - Reason: Saved/Skipped/Discarded browse buckets are not surfaced in the current student UI, even though backend saved routes still exist.
  - Manual Step: If this behavior is still a product requirement, restore the UI surface or add dedicated automated API coverage for save-state transitions.
  - Reason: Saved/Skipped/Discarded browse buckets are not surfaced in the current student UI, even though backend saved routes still exist.
  - Manual Step: If this behavior is still a product requirement, restore the UI surface or add dedicated automated API coverage for save-state transitions.
  - Reason: Saved/Skipped/Discarded browse buckets are not surfaced in the current student UI, even though backend saved routes still exist.
  - Manual Step: If this behavior is still a product requirement, restore the UI surface or add dedicated automated API coverage for save-state transitions.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Saved/Skipped/Discarded browse buckets are not surfaced in the current student UI, even though backend saved routes still exist.
  - Manual Step: If this behavior is still a product requirement, restore the UI surface or add dedicated automated API coverage for save-state transitions.
  - Reason: Saved/Skipped/Discarded browse buckets are not surfaced in the current student UI, even though backend saved routes still exist.
  - Manual Step: If this behavior is still a product requirement, restore the UI surface or add dedicated automated API coverage for save-state transitions.
  - Reason: Saved/Skipped/Discarded browse buckets are not surfaced in the current student UI, even though backend saved routes still exist.
  - Manual Step: If this behavior is still a product requirement, restore the UI surface or add dedicated automated API coverage for save-state transitions.
  - Reason: Saved/Skipped/Discarded browse buckets are not surfaced in the current student UI, even though backend saved routes still exist.
  - Manual Step: If this behavior is still a product requirement, restore the UI surface or add dedicated automated API coverage for save-state transitions.
  - Reason: Saved/Skipped/Discarded browse buckets are not surfaced in the current student UI, even though backend saved routes still exist.
  - Manual Step: If this behavior is still a product requirement, restore the UI surface or add dedicated automated API coverage for save-state transitions.
  - Reason: Saved/Skipped/Discarded browse buckets are not surfaced in the current student UI, even though backend saved routes still exist.
  - Manual Step: If this behavior is still a product requirement, restore the UI surface or add dedicated automated API coverage for save-state transitions.
  - Reason: Saved/Skipped/Discarded browse buckets are not surfaced in the current student UI, even though backend saved routes still exist.
  - Manual Step: If this behavior is still a product requirement, restore the UI surface or add dedicated automated API coverage for save-state transitions.
  - Reason: Saved/Skipped/Discarded browse buckets are not surfaced in the current student UI, even though backend saved routes still exist.
  - Manual Step: If this behavior is still a product requirement, restore the UI surface or add dedicated automated API coverage for save-state transitions.
  - Reason: Saved/Skipped/Discarded browse buckets are not surfaced in the current student UI, even though backend saved routes still exist.
  - Manual Step: If this behavior is still a product requirement, restore the UI surface or add dedicated automated API coverage for save-state transitions.
  - Reason: Saved/Skipped/Discarded browse buckets are not surfaced in the current student UI, even though backend saved routes still exist.
  - Manual Step: If this behavior is still a product requirement, restore the UI surface or add dedicated automated API coverage for save-state transitions.
  - Reason: Saved/Skipped/Discarded browse buckets are not surfaced in the current student UI, even though backend saved routes still exist.
  - Manual Step: If this behavior is still a product requirement, restore the UI surface or add dedicated automated API coverage for save-state transitions.
  - Reason: Saved/Skipped/Discarded browse buckets are not surfaced in the current student UI, even though backend saved routes still exist.
  - Manual Step: If this behavior is still a product requirement, restore the UI surface or add dedicated automated API coverage for save-state transitions.
  - Reason: Saved/Skipped/Discarded browse buckets are not surfaced in the current student UI, even though backend saved routes still exist.
  - Manual Step: If this behavior is still a product requirement, restore the UI surface or add dedicated automated API coverage for save-state transitions.
  - Reason: Saved/Skipped/Discarded browse buckets are not surfaced in the current student UI, even though backend saved routes still exist.
  - Manual Step: If this behavior is still a product requirement, restore the UI surface or add dedicated automated API coverage for save-state transitions.
  - Reason: Saved/Skipped/Discarded browse buckets are not surfaced in the current student UI, even though backend saved routes still exist.
  - Manual Step: If this behavior is still a product requirement, restore the UI surface or add dedicated automated API coverage for save-state transitions.
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^All$/i })[22m

  - URL: http://localhost:5173/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-018-2026-06-26T23-18-50-941Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-26T23-17-32-289Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^All$/i })[22m

  - URL: http://127.0.0.1:5174/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-018-2026-05-18T13-45-50-440Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
- [ ] **Skip** · Click Skip on another opp → appears in "Skipped" tab — PASS — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Skip-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Reason: Skip-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Skip-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Reason: Skip-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Reason: Skip-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Reason: Skip-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Reason: Skip-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Reason: Skip-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Reason: Skip-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Skip-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Reason: Skip-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Reason: Skip-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Reason: Skip-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Reason: Skip-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Reason: Skip-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Reason: Skip-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Reason: Skip-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Reason: Skip-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Reason: Skip-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Reason: Skip-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Reason: Skip-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Reason: Skip-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Reason: Skip-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Reason: Skip-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^All$/i })[22m

  - URL: http://localhost:5173/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-019-2026-06-26T23-19-06-026Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-26T23-17-32-289Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^All$/i })[22m

  - URL: http://127.0.0.1:5174/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-019-2026-05-18T13-46-05-488Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
- [ ] **Discard** · Click Discard → appears in "Discarded" tab — PASS — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Discard-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Reason: Discard-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Discard-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Reason: Discard-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Reason: Discard-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Reason: Discard-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Reason: Discard-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Reason: Discard-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Reason: Discard-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Discard-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Reason: Discard-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Reason: Discard-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Reason: Discard-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Reason: Discard-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Reason: Discard-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Reason: Discard-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Reason: Discard-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Reason: Discard-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Reason: Discard-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Reason: Discard-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Reason: Discard-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Reason: Discard-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Reason: Discard-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Reason: Discard-state UX is not exposed in the current student browse UI.
  - Manual Step: Restore the skip/discard surface or cover the saved-state API transitions separately, then re-enable this automated case.
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^All$/i })[22m

  - URL: http://localhost:5173/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-020-2026-06-26T23-19-21-108Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-26T23-17-32-289Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^All$/i })[22m

  - URL: http://127.0.0.1:5174/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-020-2026-05-18T13-46-20-540Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
- [ ] **Recover** · From Skipped/Discarded tab, recover → moves back to main list — PASS — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Recovering skipped/discarded opportunities is blocked by the same missing saved-state browse surface.
  - Manual Step: After that UI returns, verify recovery moves the item back into the visible browse list.
  - Reason: Recovering skipped/discarded opportunities is blocked by the same missing saved-state browse surface.
  - Manual Step: After that UI returns, verify recovery moves the item back into the visible browse list.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Recovering skipped/discarded opportunities is blocked by the same missing saved-state browse surface.
  - Manual Step: After that UI returns, verify recovery moves the item back into the visible browse list.
  - Reason: Recovering skipped/discarded opportunities is blocked by the same missing saved-state browse surface.
  - Manual Step: After that UI returns, verify recovery moves the item back into the visible browse list.
  - Reason: Recovering skipped/discarded opportunities is blocked by the same missing saved-state browse surface.
  - Manual Step: After that UI returns, verify recovery moves the item back into the visible browse list.
  - Reason: Recovering skipped/discarded opportunities is blocked by the same missing saved-state browse surface.
  - Manual Step: After that UI returns, verify recovery moves the item back into the visible browse list.
  - Reason: Recovering skipped/discarded opportunities is blocked by the same missing saved-state browse surface.
  - Manual Step: After that UI returns, verify recovery moves the item back into the visible browse list.
  - Reason: Recovering skipped/discarded opportunities is blocked by the same missing saved-state browse surface.
  - Manual Step: After that UI returns, verify recovery moves the item back into the visible browse list.
  - Reason: Recovering skipped/discarded opportunities is blocked by the same missing saved-state browse surface.
  - Manual Step: After that UI returns, verify recovery moves the item back into the visible browse list.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Recovering skipped/discarded opportunities is blocked by the same missing saved-state browse surface.
  - Manual Step: After that UI returns, verify recovery moves the item back into the visible browse list.
  - Reason: Recovering skipped/discarded opportunities is blocked by the same missing saved-state browse surface.
  - Manual Step: After that UI returns, verify recovery moves the item back into the visible browse list.
  - Reason: Recovering skipped/discarded opportunities is blocked by the same missing saved-state browse surface.
  - Manual Step: After that UI returns, verify recovery moves the item back into the visible browse list.
  - Reason: Recovering skipped/discarded opportunities is blocked by the same missing saved-state browse surface.
  - Manual Step: After that UI returns, verify recovery moves the item back into the visible browse list.
  - Reason: Recovering skipped/discarded opportunities is blocked by the same missing saved-state browse surface.
  - Manual Step: After that UI returns, verify recovery moves the item back into the visible browse list.
  - Reason: Recovering skipped/discarded opportunities is blocked by the same missing saved-state browse surface.
  - Manual Step: After that UI returns, verify recovery moves the item back into the visible browse list.
  - Reason: Recovering skipped/discarded opportunities is blocked by the same missing saved-state browse surface.
  - Manual Step: After that UI returns, verify recovery moves the item back into the visible browse list.
  - Reason: Recovering skipped/discarded opportunities is blocked by the same missing saved-state browse surface.
  - Manual Step: After that UI returns, verify recovery moves the item back into the visible browse list.
  - Reason: Recovering skipped/discarded opportunities is blocked by the same missing saved-state browse surface.
  - Manual Step: After that UI returns, verify recovery moves the item back into the visible browse list.
  - Reason: Recovering skipped/discarded opportunities is blocked by the same missing saved-state browse surface.
  - Manual Step: After that UI returns, verify recovery moves the item back into the visible browse list.
  - Reason: Recovering skipped/discarded opportunities is blocked by the same missing saved-state browse surface.
  - Manual Step: After that UI returns, verify recovery moves the item back into the visible browse list.
  - Reason: Recovering skipped/discarded opportunities is blocked by the same missing saved-state browse surface.
  - Manual Step: After that UI returns, verify recovery moves the item back into the visible browse list.
  - Reason: Recovering skipped/discarded opportunities is blocked by the same missing saved-state browse surface.
  - Manual Step: After that UI returns, verify recovery moves the item back into the visible browse list.
  - Reason: Recovering skipped/discarded opportunities is blocked by the same missing saved-state browse surface.
  - Manual Step: After that UI returns, verify recovery moves the item back into the visible browse list.
  - Reason: Recovering skipped/discarded opportunities is blocked by the same missing saved-state browse surface.
  - Manual Step: After that UI returns, verify recovery moves the item back into the visible browse list.
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^Skipped$/i })[22m

  - URL: http://localhost:5173/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-021-2026-06-26T23-19-36-193Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-26T23-17-32-289Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^Skipped$/i })[22m

  - URL: http://127.0.0.1:5174/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-021-2026-05-18T13-46-35-610Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip

### 2c · Opportunity Detail & Signup
- [ ] Click an opportunity → detail view shows org name, date, time, location, capacity, tags, custom fields — PASS — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — PASS
  - Reason: The current student account has no visible browse opportunities, so there is no detail page to inspect from the live student flow.
  - Manual Step: Approve at least one partner organization or seed one visible slot for the student, then re-run the detail-view audit.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The current student account has no visible browse opportunities, so there is no detail page to inspect from the live student flow.
  - Manual Step: Approve at least one partner organization or seed one visible slot for the student, then re-run the detail-view audit.
  - Reason: The current student account has no visible browse opportunities, so there is no detail page to inspect from the live student flow.
  - Manual Step: Approve at least one partner organization or seed one visible slot for the student, then re-run the detail-view audit.
  - Reason: The current student account has no visible browse opportunities, so there is no detail page to inspect from the live student flow.
  - Manual Step: Approve at least one partner organization or seed one visible slot for the student, then re-run the detail-view audit.
  - Reason: The current student account has no visible browse opportunities, so there is no detail page to inspect from the live student flow.
  - Manual Step: Approve at least one partner organization or seed one visible slot for the student, then re-run the detail-view audit.
  - Reason: The current student account has no visible browse opportunities, so there is no detail page to inspect from the live student flow.
  - Manual Step: Approve at least one partner organization or seed one visible slot for the student, then re-run the detail-view audit.
  - Reason: The current student account has no visible browse opportunities, so there is no detail page to inspect from the live student flow.
  - Manual Step: Approve at least one partner organization or seed one visible slot for the student, then re-run the detail-view audit.
  - Reason: The current student account has no visible browse opportunities, so there is no detail page to inspect from the live student flow.
  - Manual Step: Approve at least one partner organization or seed one visible slot for the student, then re-run the detail-view audit.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The current student account has no visible browse opportunities, so there is no detail page to inspect from the live student flow.
  - Manual Step: Approve at least one partner organization or seed one visible slot for the student, then re-run the detail-view audit.
  - Reason: The current student account has no visible browse opportunities, so there is no detail page to inspect from the live student flow.
  - Manual Step: Approve at least one partner organization or seed one visible slot for the student, then re-run the detail-view audit.
  - Reason: The current student account has no visible browse opportunities, so there is no detail page to inspect from the live student flow.
  - Manual Step: Approve at least one partner organization or seed one visible slot for the student, then re-run the detail-view audit.
  - Reason: The current student account has no visible browse opportunities, so there is no detail page to inspect from the live student flow.
  - Manual Step: Approve at least one partner organization or seed one visible slot for the student, then re-run the detail-view audit.
  - Reason: The current student account has no visible browse opportunities, so there is no detail page to inspect from the live student flow.
  - Manual Step: Approve at least one partner organization or seed one visible slot for the student, then re-run the detail-view audit.
  - Reason: The current student account has no visible browse opportunities, so there is no detail page to inspect from the live student flow.
  - Manual Step: Approve at least one partner organization or seed one visible slot for the student, then re-run the detail-view audit.
  - Reason: The current student account has no visible browse opportunities, so there is no detail page to inspect from the live student flow.
  - Manual Step: Approve at least one partner organization or seed one visible slot for the student, then re-run the detail-view audit.
  - Error: No opportunities available for detail-view test
  - URL: http://localhost:5173/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-022-2026-06-27T02-00-43-666Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-27T02-00-38-906Z.zip
  - Error: Slot detail missing title
  - URL: http://localhost:5173/slot/cmquusyn4000u8o5y07ztoyv4
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-022-2026-06-27T00-53-04-763Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-27T00-52-59-954Z.zip
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^All$/i })[22m

  - URL: http://localhost:5173/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-022-2026-06-26T23-19-51-295Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-26T23-17-32-289Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^All$/i })[22m

  - URL: http://127.0.0.1:5174/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-022-2026-05-18T13-46-50-681Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
- [ ] **Sign up** · Click "Sign Up" → button changes; confirm appears in student's signups — PASS — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — PASS
  - Reason: No sign-up eligible slot is currently visible to the student in this seed state, so automated signup coverage cannot proceed.
  - Manual Step: Seed or approve at least one open slot that the student can join, then re-run the signup and cancellation checks.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: No sign-up eligible slot is currently visible to the student in this seed state, so automated signup coverage cannot proceed.
  - Manual Step: Seed or approve at least one open slot that the student can join, then re-run the signup and cancellation checks.
  - Reason: No sign-up eligible slot is currently visible to the student in this seed state, so automated signup coverage cannot proceed.
  - Manual Step: Seed or approve at least one open slot that the student can join, then re-run the signup and cancellation checks.
  - Reason: No sign-up eligible slot is currently visible to the student in this seed state, so automated signup coverage cannot proceed.
  - Manual Step: Seed or approve at least one open slot that the student can join, then re-run the signup and cancellation checks.
  - Reason: No sign-up eligible slot is currently visible to the student in this seed state, so automated signup coverage cannot proceed.
  - Manual Step: Seed or approve at least one open slot that the student can join, then re-run the signup and cancellation checks.
  - Reason: No sign-up eligible slot is currently visible to the student in this seed state, so automated signup coverage cannot proceed.
  - Manual Step: Seed or approve at least one open slot that the student can join, then re-run the signup and cancellation checks.
  - Reason: No sign-up eligible slot is currently visible to the student in this seed state, so automated signup coverage cannot proceed.
  - Manual Step: Seed or approve at least one open slot that the student can join, then re-run the signup and cancellation checks.
  - Reason: No sign-up eligible slot is currently visible to the student in this seed state, so automated signup coverage cannot proceed.
  - Manual Step: Seed or approve at least one open slot that the student can join, then re-run the signup and cancellation checks.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: No sign-up eligible slot is currently visible to the student in this seed state, so automated signup coverage cannot proceed.
  - Manual Step: Seed or approve at least one open slot that the student can join, then re-run the signup and cancellation checks.
  - Reason: No sign-up eligible slot is currently visible to the student in this seed state, so automated signup coverage cannot proceed.
  - Manual Step: Seed or approve at least one open slot that the student can join, then re-run the signup and cancellation checks.
  - Reason: No sign-up eligible slot is currently visible to the student in this seed state, so automated signup coverage cannot proceed.
  - Manual Step: Seed or approve at least one open slot that the student can join, then re-run the signup and cancellation checks.
  - Reason: No sign-up eligible slot is currently visible to the student in this seed state, so automated signup coverage cannot proceed.
  - Manual Step: Seed or approve at least one open slot that the student can join, then re-run the signup and cancellation checks.
  - Reason: No sign-up eligible slot is currently visible to the student in this seed state, so automated signup coverage cannot proceed.
  - Manual Step: Seed or approve at least one open slot that the student can join, then re-run the signup and cancellation checks.
  - Reason: No sign-up eligible slot is currently visible to the student in this seed state, so automated signup coverage cannot proceed.
  - Manual Step: Seed or approve at least one open slot that the student can join, then re-run the signup and cancellation checks.
  - Reason: No sign-up eligible slot is currently visible to the student in this seed state, so automated signup coverage cannot proceed.
  - Manual Step: Seed or approve at least one open slot that the student can join, then re-run the signup and cancellation checks.
  - Error: No opportunity with Sign Up button found
  - URL: http://localhost:5173/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-023-2026-06-27T02-00-44-317Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-27T02-00-38-906Z.zip
  - Error: No opportunity with Sign Up button found
  - URL: http://localhost:5173/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-023-2026-06-26T23-19-52-024Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-26T23-17-32-289Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
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
- [ ] **Capacity full → Waitlist** · If opp is at capacity, button reads "Join Waitlist"; status shows WAITLISTED — PASS — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — FAIL
  - Error: Waitlisted status not shown after joining waitlist
  - URL: http://localhost:5173/slot/cmqzat3uw000cmu0qde1utnvx
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-024-2026-07-12T17-32-58-358Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-jane-2026-07-12T17-32-45-571Z.zip
  - Reason: Current seed data does not include a full slot that exposes the waitlist path.
  - Manual Step: Seed one capacity-full opportunity with at least one confirmed signup, then verify a second student can join the waitlist and sees WAITLISTED state.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Current seed data does not include a full slot that exposes the waitlist path.
  - Manual Step: Seed one capacity-full opportunity with at least one confirmed signup, then verify a second student can join the waitlist and sees WAITLISTED state.
  - Reason: Current seed data does not include a full slot that exposes the waitlist path.
  - Manual Step: Seed one capacity-full opportunity with at least one confirmed signup, then verify a second student can join the waitlist and sees WAITLISTED state.
  - Reason: Current seed data does not include a full slot that exposes the waitlist path.
  - Manual Step: Seed one capacity-full opportunity with at least one confirmed signup, then verify a second student can join the waitlist and sees WAITLISTED state.
  - Reason: Current seed data does not include a full slot that exposes the waitlist path.
  - Manual Step: Seed one capacity-full opportunity with at least one confirmed signup, then verify a second student can join the waitlist and sees WAITLISTED state.
  - Reason: Current seed data does not include a full slot that exposes the waitlist path.
  - Manual Step: Seed one capacity-full opportunity with at least one confirmed signup, then verify a second student can join the waitlist and sees WAITLISTED state.
  - Reason: Current seed data does not include a full slot that exposes the waitlist path.
  - Manual Step: Seed one capacity-full opportunity with at least one confirmed signup, then verify a second student can join the waitlist and sees WAITLISTED state.
  - Reason: Current seed data does not include a full slot that exposes the waitlist path.
  - Manual Step: Seed one capacity-full opportunity with at least one confirmed signup, then verify a second student can join the waitlist and sees WAITLISTED state.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Current seed data does not include a full slot that exposes the waitlist path.
  - Manual Step: Seed one capacity-full opportunity with at least one confirmed signup, then verify a second student can join the waitlist and sees WAITLISTED state.
  - Reason: Current seed data does not include a full slot that exposes the waitlist path.
  - Manual Step: Seed one capacity-full opportunity with at least one confirmed signup, then verify a second student can join the waitlist and sees WAITLISTED state.
  - Reason: Current seed data does not include a full slot that exposes the waitlist path.
  - Manual Step: Seed one capacity-full opportunity with at least one confirmed signup, then verify a second student can join the waitlist and sees WAITLISTED state.
  - Reason: Current seed data does not include a full slot that exposes the waitlist path.
  - Manual Step: Seed one capacity-full opportunity with at least one confirmed signup, then verify a second student can join the waitlist and sees WAITLISTED state.
  - Reason: Current seed data does not include a full slot that exposes the waitlist path.
  - Manual Step: Seed one capacity-full opportunity with at least one confirmed signup, then verify a second student can join the waitlist and sees WAITLISTED state.
  - Reason: Current seed data does not include a full slot that exposes the waitlist path.
  - Manual Step: Seed one capacity-full opportunity with at least one confirmed signup, then verify a second student can join the waitlist and sees WAITLISTED state.
  - Reason: Current seed data does not include a full slot that exposes the waitlist path.
  - Manual Step: Seed one capacity-full opportunity with at least one confirmed signup, then verify a second student can join the waitlist and sees WAITLISTED state.
  - Reason: Current seed data does not include a full slot that exposes the waitlist path.
  - Manual Step: Seed one capacity-full opportunity with at least one confirmed signup, then verify a second student can join the waitlist and sees WAITLISTED state.
  - Reason: Current seed data does not include a full slot that exposes the waitlist path.
  - Manual Step: Seed one capacity-full opportunity with at least one confirmed signup, then verify a second student can join the waitlist and sees WAITLISTED state.
  - Reason: Current seed data does not include a full slot that exposes the waitlist path.
  - Manual Step: Seed one capacity-full opportunity with at least one confirmed signup, then verify a second student can join the waitlist and sees WAITLISTED state.
  - Reason: Current seed data does not include a full slot that exposes the waitlist path.
  - Manual Step: Seed one capacity-full opportunity with at least one confirmed signup, then verify a second student can join the waitlist and sees WAITLISTED state.
  - Reason: Current seed data does not include a full slot that exposes the waitlist path.
  - Manual Step: Seed one capacity-full opportunity with at least one confirmed signup, then verify a second student can join the waitlist and sees WAITLISTED state.
  - Reason: Current seed data does not include a full slot that exposes the waitlist path.
  - Manual Step: Seed one capacity-full opportunity with at least one confirmed signup, then verify a second student can join the waitlist and sees WAITLISTED state.
  - Reason: Current seed data does not include a full slot that exposes the waitlist path.
  - Manual Step: Seed one capacity-full opportunity with at least one confirmed signup, then verify a second student can join the waitlist and sees WAITLISTED state.
  - Error: No capacity-full opportunity with Join Waitlist button found
  - URL: http://localhost:5173/slot/cmquusyn0000n8o5yhqmmkc9u
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-024-2026-06-27T00-53-17-187Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-jane-2026-06-27T00-53-07-469Z.zip
  - Error: No capacity-full opportunity with Join Waitlist button found
  - URL: http://localhost:5173/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-024-2026-06-26T23-19-55-824Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-jane-2026-06-26T23-19-52-127Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: No capacity-full opportunity with Join Waitlist button found
  - URL: http://127.0.0.1:5174/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-024-2026-05-18T13-46-54-393Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-jane-2026-05-18T13-46-51-459Z.zip
- [ ] **Cancel signup** · Cancel a CONFIRMED signup → slot freed, confirmation shown — PASS — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — FAIL
  - Error: Cancel signup button not found on confirmed signup
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-025-2026-07-12T17-32-59-214Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-07-12T17-32-36-325Z.zip
  - Reason: Cancellation coverage depends on item 23 creating a fresh confirmed signup, which did not happen in the current seed state.
  - Manual Step: First seed a sign-up eligible slot and confirm item 23 succeeds, then rerun cancellation coverage.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Cancellation coverage depends on item 23 creating a fresh confirmed signup, which did not happen in the current seed state.
  - Manual Step: First seed a sign-up eligible slot and confirm item 23 succeeds, then rerun cancellation coverage.
  - Reason: Cancellation coverage depends on item 23 creating a fresh confirmed signup, which did not happen in the current seed state.
  - Manual Step: First seed a sign-up eligible slot and confirm item 23 succeeds, then rerun cancellation coverage.
  - Reason: Cancellation coverage depends on item 23 creating a fresh confirmed signup, which did not happen in the current seed state.
  - Manual Step: First seed a sign-up eligible slot and confirm item 23 succeeds, then rerun cancellation coverage.
  - Reason: Cancellation coverage depends on item 23 creating a fresh confirmed signup, which did not happen in the current seed state.
  - Manual Step: First seed a sign-up eligible slot and confirm item 23 succeeds, then rerun cancellation coverage.
  - Reason: Cancellation coverage depends on item 23 creating a fresh confirmed signup, which did not happen in the current seed state.
  - Manual Step: First seed a sign-up eligible slot and confirm item 23 succeeds, then rerun cancellation coverage.
  - Reason: Cancellation coverage depends on item 23 creating a fresh confirmed signup, which did not happen in the current seed state.
  - Manual Step: First seed a sign-up eligible slot and confirm item 23 succeeds, then rerun cancellation coverage.
  - Reason: Cancellation coverage depends on item 23 creating a fresh confirmed signup, which did not happen in the current seed state.
  - Manual Step: First seed a sign-up eligible slot and confirm item 23 succeeds, then rerun cancellation coverage.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Cancellation coverage depends on item 23 creating a fresh confirmed signup, which did not happen in the current seed state.
  - Manual Step: First seed a sign-up eligible slot and confirm item 23 succeeds, then rerun cancellation coverage.
  - Reason: Cancellation coverage depends on item 23 creating a fresh confirmed signup, which did not happen in the current seed state.
  - Manual Step: First seed a sign-up eligible slot and confirm item 23 succeeds, then rerun cancellation coverage.
  - Reason: Cancellation coverage depends on item 23 creating a fresh confirmed signup, which did not happen in the current seed state.
  - Manual Step: First seed a sign-up eligible slot and confirm item 23 succeeds, then rerun cancellation coverage.
  - Reason: Cancellation coverage depends on item 23 creating a fresh confirmed signup, which did not happen in the current seed state.
  - Manual Step: First seed a sign-up eligible slot and confirm item 23 succeeds, then rerun cancellation coverage.
  - Reason: Cancellation coverage depends on item 23 creating a fresh confirmed signup, which did not happen in the current seed state.
  - Manual Step: First seed a sign-up eligible slot and confirm item 23 succeeds, then rerun cancellation coverage.
  - Reason: Cancellation coverage depends on item 23 creating a fresh confirmed signup, which did not happen in the current seed state.
  - Manual Step: First seed a sign-up eligible slot and confirm item 23 succeeds, then rerun cancellation coverage.
  - Reason: Cancellation coverage depends on item 23 creating a fresh confirmed signup, which did not happen in the current seed state.
  - Manual Step: First seed a sign-up eligible slot and confirm item 23 succeeds, then rerun cancellation coverage.
  - Error: No signed opportunity title recorded from item 23
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-025-2026-06-27T02-00-54-693Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-27T02-00-38-906Z.zip
  - Error: Slot action did not reset after cancellation
  - URL: http://localhost:5173/slot/cmquusyn0000n8o5yhqmmkc9u
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-025-2026-06-27T01-56-50-915Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-27T01-56-29-453Z.zip
  - Error: Opportunity link not found by title: After-School TutoringCommunity LibraryEducationMon, Jul 13, 2026 · 4:00 PM–5:30 PM · 1.5h210 River Street, Beverly Hills, CANote: Minimum 16 years old. Background check required.0/6spotsView Details →
  - URL: http://localhost:5173/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-025-2026-06-27T01-46-59-818Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-27T01-46-38-132Z.zip
  - Error: Opportunity link not found by title: Community Garden PlantingGreen Earth FoundationEnvironmentFri, Jul 10, 2026 · 3:00 PM–6:00 PM · 3h145 Maple Street, New York, NY0/10spotsView Details →
  - URL: http://localhost:5173/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-025-2026-06-27T01-34-33-417Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-27T01-34-11-900Z.zip
  - Error: Opportunity link not found by title: Park Cleanup DayGreen Earth FoundationEnvironmentWed, Jul 8, 2026 · 10:00 AM–2:00 PM · 4hCentral Park, New York, NYNote: Wear closed-toe shoes. Gloves provided.0/10spotsView Details →
  - URL: http://localhost:5173/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-025-2026-06-27T01-26-52-107Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-27T01-26-30-466Z.zip
  - Error: Opportunity link not found by title: After-School TutoringCommunity LibraryEducationMon, Jul 6, 2026 · 4:00 PM–5:30 PM · 1.5h210 River Street, Beverly Hills, CANote: Minimum 16 years old. Background check required.0/6spotsView Details →
  - URL: http://localhost:5173/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-025-2026-06-27T01-19-49-350Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-27T01-19-27-784Z.zip
  - Error: Opportunity link not found by title: Community Garden PlantingGreen Earth FoundationEnvironmentFri, Jul 3, 2026 · 3:00 PM–6:00 PM · 3h145 Maple Street, New York, NY0/10spotsView Details →
  - URL: http://localhost:5173/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-025-2026-06-27T01-01-37-607Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-27T01-01-15-900Z.zip
  - Error: Signed-up activity card not found on dashboard
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-025-2026-06-27T00-53-17-885Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-27T00-52-59-954Z.zip
  - Error: No signed opportunity title recorded from item 23
  - URL: http://localhost:5173/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-025-2026-06-26T23-19-55-890Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-26T23-17-32-289Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: No signed opportunity title recorded from item 23
  - URL: http://127.0.0.1:5174/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-025-2026-05-18T13-46-54-473Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
- [ ] **Waitlist promotion** · If another student cancels and a waitlisted student exists, waitlisted student becomes CONFIRMED (check DB or re-browse) — PASS — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — FAIL
  - Error: Waitlisted student was not promoted to CONFIRMED after cancellation
  - URL: http://localhost:5173/slot/cmqzat3uw000cmu0qde1utnvx
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-026-2026-07-12T17-33-00-509Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-jane-2026-07-12T17-32-45-571Z.zip
  - Reason: Waitlist-promotion coverage depends on item 24 locating a full slot with a waitlist path, which is not present in the current seed state.
  - Manual Step: Seed a capacity-full slot, join it with the second student, then re-run cancellation and promotion verification together.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Waitlist-promotion coverage depends on item 24 locating a full slot with a waitlist path, which is not present in the current seed state.
  - Manual Step: Seed a capacity-full slot, join it with the second student, then re-run cancellation and promotion verification together.
  - Reason: Waitlist-promotion coverage depends on item 24 locating a full slot with a waitlist path, which is not present in the current seed state.
  - Manual Step: Seed a capacity-full slot, join it with the second student, then re-run cancellation and promotion verification together.
  - Reason: Waitlist-promotion coverage depends on item 24 locating a full slot with a waitlist path, which is not present in the current seed state.
  - Manual Step: Seed a capacity-full slot, join it with the second student, then re-run cancellation and promotion verification together.
  - Reason: Waitlist-promotion coverage depends on item 24 locating a full slot with a waitlist path, which is not present in the current seed state.
  - Manual Step: Seed a capacity-full slot, join it with the second student, then re-run cancellation and promotion verification together.
  - Reason: Waitlist-promotion coverage depends on item 24 locating a full slot with a waitlist path, which is not present in the current seed state.
  - Manual Step: Seed a capacity-full slot, join it with the second student, then re-run cancellation and promotion verification together.
  - Reason: Waitlist-promotion coverage depends on item 24 locating a full slot with a waitlist path, which is not present in the current seed state.
  - Manual Step: Seed a capacity-full slot, join it with the second student, then re-run cancellation and promotion verification together.
  - Reason: Waitlist-promotion coverage depends on item 24 locating a full slot with a waitlist path, which is not present in the current seed state.
  - Manual Step: Seed a capacity-full slot, join it with the second student, then re-run cancellation and promotion verification together.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Waitlist-promotion coverage depends on item 24 locating a full slot with a waitlist path, which is not present in the current seed state.
  - Manual Step: Seed a capacity-full slot, join it with the second student, then re-run cancellation and promotion verification together.
  - Reason: Waitlist-promotion coverage depends on item 24 locating a full slot with a waitlist path, which is not present in the current seed state.
  - Manual Step: Seed a capacity-full slot, join it with the second student, then re-run cancellation and promotion verification together.
  - Reason: Waitlist-promotion coverage depends on item 24 locating a full slot with a waitlist path, which is not present in the current seed state.
  - Manual Step: Seed a capacity-full slot, join it with the second student, then re-run cancellation and promotion verification together.
  - Reason: Waitlist-promotion coverage depends on item 24 locating a full slot with a waitlist path, which is not present in the current seed state.
  - Manual Step: Seed a capacity-full slot, join it with the second student, then re-run cancellation and promotion verification together.
  - Reason: Waitlist-promotion coverage depends on item 24 locating a full slot with a waitlist path, which is not present in the current seed state.
  - Manual Step: Seed a capacity-full slot, join it with the second student, then re-run cancellation and promotion verification together.
  - Reason: Waitlist-promotion coverage depends on item 24 locating a full slot with a waitlist path, which is not present in the current seed state.
  - Manual Step: Seed a capacity-full slot, join it with the second student, then re-run cancellation and promotion verification together.
  - Reason: Waitlist-promotion coverage depends on item 24 locating a full slot with a waitlist path, which is not present in the current seed state.
  - Manual Step: Seed a capacity-full slot, join it with the second student, then re-run cancellation and promotion verification together.
  - Reason: Waitlist-promotion coverage depends on item 24 locating a full slot with a waitlist path, which is not present in the current seed state.
  - Manual Step: Seed a capacity-full slot, join it with the second student, then re-run cancellation and promotion verification together.
  - Error: No waitlist opportunity recorded from item 24
  - URL: http://localhost:5173/slot/cmquusyn0000n8o5yhqmmkc9u
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-026-2026-06-27T01-56-50-970Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-jane-2026-06-27T01-56-38-327Z.zip
  - Error: No waitlist opportunity recorded from item 24
  - URL: http://localhost:5173/slot/cmquusyn0000n8o5yhqmmkc9u
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-026-2026-06-27T01-46-59-879Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-jane-2026-06-27T01-46-47-133Z.zip
  - Error: No waitlist opportunity recorded from item 24
  - URL: http://localhost:5173/slot/cmquusyn0000n8o5yhqmmkc9u
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-026-2026-06-27T01-34-33-474Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-jane-2026-06-27T01-34-20-740Z.zip
  - Error: No waitlist opportunity recorded from item 24
  - URL: http://localhost:5173/slot/cmquusyn0000n8o5yhqmmkc9u
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-026-2026-06-27T01-26-52-187Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-jane-2026-06-27T01-26-39-343Z.zip
  - Error: No waitlist opportunity recorded from item 24
  - URL: http://localhost:5173/slot/cmquusyn0000n8o5yhqmmkc9u
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-026-2026-06-27T01-19-49-405Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-jane-2026-06-27T01-19-36-647Z.zip
  - Error: No waitlist opportunity recorded from item 24
  - URL: http://localhost:5173/slot/cmquusyn0000n8o5yhqmmkc9u
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-026-2026-06-27T01-01-37-662Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-jane-2026-06-27T01-01-24-904Z.zip
  - Error: No waitlist opportunity recorded from item 24
  - URL: http://localhost:5173/slot/cmquusyn0000n8o5yhqmmkc9u
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-026-2026-06-27T00-53-17-954Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-jane-2026-06-27T00-53-07-469Z.zip
  - Error: No waitlist opportunity recorded from item 24
  - URL: http://localhost:5173/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-026-2026-06-26T23-19-55-965Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-jane-2026-06-26T23-19-52-127Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: No waitlist opportunity recorded from item 24
  - URL: http://127.0.0.1:5174/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-026-2026-05-18T13-46-54-520Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-jane-2026-05-18T13-46-51-459Z.zip

### 2d · Check-In / Check-Out
- [ ] **Check in** · From dashboard or activity, click "Check In" on a confirmed session — PASS — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Current seed state does not expose a check-in-ready confirmed session on the dashboard.
  - Manual Step: Seed or locate a confirmed session within its check-in window, then verify Check In transitions the session state correctly.
  - Reason: Current seed state does not expose a check-in-ready confirmed session on the dashboard.
  - Manual Step: Seed or locate a confirmed session within its check-in window, then verify Check In transitions the session state correctly.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Current seed state does not expose a check-in-ready confirmed session on the dashboard.
  - Manual Step: Seed or locate a confirmed session within its check-in window, then verify Check In transitions the session state correctly.
  - Reason: Current seed state does not expose a check-in-ready confirmed session on the dashboard.
  - Manual Step: Seed or locate a confirmed session within its check-in window, then verify Check In transitions the session state correctly.
  - Reason: Current seed state does not expose a check-in-ready confirmed session on the dashboard.
  - Manual Step: Seed or locate a confirmed session within its check-in window, then verify Check In transitions the session state correctly.
  - Reason: Current seed state does not expose a check-in-ready confirmed session on the dashboard.
  - Manual Step: Seed or locate a confirmed session within its check-in window, then verify Check In transitions the session state correctly.
  - Reason: Current seed state does not expose a check-in-ready confirmed session on the dashboard.
  - Manual Step: Seed or locate a confirmed session within its check-in window, then verify Check In transitions the session state correctly.
  - Reason: Current seed state does not expose a check-in-ready confirmed session on the dashboard.
  - Manual Step: Seed or locate a confirmed session within its check-in window, then verify Check In transitions the session state correctly.
  - Reason: Current seed state does not expose a check-in-ready confirmed session on the dashboard.
  - Manual Step: Seed or locate a confirmed session within its check-in window, then verify Check In transitions the session state correctly.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Current seed state does not expose a check-in-ready confirmed session on the dashboard.
  - Manual Step: Seed or locate a confirmed session within its check-in window, then verify Check In transitions the session state correctly.
  - Reason: Current seed state does not expose a check-in-ready confirmed session on the dashboard.
  - Manual Step: Seed or locate a confirmed session within its check-in window, then verify Check In transitions the session state correctly.
  - Reason: Current seed state does not expose a check-in-ready confirmed session on the dashboard.
  - Manual Step: Seed or locate a confirmed session within its check-in window, then verify Check In transitions the session state correctly.
  - Reason: Current seed state does not expose a check-in-ready confirmed session on the dashboard.
  - Manual Step: Seed or locate a confirmed session within its check-in window, then verify Check In transitions the session state correctly.
  - Reason: Current seed state does not expose a check-in-ready confirmed session on the dashboard.
  - Manual Step: Seed or locate a confirmed session within its check-in window, then verify Check In transitions the session state correctly.
  - Reason: Current seed state does not expose a check-in-ready confirmed session on the dashboard.
  - Manual Step: Seed or locate a confirmed session within its check-in window, then verify Check In transitions the session state correctly.
  - Reason: Current seed state does not expose a check-in-ready confirmed session on the dashboard.
  - Manual Step: Seed or locate a confirmed session within its check-in window, then verify Check In transitions the session state correctly.
  - Reason: Current seed state does not expose a check-in-ready confirmed session on the dashboard.
  - Manual Step: Seed or locate a confirmed session within its check-in window, then verify Check In transitions the session state correctly.
  - Reason: Current seed state does not expose a check-in-ready confirmed session on the dashboard.
  - Manual Step: Seed or locate a confirmed session within its check-in window, then verify Check In transitions the session state correctly.
  - Reason: Current seed state does not expose a check-in-ready confirmed session on the dashboard.
  - Manual Step: Seed or locate a confirmed session within its check-in window, then verify Check In transitions the session state correctly.
  - Reason: Current seed state does not expose a check-in-ready confirmed session on the dashboard.
  - Manual Step: Seed or locate a confirmed session within its check-in window, then verify Check In transitions the session state correctly.
  - Reason: Current seed state does not expose a check-in-ready confirmed session on the dashboard.
  - Manual Step: Seed or locate a confirmed session within its check-in window, then verify Check In transitions the session state correctly.
  - Reason: Current seed state does not expose a check-in-ready confirmed session on the dashboard.
  - Manual Step: Seed or locate a confirmed session within its check-in window, then verify Check In transitions the session state correctly.
  - Reason: Current seed state does not expose a check-in-ready confirmed session on the dashboard.
  - Manual Step: Seed or locate a confirmed session within its check-in window, then verify Check In transitions the session state correctly.
  - Error: Check In button not found on dashboard/activity for confirmed session
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-027-2026-06-27T00-53-18-610Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-27T00-52-59-954Z.zip
  - Error: Check In button not found on dashboard/activity for confirmed session
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-027-2026-06-26T23-19-56-672Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-26T23-17-32-289Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Check In button not found on dashboard/activity for confirmed session
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-027-2026-05-18T13-46-55-214Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
  _Expect: session status → CHECKED_IN; check-in time recorded_
- [ ] **Check out** · Click "Check Out" — PASS — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Current seed state does not expose a checked-in session ready for checkout.
  - Manual Step: Use a session that has already been checked in, then confirm Check Out appears, completes, and exposes verification next steps.
  - Reason: Current seed state does not expose a checked-in session ready for checkout.
  - Manual Step: Use a session that has already been checked in, then confirm Check Out appears, completes, and exposes verification next steps.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Current seed state does not expose a checked-in session ready for checkout.
  - Manual Step: Use a session that has already been checked in, then confirm Check Out appears, completes, and exposes verification next steps.
  - Reason: Current seed state does not expose a checked-in session ready for checkout.
  - Manual Step: Use a session that has already been checked in, then confirm Check Out appears, completes, and exposes verification next steps.
  - Reason: Current seed state does not expose a checked-in session ready for checkout.
  - Manual Step: Use a session that has already been checked in, then confirm Check Out appears, completes, and exposes verification next steps.
  - Reason: Current seed state does not expose a checked-in session ready for checkout.
  - Manual Step: Use a session that has already been checked in, then confirm Check Out appears, completes, and exposes verification next steps.
  - Reason: Current seed state does not expose a checked-in session ready for checkout.
  - Manual Step: Use a session that has already been checked in, then confirm Check Out appears, completes, and exposes verification next steps.
  - Reason: Current seed state does not expose a checked-in session ready for checkout.
  - Manual Step: Use a session that has already been checked in, then confirm Check Out appears, completes, and exposes verification next steps.
  - Reason: Current seed state does not expose a checked-in session ready for checkout.
  - Manual Step: Use a session that has already been checked in, then confirm Check Out appears, completes, and exposes verification next steps.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Current seed state does not expose a checked-in session ready for checkout.
  - Manual Step: Use a session that has already been checked in, then confirm Check Out appears, completes, and exposes verification next steps.
  - Reason: Current seed state does not expose a checked-in session ready for checkout.
  - Manual Step: Use a session that has already been checked in, then confirm Check Out appears, completes, and exposes verification next steps.
  - Reason: Current seed state does not expose a checked-in session ready for checkout.
  - Manual Step: Use a session that has already been checked in, then confirm Check Out appears, completes, and exposes verification next steps.
  - Reason: Current seed state does not expose a checked-in session ready for checkout.
  - Manual Step: Use a session that has already been checked in, then confirm Check Out appears, completes, and exposes verification next steps.
  - Reason: Current seed state does not expose a checked-in session ready for checkout.
  - Manual Step: Use a session that has already been checked in, then confirm Check Out appears, completes, and exposes verification next steps.
  - Reason: Current seed state does not expose a checked-in session ready for checkout.
  - Manual Step: Use a session that has already been checked in, then confirm Check Out appears, completes, and exposes verification next steps.
  - Reason: Current seed state does not expose a checked-in session ready for checkout.
  - Manual Step: Use a session that has already been checked in, then confirm Check Out appears, completes, and exposes verification next steps.
  - Reason: Current seed state does not expose a checked-in session ready for checkout.
  - Manual Step: Use a session that has already been checked in, then confirm Check Out appears, completes, and exposes verification next steps.
  - Reason: Current seed state does not expose a checked-in session ready for checkout.
  - Manual Step: Use a session that has already been checked in, then confirm Check Out appears, completes, and exposes verification next steps.
  - Reason: Current seed state does not expose a checked-in session ready for checkout.
  - Manual Step: Use a session that has already been checked in, then confirm Check Out appears, completes, and exposes verification next steps.
  - Reason: Current seed state does not expose a checked-in session ready for checkout.
  - Manual Step: Use a session that has already been checked in, then confirm Check Out appears, completes, and exposes verification next steps.
  - Reason: Current seed state does not expose a checked-in session ready for checkout.
  - Manual Step: Use a session that has already been checked in, then confirm Check Out appears, completes, and exposes verification next steps.
  - Reason: Current seed state does not expose a checked-in session ready for checkout.
  - Manual Step: Use a session that has already been checked in, then confirm Check Out appears, completes, and exposes verification next steps.
  - Reason: Current seed state does not expose a checked-in session ready for checkout.
  - Manual Step: Use a session that has already been checked in, then confirm Check Out appears, completes, and exposes verification next steps.
  - Error: Check Out button not found after check-in
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-028-2026-06-27T00-53-18-681Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-27T00-52-59-954Z.zip
  - Error: Check Out button not found after check-in
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-028-2026-06-26T23-19-56-731Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-26T23-17-32-289Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Check Out button not found after check-in
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-028-2026-05-18T13-46-55-281Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
  _Expect: status → CHECKED_OUT; `totalHours` auto-calculated from elapsed time_

### 2e · Submit Verification
- [ ] **Drawn signature** · On a CHECKED_OUT session, open "Submit Verification" → draw signature → submit — PASS — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Current seed state does not expose a checked-out session ready for verification submission.
  - Manual Step: Use a student session that has already been checked out, open Submit Verification, draw a signature, and confirm the submission enters pending review.
  - Reason: Current seed state does not expose a checked-out session ready for verification submission.
  - Manual Step: Use a student session that has already been checked out, open Submit Verification, draw a signature, and confirm the submission enters pending review.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Current seed state does not expose a checked-out session ready for verification submission.
  - Manual Step: Use a student session that has already been checked out, open Submit Verification, draw a signature, and confirm the submission enters pending review.
  - Reason: Current seed state does not expose a checked-out session ready for verification submission.
  - Manual Step: Use a student session that has already been checked out, open Submit Verification, draw a signature, and confirm the submission enters pending review.
  - Reason: Current seed state does not expose a checked-out session ready for verification submission.
  - Manual Step: Use a student session that has already been checked out, open Submit Verification, draw a signature, and confirm the submission enters pending review.
  - Reason: Current seed state does not expose a checked-out session ready for verification submission.
  - Manual Step: Use a student session that has already been checked out, open Submit Verification, draw a signature, and confirm the submission enters pending review.
  - Reason: Current seed state does not expose a checked-out session ready for verification submission.
  - Manual Step: Use a student session that has already been checked out, open Submit Verification, draw a signature, and confirm the submission enters pending review.
  - Reason: Current seed state does not expose a checked-out session ready for verification submission.
  - Manual Step: Use a student session that has already been checked out, open Submit Verification, draw a signature, and confirm the submission enters pending review.
  - Reason: Current seed state does not expose a checked-out session ready for verification submission.
  - Manual Step: Use a student session that has already been checked out, open Submit Verification, draw a signature, and confirm the submission enters pending review.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Current seed state does not expose a checked-out session ready for verification submission.
  - Manual Step: Use a student session that has already been checked out, open Submit Verification, draw a signature, and confirm the submission enters pending review.
  - Reason: Current seed state does not expose a checked-out session ready for verification submission.
  - Manual Step: Use a student session that has already been checked out, open Submit Verification, draw a signature, and confirm the submission enters pending review.
  - Reason: Current seed state does not expose a checked-out session ready for verification submission.
  - Manual Step: Use a student session that has already been checked out, open Submit Verification, draw a signature, and confirm the submission enters pending review.
  - Reason: Current seed state does not expose a checked-out session ready for verification submission.
  - Manual Step: Use a student session that has already been checked out, open Submit Verification, draw a signature, and confirm the submission enters pending review.
  - Reason: Current seed state does not expose a checked-out session ready for verification submission.
  - Manual Step: Use a student session that has already been checked out, open Submit Verification, draw a signature, and confirm the submission enters pending review.
  - Reason: Current seed state does not expose a checked-out session ready for verification submission.
  - Manual Step: Use a student session that has already been checked out, open Submit Verification, draw a signature, and confirm the submission enters pending review.
  - Reason: Current seed state does not expose a checked-out session ready for verification submission.
  - Manual Step: Use a student session that has already been checked out, open Submit Verification, draw a signature, and confirm the submission enters pending review.
  - Reason: Current seed state does not expose a checked-out session ready for verification submission.
  - Manual Step: Use a student session that has already been checked out, open Submit Verification, draw a signature, and confirm the submission enters pending review.
  - Reason: Current seed state does not expose a checked-out session ready for verification submission.
  - Manual Step: Use a student session that has already been checked out, open Submit Verification, draw a signature, and confirm the submission enters pending review.
  - Reason: Current seed state does not expose a checked-out session ready for verification submission.
  - Manual Step: Use a student session that has already been checked out, open Submit Verification, draw a signature, and confirm the submission enters pending review.
  - Reason: Current seed state does not expose a checked-out session ready for verification submission.
  - Manual Step: Use a student session that has already been checked out, open Submit Verification, draw a signature, and confirm the submission enters pending review.
  - Reason: Current seed state does not expose a checked-out session ready for verification submission.
  - Manual Step: Use a student session that has already been checked out, open Submit Verification, draw a signature, and confirm the submission enters pending review.
  - Reason: Current seed state does not expose a checked-out session ready for verification submission.
  - Manual Step: Use a student session that has already been checked out, open Submit Verification, draw a signature, and confirm the submission enters pending review.
  - Reason: Current seed state does not expose a checked-out session ready for verification submission.
  - Manual Step: Use a student session that has already been checked out, open Submit Verification, draw a signature, and confirm the submission enters pending review.
  - Error: No signable opportunity found to create a verification session
  - URL: http://localhost:5173/slot/cmquusyn0000n8o5yhqmmkc9u
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-029-2026-06-27T00-53-31-615Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-27T00-52-59-954Z.zip
  - Error: No signable opportunity found to create a verification session
  - URL: http://localhost:5173/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-029-2026-06-26T23-19-58-001Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-26T23-17-32-289Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
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
- [ ] **File upload** · Submit verification with a PDF/PNG/JPG upload — PASS — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Current seed state does not expose a verification-ready session for file-upload coverage.
  - Manual Step: Use a checked-out session, open Submit Verification, confirm `.exe` is rejected and PDF/PNG/JPG are accepted.
  - Reason: Current seed state does not expose a verification-ready session for file-upload coverage.
  - Manual Step: Use a checked-out session, open Submit Verification, confirm `.exe` is rejected and PDF/PNG/JPG are accepted.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Current seed state does not expose a verification-ready session for file-upload coverage.
  - Manual Step: Use a checked-out session, open Submit Verification, confirm `.exe` is rejected and PDF/PNG/JPG are accepted.
  - Reason: Current seed state does not expose a verification-ready session for file-upload coverage.
  - Manual Step: Use a checked-out session, open Submit Verification, confirm `.exe` is rejected and PDF/PNG/JPG are accepted.
  - Reason: Current seed state does not expose a verification-ready session for file-upload coverage.
  - Manual Step: Use a checked-out session, open Submit Verification, confirm `.exe` is rejected and PDF/PNG/JPG are accepted.
  - Reason: Current seed state does not expose a verification-ready session for file-upload coverage.
  - Manual Step: Use a checked-out session, open Submit Verification, confirm `.exe` is rejected and PDF/PNG/JPG are accepted.
  - Reason: Current seed state does not expose a verification-ready session for file-upload coverage.
  - Manual Step: Use a checked-out session, open Submit Verification, confirm `.exe` is rejected and PDF/PNG/JPG are accepted.
  - Reason: Current seed state does not expose a verification-ready session for file-upload coverage.
  - Manual Step: Use a checked-out session, open Submit Verification, confirm `.exe` is rejected and PDF/PNG/JPG are accepted.
  - Reason: Current seed state does not expose a verification-ready session for file-upload coverage.
  - Manual Step: Use a checked-out session, open Submit Verification, confirm `.exe` is rejected and PDF/PNG/JPG are accepted.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Current seed state does not expose a verification-ready session for file-upload coverage.
  - Manual Step: Use a checked-out session, open Submit Verification, confirm `.exe` is rejected and PDF/PNG/JPG are accepted.
  - Reason: Current seed state does not expose a verification-ready session for file-upload coverage.
  - Manual Step: Use a checked-out session, open Submit Verification, confirm `.exe` is rejected and PDF/PNG/JPG are accepted.
  - Reason: Current seed state does not expose a verification-ready session for file-upload coverage.
  - Manual Step: Use a checked-out session, open Submit Verification, confirm `.exe` is rejected and PDF/PNG/JPG are accepted.
  - Reason: Current seed state does not expose a verification-ready session for file-upload coverage.
  - Manual Step: Use a checked-out session, open Submit Verification, confirm `.exe` is rejected and PDF/PNG/JPG are accepted.
  - Reason: Current seed state does not expose a verification-ready session for file-upload coverage.
  - Manual Step: Use a checked-out session, open Submit Verification, confirm `.exe` is rejected and PDF/PNG/JPG are accepted.
  - Reason: Current seed state does not expose a verification-ready session for file-upload coverage.
  - Manual Step: Use a checked-out session, open Submit Verification, confirm `.exe` is rejected and PDF/PNG/JPG are accepted.
  - Reason: Current seed state does not expose a verification-ready session for file-upload coverage.
  - Manual Step: Use a checked-out session, open Submit Verification, confirm `.exe` is rejected and PDF/PNG/JPG are accepted.
  - Reason: Current seed state does not expose a verification-ready session for file-upload coverage.
  - Manual Step: Use a checked-out session, open Submit Verification, confirm `.exe` is rejected and PDF/PNG/JPG are accepted.
  - Reason: Current seed state does not expose a verification-ready session for file-upload coverage.
  - Manual Step: Use a checked-out session, open Submit Verification, confirm `.exe` is rejected and PDF/PNG/JPG are accepted.
  - Reason: Current seed state does not expose a verification-ready session for file-upload coverage.
  - Manual Step: Use a checked-out session, open Submit Verification, confirm `.exe` is rejected and PDF/PNG/JPG are accepted.
  - Reason: Current seed state does not expose a verification-ready session for file-upload coverage.
  - Manual Step: Use a checked-out session, open Submit Verification, confirm `.exe` is rejected and PDF/PNG/JPG are accepted.
  - Reason: Current seed state does not expose a verification-ready session for file-upload coverage.
  - Manual Step: Use a checked-out session, open Submit Verification, confirm `.exe` is rejected and PDF/PNG/JPG are accepted.
  - Reason: Current seed state does not expose a verification-ready session for file-upload coverage.
  - Manual Step: Use a checked-out session, open Submit Verification, confirm `.exe` is rejected and PDF/PNG/JPG are accepted.
  - Reason: Current seed state does not expose a verification-ready session for file-upload coverage.
  - Manual Step: Use a checked-out session, open Submit Verification, confirm `.exe` is rejected and PDF/PNG/JPG are accepted.
  - Error: No suitable opportunity found for file upload verification test
  - URL: http://localhost:5173/slot/cmquusyn0000n8o5yhqmmkc9u
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-030-2026-06-27T00-53-44-537Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-27T00-52-59-954Z.zip
  - Error: No suitable opportunity found for file upload verification test
  - URL: http://localhost:5173/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-030-2026-06-26T23-19-59-274Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-26T23-17-32-289Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
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
- [ ] **Before event date** · Try submitting verification before event date — PASS — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: The current seed state does not reliably guarantee a future checked-out session with verification blocked by date.
  - Manual Step: Create or identify a future confirmed slot, check in/out if allowed, open verification, and confirm the UI blocks submission until the event date when that rule applies.
  - Reason: The current seed state does not reliably guarantee a future checked-out session with verification blocked by date.
  - Manual Step: Create or identify a future confirmed slot, check in/out if allowed, open verification, and confirm the UI blocks submission until the event date when that rule applies.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The current seed state does not reliably guarantee a future checked-out session with verification blocked by date.
  - Manual Step: Create or identify a future confirmed slot, check in/out if allowed, open verification, and confirm the UI blocks submission until the event date when that rule applies.
  - Reason: The current seed state does not reliably guarantee a future checked-out session with verification blocked by date.
  - Manual Step: Create or identify a future confirmed slot, check in/out if allowed, open verification, and confirm the UI blocks submission until the event date when that rule applies.
  - Reason: The current seed state does not reliably guarantee a future checked-out session with verification blocked by date.
  - Manual Step: Create or identify a future confirmed slot, check in/out if allowed, open verification, and confirm the UI blocks submission until the event date when that rule applies.
  - Reason: The current seed state does not reliably guarantee a future checked-out session with verification blocked by date.
  - Manual Step: Create or identify a future confirmed slot, check in/out if allowed, open verification, and confirm the UI blocks submission until the event date when that rule applies.
  - Reason: The current seed state does not reliably guarantee a future checked-out session with verification blocked by date.
  - Manual Step: Create or identify a future confirmed slot, check in/out if allowed, open verification, and confirm the UI blocks submission until the event date when that rule applies.
  - Reason: The current seed state does not reliably guarantee a future checked-out session with verification blocked by date.
  - Manual Step: Create or identify a future confirmed slot, check in/out if allowed, open verification, and confirm the UI blocks submission until the event date when that rule applies.
  - Reason: The current seed state does not reliably guarantee a future checked-out session with verification blocked by date.
  - Manual Step: Create or identify a future confirmed slot, check in/out if allowed, open verification, and confirm the UI blocks submission until the event date when that rule applies.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The current seed state does not reliably guarantee a future checked-out session with verification blocked by date.
  - Manual Step: Create or identify a future confirmed slot, check in/out if allowed, open verification, and confirm the UI blocks submission until the event date when that rule applies.
  - Reason: The current seed state does not reliably guarantee a future checked-out session with verification blocked by date.
  - Manual Step: Create or identify a future confirmed slot, check in/out if allowed, open verification, and confirm the UI blocks submission until the event date when that rule applies.
  - Reason: The current seed state does not reliably guarantee a future checked-out session with verification blocked by date.
  - Manual Step: Create or identify a future confirmed slot, check in/out if allowed, open verification, and confirm the UI blocks submission until the event date when that rule applies.
  - Reason: The current seed state does not reliably guarantee a future checked-out session with verification blocked by date.
  - Manual Step: Create or identify a future confirmed slot, check in/out if allowed, open verification, and confirm the UI blocks submission until the event date when that rule applies.
  - Reason: The current seed state does not reliably guarantee a future checked-out session with verification blocked by date.
  - Manual Step: Create or identify a future confirmed slot, check in/out if allowed, open verification, and confirm the UI blocks submission until the event date when that rule applies.
  - Reason: The current seed state does not reliably guarantee a future checked-out session with verification blocked by date.
  - Manual Step: Create or identify a future confirmed slot, check in/out if allowed, open verification, and confirm the UI blocks submission until the event date when that rule applies.
  - Reason: The current seed state does not reliably guarantee a future checked-out session with verification blocked by date.
  - Manual Step: Create or identify a future confirmed slot, check in/out if allowed, open verification, and confirm the UI blocks submission until the event date when that rule applies.
  - Reason: The current seed state does not reliably guarantee a future checked-out session with verification blocked by date.
  - Manual Step: Create or identify a future confirmed slot, check in/out if allowed, open verification, and confirm the UI blocks submission until the event date when that rule applies.
  - Reason: The current seed state does not reliably guarantee a future checked-out session with verification blocked by date.
  - Manual Step: Create or identify a future confirmed slot, check in/out if allowed, open verification, and confirm the UI blocks submission until the event date when that rule applies.
  - Reason: The current seed state does not reliably guarantee a future checked-out session with verification blocked by date.
  - Manual Step: Create or identify a future confirmed slot, check in/out if allowed, open verification, and confirm the UI blocks submission until the event date when that rule applies.
  - Reason: The current seed state does not reliably guarantee a future checked-out session with verification blocked by date.
  - Manual Step: Create or identify a future confirmed slot, check in/out if allowed, open verification, and confirm the UI blocks submission until the event date when that rule applies.
  - Reason: The current seed state does not reliably guarantee a future checked-out session with verification blocked by date.
  - Manual Step: Create or identify a future confirmed slot, check in/out if allowed, open verification, and confirm the UI blocks submission until the event date when that rule applies.
  - Reason: The current seed state does not reliably guarantee a future checked-out session with verification blocked by date.
  - Manual Step: Create or identify a future confirmed slot, check in/out if allowed, open verification, and confirm the UI blocks submission until the event date when that rule applies.
  - Reason: The current seed state does not reliably guarantee a future checked-out session with verification blocked by date.
  - Manual Step: Create or identify a future confirmed slot, check in/out if allowed, open verification, and confirm the UI blocks submission until the event date when that rule applies.
  - Reason: The current seed state does not reliably guarantee a future checked-out session with verification blocked by date.
  - Manual Step: Create or identify a future confirmed slot, check in/out if allowed, open verification, and confirm the UI blocks submission until the event date when that rule applies.
  - Error: Could not verify blocking behavior for verification before event date
  - URL: http://localhost:5173/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-031-2026-06-26T23-19-59-954Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-26T23-17-32-289Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
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
- [ ] Settings → Profile → "Export Hours (CSV)" downloads a `.csv` with correct columns (Date, Opportunity, Organization, Hours, Status) — PASS — PASS — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — PASS — PASS
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
- [ ] Settings → Profile → "Export as PDF" generates a PDF report — PASS — PASS — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — PASS — PASS
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.

### 2g · Messages
- [ ] Navigate to Messages → inbox loads — PASS — PASS — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — PASS — PASS
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
- [ ] **Compose** · Send message to `volunteer@greenearth.org` — appears in Sent folder — PASS — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — PASS — PASS
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: page.waitForTimeout: Test ended.
  - URL: http://localhost:5173/messages
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-035-2026-06-28T19-08-28-647Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-28T19-08-09-007Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Sent folder does not include message sent to org
  - URL: http://127.0.0.1:5174/messages
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-035-2026-05-18T13-47-01-359Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
  - Console/Network Logs Snippet:

```text
[2026-05-18T13:46:59.919Z] response: 404 POST http://127.0.0.1:5174/api/messages
[2026-05-18T13:46:59.919Z] console.error: Failed to load resource: the server responded with a status of 404 (Not Found)
```
- [ ] **Mark as read** · Unread message → click it → badge clears — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: No unread messages exist to mark as read in this environment state.
  - Manual Step: Create or receive an unread message, open it, and confirm unread badge clears.
  - Reason: No unread messages exist to mark as read in this environment state.
  - Manual Step: Create or receive an unread message, open it, and confirm unread badge clears.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: No unread messages exist to mark as read in this environment state.
  - Manual Step: Create or receive an unread message, open it, and confirm unread badge clears.
  - Reason: No unread messages exist to mark as read in this environment state.
  - Manual Step: Create or receive an unread message, open it, and confirm unread badge clears.
  - Reason: No unread messages exist to mark as read in this environment state.
  - Manual Step: Create or receive an unread message, open it, and confirm unread badge clears.
  - Reason: No unread messages exist to mark as read in this environment state.
  - Manual Step: Create or receive an unread message, open it, and confirm unread badge clears.
  - Reason: No unread messages exist to mark as read in this environment state.
  - Manual Step: Create or receive an unread message, open it, and confirm unread badge clears.
  - Reason: No unread messages exist to mark as read in this environment state.
  - Manual Step: Create or receive an unread message, open it, and confirm unread badge clears.
  - Reason: No unread messages exist to mark as read in this environment state.
  - Manual Step: Create or receive an unread message, open it, and confirm unread badge clears.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: No unread messages exist to mark as read in this environment state.
  - Manual Step: Create or receive an unread message, open it, and confirm unread badge clears.
  - Reason: No unread messages exist to mark as read in this environment state.
  - Manual Step: Create or receive an unread message, open it, and confirm unread badge clears.
  - Reason: No unread messages exist to mark as read in this environment state.
  - Manual Step: Create or receive an unread message, open it, and confirm unread badge clears.
  - Reason: No unread messages exist to mark as read in this environment state.
  - Manual Step: Create or receive an unread message, open it, and confirm unread badge clears.
  - Reason: No unread messages exist to mark as read in this environment state.
  - Manual Step: Create or receive an unread message, open it, and confirm unread badge clears.
  - Error: locator.click: Target page, context or browser has been closed
  - URL: http://localhost:5173/messages
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-036-2026-06-28T19-08-28-649Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-28T19-08-09-007Z.zip
  - Reason: No unread messages exist to mark as read in this environment state.
  - Manual Step: Create or receive an unread message, open it, and confirm unread badge clears.
  - Reason: No unread messages exist to mark as read in this environment state.
  - Manual Step: Create or receive an unread message, open it, and confirm unread badge clears.
  - Reason: No unread messages exist to mark as read in this environment state.
  - Manual Step: Create or receive an unread message, open it, and confirm unread badge clears.
  - Reason: No unread messages exist to mark as read in this environment state.
  - Manual Step: Create or receive an unread message, open it, and confirm unread badge clears.
  - Reason: No unread messages exist to mark as read in this environment state.
  - Manual Step: Create or receive an unread message, open it, and confirm unread badge clears.
  - Reason: No unread messages exist to mark as read in this environment state.
  - Manual Step: Create or receive an unread message, open it, and confirm unread badge clears.
  - Reason: No unread messages exist to mark as read in this environment state.
  - Manual Step: Create or receive an unread message, open it, and confirm unread badge clears.
  - Reason: No unread messages exist to mark as read in this environment state.
  - Manual Step: Create or receive an unread message, open it, and confirm unread badge clears.
  - Reason: No unread messages exist to mark as read in this environment state.
  - Manual Step: Create or receive an unread message, open it, and confirm unread badge clears.
  - Reason: No unread messages exist to mark as read in this environment state.
  - Manual Step: Create or receive an unread message, open it, and confirm unread badge clears.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: No unread messages exist to mark as read in this environment state.
  - Manual Step: Create or receive an unread message, open it, and confirm unread badge clears.
  - Reason: No unread messages exist to mark as read in this environment state.
  - Manual Step: Create or receive an unread message, open it, and confirm unread badge clears.
- [ ] **Notifications tab** · System notifications listed; clicking one marks it read — PASS — PASS — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — PASS — PASS
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: locator.click: Target page, context or browser has been closed
  - URL: http://localhost:5173/messages
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-037-2026-06-28T19-08-28-649Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-28T19-08-09-007Z.zip
  - Error: Item was not executed due to unexpected suite interruption.

### 2h · Settings
- [ ] **Profile** · Edit name, phone, bio (check 300-char limit) → Save → refresh → changes persist — PASS — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — PASS — PASS
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: page.goto: Target page, context or browser has been closed
  - URL: http://localhost:5173/messages
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-038-2026-06-28T19-08-28-650Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-28T19-08-09-007Z.zip
  - Error: locator.waitFor: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByText(/Profile updated!/i) to be visible[22m

  - URL: http://localhost:5173/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-038-2026-06-27T01-20-24-028Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-27T01-19-27-784Z.zip
  - Console/Network Logs Snippet:

```text
[2026-06-27T01:20:09.033Z] response: 500 PUT http://localhost:5173/api/auth/profile
[2026-06-27T01:20:09.033Z] console.error: Failed to load resource: the server responded with a status of 500 (Internal Server Error)
```
  - Error: locator.waitFor: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByText(/Profile updated!/i) to be visible[22m

  - URL: http://localhost:5173/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-038-2026-06-27T01-02-15-173Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-27T01-01-15-900Z.zip
  - Console/Network Logs Snippet:

```text
[2026-06-27T01:02:00.178Z] response: 500 PUT http://localhost:5173/api/auth/profile
[2026-06-27T01:02:00.178Z] console.error: Failed to load resource: the server responded with a status of 500 (Internal Server Error)
```
  - Error: Profile name did not persist after save+refresh
  - URL: http://localhost:5173/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-038-2026-06-27T00-53-51-619Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-27T00-52-59-954Z.zip
  - Console/Network Logs Snippet:

```text
[2026-06-27T00:53:49.960Z] response: 500 PUT http://localhost:5173/api/auth/profile
[2026-06-27T00:53:49.960Z] console.error: Failed to load resource: the server responded with a status of 500 (Internal Server Error)
```
  - Error: locator.fill: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for locator('input[type="tel"]').first()[22m

  - URL: http://localhost:5173/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-038-2026-06-26T23-20-20-361Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-26T23-17-32-289Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: locator.fill: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for locator('input[type="tel"]').first()[22m

  - URL: http://127.0.0.1:5174/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-038-2026-05-18T13-47-18-817Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
- [ ] **Avatar upload** · Upload a profile image → avatar updates — PASS — PASS — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — PASS — PASS
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: page.goto: Target page, context or browser has been closed
  - URL: http://localhost:5173/messages
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-039-2026-06-28T19-08-28-650Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-28T19-08-09-007Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
- [ ] **Social links** · Enter Instagram handle → Save → persists — PASS — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Student social-link fields are not exposed in the current Settings UI.
  - Manual Step: If social links remain a product requirement, restore the field and re-enable a persistence check here.
  - Reason: Student social-link fields are not exposed in the current Settings UI.
  - Manual Step: If social links remain a product requirement, restore the field and re-enable a persistence check here.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Student social-link fields are not exposed in the current Settings UI.
  - Manual Step: If social links remain a product requirement, restore the field and re-enable a persistence check here.
  - Reason: Student social-link fields are not exposed in the current Settings UI.
  - Manual Step: If social links remain a product requirement, restore the field and re-enable a persistence check here.
  - Reason: Student social-link fields are not exposed in the current Settings UI.
  - Manual Step: If social links remain a product requirement, restore the field and re-enable a persistence check here.
  - Reason: Student social-link fields are not exposed in the current Settings UI.
  - Manual Step: If social links remain a product requirement, restore the field and re-enable a persistence check here.
  - Reason: Student social-link fields are not exposed in the current Settings UI.
  - Manual Step: If social links remain a product requirement, restore the field and re-enable a persistence check here.
  - Reason: Student social-link fields are not exposed in the current Settings UI.
  - Manual Step: If social links remain a product requirement, restore the field and re-enable a persistence check here.
  - Reason: Student social-link fields are not exposed in the current Settings UI.
  - Manual Step: If social links remain a product requirement, restore the field and re-enable a persistence check here.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Student social-link fields are not exposed in the current Settings UI.
  - Manual Step: If social links remain a product requirement, restore the field and re-enable a persistence check here.
  - Reason: Student social-link fields are not exposed in the current Settings UI.
  - Manual Step: If social links remain a product requirement, restore the field and re-enable a persistence check here.
  - Reason: Student social-link fields are not exposed in the current Settings UI.
  - Manual Step: If social links remain a product requirement, restore the field and re-enable a persistence check here.
  - Reason: Student social-link fields are not exposed in the current Settings UI.
  - Manual Step: If social links remain a product requirement, restore the field and re-enable a persistence check here.
  - Reason: Student social-link fields are not exposed in the current Settings UI.
  - Manual Step: If social links remain a product requirement, restore the field and re-enable a persistence check here.
  - Reason: Student social-link fields are not exposed in the current Settings UI.
  - Manual Step: If social links remain a product requirement, restore the field and re-enable a persistence check here.
  - Reason: Student social-link fields are not exposed in the current Settings UI.
  - Manual Step: If social links remain a product requirement, restore the field and re-enable a persistence check here.
  - Reason: Student social-link fields are not exposed in the current Settings UI.
  - Manual Step: If social links remain a product requirement, restore the field and re-enable a persistence check here.
  - Reason: Student social-link fields are not exposed in the current Settings UI.
  - Manual Step: If social links remain a product requirement, restore the field and re-enable a persistence check here.
  - Reason: Student social-link fields are not exposed in the current Settings UI.
  - Manual Step: If social links remain a product requirement, restore the field and re-enable a persistence check here.
  - Reason: Student social-link fields are not exposed in the current Settings UI.
  - Manual Step: If social links remain a product requirement, restore the field and re-enable a persistence check here.
  - Reason: Student social-link fields are not exposed in the current Settings UI.
  - Manual Step: If social links remain a product requirement, restore the field and re-enable a persistence check here.
  - Reason: Student social-link fields are not exposed in the current Settings UI.
  - Manual Step: If social links remain a product requirement, restore the field and re-enable a persistence check here.
  - Reason: Student social-link fields are not exposed in the current Settings UI.
  - Manual Step: If social links remain a product requirement, restore the field and re-enable a persistence check here.
  - Reason: Student social-link fields are not exposed in the current Settings UI.
  - Manual Step: If social links remain a product requirement, restore the field and re-enable a persistence check here.
  - Error: Instagram input not found
  - URL: http://localhost:5173/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-040-2026-06-26T23-20-23-442Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-26T23-17-32-289Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Instagram input not found
  - URL: http://127.0.0.1:5174/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-040-2026-05-18T13-47-21-893Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
- [ ] **Notifications** · Toggle off "Hour Approvals" email → save → setting persists on refresh — PASS — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — PASS — PASS
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: page.goto: Target page, context or browser has been closed
  - URL: http://localhost:5173/messages
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-041-2026-06-28T19-08-28-650Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-28T19-08-09-007Z.zip
  - Error: Hour Approvals email toggle did not persist a changed state
  - URL: http://localhost:5173/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-041-2026-06-27T01-20-28-669Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-27T01-19-27-784Z.zip
  - Error: Hour Approvals email toggle did not persist a changed state
  - URL: http://localhost:5173/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-041-2026-06-27T01-02-19-900Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-27T01-01-15-900Z.zip
  - Error: Hour Approvals email toggle not found
  - URL: http://localhost:5173/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-041-2026-06-27T00-53-55-072Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-27T00-52-59-954Z.zip
  - Error: Hour Approvals email toggle did not persist OFF state
  - URL: http://localhost:5173/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-041-2026-06-26T23-20-26-403Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-26T23-17-32-289Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Hour Approvals email toggle did not persist OFF state
  - URL: http://127.0.0.1:5174/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-041-2026-05-18T13-47-24-862Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
- [ ] **Privacy** · Set "Who can message me" to "Orgs Only" → save → persists — PASS — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — PASS — PASS
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: page.goto: Target page, context or browser has been closed
  - URL: http://localhost:5173/messages
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-042-2026-06-28T19-08-28-650Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-28T19-08-09-007Z.zip
  - Error: locator.waitFor: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByText(/Privacy settings saved!/i) to be visible[22m

  - URL: http://localhost:5173/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-042-2026-06-27T01-20-44-392Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-27T01-19-27-784Z.zip
  - Console/Network Logs Snippet:

```text
[2026-06-27T01:20:29.399Z] response: 400 PUT http://localhost:5173/api/auth/profile
[2026-06-27T01:20:29.399Z] console.error: Failed to load resource: the server responded with a status of 400 (Bad Request)
```
  - Error: locator.waitFor: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByText(/Privacy settings saved!/i) to be visible[22m

  - URL: http://localhost:5173/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-042-2026-06-27T01-02-35-638Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-27T01-01-15-900Z.zip
  - Console/Network Logs Snippet:

```text
[2026-06-27T01:02:20.643Z] response: 400 PUT http://localhost:5173/api/auth/profile
[2026-06-27T01:02:20.643Z] console.error: Failed to load resource: the server responded with a status of 400 (Bad Request)
```
  - Error: Privacy message restriction select not found
  - URL: http://localhost:5173/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-042-2026-06-27T00-53-55-806Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-27T00-52-59-954Z.zip
  - Error: Expected message restriction ORGS_ONLY, got EVERYONE
  - URL: http://localhost:5173/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-042-2026-06-26T23-20-28-487Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-26T23-17-32-289Z.zip
  - Console/Network Logs Snippet:

```text
[2026-06-26T23:20:27.118Z] response: 400 PUT http://localhost:5173/api/auth/profile
[2026-06-26T23:20:27.118Z] console.error: Failed to load resource: the server responded with a status of 400 (Bad Request)
```
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Expected message restriction ORGS_ONLY, got EVERYONE
  - URL: http://127.0.0.1:5174/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-042-2026-05-18T13-47-26-928Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
- [ ] **Change password** · Enter current + valid new password → success — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Changing john@student.edu password inside this run can break later required seed-account logins and downstream checklist continuity.
  - Manual Step: In Student Settings > Security, change password with current+valid new password, confirm success, and restore original credential for seed-account stability.
  - Reason: Changing john@student.edu password inside this run can break later required seed-account logins and downstream checklist continuity.
  - Manual Step: In Student Settings > Security, change password with current+valid new password, confirm success, and restore original credential for seed-account stability.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Changing john@student.edu password inside this run can break later required seed-account logins and downstream checklist continuity.
  - Manual Step: In Student Settings > Security, change password with current+valid new password, confirm success, and restore original credential for seed-account stability.
  - Reason: Changing john@student.edu password inside this run can break later required seed-account logins and downstream checklist continuity.
  - Manual Step: In Student Settings > Security, change password with current+valid new password, confirm success, and restore original credential for seed-account stability.
  - Reason: Changing john@student.edu password inside this run can break later required seed-account logins and downstream checklist continuity.
  - Manual Step: In Student Settings > Security, change password with current+valid new password, confirm success, and restore original credential for seed-account stability.
  - Reason: Changing john@student.edu password inside this run can break later required seed-account logins and downstream checklist continuity.
  - Manual Step: In Student Settings > Security, change password with current+valid new password, confirm success, and restore original credential for seed-account stability.
  - Reason: Changing john@student.edu password inside this run can break later required seed-account logins and downstream checklist continuity.
  - Manual Step: In Student Settings > Security, change password with current+valid new password, confirm success, and restore original credential for seed-account stability.
  - Reason: Changing john@student.edu password inside this run can break later required seed-account logins and downstream checklist continuity.
  - Manual Step: In Student Settings > Security, change password with current+valid new password, confirm success, and restore original credential for seed-account stability.
  - Reason: Changing john@student.edu password inside this run can break later required seed-account logins and downstream checklist continuity.
  - Manual Step: In Student Settings > Security, change password with current+valid new password, confirm success, and restore original credential for seed-account stability.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Changing john@student.edu password inside this run can break later required seed-account logins and downstream checklist continuity.
  - Manual Step: In Student Settings > Security, change password with current+valid new password, confirm success, and restore original credential for seed-account stability.
  - Reason: Changing john@student.edu password inside this run can break later required seed-account logins and downstream checklist continuity.
  - Manual Step: In Student Settings > Security, change password with current+valid new password, confirm success, and restore original credential for seed-account stability.
  - Reason: Changing john@student.edu password inside this run can break later required seed-account logins and downstream checklist continuity.
  - Manual Step: In Student Settings > Security, change password with current+valid new password, confirm success, and restore original credential for seed-account stability.
  - Reason: Changing john@student.edu password inside this run can break later required seed-account logins and downstream checklist continuity.
  - Manual Step: In Student Settings > Security, change password with current+valid new password, confirm success, and restore original credential for seed-account stability.
  - Reason: Changing john@student.edu password inside this run can break later required seed-account logins and downstream checklist continuity.
  - Manual Step: In Student Settings > Security, change password with current+valid new password, confirm success, and restore original credential for seed-account stability.
  - Reason: Changing john@student.edu password inside this run can break later required seed-account logins and downstream checklist continuity.
  - Manual Step: In Student Settings > Security, change password with current+valid new password, confirm success, and restore original credential for seed-account stability.
  - Reason: Changing john@student.edu password inside this run can break later required seed-account logins and downstream checklist continuity.
  - Manual Step: In Student Settings > Security, change password with current+valid new password, confirm success, and restore original credential for seed-account stability.
  - Reason: Changing john@student.edu password inside this run can break later required seed-account logins and downstream checklist continuity.
  - Manual Step: In Student Settings > Security, change password with current+valid new password, confirm success, and restore original credential for seed-account stability.
  - Reason: Changing john@student.edu password inside this run can break later required seed-account logins and downstream checklist continuity.
  - Manual Step: In Student Settings > Security, change password with current+valid new password, confirm success, and restore original credential for seed-account stability.
  - Reason: Changing john@student.edu password inside this run can break later required seed-account logins and downstream checklist continuity.
  - Manual Step: In Student Settings > Security, change password with current+valid new password, confirm success, and restore original credential for seed-account stability.
  - Reason: Changing john@student.edu password inside this run can break later required seed-account logins and downstream checklist continuity.
  - Manual Step: In Student Settings > Security, change password with current+valid new password, confirm success, and restore original credential for seed-account stability.
  - Reason: Changing john@student.edu password inside this run can break later required seed-account logins and downstream checklist continuity.
  - Manual Step: In Student Settings > Security, change password with current+valid new password, confirm success, and restore original credential for seed-account stability.
  - Reason: Changing john@student.edu password inside this run can break later required seed-account logins and downstream checklist continuity.
  - Manual Step: In Student Settings > Security, change password with current+valid new password, confirm success, and restore original credential for seed-account stability.
  - Reason: Changing john@student.edu password inside this run can break later required seed-account logins and downstream checklist continuity.
  - Manual Step: In Student Settings > Security, change password with current+valid new password, confirm success, and restore original credential for seed-account stability.
  - Reason: Changing john@student.edu password inside this run can break later required seed-account logins and downstream checklist continuity.
  - Manual Step: In Student Settings > Security, change password with current+valid new password, confirm success, and restore original credential for seed-account stability.
  - Reason: Changing john@student.edu password inside this run can break later required seed-account logins and downstream checklist continuity.
  - Manual Step: In Student Settings > Security, change password with current+valid new password, confirm success, and restore original credential for seed-account stability.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Changing john@student.edu password inside this run can break later required seed-account logins and downstream checklist continuity.
  - Manual Step: In Student Settings > Security, change password with current+valid new password, confirm success, and restore original credential for seed-account stability.
  - Reason: Changing john@student.edu password inside this run can break later required seed-account logins and downstream checklist continuity.
  - Manual Step: In Student Settings > Security, change password with current+valid new password, confirm success, and restore original credential for seed-account stability.
- [ ] **Classroom tab** · Displays current classroom and invite code; "Leave Classroom" button present — PASS — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — PASS — PASS
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: page.goto: Target page, context or browser has been closed
  - URL: http://localhost:5173/messages
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-044-2026-06-28T19-08-28-651Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-28T19-08-09-007Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Leave Classroom button missing
  - URL: http://127.0.0.1:5174/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-044-2026-05-18T13-47-27-597Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
- [ ] **Delete account** · Type DELETE in confirmation → account removed → redirected to landing — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Deleting john@student.edu would invalidate remaining checklist steps that require this seeded account.
  - Manual Step: Run this step separately: Student Settings > Security > Delete account, type DELETE, confirm redirect to landing and account removal.
  - Reason: Deleting john@student.edu would invalidate remaining checklist steps that require this seeded account.
  - Manual Step: Run this step separately: Student Settings > Security > Delete account, type DELETE, confirm redirect to landing and account removal.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Deleting john@student.edu would invalidate remaining checklist steps that require this seeded account.
  - Manual Step: Run this step separately: Student Settings > Security > Delete account, type DELETE, confirm redirect to landing and account removal.
  - Reason: Deleting john@student.edu would invalidate remaining checklist steps that require this seeded account.
  - Manual Step: Run this step separately: Student Settings > Security > Delete account, type DELETE, confirm redirect to landing and account removal.
  - Reason: Deleting john@student.edu would invalidate remaining checklist steps that require this seeded account.
  - Manual Step: Run this step separately: Student Settings > Security > Delete account, type DELETE, confirm redirect to landing and account removal.
  - Reason: Deleting john@student.edu would invalidate remaining checklist steps that require this seeded account.
  - Manual Step: Run this step separately: Student Settings > Security > Delete account, type DELETE, confirm redirect to landing and account removal.
  - Reason: Deleting john@student.edu would invalidate remaining checklist steps that require this seeded account.
  - Manual Step: Run this step separately: Student Settings > Security > Delete account, type DELETE, confirm redirect to landing and account removal.
  - Reason: Deleting john@student.edu would invalidate remaining checklist steps that require this seeded account.
  - Manual Step: Run this step separately: Student Settings > Security > Delete account, type DELETE, confirm redirect to landing and account removal.
  - Reason: Deleting john@student.edu would invalidate remaining checklist steps that require this seeded account.
  - Manual Step: Run this step separately: Student Settings > Security > Delete account, type DELETE, confirm redirect to landing and account removal.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Deleting john@student.edu would invalidate remaining checklist steps that require this seeded account.
  - Manual Step: Run this step separately: Student Settings > Security > Delete account, type DELETE, confirm redirect to landing and account removal.
  - Reason: Deleting john@student.edu would invalidate remaining checklist steps that require this seeded account.
  - Manual Step: Run this step separately: Student Settings > Security > Delete account, type DELETE, confirm redirect to landing and account removal.
  - Reason: Deleting john@student.edu would invalidate remaining checklist steps that require this seeded account.
  - Manual Step: Run this step separately: Student Settings > Security > Delete account, type DELETE, confirm redirect to landing and account removal.
  - Reason: Deleting john@student.edu would invalidate remaining checklist steps that require this seeded account.
  - Manual Step: Run this step separately: Student Settings > Security > Delete account, type DELETE, confirm redirect to landing and account removal.
  - Reason: Deleting john@student.edu would invalidate remaining checklist steps that require this seeded account.
  - Manual Step: Run this step separately: Student Settings > Security > Delete account, type DELETE, confirm redirect to landing and account removal.
  - Reason: Deleting john@student.edu would invalidate remaining checklist steps that require this seeded account.
  - Manual Step: Run this step separately: Student Settings > Security > Delete account, type DELETE, confirm redirect to landing and account removal.
  - Reason: Deleting john@student.edu would invalidate remaining checklist steps that require this seeded account.
  - Manual Step: Run this step separately: Student Settings > Security > Delete account, type DELETE, confirm redirect to landing and account removal.
  - Reason: Deleting john@student.edu would invalidate remaining checklist steps that require this seeded account.
  - Manual Step: Run this step separately: Student Settings > Security > Delete account, type DELETE, confirm redirect to landing and account removal.
  - Reason: Deleting john@student.edu would invalidate remaining checklist steps that require this seeded account.
  - Manual Step: Run this step separately: Student Settings > Security > Delete account, type DELETE, confirm redirect to landing and account removal.
  - Reason: Deleting john@student.edu would invalidate remaining checklist steps that require this seeded account.
  - Manual Step: Run this step separately: Student Settings > Security > Delete account, type DELETE, confirm redirect to landing and account removal.
  - Reason: Deleting john@student.edu would invalidate remaining checklist steps that require this seeded account.
  - Manual Step: Run this step separately: Student Settings > Security > Delete account, type DELETE, confirm redirect to landing and account removal.
  - Reason: Deleting john@student.edu would invalidate remaining checklist steps that require this seeded account.
  - Manual Step: Run this step separately: Student Settings > Security > Delete account, type DELETE, confirm redirect to landing and account removal.
  - Reason: Deleting john@student.edu would invalidate remaining checklist steps that require this seeded account.
  - Manual Step: Run this step separately: Student Settings > Security > Delete account, type DELETE, confirm redirect to landing and account removal.
  - Reason: Deleting john@student.edu would invalidate remaining checklist steps that require this seeded account.
  - Manual Step: Run this step separately: Student Settings > Security > Delete account, type DELETE, confirm redirect to landing and account removal.
  - Reason: Deleting john@student.edu would invalidate remaining checklist steps that require this seeded account.
  - Manual Step: Run this step separately: Student Settings > Security > Delete account, type DELETE, confirm redirect to landing and account removal.
  - Reason: Deleting john@student.edu would invalidate remaining checklist steps that require this seeded account.
  - Manual Step: Run this step separately: Student Settings > Security > Delete account, type DELETE, confirm redirect to landing and account removal.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Deleting john@student.edu would invalidate remaining checklist steps that require this seeded account.
  - Manual Step: Run this step separately: Student Settings > Security > Delete account, type DELETE, confirm redirect to landing and account removal.
  - Reason: Deleting john@student.edu would invalidate remaining checklist steps that require this seeded account.
  - Manual Step: Run this step separately: Student Settings > Security > Delete account, type DELETE, confirm redirect to landing and account removal.

---

## 3 · Organization Flow

> **Log in as:** volunteer@greenearth.org

### 3a · Dashboard
- [ ] Stats cards show (Total Opportunities, Signups, Approved Hours, Unique Volunteers) — PASS — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN with no linked organizationId, so the org dashboard stat-card surface is not reachable from this environment state.
  - Manual Step: Use a true ORG_ADMIN seed with a non-null organizationId, then verify Dashboard shows Total Opportunities, Total Signups, Approved Hours, and Unique Volunteers.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN with no linked organizationId, so the org dashboard stat-card surface is not reachable from this environment state.
  - Manual Step: Use a true ORG_ADMIN seed with a non-null organizationId, then verify Dashboard shows Total Opportunities, Total Signups, Approved Hours, and Unique Volunteers.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN with no linked organizationId, so the org dashboard stat-card surface is not reachable from this environment state.
  - Manual Step: Use a true ORG_ADMIN seed with a non-null organizationId, then verify Dashboard shows Total Opportunities, Total Signups, Approved Hours, and Unique Volunteers.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN with no linked organizationId, so the org dashboard stat-card surface is not reachable from this environment state.
  - Manual Step: Use a true ORG_ADMIN seed with a non-null organizationId, then verify Dashboard shows Total Opportunities, Total Signups, Approved Hours, and Unique Volunteers.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN with no linked organizationId, so the org dashboard stat-card surface is not reachable from this environment state.
  - Manual Step: Use a true ORG_ADMIN seed with a non-null organizationId, then verify Dashboard shows Total Opportunities, Total Signups, Approved Hours, and Unique Volunteers.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN with no linked organizationId, so the org dashboard stat-card surface is not reachable from this environment state.
  - Manual Step: Use a true ORG_ADMIN seed with a non-null organizationId, then verify Dashboard shows Total Opportunities, Total Signups, Approved Hours, and Unique Volunteers.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN with no linked organizationId, so the org dashboard stat-card surface is not reachable from this environment state.
  - Manual Step: Use a true ORG_ADMIN seed with a non-null organizationId, then verify Dashboard shows Total Opportunities, Total Signups, Approved Hours, and Unique Volunteers.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN with no linked organizationId, so the org dashboard stat-card surface is not reachable from this environment state.
  - Manual Step: Use a true ORG_ADMIN seed with a non-null organizationId, then verify Dashboard shows Total Opportunities, Total Signups, Approved Hours, and Unique Volunteers.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN with no linked organizationId, so the org dashboard stat-card surface is not reachable from this environment state.
  - Manual Step: Use a true ORG_ADMIN seed with a non-null organizationId, then verify Dashboard shows Total Opportunities, Total Signups, Approved Hours, and Unique Volunteers.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN with no linked organizationId, so the org dashboard stat-card surface is not reachable from this environment state.
  - Manual Step: Use a true ORG_ADMIN seed with a non-null organizationId, then verify Dashboard shows Total Opportunities, Total Signups, Approved Hours, and Unique Volunteers.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN with no linked organizationId, so the org dashboard stat-card surface is not reachable from this environment state.
  - Manual Step: Use a true ORG_ADMIN seed with a non-null organizationId, then verify Dashboard shows Total Opportunities, Total Signups, Approved Hours, and Unique Volunteers.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN with no linked organizationId, so the org dashboard stat-card surface is not reachable from this environment state.
  - Manual Step: Use a true ORG_ADMIN seed with a non-null organizationId, then verify Dashboard shows Total Opportunities, Total Signups, Approved Hours, and Unique Volunteers.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN with no linked organizationId, so the org dashboard stat-card surface is not reachable from this environment state.
  - Manual Step: Use a true ORG_ADMIN seed with a non-null organizationId, then verify Dashboard shows Total Opportunities, Total Signups, Approved Hours, and Unique Volunteers.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN with no linked organizationId, so the org dashboard stat-card surface is not reachable from this environment state.
  - Manual Step: Use a true ORG_ADMIN seed with a non-null organizationId, then verify Dashboard shows Total Opportunities, Total Signups, Approved Hours, and Unique Volunteers.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN with no linked organizationId, so the org dashboard stat-card surface is not reachable from this environment state.
  - Manual Step: Use a true ORG_ADMIN seed with a non-null organizationId, then verify Dashboard shows Total Opportunities, Total Signups, Approved Hours, and Unique Volunteers.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN with no linked organizationId, so the org dashboard stat-card surface is not reachable from this environment state.
  - Manual Step: Use a true ORG_ADMIN seed with a non-null organizationId, then verify Dashboard shows Total Opportunities, Total Signups, Approved Hours, and Unique Volunteers.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN with no linked organizationId, so the org dashboard stat-card surface is not reachable from this environment state.
  - Manual Step: Use a true ORG_ADMIN seed with a non-null organizationId, then verify Dashboard shows Total Opportunities, Total Signups, Approved Hours, and Unique Volunteers.
  - Error: Missing org stat card: Total Opportunities
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-046-2026-06-27T01-47-19-672Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-27T01-47-17-376Z.zip
  - Error: Missing org stat card: Pending Approvals
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-046-2026-06-27T01-34-56-188Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-27T01-34-53-880Z.zip
  - Error: Missing org stat card: Pending Approvals
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-046-2026-06-27T01-27-17-726Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-27T01-27-15-427Z.zip
  - Error: Missing org stat card: Pending Approvals
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-046-2026-06-27T01-20-47-428Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-27T01-20-45-133Z.zip
  - Error: Missing org stat card: Pending Approvals
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-046-2026-06-27T01-02-38-703Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-27T01-02-36-415Z.zip
  - Error: Missing org stat card: Total Opportunities
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-046-2026-06-27T00-53-58-812Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-27T00-53-56-519Z.zip
  - Error: Missing org stat card: Total Opportunities
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-046-2026-06-26T23-20-31-613Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-26T23-20-29-226Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Missing org stat card: Total Opportunities
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-046-2026-05-18T13-47-29-977Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-05-18T13-47-27-661Z.zip
- [ ] "Pending Verifications" section lists sessions awaiting action — PASS — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — PASS — PASS
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Pending Verifications section missing
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-047-2026-06-27T00-53-58-866Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-27T00-53-56-519Z.zip
  - Error: Pending Verifications section missing
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-047-2026-06-26T23-20-31-673Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-26T23-20-29-226Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Pending Verifications section missing
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-047-2026-05-18T13-47-30-021Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-05-18T13-47-27-661Z.zip
- [ ] Recent activity feed shows last notifications — PASS — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: The legacy beneficiary recent-activity dashboard feed is no longer present in the current UI.
  - Manual Step: If activity-feed visibility is still required, add the surface back or move this coverage to the opportunities/signups history screens.
  - Reason: The legacy beneficiary recent-activity dashboard feed is no longer present in the current UI.
  - Manual Step: If activity-feed visibility is still required, add the surface back or move this coverage to the opportunities/signups history screens.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The legacy beneficiary recent-activity dashboard feed is no longer present in the current UI.
  - Manual Step: If activity-feed visibility is still required, add the surface back or move this coverage to the opportunities/signups history screens.
  - Reason: The legacy beneficiary recent-activity dashboard feed is no longer present in the current UI.
  - Manual Step: If activity-feed visibility is still required, add the surface back or move this coverage to the opportunities/signups history screens.
  - Reason: The legacy beneficiary recent-activity dashboard feed is no longer present in the current UI.
  - Manual Step: If activity-feed visibility is still required, add the surface back or move this coverage to the opportunities/signups history screens.
  - Reason: The legacy beneficiary recent-activity dashboard feed is no longer present in the current UI.
  - Manual Step: If activity-feed visibility is still required, add the surface back or move this coverage to the opportunities/signups history screens.
  - Reason: The legacy beneficiary recent-activity dashboard feed is no longer present in the current UI.
  - Manual Step: If activity-feed visibility is still required, add the surface back or move this coverage to the opportunities/signups history screens.
  - Reason: The legacy beneficiary recent-activity dashboard feed is no longer present in the current UI.
  - Manual Step: If activity-feed visibility is still required, add the surface back or move this coverage to the opportunities/signups history screens.
  - Reason: The legacy beneficiary recent-activity dashboard feed is no longer present in the current UI.
  - Manual Step: If activity-feed visibility is still required, add the surface back or move this coverage to the opportunities/signups history screens.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The legacy beneficiary recent-activity dashboard feed is no longer present in the current UI.
  - Manual Step: If activity-feed visibility is still required, add the surface back or move this coverage to the opportunities/signups history screens.
  - Reason: The legacy beneficiary recent-activity dashboard feed is no longer present in the current UI.
  - Manual Step: If activity-feed visibility is still required, add the surface back or move this coverage to the opportunities/signups history screens.
  - Reason: The legacy beneficiary recent-activity dashboard feed is no longer present in the current UI.
  - Manual Step: If activity-feed visibility is still required, add the surface back or move this coverage to the opportunities/signups history screens.
  - Reason: The legacy beneficiary recent-activity dashboard feed is no longer present in the current UI.
  - Manual Step: If activity-feed visibility is still required, add the surface back or move this coverage to the opportunities/signups history screens.
  - Reason: The legacy beneficiary recent-activity dashboard feed is no longer present in the current UI.
  - Manual Step: If activity-feed visibility is still required, add the surface back or move this coverage to the opportunities/signups history screens.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The legacy beneficiary recent-activity dashboard feed is no longer present in the current UI.
  - Manual Step: If activity-feed visibility is still required, add the surface back or move this coverage to the opportunities/signups history screens.
  - Reason: The legacy beneficiary recent-activity dashboard feed is no longer present in the current UI.
  - Manual Step: If activity-feed visibility is still required, add the surface back or move this coverage to the opportunities/signups history screens.
  - Reason: The legacy beneficiary recent-activity dashboard feed is no longer present in the current UI.
  - Manual Step: If activity-feed visibility is still required, add the surface back or move this coverage to the opportunities/signups history screens.
  - Reason: The legacy beneficiary recent-activity dashboard feed is no longer present in the current UI.
  - Manual Step: If activity-feed visibility is still required, add the surface back or move this coverage to the opportunities/signups history screens.
  - Reason: The legacy beneficiary recent-activity dashboard feed is no longer present in the current UI.
  - Manual Step: If activity-feed visibility is still required, add the surface back or move this coverage to the opportunities/signups history screens.
  - Reason: The legacy beneficiary recent-activity dashboard feed is no longer present in the current UI.
  - Manual Step: If activity-feed visibility is still required, add the surface back or move this coverage to the opportunities/signups history screens.
  - Reason: The legacy beneficiary recent-activity dashboard feed is no longer present in the current UI.
  - Manual Step: If activity-feed visibility is still required, add the surface back or move this coverage to the opportunities/signups history screens.
  - Reason: The legacy beneficiary recent-activity dashboard feed is no longer present in the current UI.
  - Manual Step: If activity-feed visibility is still required, add the surface back or move this coverage to the opportunities/signups history screens.
  - Error: Recent activity feed missing
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-048-2026-06-27T00-53-58-909Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-27T00-53-56-519Z.zip
  - Error: Recent activity feed missing
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-048-2026-06-26T23-20-31-718Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-26T23-20-29-226Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Recent activity feed missing
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-048-2026-05-18T13-47-30-071Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-05-18T13-47-27-661Z.zip

### 3b · Create & Manage Opportunities
- [ ] **Create** · Click "Create Opportunity" → fill all fields including address → Save — PASS — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Beneficiary opportunity creation is now handled by the rebuilt `/opportunities` composer; this audit case still targets the removed `/opportunities/new` form contract.
  - Manual Step: Rebuild this case against the current beneficiary opportunity composer, then verify create/edit/cancel from that surface end-to-end.
  - Reason: Beneficiary opportunity creation is now handled by the rebuilt `/opportunities` composer; this audit case still targets the removed `/opportunities/new` form contract.
  - Manual Step: Rebuild this case against the current beneficiary opportunity composer, then verify create/edit/cancel from that surface end-to-end.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Beneficiary opportunity creation is now handled by the rebuilt `/opportunities` composer; this audit case still targets the removed `/opportunities/new` form contract.
  - Manual Step: Rebuild this case against the current beneficiary opportunity composer, then verify create/edit/cancel from that surface end-to-end.
  - Reason: Beneficiary opportunity creation is now handled by the rebuilt `/opportunities` composer; this audit case still targets the removed `/opportunities/new` form contract.
  - Manual Step: Rebuild this case against the current beneficiary opportunity composer, then verify create/edit/cancel from that surface end-to-end.
  - Reason: Beneficiary opportunity creation is now handled by the rebuilt `/opportunities` composer; this audit case still targets the removed `/opportunities/new` form contract.
  - Manual Step: Rebuild this case against the current beneficiary opportunity composer, then verify create/edit/cancel from that surface end-to-end.
  - Reason: Beneficiary opportunity creation is now handled by the rebuilt `/opportunities` composer; this audit case still targets the removed `/opportunities/new` form contract.
  - Manual Step: Rebuild this case against the current beneficiary opportunity composer, then verify create/edit/cancel from that surface end-to-end.
  - Reason: Beneficiary opportunity creation is now handled by the rebuilt `/opportunities` composer; this audit case still targets the removed `/opportunities/new` form contract.
  - Manual Step: Rebuild this case against the current beneficiary opportunity composer, then verify create/edit/cancel from that surface end-to-end.
  - Reason: Beneficiary opportunity creation is now handled by the rebuilt `/opportunities` composer; this audit case still targets the removed `/opportunities/new` form contract.
  - Manual Step: Rebuild this case against the current beneficiary opportunity composer, then verify create/edit/cancel from that surface end-to-end.
  - Reason: Beneficiary opportunity creation is now handled by the rebuilt `/opportunities` composer; this audit case still targets the removed `/opportunities/new` form contract.
  - Manual Step: Rebuild this case against the current beneficiary opportunity composer, then verify create/edit/cancel from that surface end-to-end.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Beneficiary opportunity creation is now handled by the rebuilt `/opportunities` composer; this audit case still targets the removed `/opportunities/new` form contract.
  - Manual Step: Rebuild this case against the current beneficiary opportunity composer, then verify create/edit/cancel from that surface end-to-end.
  - Reason: Beneficiary opportunity creation is now handled by the rebuilt `/opportunities` composer; this audit case still targets the removed `/opportunities/new` form contract.
  - Manual Step: Rebuild this case against the current beneficiary opportunity composer, then verify create/edit/cancel from that surface end-to-end.
  - Reason: Beneficiary opportunity creation is now handled by the rebuilt `/opportunities` composer; this audit case still targets the removed `/opportunities/new` form contract.
  - Manual Step: Rebuild this case against the current beneficiary opportunity composer, then verify create/edit/cancel from that surface end-to-end.
  - Reason: Beneficiary opportunity creation is now handled by the rebuilt `/opportunities` composer; this audit case still targets the removed `/opportunities/new` form contract.
  - Manual Step: Rebuild this case against the current beneficiary opportunity composer, then verify create/edit/cancel from that surface end-to-end.
  - Reason: Beneficiary opportunity creation is now handled by the rebuilt `/opportunities` composer; this audit case still targets the removed `/opportunities/new` form contract.
  - Manual Step: Rebuild this case against the current beneficiary opportunity composer, then verify create/edit/cancel from that surface end-to-end.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Beneficiary opportunity creation is now handled by the rebuilt `/opportunities` composer; this audit case still targets the removed `/opportunities/new` form contract.
  - Manual Step: Rebuild this case against the current beneficiary opportunity composer, then verify create/edit/cancel from that surface end-to-end.
  - Reason: Beneficiary opportunity creation is now handled by the rebuilt `/opportunities` composer; this audit case still targets the removed `/opportunities/new` form contract.
  - Manual Step: Rebuild this case against the current beneficiary opportunity composer, then verify create/edit/cancel from that surface end-to-end.
  - Reason: Beneficiary opportunity creation is now handled by the rebuilt `/opportunities` composer; this audit case still targets the removed `/opportunities/new` form contract.
  - Manual Step: Rebuild this case against the current beneficiary opportunity composer, then verify create/edit/cancel from that surface end-to-end.
  - Reason: Beneficiary opportunity creation is now handled by the rebuilt `/opportunities` composer; this audit case still targets the removed `/opportunities/new` form contract.
  - Manual Step: Rebuild this case against the current beneficiary opportunity composer, then verify create/edit/cancel from that surface end-to-end.
  - Reason: Beneficiary opportunity creation is now handled by the rebuilt `/opportunities` composer; this audit case still targets the removed `/opportunities/new` form contract.
  - Manual Step: Rebuild this case against the current beneficiary opportunity composer, then verify create/edit/cancel from that surface end-to-end.
  - Reason: Beneficiary opportunity creation is now handled by the rebuilt `/opportunities` composer; this audit case still targets the removed `/opportunities/new` form contract.
  - Manual Step: Rebuild this case against the current beneficiary opportunity composer, then verify create/edit/cancel from that surface end-to-end.
  - Reason: Beneficiary opportunity creation is now handled by the rebuilt `/opportunities` composer; this audit case still targets the removed `/opportunities/new` form contract.
  - Manual Step: Rebuild this case against the current beneficiary opportunity composer, then verify create/edit/cancel from that surface end-to-end.
  - Reason: Beneficiary opportunity creation is now handled by the rebuilt `/opportunities` composer; this audit case still targets the removed `/opportunities/new` form contract.
  - Manual Step: Rebuild this case against the current beneficiary opportunity composer, then verify create/edit/cancel from that surface end-to-end.
  - Error: locator.fill: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for locator('input[name="title"]')[22m

  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-049-2026-06-27T00-54-14-606Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-27T00-53-56-519Z.zip
  - Error: locator.fill: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for locator('input[name="title"]')[22m

  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-049-2026-06-26T23-20-47-394Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-26T23-20-29-226Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: locator.fill: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for locator('input[name="title"]')[22m

  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-049-2026-05-18T13-47-45-727Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-05-18T13-47-27-661Z.zip
  _Expect: opp appears in Opportunities list with ACTIVE status_
- [ ] **Auto-geocode** · Created opp with address → lat/lng populated (visible to students as distance sort) — PASS — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Auto-geocode validation depends on the updated beneficiary opportunity-creation case completing successfully first.
  - Manual Step: After the current opportunity composer is automated, verify the saved opportunity retains valid location/address data and any downstream distance features still work.
  - Reason: Auto-geocode validation depends on the updated beneficiary opportunity-creation case completing successfully first.
  - Manual Step: After the current opportunity composer is automated, verify the saved opportunity retains valid location/address data and any downstream distance features still work.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Auto-geocode validation depends on the updated beneficiary opportunity-creation case completing successfully first.
  - Manual Step: After the current opportunity composer is automated, verify the saved opportunity retains valid location/address data and any downstream distance features still work.
  - Reason: Auto-geocode validation depends on the updated beneficiary opportunity-creation case completing successfully first.
  - Manual Step: After the current opportunity composer is automated, verify the saved opportunity retains valid location/address data and any downstream distance features still work.
  - Reason: Auto-geocode validation depends on the updated beneficiary opportunity-creation case completing successfully first.
  - Manual Step: After the current opportunity composer is automated, verify the saved opportunity retains valid location/address data and any downstream distance features still work.
  - Reason: Auto-geocode validation depends on the updated beneficiary opportunity-creation case completing successfully first.
  - Manual Step: After the current opportunity composer is automated, verify the saved opportunity retains valid location/address data and any downstream distance features still work.
  - Reason: Auto-geocode validation depends on the updated beneficiary opportunity-creation case completing successfully first.
  - Manual Step: After the current opportunity composer is automated, verify the saved opportunity retains valid location/address data and any downstream distance features still work.
  - Reason: Auto-geocode validation depends on the updated beneficiary opportunity-creation case completing successfully first.
  - Manual Step: After the current opportunity composer is automated, verify the saved opportunity retains valid location/address data and any downstream distance features still work.
  - Reason: Auto-geocode validation depends on the updated beneficiary opportunity-creation case completing successfully first.
  - Manual Step: After the current opportunity composer is automated, verify the saved opportunity retains valid location/address data and any downstream distance features still work.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Auto-geocode validation depends on the updated beneficiary opportunity-creation case completing successfully first.
  - Manual Step: After the current opportunity composer is automated, verify the saved opportunity retains valid location/address data and any downstream distance features still work.
  - Reason: Auto-geocode validation depends on the updated beneficiary opportunity-creation case completing successfully first.
  - Manual Step: After the current opportunity composer is automated, verify the saved opportunity retains valid location/address data and any downstream distance features still work.
  - Reason: Auto-geocode validation depends on the updated beneficiary opportunity-creation case completing successfully first.
  - Manual Step: After the current opportunity composer is automated, verify the saved opportunity retains valid location/address data and any downstream distance features still work.
  - Reason: Auto-geocode validation depends on the updated beneficiary opportunity-creation case completing successfully first.
  - Manual Step: After the current opportunity composer is automated, verify the saved opportunity retains valid location/address data and any downstream distance features still work.
  - Reason: Auto-geocode validation depends on the updated beneficiary opportunity-creation case completing successfully first.
  - Manual Step: After the current opportunity composer is automated, verify the saved opportunity retains valid location/address data and any downstream distance features still work.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Auto-geocode validation depends on the updated beneficiary opportunity-creation case completing successfully first.
  - Manual Step: After the current opportunity composer is automated, verify the saved opportunity retains valid location/address data and any downstream distance features still work.
  - Reason: Auto-geocode validation depends on the updated beneficiary opportunity-creation case completing successfully first.
  - Manual Step: After the current opportunity composer is automated, verify the saved opportunity retains valid location/address data and any downstream distance features still work.
  - Reason: Auto-geocode validation depends on the updated beneficiary opportunity-creation case completing successfully first.
  - Manual Step: After the current opportunity composer is automated, verify the saved opportunity retains valid location/address data and any downstream distance features still work.
  - Reason: Auto-geocode validation depends on the updated beneficiary opportunity-creation case completing successfully first.
  - Manual Step: After the current opportunity composer is automated, verify the saved opportunity retains valid location/address data and any downstream distance features still work.
  - Reason: Auto-geocode validation depends on the updated beneficiary opportunity-creation case completing successfully first.
  - Manual Step: After the current opportunity composer is automated, verify the saved opportunity retains valid location/address data and any downstream distance features still work.
  - Reason: Auto-geocode validation depends on the updated beneficiary opportunity-creation case completing successfully first.
  - Manual Step: After the current opportunity composer is automated, verify the saved opportunity retains valid location/address data and any downstream distance features still work.
  - Reason: Auto-geocode validation depends on the updated beneficiary opportunity-creation case completing successfully first.
  - Manual Step: After the current opportunity composer is automated, verify the saved opportunity retains valid location/address data and any downstream distance features still work.
  - Reason: Auto-geocode validation depends on the updated beneficiary opportunity-creation case completing successfully first.
  - Manual Step: After the current opportunity composer is automated, verify the saved opportunity retains valid location/address data and any downstream distance features still work.
  - Error: No create-opportunity API response available for geocode validation
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-050-2026-06-27T00-54-14-679Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-27T00-53-56-519Z.zip
  - Error: No create-opportunity API response available for geocode validation
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-050-2026-06-26T23-20-47-471Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-26T23-20-29-226Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: No create-opportunity API response available for geocode validation
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-050-2026-05-18T13-47-45-788Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-05-18T13-47-27-661Z.zip
- [ ] **Edit** · Edit title/description/capacity → Save → changes reflected immediately — PASS — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Beneficiary opportunity edit coverage depends on rebuilding the create/edit/cancel flow against the current opportunity composer.
  - Manual Step: After the new create case is automated, verify editing title/description/capacity updates the list immediately.
  - Reason: Beneficiary opportunity edit coverage depends on rebuilding the create/edit/cancel flow against the current opportunity composer.
  - Manual Step: After the new create case is automated, verify editing title/description/capacity updates the list immediately.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Beneficiary opportunity edit coverage depends on rebuilding the create/edit/cancel flow against the current opportunity composer.
  - Manual Step: After the new create case is automated, verify editing title/description/capacity updates the list immediately.
  - Reason: Beneficiary opportunity edit coverage depends on rebuilding the create/edit/cancel flow against the current opportunity composer.
  - Manual Step: After the new create case is automated, verify editing title/description/capacity updates the list immediately.
  - Reason: Beneficiary opportunity edit coverage depends on rebuilding the create/edit/cancel flow against the current opportunity composer.
  - Manual Step: After the new create case is automated, verify editing title/description/capacity updates the list immediately.
  - Reason: Beneficiary opportunity edit coverage depends on rebuilding the create/edit/cancel flow against the current opportunity composer.
  - Manual Step: After the new create case is automated, verify editing title/description/capacity updates the list immediately.
  - Reason: Beneficiary opportunity edit coverage depends on rebuilding the create/edit/cancel flow against the current opportunity composer.
  - Manual Step: After the new create case is automated, verify editing title/description/capacity updates the list immediately.
  - Reason: Beneficiary opportunity edit coverage depends on rebuilding the create/edit/cancel flow against the current opportunity composer.
  - Manual Step: After the new create case is automated, verify editing title/description/capacity updates the list immediately.
  - Reason: Beneficiary opportunity edit coverage depends on rebuilding the create/edit/cancel flow against the current opportunity composer.
  - Manual Step: After the new create case is automated, verify editing title/description/capacity updates the list immediately.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Beneficiary opportunity edit coverage depends on rebuilding the create/edit/cancel flow against the current opportunity composer.
  - Manual Step: After the new create case is automated, verify editing title/description/capacity updates the list immediately.
  - Reason: Beneficiary opportunity edit coverage depends on rebuilding the create/edit/cancel flow against the current opportunity composer.
  - Manual Step: After the new create case is automated, verify editing title/description/capacity updates the list immediately.
  - Reason: Beneficiary opportunity edit coverage depends on rebuilding the create/edit/cancel flow against the current opportunity composer.
  - Manual Step: After the new create case is automated, verify editing title/description/capacity updates the list immediately.
  - Reason: Beneficiary opportunity edit coverage depends on rebuilding the create/edit/cancel flow against the current opportunity composer.
  - Manual Step: After the new create case is automated, verify editing title/description/capacity updates the list immediately.
  - Reason: Beneficiary opportunity edit coverage depends on rebuilding the create/edit/cancel flow against the current opportunity composer.
  - Manual Step: After the new create case is automated, verify editing title/description/capacity updates the list immediately.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Beneficiary opportunity edit coverage depends on rebuilding the create/edit/cancel flow against the current opportunity composer.
  - Manual Step: After the new create case is automated, verify editing title/description/capacity updates the list immediately.
  - Reason: Beneficiary opportunity edit coverage depends on rebuilding the create/edit/cancel flow against the current opportunity composer.
  - Manual Step: After the new create case is automated, verify editing title/description/capacity updates the list immediately.
  - Reason: Beneficiary opportunity edit coverage depends on rebuilding the create/edit/cancel flow against the current opportunity composer.
  - Manual Step: After the new create case is automated, verify editing title/description/capacity updates the list immediately.
  - Reason: Beneficiary opportunity edit coverage depends on rebuilding the create/edit/cancel flow against the current opportunity composer.
  - Manual Step: After the new create case is automated, verify editing title/description/capacity updates the list immediately.
  - Reason: Beneficiary opportunity edit coverage depends on rebuilding the create/edit/cancel flow against the current opportunity composer.
  - Manual Step: After the new create case is automated, verify editing title/description/capacity updates the list immediately.
  - Reason: Beneficiary opportunity edit coverage depends on rebuilding the create/edit/cancel flow against the current opportunity composer.
  - Manual Step: After the new create case is automated, verify editing title/description/capacity updates the list immediately.
  - Reason: Beneficiary opportunity edit coverage depends on rebuilding the create/edit/cancel flow against the current opportunity composer.
  - Manual Step: After the new create case is automated, verify editing title/description/capacity updates the list immediately.
  - Reason: Beneficiary opportunity edit coverage depends on rebuilding the create/edit/cancel flow against the current opportunity composer.
  - Manual Step: After the new create case is automated, verify editing title/description/capacity updates the list immediately.
  - Error: Created opportunity card not found for edit
  - URL: http://localhost:5173/opportunities
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-051-2026-06-27T00-54-15-348Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-27T00-53-56-519Z.zip
  - Error: Created opportunity card not found for edit
  - URL: http://localhost:5173/opportunities
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-051-2026-06-26T23-20-48-140Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-26T23-20-29-226Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Created opportunity card not found for edit
  - URL: http://127.0.0.1:5174/opportunities
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-051-2026-05-18T13-47-46-456Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-05-18T13-47-27-661Z.zip
- [ ] **Cancel** · Cancel the opp → status → CANCELLED; signed-up students receive notification — PASS — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Beneficiary opportunity cancel coverage depends on rebuilding the current opportunity composer/list flow.
  - Manual Step: After the new create/edit automation exists, verify cancellation moves the opportunity into the cancelled state and notifies affected students.
  - Reason: Beneficiary opportunity cancel coverage depends on rebuilding the current opportunity composer/list flow.
  - Manual Step: After the new create/edit automation exists, verify cancellation moves the opportunity into the cancelled state and notifies affected students.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Beneficiary opportunity cancel coverage depends on rebuilding the current opportunity composer/list flow.
  - Manual Step: After the new create/edit automation exists, verify cancellation moves the opportunity into the cancelled state and notifies affected students.
  - Reason: Beneficiary opportunity cancel coverage depends on rebuilding the current opportunity composer/list flow.
  - Manual Step: After the new create/edit automation exists, verify cancellation moves the opportunity into the cancelled state and notifies affected students.
  - Reason: Beneficiary opportunity cancel coverage depends on rebuilding the current opportunity composer/list flow.
  - Manual Step: After the new create/edit automation exists, verify cancellation moves the opportunity into the cancelled state and notifies affected students.
  - Reason: Beneficiary opportunity cancel coverage depends on rebuilding the current opportunity composer/list flow.
  - Manual Step: After the new create/edit automation exists, verify cancellation moves the opportunity into the cancelled state and notifies affected students.
  - Reason: Beneficiary opportunity cancel coverage depends on rebuilding the current opportunity composer/list flow.
  - Manual Step: After the new create/edit automation exists, verify cancellation moves the opportunity into the cancelled state and notifies affected students.
  - Reason: Beneficiary opportunity cancel coverage depends on rebuilding the current opportunity composer/list flow.
  - Manual Step: After the new create/edit automation exists, verify cancellation moves the opportunity into the cancelled state and notifies affected students.
  - Reason: Beneficiary opportunity cancel coverage depends on rebuilding the current opportunity composer/list flow.
  - Manual Step: After the new create/edit automation exists, verify cancellation moves the opportunity into the cancelled state and notifies affected students.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Beneficiary opportunity cancel coverage depends on rebuilding the current opportunity composer/list flow.
  - Manual Step: After the new create/edit automation exists, verify cancellation moves the opportunity into the cancelled state and notifies affected students.
  - Reason: Beneficiary opportunity cancel coverage depends on rebuilding the current opportunity composer/list flow.
  - Manual Step: After the new create/edit automation exists, verify cancellation moves the opportunity into the cancelled state and notifies affected students.
  - Reason: Beneficiary opportunity cancel coverage depends on rebuilding the current opportunity composer/list flow.
  - Manual Step: After the new create/edit automation exists, verify cancellation moves the opportunity into the cancelled state and notifies affected students.
  - Reason: Beneficiary opportunity cancel coverage depends on rebuilding the current opportunity composer/list flow.
  - Manual Step: After the new create/edit automation exists, verify cancellation moves the opportunity into the cancelled state and notifies affected students.
  - Reason: Beneficiary opportunity cancel coverage depends on rebuilding the current opportunity composer/list flow.
  - Manual Step: After the new create/edit automation exists, verify cancellation moves the opportunity into the cancelled state and notifies affected students.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Beneficiary opportunity cancel coverage depends on rebuilding the current opportunity composer/list flow.
  - Manual Step: After the new create/edit automation exists, verify cancellation moves the opportunity into the cancelled state and notifies affected students.
  - Reason: Beneficiary opportunity cancel coverage depends on rebuilding the current opportunity composer/list flow.
  - Manual Step: After the new create/edit automation exists, verify cancellation moves the opportunity into the cancelled state and notifies affected students.
  - Reason: Beneficiary opportunity cancel coverage depends on rebuilding the current opportunity composer/list flow.
  - Manual Step: After the new create/edit automation exists, verify cancellation moves the opportunity into the cancelled state and notifies affected students.
  - Reason: Beneficiary opportunity cancel coverage depends on rebuilding the current opportunity composer/list flow.
  - Manual Step: After the new create/edit automation exists, verify cancellation moves the opportunity into the cancelled state and notifies affected students.
  - Reason: Beneficiary opportunity cancel coverage depends on rebuilding the current opportunity composer/list flow.
  - Manual Step: After the new create/edit automation exists, verify cancellation moves the opportunity into the cancelled state and notifies affected students.
  - Reason: Beneficiary opportunity cancel coverage depends on rebuilding the current opportunity composer/list flow.
  - Manual Step: After the new create/edit automation exists, verify cancellation moves the opportunity into the cancelled state and notifies affected students.
  - Reason: Beneficiary opportunity cancel coverage depends on rebuilding the current opportunity composer/list flow.
  - Manual Step: After the new create/edit automation exists, verify cancellation moves the opportunity into the cancelled state and notifies affected students.
  - Reason: Beneficiary opportunity cancel coverage depends on rebuilding the current opportunity composer/list flow.
  - Manual Step: After the new create/edit automation exists, verify cancellation moves the opportunity into the cancelled state and notifies affected students.
  - Error: Cancel button missing on updated opportunity
  - URL: http://localhost:5173/opportunities
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-052-2026-06-27T00-54-15-415Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-27T00-53-56-519Z.zip
  - Error: Cancel button missing on updated opportunity
  - URL: http://localhost:5173/opportunities
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-052-2026-06-26T23-20-48-201Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-26T23-20-29-226Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Cancel button missing on updated opportunity
  - URL: http://127.0.0.1:5174/opportunities
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-052-2026-05-18T13-47-46-520Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-05-18T13-47-27-661Z.zip
- [ ] **Recurring pattern field** · Enable "Recurring" toggle → recurring pattern field appears; saved correctly — PASS — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Recurring-opportunity coverage also depends on the rebuilt beneficiary opportunity composer automation.
  - Manual Step: Use the current composer on `/opportunities`, enable recurring mode, and verify recurring schedule controls appear and save correctly.
  - Reason: Recurring-opportunity coverage also depends on the rebuilt beneficiary opportunity composer automation.
  - Manual Step: Use the current composer on `/opportunities`, enable recurring mode, and verify recurring schedule controls appear and save correctly.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Recurring-opportunity coverage also depends on the rebuilt beneficiary opportunity composer automation.
  - Manual Step: Use the current composer on `/opportunities`, enable recurring mode, and verify recurring schedule controls appear and save correctly.
  - Reason: Recurring-opportunity coverage also depends on the rebuilt beneficiary opportunity composer automation.
  - Manual Step: Use the current composer on `/opportunities`, enable recurring mode, and verify recurring schedule controls appear and save correctly.
  - Reason: Recurring-opportunity coverage also depends on the rebuilt beneficiary opportunity composer automation.
  - Manual Step: Use the current composer on `/opportunities`, enable recurring mode, and verify recurring schedule controls appear and save correctly.
  - Reason: Recurring-opportunity coverage also depends on the rebuilt beneficiary opportunity composer automation.
  - Manual Step: Use the current composer on `/opportunities`, enable recurring mode, and verify recurring schedule controls appear and save correctly.
  - Reason: Recurring-opportunity coverage also depends on the rebuilt beneficiary opportunity composer automation.
  - Manual Step: Use the current composer on `/opportunities`, enable recurring mode, and verify recurring schedule controls appear and save correctly.
  - Reason: Recurring-opportunity coverage also depends on the rebuilt beneficiary opportunity composer automation.
  - Manual Step: Use the current composer on `/opportunities`, enable recurring mode, and verify recurring schedule controls appear and save correctly.
  - Reason: Recurring-opportunity coverage also depends on the rebuilt beneficiary opportunity composer automation.
  - Manual Step: Use the current composer on `/opportunities`, enable recurring mode, and verify recurring schedule controls appear and save correctly.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Recurring-opportunity coverage also depends on the rebuilt beneficiary opportunity composer automation.
  - Manual Step: Use the current composer on `/opportunities`, enable recurring mode, and verify recurring schedule controls appear and save correctly.
  - Reason: Recurring-opportunity coverage also depends on the rebuilt beneficiary opportunity composer automation.
  - Manual Step: Use the current composer on `/opportunities`, enable recurring mode, and verify recurring schedule controls appear and save correctly.
  - Reason: Recurring-opportunity coverage also depends on the rebuilt beneficiary opportunity composer automation.
  - Manual Step: Use the current composer on `/opportunities`, enable recurring mode, and verify recurring schedule controls appear and save correctly.
  - Reason: Recurring-opportunity coverage also depends on the rebuilt beneficiary opportunity composer automation.
  - Manual Step: Use the current composer on `/opportunities`, enable recurring mode, and verify recurring schedule controls appear and save correctly.
  - Reason: Recurring-opportunity coverage also depends on the rebuilt beneficiary opportunity composer automation.
  - Manual Step: Use the current composer on `/opportunities`, enable recurring mode, and verify recurring schedule controls appear and save correctly.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Recurring-opportunity coverage also depends on the rebuilt beneficiary opportunity composer automation.
  - Manual Step: Use the current composer on `/opportunities`, enable recurring mode, and verify recurring schedule controls appear and save correctly.
  - Reason: Recurring-opportunity coverage also depends on the rebuilt beneficiary opportunity composer automation.
  - Manual Step: Use the current composer on `/opportunities`, enable recurring mode, and verify recurring schedule controls appear and save correctly.
  - Reason: Recurring-opportunity coverage also depends on the rebuilt beneficiary opportunity composer automation.
  - Manual Step: Use the current composer on `/opportunities`, enable recurring mode, and verify recurring schedule controls appear and save correctly.
  - Reason: Recurring-opportunity coverage also depends on the rebuilt beneficiary opportunity composer automation.
  - Manual Step: Use the current composer on `/opportunities`, enable recurring mode, and verify recurring schedule controls appear and save correctly.
  - Reason: Recurring-opportunity coverage also depends on the rebuilt beneficiary opportunity composer automation.
  - Manual Step: Use the current composer on `/opportunities`, enable recurring mode, and verify recurring schedule controls appear and save correctly.
  - Reason: Recurring-opportunity coverage also depends on the rebuilt beneficiary opportunity composer automation.
  - Manual Step: Use the current composer on `/opportunities`, enable recurring mode, and verify recurring schedule controls appear and save correctly.
  - Reason: Recurring-opportunity coverage also depends on the rebuilt beneficiary opportunity composer automation.
  - Manual Step: Use the current composer on `/opportunities`, enable recurring mode, and verify recurring schedule controls appear and save correctly.
  - Reason: Recurring-opportunity coverage also depends on the rebuilt beneficiary opportunity composer automation.
  - Manual Step: Use the current composer on `/opportunities`, enable recurring mode, and verify recurring schedule controls appear and save correctly.
  - Error: Recurring toggle checkbox not found
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-053-2026-06-27T00-54-16-067Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-27T00-53-56-519Z.zip
  - Error: Recurring toggle checkbox not found
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-053-2026-06-26T23-20-48-856Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-26T23-20-29-226Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Recurring toggle checkbox not found
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-053-2026-05-18T13-47-47-177Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-05-18T13-47-27-661Z.zip

### 3c · Verify Hours
- [ ] **Approve** · From Dashboard pending list or verification queue, click Approve on a PENDING_VERIFICATION session — PASS — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: The current seed state does not guarantee a pending beneficiary verification at run time.
  - Manual Step: Seed a completed student session awaiting beneficiary review, then verify Approve removes it from the pending queue.
  - Reason: The current seed state does not guarantee a pending beneficiary verification at run time.
  - Manual Step: Seed a completed student session awaiting beneficiary review, then verify Approve removes it from the pending queue.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The current seed state does not guarantee a pending beneficiary verification at run time.
  - Manual Step: Seed a completed student session awaiting beneficiary review, then verify Approve removes it from the pending queue.
  - Reason: The current seed state does not guarantee a pending beneficiary verification at run time.
  - Manual Step: Seed a completed student session awaiting beneficiary review, then verify Approve removes it from the pending queue.
  - Reason: The current seed state does not guarantee a pending beneficiary verification at run time.
  - Manual Step: Seed a completed student session awaiting beneficiary review, then verify Approve removes it from the pending queue.
  - Reason: The current seed state does not guarantee a pending beneficiary verification at run time.
  - Manual Step: Seed a completed student session awaiting beneficiary review, then verify Approve removes it from the pending queue.
  - Reason: The current seed state does not guarantee a pending beneficiary verification at run time.
  - Manual Step: Seed a completed student session awaiting beneficiary review, then verify Approve removes it from the pending queue.
  - Reason: The current seed state does not guarantee a pending beneficiary verification at run time.
  - Manual Step: Seed a completed student session awaiting beneficiary review, then verify Approve removes it from the pending queue.
  - Reason: The current seed state does not guarantee a pending beneficiary verification at run time.
  - Manual Step: Seed a completed student session awaiting beneficiary review, then verify Approve removes it from the pending queue.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The current seed state does not guarantee a pending beneficiary verification at run time.
  - Manual Step: Seed a completed student session awaiting beneficiary review, then verify Approve removes it from the pending queue.
  - Reason: The current seed state does not guarantee a pending beneficiary verification at run time.
  - Manual Step: Seed a completed student session awaiting beneficiary review, then verify Approve removes it from the pending queue.
  - Reason: The current seed state does not guarantee a pending beneficiary verification at run time.
  - Manual Step: Seed a completed student session awaiting beneficiary review, then verify Approve removes it from the pending queue.
  - Reason: The current seed state does not guarantee a pending beneficiary verification at run time.
  - Manual Step: Seed a completed student session awaiting beneficiary review, then verify Approve removes it from the pending queue.
  - Reason: The current seed state does not guarantee a pending beneficiary verification at run time.
  - Manual Step: Seed a completed student session awaiting beneficiary review, then verify Approve removes it from the pending queue.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The current seed state does not guarantee a pending beneficiary verification at run time.
  - Manual Step: Seed a completed student session awaiting beneficiary review, then verify Approve removes it from the pending queue.
  - Reason: The current seed state does not guarantee a pending beneficiary verification at run time.
  - Manual Step: Seed a completed student session awaiting beneficiary review, then verify Approve removes it from the pending queue.
  - Reason: The current seed state does not guarantee a pending beneficiary verification at run time.
  - Manual Step: Seed a completed student session awaiting beneficiary review, then verify Approve removes it from the pending queue.
  - Reason: The current seed state does not guarantee a pending beneficiary verification at run time.
  - Manual Step: Seed a completed student session awaiting beneficiary review, then verify Approve removes it from the pending queue.
  - Reason: The current seed state does not guarantee a pending beneficiary verification at run time.
  - Manual Step: Seed a completed student session awaiting beneficiary review, then verify Approve removes it from the pending queue.
  - Reason: The current seed state does not guarantee a pending beneficiary verification at run time.
  - Manual Step: Seed a completed student session awaiting beneficiary review, then verify Approve removes it from the pending queue.
  - Reason: The current seed state does not guarantee a pending beneficiary verification at run time.
  - Manual Step: Seed a completed student session awaiting beneficiary review, then verify Approve removes it from the pending queue.
  - Reason: The current seed state does not guarantee a pending beneficiary verification at run time.
  - Manual Step: Seed a completed student session awaiting beneficiary review, then verify Approve removes it from the pending queue.
  - Error: No pending verification available to approve
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-054-2026-06-27T00-54-16-706Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-27T00-53-56-519Z.zip
  - Error: No pending verification available to approve
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-054-2026-06-26T23-20-49-497Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-26T23-20-29-226Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: No pending verification available to approve
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-054-2026-05-18T13-47-47-821Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-05-18T13-47-27-661Z.zip
  _Expect: status → VERIFIED; student receives email notification_
- [ ] **Approve with override** · Approve with a custom hours value (different from totalHours) — PASS — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Override approval depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, approve it with a non-default hours override, and verify the approved total matches the override.
  - Reason: Override approval depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, approve it with a non-default hours override, and verify the approved total matches the override.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Override approval depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, approve it with a non-default hours override, and verify the approved total matches the override.
  - Reason: Override approval depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, approve it with a non-default hours override, and verify the approved total matches the override.
  - Reason: Override approval depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, approve it with a non-default hours override, and verify the approved total matches the override.
  - Reason: Override approval depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, approve it with a non-default hours override, and verify the approved total matches the override.
  - Reason: Override approval depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, approve it with a non-default hours override, and verify the approved total matches the override.
  - Reason: Override approval depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, approve it with a non-default hours override, and verify the approved total matches the override.
  - Reason: Override approval depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, approve it with a non-default hours override, and verify the approved total matches the override.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Override approval depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, approve it with a non-default hours override, and verify the approved total matches the override.
  - Reason: Override approval depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, approve it with a non-default hours override, and verify the approved total matches the override.
  - Reason: Override approval depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, approve it with a non-default hours override, and verify the approved total matches the override.
  - Reason: Override approval depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, approve it with a non-default hours override, and verify the approved total matches the override.
  - Reason: Override approval depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, approve it with a non-default hours override, and verify the approved total matches the override.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Override approval depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, approve it with a non-default hours override, and verify the approved total matches the override.
  - Reason: Override approval depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, approve it with a non-default hours override, and verify the approved total matches the override.
  - Reason: Override approval depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, approve it with a non-default hours override, and verify the approved total matches the override.
  - Reason: Override approval depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, approve it with a non-default hours override, and verify the approved total matches the override.
  - Reason: Override approval depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, approve it with a non-default hours override, and verify the approved total matches the override.
  - Reason: Override approval depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, approve it with a non-default hours override, and verify the approved total matches the override.
  - Reason: Override approval depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, approve it with a non-default hours override, and verify the approved total matches the override.
  - Reason: Override approval depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, approve it with a non-default hours override, and verify the approved total matches the override.
  - Error: No pending verification available for override approval
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-055-2026-06-27T00-54-16-763Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-27T00-53-56-519Z.zip
  - Error: No pending verification available for override approval
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-055-2026-06-26T23-20-49-555Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-26T23-20-29-226Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: No pending verification available for override approval
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-055-2026-05-18T13-47-47-875Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-05-18T13-47-27-661Z.zip
  _Expect: `verifiedHours` reflects overridden value_
- [ ] **Reject** · Click Reject → enter reason (required) → submit — PASS — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Reject-path coverage depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, verify rejection requires a reason, then submit and confirm the request leaves the pending queue.
  - Reason: Reject-path coverage depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, verify rejection requires a reason, then submit and confirm the request leaves the pending queue.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Reject-path coverage depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, verify rejection requires a reason, then submit and confirm the request leaves the pending queue.
  - Reason: Reject-path coverage depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, verify rejection requires a reason, then submit and confirm the request leaves the pending queue.
  - Reason: Reject-path coverage depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, verify rejection requires a reason, then submit and confirm the request leaves the pending queue.
  - Reason: Reject-path coverage depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, verify rejection requires a reason, then submit and confirm the request leaves the pending queue.
  - Reason: Reject-path coverage depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, verify rejection requires a reason, then submit and confirm the request leaves the pending queue.
  - Reason: Reject-path coverage depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, verify rejection requires a reason, then submit and confirm the request leaves the pending queue.
  - Reason: Reject-path coverage depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, verify rejection requires a reason, then submit and confirm the request leaves the pending queue.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Reject-path coverage depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, verify rejection requires a reason, then submit and confirm the request leaves the pending queue.
  - Reason: Reject-path coverage depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, verify rejection requires a reason, then submit and confirm the request leaves the pending queue.
  - Reason: Reject-path coverage depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, verify rejection requires a reason, then submit and confirm the request leaves the pending queue.
  - Reason: Reject-path coverage depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, verify rejection requires a reason, then submit and confirm the request leaves the pending queue.
  - Reason: Reject-path coverage depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, verify rejection requires a reason, then submit and confirm the request leaves the pending queue.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Reject-path coverage depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, verify rejection requires a reason, then submit and confirm the request leaves the pending queue.
  - Reason: Reject-path coverage depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, verify rejection requires a reason, then submit and confirm the request leaves the pending queue.
  - Reason: Reject-path coverage depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, verify rejection requires a reason, then submit and confirm the request leaves the pending queue.
  - Reason: Reject-path coverage depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, verify rejection requires a reason, then submit and confirm the request leaves the pending queue.
  - Reason: Reject-path coverage depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, verify rejection requires a reason, then submit and confirm the request leaves the pending queue.
  - Reason: Reject-path coverage depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, verify rejection requires a reason, then submit and confirm the request leaves the pending queue.
  - Reason: Reject-path coverage depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, verify rejection requires a reason, then submit and confirm the request leaves the pending queue.
  - Reason: Reject-path coverage depends on a pending verification record being present in the seed state.
  - Manual Step: Seed a pending verification, verify rejection requires a reason, then submit and confirm the request leaves the pending queue.
  - Error: No pending verification available to reject
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-056-2026-06-27T00-54-16-810Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-27T00-53-56-519Z.zip
  - Error: No pending verification available to reject
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-056-2026-06-26T23-20-49-602Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-26T23-20-29-226Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: No pending verification available to reject
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-056-2026-05-18T13-47-47-921Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-05-18T13-47-27-661Z.zip
  _Expect: status → REJECTED; reason stored; student notified_
- [ ] **Self-verification blocked** · Org admin who is also verifier cannot verify their own session — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Seed data does not include a user who is both org verifier and session owner; self-verification cannot be produced from available UI states.
  - Manual Step: Create an org-admin account that can log volunteer sessions for itself, then attempt to verify that own session and confirm "Cannot verify your own session".
  - Reason: Seed data does not include a user who is both org verifier and session owner; self-verification cannot be produced from available UI states.
  - Manual Step: Create an org-admin account that can log volunteer sessions for itself, then attempt to verify that own session and confirm "Cannot verify your own session".
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Seed data does not include a user who is both org verifier and session owner; self-verification cannot be produced from available UI states.
  - Manual Step: Create an org-admin account that can log volunteer sessions for itself, then attempt to verify that own session and confirm "Cannot verify your own session".
  - Reason: Seed data does not include a user who is both org verifier and session owner; self-verification cannot be produced from available UI states.
  - Manual Step: Create an org-admin account that can log volunteer sessions for itself, then attempt to verify that own session and confirm "Cannot verify your own session".
  - Reason: Seed data does not include a user who is both org verifier and session owner; self-verification cannot be produced from available UI states.
  - Manual Step: Create an org-admin account that can log volunteer sessions for itself, then attempt to verify that own session and confirm "Cannot verify your own session".
  - Reason: Seed data does not include a user who is both org verifier and session owner; self-verification cannot be produced from available UI states.
  - Manual Step: Create an org-admin account that can log volunteer sessions for itself, then attempt to verify that own session and confirm "Cannot verify your own session".
  - Reason: Seed data does not include a user who is both org verifier and session owner; self-verification cannot be produced from available UI states.
  - Manual Step: Create an org-admin account that can log volunteer sessions for itself, then attempt to verify that own session and confirm "Cannot verify your own session".
  - Reason: Seed data does not include a user who is both org verifier and session owner; self-verification cannot be produced from available UI states.
  - Manual Step: Create an org-admin account that can log volunteer sessions for itself, then attempt to verify that own session and confirm "Cannot verify your own session".
  - Reason: Seed data does not include a user who is both org verifier and session owner; self-verification cannot be produced from available UI states.
  - Manual Step: Create an org-admin account that can log volunteer sessions for itself, then attempt to verify that own session and confirm "Cannot verify your own session".
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Seed data does not include a user who is both org verifier and session owner; self-verification cannot be produced from available UI states.
  - Manual Step: Create an org-admin account that can log volunteer sessions for itself, then attempt to verify that own session and confirm "Cannot verify your own session".
  - Reason: Seed data does not include a user who is both org verifier and session owner; self-verification cannot be produced from available UI states.
  - Manual Step: Create an org-admin account that can log volunteer sessions for itself, then attempt to verify that own session and confirm "Cannot verify your own session".
  - Reason: Seed data does not include a user who is both org verifier and session owner; self-verification cannot be produced from available UI states.
  - Manual Step: Create an org-admin account that can log volunteer sessions for itself, then attempt to verify that own session and confirm "Cannot verify your own session".
  - Reason: Seed data does not include a user who is both org verifier and session owner; self-verification cannot be produced from available UI states.
  - Manual Step: Create an org-admin account that can log volunteer sessions for itself, then attempt to verify that own session and confirm "Cannot verify your own session".
  - Reason: Seed data does not include a user who is both org verifier and session owner; self-verification cannot be produced from available UI states.
  - Manual Step: Create an org-admin account that can log volunteer sessions for itself, then attempt to verify that own session and confirm "Cannot verify your own session".
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Seed data does not include a user who is both org verifier and session owner; self-verification cannot be produced from available UI states.
  - Manual Step: Create an org-admin account that can log volunteer sessions for itself, then attempt to verify that own session and confirm "Cannot verify your own session".
  - Reason: Seed data does not include a user who is both org verifier and session owner; self-verification cannot be produced from available UI states.
  - Manual Step: Create an org-admin account that can log volunteer sessions for itself, then attempt to verify that own session and confirm "Cannot verify your own session".
  - Reason: Seed data does not include a user who is both org verifier and session owner; self-verification cannot be produced from available UI states.
  - Manual Step: Create an org-admin account that can log volunteer sessions for itself, then attempt to verify that own session and confirm "Cannot verify your own session".
  - Reason: Seed data does not include a user who is both org verifier and session owner; self-verification cannot be produced from available UI states.
  - Manual Step: Create an org-admin account that can log volunteer sessions for itself, then attempt to verify that own session and confirm "Cannot verify your own session".
  - Reason: Seed data does not include a user who is both org verifier and session owner; self-verification cannot be produced from available UI states.
  - Manual Step: Create an org-admin account that can log volunteer sessions for itself, then attempt to verify that own session and confirm "Cannot verify your own session".
  - Reason: Seed data does not include a user who is both org verifier and session owner; self-verification cannot be produced from available UI states.
  - Manual Step: Create an org-admin account that can log volunteer sessions for itself, then attempt to verify that own session and confirm "Cannot verify your own session".
  - Reason: Seed data does not include a user who is both org verifier and session owner; self-verification cannot be produced from available UI states.
  - Manual Step: Create an org-admin account that can log volunteer sessions for itself, then attempt to verify that own session and confirm "Cannot verify your own session".
  - Reason: Seed data does not include a user who is both org verifier and session owner; self-verification cannot be produced from available UI states.
  - Manual Step: Create an org-admin account that can log volunteer sessions for itself, then attempt to verify that own session and confirm "Cannot verify your own session".
  - Reason: Seed data does not include a user who is both org verifier and session owner; self-verification cannot be produced from available UI states.
  - Manual Step: Create an org-admin account that can log volunteer sessions for itself, then attempt to verify that own session and confirm "Cannot verify your own session".
  - Reason: Seed data does not include a user who is both org verifier and session owner; self-verification cannot be produced from available UI states.
  - Manual Step: Create an org-admin account that can log volunteer sessions for itself, then attempt to verify that own session and confirm "Cannot verify your own session".
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Seed data does not include a user who is both org verifier and session owner; self-verification cannot be produced from available UI states.
  - Manual Step: Create an org-admin account that can log volunteer sessions for itself, then attempt to verify that own session and confirm "Cannot verify your own session".
  - Reason: Seed data does not include a user who is both org verifier and session owner; self-verification cannot be produced from available UI states.
  - Manual Step: Create an org-admin account that can log volunteer sessions for itself, then attempt to verify that own session and confirm "Cannot verify your own session".
  _Expect: error "Cannot verify your own session"_

### 3d · Announcements
- [ ] Click "Make Announcement" → select opp → type message → send — PASS — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: The legacy dashboard announcement composer is not exposed in the current beneficiary admin surface.
  - Manual Step: If announcements remain required, restore the composer or move this coverage to the current messaging/bulk-communication entry point.
  - Reason: The legacy dashboard announcement composer is not exposed in the current beneficiary admin surface.
  - Manual Step: If announcements remain required, restore the composer or move this coverage to the current messaging/bulk-communication entry point.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The legacy dashboard announcement composer is not exposed in the current beneficiary admin surface.
  - Manual Step: If announcements remain required, restore the composer or move this coverage to the current messaging/bulk-communication entry point.
  - Reason: The legacy dashboard announcement composer is not exposed in the current beneficiary admin surface.
  - Manual Step: If announcements remain required, restore the composer or move this coverage to the current messaging/bulk-communication entry point.
  - Reason: The legacy dashboard announcement composer is not exposed in the current beneficiary admin surface.
  - Manual Step: If announcements remain required, restore the composer or move this coverage to the current messaging/bulk-communication entry point.
  - Reason: The legacy dashboard announcement composer is not exposed in the current beneficiary admin surface.
  - Manual Step: If announcements remain required, restore the composer or move this coverage to the current messaging/bulk-communication entry point.
  - Reason: The legacy dashboard announcement composer is not exposed in the current beneficiary admin surface.
  - Manual Step: If announcements remain required, restore the composer or move this coverage to the current messaging/bulk-communication entry point.
  - Reason: The legacy dashboard announcement composer is not exposed in the current beneficiary admin surface.
  - Manual Step: If announcements remain required, restore the composer or move this coverage to the current messaging/bulk-communication entry point.
  - Reason: The legacy dashboard announcement composer is not exposed in the current beneficiary admin surface.
  - Manual Step: If announcements remain required, restore the composer or move this coverage to the current messaging/bulk-communication entry point.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The legacy dashboard announcement composer is not exposed in the current beneficiary admin surface.
  - Manual Step: If announcements remain required, restore the composer or move this coverage to the current messaging/bulk-communication entry point.
  - Reason: The legacy dashboard announcement composer is not exposed in the current beneficiary admin surface.
  - Manual Step: If announcements remain required, restore the composer or move this coverage to the current messaging/bulk-communication entry point.
  - Reason: The legacy dashboard announcement composer is not exposed in the current beneficiary admin surface.
  - Manual Step: If announcements remain required, restore the composer or move this coverage to the current messaging/bulk-communication entry point.
  - Reason: The legacy dashboard announcement composer is not exposed in the current beneficiary admin surface.
  - Manual Step: If announcements remain required, restore the composer or move this coverage to the current messaging/bulk-communication entry point.
  - Reason: The legacy dashboard announcement composer is not exposed in the current beneficiary admin surface.
  - Manual Step: If announcements remain required, restore the composer or move this coverage to the current messaging/bulk-communication entry point.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The legacy dashboard announcement composer is not exposed in the current beneficiary admin surface.
  - Manual Step: If announcements remain required, restore the composer or move this coverage to the current messaging/bulk-communication entry point.
  - Reason: The legacy dashboard announcement composer is not exposed in the current beneficiary admin surface.
  - Manual Step: If announcements remain required, restore the composer or move this coverage to the current messaging/bulk-communication entry point.
  - Reason: The legacy dashboard announcement composer is not exposed in the current beneficiary admin surface.
  - Manual Step: If announcements remain required, restore the composer or move this coverage to the current messaging/bulk-communication entry point.
  - Reason: The legacy dashboard announcement composer is not exposed in the current beneficiary admin surface.
  - Manual Step: If announcements remain required, restore the composer or move this coverage to the current messaging/bulk-communication entry point.
  - Reason: The legacy dashboard announcement composer is not exposed in the current beneficiary admin surface.
  - Manual Step: If announcements remain required, restore the composer or move this coverage to the current messaging/bulk-communication entry point.
  - Reason: The legacy dashboard announcement composer is not exposed in the current beneficiary admin surface.
  - Manual Step: If announcements remain required, restore the composer or move this coverage to the current messaging/bulk-communication entry point.
  - Reason: The legacy dashboard announcement composer is not exposed in the current beneficiary admin surface.
  - Manual Step: If announcements remain required, restore the composer or move this coverage to the current messaging/bulk-communication entry point.
  - Reason: The legacy dashboard announcement composer is not exposed in the current beneficiary admin surface.
  - Manual Step: If announcements remain required, restore the composer or move this coverage to the current messaging/bulk-communication entry point.
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /Make Announcement/i })[22m

  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-058-2026-06-27T00-54-32-441Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-27T00-53-56-519Z.zip
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /Make Announcement/i })[22m

  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-058-2026-06-26T23-21-05-233Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-26T23-20-29-226Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /Make Announcement/i })[22m

  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-058-2026-05-18T13-48-03-555Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-05-18T13-47-27-661Z.zip
  _Expect: all confirmed signups for that opp receive a notification/message_

### 3e · Messages & Notifications
- [ ] Compose message to john@student.edu → appears in Sent — PASS — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN without organization ownership, so the legacy org-admin message flow is not a valid automated target in this environment.
  - Manual Step: Use a true ORG_ADMIN seed, compose a message to john@student.edu, send it, and confirm it appears in Sent.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN without organization ownership, so the legacy org-admin message flow is not a valid automated target in this environment.
  - Manual Step: Use a true ORG_ADMIN seed, compose a message to john@student.edu, send it, and confirm it appears in Sent.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN without organization ownership, so the legacy org-admin message flow is not a valid automated target in this environment.
  - Manual Step: Use a true ORG_ADMIN seed, compose a message to john@student.edu, send it, and confirm it appears in Sent.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN without organization ownership, so the legacy org-admin message flow is not a valid automated target in this environment.
  - Manual Step: Use a true ORG_ADMIN seed, compose a message to john@student.edu, send it, and confirm it appears in Sent.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN without organization ownership, so the legacy org-admin message flow is not a valid automated target in this environment.
  - Manual Step: Use a true ORG_ADMIN seed, compose a message to john@student.edu, send it, and confirm it appears in Sent.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN without organization ownership, so the legacy org-admin message flow is not a valid automated target in this environment.
  - Manual Step: Use a true ORG_ADMIN seed, compose a message to john@student.edu, send it, and confirm it appears in Sent.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN without organization ownership, so the legacy org-admin message flow is not a valid automated target in this environment.
  - Manual Step: Use a true ORG_ADMIN seed, compose a message to john@student.edu, send it, and confirm it appears in Sent.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN without organization ownership, so the legacy org-admin message flow is not a valid automated target in this environment.
  - Manual Step: Use a true ORG_ADMIN seed, compose a message to john@student.edu, send it, and confirm it appears in Sent.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN without organization ownership, so the legacy org-admin message flow is not a valid automated target in this environment.
  - Manual Step: Use a true ORG_ADMIN seed, compose a message to john@student.edu, send it, and confirm it appears in Sent.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN without organization ownership, so the legacy org-admin message flow is not a valid automated target in this environment.
  - Manual Step: Use a true ORG_ADMIN seed, compose a message to john@student.edu, send it, and confirm it appears in Sent.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN without organization ownership, so the legacy org-admin message flow is not a valid automated target in this environment.
  - Manual Step: Use a true ORG_ADMIN seed, compose a message to john@student.edu, send it, and confirm it appears in Sent.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN without organization ownership, so the legacy org-admin message flow is not a valid automated target in this environment.
  - Manual Step: Use a true ORG_ADMIN seed, compose a message to john@student.edu, send it, and confirm it appears in Sent.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN without organization ownership, so the legacy org-admin message flow is not a valid automated target in this environment.
  - Manual Step: Use a true ORG_ADMIN seed, compose a message to john@student.edu, send it, and confirm it appears in Sent.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN without organization ownership, so the legacy org-admin message flow is not a valid automated target in this environment.
  - Manual Step: Use a true ORG_ADMIN seed, compose a message to john@student.edu, send it, and confirm it appears in Sent.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN without organization ownership, so the legacy org-admin message flow is not a valid automated target in this environment.
  - Manual Step: Use a true ORG_ADMIN seed, compose a message to john@student.edu, send it, and confirm it appears in Sent.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN without organization ownership, so the legacy org-admin message flow is not a valid automated target in this environment.
  - Manual Step: Use a true ORG_ADMIN seed, compose a message to john@student.edu, send it, and confirm it appears in Sent.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN without organization ownership, so the legacy org-admin message flow is not a valid automated target in this environment.
  - Manual Step: Use a true ORG_ADMIN seed, compose a message to john@student.edu, send it, and confirm it appears in Sent.
  - Error: Org message to john not present in Sent folder
  - URL: http://localhost:5173/messages
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-059-2026-06-27T01-47-21-430Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-27T01-47-17-376Z.zip
  - Console/Network Logs Snippet:

```text
[2026-06-27T01:47:20.493Z] response: 404 POST http://localhost:5173/api/messages
[2026-06-27T01:47:20.493Z] console.error: Failed to load resource: the server responded with a status of 404 (Not Found)
```
  - Error: Org message to john not present in Sent folder
  - URL: http://localhost:5173/messages
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-059-2026-06-27T01-34-57-931Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-27T01-34-53-880Z.zip
  - Console/Network Logs Snippet:

```text
[2026-06-27T01:34:57.004Z] response: 404 POST http://localhost:5173/api/messages
[2026-06-27T01:34:57.004Z] console.error: Failed to load resource: the server responded with a status of 404 (Not Found)
```
  - Error: Org message to john not present in Sent folder
  - URL: http://localhost:5173/messages
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-059-2026-06-27T01-27-19-462Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-27T01-27-15-427Z.zip
  - Console/Network Logs Snippet:

```text
[2026-06-27T01:27:18.533Z] response: 404 POST http://localhost:5173/api/messages
[2026-06-27T01:27:18.533Z] console.error: Failed to load resource: the server responded with a status of 404 (Not Found)
```
  - Error: Org message to john not present in Sent folder
  - URL: http://localhost:5173/messages
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-059-2026-06-27T01-20-49-206Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-27T01-20-45-133Z.zip
  - Console/Network Logs Snippet:

```text
[2026-06-27T01:20:48.266Z] response: 404 POST http://localhost:5173/api/messages
[2026-06-27T01:20:48.266Z] console.error: Failed to load resource: the server responded with a status of 404 (Not Found)
```
  - Error: Org message to john not present in Sent folder
  - URL: http://localhost:5173/messages
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-059-2026-06-27T01-02-40-467Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-27T01-02-36-415Z.zip
  - Console/Network Logs Snippet:

```text
[2026-06-27T01:02:39.527Z] response: 404 POST http://localhost:5173/api/messages
[2026-06-27T01:02:39.527Z] console.error: Failed to load resource: the server responded with a status of 404 (Not Found)
```
  - Error: Org message to john not present in Sent folder
  - URL: http://localhost:5173/messages
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-059-2026-06-27T00-54-34-206Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-27T00-53-56-519Z.zip
  - Console/Network Logs Snippet:

```text
[2026-06-27T00:54:33.277Z] response: 404 POST http://localhost:5173/api/messages
[2026-06-27T00:54:33.277Z] console.error: Failed to load resource: the server responded with a status of 404 (Not Found)
```
  - Error: Org message to john not present in Sent folder
  - URL: http://localhost:5173/messages
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-059-2026-06-26T23-21-06-967Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-26T23-20-29-226Z.zip
  - Console/Network Logs Snippet:

```text
[2026-06-26T23:21:06.035Z] response: 404 POST http://localhost:5173/api/messages
[2026-06-26T23:21:06.035Z] console.error: Failed to load resource: the server responded with a status of 404 (Not Found)
```
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Org message to john not present in Sent folder
  - URL: http://127.0.0.1:5174/messages
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-059-2026-05-18T13-48-05-299Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-05-18T13-47-27-661Z.zip
  - Console/Network Logs Snippet:

```text
[2026-05-18T13:48:04.368Z] response: 404 POST http://127.0.0.1:5174/api/messages
[2026-05-18T13:48:04.368Z] console.error: Failed to load resource: the server responded with a status of 404 (Not Found)
```
- [ ] Student's message from 2g appears in Inbox → mark read — PASS — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — PASS — PASS — FAIL — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — PASS — PASS
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^inbox$/i })[22m

  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-060-2026-06-27T01-57-22-211Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-27T01-57-05-510Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Student message from item 2g not present in org inbox
  - URL: http://127.0.0.1:5174/messages
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-060-2026-05-18T13-48-06-096Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-05-18T13-47-27-661Z.zip

### 3f · Settings
- [ ] **Profile** · Edit description (500-char limit), website, phone → Save → persists — PASS — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — PASS — PASS
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Organization description exceeded 500-char limit (510)
  - URL: http://localhost:5173/settings?tab=profile
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-061-2026-06-27T00-54-36-281Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-27T00-53-56-519Z.zip
  - Error: Organization description exceeded 500-char limit (510)
  - URL: http://localhost:5173/settings?tab=profile
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-061-2026-06-26T23-21-09-063Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-26T23-20-29-226Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^profile$/i })[22m

  - URL: http://127.0.0.1:5174/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-061-2026-05-18T13-48-21-750Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-05-18T13-47-27-661Z.zip
- [ ] **ZIP codes** · Add a ZIP code → appears in list; remove it → gone — PASS — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN without a linked organization profile, so ZIP-code profile editing is not reachable in the intended org-admin surface.
  - Manual Step: Use a true ORG_ADMIN seed, add a ZIP code in Organization Settings, save, refresh, confirm it persists, then remove it and confirm it clears.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN without a linked organization profile, so ZIP-code profile editing is not reachable in the intended org-admin surface.
  - Manual Step: Use a true ORG_ADMIN seed, add a ZIP code in Organization Settings, save, refresh, confirm it persists, then remove it and confirm it clears.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN without a linked organization profile, so ZIP-code profile editing is not reachable in the intended org-admin surface.
  - Manual Step: Use a true ORG_ADMIN seed, add a ZIP code in Organization Settings, save, refresh, confirm it persists, then remove it and confirm it clears.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN without a linked organization profile, so ZIP-code profile editing is not reachable in the intended org-admin surface.
  - Manual Step: Use a true ORG_ADMIN seed, add a ZIP code in Organization Settings, save, refresh, confirm it persists, then remove it and confirm it clears.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN without a linked organization profile, so ZIP-code profile editing is not reachable in the intended org-admin surface.
  - Manual Step: Use a true ORG_ADMIN seed, add a ZIP code in Organization Settings, save, refresh, confirm it persists, then remove it and confirm it clears.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN without a linked organization profile, so ZIP-code profile editing is not reachable in the intended org-admin surface.
  - Manual Step: Use a true ORG_ADMIN seed, add a ZIP code in Organization Settings, save, refresh, confirm it persists, then remove it and confirm it clears.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN without a linked organization profile, so ZIP-code profile editing is not reachable in the intended org-admin surface.
  - Manual Step: Use a true ORG_ADMIN seed, add a ZIP code in Organization Settings, save, refresh, confirm it persists, then remove it and confirm it clears.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN without a linked organization profile, so ZIP-code profile editing is not reachable in the intended org-admin surface.
  - Manual Step: Use a true ORG_ADMIN seed, add a ZIP code in Organization Settings, save, refresh, confirm it persists, then remove it and confirm it clears.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN without a linked organization profile, so ZIP-code profile editing is not reachable in the intended org-admin surface.
  - Manual Step: Use a true ORG_ADMIN seed, add a ZIP code in Organization Settings, save, refresh, confirm it persists, then remove it and confirm it clears.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN without a linked organization profile, so ZIP-code profile editing is not reachable in the intended org-admin surface.
  - Manual Step: Use a true ORG_ADMIN seed, add a ZIP code in Organization Settings, save, refresh, confirm it persists, then remove it and confirm it clears.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN without a linked organization profile, so ZIP-code profile editing is not reachable in the intended org-admin surface.
  - Manual Step: Use a true ORG_ADMIN seed, add a ZIP code in Organization Settings, save, refresh, confirm it persists, then remove it and confirm it clears.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN without a linked organization profile, so ZIP-code profile editing is not reachable in the intended org-admin surface.
  - Manual Step: Use a true ORG_ADMIN seed, add a ZIP code in Organization Settings, save, refresh, confirm it persists, then remove it and confirm it clears.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN without a linked organization profile, so ZIP-code profile editing is not reachable in the intended org-admin surface.
  - Manual Step: Use a true ORG_ADMIN seed, add a ZIP code in Organization Settings, save, refresh, confirm it persists, then remove it and confirm it clears.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN without a linked organization profile, so ZIP-code profile editing is not reachable in the intended org-admin surface.
  - Manual Step: Use a true ORG_ADMIN seed, add a ZIP code in Organization Settings, save, refresh, confirm it persists, then remove it and confirm it clears.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN without a linked organization profile, so ZIP-code profile editing is not reachable in the intended org-admin surface.
  - Manual Step: Use a true ORG_ADMIN seed, add a ZIP code in Organization Settings, save, refresh, confirm it persists, then remove it and confirm it clears.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN without a linked organization profile, so ZIP-code profile editing is not reachable in the intended org-admin surface.
  - Manual Step: Use a true ORG_ADMIN seed, add a ZIP code in Organization Settings, save, refresh, confirm it persists, then remove it and confirm it clears.
  - Reason: The seeded org test account is currently a BENEFICIARY_ADMIN without a linked organization profile, so ZIP-code profile editing is not reachable in the intended org-admin surface.
  - Manual Step: Use a true ORG_ADMIN seed, add a ZIP code in Organization Settings, save, refresh, confirm it persists, then remove it and confirm it clears.
  - Error: ZIP input not found in org profile
  - URL: http://localhost:5173/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-062-2026-06-27T01-47-24-773Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-27T01-47-17-376Z.zip
  - Error: ZIP code did not clear
  - URL: http://localhost:5173/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-062-2026-06-27T01-35-02-655Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-27T01-34-53-880Z.zip
  - Error: ZIP code did not clear
  - URL: http://localhost:5173/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-062-2026-06-27T01-27-24-079Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-27T01-27-15-427Z.zip
  - Error: ZIP code did not clear
  - URL: http://localhost:5173/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-062-2026-06-27T01-20-53-906Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-27T01-20-45-133Z.zip
  - Error: ZIP code did not clear
  - URL: http://localhost:5173/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-062-2026-06-27T01-02-45-191Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-27T01-02-36-415Z.zip
  - Error: ZIP input not found in org profile
  - URL: http://localhost:5173/settings?tab=profile
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-062-2026-06-27T00-54-36-329Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-27T00-53-56-519Z.zip
  - Error: ZIP input not found in org profile
  - URL: http://localhost:5173/settings?tab=profile
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-062-2026-06-26T23-21-09-121Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-26T23-20-29-226Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: ZIP input not found in org profile
  - URL: http://127.0.0.1:5174/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-062-2026-05-18T13-48-21-829Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-05-18T13-47-27-661Z.zip
- [ ] **Schools tab** · Search for "Lincoln" → request approval — PASS — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: A dedicated beneficiary "Schools" tab is not present in the current settings UI.
  - Manual Step: Validate school participation restrictions from the opportunity composer instead, where approved schools are now selected per opportunity.
  - Reason: A dedicated beneficiary "Schools" tab is not present in the current settings UI.
  - Manual Step: Validate school participation restrictions from the opportunity composer instead, where approved schools are now selected per opportunity.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: A dedicated beneficiary "Schools" tab is not present in the current settings UI.
  - Manual Step: Validate school participation restrictions from the opportunity composer instead, where approved schools are now selected per opportunity.
  - Reason: A dedicated beneficiary "Schools" tab is not present in the current settings UI.
  - Manual Step: Validate school participation restrictions from the opportunity composer instead, where approved schools are now selected per opportunity.
  - Reason: A dedicated beneficiary "Schools" tab is not present in the current settings UI.
  - Manual Step: Validate school participation restrictions from the opportunity composer instead, where approved schools are now selected per opportunity.
  - Reason: A dedicated beneficiary "Schools" tab is not present in the current settings UI.
  - Manual Step: Validate school participation restrictions from the opportunity composer instead, where approved schools are now selected per opportunity.
  - Reason: A dedicated beneficiary "Schools" tab is not present in the current settings UI.
  - Manual Step: Validate school participation restrictions from the opportunity composer instead, where approved schools are now selected per opportunity.
  - Reason: A dedicated beneficiary "Schools" tab is not present in the current settings UI.
  - Manual Step: Validate school participation restrictions from the opportunity composer instead, where approved schools are now selected per opportunity.
  - Reason: A dedicated beneficiary "Schools" tab is not present in the current settings UI.
  - Manual Step: Validate school participation restrictions from the opportunity composer instead, where approved schools are now selected per opportunity.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: A dedicated beneficiary "Schools" tab is not present in the current settings UI.
  - Manual Step: Validate school participation restrictions from the opportunity composer instead, where approved schools are now selected per opportunity.
  - Reason: A dedicated beneficiary "Schools" tab is not present in the current settings UI.
  - Manual Step: Validate school participation restrictions from the opportunity composer instead, where approved schools are now selected per opportunity.
  - Reason: A dedicated beneficiary "Schools" tab is not present in the current settings UI.
  - Manual Step: Validate school participation restrictions from the opportunity composer instead, where approved schools are now selected per opportunity.
  - Reason: A dedicated beneficiary "Schools" tab is not present in the current settings UI.
  - Manual Step: Validate school participation restrictions from the opportunity composer instead, where approved schools are now selected per opportunity.
  - Reason: A dedicated beneficiary "Schools" tab is not present in the current settings UI.
  - Manual Step: Validate school participation restrictions from the opportunity composer instead, where approved schools are now selected per opportunity.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: A dedicated beneficiary "Schools" tab is not present in the current settings UI.
  - Manual Step: Validate school participation restrictions from the opportunity composer instead, where approved schools are now selected per opportunity.
  - Reason: A dedicated beneficiary "Schools" tab is not present in the current settings UI.
  - Manual Step: Validate school participation restrictions from the opportunity composer instead, where approved schools are now selected per opportunity.
  - Reason: A dedicated beneficiary "Schools" tab is not present in the current settings UI.
  - Manual Step: Validate school participation restrictions from the opportunity composer instead, where approved schools are now selected per opportunity.
  - Reason: A dedicated beneficiary "Schools" tab is not present in the current settings UI.
  - Manual Step: Validate school participation restrictions from the opportunity composer instead, where approved schools are now selected per opportunity.
  - Reason: A dedicated beneficiary "Schools" tab is not present in the current settings UI.
  - Manual Step: Validate school participation restrictions from the opportunity composer instead, where approved schools are now selected per opportunity.
  - Reason: A dedicated beneficiary "Schools" tab is not present in the current settings UI.
  - Manual Step: Validate school participation restrictions from the opportunity composer instead, where approved schools are now selected per opportunity.
  - Reason: A dedicated beneficiary "Schools" tab is not present in the current settings UI.
  - Manual Step: Validate school participation restrictions from the opportunity composer instead, where approved schools are now selected per opportunity.
  - Reason: A dedicated beneficiary "Schools" tab is not present in the current settings UI.
  - Manual Step: Validate school participation restrictions from the opportunity composer instead, where approved schools are now selected per opportunity.
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^schools$/i })[22m

  - URL: http://localhost:5173/settings?tab=profile
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-063-2026-06-27T00-54-51-381Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-27T00-53-56-519Z.zip
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^schools$/i })[22m

  - URL: http://localhost:5173/settings?tab=profile
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-063-2026-06-26T23-21-24-172Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-26T23-20-29-226Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^schools$/i })[22m

  - URL: http://127.0.0.1:5174/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-063-2026-05-18T13-48-36-873Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-05-18T13-47-27-661Z.zip
  _Expect: "Pending" status shown; school admin sees request_
- [ ] **Analytics** · Volunteer count and total hours display correctly — PASS — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Attendance analytics are gated behind the current Pro workflow and not exposed as the old standalone analytics tab.
  - Manual Step: Validate analytics through the current Pro workflow once that surface is active for the seeded org.
  - Reason: Attendance analytics are gated behind the current Pro workflow and not exposed as the old standalone analytics tab.
  - Manual Step: Validate analytics through the current Pro workflow once that surface is active for the seeded org.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Attendance analytics are gated behind the current Pro workflow and not exposed as the old standalone analytics tab.
  - Manual Step: Validate analytics through the current Pro workflow once that surface is active for the seeded org.
  - Reason: Attendance analytics are gated behind the current Pro workflow and not exposed as the old standalone analytics tab.
  - Manual Step: Validate analytics through the current Pro workflow once that surface is active for the seeded org.
  - Reason: Attendance analytics are gated behind the current Pro workflow and not exposed as the old standalone analytics tab.
  - Manual Step: Validate analytics through the current Pro workflow once that surface is active for the seeded org.
  - Reason: Attendance analytics are gated behind the current Pro workflow and not exposed as the old standalone analytics tab.
  - Manual Step: Validate analytics through the current Pro workflow once that surface is active for the seeded org.
  - Reason: Attendance analytics are gated behind the current Pro workflow and not exposed as the old standalone analytics tab.
  - Manual Step: Validate analytics through the current Pro workflow once that surface is active for the seeded org.
  - Reason: Attendance analytics are gated behind the current Pro workflow and not exposed as the old standalone analytics tab.
  - Manual Step: Validate analytics through the current Pro workflow once that surface is active for the seeded org.
  - Reason: Attendance analytics are gated behind the current Pro workflow and not exposed as the old standalone analytics tab.
  - Manual Step: Validate analytics through the current Pro workflow once that surface is active for the seeded org.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Attendance analytics are gated behind the current Pro workflow and not exposed as the old standalone analytics tab.
  - Manual Step: Validate analytics through the current Pro workflow once that surface is active for the seeded org.
  - Reason: Attendance analytics are gated behind the current Pro workflow and not exposed as the old standalone analytics tab.
  - Manual Step: Validate analytics through the current Pro workflow once that surface is active for the seeded org.
  - Reason: Attendance analytics are gated behind the current Pro workflow and not exposed as the old standalone analytics tab.
  - Manual Step: Validate analytics through the current Pro workflow once that surface is active for the seeded org.
  - Reason: Attendance analytics are gated behind the current Pro workflow and not exposed as the old standalone analytics tab.
  - Manual Step: Validate analytics through the current Pro workflow once that surface is active for the seeded org.
  - Reason: Attendance analytics are gated behind the current Pro workflow and not exposed as the old standalone analytics tab.
  - Manual Step: Validate analytics through the current Pro workflow once that surface is active for the seeded org.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Attendance analytics are gated behind the current Pro workflow and not exposed as the old standalone analytics tab.
  - Manual Step: Validate analytics through the current Pro workflow once that surface is active for the seeded org.
  - Reason: Attendance analytics are gated behind the current Pro workflow and not exposed as the old standalone analytics tab.
  - Manual Step: Validate analytics through the current Pro workflow once that surface is active for the seeded org.
  - Reason: Attendance analytics are gated behind the current Pro workflow and not exposed as the old standalone analytics tab.
  - Manual Step: Validate analytics through the current Pro workflow once that surface is active for the seeded org.
  - Reason: Attendance analytics are gated behind the current Pro workflow and not exposed as the old standalone analytics tab.
  - Manual Step: Validate analytics through the current Pro workflow once that surface is active for the seeded org.
  - Reason: Attendance analytics are gated behind the current Pro workflow and not exposed as the old standalone analytics tab.
  - Manual Step: Validate analytics through the current Pro workflow once that surface is active for the seeded org.
  - Reason: Attendance analytics are gated behind the current Pro workflow and not exposed as the old standalone analytics tab.
  - Manual Step: Validate analytics through the current Pro workflow once that surface is active for the seeded org.
  - Reason: Attendance analytics are gated behind the current Pro workflow and not exposed as the old standalone analytics tab.
  - Manual Step: Validate analytics through the current Pro workflow once that surface is active for the seeded org.
  - Reason: Attendance analytics are gated behind the current Pro workflow and not exposed as the old standalone analytics tab.
  - Manual Step: Validate analytics through the current Pro workflow once that surface is active for the seeded org.
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^analytics$/i })[22m

  - URL: http://localhost:5173/settings?tab=profile
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-064-2026-06-27T00-55-06-437Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-27T00-53-56-519Z.zip
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^analytics$/i })[22m

  - URL: http://localhost:5173/settings?tab=profile
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-064-2026-06-26T23-21-39-243Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-26T23-20-29-226Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^analytics$/i })[22m

  - URL: http://127.0.0.1:5174/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-064-2026-05-18T13-48-51-939Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-05-18T13-47-27-661Z.zip
- [ ] **Export CSV** · Downloads volunteer data file — PASS — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: The old beneficiary data-export tab is not present in the current settings surface.
  - Manual Step: If volunteer-data export remains required, wire it into the current UI and restore automated download coverage.
  - Reason: The old beneficiary data-export tab is not present in the current settings surface.
  - Manual Step: If volunteer-data export remains required, wire it into the current UI and restore automated download coverage.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The old beneficiary data-export tab is not present in the current settings surface.
  - Manual Step: If volunteer-data export remains required, wire it into the current UI and restore automated download coverage.
  - Reason: The old beneficiary data-export tab is not present in the current settings surface.
  - Manual Step: If volunteer-data export remains required, wire it into the current UI and restore automated download coverage.
  - Reason: The old beneficiary data-export tab is not present in the current settings surface.
  - Manual Step: If volunteer-data export remains required, wire it into the current UI and restore automated download coverage.
  - Reason: The old beneficiary data-export tab is not present in the current settings surface.
  - Manual Step: If volunteer-data export remains required, wire it into the current UI and restore automated download coverage.
  - Reason: The old beneficiary data-export tab is not present in the current settings surface.
  - Manual Step: If volunteer-data export remains required, wire it into the current UI and restore automated download coverage.
  - Reason: The old beneficiary data-export tab is not present in the current settings surface.
  - Manual Step: If volunteer-data export remains required, wire it into the current UI and restore automated download coverage.
  - Reason: The old beneficiary data-export tab is not present in the current settings surface.
  - Manual Step: If volunteer-data export remains required, wire it into the current UI and restore automated download coverage.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The old beneficiary data-export tab is not present in the current settings surface.
  - Manual Step: If volunteer-data export remains required, wire it into the current UI and restore automated download coverage.
  - Reason: The old beneficiary data-export tab is not present in the current settings surface.
  - Manual Step: If volunteer-data export remains required, wire it into the current UI and restore automated download coverage.
  - Reason: The old beneficiary data-export tab is not present in the current settings surface.
  - Manual Step: If volunteer-data export remains required, wire it into the current UI and restore automated download coverage.
  - Reason: The old beneficiary data-export tab is not present in the current settings surface.
  - Manual Step: If volunteer-data export remains required, wire it into the current UI and restore automated download coverage.
  - Reason: The old beneficiary data-export tab is not present in the current settings surface.
  - Manual Step: If volunteer-data export remains required, wire it into the current UI and restore automated download coverage.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The old beneficiary data-export tab is not present in the current settings surface.
  - Manual Step: If volunteer-data export remains required, wire it into the current UI and restore automated download coverage.
  - Reason: The old beneficiary data-export tab is not present in the current settings surface.
  - Manual Step: If volunteer-data export remains required, wire it into the current UI and restore automated download coverage.
  - Reason: The old beneficiary data-export tab is not present in the current settings surface.
  - Manual Step: If volunteer-data export remains required, wire it into the current UI and restore automated download coverage.
  - Reason: The old beneficiary data-export tab is not present in the current settings surface.
  - Manual Step: If volunteer-data export remains required, wire it into the current UI and restore automated download coverage.
  - Reason: The old beneficiary data-export tab is not present in the current settings surface.
  - Manual Step: If volunteer-data export remains required, wire it into the current UI and restore automated download coverage.
  - Reason: The old beneficiary data-export tab is not present in the current settings surface.
  - Manual Step: If volunteer-data export remains required, wire it into the current UI and restore automated download coverage.
  - Reason: The old beneficiary data-export tab is not present in the current settings surface.
  - Manual Step: If volunteer-data export remains required, wire it into the current UI and restore automated download coverage.
  - Reason: The old beneficiary data-export tab is not present in the current settings surface.
  - Manual Step: If volunteer-data export remains required, wire it into the current UI and restore automated download coverage.
  - Error: locator.click: Test ended.
Call log:
[2m  - waiting for getByRole('button', { name: /^data$/i })[22m

  - URL: http://localhost:5173/settings?tab=profile
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-065-2026-06-27T00-55-15-196Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-27T00-53-56-519Z.zip
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^data$/i })[22m

  - URL: http://localhost:5173/settings?tab=profile
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-065-2026-06-26T23-21-54-327Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-26T23-20-29-226Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^data$/i })[22m

  - URL: http://127.0.0.1:5174/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-065-2026-05-18T13-49-07-013Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-05-18T13-47-27-661Z.zip
- [ ] **Change password** · Works correctly — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Changing volunteer@greenearth.org password in-suite risks invalidating later required quick-smoke credentials.
  - Manual Step: In Organization Settings > Security, change password and confirm login, then restore seed password for shared test-account continuity.
  - Reason: Changing volunteer@greenearth.org password in-suite risks invalidating later required quick-smoke credentials.
  - Manual Step: In Organization Settings > Security, change password and confirm login, then restore seed password for shared test-account continuity.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Changing volunteer@greenearth.org password in-suite risks invalidating later required quick-smoke credentials.
  - Manual Step: In Organization Settings > Security, change password and confirm login, then restore seed password for shared test-account continuity.
  - Reason: Changing volunteer@greenearth.org password in-suite risks invalidating later required quick-smoke credentials.
  - Manual Step: In Organization Settings > Security, change password and confirm login, then restore seed password for shared test-account continuity.
  - Reason: Changing volunteer@greenearth.org password in-suite risks invalidating later required quick-smoke credentials.
  - Manual Step: In Organization Settings > Security, change password and confirm login, then restore seed password for shared test-account continuity.
  - Reason: Changing volunteer@greenearth.org password in-suite risks invalidating later required quick-smoke credentials.
  - Manual Step: In Organization Settings > Security, change password and confirm login, then restore seed password for shared test-account continuity.
  - Reason: Changing volunteer@greenearth.org password in-suite risks invalidating later required quick-smoke credentials.
  - Manual Step: In Organization Settings > Security, change password and confirm login, then restore seed password for shared test-account continuity.
  - Reason: Changing volunteer@greenearth.org password in-suite risks invalidating later required quick-smoke credentials.
  - Manual Step: In Organization Settings > Security, change password and confirm login, then restore seed password for shared test-account continuity.
  - Reason: Changing volunteer@greenearth.org password in-suite risks invalidating later required quick-smoke credentials.
  - Manual Step: In Organization Settings > Security, change password and confirm login, then restore seed password for shared test-account continuity.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Changing volunteer@greenearth.org password in-suite risks invalidating later required quick-smoke credentials.
  - Manual Step: In Organization Settings > Security, change password and confirm login, then restore seed password for shared test-account continuity.
  - Reason: Changing volunteer@greenearth.org password in-suite risks invalidating later required quick-smoke credentials.
  - Manual Step: In Organization Settings > Security, change password and confirm login, then restore seed password for shared test-account continuity.
  - Reason: Changing volunteer@greenearth.org password in-suite risks invalidating later required quick-smoke credentials.
  - Manual Step: In Organization Settings > Security, change password and confirm login, then restore seed password for shared test-account continuity.
  - Reason: Changing volunteer@greenearth.org password in-suite risks invalidating later required quick-smoke credentials.
  - Manual Step: In Organization Settings > Security, change password and confirm login, then restore seed password for shared test-account continuity.
  - Reason: Changing volunteer@greenearth.org password in-suite risks invalidating later required quick-smoke credentials.
  - Manual Step: In Organization Settings > Security, change password and confirm login, then restore seed password for shared test-account continuity.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Changing volunteer@greenearth.org password in-suite risks invalidating later required quick-smoke credentials.
  - Manual Step: In Organization Settings > Security, change password and confirm login, then restore seed password for shared test-account continuity.
  - Reason: Changing volunteer@greenearth.org password in-suite risks invalidating later required quick-smoke credentials.
  - Manual Step: In Organization Settings > Security, change password and confirm login, then restore seed password for shared test-account continuity.
  - Reason: Changing volunteer@greenearth.org password in-suite risks invalidating later required quick-smoke credentials.
  - Manual Step: In Organization Settings > Security, change password and confirm login, then restore seed password for shared test-account continuity.
  - Reason: Changing volunteer@greenearth.org password in-suite risks invalidating later required quick-smoke credentials.
  - Manual Step: In Organization Settings > Security, change password and confirm login, then restore seed password for shared test-account continuity.
  - Reason: Changing volunteer@greenearth.org password in-suite risks invalidating later required quick-smoke credentials.
  - Manual Step: In Organization Settings > Security, change password and confirm login, then restore seed password for shared test-account continuity.
  - Reason: Changing volunteer@greenearth.org password in-suite risks invalidating later required quick-smoke credentials.
  - Manual Step: In Organization Settings > Security, change password and confirm login, then restore seed password for shared test-account continuity.
  - Reason: Changing volunteer@greenearth.org password in-suite risks invalidating later required quick-smoke credentials.
  - Manual Step: In Organization Settings > Security, change password and confirm login, then restore seed password for shared test-account continuity.
  - Reason: Changing volunteer@greenearth.org password in-suite risks invalidating later required quick-smoke credentials.
  - Manual Step: In Organization Settings > Security, change password and confirm login, then restore seed password for shared test-account continuity.
  - Reason: Changing volunteer@greenearth.org password in-suite risks invalidating later required quick-smoke credentials.
  - Manual Step: In Organization Settings > Security, change password and confirm login, then restore seed password for shared test-account continuity.
  - Reason: Changing volunteer@greenearth.org password in-suite risks invalidating later required quick-smoke credentials.
  - Manual Step: In Organization Settings > Security, change password and confirm login, then restore seed password for shared test-account continuity.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Changing volunteer@greenearth.org password in-suite risks invalidating later required quick-smoke credentials.
  - Manual Step: In Organization Settings > Security, change password and confirm login, then restore seed password for shared test-account continuity.
  - Reason: Changing volunteer@greenearth.org password in-suite risks invalidating later required quick-smoke credentials.
  - Manual Step: In Organization Settings > Security, change password and confirm login, then restore seed password for shared test-account continuity.
- [ ] **Notifications** · Toggle off "New Signup" → save → persists — PASS — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Beneficiary notification toggles are not exposed in the current settings surface.
  - Manual Step: If org-level notification preferences remain required, add the current UI and restore automated persistence checks here.
  - Reason: Beneficiary notification toggles are not exposed in the current settings surface.
  - Manual Step: If org-level notification preferences remain required, add the current UI and restore automated persistence checks here.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Beneficiary notification toggles are not exposed in the current settings surface.
  - Manual Step: If org-level notification preferences remain required, add the current UI and restore automated persistence checks here.
  - Reason: Beneficiary notification toggles are not exposed in the current settings surface.
  - Manual Step: If org-level notification preferences remain required, add the current UI and restore automated persistence checks here.
  - Reason: Beneficiary notification toggles are not exposed in the current settings surface.
  - Manual Step: If org-level notification preferences remain required, add the current UI and restore automated persistence checks here.
  - Reason: Beneficiary notification toggles are not exposed in the current settings surface.
  - Manual Step: If org-level notification preferences remain required, add the current UI and restore automated persistence checks here.
  - Reason: Beneficiary notification toggles are not exposed in the current settings surface.
  - Manual Step: If org-level notification preferences remain required, add the current UI and restore automated persistence checks here.
  - Reason: Beneficiary notification toggles are not exposed in the current settings surface.
  - Manual Step: If org-level notification preferences remain required, add the current UI and restore automated persistence checks here.
  - Reason: Beneficiary notification toggles are not exposed in the current settings surface.
  - Manual Step: If org-level notification preferences remain required, add the current UI and restore automated persistence checks here.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Beneficiary notification toggles are not exposed in the current settings surface.
  - Manual Step: If org-level notification preferences remain required, add the current UI and restore automated persistence checks here.
  - Reason: Beneficiary notification toggles are not exposed in the current settings surface.
  - Manual Step: If org-level notification preferences remain required, add the current UI and restore automated persistence checks here.
  - Reason: Beneficiary notification toggles are not exposed in the current settings surface.
  - Manual Step: If org-level notification preferences remain required, add the current UI and restore automated persistence checks here.
  - Reason: Beneficiary notification toggles are not exposed in the current settings surface.
  - Manual Step: If org-level notification preferences remain required, add the current UI and restore automated persistence checks here.
  - Reason: Beneficiary notification toggles are not exposed in the current settings surface.
  - Manual Step: If org-level notification preferences remain required, add the current UI and restore automated persistence checks here.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Beneficiary notification toggles are not exposed in the current settings surface.
  - Manual Step: If org-level notification preferences remain required, add the current UI and restore automated persistence checks here.
  - Reason: Beneficiary notification toggles are not exposed in the current settings surface.
  - Manual Step: If org-level notification preferences remain required, add the current UI and restore automated persistence checks here.
  - Reason: Beneficiary notification toggles are not exposed in the current settings surface.
  - Manual Step: If org-level notification preferences remain required, add the current UI and restore automated persistence checks here.
  - Reason: Beneficiary notification toggles are not exposed in the current settings surface.
  - Manual Step: If org-level notification preferences remain required, add the current UI and restore automated persistence checks here.
  - Reason: Beneficiary notification toggles are not exposed in the current settings surface.
  - Manual Step: If org-level notification preferences remain required, add the current UI and restore automated persistence checks here.
  - Reason: Beneficiary notification toggles are not exposed in the current settings surface.
  - Manual Step: If org-level notification preferences remain required, add the current UI and restore automated persistence checks here.
  - Reason: Beneficiary notification toggles are not exposed in the current settings surface.
  - Manual Step: If org-level notification preferences remain required, add the current UI and restore automated persistence checks here.
  - Reason: Beneficiary notification toggles are not exposed in the current settings surface.
  - Manual Step: If org-level notification preferences remain required, add the current UI and restore automated persistence checks here.
  - Error: locator.click: Target page, context or browser has been closed
  - URL: http://localhost:5173/settings?tab=profile
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-067-2026-06-27T00-55-15-202Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-27T00-53-56-519Z.zip
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^notifications$/i })[22m

  - URL: http://localhost:5173/settings?tab=profile
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-067-2026-06-26T23-22-09-410Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/org-volunteer-2026-06-26T23-20-29-226Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
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
- [ ] On first login (clear `school_onboarding_*` from localStorage), graduation hours goal screen appears — PASS — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: School onboarding is now server-backed (`school.onboardingComplete`), not controlled by `school_onboarding_*` localStorage keys.
  - Manual Step: Use a school account whose onboarding has not been completed yet, then verify the 3-step welcome/setup card appears on Dashboard.
  - Reason: School onboarding is now server-backed (`school.onboardingComplete`), not controlled by `school_onboarding_*` localStorage keys.
  - Manual Step: Use a school account whose onboarding has not been completed yet, then verify the 3-step welcome/setup card appears on Dashboard.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: School onboarding is now server-backed (`school.onboardingComplete`), not controlled by `school_onboarding_*` localStorage keys.
  - Manual Step: Use a school account whose onboarding has not been completed yet, then verify the 3-step welcome/setup card appears on Dashboard.
  - Reason: School onboarding is now server-backed (`school.onboardingComplete`), not controlled by `school_onboarding_*` localStorage keys.
  - Manual Step: Use a school account whose onboarding has not been completed yet, then verify the 3-step welcome/setup card appears on Dashboard.
  - Reason: School onboarding is now server-backed (`school.onboardingComplete`), not controlled by `school_onboarding_*` localStorage keys.
  - Manual Step: Use a school account whose onboarding has not been completed yet, then verify the 3-step welcome/setup card appears on Dashboard.
  - Reason: School onboarding is now server-backed (`school.onboardingComplete`), not controlled by `school_onboarding_*` localStorage keys.
  - Manual Step: Use a school account whose onboarding has not been completed yet, then verify the 3-step welcome/setup card appears on Dashboard.
  - Reason: School onboarding is now server-backed (`school.onboardingComplete`), not controlled by `school_onboarding_*` localStorage keys.
  - Manual Step: Use a school account whose onboarding has not been completed yet, then verify the 3-step welcome/setup card appears on Dashboard.
  - Reason: School onboarding is now server-backed (`school.onboardingComplete`), not controlled by `school_onboarding_*` localStorage keys.
  - Manual Step: Use a school account whose onboarding has not been completed yet, then verify the 3-step welcome/setup card appears on Dashboard.
  - Reason: School onboarding is now server-backed (`school.onboardingComplete`), not controlled by `school_onboarding_*` localStorage keys.
  - Manual Step: Use a school account whose onboarding has not been completed yet, then verify the 3-step welcome/setup card appears on Dashboard.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: School onboarding is now server-backed (`school.onboardingComplete`), not controlled by `school_onboarding_*` localStorage keys.
  - Manual Step: Use a school account whose onboarding has not been completed yet, then verify the 3-step welcome/setup card appears on Dashboard.
  - Reason: School onboarding is now server-backed (`school.onboardingComplete`), not controlled by `school_onboarding_*` localStorage keys.
  - Manual Step: Use a school account whose onboarding has not been completed yet, then verify the 3-step welcome/setup card appears on Dashboard.
  - Reason: School onboarding is now server-backed (`school.onboardingComplete`), not controlled by `school_onboarding_*` localStorage keys.
  - Manual Step: Use a school account whose onboarding has not been completed yet, then verify the 3-step welcome/setup card appears on Dashboard.
  - Reason: School onboarding is now server-backed (`school.onboardingComplete`), not controlled by `school_onboarding_*` localStorage keys.
  - Manual Step: Use a school account whose onboarding has not been completed yet, then verify the 3-step welcome/setup card appears on Dashboard.
  - Reason: School onboarding is now server-backed (`school.onboardingComplete`), not controlled by `school_onboarding_*` localStorage keys.
  - Manual Step: Use a school account whose onboarding has not been completed yet, then verify the 3-step welcome/setup card appears on Dashboard.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: School onboarding is now server-backed (`school.onboardingComplete`), not controlled by `school_onboarding_*` localStorage keys.
  - Manual Step: Use a school account whose onboarding has not been completed yet, then verify the 3-step welcome/setup card appears on Dashboard.
  - Reason: School onboarding is now server-backed (`school.onboardingComplete`), not controlled by `school_onboarding_*` localStorage keys.
  - Manual Step: Use a school account whose onboarding has not been completed yet, then verify the 3-step welcome/setup card appears on Dashboard.
  - Reason: School onboarding is now server-backed (`school.onboardingComplete`), not controlled by `school_onboarding_*` localStorage keys.
  - Manual Step: Use a school account whose onboarding has not been completed yet, then verify the 3-step welcome/setup card appears on Dashboard.
  - Reason: School onboarding is now server-backed (`school.onboardingComplete`), not controlled by `school_onboarding_*` localStorage keys.
  - Manual Step: Use a school account whose onboarding has not been completed yet, then verify the 3-step welcome/setup card appears on Dashboard.
  - Reason: School onboarding is now server-backed (`school.onboardingComplete`), not controlled by `school_onboarding_*` localStorage keys.
  - Manual Step: Use a school account whose onboarding has not been completed yet, then verify the 3-step welcome/setup card appears on Dashboard.
  - Error: Onboarding goal screen did not appear after clearing school_onboarding_* localStorage keys
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-068-2026-06-27T01-27-26-121Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-27-24-182Z.zip
  - Console/Network Logs Snippet:

```text
[2026-06-27T01:27:26.054Z] requestfailed: GET http://localhost:5173/api/beneficiaries?status=APPROVED -> net::ERR_ABORTED
[2026-06-27T01:27:26.054Z] requestfailed: GET http://localhost:5173/api/messages/notifications/unread-count -> net::ERR_ABORTED
[2026-06-27T01:27:26.054Z] requestfailed: GET http://localhost:5173/api/messages/interventions/history?limit=6 -> net::ERR_ABORTED
[2026-06-27T01:27:26.054Z] requestfailed: GET http://localhost:5173/api/cohorts -> net::ERR_ABORTED
[2026-06-27T01:27:26.054Z] requestfailed: GET http://localhost:5173/api/messages/notifications/unread-count -> net::ERR_ABORTED
[2026-06-27T01:27:26.054Z] requestfailed: GET http://localhost:5173/api/messages/notifications -> net::ERR_ABORTED
[2026-06-27T01:27:26.054Z] requestfailed: GET http://localhost:5173/api/auth/me -> net::ERR_ABORTED
[2026-06-27T01:27:26.054Z] requestfailed: GET http://localhost:5173/api/schools/cmquusyb500028o5yxl869rbp/students/at-risk -> net::ERR_ABORTED
[2026-06-27T01:27:26.054Z] requestfailed: GET http://localhost:5173/api/cohorts -> net::ERR_ABORTED
[2026-06-27T01:27:26.054Z] requestfailed: GET http://localhost:5173/api/cohorts/school-students -> net::ERR_ABORTED
[2026-06-27T01:27:26.054Z] requestfailed: GET http://localhost:5173/api/auth/me -> net::ERR_ABORTED
[2026-06-27T01:27:26.054Z] requestfailed: GET http://localhost:5173/api/schools/cmquusyb500028o5yxl869rbp/students/at-risk -> net::ERR_ABORTED
```
  - Error: Onboarding goal screen did not appear after clearing school_onboarding_* localStorage keys
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-068-2026-06-27T01-20-55-897Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-20-54-000Z.zip
  - Console/Network Logs Snippet:

```text
[2026-06-27T01:20:55.829Z] requestfailed: GET http://localhost:5173/api/cohorts -> net::ERR_ABORTED
[2026-06-27T01:20:55.829Z] requestfailed: GET http://localhost:5173/api/beneficiaries?status=APPROVED -> net::ERR_ABORTED
[2026-06-27T01:20:55.829Z] requestfailed: GET http://localhost:5173/api/auth/me -> net::ERR_ABORTED
[2026-06-27T01:20:55.829Z] requestfailed: GET http://localhost:5173/api/messages/notifications/unread-count -> net::ERR_ABORTED
[2026-06-27T01:20:55.829Z] requestfailed: GET http://localhost:5173/api/schools/cmquusyb500028o5yxl869rbp/students/at-risk -> net::ERR_ABORTED
[2026-06-27T01:20:55.829Z] requestfailed: GET http://localhost:5173/api/messages/notifications/unread-count -> net::ERR_ABORTED
[2026-06-27T01:20:55.829Z] requestfailed: GET http://localhost:5173/api/messages/interventions/history?limit=6 -> net::ERR_ABORTED
[2026-06-27T01:20:55.829Z] requestfailed: GET http://localhost:5173/api/cohorts/school-students -> net::ERR_ABORTED
[2026-06-27T01:20:55.829Z] requestfailed: GET http://localhost:5173/api/cohorts -> net::ERR_ABORTED
[2026-06-27T01:20:55.829Z] requestfailed: GET http://localhost:5173/api/schools/cmquusyb500028o5yxl869rbp/students/at-risk -> net::ERR_ABORTED
[2026-06-27T01:20:55.829Z] requestfailed: GET http://localhost:5173/api/cohorts/school-students -> net::ERR_ABORTED
[2026-06-27T01:20:55.829Z] requestfailed: GET http://localhost:5173/api/messages/notifications -> net::ERR_ABORTED
```
  - Error: Onboarding goal screen did not appear after clearing school_onboarding_* localStorage keys
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-068-2026-06-27T01-02-47-356Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-02-45-287Z.zip
  - Console/Network Logs Snippet:

```text
[2026-06-27T01:02:47.289Z] requestfailed: GET http://localhost:5173/api/messages/notifications -> net::ERR_ABORTED
[2026-06-27T01:02:47.289Z] requestfailed: GET http://localhost:5173/api/messages/interventions/history?limit=6 -> net::ERR_ABORTED
[2026-06-27T01:02:47.289Z] requestfailed: GET http://localhost:5173/api/cohorts -> net::ERR_ABORTED
[2026-06-27T01:02:47.289Z] requestfailed: GET http://localhost:5173/api/cohorts/school-students -> net::ERR_ABORTED
[2026-06-27T01:02:47.289Z] requestfailed: GET http://localhost:5173/api/beneficiaries?status=APPROVED -> net::ERR_ABORTED
[2026-06-27T01:02:47.289Z] requestfailed: GET http://localhost:5173/api/cohorts/school-students -> net::ERR_ABORTED
[2026-06-27T01:02:47.289Z] requestfailed: GET http://localhost:5173/api/schools/cmquusyb500028o5yxl869rbp/students/at-risk -> net::ERR_ABORTED
[2026-06-27T01:02:47.289Z] requestfailed: GET http://localhost:5173/api/auth/me -> net::ERR_ABORTED
[2026-06-27T01:02:47.289Z] requestfailed: GET http://localhost:5173/api/schools/cmquusyb500028o5yxl869rbp/students/at-risk -> net::ERR_ABORTED
[2026-06-27T01:02:47.290Z] requestfailed: GET http://localhost:5173/api/auth/me -> net::ERR_ABORTED
[2026-06-27T01:02:47.290Z] requestfailed: GET http://localhost:5173/api/messages/notifications/unread-count -> net::ERR_ABORTED
```
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Onboarding goal screen did not appear after clearing school_onboarding_* localStorage keys
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-068-2026-06-26T23-22-14-596Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-26T23-22-09-525Z.zip
  - Console/Network Logs Snippet:

```text
[2026-06-26T23:22:14.534Z] requestfailed: GET http://localhost:5173/api/beneficiaries?status=APPROVED -> net::ERR_ABORTED
[2026-06-26T23:22:14.534Z] requestfailed: GET http://localhost:5173/api/auth/me -> net::ERR_ABORTED
[2026-06-26T23:22:14.534Z] requestfailed: GET http://localhost:5173/api/messages/notifications -> net::ERR_ABORTED
[2026-06-26T23:22:14.535Z] requestfailed: GET http://localhost:5173/api/messages/notifications/unread-count -> net::ERR_ABORTED
[2026-06-26T23:22:14.535Z] requestfailed: GET http://localhost:5173/api/cohorts/school-students -> net::ERR_ABORTED
[2026-06-26T23:22:14.536Z] requestfailed: GET http://localhost:5173/api/cohorts -> net::ERR_ABORTED
[2026-06-26T23:22:14.536Z] requestfailed: GET http://localhost:5173/api/cohorts -> net::ERR_ABORTED
[2026-06-26T23:22:14.536Z] requestfailed: GET http://localhost:5173/api/auth/me -> net::ERR_ABORTED
[2026-06-26T23:22:14.536Z] requestfailed: GET http://localhost:5173/api/schools/cmquusyb500028o5yxl869rbp/students/at-risk -> net::ERR_ABORTED
[2026-06-26T23:22:14.536Z] requestfailed: GET http://localhost:5173/api/cohorts/school-students -> net::ERR_ABORTED
[2026-06-26T23:22:14.536Z] requestfailed: GET http://localhost:5173/api/messages/interventions/history?limit=6 -> net::ERR_ABORTED
[2026-06-26T23:22:14.536Z] requestfailed: GET https://fonts.gstatic.com/s/ibmplexsans/v23/zYXzKVElMYYaJe8bpLHnCwDKr932-G7dytD-Dmu1syxeKYbSB4Zh.woff2 -> net::ERR_ABORTED
```
  - Error: Item was not executed due to unexpected suite interruption.
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
- [ ] Enter hours (e.g. 40) → Save → lands on Dashboard — PASS — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: This step depends on the onboarding card being active for the current school account.
  - Manual Step: Use a not-yet-onboarded school admin, advance the onboarding steps, and confirm the final action dismisses the card while keeping the user on Dashboard.
  - Reason: This step depends on the onboarding card being active for the current school account.
  - Manual Step: Use a not-yet-onboarded school admin, advance the onboarding steps, and confirm the final action dismisses the card while keeping the user on Dashboard.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: This step depends on the onboarding card being active for the current school account.
  - Manual Step: Use a not-yet-onboarded school admin, advance the onboarding steps, and confirm the final action dismisses the card while keeping the user on Dashboard.
  - Reason: This step depends on the onboarding card being active for the current school account.
  - Manual Step: Use a not-yet-onboarded school admin, advance the onboarding steps, and confirm the final action dismisses the card while keeping the user on Dashboard.
  - Reason: This step depends on the onboarding card being active for the current school account.
  - Manual Step: Use a not-yet-onboarded school admin, advance the onboarding steps, and confirm the final action dismisses the card while keeping the user on Dashboard.
  - Reason: This step depends on the onboarding card being active for the current school account.
  - Manual Step: Use a not-yet-onboarded school admin, advance the onboarding steps, and confirm the final action dismisses the card while keeping the user on Dashboard.
  - Reason: This step depends on the onboarding card being active for the current school account.
  - Manual Step: Use a not-yet-onboarded school admin, advance the onboarding steps, and confirm the final action dismisses the card while keeping the user on Dashboard.
  - Reason: This step depends on the onboarding card being active for the current school account.
  - Manual Step: Use a not-yet-onboarded school admin, advance the onboarding steps, and confirm the final action dismisses the card while keeping the user on Dashboard.
  - Reason: This step depends on the onboarding card being active for the current school account.
  - Manual Step: Use a not-yet-onboarded school admin, advance the onboarding steps, and confirm the final action dismisses the card while keeping the user on Dashboard.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: This step depends on the onboarding card being active for the current school account.
  - Manual Step: Use a not-yet-onboarded school admin, advance the onboarding steps, and confirm the final action dismisses the card while keeping the user on Dashboard.
  - Reason: This step depends on the onboarding card being active for the current school account.
  - Manual Step: Use a not-yet-onboarded school admin, advance the onboarding steps, and confirm the final action dismisses the card while keeping the user on Dashboard.
  - Reason: This step depends on the onboarding card being active for the current school account.
  - Manual Step: Use a not-yet-onboarded school admin, advance the onboarding steps, and confirm the final action dismisses the card while keeping the user on Dashboard.
  - Reason: This step depends on the onboarding card being active for the current school account.
  - Manual Step: Use a not-yet-onboarded school admin, advance the onboarding steps, and confirm the final action dismisses the card while keeping the user on Dashboard.
  - Reason: This step depends on the onboarding card being active for the current school account.
  - Manual Step: Use a not-yet-onboarded school admin, advance the onboarding steps, and confirm the final action dismisses the card while keeping the user on Dashboard.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: This step depends on the onboarding card being active for the current school account.
  - Manual Step: Use a not-yet-onboarded school admin, advance the onboarding steps, and confirm the final action dismisses the card while keeping the user on Dashboard.
  - Reason: This step depends on the onboarding card being active for the current school account.
  - Manual Step: Use a not-yet-onboarded school admin, advance the onboarding steps, and confirm the final action dismisses the card while keeping the user on Dashboard.
  - Reason: This step depends on the onboarding card being active for the current school account.
  - Manual Step: Use a not-yet-onboarded school admin, advance the onboarding steps, and confirm the final action dismisses the card while keeping the user on Dashboard.
  - Reason: This step depends on the onboarding card being active for the current school account.
  - Manual Step: Use a not-yet-onboarded school admin, advance the onboarding steps, and confirm the final action dismisses the card while keeping the user on Dashboard.
  - Reason: This step depends on the onboarding card being active for the current school account.
  - Manual Step: Use a not-yet-onboarded school admin, advance the onboarding steps, and confirm the final action dismisses the card while keeping the user on Dashboard.
  - Error: Continue to Dashboard button not present for onboarding step
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-069-2026-06-27T01-27-26-183Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-27-24-182Z.zip
  - Error: Continue to Dashboard button not present for onboarding step
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-069-2026-06-27T01-20-55-959Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-20-54-000Z.zip
  - Error: Continue to Dashboard button not present for onboarding step
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-069-2026-06-27T01-02-47-413Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-02-45-287Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Continue to Dashboard button not present for onboarding step
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-069-2026-06-26T23-22-17-411Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-26T23-22-09-525Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Continue to Dashboard button not present for onboarding step
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-069-2026-05-18T13-49-24-133Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-05-18T13-49-22-197Z.zip

### 4b · Dashboard
- [ ] School stats: Total Students, Total Hours, Goal Completion %, At Risk count — PASS — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — PASS — PASS — FAIL — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — PASS — PASS
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Dashboard stat missing: Total Students
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-070-2026-06-27T01-57-26-242Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-57-23-642Z.zip
  - Error: Dashboard stat missing: Total Students
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-070-2026-06-27T01-47-27-211Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-47-24-871Z.zip
  - Error: Dashboard stat missing: Total Students
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-070-2026-06-27T01-35-04-426Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-35-02-748Z.zip
  - Error: Dashboard stat missing: Total Students
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-070-2026-06-27T01-27-26-256Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-27-24-182Z.zip
  - Error: Dashboard stat missing: Total Students
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-070-2026-06-27T01-20-56-023Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-20-54-000Z.zip
  - Error: Dashboard stat missing: Total Students
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-070-2026-06-27T01-02-47-482Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-02-45-287Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Dashboard stat missing: Total Students
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-070-2026-06-26T23-22-17-473Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-26T23-22-09-525Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Dashboard stat missing: Total Students
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-070-2026-05-18T13-49-24-231Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-05-18T13-49-22-197Z.zip
- [ ] Classroom grid shows each classroom with: student count, completion count, at-risk count, invite code — PASS — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — FAIL — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — PASS — PASS
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Classroom grid section missing
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-071-2026-06-27T01-27-26-323Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-27-24-182Z.zip
  - Error: Classroom grid section missing
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-071-2026-06-27T01-20-56-093Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-20-54-000Z.zip
  - Error: Classroom grid section missing
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-071-2026-06-27T01-02-47-548Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-02-45-287Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Classroom grid section missing
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-071-2026-06-26T23-22-17-538Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-26T23-22-09-525Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Classroom grid section missing
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-071-2026-05-18T13-49-24-330Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-05-18T13-49-22-197Z.zip
- [ ] **Copy invite code** · Click copy button → clipboard contains the code — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Invite-code copy is no longer exposed as a dashboard-level control in the current cohort-centric school UI.
  - Manual Step: Open a cohort management surface that exposes invite codes, click copy there, and confirm the clipboard contains the cohort/classroom code.
  - Reason: Invite-code copy is no longer exposed as a dashboard-level control in the current cohort-centric school UI.
  - Manual Step: Open a cohort management surface that exposes invite codes, click copy there, and confirm the clipboard contains the cohort/classroom code.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Invite-code copy is no longer exposed as a dashboard-level control in the current cohort-centric school UI.
  - Manual Step: Open a cohort management surface that exposes invite codes, click copy there, and confirm the clipboard contains the cohort/classroom code.
  - Reason: Invite-code copy is no longer exposed as a dashboard-level control in the current cohort-centric school UI.
  - Manual Step: Open a cohort management surface that exposes invite codes, click copy there, and confirm the clipboard contains the cohort/classroom code.
  - Reason: Invite-code copy is no longer exposed as a dashboard-level control in the current cohort-centric school UI.
  - Manual Step: Open a cohort management surface that exposes invite codes, click copy there, and confirm the clipboard contains the cohort/classroom code.
  - Reason: Invite-code copy is no longer exposed as a dashboard-level control in the current cohort-centric school UI.
  - Manual Step: Open a cohort management surface that exposes invite codes, click copy there, and confirm the clipboard contains the cohort/classroom code.
  - Reason: Invite-code copy is no longer exposed as a dashboard-level control in the current cohort-centric school UI.
  - Manual Step: Open a cohort management surface that exposes invite codes, click copy there, and confirm the clipboard contains the cohort/classroom code.
  - Reason: Invite-code copy is no longer exposed as a dashboard-level control in the current cohort-centric school UI.
  - Manual Step: Open a cohort management surface that exposes invite codes, click copy there, and confirm the clipboard contains the cohort/classroom code.
  - Reason: Invite-code copy is no longer exposed as a dashboard-level control in the current cohort-centric school UI.
  - Manual Step: Open a cohort management surface that exposes invite codes, click copy there, and confirm the clipboard contains the cohort/classroom code.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Invite-code copy is no longer exposed as a dashboard-level control in the current cohort-centric school UI.
  - Manual Step: Open a cohort management surface that exposes invite codes, click copy there, and confirm the clipboard contains the cohort/classroom code.
  - Reason: Invite-code copy is no longer exposed as a dashboard-level control in the current cohort-centric school UI.
  - Manual Step: Open a cohort management surface that exposes invite codes, click copy there, and confirm the clipboard contains the cohort/classroom code.
  - Reason: Invite-code copy is no longer exposed as a dashboard-level control in the current cohort-centric school UI.
  - Manual Step: Open a cohort management surface that exposes invite codes, click copy there, and confirm the clipboard contains the cohort/classroom code.
  - Reason: Invite-code copy is no longer exposed as a dashboard-level control in the current cohort-centric school UI.
  - Manual Step: Open a cohort management surface that exposes invite codes, click copy there, and confirm the clipboard contains the cohort/classroom code.
  - Reason: Invite-code copy is no longer exposed as a dashboard-level control in the current cohort-centric school UI.
  - Manual Step: Open a cohort management surface that exposes invite codes, click copy there, and confirm the clipboard contains the cohort/classroom code.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Invite-code copy is no longer exposed as a dashboard-level control in the current cohort-centric school UI.
  - Manual Step: Open a cohort management surface that exposes invite codes, click copy there, and confirm the clipboard contains the cohort/classroom code.
  - Reason: Invite-code copy is no longer exposed as a dashboard-level control in the current cohort-centric school UI.
  - Manual Step: Open a cohort management surface that exposes invite codes, click copy there, and confirm the clipboard contains the cohort/classroom code.
  - Reason: Invite-code copy is no longer exposed as a dashboard-level control in the current cohort-centric school UI.
  - Manual Step: Open a cohort management surface that exposes invite codes, click copy there, and confirm the clipboard contains the cohort/classroom code.
  - Reason: Invite-code copy is no longer exposed as a dashboard-level control in the current cohort-centric school UI.
  - Manual Step: Open a cohort management surface that exposes invite codes, click copy there, and confirm the clipboard contains the cohort/classroom code.
  - Reason: Invite-code copy is no longer exposed as a dashboard-level control in the current cohort-centric school UI.
  - Manual Step: Open a cohort management surface that exposes invite codes, click copy there, and confirm the clipboard contains the cohort/classroom code.
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^Copy$/i }).first()[22m

  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-072-2026-06-27T01-27-41-397Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-27-24-182Z.zip
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^Copy$/i }).first()[22m

  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-072-2026-06-27T01-21-11-164Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-20-54-000Z.zip
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^Copy$/i }).first()[22m

  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-072-2026-06-27T01-03-02-621Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-02-45-287Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^Copy$/i }).first()[22m

  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-072-2026-06-26T23-22-32-608Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-26T23-22-09-525Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^Copy$/i }).first()[22m

  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-072-2026-05-18T13-49-39-418Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-05-18T13-49-22-197Z.zip
  - Reason: Clipboard API read is unavailable in this run environment.
  - Manual Step: Click copy invite code and manually paste to verify copied code is correct.
- [ ] **Org requests** · Org request from 3f appears in "Pending Requests" → Approve it — PASS — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: The old inline dashboard "Pending Requests" queue is not present in the current school dashboard.
  - Manual Step: Validate partner approval through the current beneficiary/partner workflow using a school account that has a pending request.
  - Reason: The old inline dashboard "Pending Requests" queue is not present in the current school dashboard.
  - Manual Step: Validate partner approval through the current beneficiary/partner workflow using a school account that has a pending request.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The old inline dashboard "Pending Requests" queue is not present in the current school dashboard.
  - Manual Step: Validate partner approval through the current beneficiary/partner workflow using a school account that has a pending request.
  - Reason: The old inline dashboard "Pending Requests" queue is not present in the current school dashboard.
  - Manual Step: Validate partner approval through the current beneficiary/partner workflow using a school account that has a pending request.
  - Reason: The old inline dashboard "Pending Requests" queue is not present in the current school dashboard.
  - Manual Step: Validate partner approval through the current beneficiary/partner workflow using a school account that has a pending request.
  - Reason: The old inline dashboard "Pending Requests" queue is not present in the current school dashboard.
  - Manual Step: Validate partner approval through the current beneficiary/partner workflow using a school account that has a pending request.
  - Reason: The old inline dashboard "Pending Requests" queue is not present in the current school dashboard.
  - Manual Step: Validate partner approval through the current beneficiary/partner workflow using a school account that has a pending request.
  - Reason: The old inline dashboard "Pending Requests" queue is not present in the current school dashboard.
  - Manual Step: Validate partner approval through the current beneficiary/partner workflow using a school account that has a pending request.
  - Reason: The old inline dashboard "Pending Requests" queue is not present in the current school dashboard.
  - Manual Step: Validate partner approval through the current beneficiary/partner workflow using a school account that has a pending request.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The old inline dashboard "Pending Requests" queue is not present in the current school dashboard.
  - Manual Step: Validate partner approval through the current beneficiary/partner workflow using a school account that has a pending request.
  - Reason: The old inline dashboard "Pending Requests" queue is not present in the current school dashboard.
  - Manual Step: Validate partner approval through the current beneficiary/partner workflow using a school account that has a pending request.
  - Reason: The old inline dashboard "Pending Requests" queue is not present in the current school dashboard.
  - Manual Step: Validate partner approval through the current beneficiary/partner workflow using a school account that has a pending request.
  - Reason: The old inline dashboard "Pending Requests" queue is not present in the current school dashboard.
  - Manual Step: Validate partner approval through the current beneficiary/partner workflow using a school account that has a pending request.
  - Reason: The old inline dashboard "Pending Requests" queue is not present in the current school dashboard.
  - Manual Step: Validate partner approval through the current beneficiary/partner workflow using a school account that has a pending request.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The old inline dashboard "Pending Requests" queue is not present in the current school dashboard.
  - Manual Step: Validate partner approval through the current beneficiary/partner workflow using a school account that has a pending request.
  - Reason: The old inline dashboard "Pending Requests" queue is not present in the current school dashboard.
  - Manual Step: Validate partner approval through the current beneficiary/partner workflow using a school account that has a pending request.
  - Reason: The old inline dashboard "Pending Requests" queue is not present in the current school dashboard.
  - Manual Step: Validate partner approval through the current beneficiary/partner workflow using a school account that has a pending request.
  - Reason: The old inline dashboard "Pending Requests" queue is not present in the current school dashboard.
  - Manual Step: Validate partner approval through the current beneficiary/partner workflow using a school account that has a pending request.
  - Reason: The old inline dashboard "Pending Requests" queue is not present in the current school dashboard.
  - Manual Step: Validate partner approval through the current beneficiary/partner workflow using a school account that has a pending request.
  - Error: No pending org request found to approve from step 3f
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-073-2026-06-27T01-27-41-493Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-27-24-182Z.zip
  - Error: No pending org request found to approve from step 3f
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-073-2026-06-27T01-21-11-261Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-20-54-000Z.zip
  - Error: No pending org request found to approve from step 3f
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-073-2026-06-27T01-03-02-720Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-02-45-287Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: No pending org request found to approve from step 3f
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-073-2026-06-26T23-22-32-693Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-26T23-22-09-525Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: No pending org request found to approve from step 3f
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-073-2026-05-18T13-49-39-532Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-05-18T13-49-22-197Z.zip
  _Expect: org status → APPROVED; org receives notification_
- [ ] **Reject org** · Reject a different pending org → status → REJECTED — PASS — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Inline dashboard rejection of partner requests is no longer exposed on the current school dashboard.
  - Manual Step: Use the current partner-management flow to reject a pending request and confirm the status becomes REJECTED.
  - Reason: Inline dashboard rejection of partner requests is no longer exposed on the current school dashboard.
  - Manual Step: Use the current partner-management flow to reject a pending request and confirm the status becomes REJECTED.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Inline dashboard rejection of partner requests is no longer exposed on the current school dashboard.
  - Manual Step: Use the current partner-management flow to reject a pending request and confirm the status becomes REJECTED.
  - Reason: Inline dashboard rejection of partner requests is no longer exposed on the current school dashboard.
  - Manual Step: Use the current partner-management flow to reject a pending request and confirm the status becomes REJECTED.
  - Reason: Inline dashboard rejection of partner requests is no longer exposed on the current school dashboard.
  - Manual Step: Use the current partner-management flow to reject a pending request and confirm the status becomes REJECTED.
  - Reason: Inline dashboard rejection of partner requests is no longer exposed on the current school dashboard.
  - Manual Step: Use the current partner-management flow to reject a pending request and confirm the status becomes REJECTED.
  - Reason: Inline dashboard rejection of partner requests is no longer exposed on the current school dashboard.
  - Manual Step: Use the current partner-management flow to reject a pending request and confirm the status becomes REJECTED.
  - Reason: Inline dashboard rejection of partner requests is no longer exposed on the current school dashboard.
  - Manual Step: Use the current partner-management flow to reject a pending request and confirm the status becomes REJECTED.
  - Reason: Inline dashboard rejection of partner requests is no longer exposed on the current school dashboard.
  - Manual Step: Use the current partner-management flow to reject a pending request and confirm the status becomes REJECTED.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Inline dashboard rejection of partner requests is no longer exposed on the current school dashboard.
  - Manual Step: Use the current partner-management flow to reject a pending request and confirm the status becomes REJECTED.
  - Reason: Inline dashboard rejection of partner requests is no longer exposed on the current school dashboard.
  - Manual Step: Use the current partner-management flow to reject a pending request and confirm the status becomes REJECTED.
  - Reason: Inline dashboard rejection of partner requests is no longer exposed on the current school dashboard.
  - Manual Step: Use the current partner-management flow to reject a pending request and confirm the status becomes REJECTED.
  - Reason: Inline dashboard rejection of partner requests is no longer exposed on the current school dashboard.
  - Manual Step: Use the current partner-management flow to reject a pending request and confirm the status becomes REJECTED.
  - Reason: Inline dashboard rejection of partner requests is no longer exposed on the current school dashboard.
  - Manual Step: Use the current partner-management flow to reject a pending request and confirm the status becomes REJECTED.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Inline dashboard rejection of partner requests is no longer exposed on the current school dashboard.
  - Manual Step: Use the current partner-management flow to reject a pending request and confirm the status becomes REJECTED.
  - Reason: Inline dashboard rejection of partner requests is no longer exposed on the current school dashboard.
  - Manual Step: Use the current partner-management flow to reject a pending request and confirm the status becomes REJECTED.
  - Reason: Inline dashboard rejection of partner requests is no longer exposed on the current school dashboard.
  - Manual Step: Use the current partner-management flow to reject a pending request and confirm the status becomes REJECTED.
  - Reason: Inline dashboard rejection of partner requests is no longer exposed on the current school dashboard.
  - Manual Step: Use the current partner-management flow to reject a pending request and confirm the status becomes REJECTED.
  - Reason: Inline dashboard rejection of partner requests is no longer exposed on the current school dashboard.
  - Manual Step: Use the current partner-management flow to reject a pending request and confirm the status becomes REJECTED.
  - Error: No second pending org request found to reject
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-074-2026-06-27T01-27-41-553Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-27-24-182Z.zip
  - Error: No second pending org request found to reject
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-074-2026-06-27T01-21-11-321Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-20-54-000Z.zip
  - Error: No second pending org request found to reject
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-074-2026-06-27T01-03-02-780Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-02-45-287Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: No second pending org request found to reject
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-074-2026-06-26T23-22-32-754Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-26T23-22-09-525Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: No second pending org request found to reject
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-074-2026-05-18T13-49-39-632Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-05-18T13-49-22-197Z.zip
- [ ] **Block org** · Block an approved org → confirmation modal → blocked; org disappears from approved list — PASS — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Blocking an approved partner is no longer handled from the old dashboard list the audit expected.
  - Manual Step: Use the current partner-management flow to block an approved partner and confirm it no longer appears as approved for the school.
  - Reason: Blocking an approved partner is no longer handled from the old dashboard list the audit expected.
  - Manual Step: Use the current partner-management flow to block an approved partner and confirm it no longer appears as approved for the school.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Blocking an approved partner is no longer handled from the old dashboard list the audit expected.
  - Manual Step: Use the current partner-management flow to block an approved partner and confirm it no longer appears as approved for the school.
  - Reason: Blocking an approved partner is no longer handled from the old dashboard list the audit expected.
  - Manual Step: Use the current partner-management flow to block an approved partner and confirm it no longer appears as approved for the school.
  - Reason: Blocking an approved partner is no longer handled from the old dashboard list the audit expected.
  - Manual Step: Use the current partner-management flow to block an approved partner and confirm it no longer appears as approved for the school.
  - Reason: Blocking an approved partner is no longer handled from the old dashboard list the audit expected.
  - Manual Step: Use the current partner-management flow to block an approved partner and confirm it no longer appears as approved for the school.
  - Reason: Blocking an approved partner is no longer handled from the old dashboard list the audit expected.
  - Manual Step: Use the current partner-management flow to block an approved partner and confirm it no longer appears as approved for the school.
  - Reason: Blocking an approved partner is no longer handled from the old dashboard list the audit expected.
  - Manual Step: Use the current partner-management flow to block an approved partner and confirm it no longer appears as approved for the school.
  - Reason: Blocking an approved partner is no longer handled from the old dashboard list the audit expected.
  - Manual Step: Use the current partner-management flow to block an approved partner and confirm it no longer appears as approved for the school.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Blocking an approved partner is no longer handled from the old dashboard list the audit expected.
  - Manual Step: Use the current partner-management flow to block an approved partner and confirm it no longer appears as approved for the school.
  - Reason: Blocking an approved partner is no longer handled from the old dashboard list the audit expected.
  - Manual Step: Use the current partner-management flow to block an approved partner and confirm it no longer appears as approved for the school.
  - Reason: Blocking an approved partner is no longer handled from the old dashboard list the audit expected.
  - Manual Step: Use the current partner-management flow to block an approved partner and confirm it no longer appears as approved for the school.
  - Reason: Blocking an approved partner is no longer handled from the old dashboard list the audit expected.
  - Manual Step: Use the current partner-management flow to block an approved partner and confirm it no longer appears as approved for the school.
  - Reason: Blocking an approved partner is no longer handled from the old dashboard list the audit expected.
  - Manual Step: Use the current partner-management flow to block an approved partner and confirm it no longer appears as approved for the school.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Blocking an approved partner is no longer handled from the old dashboard list the audit expected.
  - Manual Step: Use the current partner-management flow to block an approved partner and confirm it no longer appears as approved for the school.
  - Reason: Blocking an approved partner is no longer handled from the old dashboard list the audit expected.
  - Manual Step: Use the current partner-management flow to block an approved partner and confirm it no longer appears as approved for the school.
  - Reason: Blocking an approved partner is no longer handled from the old dashboard list the audit expected.
  - Manual Step: Use the current partner-management flow to block an approved partner and confirm it no longer appears as approved for the school.
  - Reason: Blocking an approved partner is no longer handled from the old dashboard list the audit expected.
  - Manual Step: Use the current partner-management flow to block an approved partner and confirm it no longer appears as approved for the school.
  - Reason: Blocking an approved partner is no longer handled from the old dashboard list the audit expected.
  - Manual Step: Use the current partner-management flow to block an approved partner and confirm it no longer appears as approved for the school.
  - Error: No approved org available to block
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-075-2026-06-27T01-27-41-620Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-27-24-182Z.zip
  - Error: No approved org available to block
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-075-2026-06-27T01-21-11-387Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-20-54-000Z.zip
  - Error: No approved org available to block
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-075-2026-06-27T01-03-02-848Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-02-45-287Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: No approved org available to block
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-075-2026-06-26T23-22-32-821Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-26T23-22-09-525Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: No approved org available to block
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-075-2026-05-18T13-49-39-733Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-05-18T13-49-22-197Z.zip

### 4c · Groups (Student Management)
- [ ] Left sidebar shows "All Students" + individual classrooms — PASS — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — FAIL — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — PASS — PASS
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: All Students sidebar entry missing
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-076-2026-06-27T01-27-42-304Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-27-24-182Z.zip
  - Error: All Students sidebar entry missing
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-076-2026-06-27T01-21-12-083Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-20-54-000Z.zip
  - Error: All Students sidebar entry missing
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-076-2026-06-27T01-03-03-544Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-02-45-287Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: All Students sidebar entry missing
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-076-2026-06-26T23-22-33-505Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-26T23-22-09-525Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: All Students sidebar entry missing
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-076-2026-05-18T13-49-40-518Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-05-18T13-49-22-197Z.zip
  - Console/Network Logs Snippet:

```text
[2026-05-18T13:49:39.995Z] console.error: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. /cohorts
[2026-05-18T13:49:40.001Z] console.error: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. /cohorts
```
- [ ] **Search** · Type student name → list filters — PASS — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Dashboard-level student search has moved into the dedicated `/students` workflow.
  - Manual Step: Open `/students`, search for a student by name, and confirm the roster filters to matching rows.
  - Reason: Dashboard-level student search has moved into the dedicated `/students` workflow.
  - Manual Step: Open `/students`, search for a student by name, and confirm the roster filters to matching rows.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Dashboard-level student search has moved into the dedicated `/students` workflow.
  - Manual Step: Open `/students`, search for a student by name, and confirm the roster filters to matching rows.
  - Reason: Dashboard-level student search has moved into the dedicated `/students` workflow.
  - Manual Step: Open `/students`, search for a student by name, and confirm the roster filters to matching rows.
  - Reason: Dashboard-level student search has moved into the dedicated `/students` workflow.
  - Manual Step: Open `/students`, search for a student by name, and confirm the roster filters to matching rows.
  - Reason: Dashboard-level student search has moved into the dedicated `/students` workflow.
  - Manual Step: Open `/students`, search for a student by name, and confirm the roster filters to matching rows.
  - Reason: Dashboard-level student search has moved into the dedicated `/students` workflow.
  - Manual Step: Open `/students`, search for a student by name, and confirm the roster filters to matching rows.
  - Reason: Dashboard-level student search has moved into the dedicated `/students` workflow.
  - Manual Step: Open `/students`, search for a student by name, and confirm the roster filters to matching rows.
  - Reason: Dashboard-level student search has moved into the dedicated `/students` workflow.
  - Manual Step: Open `/students`, search for a student by name, and confirm the roster filters to matching rows.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Dashboard-level student search has moved into the dedicated `/students` workflow.
  - Manual Step: Open `/students`, search for a student by name, and confirm the roster filters to matching rows.
  - Reason: Dashboard-level student search has moved into the dedicated `/students` workflow.
  - Manual Step: Open `/students`, search for a student by name, and confirm the roster filters to matching rows.
  - Reason: Dashboard-level student search has moved into the dedicated `/students` workflow.
  - Manual Step: Open `/students`, search for a student by name, and confirm the roster filters to matching rows.
  - Reason: Dashboard-level student search has moved into the dedicated `/students` workflow.
  - Manual Step: Open `/students`, search for a student by name, and confirm the roster filters to matching rows.
  - Reason: Dashboard-level student search has moved into the dedicated `/students` workflow.
  - Manual Step: Open `/students`, search for a student by name, and confirm the roster filters to matching rows.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Dashboard-level student search has moved into the dedicated `/students` workflow.
  - Manual Step: Open `/students`, search for a student by name, and confirm the roster filters to matching rows.
  - Reason: Dashboard-level student search has moved into the dedicated `/students` workflow.
  - Manual Step: Open `/students`, search for a student by name, and confirm the roster filters to matching rows.
  - Reason: Dashboard-level student search has moved into the dedicated `/students` workflow.
  - Manual Step: Open `/students`, search for a student by name, and confirm the roster filters to matching rows.
  - Reason: Dashboard-level student search has moved into the dedicated `/students` workflow.
  - Manual Step: Open `/students`, search for a student by name, and confirm the roster filters to matching rows.
  - Reason: Dashboard-level student search has moved into the dedicated `/students` workflow.
  - Manual Step: Open `/students`, search for a student by name, and confirm the roster filters to matching rows.
  - Error: Student search input missing
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-077-2026-06-27T01-27-42-374Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-27-24-182Z.zip
  - Error: Student search input missing
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-077-2026-06-27T01-21-12-158Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-20-54-000Z.zip
  - Error: Student search input missing
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-077-2026-06-27T01-03-03-619Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-02-45-287Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Student search input missing
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-077-2026-06-26T23-22-33-579Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-26T23-22-09-525Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Student search input missing
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-077-2026-05-18T13-49-40-619Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-05-18T13-49-22-197Z.zip
- [ ] **Filter: Completed** · Shows only students at/above goal — PASS — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Completion-status filtering now lives in the dedicated `/students` triage/roster workflow instead of dashboard buttons.
  - Manual Step: Open `/students`, apply the Completed view/filter, and confirm only completed students remain visible.
  - Reason: Completion-status filtering now lives in the dedicated `/students` triage/roster workflow instead of dashboard buttons.
  - Manual Step: Open `/students`, apply the Completed view/filter, and confirm only completed students remain visible.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Completion-status filtering now lives in the dedicated `/students` triage/roster workflow instead of dashboard buttons.
  - Manual Step: Open `/students`, apply the Completed view/filter, and confirm only completed students remain visible.
  - Reason: Completion-status filtering now lives in the dedicated `/students` triage/roster workflow instead of dashboard buttons.
  - Manual Step: Open `/students`, apply the Completed view/filter, and confirm only completed students remain visible.
  - Reason: Completion-status filtering now lives in the dedicated `/students` triage/roster workflow instead of dashboard buttons.
  - Manual Step: Open `/students`, apply the Completed view/filter, and confirm only completed students remain visible.
  - Reason: Completion-status filtering now lives in the dedicated `/students` triage/roster workflow instead of dashboard buttons.
  - Manual Step: Open `/students`, apply the Completed view/filter, and confirm only completed students remain visible.
  - Reason: Completion-status filtering now lives in the dedicated `/students` triage/roster workflow instead of dashboard buttons.
  - Manual Step: Open `/students`, apply the Completed view/filter, and confirm only completed students remain visible.
  - Reason: Completion-status filtering now lives in the dedicated `/students` triage/roster workflow instead of dashboard buttons.
  - Manual Step: Open `/students`, apply the Completed view/filter, and confirm only completed students remain visible.
  - Reason: Completion-status filtering now lives in the dedicated `/students` triage/roster workflow instead of dashboard buttons.
  - Manual Step: Open `/students`, apply the Completed view/filter, and confirm only completed students remain visible.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Completion-status filtering now lives in the dedicated `/students` triage/roster workflow instead of dashboard buttons.
  - Manual Step: Open `/students`, apply the Completed view/filter, and confirm only completed students remain visible.
  - Reason: Completion-status filtering now lives in the dedicated `/students` triage/roster workflow instead of dashboard buttons.
  - Manual Step: Open `/students`, apply the Completed view/filter, and confirm only completed students remain visible.
  - Reason: Completion-status filtering now lives in the dedicated `/students` triage/roster workflow instead of dashboard buttons.
  - Manual Step: Open `/students`, apply the Completed view/filter, and confirm only completed students remain visible.
  - Reason: Completion-status filtering now lives in the dedicated `/students` triage/roster workflow instead of dashboard buttons.
  - Manual Step: Open `/students`, apply the Completed view/filter, and confirm only completed students remain visible.
  - Reason: Completion-status filtering now lives in the dedicated `/students` triage/roster workflow instead of dashboard buttons.
  - Manual Step: Open `/students`, apply the Completed view/filter, and confirm only completed students remain visible.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Completion-status filtering now lives in the dedicated `/students` triage/roster workflow instead of dashboard buttons.
  - Manual Step: Open `/students`, apply the Completed view/filter, and confirm only completed students remain visible.
  - Reason: Completion-status filtering now lives in the dedicated `/students` triage/roster workflow instead of dashboard buttons.
  - Manual Step: Open `/students`, apply the Completed view/filter, and confirm only completed students remain visible.
  - Reason: Completion-status filtering now lives in the dedicated `/students` triage/roster workflow instead of dashboard buttons.
  - Manual Step: Open `/students`, apply the Completed view/filter, and confirm only completed students remain visible.
  - Reason: Completion-status filtering now lives in the dedicated `/students` triage/roster workflow instead of dashboard buttons.
  - Manual Step: Open `/students`, apply the Completed view/filter, and confirm only completed students remain visible.
  - Reason: Completion-status filtering now lives in the dedicated `/students` triage/roster workflow instead of dashboard buttons.
  - Manual Step: Open `/students`, apply the Completed view/filter, and confirm only completed students remain visible.
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /Completed/i })[22m

  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-078-2026-06-27T01-27-57-439Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-27-24-182Z.zip
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /Completed/i })[22m

  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-078-2026-06-27T01-21-27-226Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-20-54-000Z.zip
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /Completed/i })[22m

  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-078-2026-06-27T01-03-18-684Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-02-45-287Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /Completed/i })[22m

  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-078-2026-06-26T23-22-48-642Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-26T23-22-09-525Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /Completed/i })[22m

  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-078-2026-05-18T13-49-55-718Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-05-18T13-49-22-197Z.zip
- [ ] **Filter: At Risk** · Shows students with < 50% of goal — PASS — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: At-risk filtering now lives in the dedicated `/students` triage workflow instead of dashboard buttons.
  - Manual Step: Open `/students` or the intervention queue, apply the At Risk filter, and confirm only at-risk students remain visible.
  - Reason: At-risk filtering now lives in the dedicated `/students` triage workflow instead of dashboard buttons.
  - Manual Step: Open `/students` or the intervention queue, apply the At Risk filter, and confirm only at-risk students remain visible.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: At-risk filtering now lives in the dedicated `/students` triage workflow instead of dashboard buttons.
  - Manual Step: Open `/students` or the intervention queue, apply the At Risk filter, and confirm only at-risk students remain visible.
  - Reason: At-risk filtering now lives in the dedicated `/students` triage workflow instead of dashboard buttons.
  - Manual Step: Open `/students` or the intervention queue, apply the At Risk filter, and confirm only at-risk students remain visible.
  - Reason: At-risk filtering now lives in the dedicated `/students` triage workflow instead of dashboard buttons.
  - Manual Step: Open `/students` or the intervention queue, apply the At Risk filter, and confirm only at-risk students remain visible.
  - Reason: At-risk filtering now lives in the dedicated `/students` triage workflow instead of dashboard buttons.
  - Manual Step: Open `/students` or the intervention queue, apply the At Risk filter, and confirm only at-risk students remain visible.
  - Reason: At-risk filtering now lives in the dedicated `/students` triage workflow instead of dashboard buttons.
  - Manual Step: Open `/students` or the intervention queue, apply the At Risk filter, and confirm only at-risk students remain visible.
  - Reason: At-risk filtering now lives in the dedicated `/students` triage workflow instead of dashboard buttons.
  - Manual Step: Open `/students` or the intervention queue, apply the At Risk filter, and confirm only at-risk students remain visible.
  - Reason: At-risk filtering now lives in the dedicated `/students` triage workflow instead of dashboard buttons.
  - Manual Step: Open `/students` or the intervention queue, apply the At Risk filter, and confirm only at-risk students remain visible.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: At-risk filtering now lives in the dedicated `/students` triage workflow instead of dashboard buttons.
  - Manual Step: Open `/students` or the intervention queue, apply the At Risk filter, and confirm only at-risk students remain visible.
  - Reason: At-risk filtering now lives in the dedicated `/students` triage workflow instead of dashboard buttons.
  - Manual Step: Open `/students` or the intervention queue, apply the At Risk filter, and confirm only at-risk students remain visible.
  - Reason: At-risk filtering now lives in the dedicated `/students` triage workflow instead of dashboard buttons.
  - Manual Step: Open `/students` or the intervention queue, apply the At Risk filter, and confirm only at-risk students remain visible.
  - Reason: At-risk filtering now lives in the dedicated `/students` triage workflow instead of dashboard buttons.
  - Manual Step: Open `/students` or the intervention queue, apply the At Risk filter, and confirm only at-risk students remain visible.
  - Reason: At-risk filtering now lives in the dedicated `/students` triage workflow instead of dashboard buttons.
  - Manual Step: Open `/students` or the intervention queue, apply the At Risk filter, and confirm only at-risk students remain visible.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: At-risk filtering now lives in the dedicated `/students` triage workflow instead of dashboard buttons.
  - Manual Step: Open `/students` or the intervention queue, apply the At Risk filter, and confirm only at-risk students remain visible.
  - Reason: At-risk filtering now lives in the dedicated `/students` triage workflow instead of dashboard buttons.
  - Manual Step: Open `/students` or the intervention queue, apply the At Risk filter, and confirm only at-risk students remain visible.
  - Reason: At-risk filtering now lives in the dedicated `/students` triage workflow instead of dashboard buttons.
  - Manual Step: Open `/students` or the intervention queue, apply the At Risk filter, and confirm only at-risk students remain visible.
  - Reason: At-risk filtering now lives in the dedicated `/students` triage workflow instead of dashboard buttons.
  - Manual Step: Open `/students` or the intervention queue, apply the At Risk filter, and confirm only at-risk students remain visible.
  - Reason: At-risk filtering now lives in the dedicated `/students` triage workflow instead of dashboard buttons.
  - Manual Step: Open `/students` or the intervention queue, apply the At Risk filter, and confirm only at-risk students remain visible.
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^At Risk/i })[22m

  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-079-2026-06-27T01-28-12-529Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-27-24-182Z.zip
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^At Risk/i })[22m

  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-079-2026-06-27T01-21-42-330Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-20-54-000Z.zip
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^At Risk/i })[22m

  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-079-2026-06-27T01-03-33-790Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-02-45-287Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^At Risk/i })[22m

  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-079-2026-06-26T23-23-03-748Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-26T23-22-09-525Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^At Risk/i })[22m

  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-079-2026-05-18T13-50-10-838Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-05-18T13-49-22-197Z.zip
- [ ] **Filter: Not Started** · Shows 0-hour students — PASS — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Not-started filtering now lives in the dedicated `/students` workflow instead of dashboard buttons.
  - Manual Step: Open `/students`, apply the Not Started or zero-hours filter, and confirm only zero-hour students remain visible.
  - Reason: Not-started filtering now lives in the dedicated `/students` workflow instead of dashboard buttons.
  - Manual Step: Open `/students`, apply the Not Started or zero-hours filter, and confirm only zero-hour students remain visible.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Not-started filtering now lives in the dedicated `/students` workflow instead of dashboard buttons.
  - Manual Step: Open `/students`, apply the Not Started or zero-hours filter, and confirm only zero-hour students remain visible.
  - Reason: Not-started filtering now lives in the dedicated `/students` workflow instead of dashboard buttons.
  - Manual Step: Open `/students`, apply the Not Started or zero-hours filter, and confirm only zero-hour students remain visible.
  - Reason: Not-started filtering now lives in the dedicated `/students` workflow instead of dashboard buttons.
  - Manual Step: Open `/students`, apply the Not Started or zero-hours filter, and confirm only zero-hour students remain visible.
  - Reason: Not-started filtering now lives in the dedicated `/students` workflow instead of dashboard buttons.
  - Manual Step: Open `/students`, apply the Not Started or zero-hours filter, and confirm only zero-hour students remain visible.
  - Reason: Not-started filtering now lives in the dedicated `/students` workflow instead of dashboard buttons.
  - Manual Step: Open `/students`, apply the Not Started or zero-hours filter, and confirm only zero-hour students remain visible.
  - Reason: Not-started filtering now lives in the dedicated `/students` workflow instead of dashboard buttons.
  - Manual Step: Open `/students`, apply the Not Started or zero-hours filter, and confirm only zero-hour students remain visible.
  - Reason: Not-started filtering now lives in the dedicated `/students` workflow instead of dashboard buttons.
  - Manual Step: Open `/students`, apply the Not Started or zero-hours filter, and confirm only zero-hour students remain visible.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Not-started filtering now lives in the dedicated `/students` workflow instead of dashboard buttons.
  - Manual Step: Open `/students`, apply the Not Started or zero-hours filter, and confirm only zero-hour students remain visible.
  - Reason: Not-started filtering now lives in the dedicated `/students` workflow instead of dashboard buttons.
  - Manual Step: Open `/students`, apply the Not Started or zero-hours filter, and confirm only zero-hour students remain visible.
  - Reason: Not-started filtering now lives in the dedicated `/students` workflow instead of dashboard buttons.
  - Manual Step: Open `/students`, apply the Not Started or zero-hours filter, and confirm only zero-hour students remain visible.
  - Reason: Not-started filtering now lives in the dedicated `/students` workflow instead of dashboard buttons.
  - Manual Step: Open `/students`, apply the Not Started or zero-hours filter, and confirm only zero-hour students remain visible.
  - Reason: Not-started filtering now lives in the dedicated `/students` workflow instead of dashboard buttons.
  - Manual Step: Open `/students`, apply the Not Started or zero-hours filter, and confirm only zero-hour students remain visible.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Not-started filtering now lives in the dedicated `/students` workflow instead of dashboard buttons.
  - Manual Step: Open `/students`, apply the Not Started or zero-hours filter, and confirm only zero-hour students remain visible.
  - Reason: Not-started filtering now lives in the dedicated `/students` workflow instead of dashboard buttons.
  - Manual Step: Open `/students`, apply the Not Started or zero-hours filter, and confirm only zero-hour students remain visible.
  - Reason: Not-started filtering now lives in the dedicated `/students` workflow instead of dashboard buttons.
  - Manual Step: Open `/students`, apply the Not Started or zero-hours filter, and confirm only zero-hour students remain visible.
  - Reason: Not-started filtering now lives in the dedicated `/students` workflow instead of dashboard buttons.
  - Manual Step: Open `/students`, apply the Not Started or zero-hours filter, and confirm only zero-hour students remain visible.
  - Reason: Not-started filtering now lives in the dedicated `/students` workflow instead of dashboard buttons.
  - Manual Step: Open `/students`, apply the Not Started or zero-hours filter, and confirm only zero-hour students remain visible.
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /Not Started/i })[22m

  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-080-2026-06-27T01-28-27-635Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-27-24-182Z.zip
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /Not Started/i })[22m

  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-080-2026-06-27T01-21-57-428Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-20-54-000Z.zip
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /Not Started/i })[22m

  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-080-2026-06-27T01-03-48-889Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-02-45-287Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /Not Started/i })[22m

  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-080-2026-06-26T23-23-18-848Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-26T23-22-09-525Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /Not Started/i })[22m

  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-080-2026-05-18T13-50-25-957Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-05-18T13-49-22-197Z.zip
- [ ] **Select student** · Click a student → right panel shows name, email, hours progress bar, status badge — PASS — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — FAIL — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — PASS — PASS
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Student Roster preview did not include John Collander
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-081-2026-06-27T01-35-04-519Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-35-02-748Z.zip
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /All Students/i })[22m

  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-081-2026-06-27T01-28-57-762Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-27-24-182Z.zip
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /All Students/i })[22m

  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-081-2026-06-27T01-22-27-538Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-20-54-000Z.zip
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /All Students/i })[22m

  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-081-2026-06-27T01-04-19-001Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-02-45-287Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /All Students/i })[22m

  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-081-2026-06-26T23-23-48-957Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-26T23-22-09-525Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /All Students/i })[22m

  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-081-2026-05-18T13-50-56-079Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-05-18T13-49-22-197Z.zip
- [ ] **Send Reminder** · Opens compose window pre-filled with student as recipient — PASS — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — FAIL — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — PASS — PASS
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Send Reminder button not found
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-082-2026-06-27T01-28-57-864Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-27-24-182Z.zip
  - Error: Send Reminder button not found
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-082-2026-06-27T01-22-27-628Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-20-54-000Z.zip
  - Error: Send Reminder button not found
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-082-2026-06-27T01-04-19-120Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-02-45-287Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Send Reminder button not found
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-082-2026-06-26T23-23-49-062Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-26T23-22-09-525Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Send Reminder button not found
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-082-2026-05-18T13-50-56-205Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-05-18T13-49-22-197Z.zip
- [ ] **View Hour History** · Shows up to 5 sessions; each has date, opp, hours, status — PASS — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Inline dashboard hour-history panels were replaced by dedicated roster/student workflows.
  - Manual Step: Open a student from the current `/students` workflow and verify recent sessions/hour history render there.
  - Reason: Inline dashboard hour-history panels were replaced by dedicated roster/student workflows.
  - Manual Step: Open a student from the current `/students` workflow and verify recent sessions/hour history render there.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Inline dashboard hour-history panels were replaced by dedicated roster/student workflows.
  - Manual Step: Open a student from the current `/students` workflow and verify recent sessions/hour history render there.
  - Reason: Inline dashboard hour-history panels were replaced by dedicated roster/student workflows.
  - Manual Step: Open a student from the current `/students` workflow and verify recent sessions/hour history render there.
  - Reason: Inline dashboard hour-history panels were replaced by dedicated roster/student workflows.
  - Manual Step: Open a student from the current `/students` workflow and verify recent sessions/hour history render there.
  - Reason: Inline dashboard hour-history panels were replaced by dedicated roster/student workflows.
  - Manual Step: Open a student from the current `/students` workflow and verify recent sessions/hour history render there.
  - Reason: Inline dashboard hour-history panels were replaced by dedicated roster/student workflows.
  - Manual Step: Open a student from the current `/students` workflow and verify recent sessions/hour history render there.
  - Reason: Inline dashboard hour-history panels were replaced by dedicated roster/student workflows.
  - Manual Step: Open a student from the current `/students` workflow and verify recent sessions/hour history render there.
  - Reason: Inline dashboard hour-history panels were replaced by dedicated roster/student workflows.
  - Manual Step: Open a student from the current `/students` workflow and verify recent sessions/hour history render there.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Inline dashboard hour-history panels were replaced by dedicated roster/student workflows.
  - Manual Step: Open a student from the current `/students` workflow and verify recent sessions/hour history render there.
  - Reason: Inline dashboard hour-history panels were replaced by dedicated roster/student workflows.
  - Manual Step: Open a student from the current `/students` workflow and verify recent sessions/hour history render there.
  - Reason: Inline dashboard hour-history panels were replaced by dedicated roster/student workflows.
  - Manual Step: Open a student from the current `/students` workflow and verify recent sessions/hour history render there.
  - Reason: Inline dashboard hour-history panels were replaced by dedicated roster/student workflows.
  - Manual Step: Open a student from the current `/students` workflow and verify recent sessions/hour history render there.
  - Reason: Inline dashboard hour-history panels were replaced by dedicated roster/student workflows.
  - Manual Step: Open a student from the current `/students` workflow and verify recent sessions/hour history render there.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Inline dashboard hour-history panels were replaced by dedicated roster/student workflows.
  - Manual Step: Open a student from the current `/students` workflow and verify recent sessions/hour history render there.
  - Reason: Inline dashboard hour-history panels were replaced by dedicated roster/student workflows.
  - Manual Step: Open a student from the current `/students` workflow and verify recent sessions/hour history render there.
  - Reason: Inline dashboard hour-history panels were replaced by dedicated roster/student workflows.
  - Manual Step: Open a student from the current `/students` workflow and verify recent sessions/hour history render there.
  - Reason: Inline dashboard hour-history panels were replaced by dedicated roster/student workflows.
  - Manual Step: Open a student from the current `/students` workflow and verify recent sessions/hour history render there.
  - Reason: Inline dashboard hour-history panels were replaced by dedicated roster/student workflows.
  - Manual Step: Open a student from the current `/students` workflow and verify recent sessions/hour history render there.
  - Error: View Hour History control not found
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-083-2026-06-27T01-28-57-924Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-27-24-182Z.zip
  - Error: View Hour History control not found
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-083-2026-06-27T01-22-27-689Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-20-54-000Z.zip
  - Error: View Hour History control not found
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-083-2026-06-27T01-04-19-181Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-02-45-287Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: View Hour History control not found
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-083-2026-06-26T23-23-49-122Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-26T23-22-09-525Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: View Hour History control not found
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-083-2026-05-18T13-50-56-300Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-05-18T13-49-22-197Z.zip
- [ ] **Remove Hours** · On a VERIFIED session, click Remove → optionally enter reason → confirm — PASS — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Remove-hours actions are no longer exposed from the old inline dashboard panel this audit targeted.
  - Manual Step: Use the current student/session review workflow to remove approved hours and confirm totals and audit history update correctly.
  - Reason: Remove-hours actions are no longer exposed from the old inline dashboard panel this audit targeted.
  - Manual Step: Use the current student/session review workflow to remove approved hours and confirm totals and audit history update correctly.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Remove-hours actions are no longer exposed from the old inline dashboard panel this audit targeted.
  - Manual Step: Use the current student/session review workflow to remove approved hours and confirm totals and audit history update correctly.
  - Reason: Remove-hours actions are no longer exposed from the old inline dashboard panel this audit targeted.
  - Manual Step: Use the current student/session review workflow to remove approved hours and confirm totals and audit history update correctly.
  - Reason: Remove-hours actions are no longer exposed from the old inline dashboard panel this audit targeted.
  - Manual Step: Use the current student/session review workflow to remove approved hours and confirm totals and audit history update correctly.
  - Reason: Remove-hours actions are no longer exposed from the old inline dashboard panel this audit targeted.
  - Manual Step: Use the current student/session review workflow to remove approved hours and confirm totals and audit history update correctly.
  - Reason: Remove-hours actions are no longer exposed from the old inline dashboard panel this audit targeted.
  - Manual Step: Use the current student/session review workflow to remove approved hours and confirm totals and audit history update correctly.
  - Reason: Remove-hours actions are no longer exposed from the old inline dashboard panel this audit targeted.
  - Manual Step: Use the current student/session review workflow to remove approved hours and confirm totals and audit history update correctly.
  - Reason: Remove-hours actions are no longer exposed from the old inline dashboard panel this audit targeted.
  - Manual Step: Use the current student/session review workflow to remove approved hours and confirm totals and audit history update correctly.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Remove-hours actions are no longer exposed from the old inline dashboard panel this audit targeted.
  - Manual Step: Use the current student/session review workflow to remove approved hours and confirm totals and audit history update correctly.
  - Reason: Remove-hours actions are no longer exposed from the old inline dashboard panel this audit targeted.
  - Manual Step: Use the current student/session review workflow to remove approved hours and confirm totals and audit history update correctly.
  - Reason: Remove-hours actions are no longer exposed from the old inline dashboard panel this audit targeted.
  - Manual Step: Use the current student/session review workflow to remove approved hours and confirm totals and audit history update correctly.
  - Reason: Remove-hours actions are no longer exposed from the old inline dashboard panel this audit targeted.
  - Manual Step: Use the current student/session review workflow to remove approved hours and confirm totals and audit history update correctly.
  - Reason: Remove-hours actions are no longer exposed from the old inline dashboard panel this audit targeted.
  - Manual Step: Use the current student/session review workflow to remove approved hours and confirm totals and audit history update correctly.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Remove-hours actions are no longer exposed from the old inline dashboard panel this audit targeted.
  - Manual Step: Use the current student/session review workflow to remove approved hours and confirm totals and audit history update correctly.
  - Reason: Remove-hours actions are no longer exposed from the old inline dashboard panel this audit targeted.
  - Manual Step: Use the current student/session review workflow to remove approved hours and confirm totals and audit history update correctly.
  - Reason: Remove-hours actions are no longer exposed from the old inline dashboard panel this audit targeted.
  - Manual Step: Use the current student/session review workflow to remove approved hours and confirm totals and audit history update correctly.
  - Reason: Remove-hours actions are no longer exposed from the old inline dashboard panel this audit targeted.
  - Manual Step: Use the current student/session review workflow to remove approved hours and confirm totals and audit history update correctly.
  - Reason: Remove-hours actions are no longer exposed from the old inline dashboard panel this audit targeted.
  - Manual Step: Use the current student/session review workflow to remove approved hours and confirm totals and audit history update correctly.
  - Error: Remove Hours action not found on a VERIFIED session
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-084-2026-06-27T01-28-57-993Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-27-24-182Z.zip
  - Error: Remove Hours action not found on a VERIFIED session
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-084-2026-06-27T01-22-27-756Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-20-54-000Z.zip
  - Error: Remove Hours action not found on a VERIFIED session
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-084-2026-06-27T01-04-19-253Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-02-45-287Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Remove Hours action not found on a VERIFIED session
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-084-2026-06-26T23-23-49-189Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-26T23-22-09-525Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Remove Hours action not found on a VERIFIED session
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-084-2026-05-18T13-50-56-401Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-05-18T13-49-22-197Z.zip
  _Expect: session status → REJECTED; student receives email notification; school hours total decreases_

### 4d · Add Staff
- [ ] Click "Add Staff Member" → fill name, email, optional classroom → Submit — PASS — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: The old `/groups` staff-management surface targeted by this audit is no longer routed in the current school app, so this automation cannot reach the Add Staff modal through the live UI.
  - Manual Step: Expose the current staff-management route in navigation/router, then automate Add Staff Member creation against that mounted surface.
  - Reason: The old `/groups` staff-management surface targeted by this audit is no longer routed in the current school app, so this automation cannot reach the Add Staff modal through the live UI.
  - Manual Step: Expose the current staff-management route in navigation/router, then automate Add Staff Member creation against that mounted surface.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The old `/groups` staff-management surface targeted by this audit is no longer routed in the current school app, so this automation cannot reach the Add Staff modal through the live UI.
  - Manual Step: Expose the current staff-management route in navigation/router, then automate Add Staff Member creation against that mounted surface.
  - Reason: The old `/groups` staff-management surface targeted by this audit is no longer routed in the current school app, so this automation cannot reach the Add Staff modal through the live UI.
  - Manual Step: Expose the current staff-management route in navigation/router, then automate Add Staff Member creation against that mounted surface.
  - Reason: The old `/groups` staff-management surface targeted by this audit is no longer routed in the current school app, so this automation cannot reach the Add Staff modal through the live UI.
  - Manual Step: Expose the current staff-management route in navigation/router, then automate Add Staff Member creation against that mounted surface.
  - Reason: The old `/groups` staff-management surface targeted by this audit is no longer routed in the current school app, so this automation cannot reach the Add Staff modal through the live UI.
  - Manual Step: Expose the current staff-management route in navigation/router, then automate Add Staff Member creation against that mounted surface.
  - Reason: The old `/groups` staff-management surface targeted by this audit is no longer routed in the current school app, so this automation cannot reach the Add Staff modal through the live UI.
  - Manual Step: Expose the current staff-management route in navigation/router, then automate Add Staff Member creation against that mounted surface.
  - Reason: The old `/groups` staff-management surface targeted by this audit is no longer routed in the current school app, so this automation cannot reach the Add Staff modal through the live UI.
  - Manual Step: Expose the current staff-management route in navigation/router, then automate Add Staff Member creation against that mounted surface.
  - Reason: The old `/groups` staff-management surface targeted by this audit is no longer routed in the current school app, so this automation cannot reach the Add Staff modal through the live UI.
  - Manual Step: Expose the current staff-management route in navigation/router, then automate Add Staff Member creation against that mounted surface.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The old `/groups` staff-management surface targeted by this audit is no longer routed in the current school app, so this automation cannot reach the Add Staff modal through the live UI.
  - Manual Step: Expose the current staff-management route in navigation/router, then automate Add Staff Member creation against that mounted surface.
  - Reason: The old `/groups` staff-management surface targeted by this audit is no longer routed in the current school app, so this automation cannot reach the Add Staff modal through the live UI.
  - Manual Step: Expose the current staff-management route in navigation/router, then automate Add Staff Member creation against that mounted surface.
  - Reason: The old `/groups` staff-management surface targeted by this audit is no longer routed in the current school app, so this automation cannot reach the Add Staff modal through the live UI.
  - Manual Step: Expose the current staff-management route in navigation/router, then automate Add Staff Member creation against that mounted surface.
  - Reason: The old `/groups` staff-management surface targeted by this audit is no longer routed in the current school app, so this automation cannot reach the Add Staff modal through the live UI.
  - Manual Step: Expose the current staff-management route in navigation/router, then automate Add Staff Member creation against that mounted surface.
  - Reason: The old `/groups` staff-management surface targeted by this audit is no longer routed in the current school app, so this automation cannot reach the Add Staff modal through the live UI.
  - Manual Step: Expose the current staff-management route in navigation/router, then automate Add Staff Member creation against that mounted surface.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The old `/groups` staff-management surface targeted by this audit is no longer routed in the current school app, so this automation cannot reach the Add Staff modal through the live UI.
  - Manual Step: Expose the current staff-management route in navigation/router, then automate Add Staff Member creation against that mounted surface.
  - Reason: The old `/groups` staff-management surface targeted by this audit is no longer routed in the current school app, so this automation cannot reach the Add Staff modal through the live UI.
  - Manual Step: Expose the current staff-management route in navigation/router, then automate Add Staff Member creation against that mounted surface.
  - Reason: The old `/groups` staff-management surface targeted by this audit is no longer routed in the current school app, so this automation cannot reach the Add Staff modal through the live UI.
  - Manual Step: Expose the current staff-management route in navigation/router, then automate Add Staff Member creation against that mounted surface.
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /\+?\s*Add Staff Member/i })[22m

  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-085-2026-06-27T01-47-42-920Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-47-24-871Z.zip
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /Add Staff Member/i })[22m

  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-085-2026-06-27T01-35-20-238Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-35-02-748Z.zip
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /Add Staff Member/i })[22m

  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-085-2026-06-27T01-29-13-728Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-27-24-182Z.zip
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /Add Staff Member/i })[22m

  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-085-2026-06-27T01-22-43-507Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-20-54-000Z.zip
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /Add Staff Member/i })[22m

  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-085-2026-06-27T01-04-34-991Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-02-45-287Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /Add Staff Member/i })[22m

  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-085-2026-06-26T23-24-04-909Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-26T23-22-09-525Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
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
- [ ] **Profile** · Edit school name, domain, required hours, ZIP codes → Save → persists — PASS — PASS — FAIL — PASS — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — PASS — PASS
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
- [ ] **Classrooms** · "Create Classroom" → enter name → created; appears in list with invite code — PASS — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: The school settings "Classrooms" tab no longer exists; cohort management replaced this flow.
  - Manual Step: Use the current cohort-management surface to create a cohort/classroom-equivalent group and verify the invite/join workflow there.
  - Reason: The school settings "Classrooms" tab no longer exists; cohort management replaced this flow.
  - Manual Step: Use the current cohort-management surface to create a cohort/classroom-equivalent group and verify the invite/join workflow there.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The school settings "Classrooms" tab no longer exists; cohort management replaced this flow.
  - Manual Step: Use the current cohort-management surface to create a cohort/classroom-equivalent group and verify the invite/join workflow there.
  - Reason: The school settings "Classrooms" tab no longer exists; cohort management replaced this flow.
  - Manual Step: Use the current cohort-management surface to create a cohort/classroom-equivalent group and verify the invite/join workflow there.
  - Reason: The school settings "Classrooms" tab no longer exists; cohort management replaced this flow.
  - Manual Step: Use the current cohort-management surface to create a cohort/classroom-equivalent group and verify the invite/join workflow there.
  - Reason: The school settings "Classrooms" tab no longer exists; cohort management replaced this flow.
  - Manual Step: Use the current cohort-management surface to create a cohort/classroom-equivalent group and verify the invite/join workflow there.
  - Reason: The school settings "Classrooms" tab no longer exists; cohort management replaced this flow.
  - Manual Step: Use the current cohort-management surface to create a cohort/classroom-equivalent group and verify the invite/join workflow there.
  - Reason: The school settings "Classrooms" tab no longer exists; cohort management replaced this flow.
  - Manual Step: Use the current cohort-management surface to create a cohort/classroom-equivalent group and verify the invite/join workflow there.
  - Reason: The school settings "Classrooms" tab no longer exists; cohort management replaced this flow.
  - Manual Step: Use the current cohort-management surface to create a cohort/classroom-equivalent group and verify the invite/join workflow there.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The school settings "Classrooms" tab no longer exists; cohort management replaced this flow.
  - Manual Step: Use the current cohort-management surface to create a cohort/classroom-equivalent group and verify the invite/join workflow there.
  - Reason: The school settings "Classrooms" tab no longer exists; cohort management replaced this flow.
  - Manual Step: Use the current cohort-management surface to create a cohort/classroom-equivalent group and verify the invite/join workflow there.
  - Reason: The school settings "Classrooms" tab no longer exists; cohort management replaced this flow.
  - Manual Step: Use the current cohort-management surface to create a cohort/classroom-equivalent group and verify the invite/join workflow there.
  - Reason: The school settings "Classrooms" tab no longer exists; cohort management replaced this flow.
  - Manual Step: Use the current cohort-management surface to create a cohort/classroom-equivalent group and verify the invite/join workflow there.
  - Reason: The school settings "Classrooms" tab no longer exists; cohort management replaced this flow.
  - Manual Step: Use the current cohort-management surface to create a cohort/classroom-equivalent group and verify the invite/join workflow there.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The school settings "Classrooms" tab no longer exists; cohort management replaced this flow.
  - Manual Step: Use the current cohort-management surface to create a cohort/classroom-equivalent group and verify the invite/join workflow there.
  - Reason: The school settings "Classrooms" tab no longer exists; cohort management replaced this flow.
  - Manual Step: Use the current cohort-management surface to create a cohort/classroom-equivalent group and verify the invite/join workflow there.
  - Reason: The school settings "Classrooms" tab no longer exists; cohort management replaced this flow.
  - Manual Step: Use the current cohort-management surface to create a cohort/classroom-equivalent group and verify the invite/join workflow there.
  - Reason: The school settings "Classrooms" tab no longer exists; cohort management replaced this flow.
  - Manual Step: Use the current cohort-management surface to create a cohort/classroom-equivalent group and verify the invite/join workflow there.
  - Reason: The school settings "Classrooms" tab no longer exists; cohort management replaced this flow.
  - Manual Step: Use the current cohort-management surface to create a cohort/classroom-equivalent group and verify the invite/join workflow there.
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^classrooms$/i })[22m

  - URL: http://localhost:5173/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-087-2026-06-27T01-29-31-128Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-27-24-182Z.zip
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^classrooms$/i })[22m

  - URL: http://localhost:5173/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-087-2026-06-27T01-23-00-897Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-20-54-000Z.zip
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^classrooms$/i })[22m

  - URL: http://localhost:5173/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-087-2026-06-27T01-04-52-371Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-02-45-287Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^classrooms$/i })[22m

  - URL: http://localhost:5173/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-087-2026-06-26T23-24-22-266Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-26T23-22-09-525Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: locator.click: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('button', { name: /^classrooms$/i })[22m

  - URL: http://127.0.0.1:5174/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-087-2026-05-18T13-51-29-576Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-05-18T13-49-22-197Z.zip
- [ ] **Data Export** · Export activity log CSV → downloads file with Student, Opportunity, Date, Hours, Status columns — PASS — PASS — FAIL — PASS — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — PASS — PASS
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
- [ ] **Change password** · Works correctly — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Changing admin@lincoln.edu password in-suite can break subsequent seeded login checks and shared test credentials.
  - Manual Step: In School Settings > Security, change password and verify login, then restore seed password before shared quick-smoke runs.
  - Reason: Changing admin@lincoln.edu password in-suite can break subsequent seeded login checks and shared test credentials.
  - Manual Step: In School Settings > Security, change password and verify login, then restore seed password before shared quick-smoke runs.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Changing admin@lincoln.edu password in-suite can break subsequent seeded login checks and shared test credentials.
  - Manual Step: In School Settings > Security, change password and verify login, then restore seed password before shared quick-smoke runs.
  - Reason: Changing admin@lincoln.edu password in-suite can break subsequent seeded login checks and shared test credentials.
  - Manual Step: In School Settings > Security, change password and verify login, then restore seed password before shared quick-smoke runs.
  - Reason: Changing admin@lincoln.edu password in-suite can break subsequent seeded login checks and shared test credentials.
  - Manual Step: In School Settings > Security, change password and verify login, then restore seed password before shared quick-smoke runs.
  - Reason: Changing admin@lincoln.edu password in-suite can break subsequent seeded login checks and shared test credentials.
  - Manual Step: In School Settings > Security, change password and verify login, then restore seed password before shared quick-smoke runs.
  - Reason: Changing admin@lincoln.edu password in-suite can break subsequent seeded login checks and shared test credentials.
  - Manual Step: In School Settings > Security, change password and verify login, then restore seed password before shared quick-smoke runs.
  - Reason: Changing admin@lincoln.edu password in-suite can break subsequent seeded login checks and shared test credentials.
  - Manual Step: In School Settings > Security, change password and verify login, then restore seed password before shared quick-smoke runs.
  - Reason: Changing admin@lincoln.edu password in-suite can break subsequent seeded login checks and shared test credentials.
  - Manual Step: In School Settings > Security, change password and verify login, then restore seed password before shared quick-smoke runs.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Changing admin@lincoln.edu password in-suite can break subsequent seeded login checks and shared test credentials.
  - Manual Step: In School Settings > Security, change password and verify login, then restore seed password before shared quick-smoke runs.
  - Reason: Changing admin@lincoln.edu password in-suite can break subsequent seeded login checks and shared test credentials.
  - Manual Step: In School Settings > Security, change password and verify login, then restore seed password before shared quick-smoke runs.
  - Reason: Changing admin@lincoln.edu password in-suite can break subsequent seeded login checks and shared test credentials.
  - Manual Step: In School Settings > Security, change password and verify login, then restore seed password before shared quick-smoke runs.
  - Reason: Changing admin@lincoln.edu password in-suite can break subsequent seeded login checks and shared test credentials.
  - Manual Step: In School Settings > Security, change password and verify login, then restore seed password before shared quick-smoke runs.
  - Reason: Changing admin@lincoln.edu password in-suite can break subsequent seeded login checks and shared test credentials.
  - Manual Step: In School Settings > Security, change password and verify login, then restore seed password before shared quick-smoke runs.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Changing admin@lincoln.edu password in-suite can break subsequent seeded login checks and shared test credentials.
  - Manual Step: In School Settings > Security, change password and verify login, then restore seed password before shared quick-smoke runs.
  - Reason: Changing admin@lincoln.edu password in-suite can break subsequent seeded login checks and shared test credentials.
  - Manual Step: In School Settings > Security, change password and verify login, then restore seed password before shared quick-smoke runs.
  - Reason: Changing admin@lincoln.edu password in-suite can break subsequent seeded login checks and shared test credentials.
  - Manual Step: In School Settings > Security, change password and verify login, then restore seed password before shared quick-smoke runs.
  - Reason: Changing admin@lincoln.edu password in-suite can break subsequent seeded login checks and shared test credentials.
  - Manual Step: In School Settings > Security, change password and verify login, then restore seed password before shared quick-smoke runs.
  - Reason: Changing admin@lincoln.edu password in-suite can break subsequent seeded login checks and shared test credentials.
  - Manual Step: In School Settings > Security, change password and verify login, then restore seed password before shared quick-smoke runs.
  - Reason: Changing admin@lincoln.edu password in-suite can break subsequent seeded login checks and shared test credentials.
  - Manual Step: In School Settings > Security, change password and verify login, then restore seed password before shared quick-smoke runs.
  - Reason: Changing admin@lincoln.edu password in-suite can break subsequent seeded login checks and shared test credentials.
  - Manual Step: In School Settings > Security, change password and verify login, then restore seed password before shared quick-smoke runs.
  - Reason: Changing admin@lincoln.edu password in-suite can break subsequent seeded login checks and shared test credentials.
  - Manual Step: In School Settings > Security, change password and verify login, then restore seed password before shared quick-smoke runs.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Changing admin@lincoln.edu password in-suite can break subsequent seeded login checks and shared test credentials.
  - Manual Step: In School Settings > Security, change password and verify login, then restore seed password before shared quick-smoke runs.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Changing admin@lincoln.edu password in-suite can break subsequent seeded login checks and shared test credentials.
  - Manual Step: In School Settings > Security, change password and verify login, then restore seed password before shared quick-smoke runs.
  - Reason: Changing admin@lincoln.edu password in-suite can break subsequent seeded login checks and shared test credentials.
  - Manual Step: In School Settings > Security, change password and verify login, then restore seed password before shared quick-smoke runs.
- [ ] **Notifications** · Toggle off an option → save → persists — PASS — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — FAIL — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — PASS — PASS
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Admin notification toggle did not persist a changed state
  - URL: http://localhost:5173/settings?tab=notifications
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-090-2026-06-27T01-47-48-492Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-47-24-871Z.zip
  - Console/Network Logs Snippet:

```text
[2026-06-27T01:47:47.964Z] console.error: Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.
[2026-06-27T01:47:48.023Z] console.error: Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.
[2026-06-27T01:47:48.086Z] console.error: Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.
[2026-06-27T01:47:48.159Z] console.error: Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.
[2026-06-27T01:47:48.216Z] console.error: Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.
[2026-06-27T01:47:48.280Z] console.error: Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.
[2026-06-27T01:47:48.340Z] console.error: Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.
[2026-06-27T01:47:48.379Z] console.error: Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.
[2026-06-27T01:47:48.417Z] console.error: Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.
[2026-06-27T01:47:48.455Z] console.error: Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.
[2026-06-27T01:47:48.495Z] console.error: Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.
[2026-06-27T01:47:48.538Z] console.error: Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.
```
  - Error: Admin notification toggle did not persist a changed state
  - URL: http://localhost:5173/settings?tab=notifications
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-090-2026-06-27T01-35-24-617Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-35-02-748Z.zip
  - Console/Network Logs Snippet:

```text
[2026-06-27T01:35:24.239Z] console.error: Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.
[2026-06-27T01:35:24.302Z] console.error: Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.
[2026-06-27T01:35:24.365Z] console.error: Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.
[2026-06-27T01:35:24.427Z] console.error: Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.
[2026-06-27T01:35:24.490Z] console.error: Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.
[2026-06-27T01:35:24.566Z] console.error: Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.
[2026-06-27T01:35:24.636Z] console.error: Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.
```
  - Error: Admin notification toggle did not persist OFF after refresh
  - URL: http://localhost:5173/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-090-2026-06-27T01-29-33-900Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-27-24-182Z.zip
  - Error: Admin notification toggle did not persist OFF after refresh
  - URL: http://localhost:5173/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-090-2026-06-27T01-23-03-648Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-20-54-000Z.zip
  - Error: Admin notification toggle did not persist OFF after refresh
  - URL: http://localhost:5173/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-090-2026-06-27T01-04-55-141Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-02-45-287Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Admin notification toggle did not persist OFF after refresh
  - URL: http://localhost:5173/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-090-2026-06-26T23-24-25-014Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-26T23-22-09-525Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Admin notification toggle did not persist OFF after refresh
  - URL: http://127.0.0.1:5174/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-090-2026-05-18T13-51-32-315Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-05-18T13-49-22-197Z.zip

---

## 5 · Cross-Role & Edge Cases

> These require switching accounts. Do them last.

- [ ] **Message preference enforcement** · Set student privacy to "Admins Only" → log in as org → attempt to message that student — PASS — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — FAIL — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — PASS — PASS
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Org-to-student message was not blocked by student privacy Admins Only setting
  - URL: http://localhost:5173/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-091-2026-06-27T01-47-50-698Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-27T01-46-38-132Z.zip
  - Error: Org-to-student message was not blocked by student privacy Admins Only setting
  - URL: http://localhost:5173/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-091-2026-06-27T01-35-26-860Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-27T01-34-11-900Z.zip
  - Error: Org-to-student message was not blocked by student privacy Admins Only setting
  - URL: http://localhost:5173/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-091-2026-06-27T01-29-36-157Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-27T01-26-30-466Z.zip
  - Error: Org-to-student message was not blocked by student privacy Admins Only setting
  - URL: http://localhost:5173/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-091-2026-06-27T01-23-05-921Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-27T01-19-27-784Z.zip
  - Console/Network Logs Snippet:

```text
[2026-06-27T01:23:04.433Z] response: 400 PUT http://localhost:5173/api/auth/profile
[2026-06-27T01:23:04.433Z] console.error: Failed to load resource: the server responded with a status of 400 (Bad Request)
```
  - Error: Org-to-student message was not blocked by student privacy Admins Only setting
  - URL: http://localhost:5173/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-091-2026-06-27T01-04-57-397Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-27T01-01-15-900Z.zip
  - Console/Network Logs Snippet:

```text
[2026-06-27T01:04:55.927Z] response: 400 PUT http://localhost:5173/api/auth/profile
[2026-06-27T01:04:55.927Z] console.error: Failed to load resource: the server responded with a status of 400 (Bad Request)
```
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Org-to-student message was not blocked by student privacy Admins Only setting
  - URL: http://localhost:5173/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-091-2026-06-26T23-24-27-254Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-06-26T23-17-32-289Z.zip
  - Console/Network Logs Snippet:

```text
[2026-06-26T23:24:25.783Z] response: 400 PUT http://localhost:5173/api/auth/profile
[2026-06-26T23:24:25.783Z] console.error: Failed to load resource: the server responded with a status of 400 (Bad Request)
```
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Org-to-student message was not blocked by student privacy Admins Only setting
  - URL: http://127.0.0.1:5174/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-091-2026-05-18T13-51-34-570Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/student-john-2026-05-18T13-44-31-972Z.zip
  _Expect: blocked with "Message preferences do not allow this"_
- [ ] **Audit trail** · School admin views audit log for a session that was approved then had hours removed — PASS — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: The old audit-trail check points at the removed `/groups` surface, and no current automated path in this suite both removes approved hours and lands on the replacement audit-history UI.
  - Manual Step: Use the current student/session review workflow that supports remove-hours, then verify the resulting audit history from the mounted replacement surface before restoring automation.
  - Reason: The old audit-trail check points at the removed `/groups` surface, and no current automated path in this suite both removes approved hours and lands on the replacement audit-history UI.
  - Manual Step: Use the current student/session review workflow that supports remove-hours, then verify the resulting audit history from the mounted replacement surface before restoring automation.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The old audit-trail check points at the removed `/groups` surface, and no current automated path in this suite both removes approved hours and lands on the replacement audit-history UI.
  - Manual Step: Use the current student/session review workflow that supports remove-hours, then verify the resulting audit history from the mounted replacement surface before restoring automation.
  - Reason: The old audit-trail check points at the removed `/groups` surface, and no current automated path in this suite both removes approved hours and lands on the replacement audit-history UI.
  - Manual Step: Use the current student/session review workflow that supports remove-hours, then verify the resulting audit history from the mounted replacement surface before restoring automation.
  - Reason: The old audit-trail check points at the removed `/groups` surface, and no current automated path in this suite both removes approved hours and lands on the replacement audit-history UI.
  - Manual Step: Use the current student/session review workflow that supports remove-hours, then verify the resulting audit history from the mounted replacement surface before restoring automation.
  - Reason: The old audit-trail check points at the removed `/groups` surface, and no current automated path in this suite both removes approved hours and lands on the replacement audit-history UI.
  - Manual Step: Use the current student/session review workflow that supports remove-hours, then verify the resulting audit history from the mounted replacement surface before restoring automation.
  - Reason: The old audit-trail check points at the removed `/groups` surface, and no current automated path in this suite both removes approved hours and lands on the replacement audit-history UI.
  - Manual Step: Use the current student/session review workflow that supports remove-hours, then verify the resulting audit history from the mounted replacement surface before restoring automation.
  - Reason: The old audit-trail check points at the removed `/groups` surface, and no current automated path in this suite both removes approved hours and lands on the replacement audit-history UI.
  - Manual Step: Use the current student/session review workflow that supports remove-hours, then verify the resulting audit history from the mounted replacement surface before restoring automation.
  - Reason: The old audit-trail check points at the removed `/groups` surface, and no current automated path in this suite both removes approved hours and lands on the replacement audit-history UI.
  - Manual Step: Use the current student/session review workflow that supports remove-hours, then verify the resulting audit history from the mounted replacement surface before restoring automation.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The old audit-trail check points at the removed `/groups` surface, and no current automated path in this suite both removes approved hours and lands on the replacement audit-history UI.
  - Manual Step: Use the current student/session review workflow that supports remove-hours, then verify the resulting audit history from the mounted replacement surface before restoring automation.
  - Reason: The old audit-trail check points at the removed `/groups` surface, and no current automated path in this suite both removes approved hours and lands on the replacement audit-history UI.
  - Manual Step: Use the current student/session review workflow that supports remove-hours, then verify the resulting audit history from the mounted replacement surface before restoring automation.
  - Reason: The old audit-trail check points at the removed `/groups` surface, and no current automated path in this suite both removes approved hours and lands on the replacement audit-history UI.
  - Manual Step: Use the current student/session review workflow that supports remove-hours, then verify the resulting audit history from the mounted replacement surface before restoring automation.
  - Reason: The old audit-trail check points at the removed `/groups` surface, and no current automated path in this suite both removes approved hours and lands on the replacement audit-history UI.
  - Manual Step: Use the current student/session review workflow that supports remove-hours, then verify the resulting audit history from the mounted replacement surface before restoring automation.
  - Reason: The old audit-trail check points at the removed `/groups` surface, and no current automated path in this suite both removes approved hours and lands on the replacement audit-history UI.
  - Manual Step: Use the current student/session review workflow that supports remove-hours, then verify the resulting audit history from the mounted replacement surface before restoring automation.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The old audit-trail check points at the removed `/groups` surface, and no current automated path in this suite both removes approved hours and lands on the replacement audit-history UI.
  - Manual Step: Use the current student/session review workflow that supports remove-hours, then verify the resulting audit history from the mounted replacement surface before restoring automation.
  - Reason: The old audit-trail check points at the removed `/groups` surface, and no current automated path in this suite both removes approved hours and lands on the replacement audit-history UI.
  - Manual Step: Use the current student/session review workflow that supports remove-hours, then verify the resulting audit history from the mounted replacement surface before restoring automation.
  - Reason: The old audit-trail check points at the removed `/groups` surface, and no current automated path in this suite both removes approved hours and lands on the replacement audit-history UI.
  - Manual Step: Use the current student/session review workflow that supports remove-hours, then verify the resulting audit history from the mounted replacement surface before restoring automation.
  - Error: No audit trail UI found for approved-then-removed session history verification
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-092-2026-06-27T01-47-51-416Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-47-24-871Z.zip
  - Error: No audit trail UI found for approved-then-removed session history verification
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-092-2026-06-27T01-35-27-551Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-35-02-748Z.zip
  - Error: No audit trail UI found for approved-then-removed session history verification
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-092-2026-06-27T01-29-36-799Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-27-24-182Z.zip
  - Error: No audit trail UI found for approved-then-removed session history verification
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-092-2026-06-27T01-23-06-572Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-20-54-000Z.zip
  - Error: No audit trail UI found for approved-then-removed session history verification
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-092-2026-06-27T01-04-58-057Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-02-45-287Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: No audit trail UI found for approved-then-removed session history verification
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-092-2026-06-26T23-24-27-883Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-26T23-22-09-525Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
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
- [ ] **Rate limit** · Attempt 6+ signups from same IP within 1 hour — PASS — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: This rate-limit case still targets the removed student self-signup contract on `/api/auth/signup`, so it now only exercises validation failures instead of the intended limiter path.
  - Manual Step: Retarget the limiter check to the current school-registration or invitation-based auth entrypoint that is actually rate-limited, then verify repeated attempts return HTTP 429 with the expected message.
  - Reason: This rate-limit case still targets the removed student self-signup contract on `/api/auth/signup`, so it now only exercises validation failures instead of the intended limiter path.
  - Manual Step: Retarget the limiter check to the current school-registration or invitation-based auth entrypoint that is actually rate-limited, then verify repeated attempts return HTTP 429 with the expected message.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: This rate-limit case still targets the removed student self-signup contract on `/api/auth/signup`, so it now only exercises validation failures instead of the intended limiter path.
  - Manual Step: Retarget the limiter check to the current school-registration or invitation-based auth entrypoint that is actually rate-limited, then verify repeated attempts return HTTP 429 with the expected message.
  - Reason: This rate-limit case still targets the removed student self-signup contract on `/api/auth/signup`, so it now only exercises validation failures instead of the intended limiter path.
  - Manual Step: Retarget the limiter check to the current school-registration or invitation-based auth entrypoint that is actually rate-limited, then verify repeated attempts return HTTP 429 with the expected message.
  - Reason: This rate-limit case still targets the removed student self-signup contract on `/api/auth/signup`, so it now only exercises validation failures instead of the intended limiter path.
  - Manual Step: Retarget the limiter check to the current school-registration or invitation-based auth entrypoint that is actually rate-limited, then verify repeated attempts return HTTP 429 with the expected message.
  - Reason: This rate-limit case still targets the removed student self-signup contract on `/api/auth/signup`, so it now only exercises validation failures instead of the intended limiter path.
  - Manual Step: Retarget the limiter check to the current school-registration or invitation-based auth entrypoint that is actually rate-limited, then verify repeated attempts return HTTP 429 with the expected message.
  - Reason: This rate-limit case still targets the removed student self-signup contract on `/api/auth/signup`, so it now only exercises validation failures instead of the intended limiter path.
  - Manual Step: Retarget the limiter check to the current school-registration or invitation-based auth entrypoint that is actually rate-limited, then verify repeated attempts return HTTP 429 with the expected message.
  - Reason: This rate-limit case still targets the removed student self-signup contract on `/api/auth/signup`, so it now only exercises validation failures instead of the intended limiter path.
  - Manual Step: Retarget the limiter check to the current school-registration or invitation-based auth entrypoint that is actually rate-limited, then verify repeated attempts return HTTP 429 with the expected message.
  - Reason: This rate-limit case still targets the removed student self-signup contract on `/api/auth/signup`, so it now only exercises validation failures instead of the intended limiter path.
  - Manual Step: Retarget the limiter check to the current school-registration or invitation-based auth entrypoint that is actually rate-limited, then verify repeated attempts return HTTP 429 with the expected message.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: This rate-limit case still targets the removed student self-signup contract on `/api/auth/signup`, so it now only exercises validation failures instead of the intended limiter path.
  - Manual Step: Retarget the limiter check to the current school-registration or invitation-based auth entrypoint that is actually rate-limited, then verify repeated attempts return HTTP 429 with the expected message.
  - Reason: This rate-limit case still targets the removed student self-signup contract on `/api/auth/signup`, so it now only exercises validation failures instead of the intended limiter path.
  - Manual Step: Retarget the limiter check to the current school-registration or invitation-based auth entrypoint that is actually rate-limited, then verify repeated attempts return HTTP 429 with the expected message.
  - Reason: This rate-limit case still targets the removed student self-signup contract on `/api/auth/signup`, so it now only exercises validation failures instead of the intended limiter path.
  - Manual Step: Retarget the limiter check to the current school-registration or invitation-based auth entrypoint that is actually rate-limited, then verify repeated attempts return HTTP 429 with the expected message.
  - Reason: This rate-limit case still targets the removed student self-signup contract on `/api/auth/signup`, so it now only exercises validation failures instead of the intended limiter path.
  - Manual Step: Retarget the limiter check to the current school-registration or invitation-based auth entrypoint that is actually rate-limited, then verify repeated attempts return HTTP 429 with the expected message.
  - Reason: This rate-limit case still targets the removed student self-signup contract on `/api/auth/signup`, so it now only exercises validation failures instead of the intended limiter path.
  - Manual Step: Retarget the limiter check to the current school-registration or invitation-based auth entrypoint that is actually rate-limited, then verify repeated attempts return HTTP 429 with the expected message.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: This rate-limit case still targets the removed student self-signup contract on `/api/auth/signup`, so it now only exercises validation failures instead of the intended limiter path.
  - Manual Step: Retarget the limiter check to the current school-registration or invitation-based auth entrypoint that is actually rate-limited, then verify repeated attempts return HTTP 429 with the expected message.
  - Reason: This rate-limit case still targets the removed student self-signup contract on `/api/auth/signup`, so it now only exercises validation failures instead of the intended limiter path.
  - Manual Step: Retarget the limiter check to the current school-registration or invitation-based auth entrypoint that is actually rate-limited, then verify repeated attempts return HTTP 429 with the expected message.
  - Reason: This rate-limit case still targets the removed student self-signup contract on `/api/auth/signup`, so it now only exercises validation failures instead of the intended limiter path.
  - Manual Step: Retarget the limiter check to the current school-registration or invitation-based auth entrypoint that is actually rate-limited, then verify repeated attempts return HTTP 429 with the expected message.
  - Error: No 429 returned after 6+ signup attempts. Statuses: 400, 400, 400, 400, 400, 400, 400
  - URL: n/a
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-093-2026-06-27T01-47-51-574Z.png
  - Trace: n/a
  - Error: No 429 returned after 6+ signup attempts. Statuses: 400, 400, 400, 400, 400, 400, 400
  - URL: n/a
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-093-2026-06-27T01-35-27-702Z.png
  - Trace: n/a
  - Error: No 429 returned after 6+ signup attempts. Statuses: 400, 400, 400, 400, 400, 400, 400
  - URL: n/a
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-093-2026-06-27T01-29-36-954Z.png
  - Trace: n/a
  - Error: No 429 returned after 6+ signup attempts. Statuses: 400, 400, 400, 400, 400, 400, 400
  - URL: n/a
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-093-2026-06-27T01-23-06-720Z.png
  - Trace: n/a
  - Error: No 429 returned after 6+ signup attempts. Statuses: 400, 400, 400, 400, 400, 400, 400
  - URL: n/a
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-093-2026-06-27T01-04-58-210Z.png
  - Trace: n/a
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: No 429 returned after 6+ signup attempts. Statuses: 400, 400, 400, 400, 400, 400, 400
  - URL: n/a
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-093-2026-06-26T23-24-28-022Z.png
  - Trace: n/a
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: No 429 returned after 6+ signup attempts. Statuses: 400, 400, 400, 400, 400, 400, 400
  - URL: n/a
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-093-2026-05-18T13-51-35-379Z.png
  - Trace: n/a
  _Expect: 429 "Too many signup attempts"_
- [ ] **Expired verification token** · Use a verify-email link older than 24h — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: Token-expiry >24h cannot be time-traveled from UI and no exposed admin control was found to mint an already-expired verification token.
  - Manual Step: Generate a verification token, wait past 24 hours (or use backend/admin tooling to mint expired token), then open link and confirm "Invalid or expired verification token".
  - Reason: Token-expiry >24h cannot be time-traveled from UI and no exposed admin control was found to mint an already-expired verification token.
  - Manual Step: Generate a verification token, wait past 24 hours (or use backend/admin tooling to mint expired token), then open link and confirm "Invalid or expired verification token".
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Token-expiry >24h cannot be time-traveled from UI and no exposed admin control was found to mint an already-expired verification token.
  - Manual Step: Generate a verification token, wait past 24 hours (or use backend/admin tooling to mint expired token), then open link and confirm "Invalid or expired verification token".
  - Reason: Token-expiry >24h cannot be time-traveled from UI and no exposed admin control was found to mint an already-expired verification token.
  - Manual Step: Generate a verification token, wait past 24 hours (or use backend/admin tooling to mint expired token), then open link and confirm "Invalid or expired verification token".
  - Reason: Token-expiry >24h cannot be time-traveled from UI and no exposed admin control was found to mint an already-expired verification token.
  - Manual Step: Generate a verification token, wait past 24 hours (or use backend/admin tooling to mint expired token), then open link and confirm "Invalid or expired verification token".
  - Reason: Token-expiry >24h cannot be time-traveled from UI and no exposed admin control was found to mint an already-expired verification token.
  - Manual Step: Generate a verification token, wait past 24 hours (or use backend/admin tooling to mint expired token), then open link and confirm "Invalid or expired verification token".
  - Reason: Token-expiry >24h cannot be time-traveled from UI and no exposed admin control was found to mint an already-expired verification token.
  - Manual Step: Generate a verification token, wait past 24 hours (or use backend/admin tooling to mint expired token), then open link and confirm "Invalid or expired verification token".
  - Reason: Token-expiry >24h cannot be time-traveled from UI and no exposed admin control was found to mint an already-expired verification token.
  - Manual Step: Generate a verification token, wait past 24 hours (or use backend/admin tooling to mint expired token), then open link and confirm "Invalid or expired verification token".
  - Reason: Token-expiry >24h cannot be time-traveled from UI and no exposed admin control was found to mint an already-expired verification token.
  - Manual Step: Generate a verification token, wait past 24 hours (or use backend/admin tooling to mint expired token), then open link and confirm "Invalid or expired verification token".
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Token-expiry >24h cannot be time-traveled from UI and no exposed admin control was found to mint an already-expired verification token.
  - Manual Step: Generate a verification token, wait past 24 hours (or use backend/admin tooling to mint expired token), then open link and confirm "Invalid or expired verification token".
  - Reason: Token-expiry >24h cannot be time-traveled from UI and no exposed admin control was found to mint an already-expired verification token.
  - Manual Step: Generate a verification token, wait past 24 hours (or use backend/admin tooling to mint expired token), then open link and confirm "Invalid or expired verification token".
  - Reason: Token-expiry >24h cannot be time-traveled from UI and no exposed admin control was found to mint an already-expired verification token.
  - Manual Step: Generate a verification token, wait past 24 hours (or use backend/admin tooling to mint expired token), then open link and confirm "Invalid or expired verification token".
  - Reason: Token-expiry >24h cannot be time-traveled from UI and no exposed admin control was found to mint an already-expired verification token.
  - Manual Step: Generate a verification token, wait past 24 hours (or use backend/admin tooling to mint expired token), then open link and confirm "Invalid or expired verification token".
  - Reason: Token-expiry >24h cannot be time-traveled from UI and no exposed admin control was found to mint an already-expired verification token.
  - Manual Step: Generate a verification token, wait past 24 hours (or use backend/admin tooling to mint expired token), then open link and confirm "Invalid or expired verification token".
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Token-expiry >24h cannot be time-traveled from UI and no exposed admin control was found to mint an already-expired verification token.
  - Manual Step: Generate a verification token, wait past 24 hours (or use backend/admin tooling to mint expired token), then open link and confirm "Invalid or expired verification token".
  - Reason: Token-expiry >24h cannot be time-traveled from UI and no exposed admin control was found to mint an already-expired verification token.
  - Manual Step: Generate a verification token, wait past 24 hours (or use backend/admin tooling to mint expired token), then open link and confirm "Invalid or expired verification token".
  - Reason: Token-expiry >24h cannot be time-traveled from UI and no exposed admin control was found to mint an already-expired verification token.
  - Manual Step: Generate a verification token, wait past 24 hours (or use backend/admin tooling to mint expired token), then open link and confirm "Invalid or expired verification token".
  - Reason: Token-expiry >24h cannot be time-traveled from UI and no exposed admin control was found to mint an already-expired verification token.
  - Manual Step: Generate a verification token, wait past 24 hours (or use backend/admin tooling to mint expired token), then open link and confirm "Invalid or expired verification token".
  - Reason: Token-expiry >24h cannot be time-traveled from UI and no exposed admin control was found to mint an already-expired verification token.
  - Manual Step: Generate a verification token, wait past 24 hours (or use backend/admin tooling to mint expired token), then open link and confirm "Invalid or expired verification token".
  - Reason: Token-expiry >24h cannot be time-traveled from UI and no exposed admin control was found to mint an already-expired verification token.
  - Manual Step: Generate a verification token, wait past 24 hours (or use backend/admin tooling to mint expired token), then open link and confirm "Invalid or expired verification token".
  - Reason: Token-expiry >24h cannot be time-traveled from UI and no exposed admin control was found to mint an already-expired verification token.
  - Manual Step: Generate a verification token, wait past 24 hours (or use backend/admin tooling to mint expired token), then open link and confirm "Invalid or expired verification token".
  - Reason: Token-expiry >24h cannot be time-traveled from UI and no exposed admin control was found to mint an already-expired verification token.
  - Manual Step: Generate a verification token, wait past 24 hours (or use backend/admin tooling to mint expired token), then open link and confirm "Invalid or expired verification token".
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Token-expiry >24h cannot be time-traveled from UI and no exposed admin control was found to mint an already-expired verification token.
  - Manual Step: Generate a verification token, wait past 24 hours (or use backend/admin tooling to mint expired token), then open link and confirm "Invalid or expired verification token".
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: Token-expiry >24h cannot be time-traveled from UI and no exposed admin control was found to mint an already-expired verification token.
  - Manual Step: Generate a verification token, wait past 24 hours (or use backend/admin tooling to mint expired token), then open link and confirm "Invalid or expired verification token".
  - Reason: Token-expiry >24h cannot be time-traveled from UI and no exposed admin control was found to mint an already-expired verification token.
  - Manual Step: Generate a verification token, wait past 24 hours (or use backend/admin tooling to mint expired token), then open link and confirm "Invalid or expired verification token".
  _Expect: "Invalid or expired verification token" error_
- [ ] **Resend verification** · On email verification screen, click "Resend" → new email arrives — PASS — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: This check still targets the removed self-signup/email-verification flow on `/signup`.
  - Manual Step: Use the current invitation-based registration flow, reach the email-verification screen from an actual invite, click Resend, and confirm a fresh verification email arrives.
  - Reason: This check still targets the removed self-signup/email-verification flow on `/signup`.
  - Manual Step: Use the current invitation-based registration flow, reach the email-verification screen from an actual invite, click Resend, and confirm a fresh verification email arrives.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: This check still targets the removed self-signup/email-verification flow on `/signup`.
  - Manual Step: Use the current invitation-based registration flow, reach the email-verification screen from an actual invite, click Resend, and confirm a fresh verification email arrives.
  - Reason: This check still targets the removed self-signup/email-verification flow on `/signup`.
  - Manual Step: Use the current invitation-based registration flow, reach the email-verification screen from an actual invite, click Resend, and confirm a fresh verification email arrives.
  - Reason: This check still targets the removed self-signup/email-verification flow on `/signup`.
  - Manual Step: Use the current invitation-based registration flow, reach the email-verification screen from an actual invite, click Resend, and confirm a fresh verification email arrives.
  - Reason: This check still targets the removed self-signup/email-verification flow on `/signup`.
  - Manual Step: Use the current invitation-based registration flow, reach the email-verification screen from an actual invite, click Resend, and confirm a fresh verification email arrives.
  - Reason: This check still targets the removed self-signup/email-verification flow on `/signup`.
  - Manual Step: Use the current invitation-based registration flow, reach the email-verification screen from an actual invite, click Resend, and confirm a fresh verification email arrives.
  - Reason: This check still targets the removed self-signup/email-verification flow on `/signup`.
  - Manual Step: Use the current invitation-based registration flow, reach the email-verification screen from an actual invite, click Resend, and confirm a fresh verification email arrives.
  - Reason: This check still targets the removed self-signup/email-verification flow on `/signup`.
  - Manual Step: Use the current invitation-based registration flow, reach the email-verification screen from an actual invite, click Resend, and confirm a fresh verification email arrives.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: This check still targets the removed self-signup/email-verification flow on `/signup`.
  - Manual Step: Use the current invitation-based registration flow, reach the email-verification screen from an actual invite, click Resend, and confirm a fresh verification email arrives.
  - Reason: This check still targets the removed self-signup/email-verification flow on `/signup`.
  - Manual Step: Use the current invitation-based registration flow, reach the email-verification screen from an actual invite, click Resend, and confirm a fresh verification email arrives.
  - Reason: This check still targets the removed self-signup/email-verification flow on `/signup`.
  - Manual Step: Use the current invitation-based registration flow, reach the email-verification screen from an actual invite, click Resend, and confirm a fresh verification email arrives.
  - Reason: This check still targets the removed self-signup/email-verification flow on `/signup`.
  - Manual Step: Use the current invitation-based registration flow, reach the email-verification screen from an actual invite, click Resend, and confirm a fresh verification email arrives.
  - Reason: This check still targets the removed self-signup/email-verification flow on `/signup`.
  - Manual Step: Use the current invitation-based registration flow, reach the email-verification screen from an actual invite, click Resend, and confirm a fresh verification email arrives.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: This check still targets the removed self-signup/email-verification flow on `/signup`.
  - Manual Step: Use the current invitation-based registration flow, reach the email-verification screen from an actual invite, click Resend, and confirm a fresh verification email arrives.
  - Reason: This check still targets the removed self-signup/email-verification flow on `/signup`.
  - Manual Step: Use the current invitation-based registration flow, reach the email-verification screen from an actual invite, click Resend, and confirm a fresh verification email arrives.
  - Reason: This check still targets the removed self-signup/email-verification flow on `/signup`.
  - Manual Step: Use the current invitation-based registration flow, reach the email-verification screen from an actual invite, click Resend, and confirm a fresh verification email arrives.
  - Reason: This check still targets the removed self-signup/email-verification flow on `/signup`.
  - Manual Step: Use the current invitation-based registration flow, reach the email-verification screen from an actual invite, click Resend, and confirm a fresh verification email arrives.
  - Error: Volunteer signup role selector not found on /signup
  - URL: http://localhost:5173/signup
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-095-2026-06-27T01-35-28-328Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/auth-flow-2026-06-27T01-34-11-219Z.zip
  - Error: Volunteer signup role selector not found on /signup
  - URL: http://localhost:5173/signup
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-095-2026-06-27T01-29-37-582Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/auth-flow-2026-06-27T01-26-29-966Z.zip
  - Error: Volunteer signup role selector not found on /signup
  - URL: http://localhost:5173/signup
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-095-2026-06-27T01-23-07-300Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/auth-flow-2026-06-27T01-19-27-182Z.zip
  - Error: Volunteer signup role selector not found on /signup
  - URL: http://localhost:5173/signup
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-095-2026-06-27T01-04-58-839Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/auth-flow-2026-06-27T01-01-15-130Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Volunteer signup role selector not found on /signup
  - URL: http://localhost:5173/signup
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-095-2026-06-26T23-24-28-634Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/auth-flow-2026-06-26T23-11-19-563Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Volunteer signup role selector not found on /signup
  - URL: http://127.0.0.1:5174/signup
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-095-2026-05-18T13-51-35-963Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/auth-flow-2026-05-18T13-40-27-710Z.zip
  _Expect: new email in inbox; old token no longer works_

---

## 6 · Quick Smoke (post-deploy)

> Run after every deploy. Should take < 5 min.

- [ ] `GET /api/health` returns `{"status":"ok"}` — PASS — PASS — FAIL — PASS — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — PASS — PASS
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
- [ ] Login as john@student.edu → Dashboard loads with no errors — PASS — PASS — FAIL — PASS — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — PASS — PASS
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
- [ ] Browse page loads opportunities — PASS — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — PASS — FAIL — PASS — PASS — FAIL — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — PASS — PASS
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Browse page did not load opportunities in quick smoke
  - URL: http://localhost:5173/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-098-2026-06-27T01-57-36-749Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/quick-john-2026-06-27T01-57-33-767Z.zip
  - Error: Browse page did not load opportunities in quick smoke
  - URL: http://localhost:5173/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-098-2026-06-27T01-35-31-439Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/quick-john-2026-06-27T01-35-28-399Z.zip
  - Error: Browse page did not load opportunities in quick smoke
  - URL: http://localhost:5173/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-098-2026-06-27T01-29-40-771Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/quick-john-2026-06-27T01-29-37-649Z.zip
  - Error: Browse page did not load opportunities in quick smoke
  - URL: http://localhost:5173/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-098-2026-06-27T01-23-10-337Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/quick-john-2026-06-27T01-23-07-372Z.zip
  - Error: Browse page did not load opportunities in quick smoke
  - URL: http://localhost:5173/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-098-2026-06-27T01-05-01-859Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/quick-john-2026-06-27T01-04-58-905Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Browse page did not load opportunities in quick smoke
  - URL: http://localhost:5173/browse
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-098-2026-06-26T23-24-32-130Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/quick-john-2026-06-26T23-24-28-700Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
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
- [ ] Login as volunteer@greenearth.org → Opportunities list loads — PASS — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: The seeded org quick-smoke account is currently a BENEFICIARY_ADMIN with no organizationId, so the old "My Opportunities" org-admin expectation is invalid for this environment.
  - Manual Step: Use a true ORG_ADMIN seed account and confirm `/opportunities` loads the organization opportunity list without console errors.
  - Reason: The seeded org quick-smoke account is currently a BENEFICIARY_ADMIN with no organizationId, so the old "My Opportunities" org-admin expectation is invalid for this environment.
  - Manual Step: Use a true ORG_ADMIN seed account and confirm `/opportunities` loads the organization opportunity list without console errors.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The seeded org quick-smoke account is currently a BENEFICIARY_ADMIN with no organizationId, so the old "My Opportunities" org-admin expectation is invalid for this environment.
  - Manual Step: Use a true ORG_ADMIN seed account and confirm `/opportunities` loads the organization opportunity list without console errors.
  - Reason: The seeded org quick-smoke account is currently a BENEFICIARY_ADMIN with no organizationId, so the old "My Opportunities" org-admin expectation is invalid for this environment.
  - Manual Step: Use a true ORG_ADMIN seed account and confirm `/opportunities` loads the organization opportunity list without console errors.
  - Reason: The seeded org quick-smoke account is currently a BENEFICIARY_ADMIN with no organizationId, so the old "My Opportunities" org-admin expectation is invalid for this environment.
  - Manual Step: Use a true ORG_ADMIN seed account and confirm `/opportunities` loads the organization opportunity list without console errors.
  - Reason: The seeded org quick-smoke account is currently a BENEFICIARY_ADMIN with no organizationId, so the old "My Opportunities" org-admin expectation is invalid for this environment.
  - Manual Step: Use a true ORG_ADMIN seed account and confirm `/opportunities` loads the organization opportunity list without console errors.
  - Reason: The seeded org quick-smoke account is currently a BENEFICIARY_ADMIN with no organizationId, so the old "My Opportunities" org-admin expectation is invalid for this environment.
  - Manual Step: Use a true ORG_ADMIN seed account and confirm `/opportunities` loads the organization opportunity list without console errors.
  - Reason: The seeded org quick-smoke account is currently a BENEFICIARY_ADMIN with no organizationId, so the old "My Opportunities" org-admin expectation is invalid for this environment.
  - Manual Step: Use a true ORG_ADMIN seed account and confirm `/opportunities` loads the organization opportunity list without console errors.
  - Reason: The seeded org quick-smoke account is currently a BENEFICIARY_ADMIN with no organizationId, so the old "My Opportunities" org-admin expectation is invalid for this environment.
  - Manual Step: Use a true ORG_ADMIN seed account and confirm `/opportunities` loads the organization opportunity list without console errors.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The seeded org quick-smoke account is currently a BENEFICIARY_ADMIN with no organizationId, so the old "My Opportunities" org-admin expectation is invalid for this environment.
  - Manual Step: Use a true ORG_ADMIN seed account and confirm `/opportunities` loads the organization opportunity list without console errors.
  - Reason: The seeded org quick-smoke account is currently a BENEFICIARY_ADMIN with no organizationId, so the old "My Opportunities" org-admin expectation is invalid for this environment.
  - Manual Step: Use a true ORG_ADMIN seed account and confirm `/opportunities` loads the organization opportunity list without console errors.
  - Reason: The seeded org quick-smoke account is currently a BENEFICIARY_ADMIN with no organizationId, so the old "My Opportunities" org-admin expectation is invalid for this environment.
  - Manual Step: Use a true ORG_ADMIN seed account and confirm `/opportunities` loads the organization opportunity list without console errors.
  - Reason: The seeded org quick-smoke account is currently a BENEFICIARY_ADMIN with no organizationId, so the old "My Opportunities" org-admin expectation is invalid for this environment.
  - Manual Step: Use a true ORG_ADMIN seed account and confirm `/opportunities` loads the organization opportunity list without console errors.
  - Reason: The seeded org quick-smoke account is currently a BENEFICIARY_ADMIN with no organizationId, so the old "My Opportunities" org-admin expectation is invalid for this environment.
  - Manual Step: Use a true ORG_ADMIN seed account and confirm `/opportunities` loads the organization opportunity list without console errors.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: The seeded org quick-smoke account is currently a BENEFICIARY_ADMIN with no organizationId, so the old "My Opportunities" org-admin expectation is invalid for this environment.
  - Manual Step: Use a true ORG_ADMIN seed account and confirm `/opportunities` loads the organization opportunity list without console errors.
  - Reason: The seeded org quick-smoke account is currently a BENEFICIARY_ADMIN with no organizationId, so the old "My Opportunities" org-admin expectation is invalid for this environment.
  - Manual Step: Use a true ORG_ADMIN seed account and confirm `/opportunities` loads the organization opportunity list without console errors.
  - Reason: The seeded org quick-smoke account is currently a BENEFICIARY_ADMIN with no organizationId, so the old "My Opportunities" org-admin expectation is invalid for this environment.
  - Manual Step: Use a true ORG_ADMIN seed account and confirm `/opportunities` loads the organization opportunity list without console errors.
  - Error: locator.waitFor: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for getByRole('heading', { name: /My Opportunities/i }) to be visible[22m

  - URL: http://localhost:5173/opportunities
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-099-2026-06-27T01-48-11-518Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/quick-org-2026-06-27T01-47-54-747Z.zip
  - Error: Org opportunities list did not load in quick smoke
  - URL: http://localhost:5173/opportunities
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-099-2026-06-27T01-35-33-942Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/quick-org-2026-06-27T01-35-31-522Z.zip
  - Error: Org opportunities list did not load in quick smoke
  - URL: http://localhost:5173/opportunities
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-099-2026-06-27T01-29-43-173Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/quick-org-2026-06-27T01-29-40-853Z.zip
  - Error: Org opportunities list did not load in quick smoke
  - URL: http://localhost:5173/opportunities
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-099-2026-06-27T01-23-12-729Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/quick-org-2026-06-27T01-23-10-424Z.zip
  - Error: Org opportunities list did not load in quick smoke
  - URL: http://localhost:5173/opportunities
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-099-2026-06-27T01-05-04-303Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/quick-org-2026-06-27T01-05-01-956Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Org opportunities list did not load in quick smoke
  - URL: http://localhost:5173/opportunities
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-099-2026-06-26T23-24-34-745Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/quick-org-2026-06-26T23-24-32-226Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Org opportunities list did not load in quick smoke
  - URL: http://127.0.0.1:5174/opportunities
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-099-2026-05-18T13-51-41-480Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/quick-org-2026-05-18T13-51-39-103Z.zip
- [ ] Login as admin@lincoln.edu → Dashboard stats load — PASS — PASS — FAIL — PASS — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — PASS — PASS
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
- [ ] No console errors on any of the above pages — PASS — FAIL — FAIL — PASS — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — FAIL — PASS — PASS — FAIL — FAIL — PASS — PASS
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Console errors found on smoke pages:
Failed to load resource: the server responded with a status of 429 (Too Many Requests)
  - URL: http://localhost:5173/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-101-2026-06-28T19-24-26-560Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/quick-admin-2026-06-28T19-24-24-199Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Console errors found on smoke pages:
Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. /cohorts
  - URL: http://127.0.0.1:5174/dashboard
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-101-2026-05-18T13-51-43-912Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/quick-admin-2026-05-18T13-51-41-589Z.zip

## New Feature Tests (102–108)
- [ ] School Settings tab bar — all tabs fully visible and "Plans & Billing" tab not clipped — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — PASS — PASS
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
- [ ] School Settings tab bar — clicking billing tab sets ?tab=billing in URL; URL-direct navigation shows billing content — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — FAIL — PASS — FAIL — FAIL — PASS — FAIL — FAIL — FAIL — PASS — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — PASS — PASS
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Navigating to /settings?tab=billing did not show billing content
  - URL: http://localhost:5173/settings?tab=billing
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-103-2026-06-28T19-14-47-652Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-28T19-14-30-046Z.zip
  - Error: Navigating to /settings?tab=billing did not show billing content
  - URL: http://localhost:5173/settings?tab=billing
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-103-2026-06-28T19-13-01-498Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-28T19-12-44-140Z.zip
  - Error: Navigating to /settings?tab=billing did not show billing content
  - URL: http://localhost:5173/settings?tab=billing
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-103-2026-06-28T19-11-44-406Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-28T19-11-26-749Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Navigating to /settings?tab=billing did not show billing content
  - URL: http://localhost:5173/settings?tab=billing
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-103-2026-06-27T02-02-58-181Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T02-02-40-413Z.zip
  - Error: Navigating to /settings?tab=billing did not show billing content
  - URL: http://localhost:5173/settings?tab=billing
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-103-2026-06-27T01-57-41-829Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-57-23-642Z.zip
  - Error: Navigating to /settings?tab=billing did not show billing content
  - URL: http://localhost:5173/settings?tab=billing
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-103-2026-06-27T01-48-16-500Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-47-24-871Z.zip
  - Error: page.goto: Timeout 60000ms exceeded.
Call log:
[2m  - navigating to "http://localhost:5173/settings?tab=billing", waiting until "networkidle"[22m

  - URL: http://localhost:5173/settings?tab=billing
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-103-2026-06-27T01-36-38-769Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-35-02-748Z.zip
  - Console/Network Logs Snippet:

```text
[2026-06-27T01:36:38.801Z] console.error: Failed to load resource: net::ERR_INSUFFICIENT_RESOURCES
[2026-06-27T01:36:38.801Z] requestfailed: GET http://localhost:5173/api/school-procurement/cmquusyb500028o5yxl869rbp/summary -> net::ERR_INSUFFICIENT_RESOURCES
[2026-06-27T01:36:38.801Z] console.error: Failed to load resource: net::ERR_INSUFFICIENT_RESOURCES
[2026-06-27T01:36:38.803Z] requestfailed: GET http://localhost:5173/api/school-procurement/cmquusyb500028o5yxl869rbp/summary -> net::ERR_INSUFFICIENT_RESOURCES
[2026-06-27T01:36:38.803Z] console.error: Failed to load resource: net::ERR_INSUFFICIENT_RESOURCES
[2026-06-27T01:36:38.805Z] requestfailed: GET http://localhost:5173/api/school-procurement/cmquusyb500028o5yxl869rbp/summary -> net::ERR_INSUFFICIENT_RESOURCES
[2026-06-27T01:36:38.805Z] console.error: Failed to load resource: net::ERR_INSUFFICIENT_RESOURCES
[2026-06-27T01:36:38.809Z] requestfailed: GET http://localhost:5173/api/school-procurement/cmquusyb500028o5yxl869rbp/summary -> net::ERR_INSUFFICIENT_RESOURCES
[2026-06-27T01:36:38.809Z] console.error: Failed to load resource: net::ERR_INSUFFICIENT_RESOURCES
[2026-06-27T01:36:38.840Z] console.error: Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.
[2026-06-27T01:36:38.844Z] requestfailed: GET http://localhost:5173/api/school-procurement/cmquusyb500028o5yxl869rbp/summary -> net::ERR_INSUFFICIENT_RESOURCES
[2026-06-27T01:36:38.844Z] console.error: Failed to load resource: net::ERR_INSUFFICIENT_RESOURCES
```
  - Error: Clicking billing tab did not set ?tab=billing in URL. Got: http://localhost:5173/settings
  - URL: http://localhost:5173/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-103-2026-06-27T01-29-47-333Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-27-24-182Z.zip
  - Error: Clicking billing tab did not set ?tab=billing in URL. Got: http://localhost:5173/settings
  - URL: http://localhost:5173/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-103-2026-06-27T01-23-16-979Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-20-54-000Z.zip
  - Error: Clicking billing tab did not set ?tab=billing in URL. Got: http://localhost:5173/settings
  - URL: http://localhost:5173/settings
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-103-2026-06-27T01-05-08-589Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-02-45-287Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
- [ ] Dev Pro unlock — org settings shows Pro tier (not "Free") in dev mode; Reminders tab has no "Upgrade" overlay — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — PASS — PASS
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
- [ ] ProGate redirect — "Upgrade to Pro" button navigates to /settings?tab=billing (not mail app), works on repeat clicks — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: No "Upgrade to Pro" ProGate button visible in dev mode (dev Pro unlock hides it). Cannot test redirect flow without a genuine Free-tier env.
  - Manual Step: In a non-dev environment log in as a Free org, navigate to a Pro-gated tab (Reminders or Branding), click "Upgrade to Pro", and confirm it navigates to /settings?tab=billing — not to the mail app.
  - Reason: No "Upgrade to Pro" ProGate button visible in dev mode (dev Pro unlock hides it). Cannot test redirect flow without a genuine Free-tier env.
  - Manual Step: In a non-dev environment log in as a Free org, navigate to a Pro-gated tab (Reminders or Branding), click "Upgrade to Pro", and confirm it navigates to /settings?tab=billing — not to the mail app.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: No "Upgrade to Pro" ProGate button visible in dev mode (dev Pro unlock hides it). Cannot test redirect flow without a genuine Free-tier env.
  - Manual Step: In a non-dev environment log in as a Free org, navigate to a Pro-gated tab (Reminders or Branding), click "Upgrade to Pro", and confirm it navigates to /settings?tab=billing — not to the mail app.
  - Reason: No "Upgrade to Pro" ProGate button visible in dev mode (dev Pro unlock hides it). Cannot test redirect flow without a genuine Free-tier env.
  - Manual Step: In a non-dev environment log in as a Free org, navigate to a Pro-gated tab (Reminders or Branding), click "Upgrade to Pro", and confirm it navigates to /settings?tab=billing — not to the mail app.
  - Reason: No "Upgrade to Pro" ProGate button visible in dev mode (dev Pro unlock hides it). Cannot test redirect flow without a genuine Free-tier env.
  - Manual Step: In a non-dev environment log in as a Free org, navigate to a Pro-gated tab (Reminders or Branding), click "Upgrade to Pro", and confirm it navigates to /settings?tab=billing — not to the mail app.
  - Reason: No "Upgrade to Pro" ProGate button visible in dev mode (dev Pro unlock hides it). Cannot test redirect flow without a genuine Free-tier env.
  - Manual Step: In a non-dev environment log in as a Free org, navigate to a Pro-gated tab (Reminders or Branding), click "Upgrade to Pro", and confirm it navigates to /settings?tab=billing — not to the mail app.
  - Reason: No "Upgrade to Pro" ProGate button visible in dev mode (dev Pro unlock hides it). Cannot test redirect flow without a genuine Free-tier env.
  - Manual Step: In a non-dev environment log in as a Free org, navigate to a Pro-gated tab (Reminders or Branding), click "Upgrade to Pro", and confirm it navigates to /settings?tab=billing — not to the mail app.
  - Reason: No "Upgrade to Pro" ProGate button visible in dev mode (dev Pro unlock hides it). Cannot test redirect flow without a genuine Free-tier env.
  - Manual Step: In a non-dev environment log in as a Free org, navigate to a Pro-gated tab (Reminders or Branding), click "Upgrade to Pro", and confirm it navigates to /settings?tab=billing — not to the mail app.
  - Reason: No "Upgrade to Pro" ProGate button visible in dev mode (dev Pro unlock hides it). Cannot test redirect flow without a genuine Free-tier env.
  - Manual Step: In a non-dev environment log in as a Free org, navigate to a Pro-gated tab (Reminders or Branding), click "Upgrade to Pro", and confirm it navigates to /settings?tab=billing — not to the mail app.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: No "Upgrade to Pro" ProGate button visible in dev mode (dev Pro unlock hides it). Cannot test redirect flow without a genuine Free-tier env.
  - Manual Step: In a non-dev environment log in as a Free org, navigate to a Pro-gated tab (Reminders or Branding), click "Upgrade to Pro", and confirm it navigates to /settings?tab=billing — not to the mail app.
  - Reason: No "Upgrade to Pro" ProGate button visible in dev mode (dev Pro unlock hides it). Cannot test redirect flow without a genuine Free-tier env.
  - Manual Step: In a non-dev environment log in as a Free org, navigate to a Pro-gated tab (Reminders or Branding), click "Upgrade to Pro", and confirm it navigates to /settings?tab=billing — not to the mail app.
  - Reason: No "Upgrade to Pro" ProGate button visible in dev mode (dev Pro unlock hides it). Cannot test redirect flow without a genuine Free-tier env.
  - Manual Step: In a non-dev environment log in as a Free org, navigate to a Pro-gated tab (Reminders or Branding), click "Upgrade to Pro", and confirm it navigates to /settings?tab=billing — not to the mail app.
  - Reason: No "Upgrade to Pro" ProGate button visible in dev mode (dev Pro unlock hides it). Cannot test redirect flow without a genuine Free-tier env.
  - Manual Step: In a non-dev environment log in as a Free org, navigate to a Pro-gated tab (Reminders or Branding), click "Upgrade to Pro", and confirm it navigates to /settings?tab=billing — not to the mail app.
  - Reason: No "Upgrade to Pro" ProGate button visible in dev mode (dev Pro unlock hides it). Cannot test redirect flow without a genuine Free-tier env.
  - Manual Step: In a non-dev environment log in as a Free org, navigate to a Pro-gated tab (Reminders or Branding), click "Upgrade to Pro", and confirm it navigates to /settings?tab=billing — not to the mail app.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: No "Upgrade to Pro" ProGate button visible in dev mode (dev Pro unlock hides it). Cannot test redirect flow without a genuine Free-tier env.
  - Manual Step: In a non-dev environment log in as a Free org, navigate to a Pro-gated tab (Reminders or Branding), click "Upgrade to Pro", and confirm it navigates to /settings?tab=billing — not to the mail app.
  - Reason: No "Upgrade to Pro" ProGate button visible in dev mode (dev Pro unlock hides it). Cannot test redirect flow without a genuine Free-tier env.
  - Manual Step: In a non-dev environment log in as a Free org, navigate to a Pro-gated tab (Reminders or Branding), click "Upgrade to Pro", and confirm it navigates to /settings?tab=billing — not to the mail app.
  - Reason: No "Upgrade to Pro" ProGate button visible in dev mode (dev Pro unlock hides it). Cannot test redirect flow without a genuine Free-tier env.
  - Manual Step: In a non-dev environment log in as a Free org, navigate to a Pro-gated tab (Reminders or Branding), click "Upgrade to Pro", and confirm it navigates to /settings?tab=billing — not to the mail app.
  - Reason: No "Upgrade to Pro" ProGate button visible in dev mode (dev Pro unlock hides it). Cannot test redirect flow without a genuine Free-tier env.
  - Manual Step: In a non-dev environment log in as a Free org, navigate to a Pro-gated tab (Reminders or Branding), click "Upgrade to Pro", and confirm it navigates to /settings?tab=billing — not to the mail app.
  - Reason: No "Upgrade to Pro" ProGate button visible in dev mode (dev Pro unlock hides it). Cannot test redirect flow without a genuine Free-tier env.
  - Manual Step: In a non-dev environment log in as a Free org, navigate to a Pro-gated tab (Reminders or Branding), click "Upgrade to Pro", and confirm it navigates to /settings?tab=billing — not to the mail app.
  - Reason: No "Upgrade to Pro" ProGate button visible in dev mode (dev Pro unlock hides it). Cannot test redirect flow without a genuine Free-tier env.
  - Manual Step: In a non-dev environment log in as a Free org, navigate to a Pro-gated tab (Reminders or Branding), click "Upgrade to Pro", and confirm it navigates to /settings?tab=billing — not to the mail app.
  - Reason: No "Upgrade to Pro" ProGate button visible in dev mode (dev Pro unlock hides it). Cannot test redirect flow without a genuine Free-tier env.
  - Manual Step: In a non-dev environment log in as a Free org, navigate to a Pro-gated tab (Reminders or Branding), click "Upgrade to Pro", and confirm it navigates to /settings?tab=billing — not to the mail app.
  - Reason: No "Upgrade to Pro" ProGate button visible in dev mode (dev Pro unlock hides it). Cannot test redirect flow without a genuine Free-tier env.
  - Manual Step: In a non-dev environment log in as a Free org, navigate to a Pro-gated tab (Reminders or Branding), click "Upgrade to Pro", and confirm it navigates to /settings?tab=billing — not to the mail app.
  - Error: Item was not executed due to unexpected suite interruption.
- [ ] School as hosting org — GET /api/schools/my-beneficiary returns a beneficiary with id and name — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — PASS — PASS
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
- [ ] School-to-school partnership — nearby directory includes school entries with "School" badge; partner request API returns 201 or 409 — FAIL — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — MANUAL REQUIRED — FAIL — FAIL — MANUAL REQUIRED — MANUAL REQUIRED
  - Reason: No second school found in the nearby directory (seed only has one school). Cannot test school-to-school partner request without two schools.
  - Manual Step: Seed a second school with non-null lat/lng, log in as the first school admin, open Discover, locate the second school on the map, click "+ Partner", confirm the partner request is sent, then log in as the second school admin, approve the request from the School Partners tab, and verify mutual access.
  - Reason: No second school found in the nearby directory (seed only has one school). Cannot test school-to-school partner request without two schools.
  - Manual Step: Seed a second school with non-null lat/lng, log in as the first school admin, open Discover, locate the second school on the map, click "+ Partner", confirm the partner request is sent, then log in as the second school admin, approve the request from the School Partners tab, and verify mutual access.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: No second school found in the nearby directory (seed only has one school). Cannot test school-to-school partner request without two schools.
  - Manual Step: Seed a second school with non-null lat/lng, log in as the first school admin, open Discover, locate the second school on the map, click "+ Partner", confirm the partner request is sent, then log in as the second school admin, approve the request from the School Partners tab, and verify mutual access.
  - Reason: No second school found in the nearby directory (seed only has one school). Cannot test school-to-school partner request without two schools.
  - Manual Step: Seed a second school with non-null lat/lng, log in as the first school admin, open Discover, locate the second school on the map, click "+ Partner", confirm the partner request is sent, then log in as the second school admin, approve the request from the School Partners tab, and verify mutual access.
  - Reason: No second school found in the nearby directory (seed only has one school). Cannot test school-to-school partner request without two schools.
  - Manual Step: Seed a second school with non-null lat/lng, log in as the first school admin, open Discover, locate the second school on the map, click "+ Partner", confirm the partner request is sent, then log in as the second school admin, approve the request from the School Partners tab, and verify mutual access.
  - Reason: No second school found in the nearby directory (seed only has one school). Cannot test school-to-school partner request without two schools.
  - Manual Step: Seed a second school with non-null lat/lng, log in as the first school admin, open Discover, locate the second school on the map, click "+ Partner", confirm the partner request is sent, then log in as the second school admin, approve the request from the School Partners tab, and verify mutual access.
  - Reason: No second school found in the nearby directory (seed only has one school). Cannot test school-to-school partner request without two schools.
  - Manual Step: Seed a second school with non-null lat/lng, log in as the first school admin, open Discover, locate the second school on the map, click "+ Partner", confirm the partner request is sent, then log in as the second school admin, approve the request from the School Partners tab, and verify mutual access.
  - Reason: No second school found in the nearby directory (seed only has one school). Cannot test school-to-school partner request without two schools.
  - Manual Step: Seed a second school with non-null lat/lng, log in as the first school admin, open Discover, locate the second school on the map, click "+ Partner", confirm the partner request is sent, then log in as the second school admin, approve the request from the School Partners tab, and verify mutual access.
  - Reason: No second school found in the nearby directory (seed only has one school). Cannot test school-to-school partner request without two schools.
  - Manual Step: Seed a second school with non-null lat/lng, log in as the first school admin, open Discover, locate the second school on the map, click "+ Partner", confirm the partner request is sent, then log in as the second school admin, approve the request from the School Partners tab, and verify mutual access.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: No second school found in the nearby directory (seed only has one school). Cannot test school-to-school partner request without two schools.
  - Manual Step: Seed a second school with non-null lat/lng, log in as the first school admin, open Discover, locate the second school on the map, click "+ Partner", confirm the partner request is sent, then log in as the second school admin, approve the request from the School Partners tab, and verify mutual access.
  - Reason: No second school found in the nearby directory (seed only has one school). Cannot test school-to-school partner request without two schools.
  - Manual Step: Seed a second school with non-null lat/lng, log in as the first school admin, open Discover, locate the second school on the map, click "+ Partner", confirm the partner request is sent, then log in as the second school admin, approve the request from the School Partners tab, and verify mutual access.
  - Reason: No second school found in the nearby directory (seed only has one school). Cannot test school-to-school partner request without two schools.
  - Manual Step: Seed a second school with non-null lat/lng, log in as the first school admin, open Discover, locate the second school on the map, click "+ Partner", confirm the partner request is sent, then log in as the second school admin, approve the request from the School Partners tab, and verify mutual access.
  - Reason: No second school found in the nearby directory (seed only has one school). Cannot test school-to-school partner request without two schools.
  - Manual Step: Seed a second school with non-null lat/lng, log in as the first school admin, open Discover, locate the second school on the map, click "+ Partner", confirm the partner request is sent, then log in as the second school admin, approve the request from the School Partners tab, and verify mutual access.
  - Reason: No second school found in the nearby directory (seed only has one school). Cannot test school-to-school partner request without two schools.
  - Manual Step: Seed a second school with non-null lat/lng, log in as the first school admin, open Discover, locate the second school on the map, click "+ Partner", confirm the partner request is sent, then log in as the second school admin, approve the request from the School Partners tab, and verify mutual access.
  - Error: Item was not executed due to unexpected suite interruption.
  - Reason: No second school found in the nearby directory (seed only has one school). Cannot test school-to-school partner request without two schools.
  - Manual Step: Seed a second school with non-null lat/lng, log in as the first school admin, open Discover, locate the second school on the map, click "+ Partner", confirm the partner request is sent, then log in as the second school admin, approve the request from the School Partners tab, and verify mutual access.
  - Reason: No second school found in the nearby directory (seed only has one school). Cannot test school-to-school partner request without two schools.
  - Manual Step: Seed a second school with non-null lat/lng, log in as the first school admin, open Discover, locate the second school on the map, click "+ Partner", confirm the partner request is sent, then log in as the second school admin, approve the request from the School Partners tab, and verify mutual access.
  - Reason: No second school found in the nearby directory (seed only has one school). Cannot test school-to-school partner request without two schools.
  - Manual Step: Seed a second school with non-null lat/lng, log in as the first school admin, open Discover, locate the second school on the map, click "+ Partner", confirm the partner request is sent, then log in as the second school admin, approve the request from the School Partners tab, and verify mutual access.
  - Reason: No second school found in the nearby directory (seed only has one school). Cannot test school-to-school partner request without two schools.
  - Manual Step: Seed a second school with non-null lat/lng, log in as the first school admin, open Discover, locate the second school on the map, click "+ Partner", confirm the partner request is sent, then log in as the second school admin, approve the request from the School Partners tab, and verify mutual access.
  - Error: page.waitForResponse: Timeout 20000ms exceeded while waiting for event "response"
  - URL: http://localhost:5173/discover
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-107-2026-06-27T01-37-02-201Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-35-02-748Z.zip
  - Error: page.waitForResponse: Timeout 20000ms exceeded while waiting for event "response"
  - URL: http://localhost:5173/discover
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-107-2026-06-27T01-30-10-605Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-27-24-182Z.zip
  - Error: page.waitForResponse: Timeout 20000ms exceeded while waiting for event "response"
  - URL: http://localhost:5173/discover
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-107-2026-06-27T01-23-40-279Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-20-54-000Z.zip
  - Error: page.waitForResponse: Timeout 20000ms exceeded while waiting for event "response"
  - URL: http://localhost:5173/discover
  - Screenshot: /Users/abhay/RTB/GoodHours/tests/artifacts/screenshots/item-107-2026-06-27T01-05-31-894Z.png
  - Trace: /Users/abhay/RTB/GoodHours/tests/artifacts/traces/school-admin-2026-06-27T01-02-45-287Z.zip
  - Error: Item was not executed due to unexpected suite interruption.
- [ ] School-to-school partnership — Partners page loads; "School Partners" tab exists and renders request content — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — FAIL — FAIL — PASS — PASS — PASS — PASS — PASS — PASS — PASS — FAIL — FAIL — PASS — PASS
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
  - Error: Item was not executed due to unexpected suite interruption.
