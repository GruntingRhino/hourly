import { expect, test } from "@playwright/test";

const PASSWORD = "StrongPass1!";

async function mockInvitation(page: import("@playwright/test").Page, path: string, body: object) {
  await page.route(`**/api${path}`, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
      return;
    }
    await route.continue();
  });
}

test.describe("onboarding eligibility browser verification", () => {
  test("student, beneficiary, and beneficiary-admin joins require checked eligibility before POST", async ({ page }) => {
    const postBodies: Array<{ url: string; body: unknown }> = [];
    await mockInvitation(page, "/invitations/student?token=student-fixture", {
      email: "student@example.test", name: "Student Fixture", grade: "10", house: null,
      cohortName: "Fixture Cohort", schoolName: "Fixture School", schoolId: "school-fixture",
    });
    await page.route("**/api/invitations/student/accept", async (route) => {
      postBodies.push({ url: route.request().url(), body: route.request().postDataJSON() });
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ token: "synthetic", user: {} }) });
    });
    await page.goto("/join/student?token=student-fixture");
    await page.locator('input[type="password"]').fill(PASSWORD);
    const studentSubmit = page.getByRole("button", { name: "Join Cohort" });
    await expect(studentSubmit).toBeDisabled();
    await page.getByText("I confirm that I am 13 or older").click();
    await expect(studentSubmit).toBeEnabled();
    await studentSubmit.click();
    await expect.poll(() => postBodies.length).toBe(1);
    expect(postBodies[0].body).toMatchObject({ eligible13Plus: true });

    await mockInvitation(page, "/invitations/beneficiary?token=beneficiary-fixture", {
      beneficiaryName: "Fixture Beneficiary", schoolName: "Fixture School", sentTo: "admin@example.test", beneficiaryId: "beneficiary-fixture",
    });
    await page.route("**/api/invitations/beneficiary/accept", async (route) => {
      postBodies.push({ url: route.request().url(), body: route.request().postDataJSON() });
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ token: "synthetic", user: {} }) });
    });
    await page.goto("/join/beneficiary?token=beneficiary-fixture");
    await page.locator('input[type="text"]').first().fill("Fixture Admin");
    await page.locator('input[type="password"]').fill(PASSWORD);
    const beneficiarySubmit = page.getByRole("button", { name: "Accept & Create Account" });
    await expect(beneficiarySubmit).toBeDisabled();
    await page.getByText("I confirm that I am 13 or older").click();
    await expect(beneficiarySubmit).toBeEnabled();
    await beneficiarySubmit.click();
    await expect.poll(() => postBodies.length).toBe(2);
    expect(postBodies[1].body).toMatchObject({ eligible13Plus: true });

    await mockInvitation(page, "/invitations/beneficiary-admin?token=admin-fixture", {
      beneficiaryName: "Fixture Beneficiary", email: "admin@example.test", hasExistingAccount: false,
    });
    await page.route("**/api/invitations/beneficiary-admin/accept", async (route) => {
      postBodies.push({ url: route.request().url(), body: route.request().postDataJSON() });
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ token: "synthetic", user: {} }) });
    });
    await page.goto("/join/admin?token=admin-fixture");
    await page.locator("input").first().fill("Fixture Admin");
    await page.locator('input[type="password"]').fill(PASSWORD);
    const adminSubmit = page.getByRole("button", { name: "Accept and create account" });
    await expect(adminSubmit).toBeDisabled();
    await page.getByText("I confirm that I am 13 or older").click();
    await expect(adminSubmit).toBeEnabled();
    await adminSubmit.click();
    await expect.poll(() => postBodies.length).toBe(3);
    expect(postBodies[2].body).toMatchObject({ eligible13Plus: true });
  });

  test("age eligibility and school registration do not submit unchecked", async ({ page }) => {
    let attestPosts = 0;
    await page.addInitScript(() => {
      localStorage.setItem("goodhours_token", "synthetic-token");
      localStorage.setItem("goodhours_user", JSON.stringify({ id: "user-fixture", role: "STUDENT", requiresEligibilityAttestation: true }));
    });
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "user-fixture", role: "STUDENT", requiresEligibilityAttestation: true }) });
    });
    await page.route("**/api/auth/eligibility/attest", async (route) => {
      attestPosts += 1;
      expect(route.request().postDataJSON()).toEqual({ eligible13Plus: true });
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
    await page.goto("/eligibility");
    const continueButton = page.getByRole("button", { name: "Continue" });
    await expect(continueButton).toBeDisabled();
    await page.getByText("I confirm that I am 13 or older").click();
    await expect(continueButton).toBeEnabled();
    await continueButton.click();
    await expect.poll(() => attestPosts).toBe(1);

    const schoolContext = await page.context().browser()!.newContext();
    const schoolPage = await schoolContext.newPage();
    await schoolPage.goto("/school/register");
    await schoolPage.getByRole("button", { name: "Register with email & password" }).click();
    await schoolPage.getByPlaceholder("Jane Smith").fill("School Fixture");
    await schoolPage.getByPlaceholder("you@yourschool.edu").fill("principal@fixture.edu");
    await schoolPage.locator('input[type="password"]').fill(PASSWORD);
    await schoolPage.getByRole("button", { name: /Continue/i }).click();
    await expect(schoolPage.getByRole("heading", { name: "Find Your School" })).toBeVisible();
    await schoolPage.getByPlaceholder("Enter school name manually").fill("Fixture School");
    await schoolPage.getByRole("button", { name: "Continue" }).click();
    await expect(schoolPage.getByText("I confirm that I am 13 or older.")).toBeVisible();
    const sendButton = schoolPage.getByRole("button", { name: /Create Account & Verify Email|Send Verification Link/i });
    await expect(sendButton).toBeDisabled();
    await schoolContext.close();
  });
});
