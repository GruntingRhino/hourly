# Changes Required — Based on QA vs. spec.md

This file lists features that are missing or broken in the app, derived from testing goodhours.app against spec.md.

---

## 1. Beneficiary Discover Page (HIGH PRIORITY)

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

## 2. Student Sign-Up Flow — Calendar UX (HIGH PRIORITY)

**Spec ref: §4.4.2**

The spec requires a **calendar-based** sign-up UX for students browsing opportunities. Currently Browse is a flat list.

**What to build:**
- Add a calendar/month view toggle to the Browse page
- Opportunities are shown as events on calendar dates
- Clicking a date shows available opportunities that day
- Clicking an opportunity opens a detail view with time slots and a "Sign Up" button
- The opportunity card in list view should also be clickable → detail page

---

## 3. "+ Submit Hours" Button Broken (BUG — HIGH PRIORITY)

**Spec ref: §4.4.2**

Clicking the "+ Submit Hours" button on `/submit` does nothing — no modal, no navigation. Students cannot self-submit hours.

**What to fix:**
- The button should open a modal or navigate to a form with fields:
  - Organization name
  - Date of service
  - Hours worked
  - Description / type of work
  - Supporting notes (optional)
- On submit, creates a `SelfSubmittedRequest` pending school approval
- After submission, item appears in the list on `/submit` with PENDING status

---

## 4. School Registration Flow — Type-Ahead Search + Magic Link (MEDIUM PRIORITY)

**Spec ref: §4.2.1**

The public landing page just has a "Sign in with Google" button. The spec requires a proper registration flow:

**What to build:**
- On the landing page (or a `/register` page), show a school search input with type-ahead
- Search queries the schools database (Public_Schools.csv / Private_Schools.csv already imported)
- If school is already registered: show message "This school is already registered. Contact [email] to get access."
- If school is not registered: show "Register" button → trigger magic link email to the Google-authenticated user
- The `/school/register` and `/school/verify-registration` routes may exist on the backend — wire up the frontend

---

## 5. Opportunity Detail / Sign-Up Page (MEDIUM PRIORITY)

**Spec ref: §4.4.2**

Clicking opportunity cards in Browse does nothing. Students need to be able to:
- Click a card → navigate to `/opportunities/:id`
- See: description, requirements, time slots, location, organization info
- See capacity (already shown in list) and sign up for a specific time slot
- After signing up, opportunity appears in "Upcoming Opportunities" on their dashboard

---

## 6. Beneficiary Admin Role — Opportunity Creation (MEDIUM PRIORITY)

**Spec ref: §4.3.2**

Need to verify and complete the beneficiary admin experience:
- Calendar-based opportunity creation UI (start date, end date, time slots, work type, requirements)
- Student signup management: view count, reveal student details only after attendance
- Define expectations for volunteers
- Approve/reject hours submitted by students

---

## 7. Zip-Based Proximity Filter in Partner Directory (MEDIUM PRIORITY)

**Spec ref: §4.2.2**

The "Add from Directory" search has a text input only. The spec calls for zip-based proximity browsing.

**What to build:**
- Auto-load results near the school's ZIP codes (from Settings) on page load
- Add a "Within X miles" filter (already has server-side data with lat/lng from geocoding scripts)
- Add a category filter dropdown (EO categories already in the database)

---

## 8. Event Reminders / Notifications for Students (LOW PRIORITY)

**Spec ref: §4.4.2**

No visible reminder or notification UI. Once sign-up flow is working, add:
- Email reminders for upcoming opportunities (day before, morning of)
- In-app notification badge or list

---

## 9. Beneficiary Invitation Flows (LOW PRIORITY)

**Spec ref: §4.3.1**

Need to confirm/complete:
- When school approves a beneficiary, email is sent with registration link
- Existing beneficiaries in directory receive "new school wants to partner" notification with Accept/Decline
- Beneficiary can update their pre-filled public profile data after registering

---

## Notes for Implementation

- Schools table already has ZIP codes stored (`School ZIP Codes` field in Settings)
- Geocoding scripts exist at `server/scripts/geocode-directory.ts`
- EO beneficiary data is already imported (eo1.csv through eo4.csv)
- The `SelfSubmittedRequest` model exists in the Prisma schema — just wire up the frontend form
- Leaflet.js is a good free option for the map (no API key needed)
- The `server/src/routes/beneficiaries.ts` likely has proximity search endpoints already — check before building new ones
