ALTER TABLE "Beneficiary"
  ADD COLUMN IF NOT EXISTS "planTier" TEXT NOT NULL DEFAULT 'FREE',
  ADD COLUMN IF NOT EXISTS "proActivatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
  ADD COLUMN IF NOT EXISTS "uploadAbuseStrikes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "uploadSuspendedUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "brandColor" TEXT,
  ADD COLUMN IF NOT EXISTS "logoUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "emailSignature" TEXT,
  ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT,
  ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT,
  ADD COLUMN IF NOT EXISTS "stripePriceId" TEXT,
  ADD COLUMN IF NOT EXISTS "subscriptionStatus" TEXT NOT NULL DEFAULT 'FREE',
  ADD COLUMN IF NOT EXISTS "currentPeriodEnd" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "billingInterval" TEXT;

ALTER TABLE "BeneficiaryOpportunity"
  ADD COLUMN IF NOT EXISTS "preparationNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "arrivalInstructions" TEXT,
  ADD COLUMN IF NOT EXISTS "contactInfo" TEXT,
  ADD COLUMN IF NOT EXISTS "requiredFormUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "requiredFormName" TEXT,
  ADD COLUMN IF NOT EXISTS "requiredFormIsRequired" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "BeneficiarySignup"
  ADD COLUMN IF NOT EXISTS "cancellationToken" TEXT,
  ADD COLUMN IF NOT EXISTS "attendance" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "BeneficiarySignup_cancellationToken_key" ON "BeneficiarySignup"("cancellationToken");

CREATE TABLE IF NOT EXISTS "OrgReminderConfig" (
    "id" TEXT NOT NULL,
    "beneficiaryId" TEXT NOT NULL,
    "reminders" TEXT NOT NULL DEFAULT '[{"minutesBefore":1440,"enabled":true,"label":"24 hours before"}]',
    "waitlistCutoffHours" INTEGER,
    "requireApprovalForPromotion" BOOLEAN NOT NULL DEFAULT false,
    "disableAutoPromotion" BOOLEAN NOT NULL DEFAULT false,
    "promoMessageTemplate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgReminderConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrgReminderConfig_beneficiaryId_key" ON "OrgReminderConfig"("beneficiaryId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OrgReminderConfig_beneficiaryId_fkey'
  ) THEN
    ALTER TABLE "OrgReminderConfig"
    ADD CONSTRAINT "OrgReminderConfig_beneficiaryId_fkey"
    FOREIGN KEY ("beneficiaryId") REFERENCES "Beneficiary"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "OrgEventReminderLog" (
    "id" TEXT NOT NULL,
    "signupId" TEXT NOT NULL,
    "beneficiaryId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "reminderType" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "deliveryStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "providerMessageId" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgEventReminderLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrgEventReminderLog_signupId_reminderType_key" ON "OrgEventReminderLog"("signupId", "reminderType");
CREATE INDEX IF NOT EXISTS "OrgEventReminderLog_beneficiaryId_deliveryStatus_idx" ON "OrgEventReminderLog"("beneficiaryId", "deliveryStatus");
CREATE INDEX IF NOT EXISTS "OrgEventReminderLog_scheduledFor_deliveryStatus_idx" ON "OrgEventReminderLog"("scheduledFor", "deliveryStatus");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OrgEventReminderLog_signupId_fkey'
  ) THEN
    ALTER TABLE "OrgEventReminderLog"
    ADD CONSTRAINT "OrgEventReminderLog_signupId_fkey"
    FOREIGN KEY ("signupId") REFERENCES "BeneficiarySignup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
