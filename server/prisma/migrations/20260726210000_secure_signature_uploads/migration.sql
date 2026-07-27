ALTER TABLE "ServiceSession"
  ADD COLUMN "signatureFileBytes" BYTEA,
  ADD COLUMN "signatureFileMimeType" TEXT;
