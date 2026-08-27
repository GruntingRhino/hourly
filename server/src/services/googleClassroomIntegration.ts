import crypto from "crypto";
import { generateToken, hashToken } from "../lib/tokenHash";
import bcrypt from "bcryptjs";
import { z } from "zod";
import prisma from "../lib/prisma";
import { decryptField, encryptField } from "../lib/fieldEncryption";
import { logDataAccess } from "../lib/dataAccessLog";
import { deactivateStudentCohortMembership, ensureStudentCohortMembership } from "../lib/studentCohorts";
import {
  assertKnownCourseSelection,
  assertPublicApprovedUrl,
  fetchApprovedLmsUrl,
  getAllowedGoogleOrigins,
  GOOGLE_CLASSROOM_API_ORIGIN,
  GOOGLE_CLASSROOM_AUTH_ORIGIN,
  GOOGLE_CLASSROOM_TOKEN_ORIGIN,
  normalizeSelectedExternalCourseIds,
} from "../lib/lmsOutboundSecurity";
import { getGoogleClassroomMockDataset, type GoogleClassroomMockDataset, type GoogleClassroomMockScenario } from "./googleClassroomMock";
import { isProdLike, isPubliclyDeployed } from "../lib/isProdLike";
import { assertOAuthAdministrator, claimOAuthState, createOAuthState, storeOAuthState } from "../lib/oauthState";

const GOOGLE_CLASSROOM_ENABLE_MOCK = process.env.GOOGLE_CLASSROOM_ENABLE_MOCK === "true" || !isProdLike();
const GOOGLE_CLASSROOM_REQUEST_TIMEOUT_MS = Number(process.env.GOOGLE_CLASSROOM_REQUEST_TIMEOUT_MS || 15000);
const GOOGLE_CLASSROOM_PAGE_SIZE = Math.max(1, Math.min(100, Number(process.env.GOOGLE_CLASSROOM_PAGE_SIZE || 100)));
const JWT_SECRET = process.env.JWT_SECRET as string;
const CLIENT_URL = process.env.CLIENT_URL || process.env.APP_URL || "http://127.0.0.1:5173";
const GOOGLE_CLASSROOM_CLIENT_ID = process.env.GOOGLE_CLASSROOM_CLIENT_ID || "";
const GOOGLE_CLASSROOM_CLIENT_SECRET = process.env.GOOGLE_CLASSROOM_CLIENT_SECRET || "";
const GOOGLE_CLASSROOM_CALLBACK_URL = process.env.GOOGLE_CLASSROOM_CALLBACK_URL || "http://localhost:3001/api/integrations/googleClassroom/oauth/callback";
const googleClassroomConnectSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("MOCK"),
    baseUrl: z.string().url().optional(),
    displayName: z.string().min(1).max(255).optional(),
    mockScenario: z.enum(["default", "renamed", "archived", "deleted", "student_removed"]).optional(),
  }).strict(),
  z.object({
    mode: z.literal("OAUTH"),
    displayName: z.string().min(1).max(255).optional(),
  }).strict(),
]);

type GoogleClassroomConnectionConfig =
  | {
      mode: "MOCK";
      mockScenario: GoogleClassroomMockScenario;
      selectedExternalCourseIds: string[];
    }
  | {
      mode: "OAUTH";
      selectedExternalCourseIds: string[];
    };

type GoogleClassroomCredentials = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  tokenType: string;
  scope: string | null;
};

type GoogleClassroomStatePayload = {
  purpose: "googleClassroom-oauth";
  schoolId: string;
  actorId: string;
  testOrigin: string | null;
  displayName: string;
};

type GoogleClassroomSyncDataset = {
  scenario: string;
  courses: Array<{ id: string; name: string; section?: string | null; workflowState: "ACTIVE" | "ARCHIVED" | "PROVISIONED" | "DECLINED" | "SUSPENDED" }>;
  users: Array<{ id: string; name: string; email: string; role: "teacher" | "student" }>;
  enrollments: Array<{
    id: string;
    userId: string;
    courseId: string;
    role: "TeacherEnrollment" | "StudentEnrollment";
    workflowState: "active" | "inactive" | "deleted";
  }>;
};

type SectionPlanMember = {
  enrollmentId: string;
  id: string;
  name: string;
  email: string;
};

type SectionPlan = {
  sectionId: string;
  courseId: string;
  cohortName: string;
  archived: boolean;
  teacherUsers: SectionPlanMember[];
  studentUsers: SectionPlanMember[];
};

type SyncSummary = {
  provider: "GOOGLE_CLASSROOM";
  mode: "PREVIEW" | "APPLY";
  scenario: string;
  counts: {
    cohortsCreated: number;
    cohortsUpdated: number;
    cohortsArchived: number;
    teacherAssignmentsCreated: number;
    invitationsCreated: number;
    invitationsUpdated: number;
    existingUsersLinked: number;
    usersAssignedToCohort: number;
    skipped: number;
    errors: number;
  };
  operations: Array<{
    type: string;
    target: string;
    action: string;
    detail?: string;
  }>;
};

type GoogleClassroomOpsSummary = {
  connected: boolean;
  mode: "MOCK" | "OAUTH" | null;
  lastSyncAt: string | null;
  lastSyncStatus: "COMPLETED" | "PARTIAL_FAILED" | "FAILED" | "RUNNING" | null;
  recentJobFailures24h: number;
  recentSyncErrors24h: number;
  tokenRefreshFailures24h: number;
  hasRepeatedFailures: boolean;
  staleSync: boolean;
  warnings: string[];
};

type SyncErrorInput = {
  externalType?: "COURSE" | "SECTION" | "USER" | "ENROLLMENT";
  externalId?: string | null;
  localType?: string | null;
  localId?: string | null;
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

type GoogleClassroomOAuthTokenResponse = {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
};

type GoogleClassroomApiCourse = {
  id: string;
  name?: string;
  section?: string;
  courseState?: "ACTIVE" | "ARCHIVED" | "PROVISIONED" | "DECLINED" | "SUSPENDED";
};

type GoogleClassroomApiUser = {
  userId?: string;
  profile?: {
    id?: string;
    name?: string;
    fullName?: string;
    givenName?: string;
    familyName?: string;
  };
  profileEmail?: string;
};

type GoogleClassroomApiPage<T> = {
  nextPageToken?: string;
} & Record<string, T[] | string | undefined>;

type GoogleClassroomApiTokenError = {
  error?: string;
  error_description?: string;
};

type GoogleClassroomUserCollectionKey = "teachers" | "students";

type GoogleClassroomApiEnrollment = {
  id: string;
  userId: string;
  courseId: string;
  type: "TeacherEnrollment" | "StudentEnrollment";
  role: "TeacherEnrollment" | "StudentEnrollment";
  workflowState: "active" | "inactive" | "deleted";
  user: {
    id: string;
    name?: string;
    primary_email: string;
  };
};

function assertOAuthConfigured(): void {
  if (!GOOGLE_CLASSROOM_CLIENT_ID || !GOOGLE_CLASSROOM_CLIENT_SECRET || !GOOGLE_CLASSROOM_CALLBACK_URL) {
    throw new Error("Google Classroom OAuth is not configured. Set GOOGLE_CLASSROOM_CLIENT_ID, GOOGLE_CLASSROOM_CLIENT_SECRET, and GOOGLE_CLASSROOM_CALLBACK_URL.");
  }
}

function assertMockAllowed(): void {
  if (!GOOGLE_CLASSROOM_ENABLE_MOCK) {
    throw new Error("Google Classroom mock mode is disabled. Use OAuth mode with a real Google Classroom tenant.");
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function parseConnectionConfig(raw: string | null): GoogleClassroomConnectionConfig {
  if (!raw) return { mode: "MOCK", mockScenario: "default", selectedExternalCourseIds: [] };
  try {
    const parsed = JSON.parse(raw) as { mode?: "MOCK" | "OAUTH"; mockScenario?: GoogleClassroomMockScenario; selectedExternalCourseIds?: unknown };
    const selectedExternalCourseIds = Array.isArray(parsed.selectedExternalCourseIds)
      ? parsed.selectedExternalCourseIds.filter((value): value is string => typeof value === "string")
      : [];
    if (parsed.mode === "OAUTH") return { mode: "OAUTH", selectedExternalCourseIds };
    return {
      mode: "MOCK",
      mockScenario: parsed.mockScenario ?? "default",
      selectedExternalCourseIds,
    };
  } catch {
    return { mode: "MOCK", mockScenario: "default", selectedExternalCourseIds: [] };
  }
}

function parseCredentials(raw: string | null): GoogleClassroomCredentials | null {
  const decrypted = decryptField(raw);
  if (!decrypted) return null;
  try {
    const parsed = JSON.parse(decrypted) as Partial<GoogleClassroomCredentials>;
    if (!parsed.accessToken) return null;
    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken ?? null,
      expiresAt: parsed.expiresAt ?? null,
      tokenType: parsed.tokenType ?? "Bearer",
      scope: parsed.scope ?? null,
    };
  } catch {
    return null;
  }
}

function serializeCredentials(token: GoogleClassroomOAuthTokenResponse, existing?: GoogleClassroomCredentials | null): string {
  const expiresAt = typeof token.expires_in === "number"
    ? new Date(Date.now() + token.expires_in * 1000).toISOString()
    : existing?.expiresAt ?? null;
  return encryptField(JSON.stringify({
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? existing?.refreshToken ?? null,
    expiresAt,
    tokenType: token.token_type ?? existing?.tokenType ?? "Bearer",
    scope: token.scope ?? existing?.scope ?? null,
  }))!;
}

function isCredentialExpired(credentials: GoogleClassroomCredentials | null): boolean {
  if (!credentials?.expiresAt) return false;
  return new Date(credentials.expiresAt).getTime() <= Date.now() + 60_000;
}

function safeConnectionResponse(connection: any) {
  const config = parseConnectionConfig(connection.config);
  return {
    id: connection.id,
    provider: connection.provider,
    status: connection.status,
    displayName: connection.displayName,
    baseUrl: connection.baseUrl,
    connectedAt: connection.connectedAt,
    disconnectedAt: connection.disconnectedAt,
    lastSyncedAt: connection.lastSyncedAt,
    lastSyncStatus: connection.lastSyncStatus,
    scenario: config.mode === "MOCK" ? config.mockScenario : "oauth",
    mode: config.mode,
    selectedExternalCourseIds: config.selectedExternalCourseIds,
  };
}

function getGoogleClassroomCapabilities() {
  return {
    mockAllowed: GOOGLE_CLASSROOM_ENABLE_MOCK,
    oauthConfigured: Boolean(GOOGLE_CLASSROOM_CLIENT_ID && GOOGLE_CLASSROOM_CLIENT_SECRET && GOOGLE_CLASSROOM_CALLBACK_URL),
    requestTimeoutMs: GOOGLE_CLASSROOM_REQUEST_TIMEOUT_MS,
    integrationScope: "SINGLE_SCHOOL" as const,
  };
}

async function buildGoogleClassroomOpsSummary(connection: any | null): Promise<GoogleClassroomOpsSummary> {
  if (!connection) {
    return {
      connected: false,
      mode: null,
      lastSyncAt: null,
      lastSyncStatus: null,
      recentJobFailures24h: 0,
      recentSyncErrors24h: 0,
      tokenRefreshFailures24h: 0,
      hasRepeatedFailures: false,
      staleSync: false,
      warnings: [],
    };
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [failedJobs, syncErrors, tokenRefreshErrors] = await Promise.all([
    prisma.integrationSyncJob.count({
      where: {
        connectionId: connection.id,
        createdAt: { gte: since },
        status: { in: ["FAILED", "PARTIAL_FAILED"] },
      },
    }),
    prisma.integrationSyncError.count({
      where: {
        connectionId: connection.id,
        createdAt: { gte: since },
      },
    }),
    prisma.integrationSyncError.count({
      where: {
        connectionId: connection.id,
        createdAt: { gte: since },
        code: "SYNC_FAILED",
        message: { contains: "token refresh failed", mode: "insensitive" },
      },
    }),
  ]);

  const config = parseConnectionConfig(connection.config);
  const lastSyncAt = connection.lastSyncedAt ? new Date(connection.lastSyncedAt).toISOString() : null;
  const staleSync = config.mode === "OAUTH"
    && connection.status === "CONNECTED"
    && !!connection.lastSyncedAt
    && new Date(connection.lastSyncedAt).getTime() < Date.now() - 24 * 60 * 60 * 1000;
  const hasRepeatedFailures = failedJobs >= 3 || tokenRefreshErrors >= 2;
  const warnings: string[] = [];
  if (hasRepeatedFailures) warnings.push("Google Classroom sync is failing repeatedly. Investigate credentials, scopes, and provider availability.");
  if (tokenRefreshErrors > 0) warnings.push("Google Classroom token refresh failures were detected in the last 24 hours.");
  if (staleSync) warnings.push("Google Classroom has not completed a successful sync in the last 24 hours.");
  if (connection.status === "ERROR") warnings.push("Google Classroom connection is in an error state and needs admin attention.");

  return {
    connected: connection.status === "CONNECTED",
    mode: config.mode,
    lastSyncAt,
    lastSyncStatus: connection.lastSyncStatus ?? null,
    recentJobFailures24h: failedJobs,
    recentSyncErrors24h: syncErrors,
    tokenRefreshFailures24h: tokenRefreshErrors,
    hasRepeatedFailures,
    staleSync,
    warnings,
  };
}

export async function getGoogleClassroomOperationalStatus(params?: { schoolId?: string }) {
  const where = params?.schoolId ? { provider: "GOOGLE_CLASSROOM" as const, schoolId: params.schoolId } : { provider: "GOOGLE_CLASSROOM" as const };
  const connections = await prisma.integrationConnection.findMany({
    where,
    orderBy: { connectedAt: "desc" },
    select: {
      id: true,
      schoolId: true,
      provider: true,
      status: true,
      displayName: true,
      baseUrl: true,
      config: true,
      connectedAt: true,
      disconnectedAt: true,
      lastSyncedAt: true,
      lastSyncStatus: true,
    },
  });

  const connectionSummaries = await Promise.all(connections.map(async (connection) => ({
    id: connection.id,
    schoolId: connection.schoolId,
    displayName: connection.displayName,
    baseUrl: connection.baseUrl,
    status: connection.status,
    connectedAt: connection.connectedAt,
    disconnectedAt: connection.disconnectedAt,
    ops: await buildGoogleClassroomOpsSummary(connection),
  })));

  return {
    capabilities: getGoogleClassroomCapabilities(),
    totals: {
      totalConnections: connectionSummaries.length,
      connected: connectionSummaries.filter((entry) => entry.status === "CONNECTED").length,
      errored: connectionSummaries.filter((entry) => entry.status === "ERROR").length,
      repeatedFailures: connectionSummaries.filter((entry) => entry.ops.hasRepeatedFailures).length,
      staleSyncs: connectionSummaries.filter((entry) => entry.ops.staleSync).length,
    },
    connections: connectionSummaries,
    generatedAt: new Date().toISOString(),
  };
}

async function googleClassroomFetch(url: string, init: RequestInit = {}, expectedOrigin?: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GOOGLE_CLASSROOM_REQUEST_TIMEOUT_MS);
  try {
    const origin = expectedOrigin ?? new URL(url).origin;
    return await fetchApprovedLmsUrl({
      url,
      approvedOrigins: getAllowedGoogleOrigins(),
      expectedOrigin: origin,
      init: {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...(init.headers ?? {}),
        },
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Google Classroom request timed out after ${GOOGLE_CLASSROOM_REQUEST_TIMEOUT_MS}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function listGoogleClassroomPagesForConnection<T>(connection: any, initialUrl: string, collectionKey: string): Promise<T[]> {
  const items: T[] = [];
  let nextUrl = new URL(initialUrl);
  let credentials = await ensureLiveAccessToken(connection);
  let refreshRetried = false;
  const expectedOrigin = nextUrl.origin;

  while (nextUrl) {
    const response = await googleClassroomFetch(nextUrl.toString(), {
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
      },
    }, expectedOrigin);

    if ((response.status === 401 || response.status === 403) && !refreshRetried) {
      refreshRetried = true;
      credentials = await refreshOAuthCredentials(connection);
      continue;
    }

    if (!response.ok) {
      const body = await response.json().catch(async () => ({ error: await response.text() }));
      throw new Error(`Google Classroom API request failed (${response.status}): ${JSON.stringify(body).slice(0, 300)}`);
    }

    const page = await response.json() as GoogleClassroomApiPage<T>;
    const values = page[collectionKey];
    if (Array.isArray(values)) items.push(...values as T[]);
    const nextPageToken = typeof page.nextPageToken === "string" ? page.nextPageToken : null;
    if (!nextPageToken) break;
    nextUrl.searchParams.set("pageToken", nextPageToken);
  }

  return items;
}

function buildSectionPlans(dataset: GoogleClassroomSyncDataset): SectionPlan[] {
  const userById = new Map(dataset.users.map((user) => [user.id, user]));

  return dataset.courses.map((course) => {
    const archived = course.workflowState !== "ACTIVE";
    const enrollments = dataset.enrollments.filter(
      (enrollment) => enrollment.courseId === course.id && enrollment.workflowState === "active"
    );
    const teacherUsers = enrollments
      .filter((enrollment) => enrollment.role === "TeacherEnrollment")
      .map((enrollment) => {
        const user = userById.get(enrollment.userId);
        return user ? { enrollmentId: enrollment.id, id: user.id, name: user.name, email: user.email } : null;
      })
      .filter((user): user is SectionPlanMember => !!user);
    const studentUsers = enrollments
      .filter((enrollment) => enrollment.role === "StudentEnrollment")
      .map((enrollment) => {
        const user = userById.get(enrollment.userId);
        return user ? { enrollmentId: enrollment.id, id: user.id, name: user.name, email: user.email } : null;
      })
      .filter((user): user is SectionPlanMember => !!user);

    return {
      sectionId: course.id,
      courseId: course.id,
      cohortName: course.section?.trim() ? `${course.name} - ${course.section.trim()}` : course.name,
      archived,
      teacherUsers,
      studentUsers,
    };
  });
}

async function createSyncErrorRecords(params: {
  syncJobId: string;
  connectionId: string;
  schoolId: string;
  errors: SyncErrorInput[];
}): Promise<void> {
  if (!params.errors.length) return;
  await prisma.integrationSyncError.createMany({
    data: params.errors.map((error) => ({
      syncJobId: params.syncJobId,
      connectionId: params.connectionId,
      provider: "GOOGLE_CLASSROOM",
      schoolId: params.schoolId,
      externalType: error.externalType ?? null,
      externalId: error.externalId ?? null,
      localType: error.localType ?? null,
      localId: error.localId ?? null,
      code: error.code,
      message: error.message,
      details: error.details ? JSON.stringify(error.details) : null,
    })),
  });
}

async function getConnectionForSchool(schoolId: string) {
  return prisma.integrationConnection.findUnique({
    where: { provider_schoolId: { provider: "GOOGLE_CLASSROOM", schoolId } },
  });
}

async function markConnectionError(connectionId: string, actorId: string | null, message: string): Promise<void> {
  await prisma.integrationConnection.update({
    where: { id: connectionId },
    data: {
      status: "ERROR",
      updatedById: actorId,
    },
  });
  if (actorId) {
    const connection = await prisma.integrationConnection.findUnique({
      where: { id: connectionId },
      select: { schoolId: true },
    });
    if (connection) {
      await logDataAccess({
        actorId,
        action: "GOOGLE_CLASSROOM_CONNECTION_ERROR",
        targetType: "school",
        targetId: connection.schoolId,
        schoolId: connection.schoolId,
        details: { provider: "GOOGLE_CLASSROOM", message },
      });
    }
  }
}

async function normalizeGoogleTestOrigin(testOrigin?: string | null): Promise<string | null> {
  if (!testOrigin?.trim()) return null;
  if (isPubliclyDeployed()) throw new Error("Custom Google Classroom OAuth destinations are not allowed.");
  const parsed = new URL(testOrigin);
  await assertPublicApprovedUrl(parsed, getAllowedGoogleOrigins(), parsed.origin);
  return parsed.origin;
}

async function exchangeAuthorizationCode(code: string, testOrigin?: string | null): Promise<GoogleClassroomOAuthTokenResponse> {
  assertOAuthConfigured();
  const tokenOrigin = await normalizeGoogleTestOrigin(testOrigin) ?? GOOGLE_CLASSROOM_TOKEN_ORIGIN;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: GOOGLE_CLASSROOM_CLIENT_ID,
    client_secret: GOOGLE_CLASSROOM_CLIENT_SECRET,
    redirect_uri: GOOGLE_CLASSROOM_CALLBACK_URL,
    code,
  });

  const response = await googleClassroomFetch(`${tokenOrigin}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  }, tokenOrigin);
  if (!response.ok) {
    const errorBody = await response.json().catch(async () => ({ error: await response.text() })) as GoogleClassroomApiTokenError;
    throw new Error(`Google Classroom OAuth token exchange failed: ${JSON.stringify(errorBody).slice(0, 300)}`);
  }
  return response.json() as Promise<GoogleClassroomOAuthTokenResponse>;
}

async function refreshOAuthCredentials(connection: any): Promise<GoogleClassroomCredentials> {
  const credentials = parseCredentials(connection.credentialsEncrypted);
  if (!credentials?.refreshToken) {
    await markConnectionError(connection.id, connection.updatedById ?? connection.createdById, "Missing Google Classroom refresh token.");
    throw new Error("Google Classroom credentials are missing a refresh token.");
  }
  assertOAuthConfigured();
  const testOrigin = connection.baseUrl && connection.baseUrl !== GOOGLE_CLASSROOM_API_ORIGIN
    ? await normalizeGoogleTestOrigin(connection.baseUrl)
    : null;
  const tokenOrigin = testOrigin ?? GOOGLE_CLASSROOM_TOKEN_ORIGIN;

  const response = await googleClassroomFetch(`${tokenOrigin}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: GOOGLE_CLASSROOM_CLIENT_ID,
      client_secret: GOOGLE_CLASSROOM_CLIENT_SECRET,
      refresh_token: credentials.refreshToken,
    }),
  }, tokenOrigin);

  if (!response.ok) {
    const errorBody = await response.json().catch(async () => ({ error: await response.text() })) as GoogleClassroomApiTokenError;
    const detail = JSON.stringify(errorBody).slice(0, 200);
    await markConnectionError(connection.id, connection.updatedById ?? connection.createdById, `Google Classroom token refresh failed: ${detail}`);
    throw new Error(`Google Classroom token refresh failed: ${detail}`);
  }

  const token = await response.json() as GoogleClassroomOAuthTokenResponse;
  const nextEncrypted = serializeCredentials(token, credentials);
  await prisma.integrationConnection.update({
    where: { id: connection.id },
    data: {
      credentialsEncrypted: nextEncrypted,
      status: "CONNECTED",
    },
  });
  return parseCredentials(nextEncrypted)!;
}

async function ensureLiveAccessToken(connection: any): Promise<GoogleClassroomCredentials> {
  const credentials = parseCredentials(connection.credentialsEncrypted);
  if (!credentials) {
    await markConnectionError(connection.id, connection.updatedById ?? connection.createdById, "Missing Google Classroom credentials.");
    throw new Error("Google Classroom credentials are missing or unreadable.");
  }
  if (!isCredentialExpired(credentials)) return credentials;
  return refreshOAuthCredentials(connection);
}

async function fetchGoogleClassroomOAuthDataset(connection: any, selectedExternalCourseIds: string[]): Promise<GoogleClassroomSyncDataset> {
  const testOrigin = connection.baseUrl && connection.baseUrl !== GOOGLE_CLASSROOM_API_ORIGIN
    ? await normalizeGoogleTestOrigin(connection.baseUrl)
    : null;
  const baseUrl = testOrigin ?? GOOGLE_CLASSROOM_API_ORIGIN;

  try {
    const availableCourses = await listGoogleClassroomPagesForConnection<GoogleClassroomApiCourse>(
      connection,
      `${baseUrl}/v1/courses?pageSize=${GOOGLE_CLASSROOM_PAGE_SIZE}&courseStates=ACTIVE&courseStates=ARCHIVED&courseStates=PROVISIONED`,
      "courses"
    );
    const courses = assertKnownCourseSelection(availableCourses, selectedExternalCourseIds);

    const userById = new Map<string, GoogleClassroomSyncDataset["users"][number]>();
    const enrollmentRows: GoogleClassroomSyncDataset["enrollments"] = [];

    for (const course of courses) {
      const courseId = String(course.id);
      const teachers = await listGoogleClassroomPagesForConnection<GoogleClassroomApiUser>(
        connection,
        `${baseUrl}/v1/courses/${encodeURIComponent(courseId)}/teachers?pageSize=${GOOGLE_CLASSROOM_PAGE_SIZE}`,
        "teachers"
      );
      const students = await listGoogleClassroomPagesForConnection<GoogleClassroomApiUser>(
        connection,
        `${baseUrl}/v1/courses/${encodeURIComponent(courseId)}/students?pageSize=${GOOGLE_CLASSROOM_PAGE_SIZE}`,
        "students"
      );

      const toEnrollment = (user: GoogleClassroomApiUser, role: "TeacherEnrollment" | "StudentEnrollment"): GoogleClassroomApiEnrollment | null => {
        const userId = user.userId || user.profile?.id;
        const email = normalizeEmail(user.profileEmail || "");
        if (!userId || !email) return null;
        userById.set(userId, {
          id: userId,
          name: user.profile?.name || user.profile?.fullName || email,
          email,
          role: role === "TeacherEnrollment" ? "teacher" : "student",
        });
        return {
          id: `${role === "TeacherEnrollment" ? "teacher" : "student"}:${courseId}:${userId}`,
          userId,
          courseId,
          type: role,
          role,
          workflowState: "active",
          user: {
            id: userId,
            name: user.profile?.name || user.profile?.fullName || email,
            primary_email: email,
          },
        } as GoogleClassroomApiEnrollment;
      };

      for (const teacher of teachers) {
        const enrollment = toEnrollment(teacher, "TeacherEnrollment");
        if (enrollment) enrollmentRows.push(enrollment);
      }
      for (const student of students) {
        const enrollment = toEnrollment(student, "StudentEnrollment");
        if (enrollment) enrollmentRows.push(enrollment);
      }
    }

    return {
      scenario: "oauth",
      courses: courses.map((course) => ({
        id: String(course.id),
        name: course.name || "Untitled Classroom",
        section: course.section || null,
        workflowState: course.courseState || "ACTIVE",
      })),
      users: Array.from(userById.values()),
      enrollments: enrollmentRows,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Classroom sync failed.";
    if (/401|invalid_token|unauthorized/i.test(message)) {
      await markConnectionError(connection.id, connection.updatedById ?? connection.createdById, message);
    }
    throw error;
  }
}

async function getGoogleClassroomDataset(connection: any, selectedExternalCourseIds: string[]): Promise<GoogleClassroomSyncDataset> {
  const config = parseConnectionConfig(connection.config);
  if (config.mode === "MOCK") {
    const dataset = getGoogleClassroomMockDataset(config.mockScenario) as GoogleClassroomMockDataset as GoogleClassroomSyncDataset;
    const courses = assertKnownCourseSelection(dataset.courses, selectedExternalCourseIds);
    const courseIds = new Set(courses.map((course) => course.id));
    const enrollments = dataset.enrollments.filter((enrollment) => courseIds.has(enrollment.courseId));
    const userIds = new Set(enrollments.map((enrollment) => enrollment.userId));
    return {
      ...dataset,
      courses,
      enrollments,
      users: dataset.users.filter((user) => userIds.has(user.id)),
    };
  }
  return fetchGoogleClassroomOAuthDataset(connection, selectedExternalCourseIds);
}

async function listGoogleClassroomCourseMetadata(connection: any): Promise<GoogleClassroomSyncDataset["courses"]> {
  const config = parseConnectionConfig(connection.config);
  if (config.mode === "MOCK") {
    const dataset = getGoogleClassroomMockDataset(config.mockScenario) as GoogleClassroomMockDataset as GoogleClassroomSyncDataset;
    return dataset.courses;
  }
  const testOrigin = connection.baseUrl && connection.baseUrl !== GOOGLE_CLASSROOM_API_ORIGIN
    ? await normalizeGoogleTestOrigin(connection.baseUrl)
    : null;
  const baseUrl = testOrigin ?? GOOGLE_CLASSROOM_API_ORIGIN;
  const courses = await listGoogleClassroomPagesForConnection<GoogleClassroomApiCourse>(
    connection,
    `${baseUrl}/v1/courses?pageSize=${GOOGLE_CLASSROOM_PAGE_SIZE}&courseStates=ACTIVE&courseStates=ARCHIVED&courseStates=PROVISIONED`,
    "courses",
  );
  return courses.map((course) => ({
    id: String(course.id),
    name: course.name || "Untitled Classroom",
    section: course.section || null,
    workflowState: course.courseState || "ACTIVE",
  }));
}

async function ensureTeacherUser(params: {
  schoolId: string;
  name: string;
  email: string;
  errors: SyncErrorInput[];
  summary: SyncSummary;
}): Promise<string | null> {
  const email = normalizeEmail(params.email);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.schoolId !== params.schoolId || !["TEACHER", "SCHOOL_ADMIN"].includes(existing.role)) {
      params.errors.push({
        externalType: "USER",
        externalId: email,
        code: "TEACHER_EMAIL_CONFLICT",
        message: `Teacher email ${email} already exists outside this school's staff roster.`,
      });
      params.summary.counts.errors++;
      return null;
    }
    return existing.id;
  }

  const passwordHash = await bcrypt.hash(crypto.randomBytes(18).toString("base64url"), 8);
  const created = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: params.name,
      role: "TEACHER",
      schoolId: params.schoolId,
      emailVerified: true,
      isTestAccount: true,
    },
  });
  return created.id;
}

async function reconcileRemovedStudentEnrollment(params: {
  mapping: any;
  schoolId: string;
  operations: SyncSummary["operations"];
}): Promise<void> {
  if (params.mapping.localType === "StudentInvitation") {
    const invitation = await prisma.studentInvitation.findUnique({
      where: { id: params.mapping.localId },
      select: { id: true, status: true, email: true },
    });
    if (!invitation || invitation.status !== "PENDING") return;

    const otherActiveMappings = await prisma.integrationExternalMapping.count({
      where: {
        id: { not: params.mapping.id },
        connectionId: params.mapping.connectionId,
        externalType: "ENROLLMENT",
        localType: "StudentInvitation",
        localId: invitation.id,
        isActive: true,
      },
    });
    if (otherActiveMappings === 0) {
      await prisma.studentInvitation.update({
        where: { id: invitation.id },
        data: { status: "REVOKED" },
      });
      params.operations.push({
        type: "invitation",
        target: invitation.email,
        action: "revoke-missing-upstream",
      });
    }
    return;
  }

  if (params.mapping.localType === "StudentCohortMembership") {
    const membership = await prisma.studentCohortMembership.findUnique({
      where: { id: params.mapping.localId },
      select: { id: true, studentId: true, cohortId: true, student: { select: { email: true } }, cohort: { select: { name: true } } },
    });
    if (!membership) return;
    await deactivateStudentCohortMembership({
      studentId: membership.studentId,
      cohortId: membership.cohortId,
      clearPrimaryIfMatches: true,
    });
    params.operations.push({
      type: "student-membership",
      target: `${membership.student.email} -> ${membership.cohort.name}`,
      action: "deactivate-missing-upstream",
    });
    return;
  }

  if (params.mapping.localType === "User") {
    const sectionMapping = params.mapping.externalParentId
      ? await prisma.integrationExternalMapping.findFirst({
          where: {
            connectionId: params.mapping.connectionId,
            externalType: "COURSE",
            externalId: params.mapping.externalParentId,
            schoolId: params.schoolId,
          },
        })
      : null;
    if (sectionMapping) {
      await deactivateStudentCohortMembership({
        studentId: params.mapping.localId,
        cohortId: sectionMapping.localId,
        clearPrimaryIfMatches: true,
      });
    }
  }
}

async function runGoogleClassroomSync(params: {
  schoolId: string;
  actorId: string;
  mode: "PREVIEW" | "APPLY";
  selectedExternalCourseIds?: unknown;
}): Promise<{ connection: any; job: any; summary: SyncSummary }> {
  const connection = await getConnectionForSchool(params.schoolId);
  if (!connection || !["CONNECTED", "ERROR"].includes(connection.status)) {
    throw new Error("Google Classroom is not connected for this school.");
  }

  const config = parseConnectionConfig(connection.config);
  const selectedExternalCourseIds = normalizeSelectedExternalCourseIds(
    params.selectedExternalCourseIds ?? config.selectedExternalCourseIds,
  );
  const job = await prisma.integrationSyncJob.create({
    data: {
      connectionId: connection.id,
      provider: "GOOGLE_CLASSROOM",
      schoolId: params.schoolId,
      mode: params.mode,
      startedById: params.actorId,
      status: "RUNNING",
    },
  });
  let dataset: GoogleClassroomSyncDataset;
  try {
    dataset = await getGoogleClassroomDataset(connection, selectedExternalCourseIds);
  } catch (error) {
    await prisma.integrationSyncJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        summary: JSON.stringify({ stage: "PROVIDER_DATASET", error: "Google Classroom provider request failed" }),
        finishedAt: new Date(),
      },
    });
    throw error;
  }
  if (params.mode === "APPLY") {
    await prisma.integrationConnection.update({
      where: { id: connection.id },
      data: {
        config: JSON.stringify({ ...config, selectedExternalCourseIds }),
        updatedById: params.actorId,
      },
    });
  }
  const plans = buildSectionPlans(dataset).sort((a, b) => a.cohortName.localeCompare(b.cohortName));
  const summary: SyncSummary = {
    provider: "GOOGLE_CLASSROOM",
    mode: params.mode,
    scenario: dataset.scenario,
    counts: {
      cohortsCreated: 0,
      cohortsUpdated: 0,
      cohortsArchived: 0,
      teacherAssignmentsCreated: 0,
      invitationsCreated: 0,
      invitationsUpdated: 0,
      existingUsersLinked: 0,
      usersAssignedToCohort: 0,
      skipped: 0,
      errors: 0,
    },
    operations: [],
  };
  const errors: SyncErrorInput[] = [];
  const activeSectionIds = new Set<string>();
  const activeEnrollmentIds = new Set<string>();
  const seenStudentEmails = new Map<string, string>();

  const [sectionMappings, enrollmentMappings, userMappings] = await Promise.all([
    prisma.integrationExternalMapping.findMany({
      where: { connectionId: connection.id, externalType: "COURSE" },
    }),
    prisma.integrationExternalMapping.findMany({
      where: { connectionId: connection.id, externalType: "ENROLLMENT" },
    }),
    prisma.integrationExternalMapping.findMany({
      where: { connectionId: connection.id, externalType: "USER" },
    }),
  ]);

  const sectionMappingByExternalId = new Map<string, (typeof sectionMappings)[number]>(sectionMappings.map((mapping) => [mapping.externalId, mapping]));
  const userMappingByExternalId = new Map<string, (typeof userMappings)[number]>(userMappings.map((mapping) => [mapping.externalId, mapping]));

  for (const plan of plans) {
    activeSectionIds.add(plan.sectionId);
    const sectionMapping = sectionMappingByExternalId.get(plan.sectionId);
    let targetCohortId = sectionMapping?.localId ?? null;

    if (sectionMapping) {
      const existingCohort = await prisma.cohort.findFirst({
        where: { id: sectionMapping.localId, schoolId: params.schoolId },
      });
      if (!existingCohort) {
        errors.push({
          externalType: "COURSE",
          externalId: plan.sectionId,
          localType: "Cohort",
          localId: sectionMapping.localId,
          code: "MAPPED_COHORT_MISSING",
          message: `Mapped cohort for section ${plan.cohortName} no longer exists.`,
        });
        summary.counts.errors++;
        summary.counts.skipped++;
        continue;
      }

      if (params.mode === "APPLY") {
        const nextStatus = plan.archived ? "ARCHIVED" : existingCohort.status === "ARCHIVED" ? "PUBLISHED" : existingCohort.status;
        await prisma.cohort.update({
          where: { id: existingCohort.id },
          data: { name: plan.cohortName, status: nextStatus },
        });
        await prisma.integrationExternalMapping.update({
          where: { id: sectionMapping.id },
          data: {
            externalName: plan.cohortName,
            externalParentId: plan.courseId,
            isActive: !plan.archived,
          },
        });
      }

      targetCohortId = existingCohort.id;
      if (plan.archived) {
        summary.counts.cohortsArchived++;
        summary.operations.push({ type: "cohort", target: plan.cohortName, action: "archive" });
      } else {
        summary.counts.cohortsUpdated++;
        summary.operations.push({ type: "cohort", target: plan.cohortName, action: "update" });
      }
    } else if (!plan.archived) {
      summary.counts.cohortsCreated++;
      summary.operations.push({ type: "cohort", target: plan.cohortName, action: "create" });
      if (params.mode === "APPLY") {
        const created = await prisma.cohort.create({
          data: {
            name: plan.cohortName,
            schoolId: params.schoolId,
            status: "DRAFT",
          },
        });
        targetCohortId = created.id;
        await prisma.integrationExternalMapping.create({
          data: {
            connectionId: connection.id,
            provider: "GOOGLE_CLASSROOM",
            schoolId: params.schoolId,
            externalType: "COURSE",
            externalId: plan.sectionId,
            externalParentId: plan.courseId,
            externalName: plan.cohortName,
            localType: "Cohort",
            localId: created.id,
            isActive: true,
          },
        });
      }
    } else {
      summary.operations.push({ type: "cohort", target: plan.cohortName, action: "skip", detail: "Archived upstream section" });
      summary.counts.skipped++;
      continue;
    }

    if (!targetCohortId) continue;

    for (const teacher of plan.teacherUsers) {
      const teacherId = await ensureTeacherUser({
        schoolId: params.schoolId,
        name: teacher.name,
        email: teacher.email,
        errors,
        summary,
      });
      if (!teacherId) continue;

      const exists = await prisma.cohortTeacherAssignment.findUnique({
        where: { cohortId_teacherId: { cohortId: targetCohortId, teacherId } },
      });
      if (!exists) {
        summary.counts.teacherAssignmentsCreated++;
        summary.operations.push({ type: "teacher-assignment", target: `${teacher.email} -> ${plan.cohortName}`, action: "assign" });
        if (params.mode === "APPLY") {
          await prisma.cohortTeacherAssignment.create({
            data: { cohortId: targetCohortId, teacherId },
          });
        }
      }

      if (params.mode === "APPLY") {
        await prisma.integrationExternalMapping.upsert({
          where: {
            connectionId_externalType_externalId: {
              connectionId: connection.id,
              externalType: "USER",
              externalId: teacher.id,
            },
          },
          update: {
            externalName: teacher.name,
            externalParentId: plan.sectionId,
            localType: "User",
            localId: teacherId,
            isActive: true,
          },
          create: {
            connectionId: connection.id,
            provider: "GOOGLE_CLASSROOM",
            schoolId: params.schoolId,
            externalType: "USER",
            externalId: teacher.id,
            externalParentId: plan.sectionId,
            externalName: teacher.name,
            localType: "User",
            localId: teacherId,
            isActive: true,
          },
        });
      }
    }

    for (const student of plan.studentUsers) {
      activeEnrollmentIds.add(student.enrollmentId);
      const normalizedEmail = normalizeEmail(student.email);
      const existingEmailOwner = seenStudentEmails.get(normalizedEmail);
      if (existingEmailOwner && existingEmailOwner !== student.id) {
        errors.push({
          externalType: "USER",
          externalId: student.id,
          code: "DUPLICATE_STUDENT_EMAIL",
          message: `Duplicate Google Classroom student email detected for ${normalizedEmail}.`,
          details: { existingExternalId: existingEmailOwner },
        });
        summary.counts.errors++;
        summary.counts.skipped++;
        continue;
      }
      seenStudentEmails.set(normalizedEmail, student.id);

      let existingStudent: { id: string; cohortId: string | null; schoolId: string | null } | null = null;
      const mappedUser = userMappingByExternalId.get(student.id);
      if (mappedUser?.localType === "User") {
        existingStudent = await prisma.user.findFirst({
          where: { id: mappedUser.localId, role: "STUDENT", schoolId: params.schoolId },
          select: { id: true, cohortId: true, schoolId: true },
        });
      }
      if (!existingStudent) {
        existingStudent = await prisma.user.findFirst({
          where: {
            email: student.email,
            role: "STUDENT",
            schoolId: params.schoolId,
          },
          select: { id: true, cohortId: true, schoolId: true },
        });
      }

      if (existingStudent) {
        summary.counts.existingUsersLinked++;
        summary.operations.push({ type: "student-link", target: `${student.email} -> ${plan.cohortName}`, action: "link-existing-user" });
        if (params.mode === "APPLY") {
          const membership = await ensureStudentCohortMembership({
            studentId: existingStudent.id,
            cohortId: targetCohortId,
            source: "GOOGLE_CLASSROOM",
            forcePrimary: !existingStudent.cohortId,
            schoolId: params.schoolId,
          });
          if (!existingStudent.cohortId) {
            summary.counts.usersAssignedToCohort++;
          }
          await prisma.integrationExternalMapping.upsert({
            where: {
              connectionId_externalType_externalId: {
                connectionId: connection.id,
                externalType: "USER",
                externalId: student.id,
              },
            },
            update: {
              externalName: student.name,
              localType: "User",
              localId: existingStudent.id,
              externalParentId: plan.sectionId,
              isActive: true,
            },
            create: {
              connectionId: connection.id,
              provider: "GOOGLE_CLASSROOM",
              schoolId: params.schoolId,
              externalType: "USER",
              externalId: student.id,
              externalParentId: plan.sectionId,
              externalName: student.name,
              localType: "User",
              localId: existingStudent.id,
              isActive: true,
            },
          });
          await prisma.integrationExternalMapping.upsert({
            where: {
              connectionId_externalType_externalId: {
                connectionId: connection.id,
                externalType: "ENROLLMENT",
                externalId: student.enrollmentId,
              },
            },
            update: {
              externalName: student.name,
              externalParentId: plan.sectionId,
              localType: "StudentCohortMembership",
              localId: membership.id,
              isActive: true,
            },
            create: {
              connectionId: connection.id,
              provider: "GOOGLE_CLASSROOM",
              schoolId: params.schoolId,
              externalType: "ENROLLMENT",
              externalId: student.enrollmentId,
              externalParentId: plan.sectionId,
              externalName: student.name,
              localType: "StudentCohortMembership",
              localId: membership.id,
              isActive: true,
            },
          });
        }
        continue;
      }

      const existingInvitation = await prisma.studentInvitation.findUnique({
        where: { cohortId_email: { cohortId: targetCohortId, email: student.email } },
      });

      if (existingInvitation) {
        summary.counts.invitationsUpdated++;
        summary.operations.push({ type: "invitation", target: `${student.email} -> ${plan.cohortName}`, action: "update" });
        if (params.mode === "APPLY") {
          await prisma.studentInvitation.update({
            where: { id: existingInvitation.id },
            data: {
              name: student.name,
              status: existingInvitation.status === "REVOKED" ? "PENDING" : existingInvitation.status,
            },
          });
          await prisma.integrationExternalMapping.upsert({
            where: {
              connectionId_externalType_externalId: {
                connectionId: connection.id,
                externalType: "ENROLLMENT",
                externalId: student.enrollmentId,
              },
            },
            update: {
              externalName: student.name,
              externalParentId: plan.sectionId,
              localType: "StudentInvitation",
              localId: existingInvitation.id,
              isActive: true,
            },
            create: {
              connectionId: connection.id,
              provider: "GOOGLE_CLASSROOM",
              schoolId: params.schoolId,
              externalType: "ENROLLMENT",
              externalId: student.enrollmentId,
              externalParentId: plan.sectionId,
              externalName: student.name,
              localType: "StudentInvitation",
              localId: existingInvitation.id,
              isActive: true,
            },
          });
        }
        continue;
      }

      summary.counts.invitationsCreated++;
      summary.operations.push({ type: "invitation", target: `${student.email} -> ${plan.cohortName}`, action: "create" });
      if (params.mode === "APPLY") {
        const invitation = await prisma.studentInvitation.create({
          data: {
            cohortId: targetCohortId,
            email: student.email,
            name: student.name,
            token: hashToken(generateToken()), // never emailed here — publish rotates to a fresh token
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            status: "PENDING",
          },
        });
        await prisma.integrationExternalMapping.upsert({
          where: {
            connectionId_externalType_externalId: {
              connectionId: connection.id,
              externalType: "ENROLLMENT",
              externalId: student.enrollmentId,
            },
          },
          update: {
            externalName: student.name,
            externalParentId: plan.sectionId,
            localType: "StudentInvitation",
            localId: invitation.id,
            isActive: true,
          },
          create: {
            connectionId: connection.id,
            provider: "GOOGLE_CLASSROOM",
            schoolId: params.schoolId,
            externalType: "ENROLLMENT",
            externalId: student.enrollmentId,
            externalParentId: plan.sectionId,
            externalName: student.name,
            localType: "StudentInvitation",
            localId: invitation.id,
            isActive: true,
          },
        });
      }
    }
  }

  const mappedSectionsToArchive = sectionMappings.filter((mapping) => mapping.isActive && !activeSectionIds.has(mapping.externalId));
  for (const mapping of mappedSectionsToArchive) {
    summary.counts.cohortsArchived++;
    summary.operations.push({ type: "cohort", target: mapping.externalName ?? mapping.externalId, action: "archive-missing-upstream" });
    if (params.mode === "APPLY") {
      await prisma.cohort.updateMany({
        where: { id: mapping.localId, schoolId: params.schoolId },
        data: { status: "ARCHIVED" },
      });
      await prisma.integrationExternalMapping.update({
        where: { id: mapping.id },
        data: { isActive: false },
      });
    }
  }

  const enrollmentMappingsToDeactivate = enrollmentMappings.filter((mapping) => mapping.isActive && !activeEnrollmentIds.has(mapping.externalId));
  for (const mapping of enrollmentMappingsToDeactivate) {
    summary.operations.push({
      type: "enrollment",
      target: mapping.externalName ?? mapping.externalId,
      action: "deactivate-missing-upstream",
    });
    if (params.mode === "APPLY") {
      await reconcileRemovedStudentEnrollment({
        mapping,
        schoolId: params.schoolId,
        operations: summary.operations,
      });
      await prisma.integrationExternalMapping.update({
        where: { id: mapping.id },
        data: { isActive: false },
      });
    }
  }

  const nextStatus =
    summary.counts.errors > 0
      ? summary.operations.length > summary.counts.errors
        ? "PARTIAL_FAILED"
        : "FAILED"
      : "COMPLETED";

  if (params.mode === "APPLY") {
    await createSyncErrorRecords({
      syncJobId: job.id,
      connectionId: connection.id,
      schoolId: params.schoolId,
      errors,
    });
  }

  await prisma.integrationSyncJob.update({
    where: { id: job.id },
    data: {
      status: nextStatus,
      summary: JSON.stringify(summary),
      finishedAt: new Date(),
    },
  });
  await prisma.integrationConnection.update({
    where: { id: connection.id },
    data: {
      status: "CONNECTED",
      lastSyncedAt: new Date(),
      lastSyncStatus: nextStatus,
      lastSyncJobId: job.id,
    },
  });

  await logDataAccess({
    actorId: params.actorId,
    action: params.mode === "APPLY" ? "GOOGLE_CLASSROOM_SYNC_APPLY" : "GOOGLE_CLASSROOM_SYNC_PREVIEW",
    targetType: "school",
    targetId: params.schoolId,
    schoolId: params.schoolId,
    details: {
      provider: "GOOGLE_CLASSROOM",
      scenario: dataset.scenario,
      summary: summary.counts,
    },
  });

  return {
    connection,
    job: { ...job, status: nextStatus, summary: JSON.stringify(summary), finishedAt: new Date() },
    summary,
  };
}

export async function getGoogleClassroomOAuthUrlForSchool(params: {
  schoolId: string;
  actorId: string;
  testOrigin?: string;
  displayName?: string;
}) {
  assertOAuthConfigured();
  const testOrigin = await normalizeGoogleTestOrigin(params.testOrigin);
  const authOrigin = testOrigin ?? GOOGLE_CLASSROOM_AUTH_ORIGIN;
  const displayName = params.displayName?.trim() || "Google Classroom";
  const { state, browserBinding } = createOAuthState();
  await storeOAuthState("googleClassroomOAuthState", state, browserBinding, {
    schoolId: params.schoolId, actorId: params.actorId, baseUrl: null, testOrigin, displayName,
  });
  const scope = encodeURIComponent([
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/classroom.courses.readonly",
    "https://www.googleapis.com/auth/classroom.rosters.readonly",
  ].join(" "));
  const url =
    `${authOrigin}/o/oauth2/v2/auth?client_id=${encodeURIComponent(GOOGLE_CLASSROOM_CLIENT_ID)}` +
    `&response_type=code&redirect_uri=${encodeURIComponent(GOOGLE_CLASSROOM_CALLBACK_URL)}` +
    `&access_type=offline&prompt=consent&scope=${scope}&state=${encodeURIComponent(state)}`;
  return { url, browserBinding };
}

export async function handleGoogleClassroomOAuthCallback(params: {
  code?: string;
  state?: string;
  browserBinding?: string;
  error?: string;
}) {
  if (params.error) {
    const target = new URL("/settings", CLIENT_URL);
    target.searchParams.set("tab", "integrations");
    target.searchParams.set("googleClassroomError", params.error);
    return target.toString();
  }
  if (!params.code || !params.state) {
    const target = new URL("/settings", CLIENT_URL);
    target.searchParams.set("tab", "integrations");
    target.searchParams.set("googleClassroomError", "missing_oauth_parameters");
    return target.toString();
  }

  try {
    if (!params.browserBinding) throw new Error("Missing OAuth browser binding.");
    const state = await claimOAuthState<GoogleClassroomStatePayload>("googleClassroomOAuthState", params.state, params.browserBinding);
    await assertOAuthAdministrator(state.actorId, state.schoolId);
    const token = await exchangeAuthorizationCode(params.code, state.testOrigin);
    const encryptedCredentials = serializeCredentials(token);
    const apiOrigin = state.testOrigin ?? GOOGLE_CLASSROOM_API_ORIGIN;
    await prisma.integrationConnection.upsert({
      where: { provider_schoolId: { provider: "GOOGLE_CLASSROOM", schoolId: state.schoolId } },
      update: {
        status: "CONNECTED",
        displayName: state.displayName,
        baseUrl: apiOrigin,
        credentialsEncrypted: encryptedCredentials,
        config: JSON.stringify({ mode: "OAUTH", selectedExternalCourseIds: [] }),
        disconnectedAt: null,
        updatedById: state.actorId,
      },
      create: {
        provider: "GOOGLE_CLASSROOM",
        schoolId: state.schoolId,
        status: "CONNECTED",
        displayName: state.displayName,
        baseUrl: apiOrigin,
        credentialsEncrypted: encryptedCredentials,
        config: JSON.stringify({ mode: "OAUTH", selectedExternalCourseIds: [] }),
        createdById: state.actorId,
        updatedById: state.actorId,
      },
    });
    await logDataAccess({
      actorId: state.actorId,
      action: "GOOGLE_CLASSROOM_CONNECT",
      targetType: "school",
      targetId: state.schoolId,
      schoolId: state.schoolId,
      details: {
        provider: "GOOGLE_CLASSROOM",
        mode: "OAUTH",
        hasEncryptedCredentials: true,
      },
    });

    const target = new URL("/settings", CLIENT_URL);
    target.searchParams.set("tab", "integrations");
    target.searchParams.set("googleClassroom", "connected");
    return target.toString();
  } catch (error) {
    const message = error instanceof Error ? error.message : "googleClassroom_oauth_failed";
    const target = new URL("/settings", CLIENT_URL);
    target.searchParams.set("tab", "integrations");
    target.searchParams.set("googleClassroomError", message.slice(0, 180));
    return target.toString();
  }
}

export async function connectGoogleClassroomForSchool(params: {
  schoolId: string;
  actorId: string;
  input: unknown;
}) {
  const input = googleClassroomConnectSchema.parse(params.input ?? {});
  if (input.mode === "OAUTH") {
    return getGoogleClassroomOAuthUrlForSchool({
      schoolId: params.schoolId,
      actorId: params.actorId,
      displayName: input.displayName,
    });
  }

  assertMockAllowed();
  const config: GoogleClassroomConnectionConfig = {
    mode: "MOCK",
    mockScenario: input.mockScenario ?? "default",
    selectedExternalCourseIds: [],
  };
  const mockBaseUrl = new URL(input.baseUrl ?? "https://google-classroom.mock.local").origin;
  const connection = await prisma.integrationConnection.upsert({
    where: { provider_schoolId: { provider: "GOOGLE_CLASSROOM", schoolId: params.schoolId } },
    update: {
      status: "CONNECTED",
      displayName: input.displayName ?? "Google Classroom Mock Sandbox",
      baseUrl: mockBaseUrl,
      credentialsEncrypted: encryptField(JSON.stringify({ mode: "MOCK", placeholderToken: "dev-only" })),
      config: JSON.stringify(config),
      disconnectedAt: null,
      updatedById: params.actorId,
    },
    create: {
      provider: "GOOGLE_CLASSROOM",
      schoolId: params.schoolId,
      status: "CONNECTED",
      displayName: input.displayName ?? "Google Classroom Mock Sandbox",
      baseUrl: mockBaseUrl,
      credentialsEncrypted: encryptField(JSON.stringify({ mode: "MOCK", placeholderToken: "dev-only" })),
      config: JSON.stringify(config),
      createdById: params.actorId,
      updatedById: params.actorId,
    },
  });

  await logDataAccess({
    actorId: params.actorId,
    action: "GOOGLE_CLASSROOM_CONNECT",
    targetType: "school",
    targetId: params.schoolId,
    schoolId: params.schoolId,
    details: {
      provider: "GOOGLE_CLASSROOM",
      mode: "MOCK",
      scenario: config.mockScenario,
      hasEncryptedCredentials: !!decryptField(connection.credentialsEncrypted),
    },
  });

  return safeConnectionResponse(connection);
}

export async function disconnectGoogleClassroomForSchool(params: { schoolId: string; actorId: string }) {
  const existing = await getConnectionForSchool(params.schoolId);
  if (!existing) return null;

  const updated = await prisma.integrationConnection.update({
    where: { id: existing.id },
    data: {
      status: "DISCONNECTED",
      disconnectedAt: new Date(),
      updatedById: params.actorId,
      credentialsEncrypted: null,
    },
  });

  await logDataAccess({
    actorId: params.actorId,
    action: "GOOGLE_CLASSROOM_DISCONNECT",
    targetType: "school",
    targetId: params.schoolId,
    schoolId: params.schoolId,
    details: { provider: "GOOGLE_CLASSROOM" },
  });

  return safeConnectionResponse(updated);
}

export async function getGoogleClassroomStatusForSchool(schoolId: string) {
  const connection = await getConnectionForSchool(schoolId);
  const jobs = connection
    ? await prisma.integrationSyncJob.findMany({
        where: { connectionId: connection.id },
        orderBy: { createdAt: "desc" },
        take: 10,
      })
    : [];
  return {
    capabilities: getGoogleClassroomCapabilities(),
    ops: await buildGoogleClassroomOpsSummary(connection),
    connection: connection ? safeConnectionResponse(connection) : null,
    jobs: jobs.map((job) => ({
      id: job.id,
      mode: job.mode,
      status: job.status,
      summary: job.summary ? JSON.parse(job.summary) : null,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
    })),
  };
}

export async function getGoogleClassroomErrorsForSchool(schoolId: string) {
  const connection = await getConnectionForSchool(schoolId);
  if (!connection) return [];
  const errors = await prisma.integrationSyncError.findMany({
    where: { connectionId: connection.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return errors.map((error) => ({
    id: error.id,
    code: error.code,
    message: error.message,
    externalType: error.externalType,
    externalId: error.externalId,
    localType: error.localType,
    localId: error.localId,
    details: error.details ? JSON.parse(error.details) : null,
    createdAt: error.createdAt,
    syncJobId: error.syncJobId,
  }));
}

export async function getGoogleClassroomCoursesForSchool(schoolId: string) {
  const connection = await getConnectionForSchool(schoolId);
  if (!connection || !["CONNECTED", "ERROR"].includes(connection.status)) {
    throw new Error("Google Classroom is not connected for this school.");
  }
  const config = parseConnectionConfig(connection.config);
  return {
    courses: await listGoogleClassroomCourseMetadata(connection),
    selectedExternalCourseIds: config.selectedExternalCourseIds,
  };
}

export async function previewGoogleClassroomSyncForSchool(params: { schoolId: string; actorId: string; selectedExternalCourseIds?: unknown }) {
  const result = await runGoogleClassroomSync({
    schoolId: params.schoolId,
    actorId: params.actorId,
    mode: "PREVIEW",
    selectedExternalCourseIds: params.selectedExternalCourseIds,
  });
  return {
    connection: safeConnectionResponse(result.connection),
    jobId: result.job.id,
    status: result.job.status,
    summary: result.summary,
  };
}

export async function applyGoogleClassroomSyncForSchool(params: { schoolId: string; actorId: string; selectedExternalCourseIds?: unknown }) {
  const result = await runGoogleClassroomSync({
    schoolId: params.schoolId,
    actorId: params.actorId,
    mode: "APPLY",
    selectedExternalCourseIds: params.selectedExternalCourseIds,
  });
  return {
    connection: safeConnectionResponse(result.connection),
    jobId: result.job.id,
    status: result.job.status,
    summary: result.summary,
  };
}
