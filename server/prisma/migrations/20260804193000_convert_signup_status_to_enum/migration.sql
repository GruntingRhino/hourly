-- Convert Signup.status from a free-form String column to a real Postgres
-- enum (goal §17.1), matching the 4-value set already documented in the
-- schema comment (CONFIRMED | WAITLISTED | CANCELLED | NO_SHOW). This is the
-- legacy Signup model (paired with the legacy Opportunity/Organization
-- models converted in the two prior commits), with 4 consumer files.
--
-- Audited every write site across routes/signups.ts, routes/opportunities.ts,
-- routes/organizations.ts, and routes/auth.ts: every write is either an
-- inline string literal or the computed
-- `confirmedCount >= opp.capacity ? "WAITLISTED" : "CONFIRMED"` ternary in
-- POST /api/signups, which TypeScript narrows to a literal union
-- ("WAITLISTED" | "CONFIRMED") — confirmed safe by a clean `tsc` after the
-- Prisma-client regen for this conversion. No caller-controlled input
-- (query param or request body) ever reaches this column, so no associated
-- validation-gap fix was needed for this round.
--
-- As with every prior enum conversion this session, Prisma's auto-generated
-- migration for this diff does DROP COLUMN / ADD COLUMN, which would
-- silently destroy existing data. Hand-written instead using the standard
-- in-place conversion (ALTER COLUMN ... TYPE ... USING col::text::enum). No
-- existing index on this column.

-- CreateEnum
CREATE TYPE "SignupStatus" AS ENUM ('CONFIRMED', 'WAITLISTED', 'CANCELLED', 'NO_SHOW');

-- AlterTable: convert in place, preserving existing data.
ALTER TABLE "Signup"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "SignupStatus" USING "status"::text::"SignupStatus",
  ALTER COLUMN "status" SET DEFAULT 'CONFIRMED';
