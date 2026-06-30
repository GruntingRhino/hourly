DROP INDEX IF EXISTS "User_cohortId_idx";

ALTER TABLE "School"
  ADD COLUMN IF NOT EXISTS "accessStatus" TEXT NOT NULL DEFAULT 'PROCUREMENT',
  ADD COLUMN IF NOT EXISTS "billingStatus" TEXT NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "pilotExpiresAt" TIMESTAMP(3);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'User'
      AND column_name = 'role'
      AND udt_name = 'UserRole'
  ) THEN
    ALTER TABLE "User" ALTER COLUMN "role" TYPE TEXT USING "role"::text;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "SchoolPartnerRequest" (
    "id" TEXT NOT NULL,
    "fromSchoolId" TEXT NOT NULL,
    "toSchoolId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolPartnerRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SchoolPartnerRequest_fromSchoolId_toSchoolId_key"
ON "SchoolPartnerRequest"("fromSchoolId", "toSchoolId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SchoolPartnerRequest_fromSchoolId_fkey'
  ) THEN
    ALTER TABLE "SchoolPartnerRequest"
    ADD CONSTRAINT "SchoolPartnerRequest_fromSchoolId_fkey"
    FOREIGN KEY ("fromSchoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SchoolPartnerRequest_toSchoolId_fkey'
  ) THEN
    ALTER TABLE "SchoolPartnerRequest"
    ADD CONSTRAINT "SchoolPartnerRequest_toSchoolId_fkey"
    FOREIGN KEY ("toSchoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "OrganizationInvoiceRequest" (
    "id" TEXT NOT NULL,
    "beneficiaryId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "legalName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "billingContactName" TEXT NOT NULL,
    "billingContactEmail" TEXT NOT NULL,
    "purchaseOrderRequired" BOOLEAN NOT NULL DEFAULT false,
    "taxExempt" BOOLEAN NOT NULL DEFAULT false,
    "preferredPaymentMethod" TEXT,
    "additionalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationInvoiceRequest_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OrganizationInvoiceRequest_beneficiaryId_fkey'
  ) THEN
    ALTER TABLE "OrganizationInvoiceRequest"
    ADD CONSTRAINT "OrganizationInvoiceRequest_beneficiaryId_fkey"
    FOREIGN KEY ("beneficiaryId") REFERENCES "Beneficiary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "StripeProcessedEvent" (
    "id" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeProcessedEvent_pkey" PRIMARY KEY ("id")
);
