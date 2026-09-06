-- One-click business-owner approval for pending school registrations.
ALTER TABLE "School"
  ADD COLUMN "ownershipApprovalToken" TEXT,
  ADD COLUMN "ownershipApprovalTokenExpires" TIMESTAMP(3),
  ADD COLUMN "ownershipApprovalTokenUsedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "School_ownershipApprovalToken_key"
  ON "School"("ownershipApprovalToken");
