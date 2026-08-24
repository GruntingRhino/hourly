ALTER TABLE "School" ADD COLUMN "approvedInterestTags" TEXT;
CREATE TABLE "StudentPreference" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "optedIn" BOOLEAN NOT NULL DEFAULT false,
  "interestTags" TEXT NOT NULL DEFAULT '[]',
  "timezone" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentPreference_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StudentPreference_studentId_key" ON "StudentPreference"("studentId");
ALTER TABLE "StudentPreference" ADD CONSTRAINT "StudentPreference_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentPreference" ADD CONSTRAINT "StudentPreference_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "StudentAvailabilityWindow" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "preferenceId" TEXT NOT NULL,
  "weekday" INTEGER NOT NULL,
  "start" TEXT NOT NULL,
  "end" TEXT NOT NULL,
  CONSTRAINT "StudentAvailabilityWindow_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StudentAvailabilityWindow_studentId_weekday_idx" ON "StudentAvailabilityWindow"("studentId", "weekday");
ALTER TABLE "StudentAvailabilityWindow" ADD CONSTRAINT "StudentAvailabilityWindow_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentAvailabilityWindow" ADD CONSTRAINT "StudentAvailabilityWindow_preferenceId_fkey" FOREIGN KEY ("preferenceId") REFERENCES "StudentPreference"("id") ON DELETE CASCADE ON UPDATE CASCADE;
