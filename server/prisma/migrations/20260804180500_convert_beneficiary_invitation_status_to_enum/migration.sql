-- Convert BeneficiaryInvitation.status from a free-form String column to a
-- real Postgres enum (goal §17.1), matching the 4-value set already implied
-- by the route layer (src/routes/beneficiaries.ts, src/routes/invitations.ts)
-- via inline literals ("PENDING", "ACCEPTED", "DECLINED", "EXPIRED") and the
-- Zod-enum-typed `action` variable in POST /invitations/:invId/respond. As
-- with every prior enum conversion this session, Prisma's auto-generated
-- migration for this diff does DROP COLUMN / ADD COLUMN, which would
-- silently destroy existing data. Hand-written instead using the standard
-- in-place conversion (ALTER COLUMN ... TYPE ... USING col::text::enum).
-- No existing index on this column (only "token" is indexed), so no
-- CREATE INDEX statement is needed here.

-- CreateEnum
CREATE TYPE "BeneficiaryInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- AlterTable: convert in place, preserving existing data.
ALTER TABLE "BeneficiaryInvitation"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "BeneficiaryInvitationStatus" USING "status"::text::"BeneficiaryInvitationStatus",
  ALTER COLUMN "status" SET DEFAULT 'PENDING';
