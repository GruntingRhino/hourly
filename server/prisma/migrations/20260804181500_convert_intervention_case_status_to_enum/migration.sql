-- Convert InterventionCase.status from a free-form String column to a real
-- Postgres enum (goal §17.1), matching the exact 5-value set the route layer
-- already enforced via a Zod z.enum(...) in the PUT
-- /interventions/cases/:studentId handler in src/routes/messages.ts.
--
-- While auditing consumers for this conversion, found (and fixed in the same
-- commit) a related validation gap in GET /interventions/cases: its query
-- schema read `status: z.string().optional()` — any non-empty string — and
-- passed it straight into the Prisma `where` clause. Same bug class as the
-- gaps fixed in prior rounds for routes/saved.ts, routes/beneficiaries.ts,
-- and routes/billing.ts: a typo'd or malicious ?status= value silently
-- returned an empty case list instead of a 400, and once this column becomes
-- a real enum it would have caused a raw 500 instead. Fixed by reusing the
-- same z.enum(...) value set as the PUT handler.
--
-- As with every prior enum conversion this session, Prisma's auto-generated
-- migration for this diff does DROP COLUMN / ADD COLUMN, which would
-- silently destroy existing data. Hand-written instead using the standard
-- in-place conversion (ALTER COLUMN ... TYPE ... USING col::text::enum).
-- InterventionCase.status is covered by the composite index
-- "InterventionCase_schoolId_status_priority_idx" — Postgres rebuilds
-- indexes automatically as part of ALTER COLUMN ... TYPE, so no explicit
-- DROP/CREATE INDEX is required (verified on a disposable DB before this
-- migration was finalized).

-- CreateEnum
CREATE TYPE "InterventionCaseStatus" AS ENUM ('OPEN', 'WAITING_ON_STUDENT', 'WAITING_ON_SCHOOL', 'MONITORING', 'RESOLVED');

-- AlterTable: convert in place, preserving existing data.
ALTER TABLE "InterventionCase"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "InterventionCaseStatus" USING "status"::text::"InterventionCaseStatus",
  ALTER COLUMN "status" SET DEFAULT 'OPEN';
