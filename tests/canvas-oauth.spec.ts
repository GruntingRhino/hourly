import { URL } from "url";
import { test, expect, request, APIRequestContext } from "@playwright/test";
import { BASE, auth, getToken } from "./security/helpers/tokens";
import { startMockCanvasTenant } from "./helpers/canvasTenant";

async function completeCanvasOAuth(ctx: APIRequestContext, token: string, baseUrl: string, code: string) {
  const urlRes = await ctx.get(
    `${BASE}/api/integrations/canvas/oauth/url?baseUrl=${encodeURIComponent(baseUrl)}&displayName=${encodeURIComponent("Canvas OAuth Test")}`,
    auth(token)
  );
  expect(urlRes.ok()).toBeTruthy();
  const { url } = await urlRes.json();
  const state = new URL(url).searchParams.get("state");
  expect(state).toBeTruthy();

  const callbackRes = await ctx.get(
    `${BASE}/api/integrations/canvas/oauth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state!)}`,
    { maxRedirects: 0 }
  );
  return callbackRes;
}

test.describe("Canvas OAuth flow", () => {
  test.describe.configure({ mode: "serial" });

  test("OAuth URL requests only the Canvas scopes used by the live provider", async () => {
    const ctx = await request.newContext();
    const adminToken = await getToken("schoolA");
    const baseUrl = "https://canvas.example.edu";

    const urlRes = await ctx.get(
      `${BASE}/api/integrations/canvas/oauth/url?baseUrl=${encodeURIComponent(baseUrl)}&displayName=${encodeURIComponent("Canvas OAuth Test")}`,
      auth(adminToken)
    );
    expect(urlRes.ok()).toBeTruthy();

    const { url } = await urlRes.json();
    const parsed = new URL(url);
    const scope = parsed.searchParams.get("scope");

    expect(scope).toContain("url:GET|/api/v1/courses");
    expect(scope).toContain("url:GET|/api/v1/courses/:course_id/sections");
    expect(scope).toContain("url:GET|/api/v1/courses/:course_id/enrollments");
    expect(scope).not.toContain("url:GET|/api/v1/sections");
    expect(scope).not.toContain("url:GET|/api/v1/courses/:id/sections");
    expect(scope).not.toContain("url:GET|/api/v1/courses/:id/enrollments");

    await ctx.dispose();
  });

  test("OAuth callback stores a real connection and syncs via refreshed token against a paginated Canvas-like tenant", async () => {
    const mock = await startMockCanvasTenant("default");
    const ctx = await request.newContext();
    const adminToken = await getToken("schoolA");

    await ctx.post(`${BASE}/api/integrations/canvas/disconnect`, auth(adminToken));

    const callbackRes = await completeCanvasOAuth(ctx, adminToken, mock.baseUrl, "expired-code");
    expect(callbackRes.status()).toBe(302);
    expect(callbackRes.headers().location).toContain("/settings?tab=integrations&canvas=connected");

    const previewRes = await ctx.post(`${BASE}/api/integrations/canvas/preview`, auth(adminToken));
    expect(previewRes.ok()).toBeTruthy();
    const previewBody = await previewRes.json();
    expect(previewBody.summary.counts.cohortsCreated + previewBody.summary.counts.cohortsUpdated).toBeGreaterThan(0);
    expect(previewBody.summary.operations.some((operation: any) => /OAuth Advisory/.test(operation.target))).toBeTruthy();

    const statusRes = await ctx.get(`${BASE}/api/integrations/canvas/status`, auth(adminToken));
    expect(statusRes.ok()).toBeTruthy();
    const status = await statusRes.json();
    expect(status.connection.mode).toBe("OAUTH");
    expect(status.connection.status).toBe("CONNECTED");

    await ctx.dispose();
    await mock.close();
  });

  test("invalid OAuth code is surfaced back to the settings page", async () => {
    const mock = await startMockCanvasTenant("default");
    const ctx = await request.newContext();
    const adminToken = await getToken("schoolA");

    const callbackRes = await completeCanvasOAuth(ctx, adminToken, mock.baseUrl, "bad-code");
    expect(callbackRes.status()).toBe(302);
    expect(callbackRes.headers().location).toContain("canvasError=");

    await ctx.dispose();
    await mock.close();
  });

  test("revoked Canvas access marks the connection as errored", async () => {
    const mock = await startMockCanvasTenant("revoked");
    const ctx = await request.newContext();
    const adminToken = await getToken("schoolA");

    await ctx.post(`${BASE}/api/integrations/canvas/disconnect`, auth(adminToken));

    const callbackRes = await completeCanvasOAuth(ctx, adminToken, mock.baseUrl, "good-code");
    expect(callbackRes.status()).toBe(302);

    const previewRes = await ctx.post(`${BASE}/api/integrations/canvas/preview`, auth(adminToken));
    expect(previewRes.status()).toBe(500);

    const statusRes = await ctx.get(`${BASE}/api/integrations/canvas/status`, auth(adminToken));
    expect(statusRes.ok()).toBeTruthy();
    const status = await statusRes.json();
    expect(status.connection.status).toBe("ERROR");
    expect(status.ops.recentJobFailures24h).toBeGreaterThan(0);
    expect(status.ops.warnings.length).toBeGreaterThan(0);

    const opsRes = await ctx.get(`${BASE}/api/internal/canvas/ops`);
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
