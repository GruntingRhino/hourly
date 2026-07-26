import { expect, test } from "@playwright/test";

const BASE = process.env.PW_BASE_URL || "http://localhost:5173";

test("organization owner can invite, revoke, and remove administrators", async ({ page }) => {
  const beneficiaryId = "ben_team_test";
  const owner = {
    id: "owner_1",
    email: "owner@example.org",
    name: "Organization Owner",
    role: "BENEFICIARY_ADMIN",
    beneficiaryId,
    beneficiary: { id: beneficiaryId, name: "Volunteer Organization" },
  };
  let invitedEmail = "pending@example.org";
  let invitationPresent = true;
  let adminPresent = true;

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ user }) => {
    localStorage.setItem("goodhours_token", "team_test_token");
    localStorage.setItem("goodhours_user", JSON.stringify(user));
  }, { user: owner });

  await page.route("**/api/auth/me", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(owner) }));
  await page.route(`**/api/beneficiaries/${beneficiaryId}`, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ id: beneficiaryId, name: "Volunteer Organization", email: owner.email }),
  }));
  await page.route(`**/api/beneficiaries/${beneficiaryId}/tier`, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ tier: "FREE", limits: {} }),
  }));
  await page.route(`**/api/beneficiaries/${beneficiaryId}/reminder-config`, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ reminders: [], tier: "FREE" }),
  }));
  await page.route(`**/api/beneficiaries/${beneficiaryId}/admins`, async (route) => {
    if (route.request().method() === "GET") {
      const admins = [
        { id: owner.id, name: owner.name, email: owner.email, beneficiaryAdminRole: "OWNER" },
        ...(adminPresent ? [{ id: "admin_2", name: "Additional Admin", email: "admin@example.org", beneficiaryAdminRole: "ADMIN" }] : []),
      ];
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(admins) });
      return;
    }
    await route.fallback();
  });
  await page.route(`**/api/beneficiaries/${beneficiaryId}/admins/admin_2`, async (route) => {
    adminPresent = false;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.route(`**/api/beneficiaries/${beneficiaryId}/admin-invitations`, async (route) => {
    if (route.request().method() === "POST") {
      invitedEmail = (await route.request().postDataJSON()).email;
      invitationPresent = true;
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: "invite_1", email: invitedEmail, expiresAt: "2026-08-02T00:00:00.000Z" }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(invitationPresent ? [{ id: "invite_1", email: invitedEmail, expiresAt: "2026-08-02T00:00:00.000Z" }] : []),
    });
  });
  await page.route(`**/api/beneficiaries/${beneficiaryId}/admin-invitations/invite_1`, async (route) => {
    invitationPresent = false;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });

  await page.goto(`${BASE}/settings?tab=team`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Organization administrators" })).toBeVisible();
  await expect(page.getByText("Additional Admin")).toBeVisible();
  await expect(page.getByText("pending@example.org")).toBeVisible();

  await page.getByLabel("Invite administrator by email").fill("newadmin@example.org");
  await page.getByRole("button", { name: "Send invitation" }).click();
  await expect(page.getByText("Invitation email sent.")).toBeVisible();
  await expect(page.getByText("newadmin@example.org")).toBeVisible();

  await page.getByRole("button", { name: "Revoke" }).click();
  await expect(page.getByText("Invitation revoked.")).toBeVisible();
  await expect(page.getByText("newadmin@example.org")).toHaveCount(0);

  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("Administrator removed.")).toBeVisible();
  await expect(page.getByText("Additional Admin")).toHaveCount(0);
});
