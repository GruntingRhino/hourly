ALTER TABLE "School"
ADD COLUMN "launchOnboardingConfig" TEXT,
ADD COLUMN "launchSupportConfig" TEXT,
ADD COLUMN "launchRollbackConfig" TEXT,
ADD COLUMN "launchMonitoringConfig" TEXT;

CREATE TABLE "SchoolLaunchBug" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "area" TEXT,
    "source" TEXT,
    "ownerName" TEXT,
    "workaround" TEXT,
    "nextAction" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolLaunchBug_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SchoolLaunchBug_schoolId_status_idx" ON "SchoolLaunchBug"("schoolId", "status");
CREATE INDEX "SchoolLaunchBug_schoolId_severity_idx" ON "SchoolLaunchBug"("schoolId", "severity");

ALTER TABLE "SchoolLaunchBug"
ADD CONSTRAINT "SchoolLaunchBug_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
