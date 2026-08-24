CREATE TABLE "SupervisorVerification" (
  "id" TEXT NOT NULL,
  "signupId" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "supervisorEmail" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupervisorVerification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SupervisorVerification_signupId_key" ON "SupervisorVerification"("signupId");
CREATE UNIQUE INDEX "SupervisorVerification_tokenHash_key" ON "SupervisorVerification"("tokenHash");
CREATE INDEX "SupervisorVerification_schoolId_usedAt_idx" ON "SupervisorVerification"("schoolId", "usedAt");
ALTER TABLE "SupervisorVerification" ADD CONSTRAINT "SupervisorVerification_signupId_fkey" FOREIGN KEY ("signupId") REFERENCES "BeneficiarySignup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupervisorVerification" ADD CONSTRAINT "SupervisorVerification_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
