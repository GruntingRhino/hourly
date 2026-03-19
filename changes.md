# Changes Required — Based on QA vs. spec.md

This file lists features that are missing or broken in the app.

**Last verified: 2026-03-19 against goodhours.app**

Items that were previously listed and are now confirmed working have been removed:
- ~~Item 3: "+ Submit Hours" button~~ — ✅ FIXED (form opens with org name, date, hours, description)
- ~~Item 5: Opportunity detail / sign-up page~~ — ✅ FIXED (cards navigate to `/opportunity/:id` with sign-up button)
- ~~Item 8: Event reminders / notifications~~ — ✅ PRESENT (Notifications tab in student Settings has Event Reminders email + in-app toggles)

---

## **1. Beneficiary Discover Page (HIGH PRIORITY)**

**Spec ref: §4.2.3**

The spec calls for a dedicated "Beneficiary Discover Page" as the school admin's primary tool for browsing and approving nearby beneficiaries. It should be:
- A Zillow-style UI: map on one side, scrollable list on the other
- Map shows the school's location + nearby beneficiaries as pins
- List is filtered by proximity (zip-based) and categorized
- "Blue-check style" approval button on each beneficiary card
- Persistently accessible (not just on first visit)

**Current state:** `/discover` redirects to dashboard. The "Add from Directory" tab under Partners is a plain text search with no map, no zip proximity filter, and no category filter.

**What to build:**
- New route: `/discover` (accessible from school admin nav)
- Split-pane layout: map (left/main) + list (right/sidebar)
- Map uses school's ZIP codes (already in Settings) to center and show nearby beneficiaries as markers
- List shows beneficiaries sorted by distance, with category badges
- Each card has an "Approve & Invite" button (same action as current directory)
- Filter controls: category dropdown, distance radius slider
- Consider using a free map library (Leaflet.js) or Google Maps

---

## **2. Student Sign-Up Flow — Calendar UX (HIGH PRIORITY)**

**Spec ref: §4.4.2**

The spec requires a **calendar-based** sign-up UX for students browsing opportunities. Currently Browse is a flat list only.

**What to build:**
- Add a calendar/month view toggle to the Browse page
- Opportunities are shown as events on calendar dates
- Clicking a date shows available opportunities that day
- Clicking an opportunity opens a detail view with time slots and a "Sign Up" button (detail page now works, just needs calendar entry point)

---

## **3. School Registration Flow — Type-Ahead Search + Magic Link (MEDIUM PRIORITY)**

**Spec ref: §4.2.1**

The `/school/register` page just has a "Continue with Google" button. The spec requires a proper flow before OAuth:

**What to build:**
- School search input with type-ahead on the register page
- Search queries the schools database (Public_Schools.csv / Private_Schools.csv already imported)
- If school is already registered: show message "This school is already registered. Contact [email] to get access."
- If school is not registered: show "Register" button → trigger Google OAuth → then magic link email
- The `/school/register` and `/school/verify-registration` routes exist on the backend — wire up the frontend search step

---

## **4. Beneficiary Admin Dashboard — BLANK PAGE (CRITICAL BUG — HIGH PRIORITY)**

**Spec ref: §4.3**

**When logging in as a beneficiary admin (`volunteer@greenearth.org`), the entire dashboard is a blank white page.** Only the GoodHours logo and a "Log out" button are visible. There is no navigation, no content, no routes that render anything.

This means the entire beneficiary admin role is non-functional in production. Items 5–7 below (opportunity creation, student signups, hour approval) cannot be reached at all.

**What to fix:**
- Identify why the BENEFICIARY_ADMIN role renders a blank layout
- The `App.tsx` routing likely has no routes defined for `BENEFICIARY_ADMIN` role, or the layout component crashes silently
- Restore/build the beneficiary admin nav and dashboard: should show pending school invitations, their opportunities, and student signups

---

## **5. Beneficiary Admin Role — Opportunity Creation (MEDIUM PRIORITY)**

**Spec ref: §4.3.2**

**Blocked by item 4 above (blank dashboard).** Once the dashboard is fixed, verify and complete:
- Calendar-based opportunity creation UI (start date, end date, time slots, work type, requirements)
- Student signup management: view count, reveal student details only after attendance
- Define expectations for volunteers
- Approve/reject hours submitted by students
- Track school invitations: Received / Accepted / Declined

---

## **6. Zip-Based Proximity Filter in Partner Directory (MEDIUM PRIORITY)**

**Spec ref: §4.2.2**

The "Add from Directory" search has a text input only — no zip radius, no category filter, no auto-loading by proximity.

**What to build:**
- Auto-load results near the school's ZIP codes (from Settings) on page load
- Add a "Within X miles" filter (server-side geocoding data already exists via `server/scripts/geocode-directory.ts`)
- Add a category filter dropdown (EO categories already in the database)

---

## **7. Beneficiary Invitation Flows (LOW PRIORITY)**

**Spec ref: §4.3.1**

**Blocked by item 4 above (blank beneficiary admin dashboard).** Once the dashboard is fixed, confirm:
- When school clicks "Approve & Invite" in the directory, a registration email is sent to the beneficiary
- Existing beneficiaries in the directory receive "new school wants to partner" notification with Accept/Decline
- Beneficiary can update their pre-filled public profile data after registering

---

## Notes for Implementation

- Schools table already has ZIP codes stored (`School ZIP Codes` field in Settings)
- Geocoding scripts exist at `server/scripts/geocode-directory.ts`
- EO beneficiary data is already imported (eo1.csv through eo4.csv)
- The `SelfSubmittedRequest` model exists in the Prisma schema and the frontend form now works
- Leaflet.js is a good free option for the map (no API key needed)
- Check `server/src/routes/beneficiaries.ts` for proximity search endpoints before building new ones
- **Item 4 (blank beneficiary admin) is likely a routing issue in `client/src/App.tsx` — check how `BENEFICIARY_ADMIN` role is handled**
