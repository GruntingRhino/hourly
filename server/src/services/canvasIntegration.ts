import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import prisma from "../lib/prisma";
import { decryptField, encryptField } from "../lib/fieldEncryption";
import { logDataAccess } from "../lib/dataAccessLog";
import { deactivateStudentCohortMembership, ensureStudentCohortMembership } from "../lib/studentCohorts";
import { getCanvasMockDataset, type CanvasMockDataset, type CanvasMockScenario } from "./canvasMock";

const IS_PROD_LIKE =
  process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production" || process.env.APP_ENV === "production";
const CANVAS_ENABLE_MOCK = process.env.CANVAS_ENABLE_MOCK === "true" || !IS_PROD_LIKE;
const CANVAS_REQUEST_TIMEOUT_MS = Number(process.env.CANVAS_REQUEST_TIMEOUT_MS || 15000);
const CANVAS_PAGE_SIZE = Math.max(1, Math.min(100, Number(process.env.CANVAS_PAGE_SIZE || 100)));
const JWT_SECRET = process.env.JWT_SECRET as string;
const CLIENT_URL = process.env.CLIENT_URL || process.env.APP_URL || "http://127.0.0.1:5173";
const CANVAS_CLIENT_ID = process.env.CANVAS_CLIENT_ID || "";
const CANVAS_CLIENT_SECRET = process.env.CANVAS_CLIENT_SECRET || "";
const CANVAS_CALLBACK_URL = process.env.CANVAS_CALLBACK_URL || "http://localhost:3001/api/integrations/canvas/oauth/callback";

const canvasConnectSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("MOCK"),
    baseUrl: z.string().url().optional(),
    displayName: z.string().min(1).max(255).optional(),
    mockScenario: z.enum(["default", "renamed", "archived", "deleted", "student_removed"]).optional(),
  }),
  z.object({
    mode: z.literal("OAUTH"),
    baseUrl: z.string().url(),
    displayName: z.string().min(1).max(255).optional(),
  }),
]);

type CanvasConnectionConfig =
  | {
      mode: "MOCK";
      mockScenario: CanvasMockScenario;
    }
  | {
      mode: "OAUTH";
    };

type CanvasCredentials = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  tokenType: string;
  scope: string | null;
};

type CanvasStatePayload = {
  purpose: "canvas-oauth";
  schoolId: string;
  actorId: string;
  baseUrl: string;
  displayName: string;
};

type CanvasSyncDataset = {
  scenario: string;
  courses: Array<{ id: string; name: string; workflowState: "available" | "completed" | "deleted" }>;
  sections: Array<{ id: string; courseId: string; name: string; workflowState: "active" | "completed" | "deleted" }>;
  users: Array<{ id: string; name: string; email: string; role: "teacher" | "student" }>;
  enrollments: Array<{
    id: string;
    userId: string;
    sectionId: string;
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
  provider: "CANVAS";
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

type CanvasOpsSummary = {
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

type CanvasOAuthTokenResponse = {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
};

type CanvasApiCourse = {
  id: string | number;
  name: string;
  workflow_state?: "available" | "completed" | "deleted";
};

type CanvasApiSection = {
  id: string | number;
  course_id?: string | number;
  name: string;
  workflow_state?: "active" | "completed" | "deleted";
};

type CanvasApiEnrollment = {
  id: string | number;
  user_id: string | number;
  course_id?: string | number;
  course_section_id?: string | number;
  type?: "TeacherEnrollment" | "StudentEnrollment";
  role?: "TeacherEnrollment" | "StudentEnrollment";
  enrollment_state?: "active" | "inactive" | "deleted" | "invited";
  user?: {
    id?: string | number;
    name?: string;
    sortable_name?: string;
    short_name?: string;
    login_id?: string;
    primary_email?: string;
  };
};

function assertOAuthConfigured(): void {
  if (!CANVAS_CLIENT_ID || !CANVAS_CLIENT_SECRET || !CANVAS_CALLBACK_URL) {
    throw new Error("Canvas OAuth is not configured. Set CANVAS_CLIENT_ID, CANVAS_CLIENT_SECRET, and CANVAS_CALLBACK_URL.");
  }
}

function assertMockAllowed(): void {
  if (!CANVAS_ENABLE_MOCK) {
    throw new Error("Canvas mock mode is disabled. Use OAuth mode with a real Canvas tenant.");
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeCanvasBaseUrl(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/, "");
  if (!normalized) throw new Error("Canvas base URL is required.");
  const parsed = new URL(normalized);
  if (IS_PROD_LIKE && parsed.protocol !== "https:") {
    throw new Error("Canvas base URL must use HTTPS in production-like environments.");
  }
  return normalized;
}

function parseConnectionConfig(raw: string | null): CanvasConnectionConfig {
  if (!raw) return { mode: "MOCK", mockScenario: "default" };
  try {
    const parsed = JSON.parse(raw) as { mode?: "MOCK" | "OAUTH"; mockScenario?: CanvasMockScenario };
    if (parsed.mode === "OAUTH") return { mode: "OAUTH" };
    return {
      mode: "MOCK",
      mockScenario: parsed.mockScenario ?? "default",
    };
  } catch {
    return { mode: "MOCK", mockScenario: "default" };
  }
}

function parseCredentials(raw: string | null): CanvasCredentials | null {
  const decrypted = decryptField(raw);
  if (!decrypted) return null;
  try {
    const parsed = JSON.parse(decrypted) as Partial<CanvasCredentials>;
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

function serializeCredentials(token: CanvasOAuthTokenResponse, existing?: CanvasCredentials | null): string {
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

function isCredentialExpired(credentials: CanvasCredentials | null): boolean {
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
  };
}

function buildCanvasStateToken(payload: CanvasStatePayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "15m" });
}

function verifyCanvasStateToken(token: string): CanvasStatePayload {
  const payload = jwt.verify(token, JWT_SECRET) as CanvasStatePayload;
  if (payload.purpose !== "canvas-oauth") {
    throw new Error("Invalid Canvas OAuth state.");
  }
  return payload;
}

function parseCanvasLinkHeader(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel=\"next\"/i);
  return nextMatch?.[1] ?? null;
}

function getCanvasCapabilities() {
  return {
    mockAllowed: CANVAS_ENABLE_MOCK,
    oauthConfigured: Boolean(CANVAS_CLIENT_ID && CANVAS_CLIENT_SECRET && CANVAS_CALLBACK_URL),
    requestTimeoutMs: CANVAS_REQUEST_TIMEOUT_MS,
    integrationScope: "SINGLE_SCHOOL" as const,
  };
}

async function buildCanvasOpsSummary(connection: any | null): Promise<CanvasOpsSummary> {
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
  if (hasRepeatedFailures) warnings.push("Canvas sync is failing repeatedly. Investigate credentials, scopes, and provider availability.");
  if (tokenRefreshErrors > 0) warnings.push("Canvas token refresh failures were detected in the last 24 hours.");
  if (staleSync) warnings.push("Canvas has not completed a successful sync in the last 24 hours.");
  if (connection.status === "ERROR") warnings.push("Canvas connection is in an error state and needs admin attention.");

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

export async function getCanvasOperationalStatus(params?: { schoolId?: string }) {
  const where = params?.schoolId ? { provider: "CANVAS" as const, schoolId: params.schoolId } : { provider: "CANVAS" as const };
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
    ops: await buildCanvasOpsSummary(connection),
  })));

  return {
    capabilities: getCanvasCapabilities(),
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

async function canvasFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CANVAS_REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Canvas request timed out after ${CANVAS_REQUEST_TIMEOUT_MS}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function listCanvasPages<T>(initialUrl: string, accessToken: string): Promise<T[]> {
  const items: T[] = [];
  let nextUrl: string | null = initialUrl;

  while (nextUrl) {
    const response = await canvasFetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Canvas API request failed (${response.status}): ${body.slice(0, 300)}`);
    }
    const page = await response.json() as T[];
    items.push(...page);
    nextUrl = parseCanvasLinkHeader(response.headers.get("link"));
  }

  return items;
}

async function listCanvasPagesForConnection<T>(connection: any, initialUrl: string): Promise<T[]> {
  const items: T[] = [];
  let nextUrl: string | null = initialUrl;
  let credentials = await ensureLiveAccessToken(connection);
  let refreshRetried = false;

  while (nextUrl) {
    const response = await canvasFetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
      },
    });

    if ((response.status === 401 || response.status === 403) && !refreshRetried) {
      refreshRetried = true;
      credentials = await refreshOAuthCredentials(connection);
      continue;
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Canvas API request failed (${response.status}): ${body.slice(0, 300)}`);
    }

    const page = await response.json() as T[];
    items.push(...page);
    nextUrl = parseCanvasLinkHeader(response.headers.get("link"));
  }

  return items;
}

function buildSectionPlans(dataset: CanvasSyncDataset): SectionPlan[] {
  const courseById = new Map(dataset.courses.map((course) => [course.id, course]));
  const userById = new Map(dataset.users.map((user) => [user.id, user]));

  return dataset.sections.map((section) => {
    const course = courseById.get(section.courseId);
    const archived = !course || course.workflowState !== "available" || section.workflowState !== "active";
    const enrollments = dataset.enrollments.filter(
      (enrollment) => enrollment.sectionId === section.id && enrollment.workflowState === "active"
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
      sectionId: section.id,
      courseId: section.courseId,
      cohortName: `${course?.name ?? "Unknown Course"} - ${section.name}`,
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
      provider: "CANVAS",
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
    where: { provider_schoolId: { provider: "CANVAS", schoolId } },
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
        action: "CANVAS_CONNECTION_ERROR",
        targetType: "school",
        targetId: connection.schoolId,
        schoolId: connection.schoolId,
        details: { provider: "CANVAS", message },
      });
    }
  }
}

async function exchangeAuthorizationCode(baseUrl: string, code: string): Promise<CanvasOAuthTokenResponse> {
  assertOAuthConfigured();
  const tokenUrl = `${normalizeCanvasBaseUrl(baseUrl)}/login/oauth2/token`;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: CANVAS_CLIENT_ID,
    client_secret: CANVAS_CLIENT_SECRET,
    redirect_uri: CANVAS_CALLBACK_URL,
    code,
  });

  const response = await canvasFetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Canvas OAuth token exchange failed: ${errorBody.slice(0, 300)}`);
  }
  return response.json() as Promise<CanvasOAuthTokenResponse>;
}

async function refreshOAuthCredentials(connection: any): Promise<CanvasCredentials> {
  const credentials = parseCredentials(connection.credentialsEncrypted);
  if (!credentials?.refreshToken) {
    await markConnectionError(connection.id, connection.updatedById ?? connection.createdById, "Missing Canvas refresh token.");
    throw new Error("Canvas credentials are missing a refresh token.");
  }
  assertOAuthConfigured();

  const response = await canvasFetch(`${normalizeCanvasBaseUrl(connection.baseUrl)}/login/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: CANVAS_CLIENT_ID,
      client_secret: CANVAS_CLIENT_SECRET,
      refresh_token: credentials.refreshToken,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    await markConnectionError(connection.id, connection.updatedById ?? connection.createdById, `Canvas token refresh failed: ${errorBody.slice(0, 200)}`);
    throw new Error(`Canvas token refresh failed: ${errorBody.slice(0, 200)}`);
  }

  const token = await response.json() as CanvasOAuthTokenResponse;
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

async function ensureLiveAccessToken(connection: any): Promise<CanvasCredentials> {
  const credentials = parseCredentials(connection.credentialsEncrypted);
  if (!credentials) {
    await markConnectionError(connection.id, connection.updatedById ?? connection.createdById, "Missing Canvas credentials.");
    throw new Error("Canvas credentials are missing or unreadable.");
  }
  if (!isCredentialExpired(credentials)) return credentials;
  return refreshOAuthCredentials(connection);
}

async function fetchCanvasOAuthDataset(connection: any): Promise<CanvasSyncDataset> {
  const baseUrl = normalizeCanvasBaseUrl(connection.baseUrl);

  try {
    const courses = await listCanvasPagesForConnection<CanvasApiCourse>(
      connection,
      `${baseUrl}/api/v1/courses?per_page=${CANVAS_PAGE_SIZE}&state[]=available&state[]=completed&state[]=unpublished`
    );

    const sectionRows: CanvasSyncDataset["sections"] = [];
    const userById = new Map<string, CanvasSyncDataset["users"][number]>();
    const enrollmentRows: CanvasSyncDataset["enrollments"] = [];

    for (const course of courses) {
      const courseId = String(course.id);
      const sections = await listCanvasPagesForConnection<CanvasApiSection>(
        connection,
        `${baseUrl}/api/v1/courses/${encodeURIComponent(courseId)}/sections?per_page=${CANVAS_PAGE_SIZE}`
      );
      sectionRows.push(...sections.map((section) => ({
        id: String(section.id),
        courseId: String(section.course_id ?? courseId),
        name: section.name,
        workflowState: (
          section.workflow_state === "deleted"
            ? "deleted"
            : section.workflow_state === "completed"
              ? "completed"
              : "active"
        ) as "active" | "completed" | "deleted",
      })));

      const enrollments = await listCanvasPagesForConnection<CanvasApiEnrollment>(
        connection,
        `${baseUrl}/api/v1/courses/${encodeURIComponent(courseId)}/enrollments?per_page=${CANVAS_PAGE_SIZE}&type[]=TeacherEnrollment&type[]=StudentEnrollment&state[]=active&state[]=invited&include[]=user`
      );

      for (const enrollment of enrollments) {
        const enrollmentType = enrollment.type ?? enrollment.role;
        if (enrollmentType !== "TeacherEnrollment" && enrollmentType !== "StudentEnrollment") continue;
        const userId = String(enrollment.user?.id ?? enrollment.user_id);
        const email = normalizeEmail(
          enrollment.user?.primary_email ||
          enrollment.user?.login_id ||
          ""
        );
        if (!email) continue;
        userById.set(userId, {
          id: userId,
          name: enrollment.user?.name || enrollment.user?.sortable_name || enrollment.user?.short_name || email,
          email,
          role: enrollmentType === "TeacherEnrollment" ? "teacher" : "student",
        });
        enrollmentRows.push({
          id: String(enrollment.id),
          userId,
          sectionId: String(enrollment.course_section_id ?? ""),
          role: enrollmentType,
          workflowState: enrollment.enrollment_state === "deleted"
            ? "deleted"
            : enrollment.enrollment_state === "inactive"
              ? "inactive"
              : "active",
        });
      }
    }

    return {
      scenario: "oauth",
      courses: courses.map((course) => ({
        id: String(course.id),
        name: course.name,
        workflowState: course.workflow_state === "deleted"
          ? "deleted"
          : course.workflow_state === "completed"
            ? "completed"
            : "available",
      })),
      sections: sectionRows,
      users: Array.from(userById.values()),
      enrollments: enrollmentRows.filter((row) => row.sectionId),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Canvas sync failed.";
    if (/401|invalid_token|unauthorized/i.test(message)) {
      await markConnectionError(connection.id, connection.updatedById ?? connection.createdById, message);
    }
    throw error;
  }
}

async function getCanvasDataset(connection: any): Promise<CanvasSyncDataset> {
  const config = parseConnectionConfig(connection.config);
  if (config.mode === "MOCK") {
    return getCanvasMockDataset(config.mockScenario) as CanvasMockDataset as CanvasSyncDataset;
  }
  return fetchCanvasOAuthDataset(connection);
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
            externalType: "SECTION",
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

async function runCanvasSync(params: {
  schoolId: string;
  actorId: string;
  mode: "PREVIEW" | "APPLY";
}): Promise<{ connection: any; job: any; summary: SyncSummary }> {
  const connection = await getConnectionForSchool(params.schoolId);
  if (!connection || !["CONNECTED", "ERROR"].includes(connection.status)) {
    throw new Error("Canvas is not connected for this school.");
  }

  const dataset = await getCanvasDataset(connection);
  const plans = buildSectionPlans(dataset).sort((a, b) => a.cohortName.localeCompare(b.cohortName));
  const job = await prisma.integrationSyncJob.create({
    data: {
      connectionId: connection.id,
      provider: "CANVAS",
      schoolId: params.schoolId,
      mode: params.mode,
      startedById: params.actorId,
      status: "RUNNING",
    },
  });

  const summary: SyncSummary = {
    provider: "CANVAS",
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
      where: { connectionId: connection.id, externalType: "SECTION" },
    }),
    prisma.integrationExternalMapping.findMany({
      where: { connectionId: connection.id, externalType: "ENROLLMENT" },
    }),
    prisma.integrationExternalMapping.findMany({
      where: { connectionId: connection.id, externalType: "USER" },
    }),
  ]);

  const sectionMappingByExternalId = new Map(sectionMappings.map((mapping) => [mapping.externalId, mapping]));
  const userMappingByExternalId = new Map(userMappings.map((mapping) => [mapping.externalId, mapping]));

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
          externalType: "SECTION",
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
            provider: "CANVAS",
            schoolId: params.schoolId,
            externalType: "SECTION",
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
            provider: "CANVAS",
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
          message: `Duplicate Canvas student email detected for ${normalizedEmail}.`,
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
          where: { id: mappedUser.localId, role: "STUDENT" },
          select: { id: true, cohortId: true, schoolId: true },
        });
      }
      if (!existingStudent) {
        existingStudent = await prisma.user.findFirst({
          where: {
            email: student.email,
            role: "STUDENT",
            OR: [{ schoolId: params.schoolId }, { cohort: { schoolId: params.schoolId } }],
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
            source: "CANVAS",
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
              provider: "CANVAS",
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
              provider: "CANVAS",
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
              provider: "CANVAS",
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
            token: crypto.randomBytes(32).toString("hex"),
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
            provider: "CANVAS",
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
    action: params.mode === "APPLY" ? "CANVAS_SYNC_APPLY" : "CANVAS_SYNC_PREVIEW",
    targetType: "school",
    targetId: params.schoolId,
    schoolId: params.schoolId,
    details: {
      provider: "CANVAS",
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

export async function getCanvasOAuthUrlForSchool(params: {
  schoolId: string;
  actorId: string;
  baseUrl: string;
  displayName?: string;
}) {
  assertOAuthConfigured();
  const normalizedBaseUrl = normalizeCanvasBaseUrl(params.baseUrl);
  const displayName = params.displayName?.trim() || "Canvas";
  const state = buildCanvasStateToken({
    purpose: "canvas-oauth",
    schoolId: params.schoolId,
    actorId: params.actorId,
    baseUrl: normalizedBaseUrl,
    displayName,
  });
  const scope = encodeURIComponent(
    "url:GET|/api/v1/courses url:GET|/api/v1/courses/:course_id/sections url:GET|/api/v1/courses/:course_id/enrollments"
  );
  const url =
    `${normalizedBaseUrl}/login/oauth2/auth?client_id=${encodeURIComponent(CANVAS_CLIENT_ID)}` +
    `&response_type=code&redirect_uri=${encodeURIComponent(CANVAS_CALLBACK_URL)}` +
    `&scope=${scope}&state=${encodeURIComponent(state)}`;
  return { url };
}

export async function handleCanvasOAuthCallback(params: {
  code?: string;
  state?: string;
  error?: string;
}) {
  if (params.error) {
    const target = new URL("/settings", CLIENT_URL);
    target.searchParams.set("tab", "integrations");
    target.searchParams.set("canvasError", params.error);
    return target.toString();
  }
  if (!params.code || !params.state) {
    const target = new URL("/settings", CLIENT_URL);
    target.searchParams.set("tab", "integrations");
    target.searchParams.set("canvasError", "missing_oauth_parameters");
    return target.toString();
  }

  try {
    const state = verifyCanvasStateToken(params.state);
    const token = await exchangeAuthorizationCode(state.baseUrl, params.code);
    const encryptedCredentials = serializeCredentials(token);
    await prisma.integrationConnection.upsert({
      where: { provider_schoolId: { provider: "CANVAS", schoolId: state.schoolId } },
      update: {
        status: "CONNECTED",
        displayName: state.displayName,
        baseUrl: state.baseUrl,
        credentialsEncrypted: encryptedCredentials,
        config: JSON.stringify({ mode: "OAUTH" }),
        disconnectedAt: null,
        updatedById: state.actorId,
      },
      create: {
        provider: "CANVAS",
        schoolId: state.schoolId,
        status: "CONNECTED",
        displayName: state.displayName,
        baseUrl: state.baseUrl,
        credentialsEncrypted: encryptedCredentials,
        config: JSON.stringify({ mode: "OAUTH" }),
        createdById: state.actorId,
        updatedById: state.actorId,
      },
    });
    await logDataAccess({
      actorId: state.actorId,
      action: "CANVAS_CONNECT",
      targetType: "school",
      targetId: state.schoolId,
      schoolId: state.schoolId,
      details: {
        provider: "CANVAS",
        mode: "OAUTH",
        hasEncryptedCredentials: true,
      },
    });

    const target = new URL("/settings", CLIENT_URL);
    target.searchParams.set("tab", "integrations");
    target.searchParams.set("canvas", "connected");
    return target.toString();
  } catch (error) {
    const message = error instanceof Error ? error.message : "canvas_oauth_failed";
    const target = new URL("/settings", CLIENT_URL);
    target.searchParams.set("tab", "integrations");
    target.searchParams.set("canvasError", message.slice(0, 180));
    return target.toString();
  }
}

export async function connectCanvasForSchool(params: {
  schoolId: string;
  actorId: string;
  input: unknown;
}) {
  const input = canvasConnectSchema.parse(params.input ?? {});
  if (input.mode === "OAUTH") {
    return getCanvasOAuthUrlForSchool({
      schoolId: params.schoolId,
      actorId: params.actorId,
      baseUrl: input.baseUrl,
      displayName: input.displayName,
    });
  }

  assertMockAllowed();
  const config: CanvasConnectionConfig = {
    mode: "MOCK",
    mockScenario: input.mockScenario ?? "default",
  };
  const connection = await prisma.integrationConnection.upsert({
    where: { provider_schoolId: { provider: "CANVAS", schoolId: params.schoolId } },
    update: {
      status: "CONNECTED",
      displayName: input.displayName ?? "Canvas Mock Sandbox",
      baseUrl: normalizeCanvasBaseUrl(input.baseUrl ?? "https://canvas.mock.local"),
      credentialsEncrypted: encryptField(JSON.stringify({ mode: "MOCK", placeholderToken: "dev-only" })),
      config: JSON.stringify(config),
      disconnectedAt: null,
      updatedById: params.actorId,
    },
    create: {
      provider: "CANVAS",
      schoolId: params.schoolId,
      status: "CONNECTED",
      displayName: input.displayName ?? "Canvas Mock Sandbox",
      baseUrl: normalizeCanvasBaseUrl(input.baseUrl ?? "https://canvas.mock.local"),
      credentialsEncrypted: encryptField(JSON.stringify({ mode: "MOCK", placeholderToken: "dev-only" })),
      config: JSON.stringify(config),
      createdById: params.actorId,
      updatedById: params.actorId,
    },
  });

  await logDataAccess({
    actorId: params.actorId,
    action: "CANVAS_CONNECT",
    targetType: "school",
    targetId: params.schoolId,
    schoolId: params.schoolId,
    details: {
      provider: "CANVAS",
      mode: "MOCK",
      scenario: config.mockScenario,
      hasEncryptedCredentials: !!decryptField(connection.credentialsEncrypted),
    },
  });

  return safeConnectionResponse(connection);
}

export async function disconnectCanvasForSchool(params: { schoolId: string; actorId: string }) {
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
    action: "CANVAS_DISCONNECT",
    targetType: "school",
    targetId: params.schoolId,
    schoolId: params.schoolId,
    details: { provider: "CANVAS" },
  });

  return safeConnectionResponse(updated);
}

export async function getCanvasStatusForSchool(schoolId: string) {
  const connection = await getConnectionForSchool(schoolId);
  const jobs = connection
    ? await prisma.integrationSyncJob.findMany({
        where: { connectionId: connection.id },
        orderBy: { createdAt: "desc" },
        take: 10,
      })
    : [];
  return {
    capabilities: getCanvasCapabilities(),
    ops: await buildCanvasOpsSummary(connection),
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

export async function getCanvasErrorsForSchool(schoolId: string) {
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

export async function previewCanvasSyncForSchool(params: { schoolId: string; actorId: string }) {
  const result = await runCanvasSync({ schoolId: params.schoolId, actorId: params.actorId, mode: "PREVIEW" });
  return {
    connection: safeConnectionResponse(result.connection),
    jobId: result.job.id,
    status: result.job.status,
    summary: result.summary,
  };
}

export async function applyCanvasSyncForSchool(params: { schoolId: string; actorId: string }) {
  const result = await runCanvasSync({ schoolId: params.schoolId, actorId: params.actorId, mode: "APPLY" });
  return {
    connection: safeConnectionResponse(result.connection),
    jobId: result.job.id,
    status: result.job.status,
    summary: result.summary,
  };
}
