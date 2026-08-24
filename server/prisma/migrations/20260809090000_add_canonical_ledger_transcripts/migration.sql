CREATE TABLE "CanonicalLedgerEntry" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "serviceDate" TIMESTAMP(3) NOT NULL,
  "organizationName" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "hours" DOUBLE PRECISION NOT NULL,
  "verifiedBy" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CanonicalLedgerEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CanonicalLedgerEntry_source_sourceId_key" ON "CanonicalLedgerEntry"("source", "sourceId");
CREATE INDEX "CanonicalLedgerEntry_studentId_serviceDate_idx" ON "CanonicalLedgerEntry"("studentId", "serviceDate");
CREATE INDEX "CanonicalLedgerEntry_schoolId_serviceDate_idx" ON "CanonicalLedgerEntry"("schoolId", "serviceDate");
ALTER TABLE "CanonicalLedgerEntry" ADD CONSTRAINT "CanonicalLedgerEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CanonicalLedgerEntry" ADD CONSTRAINT "CanonicalLedgerEntry_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "VerifiedTranscriptSnapshot" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "snapshot" TEXT NOT NULL,
  "ledgerHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "certifiedBy" TEXT,
  "certifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VerifiedTranscriptSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VerifiedTranscriptSnapshot_studentId_createdAt_idx" ON "VerifiedTranscriptSnapshot"("studentId", "createdAt");
CREATE INDEX "VerifiedTranscriptSnapshot_schoolId_status_idx" ON "VerifiedTranscriptSnapshot"("schoolId", "status");
ALTER TABLE "VerifiedTranscriptSnapshot" ADD CONSTRAINT "VerifiedTranscriptSnapshot_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerifiedTranscriptSnapshot" ADD CONSTRAINT "VerifiedTranscriptSnapshot_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
