-- Convert StudentCohortMembership.source from a free-form String column to
-- a real Postgres enum (goal §17.1). The schema comment documented only 3
-- values (MANUAL, INVITATION, CANVAS), but auditing every write site found
-- the comment was stale: src/lib/studentCohorts.ts's
-- ensureStudentCohortMembership() takes
-- `source: "MANUAL" | "INVITATION" | "CANVAS" | "GOOGLE_CLASSROOM"`, and
-- src/services/googleClassroomIntegration.ts genuinely calls it with
-- source: "GOOGLE_CLASSROOM". Converting using only the 3 documented values
-- would have made every Google Classroom sync crash at runtime the moment
-- it tried to write that value into the new enum column. The enum below
-- uses the real 4-value set confirmed from the TypeScript union type and
-- its actual callers (canvasIntegration.ts, googleClassroomIntegration.ts,
-- routes/invitations.ts — CANVAS, GOOGLE_CLASSROOM, and INVITATION are each
-- exercised by a real caller; MANUAL is the schema/type default with no
-- current explicit caller but is kept since it's part of the same type and
-- schema default).
--
-- Every write to this column goes through ensureStudentCohortMembership's
-- `params.source` parameter (a TypeScript literal union, confirmed safe by
-- a clean `tsc` after the Prisma-client regen) or is untouched by the other
-- 5 consumer files' calls (updateMany/deleteMany/findUnique with no source
-- filter or write). No caller-controlled input reaches this column, so no
-- associated validation-gap fix was needed for this round.
--
-- As with every prior enum conversion this session, Prisma's auto-generated
-- migration for this diff does DROP COLUMN / ADD COLUMN, which would
-- silently destroy existing data. Hand-written instead using the standard
-- in-place conversion (ALTER COLUMN ... TYPE ... USING col::text::enum). No
-- existing index directly on this column (the two composite indexes on this
-- table are keyed on cohortId/studentId + isActive, not source).

-- CreateEnum
CREATE TYPE "StudentCohortMembershipSource" AS ENUM ('MANUAL', 'INVITATION', 'CANVAS', 'GOOGLE_CLASSROOM');

-- AlterTable: convert in place, preserving existing data.
ALTER TABLE "StudentCohortMembership"
  ALTER COLUMN "source" DROP DEFAULT,
  ALTER COLUMN "source" TYPE "StudentCohortMembershipSource" USING "source"::text::"StudentCohortMembershipSource",
  ALTER COLUMN "source" SET DEFAULT 'MANUAL';
