-- Convert three more free-form status String columns to real Postgres
-- enums (goal §17.1), matching the values each column's comment/consumers
-- already restrict it to. Prisma's auto-generated migration for this diff
-- does DROP COLUMN / ADD COLUMN on all three tables, which would silently
-- destroy existing data. Hand-written instead using the standard in-place
-- conversion (ALTER COLUMN ... TYPE ... USING col::text::enum), which
-- preserves existing values. All three tables had zero existing rows with
-- non-null status values in the checked dev database at the time this was
-- written, but the in-place conversion is used regardless as the safe
-- default for any environment.

-- CreateEnum
CREATE TYPE "SchoolPartnerRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BeneficiaryAdminInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SavedOpportunityStatus" AS ENUM ('SAVED', 'SKIPPED', 'DISCARDED');

-- AlterTable: convert in place, preserving existing data. The existing
-- indexes on BeneficiaryAdminInvitation.status (from
-- 20260724220000_beneficiary_admin_management) survive an in-place
-- ALTER COLUMN TYPE automatically and must not be recreated here.
ALTER TABLE "BeneficiaryAdminInvitation"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "BeneficiaryAdminInvitationStatus" USING "status"::text::"BeneficiaryAdminInvitationStatus",
  ALTER COLUMN "status" SET DEFAULT 'PENDING';

ALTER TABLE "SavedOpportunity"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "SavedOpportunityStatus" USING "status"::text::"SavedOpportunityStatus",
  ALTER COLUMN "status" SET DEFAULT 'SAVED';

ALTER TABLE "SchoolPartnerRequest"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "SchoolPartnerRequestStatus" USING "status"::text::"SchoolPartnerRequestStatus",
  ALTER COLUMN "status" SET DEFAULT 'PENDING';
