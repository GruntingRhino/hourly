-- AlterTable
ALTER TABLE "BeneficiarySignup" ADD COLUMN     "schoolId" TEXT;

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "ownershipEvidenceVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "ownershipReviewNote" TEXT,
ADD COLUMN     "ownershipReviewedAt" TIMESTAMP(3),
ADD COLUMN     "ownershipReviewedById" TEXT,
ADD COLUMN     "ownershipStatus" TEXT NOT NULL DEFAULT 'PENDING';

-- Data repair: the application's central session-eligibility check
-- (evaluateSessionEligibility) blocks SCHOOL_ADMIN/TEACHER sessions unless
-- ownershipStatus = 'APPROVED'. Without this backfill, every already-verified
-- school would default to the new 'PENDING' status and every admin/teacher
-- at that school would be locked out of their account the moment this
-- migration runs. Grandfather existing verified schools as approved instead
-- of retroactively demoting them to a review queue they never went through.
UPDATE "School"
SET "ownershipStatus" = 'APPROVED',
    "ownershipEvidenceVerifiedAt" = COALESCE("ownershipEvidenceVerifiedAt", CURRENT_TIMESTAMP),
    "ownershipReviewedAt" = COALESCE("ownershipReviewedAt", CURRENT_TIMESTAMP),
    "ownershipReviewNote" = COALESCE("ownershipReviewNote", 'Grandfathered as approved: verified before ownershipStatus tracking was introduced.')
WHERE "verified" = true;

-- AlterTable
ALTER TABLE "ServiceSession" ADD COLUMN     "schoolId" TEXT;

-- CreateTable
CREATE TABLE "SchoolRegistrationIntent" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "googleId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolRegistrationIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SchoolRegistrationIntent_tokenHash_key" ON "SchoolRegistrationIntent"("tokenHash");

-- CreateIndex
CREATE INDEX "SchoolRegistrationIntent_email_createdAt_idx" ON "SchoolRegistrationIntent"("email", "createdAt");

-- CreateIndex
CREATE INDEX "SchoolRegistrationIntent_expiresAt_consumedAt_idx" ON "SchoolRegistrationIntent"("expiresAt", "consumedAt");

-- CreateIndex
CREATE INDEX "BeneficiarySignup_schoolId_studentId_idx" ON "BeneficiarySignup"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "ServiceSession_schoolId_userId_verificationStatus_idx" ON "ServiceSession"("schoolId", "userId", "verificationStatus");

-- AddForeignKey
ALTER TABLE "BeneficiarySignup" ADD CONSTRAINT "BeneficiarySignup_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceSession" ADD CONSTRAINT "ServiceSession_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
