ALTER TABLE "OrgEventReminderLog" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "OrgEventReminderLog" ADD COLUMN "leasedUntil" TIMESTAMP(3);
CREATE INDEX "OrgEventReminderLog_leasedUntil_deliveryStatus_idx" ON "OrgEventReminderLog"("leasedUntil", "deliveryStatus");
