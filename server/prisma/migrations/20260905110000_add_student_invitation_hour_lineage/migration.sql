-- Add a durable idempotency key for imported starting-hour records.
ALTER TABLE "SelfSubmittedRequest" ADD COLUMN "sourceStudentInvitationId" TEXT;
CREATE UNIQUE INDEX "SelfSubmittedRequest_sourceStudentInvitationId_key" ON "SelfSubmittedRequest"("sourceStudentInvitationId");
