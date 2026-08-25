-- Convert Cohort.status from a free-form String column to a real Postgres
-- enum (goal §17.1), matching the 3-value set already documented in the
-- schema comment (DRAFT | PUBLISHED | ARCHIVED). 8 consumer files
-- (lib/launchCenter.ts, lib/cohortAccess.ts, routes/schools.ts,
-- routes/messages.ts, routes/auth.ts, routes/cohorts.ts,
-- services/canvasIntegration.ts, services/googleClassroomIntegration.ts) —
-- the highest file count converted so far this session, audited in full.
--
-- Every write site is either an inline string literal, a schema default, a
-- proper Zod-validated update schema that never includes `status`
-- (PUT /api/cohorts/:id), or the repeated pattern in both integration
-- services —
-- `plan.archived ? "ARCHIVED" : existingCohort.status === "ARCHIVED" ? "PUBLISHED" : existingCohort.status`
-- — a nested ternary whose branches are all literals or the already-typed
-- `existingCohort.status` field; confirmed safe by a clean `tsc` after the
-- Prisma-client regen. No `findMany`/`findFirst` call in any consumer file
-- filters on a caller-controlled status value, so no associated
-- validation-gap fix was needed for this round.
--
-- As with every prior enum conversion this session, Prisma's auto-generated
-- migration for this diff does DROP COLUMN / ADD COLUMN, which would
-- silently destroy existing data. Hand-written instead using the standard
-- in-place conversion (ALTER COLUMN ... TYPE ... USING col::text::enum). No
-- existing index on this column (the only index on this table is on
-- schoolId).

-- CreateEnum
CREATE TYPE "CohortStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- AlterTable: convert in place, preserving existing data.
ALTER TABLE "Cohort"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "CohortStatus" USING "status"::text::"CohortStatus",
  ALTER COLUMN "status" SET DEFAULT 'DRAFT';
