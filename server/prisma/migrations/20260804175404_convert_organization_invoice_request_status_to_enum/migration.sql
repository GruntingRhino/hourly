-- Convert OrganizationInvoiceRequest.status from a free-form String column
-- to a real Postgres enum (goal §17.1), matching the exact 7-value set the
-- route layer already enforced via INTERNAL_REQUEST_STATUSES/
-- INTERNAL_STATUS_TRANSITIONS in src/routes/billing.ts. As with every prior
-- enum conversion this session, Prisma's auto-generated migration for this
-- diff does DROP COLUMN / ADD COLUMN, which would silently destroy existing
-- data. Hand-written instead using the standard in-place conversion
-- (ALTER COLUMN ... TYPE ... USING col::text::enum). No existing index on
-- this column, so no CREATE INDEX statement is needed here.

-- CreateEnum
CREATE TYPE "OrganizationInvoiceRequestStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'INVOICE_SENT', 'PAID', 'REJECTED', 'CANCELLED');

-- AlterTable: convert in place, preserving existing data.
ALTER TABLE "OrganizationInvoiceRequest"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "OrganizationInvoiceRequestStatus" USING "status"::text::"OrganizationInvoiceRequestStatus",
  ALTER COLUMN "status" SET DEFAULT 'SUBMITTED';
