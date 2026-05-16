DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IntegrationProvider') THEN
    CREATE TYPE "IntegrationProvider" AS ENUM ('CANVAS');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IntegrationConnectionStatus') THEN
    CREATE TYPE "IntegrationConnectionStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'ERROR');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IntegrationSyncMode') THEN
    CREATE TYPE "IntegrationSyncMode" AS ENUM ('PREVIEW', 'APPLY');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IntegrationSyncJobStatus') THEN
    CREATE TYPE "IntegrationSyncJobStatus" AS ENUM ('RUNNING', 'COMPLETED', 'PARTIAL_FAILED', 'FAILED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IntegrationExternalObjectType') THEN
    CREATE TYPE "IntegrationExternalObjectType" AS ENUM ('COURSE', 'SECTION', 'USER');
  END IF;
END $$;

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "integrationConnectionCreatorStub" TEXT;

CREATE TABLE IF NOT EXISTS "IntegrationConnection" (
  "id" TEXT NOT NULL,
  "provider" "IntegrationProvider" NOT NULL,
  "schoolId" TEXT NOT NULL,
  "status" "IntegrationConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
  "displayName" TEXT,
  "baseUrl" TEXT,
  "credentialsEncrypted" TEXT,
  "config" TEXT,
  "lastSyncedAt" TIMESTAMP(3),
  "lastSyncStatus" "IntegrationSyncJobStatus",
  "lastSyncJobId" TEXT,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "disconnectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IntegrationConnection_provider_schoolId_key"
ON "IntegrationConnection"("provider", "schoolId");

CREATE INDEX IF NOT EXISTS "IntegrationConnection_schoolId_provider_idx"
ON "IntegrationConnection"("schoolId", "provider");

CREATE TABLE IF NOT EXISTS "IntegrationExternalMapping" (
  "id" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "provider" "IntegrationProvider" NOT NULL,
  "schoolId" TEXT NOT NULL,
  "externalType" "IntegrationExternalObjectType" NOT NULL,
  "externalId" TEXT NOT NULL,
  "externalParentId" TEXT,
  "externalName" TEXT,
  "localType" TEXT NOT NULL,
  "localId" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "IntegrationExternalMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IntegrationExternalMapping_connectionId_externalType_externalId_key"
ON "IntegrationExternalMapping"("connectionId", "externalType", "externalId");

CREATE INDEX IF NOT EXISTS "IntegrationExternalMapping_schoolId_provider_localType_localId_idx"
ON "IntegrationExternalMapping"("schoolId", "provider", "localType", "localId");

CREATE TABLE IF NOT EXISTS "IntegrationSyncJob" (
  "id" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "provider" "IntegrationProvider" NOT NULL,
  "schoolId" TEXT NOT NULL,
  "mode" "IntegrationSyncMode" NOT NULL,
  "status" "IntegrationSyncJobStatus" NOT NULL DEFAULT 'RUNNING',
  "startedById" TEXT NOT NULL,
  "summary" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "IntegrationSyncJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "IntegrationSyncJob_connectionId_createdAt_idx"
ON "IntegrationSyncJob"("connectionId", "createdAt");

CREATE INDEX IF NOT EXISTS "IntegrationSyncJob_schoolId_provider_createdAt_idx"
ON "IntegrationSyncJob"("schoolId", "provider", "createdAt");

CREATE TABLE IF NOT EXISTS "IntegrationSyncError" (
  "id" TEXT NOT NULL,
  "syncJobId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "provider" "IntegrationProvider" NOT NULL,
  "schoolId" TEXT NOT NULL,
  "externalType" "IntegrationExternalObjectType",
  "externalId" TEXT,
  "localType" TEXT,
  "localId" TEXT,
  "code" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "details" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "IntegrationSyncError_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "IntegrationSyncError_syncJobId_createdAt_idx"
ON "IntegrationSyncError"("syncJobId", "createdAt");

CREATE INDEX IF NOT EXISTS "IntegrationSyncError_schoolId_provider_createdAt_idx"
ON "IntegrationSyncError"("schoolId", "provider", "createdAt");

ALTER TABLE "IntegrationConnection"
ADD CONSTRAINT "IntegrationConnection_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IntegrationConnection"
ADD CONSTRAINT "IntegrationConnection_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IntegrationConnection"
ADD CONSTRAINT "IntegrationConnection_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "IntegrationExternalMapping"
ADD CONSTRAINT "IntegrationExternalMapping_connectionId_fkey"
FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IntegrationExternalMapping"
ADD CONSTRAINT "IntegrationExternalMapping_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IntegrationSyncJob"
ADD CONSTRAINT "IntegrationSyncJob_connectionId_fkey"
FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IntegrationSyncJob"
ADD CONSTRAINT "IntegrationSyncJob_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IntegrationSyncJob"
ADD CONSTRAINT "IntegrationSyncJob_startedById_fkey"
FOREIGN KEY ("startedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IntegrationSyncError"
ADD CONSTRAINT "IntegrationSyncError_syncJobId_fkey"
FOREIGN KEY ("syncJobId") REFERENCES "IntegrationSyncJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IntegrationSyncError"
ADD CONSTRAINT "IntegrationSyncError_connectionId_fkey"
FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IntegrationSyncError"
ADD CONSTRAINT "IntegrationSyncError_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "User" DROP COLUMN IF EXISTS "integrationConnectionCreatorStub";
