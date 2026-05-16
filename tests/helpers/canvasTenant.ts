import http from "http";
import { AddressInfo } from "net";
import { URL } from "url";

type TokenBehavior =
  | { kind: "valid"; accessToken: string; refreshToken: string; expiresIn: number }
  | { kind: "expired"; accessToken: string; refreshToken: string; expiresIn: number }
  | { kind: "revoked"; accessToken: string; refreshToken: string; expiresIn: number };

type TenantCourse = {
  id: string;
  name: string;
  workflow_state: "available" | "completed" | "unpublished" | "deleted";
};

type TenantSection = {
  id: string;
  course_id: string;
  name: string;
  workflow_state: "active" | "completed" | "deleted";
};

type TenantEnrollment = {
  id: string;
  user_id: string;
  course_id: string;
  course_section_id: string;
  type: "TeacherEnrollment" | "StudentEnrollment";
  enrollment_state: "active" | "inactive" | "deleted" | "invited";
  user: {
    id: string;
    name: string;
    sortable_name?: string;
    short_name?: string;
    primary_email: string;
    login_id?: string;
  };
};

type CanvasTenantScenario = "default" | "revoked" | "renamed" | "archived" | "student_removed";

export type MockCanvasTenant = {
  server: http.Server;
  baseUrl: string;
  close: () => Promise<void>;
};

const COURSE_BIO = "oauth-course-bio";
const COURSE_SERVICE = "oauth-course-service";
const COURSE_UNPUBLISHED = "oauth-course-unpublished";

function paginate<T>(items: T[], requestUrl: URL): { page: T[]; nextLink: string | null } {
  const perPage = Math.max(1, Number(requestUrl.searchParams.get("per_page") || "100"));
  const page = Math.max(1, Number(requestUrl.searchParams.get("page") || "1"));
  const start = (page - 1) * perPage;
  const end = start + perPage;
  const nextPage = end < items.length ? page + 1 : null;
  const nextLink = nextPage
    ? `${requestUrl.origin}${requestUrl.pathname}?${(() => {
        const params = new URLSearchParams(requestUrl.searchParams);
        params.set("page", String(nextPage));
        return params.toString();
      })()}`
    : null;
  return {
    page: items.slice(start, end),
    nextLink,
  };
}

function buildScenarioData(scenario: CanvasTenantScenario): {
  courses: TenantCourse[];
  sectionsByCourse: Record<string, TenantSection[]>;
  enrollmentsByCourse: Record<string, TenantEnrollment[]>;
  codeBehavior: Record<string, TokenBehavior>;
  refreshBehavior: Record<string, TokenBehavior>;
  validTokens: Set<string>;
} {
  const courses: TenantCourse[] = [
    { id: COURSE_BIO, name: scenario === "renamed" ? "OAuth Biology Honors" : "OAuth Biology", workflow_state: "available" },
    { id: COURSE_SERVICE, name: "OAuth Service Lab", workflow_state: scenario === "archived" ? "completed" : "available" },
    { id: COURSE_UNPUBLISHED, name: "OAuth Advisory", workflow_state: "unpublished" },
  ];

  const sectionsByCourse: Record<string, TenantSection[]> = {
    [COURSE_BIO]: [
      { id: "oauth-section-bio-a", course_id: COURSE_BIO, name: scenario === "renamed" ? "Block A" : "Section A", workflow_state: "active" },
      { id: "oauth-section-bio-b", course_id: COURSE_BIO, name: "Section B", workflow_state: "active" },
    ],
    [COURSE_SERVICE]: [
      { id: "oauth-section-service", course_id: COURSE_SERVICE, name: "Advisory", workflow_state: scenario === "archived" ? "completed" : "active" },
    ],
    [COURSE_UNPUBLISHED]: [
      { id: "oauth-section-advisory", course_id: COURSE_UNPUBLISHED, name: "Unpublished Cohort", workflow_state: "active" },
    ],
  };

  const enrollmentsByCourse: Record<string, TenantEnrollment[]> = {
    [COURSE_BIO]: [
      {
        id: "oauth-enrollment-teacher-1",
        user_id: "oauth-teacher-1",
        course_id: COURSE_BIO,
        course_section_id: "oauth-section-bio-a",
        type: "TeacherEnrollment",
        enrollment_state: "active",
        user: { id: "oauth-teacher-1", name: "OAuth Teacher Alpha", primary_email: "oauth.teacher.alpha@schoola.edu" },
      },
      {
        id: "oauth-enrollment-student-existing",
        user_id: "oauth-student-existing",
        course_id: COURSE_BIO,
        course_section_id: "oauth-section-bio-a",
        type: "StudentEnrollment",
        enrollment_state: "active",
        user: { id: "oauth-student-existing", name: "PW Existing Canvas Student", primary_email: "abhay.sivaram+8@gmail.com" },
      },
      {
        id: "oauth-enrollment-student-1",
        user_id: "oauth-student-1",
        course_id: COURSE_BIO,
        course_section_id: "oauth-section-bio-a",
        type: "StudentEnrollment",
        enrollment_state: scenario === "student_removed" ? "deleted" : "active",
        user: { id: "oauth-student-1", name: "OAuth Student One", primary_email: "oauth.student.one@schoola.edu" },
      },
      {
        id: "oauth-enrollment-student-dup-1",
        user_id: "oauth-student-dup-1",
        course_id: COURSE_BIO,
        course_section_id: "oauth-section-bio-b",
        type: "StudentEnrollment",
        enrollment_state: "active",
        user: { id: "oauth-student-dup-1", name: "OAuth Duplicate One", primary_email: "oauth.duplicate@schoola.edu" },
      },
    ],
    [COURSE_SERVICE]: [
      {
        id: "oauth-enrollment-teacher-2",
        user_id: "oauth-teacher-2",
        course_id: COURSE_SERVICE,
        course_section_id: "oauth-section-service",
        type: "TeacherEnrollment",
        enrollment_state: "active",
        user: { id: "oauth-teacher-2", name: "OAuth Teacher Beta", primary_email: "oauth.teacher.beta@schoola.edu" },
      },
      {
        id: "oauth-enrollment-student-2",
        user_id: "oauth-student-2",
        course_id: COURSE_SERVICE,
        course_section_id: "oauth-section-service",
        type: "StudentEnrollment",
        enrollment_state: "active",
        user: { id: "oauth-student-2", name: "OAuth Student Two", primary_email: "oauth.student.two@schoola.edu" },
      },
      {
        id: "oauth-enrollment-student-dup-2",
        user_id: "oauth-student-dup-2",
        course_id: COURSE_SERVICE,
        course_section_id: "oauth-section-service",
        type: "StudentEnrollment",
        enrollment_state: "active",
        user: { id: "oauth-student-dup-2", name: "OAuth Duplicate Two", primary_email: "oauth.duplicate@schoola.edu" },
      },
    ],
    [COURSE_UNPUBLISHED]: [
      {
        id: "oauth-enrollment-teacher-3",
        user_id: "oauth-teacher-3",
        course_id: COURSE_UNPUBLISHED,
        course_section_id: "oauth-section-advisory",
        type: "TeacherEnrollment",
        enrollment_state: "active",
        user: { id: "oauth-teacher-3", name: "OAuth Teacher Gamma", primary_email: "oauth.teacher.gamma@schoola.edu" },
      },
      {
        id: "oauth-enrollment-student-3",
        user_id: "oauth-student-3",
        course_id: COURSE_UNPUBLISHED,
        course_section_id: "oauth-section-advisory",
        type: "StudentEnrollment",
        enrollment_state: "active",
        user: { id: "oauth-student-3", name: "OAuth Student Three", primary_email: "oauth.student.three@schoola.edu" },
      },
    ],
  };

  const validTokens = new Set(["valid-token", "valid-token-2"]);
  const codeBehavior: Record<string, TokenBehavior> = {
    "good-code": { kind: "valid", accessToken: "valid-token", refreshToken: "refresh-valid", expiresIn: 3600 },
    "expired-code": { kind: "expired", accessToken: "expired-token", refreshToken: "refresh-valid", expiresIn: 0 },
    "revoked-code": { kind: "revoked", accessToken: "revoked-token", refreshToken: "refresh-revoked", expiresIn: 3600 },
  };
  const refreshBehavior: Record<string, TokenBehavior> = {
    "refresh-valid": { kind: "valid", accessToken: "valid-token-2", refreshToken: "refresh-valid", expiresIn: 3600 },
  };

  if (scenario === "revoked") {
    codeBehavior["good-code"] = { kind: "revoked", accessToken: "revoked-token", refreshToken: "refresh-revoked", expiresIn: 3600 };
  }

  return { courses, sectionsByCourse, enrollmentsByCourse, codeBehavior, refreshBehavior, validTokens };
}

export async function startMockCanvasTenant(scenario: CanvasTenantScenario = "default"): Promise<MockCanvasTenant> {
  const tenant = buildScenarioData(scenario);

  const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url || "/", "http://127.0.0.1");

    if (req.method === "GET" && requestUrl.pathname === "/login/oauth2/auth") {
      res.statusCode = 302;
      const redirectUri = requestUrl.searchParams.get("redirect_uri");
      const state = requestUrl.searchParams.get("state");
      const code = requestUrl.searchParams.get("mock_code") || "good-code";
      if (redirectUri) {
        const target = new URL(redirectUri);
        target.searchParams.set("code", code);
        if (state) target.searchParams.set("state", state);
        res.setHeader("Location", target.toString());
        res.end();
        return;
      }
    }

    if (req.method === "POST" && requestUrl.pathname === "/login/oauth2/token") {
      let body = "";
      req.on("data", (chunk) => { body += chunk.toString(); });
      req.on("end", () => {
        const params = new URLSearchParams(body);
        const grantType = params.get("grant_type");
        const code = params.get("code") || "";
        const refreshToken = params.get("refresh_token") || "";
        res.setHeader("Content-Type", "application/json");

        if (grantType === "authorization_code") {
          const behavior = tenant.codeBehavior[code];
          if (!behavior) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "invalid_grant" }));
            return;
          }
          res.end(JSON.stringify({
            access_token: behavior.accessToken,
            refresh_token: behavior.refreshToken,
            token_type: "Bearer",
            expires_in: behavior.expiresIn,
          }));
          return;
        }

        if (grantType === "refresh_token") {
          const behavior = tenant.refreshBehavior[refreshToken];
          if (!behavior) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "invalid_grant" }));
            return;
          }
          res.end(JSON.stringify({
            access_token: behavior.accessToken,
            refresh_token: behavior.refreshToken,
            token_type: "Bearer",
            expires_in: behavior.expiresIn,
          }));
          return;
        }

        res.statusCode = 400;
        res.end(JSON.stringify({ error: "unsupported_grant_type" }));
      });
      return;
    }

    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (requestUrl.pathname.startsWith("/api/v1/")) {
      if (!tenant.validTokens.has(token)) {
        res.statusCode = 401;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "invalid_token" }));
        return;
      }
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/v1/courses") {
      const { page, nextLink } = paginate(tenant.courses, requestUrl);
      if (nextLink) res.setHeader("Link", `<${nextLink}>; rel="next"`);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(page));
      return;
    }

    const sectionMatch = requestUrl.pathname.match(/^\/api\/v1\/courses\/([^/]+)\/sections$/);
    if (req.method === "GET" && sectionMatch) {
      const courseId = decodeURIComponent(sectionMatch[1]);
      const sections = tenant.sectionsByCourse[courseId] ?? [];
      const { page, nextLink } = paginate(sections, requestUrl);
      if (nextLink) res.setHeader("Link", `<${nextLink}>; rel="next"`);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(page));
      return;
    }

    const enrollmentMatch = requestUrl.pathname.match(/^\/api\/v1\/courses\/([^/]+)\/enrollments$/);
    if (req.method === "GET" && enrollmentMatch) {
      const courseId = decodeURIComponent(enrollmentMatch[1]);
      const enrollments = tenant.enrollmentsByCourse[courseId] ?? [];
      const { page, nextLink } = paginate(enrollments, requestUrl);
      if (nextLink) res.setHeader("Link", `<${nextLink}>; rel="next"`);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(page));
      return;
    }

    res.statusCode = 404;
    res.end("not found");
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return {
    server,
    baseUrl,
    close: () => new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve())),
  };
}
