ALTER TABLE "School"
ADD COLUMN IF NOT EXISTS "ownershipTransferToken" TEXT,
ADD COLUMN IF NOT EXISTS "ownershipTransferExpires" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "ownershipTransferTargetUserId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "School_ownershipTransferToken_key" ON "School"("ownershipTransferToken");

CREATE TABLE IF NOT EXISTS "CohortTeacherAssignment" (
  "id" TEXT NOT NULL,
  "cohortId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CohortTeacherAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CohortTeacherAssignment_cohortId_teacherId_key"
ON "CohortTeacherAssignment"("cohortId", "teacherId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CohortTeacherAssignment_cohortId_fkey'
  ) THEN
    ALTER TABLE "CohortTeacherAssignment"
    ADD CONSTRAINT "CohortTeacherAssignment_cohortId_fkey"
    FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CohortTeacherAssignment_teacherId_fkey'
  ) THEN
    ALTER TABLE "CohortTeacherAssignment"
    ADD CONSTRAINT "CohortTeacherAssignment_teacherId_fkey"
    FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
