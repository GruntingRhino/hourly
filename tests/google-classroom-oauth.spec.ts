import { URL } from "url";
import { test, expect, request, APIRequestContext } from "@playwright/test";
import { BASE, auth, getToken } from "./security/helpers/tokens";
import { startMockGoogleClassroomTenant } from "./helpers/googleClassroomTenant";

function internalAuth() {
  const secret = process.env.CRON_SECRET?.trim();
  return secret ? { headers: { Authorization: `Bearer ${secret}` } } : undefined;
}

async function completeGoogleClassroomOAuth(ctx: APIRequestContext, token: string, testOrigin: string, code: string) {
  const urlRes = await ctx.get(
    `${BASE}/api/integrations/googleClassroom/oauth/url?testOrigin=${encodeURIComponent(testOrigin)}&displayName=${encodeURIComponent("Google Classroom OAuth Test")}`,
    auth(token)
  );
  expect(urlRes.ok()).toBeTruthy();
  const { url } = await urlRes.json();
  const state = new URL(url).searchParams.get("state");
  expect(state).toBeTruthy();

  const callbackRes = await ctx.get(
    `${BASE}/api/integrations/googleClassroom/oauth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state!)}`,
    { maxRedirects: 0 }
  );
  return callbackRes;
}

test.describe("Google Classroom OAuth flow", () => {
  test.describe.configure({ mode: "serial" });

  test("OAuth callback stores a real connection and syncs via refreshed token against a paginated Google Classroom-like tenant", async () => {
    const mock = await startMockGoogleClassroomTenant("default");
    const ctx = await request.newContext();
    const adminToken = await getToken("schoolA");

    await ctx.post(`${BASE}/api/integrations/googleClassroom/disconnect`, auth(adminToken));

    const callbackRes = await completeGoogleClassroomOAuth(ctx, adminToken, mock.baseUrl, "expired-code");
    expect(callbackRes.status()).toBe(302);
    expect(callbackRes.headers().location).toContain("/settings?tab=integrations&googleClassroom=connected");

    const coursesRes = await ctx.get(`${BASE}/api/integrations/googleClassroom/courses`, auth(adminToken));
    const coursesBody = await coursesRes.json();
    expect(coursesRes.ok(), JSON.stringify(coursesBody)).toBeTruthy();
    expect(coursesBody.courses.map((course: any) => course.id)).toContain("oauth-course-bio");

    const requestsBeforeRejectedSelection = mock.requests.length;
    const emptySelectionRes = await ctx.post(`${BASE}/api/integrations/googleClassroom/preview`, {
      ...auth(adminToken),
      data: { selectedExternalCourseIds: [] },
    });
    expect(emptySelectionRes.status()).toBe(400);
    expect(mock.requests.length).toBe(requestsBeforeRejectedSelection);

    const unknownSelectionRes = await ctx.post(`${BASE}/api/integrations/googleClassroom/preview`, {
      ...auth(adminToken),
      data: { selectedExternalCourseIds: ["unknown-course"] },
    });
    expect(unknownSelectionRes.status()).toBe(400);
    expect(mock.requests.some((entry) => entry.includes("unknown-course"))).toBeFalsy();

    const previewRes = await ctx.post(`${BASE}/api/integrations/googleClassroom/preview`, {
      ...auth(adminToken),
      data: { selectedExternalCourseIds: ["oauth-course-bio"] },
    });
    expect(previewRes.ok()).toBeTruthy();
    const previewBody = await previewRes.json();
    expect(previewBody.summary.counts.cohortsCreated + previewBody.summary.counts.cohortsUpdated).toBeGreaterThan(0);
    expect(previewBody.summary.operations.some((operation: any) => /OAuth Biology/.test(operation.target))).toBeTruthy();
    expect(mock.requests.some((entry) => entry.includes("/courses/oauth-course-bio/students"))).toBeTruthy();
    expect(mock.requests.some((entry) => entry.includes("/courses/oauth-course-service/students"))).toBeFalsy();
    expect(mock.requests.some((entry) => entry.includes("/courses/oauth-course-advisory/students"))).toBeFalsy();

    const statusRes = await ctx.get(`${BASE}/api/integrations/googleClassroom/status`, auth(adminToken));
    expect(statusRes.ok()).toBeTruthy();
    const status = await statusRes.json();
    expect(status.connection.mode).toBe("OAUTH");
    expect(status.connection.status).toBe("CONNECTED");

    await ctx.dispose();
    await mock.close();
  });

  test("invalid OAuth code is surfaced back to the settings page", async () => {
    const mock = await startMockGoogleClassroomTenant("default");
    const ctx = await request.newContext();
    const adminToken = await getToken("schoolA");

    const callbackRes = await completeGoogleClassroomOAuth(ctx, adminToken, mock.baseUrl, "bad-code");
    expect(callbackRes.status()).toBe(302);
    expect(callbackRes.headers().location).toContain("googleClassroomError=");

    await ctx.dispose();
    await mock.close();
  });

  test("revoked Google Classroom access marks the connection as errored", async () => {
    const mock = await startMockGoogleClassroomTenant("revoked");
    const ctx = await request.newContext();
    const adminToken = await getToken("schoolA");

    await ctx.post(`${BASE}/api/integrations/googleClassroom/disconnect`, auth(adminToken));

    const callbackRes = await completeGoogleClassroomOAuth(ctx, adminToken, mock.baseUrl, "good-code");
    expect(callbackRes.status()).toBe(302);

    const previewRes = await ctx.post(`${BASE}/api/integrations/googleClassroom/preview`, {
      ...auth(adminToken),
      data: { selectedExternalCourseIds: ["oauth-course-bio"] },
    });
    expect(previewRes.status()).toBe(500);

    const statusRes = await ctx.get(`${BASE}/api/integrations/googleClassroom/status`, auth(adminToken));
    expect(statusRes.ok()).toBeTruthy();
    const status = await statusRes.json();
    expect(status.connection.status).toBe("ERROR");
    expect(status.ops.recentJobFailures24h).toBeGreaterThan(0);
    expect(status.ops.warnings.length).toBeGreaterThan(0);

    const opsRes = await ctx.get(`${BASE}/api/internal/googleClassroom/ops`, internalAuth());
    expect(opsRes.ok()).toBeTruthy();
    const ops = await opsRes.json();
    expect(ops.totals.errored).toBeGreaterThan(0);
    const schoolConnection = ops.connections.find((entry: any) => entry.id === status.connection.id);
    expect(schoolConnection).toBeTruthy();
    expect(schoolConnection.status).toBe("ERROR");
    expect(schoolConnection.ops.warnings.length).toBeGreaterThan(0);

    await ctx.dispose();
    await mock.close();
  });
});
