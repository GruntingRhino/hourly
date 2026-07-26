ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "beneficiaryAdminRole" TEXT;
UPDATE "User"
SET "beneficiaryAdminRole" = 'OWNER'
WHERE "role" = 'BENEFICIARY_ADMIN'
  AND "beneficiaryId" IS NOT NULL
  AND "beneficiaryAdminRole" IS NULL;

CREATE TABLE IF NOT EXISTS "BeneficiaryAdminInvitation" (
  "id" TEXT NOT NULL,
  "beneficiaryId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "invitedById" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BeneficiaryAdminInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BeneficiaryAdminInvitation_token_key" ON "BeneficiaryAdminInvitation"("token");
CREATE INDEX IF NOT EXISTS "BeneficiaryAdminInvitation_beneficiaryId_status_idx" ON "BeneficiaryAdminInvitation"("beneficiaryId", "status");
CREATE INDEX IF NOT EXISTS "BeneficiaryAdminInvitation_email_status_idx" ON "BeneficiaryAdminInvitation"("email", "status");

DO $$ BEGIN
  ALTER TABLE "BeneficiaryAdminInvitation"
    ADD CONSTRAINT "BeneficiaryAdminInvitation_beneficiaryId_fkey"
    FOREIGN KEY ("beneficiaryId") REFERENCES "Beneficiary"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
