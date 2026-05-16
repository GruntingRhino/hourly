CREATE TABLE IF NOT EXISTS "InterventionCampaign" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "actionType" TEXT NOT NULL,
  "audienceType" TEXT NOT NULL,
  "queueType" TEXT,
  "savedView" TEXT,
  "subject" TEXT,
  "bodyPreview" TEXT,
  "priority" BOOLEAN NOT NULL DEFAULT false,
  "recipientCount" INTEGER NOT NULL DEFAULT 0,
  "metadata" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InterventionCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InterventionRecipient" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "messageId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InterventionRecipient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InterventionCase" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "ownerId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
  "reason" TEXT,
  "summary" TEXT,
  "nextStepForStudent" TEXT,
  "nextStepForStaff" TEXT,
  "staffNote" TEXT,
  "studentMessage" TEXT,
  "dueDate" TIMESTAMP(3),
  "lastContactedAt" TIMESTAMP(3),
  "lastStudentActionAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InterventionCase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InterventionRecipient_messageId_key" ON "InterventionRecipient"("messageId");
CREATE UNIQUE INDEX IF NOT EXISTS "InterventionRecipient_campaignId_studentId_key" ON "InterventionRecipient"("campaignId", "studentId");
CREATE UNIQUE INDEX IF NOT EXISTS "InterventionCase_schoolId_studentId_key" ON "InterventionCase"("schoolId", "studentId");

CREATE INDEX IF NOT EXISTS "InterventionCampaign_schoolId_createdAt_idx" ON "InterventionCampaign"("schoolId", "createdAt");
CREATE INDEX IF NOT EXISTS "InterventionCampaign_actorId_createdAt_idx" ON "InterventionCampaign"("actorId", "createdAt");
CREATE INDEX IF NOT EXISTS "InterventionRecipient_studentId_createdAt_idx" ON "InterventionRecipient"("studentId", "createdAt");
CREATE INDEX IF NOT EXISTS "InterventionCase_schoolId_status_priority_idx" ON "InterventionCase"("schoolId", "status", "priority");
CREATE INDEX IF NOT EXISTS "InterventionCase_studentId_updatedAt_idx" ON "InterventionCase"("studentId", "updatedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InterventionCampaign_schoolId_fkey'
  ) THEN
    ALTER TABLE "InterventionCampaign"
    ADD CONSTRAINT "InterventionCampaign_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InterventionCampaign_actorId_fkey'
  ) THEN
    ALTER TABLE "InterventionCampaign"
    ADD CONSTRAINT "InterventionCampaign_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InterventionRecipient_campaignId_fkey'
  ) THEN
    ALTER TABLE "InterventionRecipient"
    ADD CONSTRAINT "InterventionRecipient_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "InterventionCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InterventionRecipient_studentId_fkey'
  ) THEN
    ALTER TABLE "InterventionRecipient"
    ADD CONSTRAINT "InterventionRecipient_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InterventionRecipient_messageId_fkey'
  ) THEN
    ALTER TABLE "InterventionRecipient"
    ADD CONSTRAINT "InterventionRecipient_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InterventionCase_schoolId_fkey'
  ) THEN
    ALTER TABLE "InterventionCase"
    ADD CONSTRAINT "InterventionCase_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InterventionCase_studentId_fkey'
  ) THEN
    ALTER TABLE "InterventionCase"
    ADD CONSTRAINT "InterventionCase_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InterventionCase_ownerId_fkey'
  ) THEN
    ALTER TABLE "InterventionCase"
    ADD CONSTRAINT "InterventionCase_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
