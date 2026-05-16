-- AlterEnum
ALTER TYPE "IntegrationExternalObjectType" ADD VALUE 'ENROLLMENT';

-- DropForeignKey
ALTER TABLE "School" DROP CONSTRAINT "School_createdById_fkey";

-- DropIndex
DROP INDEX "User_cohortId_idx";

-- AlterTable
ALTER TABLE "Cohort" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "IntegrationConnection" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "IntegrationExternalMapping" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "IntegrationSyncJob" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN "customFields" TEXT;

-- AlterTable
ALTER TABLE "Organization" DROP COLUMN "socialLinks";

-- AlterTable
ALTER TABLE "School"
ADD COLUMN "address" TEXT,
ADD COLUMN "allowSelfSubmission" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "categoryHourCaps" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "directoryId" TEXT,
ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION,
ADD COLUMN "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "partnerInviteTemplate" TEXT,
ADD COLUMN "registrationEmail" TEXT,
ADD COLUMN "registrationToken" TEXT,
ADD COLUMN "registrationTokenExpires" TIMESTAMP(3),
ADD COLUMN "requireOrgVerification" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "serviceEndDate" TIMESTAMP(3),
ADD COLUMN "serviceStartDate" TIMESTAMP(3),
ADD COLUMN "state" TEXT,
ADD COLUMN "type" TEXT,
ADD COLUMN "zip" TEXT,
ALTER COLUMN "createdById" DROP NOT NULL,
ALTER COLUMN "verificationStandard" SET DEFAULT 'STANDARD';

-- AlterTable
ALTER TABLE "SelfSubmittedRequest" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ServiceSession" DROP COLUMN "signatureFileUrl";

-- AlterTable
ALTER TABLE "User"
DROP COLUMN "age",
DROP COLUMN "avatarUrl",
DROP COLUMN "bio",
DROP COLUMN "socialLinks",
ADD COLUMN "beneficiaryId" TEXT,
ADD COLUMN "googleId" TEXT,
ADD COLUMN "isTestAccount" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "messagePreferences" TEXT,
ADD COLUMN "notificationPreferences" TEXT,
ADD COLUMN "passwordResetExpires" TIMESTAMP(3),
ADD COLUMN "passwordResetToken" TEXT,
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "SchoolDirectory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "emailDomain" TEXT,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "claimedBySchoolId" TEXT,
    "ncessId" TEXT,
    "gradeRange" TEXT,
    "enrollment" INTEGER,
    "phone" TEXT,
    "county" TEXT,
    "website" TEXT,
    "source" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolDirectory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerifiedDomain" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerifiedDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentCohortMembership" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentCohortMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Beneficiary" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "description" TEXT,
    "website" TEXT,
    "category" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "directoryId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "createdBySchoolId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Beneficiary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeneficiaryDirectory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ein" TEXT,
    "category" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "email" TEXT,
    "website" TEXT,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "nteeCode" TEXT,
    "ncessId" TEXT,
    "phone" TEXT,
    "source" TEXT,
    "county" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BeneficiaryDirectory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolBeneficiaryApproval" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "beneficiaryId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolBeneficiaryApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeneficiaryInvitation" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "beneficiaryId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sentTo" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BeneficiaryInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeneficiaryOpportunity" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "beneficiaryId" TEXT NOT NULL,
    "category" TEXT,
    "location" TEXT,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "requirementsNote" TEXT,
    "customFields" TEXT,
    "schoolRestrictions" TEXT,
    "recurrenceRule" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BeneficiaryOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeneficiaryTimeSlot" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "durationHours" DOUBLE PRECISION NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 10,
    "recurringGroupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BeneficiaryTimeSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeneficiarySignup" (
    "id" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "checkedIn" BOOLEAN NOT NULL DEFAULT false,
    "checkedInAt" TIMESTAMP(3),
    "checkedOut" BOOLEAN NOT NULL DEFAULT false,
    "checkedOutAt" TIMESTAMP(3),
    "totalHours" DOUBLE PRECISION,
    "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BeneficiarySignup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeneficiaryAuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "actorId" TEXT NOT NULL,
    "signupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BeneficiaryAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataAccessLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "schoolId" TEXT,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SchoolDirectory_ncessId_key" ON "SchoolDirectory"("ncessId");

-- CreateIndex
CREATE UNIQUE INDEX "VerifiedDomain_schoolId_domain_key" ON "VerifiedDomain"("schoolId", "domain");

-- CreateIndex
CREATE INDEX "StudentCohortMembership_cohortId_isActive_idx" ON "StudentCohortMembership"("cohortId", "isActive");

-- CreateIndex
CREATE INDEX "StudentCohortMembership_studentId_isActive_idx" ON "StudentCohortMembership"("studentId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "StudentCohortMembership_studentId_cohortId_key" ON "StudentCohortMembership"("studentId", "cohortId");

-- CreateIndex
CREATE UNIQUE INDEX "BeneficiaryDirectory_ein_key" ON "BeneficiaryDirectory"("ein");

-- CreateIndex
CREATE UNIQUE INDEX "BeneficiaryDirectory_ncessId_key" ON "BeneficiaryDirectory"("ncessId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolBeneficiaryApproval_schoolId_beneficiaryId_key" ON "SchoolBeneficiaryApproval"("schoolId", "beneficiaryId");

-- CreateIndex
CREATE UNIQUE INDEX "BeneficiaryInvitation_token_key" ON "BeneficiaryInvitation"("token");

-- CreateIndex
CREATE UNIQUE INDEX "BeneficiarySignup_slotId_studentId_key" ON "BeneficiarySignup"("slotId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "School_registrationToken_key" ON "School"("registrationToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "Beneficiary"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "School" ADD CONSTRAINT "School_directoryId_fkey" FOREIGN KEY ("directoryId") REFERENCES "SchoolDirectory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "School" ADD CONSTRAINT "School_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerifiedDomain" ADD CONSTRAINT "VerifiedDomain_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCohortMembership" ADD CONSTRAINT "StudentCohortMembership_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCohortMembership" ADD CONSTRAINT "StudentCohortMembership_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Beneficiary" ADD CONSTRAINT "Beneficiary_directoryId_fkey" FOREIGN KEY ("directoryId") REFERENCES "BeneficiaryDirectory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolBeneficiaryApproval" ADD CONSTRAINT "SchoolBeneficiaryApproval_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolBeneficiaryApproval" ADD CONSTRAINT "SchoolBeneficiaryApproval_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "Beneficiary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeneficiaryInvitation" ADD CONSTRAINT "BeneficiaryInvitation_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "Beneficiary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeneficiaryOpportunity" ADD CONSTRAINT "BeneficiaryOpportunity_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "Beneficiary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeneficiaryTimeSlot" ADD CONSTRAINT "BeneficiaryTimeSlot_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "BeneficiaryOpportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeneficiarySignup" ADD CONSTRAINT "BeneficiarySignup_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "BeneficiaryTimeSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeneficiaryAuditLog" ADD CONSTRAINT "BeneficiaryAuditLog_signupId_fkey" FOREIGN KEY ("signupId") REFERENCES "BeneficiarySignup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataAccessLog" ADD CONSTRAINT "DataAccessLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "IntegrationExternalMapping_connectionId_externalType_externalId" RENAME TO "IntegrationExternalMapping_connectionId_externalType_extern_key";

-- RenameIndex
ALTER INDEX "IntegrationExternalMapping_schoolId_provider_localType_localId_" RENAME TO "IntegrationExternalMapping_schoolId_provider_localType_loca_idx";
