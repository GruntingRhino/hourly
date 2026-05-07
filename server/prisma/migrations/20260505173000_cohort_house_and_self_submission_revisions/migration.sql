ALTER TABLE "Cohort"
ADD COLUMN "usesHouseField" BOOLEAN NOT NULL DEFAULT false;

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
ADD COLUMN "timesRevised" INTEGER NOT NULL DEFAULT 0;
