# GoodHours — Bug Report

Tested: 2026-03-27
Tester: Automated browser testing (Claude Code)
Environment: https://goodhours.app (production), logged in as Principal Johnson (SCHOOL_ADMIN)

---

## BUG-001: Onboarding "Skip this step" navigates to wrong page

**Severity:** Medium
**Page:** Dashboard onboarding wizard (step 2)
**Steps to reproduce:**
1. Log in as a school admin with incomplete onboarding
2. Reach onboarding step 2 ("Add your school address")
3. Click "Skip this step"

**Expected:** Advance to step 3 within the onboarding flow
**Actual:** Navigates to `/discover` — skips the rest of onboarding entirely

---

## BUG-002: /partners URL redirects to /dashboard instead of Partners page

**Severity:** Low
**Steps to reproduce:**
1. Navigate directly to `https://goodhours.app/partners`

**Expected:** Load the Community Partners page (same as `/beneficiaries`)
**Actual:** Redirects to `/dashboard`. The Partners nav link correctly uses `/beneficiaries`, but `/partners` is not an alias.

---

## BUG-003: "Send Invite" button shows no feedback when email is empty

**Severity:** Medium
**Page:** Partners → Approved tab
**Steps to reproduce:**
1. Go to Community Partners → Approved
2. Leave the "Email to send invitation" field empty
3. Click "Send Invite"

**Expected:** Validation error ("Please enter an email address") or toast notification
**Actual:** Nothing happens — no error message, no toast, no visual change. Silent failure.

---

## BUG-004: Discover map hard-capped at 100 pins regardless of radius

**Severity:** High
**Page:** Discover (`/discover`)
**Root cause:** `Discover.tsx:204` had `&limit=100` hardcoded in the API call. Changing the radius filter sent a new request but always requested exactly 100 results. The server supports up to 200 (now raised to 500).
**Steps to reproduce:**
1. Go to Discover page
2. Note result count shown in header (e.g., "847 partners within 5 miles" from real DB total)
3. Change radius from 5mi → 50mi
4. Map shows no additional pins — stays at 100 regardless

**Expected:** All (or at least far more) partners within the selected radius shown as map pins
**Actual:** Always exactly 100 markers on the map; the header showed the correct real total (from a separate COUNT query) creating a mismatch — e.g., "847 partners within 5mi" but only 100 pins visible.

**Fix applied:** Changed `limit=100` → `limit=500` in the API call; raised server cap from 200 → 500; updated header to show "Showing X of Y" when results are capped.

---

## BUG-005: "Add from Directory" radius filter ignored when text search is active

**Severity:** High
**Page:** Partners → Add from Directory
**Steps to reproduce:**
1. Go to Partners → Add from Directory
2. Set radius to "10 mi"
3. Type "food bank" in the search field

**Expected:** Results filtered to food banks within 10 miles of the school
**Actual:** Results are returned nationally (e.g., food banks in Idaho, Montana, Nebraska, Colorado) — the radius filter has no effect when a text search query is present. The radius dropdown appears functional but does not constrain text search results.

---

## BUG-006: "Send Invite" with empty email triggers no validation

**Severity:** Medium
**Page:** Partners → Approved
**Details:** The email input has `type="email"` but browser native validation is not triggered (likely because the button is not inside a `<form>` element or the field lacks a `required` attribute). Clicking "Send Invite" with an empty field does nothing — no error, no toast, no feedback.

---

## What Works Correctly

- "Approve & Invite" button (Add from Directory): Updates to "Approved ✓" and increments counter.
- "Create Custom" form: Validates required fields, creates partner, redirects to Approved tab.
- Category filter chips (Add from Directory): Toggle and highlight correctly.
- Directory text search: Returns results with highlighted matched terms.
- Approved tab partner list: Renders all partners with invite flow and remove option.
