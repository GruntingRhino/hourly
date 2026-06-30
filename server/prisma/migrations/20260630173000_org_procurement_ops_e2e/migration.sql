ALTER TABLE "OrganizationInvoiceRequest"
  ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "internalNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "quoteAmountCents" INTEGER,
  ADD COLUMN IF NOT EXISTS "quoteSentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "invoiceSentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejectedReason" TEXT,
  ADD COLUMN IF NOT EXISTS "lastContactedAt" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OrganizationInvoiceRequest_ownerUserId_fkey'
  ) THEN
    ALTER TABLE "OrganizationInvoiceRequest"
    ADD CONSTRAINT "OrganizationInvoiceRequest_ownerUserId_fkey"
    FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "OrganizationInvoiceRequest_ownerUserId_idx"
ON "OrganizationInvoiceRequest"("ownerUserId");

CREATE TABLE IF NOT EXISTS "OrganizationInvoiceAuditLog" (
    "id" TEXT NOT NULL,
    "invoiceRequestId" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT NOT NULL,
    "changedByUserId" TEXT NOT NULL,
    "entryType" TEXT NOT NULL DEFAULT 'STATUS',
    "visibleToCustomer" BOOLEAN NOT NULL DEFAULT false,
    "subject" TEXT,
    "note" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationInvoiceAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OrganizationInvoiceAuditLog_invoiceRequestId_changedAt_idx"
ON "OrganizationInvoiceAuditLog"("invoiceRequestId", "changedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OrganizationInvoiceAuditLog_invoiceRequestId_fkey'
  ) THEN
    ALTER TABLE "OrganizationInvoiceAuditLog"
    ADD CONSTRAINT "OrganizationInvoiceAuditLog_invoiceRequestId_fkey"
    FOREIGN KEY ("invoiceRequestId") REFERENCES "OrganizationInvoiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "OrganizationInvoiceAuditLog"
  ADD COLUMN IF NOT EXISTS "entryType" TEXT NOT NULL DEFAULT 'STATUS',
  ADD COLUMN IF NOT EXISTS "visibleToCustomer" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "subject" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OrganizationInvoiceAuditLog_changedByUserId_fkey'
  ) THEN
    ALTER TABLE "OrganizationInvoiceAuditLog"
    ADD CONSTRAINT "OrganizationInvoiceAuditLog_changedByUserId_fkey"
    FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "OrganizationInvoiceArtifact" (
    "id" TEXT NOT NULL,
    "invoiceRequestId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedPath" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "contentBytes" BYTEA,
    "uploadedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationInvoiceArtifact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OrganizationInvoiceArtifact_invoiceRequestId_createdAt_idx"
ON "OrganizationInvoiceArtifact"("invoiceRequestId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OrganizationInvoiceArtifact_invoiceRequestId_fkey'
  ) THEN
    ALTER TABLE "OrganizationInvoiceArtifact"
    ADD CONSTRAINT "OrganizationInvoiceArtifact_invoiceRequestId_fkey"
    FOREIGN KEY ("invoiceRequestId") REFERENCES "OrganizationInvoiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OrganizationInvoiceArtifact_uploadedByUserId_fkey'
  ) THEN
    ALTER TABLE "OrganizationInvoiceArtifact"
    ADD CONSTRAINT "OrganizationInvoiceArtifact_uploadedByUserId_fkey"
    FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
