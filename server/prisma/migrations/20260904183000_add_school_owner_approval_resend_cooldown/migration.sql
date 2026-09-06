-- Enforce a 15-minute cooldown for owner approval email resends.
ALTER TABLE "School"
  ADD COLUMN "ownershipApprovalLastSentAt" TIMESTAMP(3);
