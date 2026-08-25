-- §9 canonical service-hour ledger: a new, additive, append-only table
-- dual-written alongside the 3 existing approve routes (BeneficiarySignup,
-- SelfSubmittedRequest, ServiceSession) without changing what any of them
-- write to their own table, or what lib/hoursCalculator.ts reads from —
-- that computation is untouched by this migration. See the schema comment
-- above the model for the full rationale.

-- CreateEnum
CREATE TYPE "ServiceHourLedgerSourceType" AS ENUM ('BENEFICIARY_SIGNUP', 'SELF_SUBMITTED', 'SERVICE_SESSION');

-- CreateTable
CREATE TABLE IF NOT EXISTS "ServiceHourLedgerEntry" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "schoolId" TEXT,
  "sourceType" "ServiceHourLedgerSourceType" NOT NULL,
  "sourceId" TEXT NOT NULL,
  "category" TEXT,
  "approvedMinutes" INTEGER NOT NULL,
  "approverId" TEXT NOT NULL,
  "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServiceHourLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ServiceHourLedgerEntry_studentId_idx" ON "ServiceHourLedgerEntry"("studentId");
CREATE INDEX IF NOT EXISTS "ServiceHourLedgerEntry_schoolId_idx" ON "ServiceHourLedgerEntry"("schoolId");
CREATE INDEX IF NOT EXISTS "ServiceHourLedgerEntry_sourceType_sourceId_idx" ON "ServiceHourLedgerEntry"("sourceType", "sourceId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ServiceHourLedgerEntry_studentId_fkey'
  ) THEN
    ALTER TABLE "ServiceHourLedgerEntry"
    ADD CONSTRAINT "ServiceHourLedgerEntry_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ServiceHourLedgerEntry_schoolId_fkey'
  ) THEN
    ALTER TABLE "ServiceHourLedgerEntry"
    ADD CONSTRAINT "ServiceHourLedgerEntry_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ServiceHourLedgerEntry_approverId_fkey'
  ) THEN
    ALTER TABLE "ServiceHourLedgerEntry"
    ADD CONSTRAINT "ServiceHourLedgerEntry_approverId_fkey"
    FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
