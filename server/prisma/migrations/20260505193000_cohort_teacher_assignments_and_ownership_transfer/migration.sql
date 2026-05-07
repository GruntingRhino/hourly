ALTER TABLE "School"
ADD COLUMN "ownershipTransferToken" TEXT,
ADD COLUMN "ownershipTransferExpires" TIMESTAMP(3),
ADD COLUMN "ownershipTransferTargetUserId" TEXT;

CREATE UNIQUE INDEX "School_ownershipTransferToken_key" ON "School"("ownershipTransferToken");

CREATE TABLE "CohortTeacherAssignment" (
  "id" TEXT NOT NULL,
  "cohortId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CohortTeacherAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CohortTeacherAssignment_cohortId_teacherId_key"
ON "CohortTeacherAssignment"("cohortId", "teacherId");

ALTER TABLE "CohortTeacherAssignment"
ADD CONSTRAINT "CohortTeacherAssignment_cohortId_fkey"
FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CohortTeacherAssignment"
ADD CONSTRAINT "CohortTeacherAssignment_teacherId_fkey"
FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
