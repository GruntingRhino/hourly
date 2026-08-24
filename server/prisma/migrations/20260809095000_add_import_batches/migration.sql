CREATE TABLE "BeneficiaryImportBatch" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "rawCsv" TEXT NOT NULL,
  "beforeSnapshot" TEXT NOT NULL,
  "afterSnapshot" TEXT NOT NULL DEFAULT '[]',
  "status" TEXT NOT NULL DEFAULT 'PREVIEW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "appliedAt" TIMESTAMP(3),
  "rolledBackAt" TIMESTAMP(3),
  CONSTRAINT "BeneficiaryImportBatch_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BeneficiaryImportBatch_schoolId_status_idx" ON "BeneficiaryImportBatch"("schoolId", "status");
ALTER TABLE "BeneficiaryImportBatch" ADD CONSTRAINT "BeneficiaryImportBatch_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
