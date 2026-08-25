-- Convert School.verificationStandard, School.billingStatus, and
-- School.accessStatus from free-form String columns to real Postgres enums
-- (goal §17.1).
--
-- verificationStandard: STANDARD | BENEFICIARY_REQUIRED — 2 values, only
-- write site is routes/schools.ts's PATCH /:id, already gated by a
-- z.enum(["STANDARD", "BENEFICIARY_REQUIRED"]) Zod schema.
--
-- billingStatus / accessStatus: a manually-operated procurement pipeline —
-- app code only ever writes billingStatus to NONE (default),
-- QUOTE_REQUESTED, or ACTIVE, and accessStatus to PROCUREMENT (default) or
-- ACTIVE (both routes/schoolProcurement.ts). The remaining values
-- (QUOTE_IN_REVIEW, QUOTE_SENT, PRIVACY_REVIEW, SECURITY_REVIEW,
-- CONTRACT_REVIEW, AWAITING_SIGNATURE, AWAITING_PURCHASE_ORDER,
-- PURCHASE_ORDER_RECEIVED, INVOICED, PAYMENT_PENDING, PAST_DUE, EXPIRED,
-- DECLINED for billingStatus; PILOT, SUSPENDED, EXPIRED for accessStatus)
-- are set directly by ops/sales outside the app, not through any route —
-- confirmed present in routes/schoolProcurement.ts's own
-- `activeStatuses` array (billingStatus) and the client's authoritative
-- SchoolBillingStatus/SchoolAccessStatus TypeScript unions
-- (client/src/pages/school/SchoolBilling.tsx), which the procurement UI
-- treats as the full value set. Checked both real local databases
-- (goodhours_qa_latest, goodhours_local_disposable_accounts) for any
-- value outside this documented set before converting — every existing
-- School row currently has the default value for all three columns, so
-- there was nothing to reconcile.
--
-- SchoolBillingRecord.billingStatus (a separate model) and
-- SchoolBillingAuditLog.previousStatus/.newStatus were deliberately left
-- alone — grepping the whole server source found zero app-code write
-- sites for SchoolBillingRecord at all; it appears to be an
-- entirely-manually-populated model, a distinct question from this
-- conversion and not assessed further here.
--
-- As with every prior enum conversion this session, Prisma's
-- auto-generated migration for this diff does DROP COLUMN / ADD COLUMN,
-- which would silently destroy existing data. Hand-written instead using
-- the standard in-place conversion (ALTER COLUMN ... TYPE ... USING
-- col::text::enum). No existing index on any of these three columns.

-- CreateEnum
CREATE TYPE "SchoolVerificationStandard" AS ENUM ('STANDARD', 'BENEFICIARY_REQUIRED');

-- CreateEnum
CREATE TYPE "SchoolBillingStatus" AS ENUM (
  'NONE', 'QUOTE_REQUESTED', 'QUOTE_IN_REVIEW', 'QUOTE_SENT', 'PRIVACY_REVIEW',
  'SECURITY_REVIEW', 'CONTRACT_REVIEW', 'AWAITING_SIGNATURE',
  'AWAITING_PURCHASE_ORDER', 'PURCHASE_ORDER_RECEIVED', 'INVOICED',
  'PAYMENT_PENDING', 'ACTIVE', 'PAST_DUE', 'EXPIRED', 'DECLINED'
);

-- CreateEnum
CREATE TYPE "SchoolAccessStatus" AS ENUM ('PROCUREMENT', 'PILOT', 'ACTIVE', 'SUSPENDED', 'EXPIRED');

-- AlterTable: convert all three columns in place, preserving existing data.
ALTER TABLE "School"
  ALTER COLUMN "verificationStandard" DROP DEFAULT,
  ALTER COLUMN "verificationStandard" TYPE "SchoolVerificationStandard" USING "verificationStandard"::text::"SchoolVerificationStandard",
  ALTER COLUMN "verificationStandard" SET DEFAULT 'STANDARD';

ALTER TABLE "School"
  ALTER COLUMN "billingStatus" DROP DEFAULT,
  ALTER COLUMN "billingStatus" TYPE "SchoolBillingStatus" USING "billingStatus"::text::"SchoolBillingStatus",
  ALTER COLUMN "billingStatus" SET DEFAULT 'NONE';

ALTER TABLE "School"
  ALTER COLUMN "accessStatus" DROP DEFAULT,
  ALTER COLUMN "accessStatus" TYPE "SchoolAccessStatus" USING "accessStatus"::text::"SchoolAccessStatus",
  ALTER COLUMN "accessStatus" SET DEFAULT 'PROCUREMENT';
