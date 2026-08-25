-- Convert Organization.status from a free-form String column to a real
-- Postgres enum (goal §17.1), matching the 4-value set already documented in
-- the schema comment (PENDING | APPROVED | REJECTED | SUSPENDED). This is
-- the legacy Organization model (kept for backward compat — new entities use
-- Beneficiary), with only 3 consumer files. Audited all 4 write/read sites:
-- routes/organizations.ts's PUT /:id never touches status at all, and both
-- writes in routes/schools.ts (approve/reject) use inline string literals.
-- No caller-controlled input feeds this column, so no associated
-- validation-gap fix was needed for this round.
--
-- As with every prior enum conversion this session, Prisma's auto-generated
-- migration for this diff does DROP COLUMN / ADD COLUMN, which would
-- silently destroy existing data. Hand-written instead using the standard
-- in-place conversion (ALTER COLUMN ... TYPE ... USING col::text::enum). No
-- existing index on this column.

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- AlterTable: convert in place, preserving existing data.
ALTER TABLE "Organization"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "OrganizationStatus" USING "status"::text::"OrganizationStatus",
  ALTER COLUMN "status" SET DEFAULT 'PENDING';
