CREATE TABLE "CanvasOAuthState" (
    "id" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CanvasOAuthState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CanvasOAuthState_stateHash_key" ON "CanvasOAuthState"("stateHash");
CREATE INDEX "CanvasOAuthState_schoolId_expiresAt_idx" ON "CanvasOAuthState"("schoolId", "expiresAt");
CREATE INDEX "CanvasOAuthState_expiresAt_consumedAt_idx" ON "CanvasOAuthState"("expiresAt", "consumedAt");
