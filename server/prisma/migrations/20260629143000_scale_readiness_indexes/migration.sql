CREATE INDEX "SelfSubmittedRequest_studentId_status_idx" ON "SelfSubmittedRequest"("studentId", "status");
CREATE INDEX "SelfSubmittedRequest_schoolId_status_idx" ON "SelfSubmittedRequest"("schoolId", "status");

CREATE INDEX "BeneficiaryTimeSlot_date_idx" ON "BeneficiaryTimeSlot"("date");

CREATE INDEX "BeneficiarySignup_studentId_verificationStatus_status_idx"
ON "BeneficiarySignup"("studentId", "verificationStatus", "status");
CREATE INDEX "BeneficiarySignup_slotId_status_idx" ON "BeneficiarySignup"("slotId", "status");
CREATE INDEX "BeneficiarySignup_status_verificationStatus_idx"
ON "BeneficiarySignup"("status", "verificationStatus");

CREATE INDEX "ServiceSession_userId_verificationStatus_idx"
ON "ServiceSession"("userId", "verificationStatus");
CREATE INDEX "ServiceSession_status_verificationStatus_idx"
ON "ServiceSession"("status", "verificationStatus");

CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");
CREATE INDEX "AuditLog_sessionId_createdAt_idx" ON "AuditLog"("sessionId", "createdAt");

CREATE INDEX "DataAccessLog_schoolId_createdAt_idx" ON "DataAccessLog"("schoolId", "createdAt");
CREATE INDEX "DataAccessLog_actorId_createdAt_idx" ON "DataAccessLog"("actorId", "createdAt");

CREATE INDEX "Message_receiverId_createdAt_idx" ON "Message"("receiverId", "createdAt");
CREATE INDEX "Message_senderId_createdAt_idx" ON "Message"("senderId", "createdAt");

CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX "Notification_userId_read_createdAt_idx" ON "Notification"("userId", "read", "createdAt");
CREATE INDEX "Notification_userId_type_createdAt_idx" ON "Notification"("userId", "type", "createdAt");
