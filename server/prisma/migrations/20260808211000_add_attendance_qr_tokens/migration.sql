-- CreateTable
CREATE TABLE "AttendanceQrToken" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceQrToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceQrRedemption" (
    "id" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceQrRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceQrToken_tokenHash_key" ON "AttendanceQrToken"("tokenHash");
CREATE INDEX "AttendanceQrToken_opportunityId_expiresAt_idx" ON "AttendanceQrToken"("opportunityId", "expiresAt");
CREATE UNIQUE INDEX "AttendanceQrRedemption_tokenId_studentId_key" ON "AttendanceQrRedemption"("tokenId", "studentId");
CREATE INDEX "AttendanceQrRedemption_studentId_checkedInAt_idx" ON "AttendanceQrRedemption"("studentId", "checkedInAt");
CREATE INDEX "AttendanceQrRedemption_sessionId_idx" ON "AttendanceQrRedemption"("sessionId");

-- AddForeignKey
ALTER TABLE "AttendanceQrToken" ADD CONSTRAINT "AttendanceQrToken_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceQrToken" ADD CONSTRAINT "AttendanceQrToken_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceQrRedemption" ADD CONSTRAINT "AttendanceQrRedemption_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "AttendanceQrToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceQrRedemption" ADD CONSTRAINT "AttendanceQrRedemption_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceQrRedemption" ADD CONSTRAINT "AttendanceQrRedemption_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ServiceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
