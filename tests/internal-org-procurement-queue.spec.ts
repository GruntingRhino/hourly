import { expect, test } from "@playwright/test";

const BASE = process.env.PW_BASE_URL || "http://localhost:5173";

test("internal admin can advance an organization procurement request from the monitoring queue", async ({ page }) => {
  const schoolId = "school_internal";
  const requestId = "req_under_review";
  let currentStatus = "UNDER_REVIEW";
  let currentOwner: { id: string; name: string; email: string } | null = null;
  let currentNotes = "";
  let currentQuoteAmount: number | null = null;
  let currentInvoiceNumber: string | null = null;
  let currentRejectedReason: string | null = null;
  const auditLogs = [
    {
      id: "audit_seed",
      previousStatus: "SUBMITTED",
      newStatus: "UNDER_REVIEW",
      note: "Initial review started",
      changedAt: "2026-06-21T12:00:00.000Z",
      changedByUser: {
        id: "internal_admin",
        name: "Internal Ops",
        email: "ops@goodhours.app",
      },
    },
  ];
  const artifacts: Array<{
    id: string;
    documentType: string;
    originalName: string;
    mimeType: string;
    fileSizeBytes: number;
    createdAt: string;
    uploadedByUser: { id: string; name: string; email: string };
  }> = [];

  const user = {
    id: "internal_admin",
    email: "ops@goodhours.app",
    name: "Internal Ops",
    role: "SCHOOL_ADMIN",
    schoolId,
    isInternalAdmin: true,
    school: {
      id: schoolId,
      name: "Internal Test School",
      verified: true,
    },
  };

  const workspace = {
    summary: {
      readiness: "LIVE",
      headline: "Launch running cleanly",
      detail: "Monitoring queue is active.",
    },
    metrics: {
      approvedPartners: 2,
      pendingPartners: 0,
      publishedCohorts: 1,
      totalCohorts: 1,
      invitedStudents: 10,
      pendingInvites: 2,
      studentsWithHours: 4,
      enrolledStudents: 10,
      pendingReviewCount: 1,
      pendingSelfSubmissions: 0,
      openBugCount: 0,
      criticalBugCount: 0,
      acceptedInvites: 8,
      totalApprovedHours: 12.5,
      totalPendingHours: 1.5,
      atRiskStudents: 1,
      completedStudents: 1,
      noShowCount: 0,
      pendingLegacyVerifications: 0,
    },
    plan: {
      firstUserMonitoring: {
        launchStartDate: "2026-06-01",
        checkCadence: "DAILY",
        activeStudentTarget: 10,
        watchList: ["Alex Student"],
        notes: "Watch queue health.",
      },
      onboardingInstructions: {
        overview: "Overview",
        nextMilestone: "Next milestone",
      },
      supportProcess: {
        ownerName: "Owner",
        ownerEmail: "owner@example.com",
        responseTimeHours: 24,
        escalationAfterHours: 48,
        intakeChannels: ["email"],
        notes: null,
      },
      rollbackPlan: {
        ownerName: "Owner",
        trigger: "Trigger",
        freezeAction: "Freeze",
        rollbackSteps: "Steps",
        restoreCheck: "Restore",
        lastDrillAt: null,
      },
    },
    checklist: [],
    bugs: [],
    reminders: {
      lastRunAt: null,
      nextRunAt: null,
      cadenceLabel: "Daily",
    },
  };

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ jwt, cachedUser }) => {
    localStorage.setItem("goodhours_token", jwt);
    localStorage.setItem("goodhours_user", JSON.stringify(cachedUser));
  }, { jwt: "pw_token", cachedUser: user });

  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(user),
    });
  });

  await page.route("**/api/schools/launch", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(workspace),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(workspace),
    });
  });

  await page.route("**/api/billing/organizations/internal/operators", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        operators: [
          { id: user.id, name: user.name, email: user.email },
          { id: "other_internal", name: "Backup Ops", email: "backup@goodhours.app" },
        ],
      }),
    });
  });

  await page.route("**/api/billing/organizations/internal/invoice-requests?limit=10", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        requests: [
          {
            id: requestId,
            status: currentStatus,
            legalName: "Green Earth Org",
            address: "123 Main St, Springfield, IL",
            billingContactName: "Avery Admin",
            billingContactEmail: "billing@greenearth.org",
            purchaseOrderRequired: true,
            taxExempt: true,
            preferredPaymentMethod: "ACH",
            additionalNotes: "Needs W-9 before payment.",
            internalNotes: currentNotes,
            quoteAmountCents: currentQuoteAmount,
            quoteSentAt: null,
            invoiceNumber: currentInvoiceNumber,
            invoiceSentAt: null,
            paidAt: null,
            rejectedReason: currentRejectedReason,
            createdAt: "2026-06-20T12:00:00.000Z",
            updatedAt: "2026-06-22T12:00:00.000Z",
            ownerUser: currentOwner,
            beneficiary: {
              id: "ben_1",
              name: "Green Earth Org",
              email: "org@example.com",
              planTier: "FREE",
            },
            auditLogs,
            artifacts,
          },
        ],
      }),
    });
  });

  await page.route(`**/api/billing/organizations/internal/invoice-requests/${requestId}`, async (route) => {
    const body = route.request().postDataJSON() as {
      status?: string;
      ownerUserId?: string | null;
      internalNotes?: string | null;
      quoteAmountCents?: number | null;
      invoiceNumber?: string | null;
      rejectedReason?: string | null;
      auditNote?: string;
    };
    if (body.status) currentStatus = body.status;
    if ("ownerUserId" in body) {
      currentOwner = body.ownerUserId ? { id: user.id, name: user.name, email: user.email } : null;
    }
    if ("internalNotes" in body) currentNotes = body.internalNotes || "";
    if ("quoteAmountCents" in body) currentQuoteAmount = body.quoteAmountCents ?? null;
    if ("invoiceNumber" in body) currentInvoiceNumber = body.invoiceNumber ?? null;
    if ("rejectedReason" in body) currentRejectedReason = body.rejectedReason ?? null;
    auditLogs.unshift({
      id: `audit_${auditLogs.length + 1}`,
      previousStatus: body.status ? "UNDER_REVIEW" : currentStatus,
      newStatus: body.status || currentStatus,
      note: body.auditNote || null,
      changedAt: "2026-06-23T12:00:00.000Z",
      changedByUser: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: requestId,
        status: currentStatus,
        legalName: "Green Earth Org",
        address: "123 Main St, Springfield, IL",
        billingContactName: "Avery Admin",
        billingContactEmail: "billing@greenearth.org",
        purchaseOrderRequired: true,
        taxExempt: true,
        preferredPaymentMethod: "ACH",
        additionalNotes: "Needs W-9 before payment.",
        internalNotes: currentNotes,
        quoteAmountCents: currentQuoteAmount,
        quoteSentAt: null,
        invoiceNumber: currentInvoiceNumber,
        invoiceSentAt: null,
        paidAt: null,
        rejectedReason: currentRejectedReason,
        createdAt: "2026-06-20T12:00:00.000Z",
        updatedAt: "2026-06-23T12:00:00.000Z",
        ownerUser: currentOwner,
        beneficiary: {
          id: "ben_1",
          name: "Green Earth Org",
          email: "org@example.com",
          planTier: "FREE",
        },
        auditLogs,
        artifacts,
      }),
    });
  });

  await page.route(`**/api/billing/organizations/internal/invoice-requests/${requestId}/artifacts`, async (route) => {
    artifacts.unshift({
      id: "artifact_1",
      documentType: "QUOTE",
      originalName: "quote.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: 1024,
      createdAt: "2026-06-23T12:00:00.000Z",
      uploadedByUser: { id: user.id, name: user.name, email: user.email },
    });
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify(artifacts[0]),
    });
  });

  await page.route(`**/api/billing/organizations/invoice-requests/${requestId}/artifacts/artifact_1`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/pdf",
      body: "fake pdf bytes",
    });
  });

  await page.route(`**/api/billing/organizations/internal/invoice-requests/${requestId}/artifacts/artifact_1`, async (route) => {
    artifacts.splice(artifacts.findIndex((artifact) => artifact.id === "artifact_1"), 1);
    await route.fulfill({ status: 204, body: "" });
  });

  await page.route(`**/api/billing/organizations/internal/invoice-requests/${requestId}/contact`, async (route) => {
    const body = route.request().postDataJSON() as { subject: string; message: string; visibleToCustomer: boolean };
    auditLogs.unshift({
      id: `audit_${auditLogs.length + 1}`,
      previousStatus: currentStatus,
      newStatus: currentStatus,
      subject: body.subject,
      entryType: "CONTACT",
      visibleToCustomer: body.visibleToCustomer,
      note: body.message,
      changedAt: "2026-06-23T13:00:00.000Z",
      changedByUser: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: requestId,
        status: currentStatus,
        legalName: "Green Earth Org",
        address: "123 Main St, Springfield, IL",
        billingContactName: "Avery Admin",
        billingContactEmail: "billing@greenearth.org",
        purchaseOrderRequired: true,
        taxExempt: true,
        preferredPaymentMethod: "ACH",
        additionalNotes: "Needs W-9 before payment.",
        internalNotes: currentNotes,
        quoteAmountCents: currentQuoteAmount,
        quoteSentAt: null,
        invoiceNumber: currentInvoiceNumber,
        invoiceSentAt: null,
        paidAt: null,
        rejectedReason: currentRejectedReason,
        lastContactedAt: "2026-06-23T13:00:00.000Z",
        createdAt: "2026-06-20T12:00:00.000Z",
        updatedAt: "2026-06-23T13:00:00.000Z",
        ownerUser: currentOwner,
        beneficiary: {
          id: "ben_1",
          name: "Green Earth Org",
          email: "org@example.com",
          planTier: "FREE",
        },
        auditLogs,
        artifacts,
      }),
    });
  });

  await page.goto(`${BASE}/launch`, { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "Launch Center" })).toBeVisible();
  await expect(page.getByText("Organization Invoice Requests")).toBeVisible();
  await expect(page.getByText("Under Review", { exact: true }).first()).toBeVisible();

  await page.getByLabel("Request owner").selectOption(user.id);
  await page.getByRole("button", { name: "Save owner" }).click();
  await expect(page.getByText("Request owner updated.")).toBeVisible();
  await expect(page.getByText("Internal Ops · ops@goodhours.app")).toBeVisible();

  await page.getByLabel("Internal notes").fill("Waiting on finance packet.");
  await page.getByLabel("Quote amount (cents)").fill("30000");
  await page.getByLabel("Invoice number").fill("INV-204");
  await page.getByLabel("Audit note for next change").fill("Prepared commercial terms");
  await page.getByRole("button", { name: "Save Request Details" }).click();
  await expect(page.getByText("Request details saved.")).toBeVisible();
  await expect(page.getByText("Quote $300.00")).toBeVisible();
  await expect(page.getByText("Invoice INV-204")).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles({
    name: "quote.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("fake pdf"),
  });
  await expect(page.getByText("quote.pdf uploaded.")).toBeVisible();
  await expect(page.getByText("quote.pdf", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Download" }).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Artifact removed.")).toBeVisible();

  await page.getByLabel("Email subject").fill("Quote ready");
  await page.getByLabel("Email message").fill("We have prepared your quote and uploaded the PDF.");
  await page.getByRole("button", { name: "Send Customer Update" }).click();
  await expect(page.getByText("Customer update sent.")).toBeVisible();
  await expect(page.getByText("Customer update: Quote ready · We have prepared your quote and uploaded the PDF. · visible to org")).toBeVisible();

  await page.getByRole("button", { name: "Mark Approved" }).click();

  await expect(page.getByText("Request moved to Approved.")).toBeVisible();
  await expect(page.getByText("Approved", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark Invoice Sent" })).toBeVisible();
});
