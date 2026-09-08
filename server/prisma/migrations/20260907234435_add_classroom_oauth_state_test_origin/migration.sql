-- Add testOrigin to GoogleClassroomOAuthState so the OAuth URL endpoint can
-- persist a test/dev auth origin through the state row. Without this column,
-- GET /api/integrations/googleClassroom/oauth/url?testOrigin=... crashes
-- with Prisma "Unknown argument `testOrigin`".
ALTER TABLE "GoogleClassroomOAuthState" ADD COLUMN "testOrigin" TEXT;
