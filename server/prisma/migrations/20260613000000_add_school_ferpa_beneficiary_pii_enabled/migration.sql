-- Add the school-level FERPA beneficiary PII toggle required by the current Prisma schema.
ALTER TABLE "School"
ADD COLUMN IF NOT EXISTS "ferpaBeneficiaryPiiEnabled" BOOLEAN NOT NULL DEFAULT false;
