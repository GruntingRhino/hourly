-- Convert OrgEventReminderLog.deliveryStatus from a free-form String column
-- to a real Postgres enum (goal §17.1), matching the 4-value set already
-- documented in the schema comment (PENDING | SENT | FAILED | SKIPPED). This
-- table is a purely internal idempotency/delivery log (src/lib/eventReminders.ts,
-- plus one read-only groupBy in routes/beneficiaries.ts) — every write site is
-- an inline string literal, so no caller-controlled input feeds this column
-- and no associated validation-gap fix was needed for this round.
--
-- As with every prior enum conversion this session, Prisma's auto-generated
-- migration for this diff does DROP COLUMN / ADD COLUMN, which would
-- silently destroy existing data. Hand-written instead using the standard
-- in-place conversion (ALTER COLUMN ... TYPE ... USING col::text::enum).
-- This column is covered by two composite indexes
-- (OrgEventReminderLog_beneficiaryId_deliveryStatus_idx and
-- OrgEventReminderLog_scheduledFor_deliveryStatus_idx); Postgres rebuilds
-- indexes automatically as part of ALTER COLUMN ... TYPE (already verified
-- for this exact pattern in the InterventionCase.status conversion), so no
-- explicit DROP/CREATE INDEX statements are needed here.

-- CreateEnum
CREATE TYPE "OrgEventReminderDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- AlterTable: convert in place, preserving existing data.
ALTER TABLE "OrgEventReminderLog"
  ALTER COLUMN "deliveryStatus" DROP DEFAULT,
  ALTER COLUMN "deliveryStatus" TYPE "OrgEventReminderDeliveryStatus" USING "deliveryStatus"::text::"OrgEventReminderDeliveryStatus",
  ALTER COLUMN "deliveryStatus" SET DEFAULT 'PENDING';
