# Hourly App — Fix Critical Pre-Deployment Issues

A QA audit was just completed on the Hourly app. The app is functionally solid but has 3 critical issues and 1 medium issue that must be resolved before it can be deployed. Fix every item below, verify each fix, then confirm all issues are resolved.

Do not touch any existing functionality. Only fix what is listed here.

---

## Critical Issue 1 — Exposed Database Credentials in Git

The file `server/.env` is currently tracked by git and contains real Neon database credentials. This is a serious security vulnerability.

**Steps to fix:**

1. Remove `server/.env` from git tracking without deleting the file:
```bash
git rm --cached server/.env
git commit -m "Remove .env from git tracking"
```

2. Verify `.gitignore` at the root includes `server/.env` and `.env` — the audit already created a root `.gitignore` but confirm it covers the server directory.

3. **Rotate the Neon database credentials.** The exposed credentials are:
- Connection string contains `neondb_owner:npg_dH1oc2rmtqAZ` — these must be considered compromised.
- Go to the Neon dashboard, rotate/regenerate the database password, and update `server/.env` with the new credentials.
- Verify the server still connects to the database after rotation by starting the dev server and confirming Prisma Studio opens at `localhost:5555`.

4. Verify the fix:
```bash
git log --all --full-history -- server/.env
# Should show the file was removed from tracking
git ls-files server/.env
# Should return nothing (not tracked)
```

---

## Critical Issue 2 — Weak JWT Secret

The current `JWT_SECRET` in `server/.env` is `"hourly-dev-secret-change-in-production"`. This must be replaced with a cryptographically strong random string.

**Steps to fix:**

1. Generate a strong secret:
```bash
openssl rand -hex 64
```

2. Replace the `JWT_SECRET` value in `server/.env` with the generated string.

3. Update `server/.env.example` to show `JWT_SECRET=<generate with: openssl rand -hex 64>` so the requirement is documented without exposing a real value.

4. Verify the fix: restart the server, sign in with a test account, confirm the JWT is issued and accepted correctly (dashboard loads, session persists on refresh).

---

## Critical Issue 3 — Prisma Migrations Out of Sync

The database schema was kept in sync using `prisma db push` rather than proper migrations. The migration file `20260212165358_init` is outdated and not reflected in `_prisma_migrations`. Running `prisma migrate deploy` in production would attempt to re-run the init migration against an existing schema and fail.

**Steps to fix:**

1. Baseline the old migration so Prisma marks it as already applied without running it:
```bash
npx prisma migrate resolve --applied 20260212165358_init
```

2. Create a fresh migration that captures the current actual schema state:
```bash
npx prisma migrate dev --name "sync"
```

3. Verify the fix:
```bash
npx prisma migrate status
# Should show: "All migrations have been applied"
```

4. Confirm the database still works correctly after the migration sync — open Prisma Studio at `localhost:5555` and verify all tables and records are intact. Create a test record and confirm it saves.

---

## Medium Issue 4 — No Input Length Validation on String Fields

String fields on sign-up forms (name, organization name, school name, etc.) accept inputs of unlimited length. Add `.max(255)` validation to all text fields in the auth Zod schemas in `server/src/routes/auth.ts` (or wherever signup validation is defined).

**Fields to cap at 255 characters:**
- Name (student)
- Organization Name
- School Name
- Email (also enforce valid email format if not already)
- Biography / Description fields — cap at 1000 characters
- ZIP code — enforce exactly 5 numeric digits

**Steps to fix:**

1. Locate the Zod validation schemas for signup in the server routes.
2. Add `.max(255)` to all short text fields, `.max(1000)` to bio/description fields, and `.regex(/^\d{5}$/, "Invalid ZIP code")` to ZIP fields.
3. Test: attempt to submit a signup form with a 300-character name — confirm the server returns a 400 error with a clear validation message.
4. Confirm valid inputs still work normally.

---

## Low Issue 5 — ZIP Code 02101 Returns Undefined

The `zipcodes` npm package returns `undefined` for ZIP code `02101` because it is a PO Box ZIP. This causes silent failure in distance sorting.

**Steps to fix:**

1. In the distance sorting logic (wherever `zipcodes.lookup()` is called), add a fallback:
```typescript
const coords = zipcodes.lookup(zip);
if (!coords) {
  // Skip distance sort for this entry, place it after entries with valid coords
  return Infinity; // or handle gracefully
}
```

2. Test by setting a school's ZIP to `02101` — confirm the app does not crash and opportunities still display (just without distance sorting applied to that school).

---

## Verification After All Fixes

Once all fixes are applied:

1. Run `npm run build` from the client directory — must produce zero errors
2. Run `npx tsc --noEmit` in both client and server — must be clean
3. Run `npx prisma migrate status` — must show all migrations applied
4. Start the dev server and open `localhost:5173` — sign in with all three account types and confirm sessions work (JWT is valid)
5. Confirm `git ls-files server/.env` returns nothing
6. Confirm `server/.env.example` documents all required variables without exposing real values
7. Report back with confirmation that every issue above is resolved
