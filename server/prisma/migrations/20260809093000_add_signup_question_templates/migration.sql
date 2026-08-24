CREATE TABLE "SignupQuestionTemplate" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SignupQuestionTemplate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SignupQuestionTemplate_schoolId_active_idx" ON "SignupQuestionTemplate"("schoolId", "active");
ALTER TABLE "SignupQuestionTemplate" ADD CONSTRAINT "SignupQuestionTemplate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "BeneficiarySignupAnswer" (
  "id" TEXT NOT NULL,
  "signupId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  CONSTRAINT "BeneficiarySignupAnswer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BeneficiarySignupAnswer_signupId_questionId_key" ON "BeneficiarySignupAnswer"("signupId", "questionId");
ALTER TABLE "BeneficiarySignupAnswer" ADD CONSTRAINT "BeneficiarySignupAnswer_signupId_fkey" FOREIGN KEY ("signupId") REFERENCES "BeneficiarySignup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BeneficiarySignupAnswer" ADD CONSTRAINT "BeneficiarySignupAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "SignupQuestionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
