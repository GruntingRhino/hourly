-- CreateIndex
CREATE INDEX "BeneficiaryOpportunity_beneficiaryId_idx" ON "BeneficiaryOpportunity"("beneficiaryId");

-- CreateIndex
CREATE INDEX "BeneficiaryTimeSlot_opportunityId_idx" ON "BeneficiaryTimeSlot"("opportunityId");

-- CreateIndex
CREATE INDEX "Cohort_schoolId_idx" ON "Cohort"("schoolId");

-- CreateIndex
CREATE INDEX "User_schoolId_idx" ON "User"("schoolId");

-- CreateIndex
CREATE INDEX "User_cohortId_idx" ON "User"("cohortId");

-- CreateIndex
CREATE INDEX "User_classroomId_idx" ON "User"("classroomId");

-- CreateIndex
CREATE INDEX "User_beneficiaryId_idx" ON "User"("beneficiaryId");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");
