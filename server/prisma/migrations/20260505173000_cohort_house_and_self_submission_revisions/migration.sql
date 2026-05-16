ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "house" TEXT,
ADD COLUMN IF NOT EXISTS "cohortId" TEXT;

CREATE TABLE IF NOT EXISTS "Cohort" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "requiredHours" DOUBLE PRECISION,
  "serviceStartDate" TIMESTAMP(3),
  "serviceEndDate" TIMESTAMP(3),
  "allowSelfSubmission" BOOLEAN,
  "categoryHourCaps" TEXT,
  "usesHouseField" BOOLEAN NOT NULL DEFAULT false,
  "startYear" INTEGER,
  "endYear" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Cohort_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StudentInvitation" (
  "id" TEXT NOT NULL,
  "cohortId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "grade" TEXT,
  "house" TEXT,
  "startingHours" DOUBLE PRECISION,
  "token" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentInvitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SelfSubmittedRequest" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "organizationName" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "hours" DOUBLE PRECISION NOT NULL,
  "evidenceNote" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "revisionNote" TEXT,
  "timesRevised" INTEGER NOT NULL DEFAULT 0,
  "convertedSessionId" TEXT,
  "category" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SelfSubmittedRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StudentInvitation_token_key" ON "StudentInvitation"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "StudentInvitation_cohortId_email_key" ON "StudentInvitation"("cohortId", "email");
CREATE INDEX IF NOT EXISTS "User_cohortId_idx" ON "User"("cohortId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Cohort_schoolId_fkey'
  ) THEN
    ALTER TABLE "Cohort"
    ADD CONSTRAINT "Cohort_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StudentInvitation_cohortId_fkey'
  ) THEN
    ALTER TABLE "StudentInvitation"
    ADD CONSTRAINT "StudentInvitation_cohortId_fkey"
    FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SelfSubmittedRequest_studentId_fkey'
  ) THEN
    ALTER TABLE "SelfSubmittedRequest"
    ADD CONSTRAINT "SelfSubmittedRequest_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SelfSubmittedRequest_schoolId_fkey'
  ) THEN
    ALTER TABLE "SelfSubmittedRequest"
    ADD CONSTRAINT "SelfSubmittedRequest_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'User_cohortId_fkey'
  ) THEN
    ALTER TABLE "User"
    ADD CONSTRAINT "User_cohortId_fkey"
    FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "Cohort"
ADD COLUMN IF NOT EXISTS "usesHouseField" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Cohort" AS c
SET "usesHouseField" = true
WHERE EXISTS (
  SELECT 1
  FROM "StudentInvitation" AS si
  WHERE si."cohortId" = c."id"
    AND si."house" IS NOT NULL
    AND btrim(si."house") <> ''
)
OR EXISTS (
  SELECT 1
  FROM "User" AS u
  WHERE u."cohortId" = c."id"
    AND u."house" IS NOT NULL
    AND btrim(u."house") <> ''
);

ALTER TABLE "SelfSubmittedRequest"
ADD COLUMN IF NOT EXISTS "timesRevised" INTEGER NOT NULL DEFAULT 0;
