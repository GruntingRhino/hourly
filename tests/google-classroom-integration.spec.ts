import { test, expect, request, APIRequestContext } from "@playwright/test";
import { BASE, getToken, auth, PW } from "./security/helpers/tokens";

async function loginAs(ctx: APIRequestContext, email: string, password: string) {
  const res = await ctx.post(`${BASE}/api/auth/login`, { data: { email, password } });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

async function getGoogleClassroomStatus(ctx: APIRequestContext, token: string) {
  const res = await ctx.get(`${BASE}/api/integrations/googleClassroom/status`, auth(token));
  expect(res.ok()).toBeTruthy();
  return res.json();
}

test.describe("Google Classroom integration foundation", () => {
  test.describe.configure({ mode: "serial" });

  test("school admin can connect Google Classroom and create preview/apply jobs", async () => {
    const ctx = await request.newContext();
    const adminToken = await getToken("schoolA");

    const connectRes = await ctx.post(`${BASE}/api/integrations/googleClassroom/connect`, {
      ...auth(adminToken),
      data: {
        mode: "MOCK",
        displayName: "Google Classroom Mock Sandbox",
        baseUrl: "https://google-classroom.mock.local",
        mockScenario: "default",
      },
    });
    expect(connectRes.status()).toBe(201);

    const previewRes = await ctx.post(`${BASE}/api/integrations/googleClassroom/preview`, auth(adminToken));
    expect(previewRes.ok()).toBeTruthy();
    const previewBody = await previewRes.json();
    expect(previewBody.summary.provider).toBe("GOOGLE_CLASSROOM");
    expect(
      previewBody.summary.counts.cohortsCreated + previewBody.summary.counts.cohortsUpdated + previewBody.summary.counts.cohortsArchived
    ).toBeGreaterThan(0);

    const applyRes = await ctx.post(`${BASE}/api/integrations/googleClassroom/apply`, auth(adminToken));
    expect(applyRes.ok()).toBeTruthy();
    const applyBody = await applyRes.json();
    expect(applyBody.summary.operations.length).toBeGreaterThan(0);
    expect(
      applyBody.summary.counts.teacherAssignmentsCreated +
      applyBody.summary.counts.existingUsersLinked +
      applyBody.summary.counts.invitationsCreated +
      applyBody.summary.counts.invitationsUpdated
    ).toBeGreaterThan(0);

    const status = await getGoogleClassroomStatus(ctx, adminToken);
    expect(status.connection.status).toBe("CONNECTED");
    expect(status.jobs.length).toBeGreaterThanOrEqual(2);
    expect(status.capabilities.integrationScope).toBe("SINGLE_SCHOOL");

    await ctx.dispose();
  });

  test("non-admin users are blocked from Google Classroom integration routes", async () => {
    const ctx = await request.newContext();
    const studentToken = await getToken("student1");
    const orgToken = await getToken("orgA");

    for (const token of [studentToken, orgToken]) {
      const res = await ctx.post(`${BASE}/api/integrations/googleClassroom/connect`, {
        ...auth(token),
        data: { mode: "MOCK", mockScenario: "default" },
      });
      expect(res.status()).toBe(403);
    }

    await ctx.dispose();
  });

  test("school isolation is enforced for connection visibility and sync access", async () => {
    const ctx = await request.newContext();
    const schoolAToken = await getToken("schoolA");
    const schoolBToken = await getToken("schoolB");

    const statusA = await getGoogleClassroomStatus(ctx, schoolAToken);
    expect(statusA.connection).not.toBeNull();

    const statusBRes = await ctx.get(`${BASE}/api/integrations/googleClassroom/status`, auth(schoolBToken));
    expect(statusBRes.ok()).toBeTruthy();
    const statusB = await statusBRes.json();
    expect(statusB.connection).toBeNull();

    const previewB = await ctx.post(`${BASE}/api/integrations/googleClassroom/preview`, auth(schoolBToken));
    expect(previewB.status()).toBe(400);

    await ctx.dispose();
  });

  test("duplicate student email is logged and existing GoodHours user is linked", async () => {
    const ctx = await request.newContext();
    const adminToken = await getToken("schoolA");

    const errorsRes = await ctx.get(`${BASE}/api/integrations/googleClassroom/errors`, auth(adminToken));
    expect(errorsRes.ok()).toBeTruthy();
    const errors = await errorsRes.json();
    expect(errors.some((entry: any) => entry.code === "DUPLICATE_STUDENT_EMAIL")).toBeTruthy();

    const linkedStudent = await loginAs(ctx, "abhay.sivaram+8@gmail.com", PW);
    expect(linkedStudent.user.cohortId).toBeTruthy();

    const inviteListRes = await ctx.get(`${BASE}/api/cohorts`, auth(adminToken));
    expect(inviteListRes.ok()).toBeTruthy();
    const cohorts = await inviteListRes.json();
    const imported = cohorts.find((cohort: any) => cohort.name === "Google Classroom Biology 101 - Period 1");
    expect(imported).toBeTruthy();

    await ctx.dispose();
  });

  test("renamed Google Classroom course updates mapped cohorts", async () => {
    const ctx = await request.newContext();
    const adminToken = await getToken("schoolA");

    const reconnectRes = await ctx.post(`${BASE}/api/integrations/googleClassroom/connect`, {
      ...auth(adminToken),
      data: {
        mode: "MOCK",
        displayName: "Google Classroom Mock Sandbox",
        baseUrl: "https://google-classroom.mock.local",
        mockScenario: "renamed",
      },
    });
    expect(reconnectRes.status()).toBe(201);

    const applyRes = await ctx.post(`${BASE}/api/integrations/googleClassroom/apply`, auth(adminToken));
    expect(applyRes.ok()).toBeTruthy();

    const cohortsRes = await ctx.get(`${BASE}/api/cohorts`, auth(adminToken));
    const cohorts = await cohortsRes.json();
    expect(cohorts.some((cohort: any) => cohort.name === "Google Classroom Biology Honors - Block A")).toBeTruthy();

    await ctx.dispose();
  });

  test("archived and deleted Google Classroom classes archive mapped cohorts", async () => {
    const ctx = await request.newContext();
    const adminToken = await getToken("schoolA");

    let connectRes = await ctx.post(`${BASE}/api/integrations/googleClassroom/connect`, {
      ...auth(adminToken),
      data: { mode: "MOCK", mockScenario: "archived" },
    });
    expect(connectRes.status()).toBe(201);

    let applyRes = await ctx.post(`${BASE}/api/integrations/googleClassroom/apply`, auth(adminToken));
    expect(applyRes.ok()).toBeTruthy();

    let cohortsRes = await ctx.get(`${BASE}/api/cohorts`, auth(adminToken));
    let cohorts = await cohortsRes.json();
    const archivedByScenario = cohorts.find((cohort: any) => cohort.name === "Google Classroom Service Lab - Advisory");
    expect(archivedByScenario?.status).toBe("ARCHIVED");

    connectRes = await ctx.post(`${BASE}/api/integrations/googleClassroom/connect`, {
      ...auth(adminToken),
      data: { mode: "MOCK", mockScenario: "deleted" },
    });
    expect(connectRes.status()).toBe(201);

    applyRes = await ctx.post(`${BASE}/api/integrations/googleClassroom/apply`, auth(adminToken));
    expect(applyRes.ok()).toBeTruthy();

    cohortsRes = await ctx.get(`${BASE}/api/cohorts`, auth(adminToken));
    cohorts = await cohortsRes.json();
    const deletedArchived = cohorts.find(
      (cohort: any) => cohort.status === "ARCHIVED" && /Google Classroom Biology .*/.test(cohort.name)
    );
    expect(deletedArchived).toBeTruthy();

    await ctx.dispose();
  });

  test("deleting a synced cohort clears stale mappings and allows Google Classroom to recreate it", async () => {
    const ctx = await request.newContext();
    const adminToken = await getToken("schoolA");

    let connectRes = await ctx.post(`${BASE}/api/integrations/googleClassroom/connect`, {
      ...auth(adminToken),
      data: { mode: "MOCK", mockScenario: "default" },
    });
    expect(connectRes.status()).toBe(201);

    let applyRes = await ctx.post(`${BASE}/api/integrations/googleClassroom/apply`, auth(adminToken));
    expect(applyRes.ok()).toBeTruthy();

    let cohortsRes = await ctx.get(`${BASE}/api/cohorts`, auth(adminToken));
    expect(cohortsRes.ok()).toBeTruthy();
    let cohorts = await cohortsRes.json();
    const imported = cohorts.find((cohort: any) => cohort.name === "Google Classroom Biology 101 - Period 1");
    expect(imported).toBeTruthy();

    const deleteRes = await ctx.delete(`${BASE}/api/cohorts/${imported.id}`, auth(adminToken));
    expect(deleteRes.status()).toBe(204);

    applyRes = await ctx.post(`${BASE}/api/integrations/googleClassroom/apply`, auth(adminToken));
    expect(applyRes.ok()).toBeTruthy();

    cohortsRes = await ctx.get(`${BASE}/api/cohorts`, auth(adminToken));
    expect(cohortsRes.ok()).toBeTruthy();
    cohorts = await cohortsRes.json();
    expect(cohorts.some((cohort: any) => cohort.name === "Google Classroom Biology 101 - Period 1")).toBeTruthy();

    await ctx.dispose();
  });

  test("sync errors and disconnect flow are visible to school admins", async () => {
    const ctx = await request.newContext();
    const adminToken = await getToken("schoolA");

    const errorsRes = await ctx.get(`${BASE}/api/integrations/googleClassroom/errors`, auth(adminToken));
    expect(errorsRes.ok()).toBeTruthy();
    const errors = await errorsRes.json();
    expect(errors.length).toBeGreaterThan(0);

    const disconnectRes = await ctx.post(`${BASE}/api/integrations/googleClassroom/disconnect`, auth(adminToken));
    expect(disconnectRes.ok()).toBeTruthy();

    const status = await getGoogleClassroomStatus(ctx, adminToken);
    expect(status.connection.status).toBe("DISCONNECTED");

    await ctx.dispose();
  });

  test("student removal upstream revokes pending invitations without cross-cohort damage", async () => {
    const ctx = await request.newContext();
    const adminToken = await getToken("schoolA");

    let connectRes = await ctx.post(`${BASE}/api/integrations/googleClassroom/connect`, {
      ...auth(adminToken),
      data: { mode: "MOCK", mockScenario: "default" },
    });
    expect(connectRes.status()).toBe(201);

    let applyRes = await ctx.post(`${BASE}/api/integrations/googleClassroom/apply`, auth(adminToken));
    expect(applyRes.ok()).toBeTruthy();

    connectRes = await ctx.post(`${BASE}/api/integrations/googleClassroom/connect`, {
      ...auth(adminToken),
      data: { mode: "MOCK", mockScenario: "student_removed" },
    });
    expect(connectRes.status()).toBe(201);

    applyRes = await ctx.post(`${BASE}/api/integrations/googleClassroom/apply`, auth(adminToken));
    expect(applyRes.ok()).toBeTruthy();

    const cohortsRes = await ctx.get(`${BASE}/api/cohorts`, auth(adminToken));
    expect(cohortsRes.ok()).toBeTruthy();
    const cohorts = await cohortsRes.json();
    const biology = cohorts.find((cohort: any) => cohort.name === "Google Classroom Biology 101 - Period 1");
    expect(biology).toBeTruthy();

    const detailRes = await ctx.get(`${BASE}/api/cohorts/${biology.id}`, auth(adminToken));
    expect(detailRes.ok()).toBeTruthy();
    const detail = await detailRes.json();
    const removedInvite = detail.invitations.find((inv: any) => inv.email === "gclass.student.one@schoola.edu");
    expect(removedInvite?.status).toBe("REVOKED");

    await ctx.dispose();
  });
});
