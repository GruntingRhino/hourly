/**
 * backfill-time-slot-timestamps.ts
 *
 * §7 canonical event-time model: computes startsAt/endsAt for every
 * BeneficiaryTimeSlot row that still has them null, using the same
 * DST-correct date+startTime/endTime+Beneficiary.timezone conversion
 * (lib/icsGenerator.ts's slotDateTime) every write path now uses going
 * forward. Safe to re-run — only touches rows where startsAt IS NULL.
 *
 * USAGE:
 *   npx tsx server/scripts/backfill-time-slot-timestamps.ts
 */

import prisma from "../src/lib/prisma";
import { computeSlotTimestamps } from "../src/lib/icsGenerator";

async function main() {
  const slots = await prisma.beneficiaryTimeSlot.findMany({
    where: { startsAt: null },
    select: {
      id: true,
      date: true,
      startTime: true,
      endTime: true,
      opportunity: { select: { beneficiary: { select: { timezone: true } } } },
    },
  });

  console.log(`Found ${slots.length} time slot(s) missing startsAt/endsAt.`);

  let updated = 0;
  let failed = 0;
  for (const slot of slots) {
    try {
      const timezone = slot.opportunity.beneficiary.timezone || "UTC";
      const { startsAt, endsAt } = computeSlotTimestamps(slot.date, slot.startTime, slot.endTime, timezone);
      await prisma.beneficiaryTimeSlot.update({
        where: { id: slot.id },
        data: { startsAt, endsAt },
      });
      updated++;
    } catch (err) {
      failed++;
      console.error(`Failed to backfill slot ${slot.id}:`, (err as Error).message);
    }
  }

  console.log(`Backfilled ${updated} slot(s), ${failed} failure(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
