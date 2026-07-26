import { expect, test } from "@playwright/test";

const BASE = process.env.PW_BASE_URL || "http://localhost:5173";

test("organization billing shows tracked procurement state", async ({ page }) => {
  const beneficiaryId = "ben_test_org";
  const token = "pw_token";
  const user = {
    id: "user_org_admin",
    email: "volunteer@greenearth.org",
    name: "Org Admin",
    role: "BENEFICIARY_ADMIN",
    beneficiaryId,
    beneficiary: { id: beneficiaryId, name: "Green Earth Org" },
  };

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ jwt, cachedUser }) => {
    localStorage.setItem("goodhours_token", jwt);
    localStorage.setItem("goodhours_user", JSON.stringify(cachedUser));
  }, { jwt: token, cachedUser: user });

  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(user),
    });
  });

  await page.route(`**/api/beneficiaries/${beneficiaryId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: beneficiaryId,
        name: "Green Earth Org",
        email: "volunteer@greenearth.org",
        phone: null,
        description: "Environmental nonprofit",
        website: "https://greenearth.org",
        address: "123 Main St",
        city: "Springfield",
        state: "IL",
        zip: "62701",
        category: "Environment",
      }),
    });
  });

  await page.route(`**/api/beneficiaries/${beneficiaryId}/tier`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tier: "FREE",
        limits: {
          configurableReminders: false,
          customEmailBranding: false,
          automatedFormReminders: false,
          advancedReminderContent: false,
          advancedWaitlistControls: false,
          attendanceAnalytics: false,
        },
      }),
    });
  });

  await page.route(`**/api/beneficiaries/${beneficiaryId}/reminder-config`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        reminders: [{ minutesBefore: 1440, enabled: true, label: "24 hours before" }],
        waitlistCutoffHours: null,
        requireApprovalForPromotion: false,
        disableAutoPromotion: false,
        promoMessageTemplate: null,
        tier: "FREE",
      }),
    });
  });

  await page.route(`**/api/billing/organizations/${beneficiaryId}/summary`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: beneficiaryId,
        name: "Green Earth Org",
        planTier: "FREE",
        subscriptionStatus: "FREE",
        billingInterval: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        hasStripeCustomer: false,
        proMonthlyPriceCents: 3000,
        proAnnualPriceCents: 30000,
        invoiceRequests: [
          {
            id: "req_open",
            status: "UNDER_REVIEW",
            legalName: "Green Earth Org",
            address: "123 Main St, Springfield, IL",
            billingContactName: "Avery Admin",
            billingContactEmail: "billing@greenearth.org",
            purchaseOrderRequired: true,
            taxExempt: true,
            requestedBillingInterval: "annual",
            preferredPaymentMethod: "ACH",
            additionalNotes: "Vendor setup pending.",
            quoteAmountCents: 30000,
            quoteSentAt: "2026-06-21T12:00:00.000Z",
            invoiceNumber: "INV-204",
            invoiceSentAt: "2026-06-24T12:00:00.000Z",
            paidAt: null,
            rejectedReason: null,
            auditLogs: [
              {
                id: "audit_1",
                previousStatus: "SUBMITTED",
                newStatus: "UNDER_REVIEW",
                subject: null,
                entryType: "STATUS",
                note: null,
                changedAt: "2026-06-21T12:00:00.000Z",
              },
              {
                id: "audit_2",
                previousStatus: "UNDER_REVIEW",
                newStatus: "UNDER_REVIEW",
                subject: "Quote ready",
                entryType: "CONTACT",
                note: "We have prepared your quote and uploaded the PDF.",
                changedAt: "2026-06-22T12:00:00.000Z",
              },
            ],
            artifacts: [
              {
                id: "artifact_1",
                documentType: "QUOTE",
                originalName: "goodhours-quote.pdf",
                mimeType: "application/pdf",
                fileSizeBytes: 240000,
                createdAt: "2026-06-22T12:00:00.000Z",
              },
            ],
            createdAt: "2026-06-20T12:00:00.000Z",
            updatedAt: "2026-06-22T12:00:00.000Z",
          },
          {
            id: "req_old",
            status: "CANCELLED",
            legalName: "Green Earth Org",
            address: "123 Main St, Springfield, IL",
            billingContactName: "Avery Admin",
            billingContactEmail: "billing@greenearth.org",
            purchaseOrderRequired: false,
            taxExempt: false,
            requestedBillingInterval: "monthly",
            preferredPaymentMethod: "card",
            additionalNotes: null,
            createdAt: "2026-05-01T12:00:00.000Z",
            updatedAt: "2026-05-02T12:00:00.000Z",
          },
        ],
      }),
    });
  });

  await page.route("**/api/billing/organizations/invoice-requests/req_open/artifacts/artifact_1", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/pdf",
      body: "fake pdf bytes",
    });
  });

  await page.goto(`${BASE}/settings?tab=billing`, { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "Plans & Billing" })).toBeVisible();
  await expect(page.getByText("Procurement, quote, or invoicing")).toBeVisible();
  await expect(page.getByText("Current procurement request")).toBeVisible();
  await expect(page.getByText("GoodHours review")).toBeVisible();
  await expect(page.getByText("Avery Admin · billing@greenearth.org")).toBeVisible();
  await expect(page.getByText("Annual", { exact: true })).toBeVisible();
  await expect(page.getByText("$300", { exact: true }).last()).toBeVisible();
  await expect(page.getByText("INV-204", { exact: true })).toBeVisible();
  await expect(page.getByText("Status History")).toBeVisible();
  await expect(page.getByText("Quote ready · We have prepared your quote and uploaded the PDF.")).toBeVisible();
  await expect(page.getByText("Shared Documents")).toBeVisible();
  await expect(page.getByText("goodhours-quote.pdf")).toBeVisible();
  await page.getByRole("button", { name: "Download" }).click();
  await expect(page.getByText("Request history")).toBeVisible();
  await expect(page.getByText("Cancelled")).toBeVisible();
});
