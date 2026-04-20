/**
 * Resolves runtime IDs for seeded test entities.
 *
 * IDs are CUIDs generated at seed time, so we resolve them via API calls
 * rather than hardcoding. The result is cached per process run.
 */
import { request } from "@playwright/test";
import { BASE, getToken, auth, Account } from "./tokens";

export interface Ids {
  // User IDs
  adminAId: string;
  adminBId: string;
  orgAdminAId: string;
  orgAdminBId: string;
  student1Id: string;
  student2Id: string;
  student3Id: string;
  // School IDs
  schoolAId: string;
  schoolBId: string;
  // Cohort IDs
  cohortAId: string;
  cohortBId: string;
  // Beneficiary IDs (Playwright Org A / Org B)
  orgAId: string;
  orgBId: string;
}

let cache: Ids | null = null;

export async function getIds(): Promise<Ids> {
  if (cache) return cache;

  const ctx = await request.newContext();

  async function me(role: Account): Promise<Record<string, string>> {
    const token = await getToken(role);
    const res = await ctx.get(`${BASE}/api/auth/me`, auth(token));
    if (!res.ok()) throw new Error(`/api/auth/me failed for '${role}': ${res.status()}`);
    return res.json();
  }

  // Resolve all user profiles in parallel
  const [adminA, adminB, orgAdminA, orgAdminB, s1, s2, s3] = await Promise.all([
    me("schoolA"), me("schoolB"),
    me("orgA"), me("orgB"),
    me("student1"), me("student2"), me("student3"),
  ]);

  // Cohort IDs — resolved via the school admin's cohort list
  const cohortsARes = await ctx.get(
    `${BASE}/api/cohorts`,
    auth(await getToken("schoolA")),
  );
  if (!cohortsARes.ok()) throw new Error("Could not fetch cohorts for School A");
  const cohortsA: Array<{ id: string; name: string }> = await cohortsARes.json();
  const cohortA = cohortsA.find((c) => c.name === "PW Cohort A");

  const cohortsBRes = await ctx.get(
    `${BASE}/api/cohorts`,
    auth(await getToken("schoolB")),
  );
  if (!cohortsBRes.ok()) throw new Error("Could not fetch cohorts for School B");
  const cohortsB: Array<{ id: string; name: string }> = await cohortsBRes.json();
  const cohortB = cohortsB.find((c) => c.name === "PW Cohort B");

  // Beneficiary IDs — each org admin sees only their own beneficiary
  const bensARes = await ctx.get(
    `${BASE}/api/beneficiaries`,
    auth(await getToken("orgA")),
  );
  const bensA: Array<{ id: string; name: string }> = await bensARes.json();

  const bensBRes = await ctx.get(
    `${BASE}/api/beneficiaries`,
    auth(await getToken("orgB")),
  );
  const bensB: Array<{ id: string; name: string }> = await bensBRes.json();

  await ctx.dispose();

  if (!cohortA?.id) throw new Error("PW Cohort A not found — run: cd server && npx tsx prisma/seed-playwright.ts");
  if (!cohortB?.id) throw new Error("PW Cohort B not found — run: cd server && npx tsx prisma/seed-playwright.ts");
  if (!bensA[0]?.id) throw new Error("Playwright Org A beneficiary not found");
  if (!bensB[0]?.id) throw new Error("Playwright Org B beneficiary not found");

  cache = {
    adminAId:     adminA["id"],
    adminBId:     adminB["id"],
    orgAdminAId:  orgAdminA["id"],
    orgAdminBId:  orgAdminB["id"],
    student1Id:   s1["id"],
    student2Id:   s2["id"],
    student3Id:   s3["id"],
    schoolAId:    adminA["schoolId"],
    schoolBId:    adminB["schoolId"],
    cohortAId:    cohortA.id,
    cohortBId:    cohortB.id,
    orgAId:       bensA[0].id,
    orgBId:       bensB[0].id,
  };

  return cache;
}

/**
 * Creates a pending SelfSubmittedRequest via the API and returns its ID.
 * If creation fails (e.g. duplicate date), falls back to the first existing
 * PENDING submission for that student. Returns empty string if neither works.
 */
export async function ensurePendingSubmission(
  studentRole: Account,
  schoolAdminRole: Account,
  schoolId: string,
  opts: { date: string; hours: number; category?: string } = { date: "2025-10-15", hours: 3 },
): Promise<string> {
  const studentToken = await getToken(studentRole);
  const adminToken   = await getToken(schoolAdminRole);
  const ctx = await request.newContext();

  // Ensure self-submission is enabled for that school
  await ctx.put(`${BASE}/api/schools/${schoolId}`, {
    data: { allowSelfSubmission: true },
    ...auth(adminToken),
  });

  const subRes = await ctx.post(`${BASE}/api/self-submissions`, {
    data: {
      organizationName: "Security Test Org",
      description:      "Auto-created for security test",
      date:             opts.date,
      hours:            opts.hours,
      category:         opts.category ?? "general",
    },
    ...auth(studentToken),
  });

  let id = "";
  if (subRes.ok()) {
    id = (await subRes.json()).id as string;
  } else {
    // Fall back to any existing PENDING submission for this student
    const listRes = await ctx.get(`${BASE}/api/self-submissions`, auth(studentToken));
    if (listRes.ok()) {
      const list: Array<{ id: string; status: string }> = await listRes.json();
      id = list.find((s) => s.status === "PENDING")?.id ?? "";
    }
  }

  await ctx.dispose();
  return id;
}

/**
 * Creates a REVISION_REQUESTED submission for a student.
 * Returns the submission ID, or empty string on failure.
 */
export async function ensureRevisionSubmission(
  studentRole: Account,
  schoolAdminRole: Account,
  schoolId: string,
): Promise<string> {
  const adminToken = await getToken(schoolAdminRole);
  const ctx = await request.newContext();

  // Check if one already exists
  const listRes = await ctx.get(`${BASE}/api/self-submissions`, auth(await getToken(studentRole)));
  if (listRes.ok()) {
    const list: Array<{ id: string; status: string }> = await listRes.json();
    const existing = list.find((s) => s.status === "REVISION_REQUESTED");
    if (existing) {
      await ctx.dispose();
      return existing.id;
    }
  }

  // Create a pending one and send it for revision
  const pendingId = await ensurePendingSubmission(studentRole, schoolAdminRole, schoolId, {
    date: "2025-10-20",
    hours: 2,
  });
  if (!pendingId) {
    await ctx.dispose();
    return "";
  }

  const revRes = await ctx.post(`${BASE}/api/self-submissions/${pendingId}/request-revision`, {
    data: { note: "Please provide more details (auto-created by security test)" },
    ...auth(adminToken),
  });
  await ctx.dispose();

  return revRes.ok() ? pendingId : "";
}
