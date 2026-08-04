import http from "http";
import { AddressInfo } from "net";
import { URL } from "url";

type TokenBehavior =
  | { kind: "valid"; accessToken: string; refreshToken: string; expiresIn: number }
  | { kind: "expired"; accessToken: string; refreshToken: string; expiresIn: number }
  | { kind: "revoked"; accessToken: string; refreshToken: string; expiresIn: number };

type GoogleClassroomTenantScenario = "default" | "revoked" | "renamed" | "archived" | "student_removed";

type TenantCourse = {
  id: string;
  name: string;
  section?: string;
  courseState: "ACTIVE" | "ARCHIVED" | "PROVISIONED";
};

type TenantRosterUser = {
  userId: string;
  profile: {
    id: string;
    name: string;
    fullName: string;
  };
  profileEmail: string;
};

export type MockGoogleClassroomTenant = {
  server: http.Server;
  baseUrl: string;
  requests: string[];
  close: () => Promise<void>;
};

export const MOCK_GOOGLE_CLASSROOM_TENANT_ORIGIN = "http://127.0.0.1:39102";

function paginate<T>(items: T[], requestUrl: URL): { page: T[]; nextPageToken?: string } {
  const pageSize = Math.max(1, Number(requestUrl.searchParams.get("pageSize") || "100"));
  const pageToken = Number(requestUrl.searchParams.get("pageToken") || "0");
  const start = Number.isFinite(pageToken) ? pageToken : 0;
  const page = items.slice(start, start + pageSize);
  const next = start + pageSize < items.length ? String(start + pageSize) : undefined;
  return { page, nextPageToken: next };
}

function buildScenarioData(scenario: GoogleClassroomTenantScenario) {
  const courses: TenantCourse[] = [
    { id: "oauth-course-bio", name: scenario === "renamed" ? "OAuth Biology Honors" : "OAuth Biology", section: scenario === "renamed" ? "Block A" : "Period 1", courseState: "ACTIVE" },
    { id: "oauth-course-service", name: "OAuth Service Lab", section: "Advisory", courseState: scenario === "archived" ? "ARCHIVED" : "ACTIVE" },
    { id: "oauth-course-advisory", name: "OAuth Advisory", section: "Homeroom", courseState: "PROVISIONED" },
  ];

  const teachersByCourse: Record<string, TenantRosterUser[]> = {
    "oauth-course-bio": [
      { userId: "oauth-teacher-1", profile: { id: "oauth-teacher-1", name: "OAuth Teacher Alpha", fullName: "OAuth Teacher Alpha" }, profileEmail: "oauth.teacher.alpha@schoola.edu" },
    ],
    "oauth-course-service": [
      { userId: "oauth-teacher-2", profile: { id: "oauth-teacher-2", name: "OAuth Teacher Beta", fullName: "OAuth Teacher Beta" }, profileEmail: "oauth.teacher.beta@schoola.edu" },
    ],
    "oauth-course-advisory": [
      { userId: "oauth-teacher-3", profile: { id: "oauth-teacher-3", name: "OAuth Teacher Gamma", fullName: "OAuth Teacher Gamma" }, profileEmail: "oauth.teacher.gamma@schoola.edu" },
    ],
  };

  const studentsByCourse: Record<string, TenantRosterUser[]> = {
    "oauth-course-bio": [
      { userId: "oauth-student-existing", profile: { id: "oauth-student-existing", name: "PW Existing Classroom Student", fullName: "PW Existing Classroom Student" }, profileEmail: "abhay.sivaram+8@gmail.com" },
      ...(scenario === "student_removed" ? [] : [
        { userId: "oauth-student-1", profile: { id: "oauth-student-1", name: "OAuth Student One", fullName: "OAuth Student One" }, profileEmail: "oauth.student.one@schoola.edu" },
      ]),
      { userId: "oauth-student-dup-1", profile: { id: "oauth-student-dup-1", name: "OAuth Duplicate One", fullName: "OAuth Duplicate One" }, profileEmail: "oauth.duplicate@schoola.edu" },
    ],
    "oauth-course-service": [
      { userId: "oauth-student-2", profile: { id: "oauth-student-2", name: "OAuth Student Two", fullName: "OAuth Student Two" }, profileEmail: "oauth.student.two@schoola.edu" },
      { userId: "oauth-student-dup-2", profile: { id: "oauth-student-dup-2", name: "OAuth Duplicate Two", fullName: "OAuth Duplicate Two" }, profileEmail: "oauth.duplicate@schoola.edu" },
    ],
    "oauth-course-advisory": [
      { userId: "oauth-student-3", profile: { id: "oauth-student-3", name: "OAuth Student Three", fullName: "OAuth Student Three" }, profileEmail: "oauth.student.three@schoola.edu" },
    ],
  };

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

  return {
    courses,
    teachersByCourse,
    studentsByCourse,
    codeBehavior,
    refreshBehavior,
    validTokens: new Set(["valid-token", "valid-token-2"]),
  };
}

export async function startMockGoogleClassroomTenant(scenario: GoogleClassroomTenantScenario = "default"): Promise<MockGoogleClassroomTenant> {
  const tenant = buildScenarioData(scenario);
  const requests: string[] = [];

  const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url || "/", "http://127.0.0.1");
    requests.push(`${req.method ?? "GET"} ${requestUrl.pathname}`);

    if (req.method === "GET" && requestUrl.pathname === "/o/oauth2/v2/auth") {
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

    if (req.method === "POST" && requestUrl.pathname === "/token") {
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
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
    if (!tenant.validTokens.has(token)) {
      res.statusCode = 401;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: { code: 401, message: "Invalid Credentials" } }));
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/v1/courses") {
      const { page, nextPageToken } = paginate(tenant.courses, requestUrl);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ courses: page, ...(nextPageToken ? { nextPageToken } : {}) }));
      return;
    }

    const teacherMatch = requestUrl.pathname.match(/^\/v1\/courses\/([^/]+)\/teachers$/);
    if (req.method === "GET" && teacherMatch) {
      const courseId = decodeURIComponent(teacherMatch[1]);
      const { page, nextPageToken } = paginate(tenant.teachersByCourse[courseId] || [], requestUrl);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ teachers: page, ...(nextPageToken ? { nextPageToken } : {}) }));
      return;
    }

    const studentMatch = requestUrl.pathname.match(/^\/v1\/courses\/([^/]+)\/students$/);
    if (req.method === "GET" && studentMatch) {
      const courseId = decodeURIComponent(studentMatch[1]);
      const { page, nextPageToken } = paginate(tenant.studentsByCourse[courseId] || [], requestUrl);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ students: page, ...(nextPageToken ? { nextPageToken } : {}) }));
      return;
    }

    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "not_found" }));
  });

  await new Promise<void>((resolve) => server.listen(39102, "127.0.0.1", () => resolve()));
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    server,
    baseUrl,
    requests,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}
