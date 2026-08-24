CREATE TABLE "OrganizationReliabilityEvent" (
  "id" TEXT NOT NULL,
  "beneficiaryId" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "responseMinutes" DOUBLE PRECISION,
  "attendanceAccurate" BOOLEAN,
  "cancelled" BOOLEAN,
  "verificationMinutes" DOUBLE PRECISION,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationReliabilityEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OrganizationReliabilityEvent_beneficiaryId_occurredAt_idx" ON "OrganizationReliabilityEvent"("beneficiaryId", "occurredAt");
ALTER TABLE "OrganizationReliabilityEvent" ADD CONSTRAINT "OrganizationReliabilityEvent_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "Beneficiary"("id") ON DELETE CASCADE ON UPDATE CASCADE;
