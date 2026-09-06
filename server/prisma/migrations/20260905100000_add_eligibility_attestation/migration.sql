CREATE TABLE "EligibilityAttestation" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "eligible13Plus" BOOLEAN NOT NULL,
  "policyVersion" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "attestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EligibilityAttestation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EligibilityAttestation_userId_key" ON "EligibilityAttestation"("userId");
CREATE INDEX "EligibilityAttestation_policyVersion_attestedAt_idx" ON "EligibilityAttestation"("policyVersion", "attestedAt");
ALTER TABLE "EligibilityAttestation" ADD CONSTRAINT "EligibilityAttestation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
