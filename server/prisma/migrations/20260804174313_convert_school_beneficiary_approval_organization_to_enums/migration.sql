-- Convert SchoolBeneficiaryApproval.status and SchoolOrganization.status from
-- free-form String columns to real Postgres enums (goal §17.1), matching the
-- values each column's consumers already restrict it to. Prisma's
-- auto-generated migration for this diff does DROP COLUMN / ADD COLUMN on
-- both tables, which would silently destroy existing data (confirmed via
-- `prisma migrate dev --create-only`, which explicitly warns "would be
-- dropped and recreated. This will lead to data loss." for both columns).
-- Hand-written instead using the standard in-place conversion
-- (ALTER COLUMN ... TYPE ... USING col::text::enum), which preserves
-- existing values. Neither column has an existing index, so no CREATE INDEX
-- statements are needed here.

-- CreateEnum
CREATE TYPE "SchoolBeneficiaryApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "SchoolOrganizationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'BLOCKED');

-- AlterTable: convert in place, preserving existing data.
ALTER TABLE "SchoolBeneficiaryApproval"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "SchoolBeneficiaryApprovalStatus" USING "status"::text::"SchoolBeneficiaryApprovalStatus",
  ALTER COLUMN "status" SET DEFAULT 'PENDING';

ALTER TABLE "SchoolOrganization"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "SchoolOrganizationStatus" USING "status"::text::"SchoolOrganizationStatus",
  ALTER COLUMN "status" SET DEFAULT 'PENDING';
