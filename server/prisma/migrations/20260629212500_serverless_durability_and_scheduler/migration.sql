CREATE TABLE IF NOT EXISTS "SchoolBillingRecord" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "billingStatus" TEXT NOT NULL DEFAULT 'QUOTE_REQUESTED',
    "pricePerStudentCents" INTEGER,
    "annualMinimumCents" INTEGER,
    "enrollmentCount" INTEGER,
    "verifiedEnrollment" INTEGER,
    "contractAmountCents" INTEGER,
    "contractStartDate" TIMESTAMP(3),
    "contractEndDate" TIMESTAMP(3),
    "billingContactName" TEXT,
    "billingContactEmail" TEXT,
    "billingContactPhone" TEXT,
    "goodhoursContactId" TEXT,
    "purchaseOrderNumber" TEXT,
    "invoiceNumber" TEXT,
    "paymentStatus" TEXT,
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolBillingRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SchoolBillingRecord_schoolId_key" ON "SchoolBillingRecord"("schoolId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SchoolBillingRecord_schoolId_fkey'
  ) THEN
    ALTER TABLE "SchoolBillingRecord"
    ADD CONSTRAINT "SchoolBillingRecord_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "SchoolQuoteRequest" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "schoolName" TEXT NOT NULL,
    "districtName" TEXT,
    "schoolWebsite" TEXT,
    "schoolAddress" TEXT,
    "schoolState" TEXT,
    "enrollment" INTEGER NOT NULL,
    "gradeLevels" TEXT,
    "primaryContactName" TEXT NOT NULL,
    "primaryContactTitle" TEXT,
    "primaryContactEmail" TEXT NOT NULL,
    "primaryContactPhone" TEXT,
    "billingContactName" TEXT,
    "billingContactEmail" TEXT,
    "billingContactPhone" TEXT,
    "billingAddress" TEXT,
    "purchaseOrderRequired" BOOLEAN NOT NULL DEFAULT false,
    "vendorRegistrationRequired" BOOLEAN NOT NULL DEFAULT false,
    "w9Required" BOOLEAN NOT NULL DEFAULT false,
    "certificateOfInsuranceRequired" BOOLEAN NOT NULL DEFAULT false,
    "dataPrivacyAgreementRequired" BOOLEAN NOT NULL DEFAULT false,
    "preferredStartDate" TIMESTAMP(3),
    "procurementNotes" TEXT,
    "estimatedAnnualCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolQuoteRequest_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SchoolQuoteRequest_schoolId_fkey'
  ) THEN
    ALTER TABLE "SchoolQuoteRequest"
    ADD CONSTRAINT "SchoolQuoteRequest_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "SchoolProcurementDocument" (
    "id" TEXT NOT NULL,
    "billingRecordId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedPath" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "contentBytes" BYTEA,
    "uploadedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolProcurementDocument_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'SchoolProcurementDocument'
      AND column_name = 'contentBytes'
  ) THEN
    ALTER TABLE "SchoolProcurementDocument" ADD COLUMN "contentBytes" BYTEA;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SchoolProcurementDocument_billingRecordId_fkey'
  ) THEN
    ALTER TABLE "SchoolProcurementDocument"
    ADD CONSTRAINT "SchoolProcurementDocument_billingRecordId_fkey"
    FOREIGN KEY ("billingRecordId") REFERENCES "SchoolBillingRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "SchoolBillingAuditLog" (
    "id" TEXT NOT NULL,
    "billingRecordId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT NOT NULL,
    "changedByUserId" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "SchoolBillingAuditLog_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SchoolBillingAuditLog_billingRecordId_fkey'
  ) THEN
    ALTER TABLE "SchoolBillingAuditLog"
    ADD CONSTRAINT "SchoolBillingAuditLog_billingRecordId_fkey"
    FOREIGN KEY ("billingRecordId") REFERENCES "SchoolBillingRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "BeneficiaryOpportunityAttachment" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "beneficiaryId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "contentBytes" BYTEA,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BeneficiaryOpportunityAttachment_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'BeneficiaryOpportunityAttachment'
      AND column_name = 'contentBytes'
  ) THEN
    ALTER TABLE "BeneficiaryOpportunityAttachment" ADD COLUMN "contentBytes" BYTEA;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BeneficiaryOpportunityAttachment_opportunityId_fkey'
  ) THEN
    ALTER TABLE "BeneficiaryOpportunityAttachment"
    ADD CONSTRAINT "BeneficiaryOpportunityAttachment_opportunityId_fkey"
    FOREIGN KEY ("opportunityId") REFERENCES "BeneficiaryOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BeneficiaryOpportunityAttachment_beneficiaryId_fkey'
  ) THEN
    ALTER TABLE "BeneficiaryOpportunityAttachment"
    ADD CONSTRAINT "BeneficiaryOpportunityAttachment_beneficiaryId_fkey"
    FOREIGN KEY ("beneficiaryId") REFERENCES "Beneficiary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

CREATE INDEX IF NOT EXISTS "RateLimitBucket_resetAt_idx" ON "RateLimitBucket"("resetAt");

CREATE TABLE IF NOT EXISTS "ScheduledJobLease" (
    "jobName" TEXT NOT NULL,
    "leaseUntil" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledJobLease_pkey" PRIMARY KEY ("jobName")
);

CREATE INDEX IF NOT EXISTS "ScheduledJobLease_leaseUntil_idx" ON "ScheduledJobLease"("leaseUntil");
