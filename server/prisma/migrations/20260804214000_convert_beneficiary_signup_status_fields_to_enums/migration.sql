-- Convert BeneficiarySignup.status, .verificationStatus, and .attendance
-- from free-form String columns to real Postgres enums (goal §17.1),
-- matching the value sets already documented in each schema comment:
-- status: CONFIRMED | WAITLISTED | CANCELLED | NO_SHOW
-- verificationStatus: PENDING | APPROVED | REJECTED
-- attendance: ATTENDED | NO_SHOW | null
--
-- 10 consumer files (lib/schoolRules.ts, lib/reminders.ts,
-- lib/hoursCalculator.ts, lib/studentProgress.ts, lib/eventReminders.ts,
-- routes/schools.ts, routes/reports.ts, routes/auth.ts,
-- routes/beneficiaries.ts, routes/cohorts.ts), 11 create/update call sites
-- plus the bulk attendance route, all individually audited.
--
-- Every write is an inline string literal, a computed literal ternary
-- (`confirmedCount >= liveSlot.capacity ? "WAITLISTED" : "CONFIRMED"`,
-- confirmed safe by a clean tsc after the Prisma-client regen), or reuses
-- an already-Prisma-typed field. Every literal actually written for each
-- column was cross-checked against its schema comment's documented set —
-- unlike two earlier rounds this session (StudentCohortMembership.source,
-- SelfSubmittedRequest.status), all three comments here were accurate, no
-- undocumented value found.
--
-- While auditing, found and fixed two real gaps in routes/beneficiaries.ts,
-- both fixed in the same commit as this migration:
--
-- 1. GET /:id/signups read `req.query.status as string | undefined` and
--    passed it straight into a `verificationStatus` Prisma filter — same
--    bug class as every other status-filter gap found this session. Fixed
--    with a z.enum(["PENDING", "APPROVED", "REJECTED"]) validated via
--    safeParse, returning 400 on an invalid value.
--
-- 2. POST /:id/opportunities/:oppId/attendance (bulk no-show/attended
--    recording) parsed `req.body` via a raw `as {...}` cast and validated
--    `attendance` with a manual `Set.has()` check that left the value typed
--    as plain `string` — runtime-safe but would not have caught a TS
--    compile error if an invalid literal were ever assigned to the new
--    enum column, and was inconsistent with this file's Zod-based
--    validation elsewhere. Replaced with a proper
--    z.object({ records: z.array(z.object({ attendance: z.enum([...]) })) })
--    schema, giving both compile-time and runtime safety.
--
-- As with every prior enum conversion this session, Prisma's auto-generated
-- migration for this diff does DROP COLUMN / ADD COLUMN, which would
-- silently destroy existing data. Hand-written instead using the standard
-- in-place conversion (ALTER COLUMN ... TYPE ... USING col::text::enum).
-- status and verificationStatus are each covered by three composite
-- indexes (studentId+verificationStatus+status, slotId+status,
-- status+verificationStatus); Postgres rebuilds indexes automatically as
-- part of ALTER COLUMN ... TYPE (already verified for this exact pattern
-- earlier this session), so no explicit DROP/CREATE INDEX statements are
-- needed here. attendance has no index.

-- CreateEnum
CREATE TYPE "BeneficiarySignupStatus" AS ENUM ('CONFIRMED', 'WAITLISTED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "BeneficiarySignupVerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BeneficiarySignupAttendance" AS ENUM ('ATTENDED', 'NO_SHOW');

-- AlterTable: convert all three columns in place, preserving existing data.
ALTER TABLE "BeneficiarySignup"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "BeneficiarySignupStatus" USING "status"::text::"BeneficiarySignupStatus",
  ALTER COLUMN "status" SET DEFAULT 'CONFIRMED';

ALTER TABLE "BeneficiarySignup"
  ALTER COLUMN "verificationStatus" DROP DEFAULT,
  ALTER COLUMN "verificationStatus" TYPE "BeneficiarySignupVerificationStatus" USING "verificationStatus"::text::"BeneficiarySignupVerificationStatus",
  ALTER COLUMN "verificationStatus" SET DEFAULT 'PENDING';

ALTER TABLE "BeneficiarySignup"
  ALTER COLUMN "attendance" TYPE "BeneficiarySignupAttendance" USING "attendance"::text::"BeneficiarySignupAttendance";
