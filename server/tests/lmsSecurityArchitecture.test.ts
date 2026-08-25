import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../src/", import.meta.url);

async function source(path: string) {
  return readFile(new URL(path, root), "utf8");
}

test("LMS credential-bearing requests use the approved-origin fetch boundary", async () => {
  const [canvas, classroom, outbound] = await Promise.all([
    source("services/canvasIntegration.ts"),
    source("services/googleClassroomIntegration.ts"),
    source("lib/lmsOutboundSecurity.ts"),
  ]);

  assert.match(canvas, /fetchApprovedLmsUrl\(/);
  assert.match(classroom, /fetchApprovedLmsUrl\(/);
  assert.doesNotMatch(canvas, /\breturn await fetch\(/);
  assert.doesNotMatch(classroom, /\breturn await fetch\(/);
  assert.match(outbound, /redirect: "error"/);
  assert.match(outbound, /assertPublicApprovedUrl/);
  assert.match(outbound, /url\.origin !== expectedOrigin/);
});

test("Google production OAuth origins are fixed and request input cannot provide baseUrl", async () => {
  const [classroom, routes, env] = await Promise.all([
    source("services/googleClassroomIntegration.ts"),
    source("routes/integrations.ts"),
    source("lib/env.ts"),
  ]);

  assert.doesNotMatch(classroom, /process\.env\.GOOGLE_CLASSROOM_(AUTH|TOKEN|API)_BASE_URL/);
  const oauthSchema = classroom.slice(
    classroom.indexOf('mode: z.literal("OAUTH")'),
    classroom.indexOf("type GoogleClassroomConnectionConfig"),
  );
  assert.doesNotMatch(oauthSchema, /baseUrl/);
  assert.match(classroom, /GOOGLE_CLASSROOM_AUTH_ORIGIN/);
  assert.match(classroom, /GOOGLE_CLASSROOM_TOKEN_ORIGIN/);
  assert.match(classroom, /GOOGLE_CLASSROOM_API_ORIGIN/);
  assert.match(routes, /req\.query\.testOrigin/);
  assert.doesNotMatch(routes.slice(routes.indexOf('router.get("\/googleClassroom\/oauth\/url"')), /req\.query\.baseUrl/);
  assert.doesNotMatch(env, /GOOGLE_CLASSROOM_(API|AUTH|TOKEN)_BASE_URL/);
});

test("Canvas OAuth accepts only administratively configured exact origins", async () => {
  const [canvas, outbound, env] = await Promise.all([
    source("services/canvasIntegration.ts"),
    source("lib/lmsOutboundSecurity.ts"),
    source("lib/env.ts"),
  ]);

  assert.match(canvas, /normalizeApprovedCanvasOrigin/);
  assert.match(outbound, /CANVAS_ALLOWED_ORIGINS/);
  assert.match(outbound, /LMS destination has not been administratively approved/);
  assert.match(env, /CANVAS_ALLOWED_ORIGINS/);
  assert.match(env, /Canvas OAuth requires CANVAS_ALLOWED_ORIGINS/);
});

test("both LMS providers require and persist explicit course selection before roster retrieval", async () => {
  const [canvas, classroom, routes] = await Promise.all([
    source("services/canvasIntegration.ts"),
    source("services/googleClassroomIntegration.ts"),
    source("routes/integrations.ts"),
  ]);

  for (const service of [canvas, classroom]) {
    assert.match(service, /normalizeSelectedExternalCourseIds/);
    assert.match(service, /assertKnownCourseSelection/);
    assert.match(service, /selectedExternalCourseIds/);
    assert.match(service, /config: JSON\.stringify\(\{ \.\.\.config, selectedExternalCourseIds \}\)/);
  }
  assert.match(routes, /"\/canvas\/courses"/);
  assert.match(routes, /"\/googleClassroom\/courses"/);
  assert.equal((routes.match(/selectedExternalCourseIds: req\.body\?\.selectedExternalCourseIds/g) ?? []).length, 4);
  assert.match(routes, /function integrationErrorStatus/);
  assert.equal((routes.match(/res\.status\(integrationErrorStatus\(err\)\)/g) ?? []).length, 4);
});

test("stale LMS user mappings are revalidated against the connection school", async () => {
  const [canvas, classroom] = await Promise.all([
    source("services/canvasIntegration.ts"),
    source("services/googleClassroomIntegration.ts"),
  ]);

  for (const service of [canvas, classroom]) {
    assert.match(
      service,
      /where: \{ id: mappedUser\.localId, role: "STUDENT", schoolId: params\.schoolId \}/,
    );
    assert.match(
      service,
      /where:\s*\{\s*email: student\.email,\s*role: "STUDENT",\s*schoolId: params\.schoolId,?\s*\}/,
    );
  }
});
