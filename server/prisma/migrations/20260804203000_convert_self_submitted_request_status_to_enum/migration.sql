-- Convert SelfSubmittedRequest.status from a free-form String column to a
-- real Postgres enum (goal §17.1). The schema comment documented only 4
-- values (PENDING, APPROVED, REJECTED, REVISION_REQUESTED), but auditing
-- every write site across all 10 consumer files found the comment was
-- stale: POST /api/self-submissions/:id/cancel
-- (src/routes/selfSubmissions.ts) writes a 5th value, "CANCELLED", which
-- was missing from the comment entirely. Converting using only the 4
-- documented values would have made every submission cancellation crash at
-- runtime the moment a student cancelled a pending/revision-requested
-- submission. Caught by grepping every literal `status: "..."` write and
-- every `submission.status ===` comparison in the file instead of trusting
-- the comment (the same class of gap found and fixed for
-- StudentCohortMembership.source in an earlier commit this session).
--
-- While auditing consumers, also found and fixed (in the same commit as
-- this migration) a real validation gap: GET /api/self-submissions read
-- `req.query.status as string | undefined` and passed any string straight
-- into the Prisma where clause — same bug class as every other status-filter
-- gap found this session. Fixed with a z.enum(["PENDING", "APPROVED",
-- "REJECTED", "REVISION_REQUESTED", "CANCELLED"]) validated via safeParse,
-- returning 400 on an invalid value.
--
-- Every other write site (POST /, CSV bulk import, /approve, /reject,
-- /request-revision, PUT /:id resubmit, plus lib/hoursCalculator.ts,
-- lib/reminders.ts, lib/launchCenter.ts, routes/reports.ts,
-- routes/schools.ts, routes/cohorts.ts, routes/invitations.ts,
-- routes/auth.ts) uses inline string literals, a schema default, or a
-- literal array membership check — no other caller-controlled input reaches
-- this column.
--
-- As with every prior enum conversion this session, Prisma's auto-generated
-- migration for this diff does DROP COLUMN / ADD COLUMN, which would
-- silently destroy existing data. Hand-written instead using the standard
-- in-place conversion (ALTER COLUMN ... TYPE ... USING col::text::enum).
-- This column is covered by two composite indexes
-- (SelfSubmittedRequest_studentId_status_idx and
-- SelfSubmittedRequest_schoolId_status_idx); Postgres rebuilds indexes
-- automatically as part of ALTER COLUMN ... TYPE (already verified for this
-- exact pattern in the InterventionCase.status and
-- OrgEventReminderLog.deliveryStatus conversions), so no explicit
-- DROP/CREATE INDEX statements are needed here.

-- CreateEnum
CREATE TYPE "SelfSubmittedRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVISION_REQUESTED', 'CANCELLED');

-- AlterTable: convert in place, preserving existing data.
ALTER TABLE "SelfSubmittedRequest"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "SelfSubmittedRequestStatus" USING "status"::text::"SelfSubmittedRequestStatus",
  ALTER COLUMN "status" SET DEFAULT 'PENDING';
