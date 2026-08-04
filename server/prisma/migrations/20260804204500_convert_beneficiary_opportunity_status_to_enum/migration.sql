-- Convert BeneficiaryOpportunity.status from a free-form String column to a
-- real Postgres enum (goal §17.1), matching the 3-value set already
-- documented in the schema comment (ACTIVE | CANCELLED | COMPLETED). Only 2
-- consumer files (routes/beneficiaries.ts, routes/schools.ts) despite 10
-- call sites — all audited.
--
-- Every write is an inline string literal (create defaults to "ACTIVE", the
-- delete route sets "CANCELLED"); every findMany/findFirst filter on status
-- is an inline literal ("ACTIVE", `{ not: "CANCELLED" }`); the PUT
-- /:id/opportunities/:oppId update schema has no `status` field at all
-- (confirmed by reading its full Zod schema), so that route can never write
-- to this column. No caller-controlled input reaches this column, so no
-- associated validation-gap fix was needed for this round.
--
-- As with every prior enum conversion this session, Prisma's auto-generated
-- migration for this diff does DROP COLUMN / ADD COLUMN, which would
-- silently destroy existing data. Hand-written instead using the standard
-- in-place conversion (ALTER COLUMN ... TYPE ... USING col::text::enum). No
-- existing index on this column (the only index on this table is on
-- beneficiaryId).

-- CreateEnum
CREATE TYPE "BeneficiaryOpportunityStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'COMPLETED');

-- AlterTable: convert in place, preserving existing data.
ALTER TABLE "BeneficiaryOpportunity"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "BeneficiaryOpportunityStatus" USING "status"::text::"BeneficiaryOpportunityStatus",
  ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
