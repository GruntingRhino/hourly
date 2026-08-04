-- Convert SchoolLaunchBug.severity and .status from free-form String to real
-- Postgres enums, matching the values Zod already enforces at the API layer
-- (routes/schools.ts's launchBugCreateSchema/launchBugUpdateSchema).
--
-- Prisma's naive auto-generated migration for this diff DROPs and
-- RECREATEs both columns, which would silently destroy every existing row's
-- data. Hand-written instead to convert the column type in place via
-- `USING ...::text::enum`, which preserves existing values.

-- CreateEnum
CREATE TYPE "LaunchBugSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "LaunchBugStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'BLOCKED', 'FIXED', 'MONITORING', 'CLOSED');

-- AlterTable: convert in place, preserving existing data. The existing
-- indexes on these columns (from 20260228090000_launch_center) survive an
-- in-place ALTER COLUMN TYPE automatically and must not be recreated here.
ALTER TABLE "SchoolLaunchBug"
  ALTER COLUMN "severity" DROP DEFAULT,
  ALTER COLUMN "severity" TYPE "LaunchBugSeverity" USING "severity"::text::"LaunchBugSeverity",
  ALTER COLUMN "severity" SET DEFAULT 'MEDIUM',
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "LaunchBugStatus" USING "status"::text::"LaunchBugStatus",
  ALTER COLUMN "status" SET DEFAULT 'OPEN';
