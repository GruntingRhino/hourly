-- §7 canonical event-time model: add startsAt/endsAt as precomputed,
-- DST-correct UTC instants on BeneficiaryTimeSlot, derived from the
-- existing date+startTime/endTime+Beneficiary.timezone fields (the same
-- conversion lib/icsGenerator.ts's slotDateTime already performs ad hoc at
-- read time in lib/eventReminders.ts and routes/beneficiaries.ts).
--
-- Purely additive and nullable — no data-type change to any existing
-- column, so unlike this session's enum conversions this is safe to let
-- Prisma generate normally; hand-written only for consistency with this
-- repo's established migration-authoring process. Existing rows are
-- backfilled by scripts/backfill-time-slot-timestamps.ts (run manually
-- after this migration is applied); every write path that sets
-- date/startTime/endTime now also computes these directly, so a null
-- value only ever means "predates the backfill or was written before
-- this change" — read consumers must treat null as "recompute", not
-- "unknown/broken".

-- AlterTable
ALTER TABLE "BeneficiaryTimeSlot" ADD COLUMN "startsAt" TIMESTAMP(3);
ALTER TABLE "BeneficiaryTimeSlot" ADD COLUMN "endsAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "BeneficiaryTimeSlot_startsAt_idx" ON "BeneficiaryTimeSlot"("startsAt");
