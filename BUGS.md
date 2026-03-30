# GoodHours — Bug Report

Tested: 2026-03-27
Tester: Automated browser testing (Claude Code)
Environment: https://goodhours.app (production), logged in as Principal Johnson (SCHOOL_ADMIN)

---

## BUG-001: Onboarding "Skip this step" navigates to wrong page — NOT A BUG

**Status:** ~~NOT A BUG~~ — Verified working correctly via live testing 2026-03-27
**Notes:** `Dashboard.tsx:140` calls `setOnboardingStep(s => s + 1)` which correctly advances step 2 → step 3 ("Create a Cohort & Invite Students"). The `/discover` navigation observed in the prior session was likely from a separate CTA click, not the "Skip this step" button. Confirmed not a bug.

---

## BUG-002: /partners URL redirects to /dashboard instead of Partners page — FIXED

**Status:** Fixed — `App.tsx` now includes `<Route path="/partners" element={<SchoolBeneficiaries />} />` as an alias for `/beneficiaries`.

---

## BUG-003: "Send Invite" button shows no feedback when email is empty — FIXED

**Status:** Fixed — `Beneficiaries.tsx` `handleInvite` now shows inline red error text below the email input when field is empty.

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

## BUG-005: "Add from Directory" radius filter ignored when text search is active — FIXED

**Status:** Fixed — `Beneficiaries.tsx` `runSmartSearch` now always passes `lat/lng/radius` when school location is available, even with a text query. Also fixed blank state on tab open: when no location, falls back to global text search instead of showing empty.

---

## BUG-006: "Send Invite" with empty email triggers no validation — FIXED (same as BUG-003)

---

## BUG-007: Native browser dialogs (`alert`/`confirm`) used throughout — FIXED

**Status:** Fixed — All `alert()`/`window.confirm()` calls replaced with in-UI React components:
- `Beneficiaries.tsx`: toast banner on invite success, inline confirm panel on remove
- `Cohorts.tsx`: inline confirm panel + toast banner on publish
- `CohortDetail.tsx`: inline confirm panel + toast banner on publish

---

## BUG-008: Cohort invitation "Sent" column shows date before invitations are sent — FIXED

**Status:** Fixed — Column renamed from "Sent" to "Added" in `CohortDetail.tsx`, accurately reflecting that it shows the record creation date, not when the email was dispatched.

---

## BUG-009: Notification and Privacy settings fail to save (HTTP 500) — FIXED

**Status:** Fixed — Added `notificationPreferences String?` and `messagePreferences String?` to `User` model in `schema.prisma`. Ran `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS` migration directly on Neon production DB via MCP.

---

## BUG-010: Error messages in Settings Notifications/Privacy tabs use green (success) styling — FIXED

**Status:** Fixed — Added `notifIsError` and `privacyIsError` state booleans to `Settings.tsx`. Message banners now use `bg-red-50` on error and `bg-green-50` on success.

---

## What Works Correctly

- "Approve & Invite" button (Add from Directory): Updates to "Approved ✓" and increments counter.
- "Create Custom" form: Validates required fields, creates partner, redirects to Approved tab.
- Category filter chips (Add from Directory): Toggle and highlight correctly.
- Directory text search: Returns results with highlighted matched terms.
- Approved tab partner list: Renders all partners with invite flow and remove option.
- Discover map: Radius filter works correctly; shows accurate partner counts by radius; distance calculations are accurate (verified via haversine).
- Settings → Profile: School name, domain, required hours, zip codes, address fields — all save correctly.
- Settings → Security: Change Password validates mismatched passwords inline (no browser dialogs). Delete Account shows proper React confirmation UI (type "DELETE" to confirm, "Cancel" button works).
- Settings → Data: Export Activity Log (CSV) button renders correctly.
- Submissions page: All three tabs (Pending, Approved, Rejected) render with correct empty-state messages.
- Cohorts → Cohort detail: Students, Analytics, Invitations, and Import tabs all render correctly. Add Student: browser native required-field validation fires on empty email. Import tab shows CSV format instructions.
- Onboarding wizard (Dashboard): "Skip this step →" correctly advances to next step (NOT a bug — see BUG-001 update).
