-- Convert School.ownershipStatus from a free-form String column to a real
-- Postgres enum (goal §17.1), matching the 3-value set already documented
-- in the schema comment (PENDING | APPROVED | REJECTED). 5 consumer files
-- (middleware/auth.ts, lib/schoolActivation.ts, lib/schoolAuthority.ts,
-- routes/googleAuth.ts, routes/auth.ts) — this column gates authentication
-- directly (schoolAuthority.ts's evaluateSessionEligibility blocks
-- SCHOOL_ADMIN/TEACHER sessions unless ownershipStatus = 'APPROVED'), so
-- every site was individually audited rather than sampled, same rigor as
-- the User.status conversion in the prior commit.
--
-- The one write site where a caller-controlled value could reach this
-- column — POST /api/schools/ownership-reviews/:schoolId
-- (lib/schoolActivation.ts's reviewSchoolOwnership, called from
-- routes/schools.ts) — validates via
-- `z.object({ decision: z.enum(["APPROVED", "REJECTED"]), ... }).strict()`
-- before ever reaching reviewSchoolOwnership, whose own parameter type is
-- the TypeScript union `"APPROVED" | "REJECTED"`; confirmed safe by a clean
-- tsc after the Prisma-client regen. Every other write site (routes/auth.ts,
-- routes/googleAuth.ts) is an inline "PENDING" literal on account/school
-- creation. The two comparisons that gate login
-- (`user.school.ownershipStatus !== "APPROVED"` in schoolAuthority.ts, and
-- the `select` in middleware/auth.ts) are pure reads, unaffected by the
-- type change. No unvalidated caller-controlled input reaches this column,
-- so no associated validation-gap fix was needed for this round.
--
-- As with every prior enum conversion this session, Prisma's auto-generated
-- migration for this diff does DROP COLUMN / ADD COLUMN, which would
-- silently destroy existing data. Hand-written instead using the standard
-- in-place conversion (ALTER COLUMN ... TYPE ... USING col::text::enum). No
-- existing index on this column (School only has a unique index on
-- ownershipTransferToken).

-- CreateEnum
CREATE TYPE "SchoolOwnershipStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable: convert in place, preserving existing data.
ALTER TABLE "School"
  ALTER COLUMN "ownershipStatus" DROP DEFAULT,
  ALTER COLUMN "ownershipStatus" TYPE "SchoolOwnershipStatus" USING "ownershipStatus"::text::"SchoolOwnershipStatus",
  ALTER COLUMN "ownershipStatus" SET DEFAULT 'PENDING';
