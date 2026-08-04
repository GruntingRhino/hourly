-- Convert ServiceSession.status and .verificationStatus from free-form
-- String columns to real Postgres enums (goal §17.1) — the last core model
-- from this session's §17.1 sweep. 11 consumer files, 10 create/update call
-- sites, all individually audited.
--
-- The schema comment for `status` documented 7 values (COMMITTED,
-- PENDING_VERIFICATION, VERIFIED, REJECTED, PENDING_CHECKIN, CHECKED_IN,
-- CHECKED_OUT), but auditing every write site found it was stale in TWO
-- ways:
--
-- 1. routes/signups.ts's cancel handler writes
--    `data: { status: "CANCELLED" } ` directly (tx.serviceSession.updateMany)
--    — a literal not in the comment at all. Found by grepping every
--    `status:` line inside a serviceSession write block.
--
-- 2. routes/signups.ts's signup-confirmation handler writes
--    `status: status === "CONFIRMED" ? "PENDING_CHECKIN" : "WAITLISTED"`,
--    where `status` is a shared variable also used for the Signup model's
--    own status field — so the "WAITLISTED" branch silently reaches
--    ServiceSession.status too. This one was NOT caught by manual literal
--    grepping (the value comes from a ternary substitution, not a direct
--    string next to the write call) — it was caught only because
--    converting the column to a strict enum made `npx tsc --noEmit` fail
--    with a real type error until WAITLISTED was added to the enum. This is
--    the third stale/incomplete schema comment found this session
--    (following StudentCohortMembership.source and
--    SelfSubmittedRequest.status), and the first one caught by the
--    TypeScript compiler itself rather than manual code reading — a
--    stronger signal that the final 9-value enum below is complete, since a
--    clean tsc after this conversion guarantees every write site's literal
--    is a member of the enum.
--
-- verificationStatus's 3-value comment (PENDING, APPROVED, REJECTED) was
-- accurate — every write site uses one of exactly these three.
--
-- No findMany/count call in any of the 11 consumer files filters on a
-- caller-controlled status/verificationStatus value — every filter is an
-- inline literal. No caller-controlled input reaches either column, so no
-- associated validation-gap fix was needed for this round.
--
-- This table has a CHECK constraint (added earlier this session,
-- ServiceSession_verified_requires_checkout) referencing `status` as text;
-- Postgres cannot ALTER COLUMN ... TYPE while a CHECK constraint compares
-- the column against an untyped text literal ("operator does not exist:
-- ... <> text"), confirmed by testing the naive ALTER on a disposable DB
-- first. Fixed by dropping the constraint, converting the column, then
-- recreating the same constraint with an explicit enum cast on the
-- literal.
--
-- As with every prior enum conversion this session, Prisma's auto-generated
-- migration for this diff does DROP COLUMN / ADD COLUMN, which would
-- silently destroy existing data. Hand-written instead using the standard
-- in-place conversion (ALTER COLUMN ... TYPE ... USING col::text::enum).
-- status and verificationStatus are each covered by three composite
-- indexes; Postgres rebuilds indexes automatically as part of
-- ALTER COLUMN ... TYPE (already verified for this exact pattern earlier
-- this session), so no explicit DROP/CREATE INDEX statements are needed.

-- CreateEnum
CREATE TYPE "ServiceSessionStatus" AS ENUM ('COMMITTED', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'PENDING_CHECKIN', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'WAITLISTED');

-- CreateEnum
CREATE TYPE "ServiceSessionVerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- Drop the CHECK constraint so status can be converted; recreated below
-- with an explicit enum cast. IF EXISTS because this constraint is a raw
-- SQL addition with no schema.prisma representation, so `prisma db push`
-- (used to sync this session's locally-managed dev databases, which have
-- no _prisma_migrations bookkeeping) never applies it — a real environment
-- may or may not already have it depending on whether it was reached via
-- full migration replay or db push.
ALTER TABLE "ServiceSession" DROP CONSTRAINT IF EXISTS "ServiceSession_verified_requires_checkout";

-- AlterTable: convert both columns in place, preserving existing data.
ALTER TABLE "ServiceSession"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "ServiceSessionStatus" USING "status"::text::"ServiceSessionStatus",
  ALTER COLUMN "status" SET DEFAULT 'COMMITTED';

ALTER TABLE "ServiceSession"
  ALTER COLUMN "verificationStatus" DROP DEFAULT,
  ALTER COLUMN "verificationStatus" TYPE "ServiceSessionVerificationStatus" USING "verificationStatus"::text::"ServiceSessionVerificationStatus",
  ALTER COLUMN "verificationStatus" SET DEFAULT 'PENDING';

-- Recreate the CHECK constraint with an explicit cast on the enum literal.
-- Kept NOT VALID, matching the original migration's intent (applies to all
-- new/updated rows immediately without failing on any pre-existing
-- violation in legacy data).
ALTER TABLE "ServiceSession"
ADD CONSTRAINT "ServiceSession_verified_requires_checkout"
CHECK (status <> 'VERIFIED'::"ServiceSessionStatus" OR "checkOutTime" IS NOT NULL)
NOT VALID;
