CREATE TABLE "GoogleClassroomOAuthState" (
    "id" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "baseUrl" TEXT,
    "displayName" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoogleClassroomOAuthState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GoogleClassroomOAuthState_stateHash_key" ON "GoogleClassroomOAuthState"("stateHash");
CREATE INDEX "GoogleClassroomOAuthState_schoolId_expiresAt_idx" ON "GoogleClassroomOAuthState"("schoolId", "expiresAt");
CREATE INDEX "GoogleClassroomOAuthState_expiresAt_consumedAt_idx" ON "GoogleClassroomOAuthState"("expiresAt", "consumedAt");