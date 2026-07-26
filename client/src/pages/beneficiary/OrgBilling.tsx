import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../lib/api";

interface BillingSummary {
  id: string;
  name: string;
  planTier: "FREE" | "PRO";
  subscriptionStatus: string;
  billingInterval: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasStripeCustomer: boolean;
  proMonthlyPriceCents: number;
  proAnnualPriceCents: number;
  invoiceRequests: ProcurementRequest[];
}

type ProcurementRequestStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "INVOICE_SENT"
  | "PAID"
  | "REJECTED"
  | "CANCELLED";

interface ProcurementRequest {
  id: string;
  status: ProcurementRequestStatus | string;
  legalName: string;
  address: string;
  billingContactName: string;
  billingContactEmail: string;
  purchaseOrderRequired: boolean;
  taxExempt: boolean;
  requestedBillingInterval: "monthly" | "annual" | null;
  preferredPaymentMethod: string | null;
  additionalNotes: string | null;
  quoteAmountCents?: number | null;
  quoteSentAt?: string | null;
  invoiceNumber?: string | null;
  invoiceSentAt?: string | null;
  paidAt?: string | null;
  rejectedReason?: string | null;
  auditLogs?: Array<{
    id: string;
    previousStatus: string | null;
    newStatus: string;
    subject?: string | null;
    entryType?: string;
    note?: string | null;
    changedAt: string;
  }>;
  artifacts?: Array<{
    id: string;
    documentType: string;
    originalName: string;
    mimeType: string;
    fileSizeBytes: number;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  FREE:                  { label: "Free",                    color: "text-[var(--text-sec)]" },
  TRIALING:              { label: "Trial",                   color: "text-[var(--wn-t)]" },
  ACTIVE:                { label: "Active",                  color: "text-[var(--ok-t)]" },
  PAST_DUE:              { label: "Past Due",                color: "text-[var(--er-t)]" },
  CANCEL_AT_PERIOD_END:  { label: "Cancels at period end",   color: "text-[var(--wn-t)]" },
  CANCELLED:             { label: "Cancelled",               color: "text-[var(--er-t)]" },
  INCOMPLETE:            { label: "Incomplete",              color: "text-[var(--wn-t)]" },
};

const INVOICE_REQUEST_STATUS_LABELS: Record<string, string> = {
  SUBMITTED:      "Submitted",
  UNDER_REVIEW:   "Under Review",
  APPROVED:       "Approved",
  INVOICE_SENT:   "Invoice Sent",
  PAID:           "Paid",
  REJECTED:       "Rejected",
  CANCELLED:      "Cancelled",
};

const PROCUREMENT_STEPS: Array<{ statuses: ProcurementRequestStatus[]; label: string }> = [
  { statuses: ["SUBMITTED"], label: "Request submitted" },
  { statuses: ["UNDER_REVIEW"], label: "GoodHours review" },
  { statuses: ["APPROVED"], label: "Quote approved" },
  { statuses: ["INVOICE_SENT"], label: "Invoice or PO sent" },
  { statuses: ["PAID"], label: "Activation complete" },
];

const TERMINAL_PROCUREMENT_STATUSES: ProcurementRequestStatus[] = ["PAID", "REJECTED", "CANCELLED"];
const OPEN_PROCUREMENT_STATUSES = new Set<ProcurementRequestStatus>(["SUBMITTED", "UNDER_REVIEW", "APPROVED", "INVOICE_SENT"]);

function cents(n: number) {
  return `$${(n / 100).toFixed(0)}`;
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatBytes(bytes: number) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${bytes} B`;
}

function procurementStepState(
  step: typeof PROCUREMENT_STEPS[number],
  current: ProcurementRequestStatus,
): "completed" | "current" | "upcoming" {
  if (current === "REJECTED" || current === "CANCELLED") return "upcoming";

  const allStatuses = PROCUREMENT_STEPS.flatMap((s) => s.statuses);
  const currentIdx = allStatuses.indexOf(current);
  const stepLastIdx = Math.max(...step.statuses.map((s) => allStatuses.indexOf(s)));

  if (currentIdx < 0) return "upcoming";
  if (current === "PAID" && step.statuses.includes("PAID")) return "completed";
  if (stepLastIdx < currentIdx) return "completed";
  if (step.statuses.includes(current)) return "current";
  return "upcoming";
}

export function OrgBilling({ beneficiaryId }: { beneficiaryId: string }) {
  const [searchParams, setSearchParams] = useSearchParams();

  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Upgrade state
  const [interval, setInterval] = useState<"monthly" | "annual">("monthly");
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState("");

  // Portal state
  const [openingPortal, setOpeningPortal] = useState(false);

  // Invoice request form state
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    legalName: "",
    address: "",
    billingContactName: "",
    billingContactEmail: "",
    purchaseOrderRequired: false,
    taxExempt: false,
    requestedBillingInterval: "monthly" as "monthly" | "annual",
    preferredPaymentMethod: "",
    additionalNotes: "",
  });
  const [submittingInvoice, setSubmittingInvoice] = useState(false);
  const [invoiceMessage, setInvoiceMessage] = useState("");
  const [invoiceIsError, setInvoiceIsError] = useState(false);

  useEffect(() => {
    api.get<BillingSummary>(`/billing/organizations/${beneficiaryId}/summary`)
      .then(setSummary)
      .catch((err: any) => setError(err.message || "Failed to load billing info"))
      .finally(() => setLoading(false));
  }, [beneficiaryId]);

  // Show success banner after Stripe redirect
  useEffect(() => {
    if (searchParams.get("checkout") === "success") {
      const next = new URLSearchParams(searchParams);
      next.delete("checkout");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleUpgrade = async () => {
    setUpgrading(true);
    setUpgradeError("");
    try {
      const { url } = await api.post<{ url: string }>(
        `/billing/organizations/${beneficiaryId}/checkout`,
        { interval }
      );
      window.location.assign(url);
    } catch (err: any) {
      setUpgradeError(err.message || "Failed to start checkout. Please try again.");
      setUpgrading(false);
    }
  };

  const handlePortal = async () => {
    setOpeningPortal(true);
    try {
      const { url } = await api.post<{ url: string }>(
        `/billing/organizations/${beneficiaryId}/portal`,
        {}
      );
      window.location.assign(url);
    } catch (err: any) {
      setError(err.message || "Failed to open billing portal.");
      setOpeningPortal(false);
    }
  };

  const handleInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingInvoice(true);
    setInvoiceMessage("");
    try {
      await api.post(`/billing/organizations/${beneficiaryId}/invoice-request`, invoiceForm);
      setInvoiceMessage("Invoice request submitted. We'll be in touch within 2 business days.");
      setInvoiceIsError(false);
      setShowInvoiceForm(false);
      setInvoiceForm({
        legalName: "",
        address: "",
        billingContactName: "",
        billingContactEmail: "",
        purchaseOrderRequired: false,
        taxExempt: false,
        requestedBillingInterval: "monthly",
        preferredPaymentMethod: "",
        additionalNotes: "",
      });
      // Refresh summary
      const fresh = await api.get<BillingSummary>(`/billing/organizations/${beneficiaryId}/summary`);
      setSummary(fresh);
    } catch (err: any) {
      setInvoiceMessage(err.message || "Failed to submit invoice request.");
      setInvoiceIsError(true);
    } finally {
      setSubmittingInvoice(false);
    }
  };

  const handleArtifactDownload = async (requestId: string, artifactId: string, originalName: string) => {
    const blob = await api.download(`/billing/organizations/invoice-requests/${requestId}/artifacts/${artifactId}`);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", originalName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="text-[var(--text-sec)] text-sm">Loading billing information...</div>;
  if (error) return (
    <div className="p-3 bg-[var(--er-bg)] border border-[var(--er-b)] rounded-[2px] text-sm text-[var(--er-t)]">{error}</div>
  );
  if (!summary) return null;

  const isPro = summary.planTier === "PRO";
  const statusInfo = STATUS_LABELS[summary.subscriptionStatus] ?? { label: summary.subscriptionStatus, color: "text-[var(--text-sec)]" };
  const periodEnd = summary.currentPeriodEnd ? new Date(summary.currentPeriodEnd) : null;
  const activeProcurementRequest = summary.invoiceRequests.find((req) =>
    OPEN_PROCUREMENT_STATUSES.has(req.status as ProcurementRequestStatus)
  );
  const procurementHistory = summary.invoiceRequests.filter((req) => req.id !== activeProcurementRequest?.id);

  const checkoutSuccess = new URLSearchParams(window.location.search).get("checkout") === "success";

  return (
    <div className="space-y-6">
      <h2 className="font-semibold text-[var(--text)] text-[17px]">Plans &amp; Billing</h2>

      {/* Stripe checkout success banner */}
      {checkoutSuccess && (
        <div className="p-3 bg-[var(--ok-bg)] border border-[var(--ok-b)] rounded-[2px] text-sm text-[var(--ok-t)]">
          Your subscription is now active. Welcome to GoodHours Pro.
        </div>
      )}

      {/* ── Current plan card ── */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-6">
        <h3 className="font-medium text-[var(--text)] mb-4">Current Plan</h3>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div>
            <span className="text-[var(--text-faint)] uppercase tracking-wide text-[11px] font-semibold block mb-0.5">Plan</span>
            <span className="font-semibold text-[var(--text)]">{isPro ? "GoodHours Pro" : "GoodHours Free"}</span>
          </div>
          <div>
            <span className="text-[var(--text-faint)] uppercase tracking-wide text-[11px] font-semibold block mb-0.5">Status</span>
            <span className={`font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
          </div>
          {isPro && summary.billingInterval && (
            <div>
              <span className="text-[var(--text-faint)] uppercase tracking-wide text-[11px] font-semibold block mb-0.5">Billing</span>
              <span className="text-[var(--text)]">{summary.billingInterval === "annual" ? "Annual" : "Monthly"}</span>
            </div>
          )}
          {isPro && summary.billingInterval && (
            <div>
              <span className="text-[var(--text-faint)] uppercase tracking-wide text-[11px] font-semibold block mb-0.5">Price</span>
              <span className="text-[var(--text)]">
                {summary.billingInterval === "annual"
                  ? `${cents(summary.proAnnualPriceCents)}/year`
                  : `${cents(summary.proMonthlyPriceCents)}/month`}
              </span>
            </div>
          )}
          {periodEnd && (
            <div>
              <span className="text-[var(--text-faint)] uppercase tracking-wide text-[11px] font-semibold block mb-0.5">
                {summary.cancelAtPeriodEnd ? "Access until" : "Next billing date"}
              </span>
              <span className="text-[var(--text)]">{periodEnd.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
            </div>
          )}
        </div>

        {summary.subscriptionStatus === "PAST_DUE" && (
          <div className="mt-4 p-3 bg-[var(--er-bg)] border border-[var(--er-b)] rounded-[2px] text-sm text-[var(--er-t)]">
            Your payment is past due. Update your payment method to prevent service interruption.
          </div>
        )}
        {summary.subscriptionStatus === "CANCEL_AT_PERIOD_END" && periodEnd && (
          <div className="mt-4 p-3 bg-[var(--wn-bg)] border border-[var(--wn-b)] rounded-[2px] text-sm text-[var(--wn-t)]">
            Your Pro subscription will end on {periodEnd.toLocaleDateString()}. You can reactivate from the billing portal.
          </div>
        )}

        {/* Manage subscription (active stripe customers) */}
        {summary.hasStripeCustomer && (
          <div className="mt-5 pt-4 border-t border-[var(--border)]">
            <button
              onClick={handlePortal}
              disabled={openingPortal}
              className="px-4 py-2 border border-[var(--border-s)] text-[var(--text)] rounded-[2px] text-sm hover:bg-[var(--surface-alt)] disabled:opacity-50"
            >
              {openingPortal ? "Opening..." : "Manage Subscription"}
            </button>
            <p className="mt-1.5 text-xs text-[var(--text-faint)]">
              Update payment method, view invoices, download receipts, or cancel.
            </p>
          </div>
        )}
      </div>

      {/* ── Plan comparison ── */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border)]">
          <h3 className="font-medium text-[var(--text)]">Plans</h3>
        </div>
        <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border)]">
          {/* Free column */}
          <div className="p-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-[var(--text)]">Free</span>
              {!isPro && (
                <span className="text-[10px] font-semibold bg-[var(--action-lt)] text-[var(--action)] px-2 py-0.5 rounded-full uppercase tracking-wide">
                  Current
                </span>
              )}
            </div>
            <p className="text-[22px] font-bold text-[var(--text)] mb-4">$0</p>
            <ul className="space-y-2 text-sm text-[var(--text-sec)]">
              {[
                "Unlimited opportunity creation and management",
                "Signup confirmations and notifications",
                "Cancellation and schedule-change notifications",
                "One standardized pre-event reminder (24h)",
                "Hour verification with audit trail",
                "Basic attendance tracking",
                "Automatic waitlist promotion",
                "Basic statistics",
                "Messaging inbox",
                "350 MB file storage",
              ].map((f) => (
                <li key={f} className="flex gap-2">
                  <span className="text-[var(--ok-t)] flex-shrink-0 mt-0.5">✓</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Pro column */}
          <div className="p-6 bg-[var(--surface-alt)]">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-[var(--text)]">Pro</span>
              {isPro && (
                <span className="text-[10px] font-semibold bg-[var(--action-lt)] text-[var(--action)] px-2 py-0.5 rounded-full uppercase tracking-wide">
                  Current
                </span>
              )}
            </div>
            {/* Interval toggle for Free orgs */}
            {!isPro ? (
              <div className="flex items-center gap-3 mb-4">
                <span className="text-[22px] font-bold text-[var(--text)]">
                  {interval === "annual"
                    ? `${cents(summary.proAnnualPriceCents)}/yr`
                    : `${cents(summary.proMonthlyPriceCents)}/mo`}
                </span>
                <div className="flex rounded-[2px] border border-[var(--border-s)] overflow-hidden text-xs">
                  <button
                    onClick={() => setInterval("monthly")}
                    className={`px-3 py-1 font-medium transition-colors ${
                      interval === "monthly"
                        ? "bg-[var(--action)] text-white"
                        : "text-[var(--text-sec)] hover:bg-[var(--surface-alt)]"
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setInterval("annual")}
                    className={`px-3 py-1 font-medium border-l border-[var(--border-s)] transition-colors ${
                      interval === "annual"
                        ? "bg-[var(--action)] text-white"
                        : "text-[var(--text-sec)] hover:bg-[var(--surface-alt)]"
                    }`}
                  >
                    Annual
                    <span className="ml-1 text-[10px] text-[var(--ok-t)]">Save 17%</span>
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-[22px] font-bold text-[var(--text)] mb-4">
                {summary.billingInterval === "annual"
                  ? `${cents(summary.proAnnualPriceCents)}/yr`
                  : `${cents(summary.proMonthlyPriceCents)}/mo`}
              </p>
            )}

            <p className="text-xs text-[var(--text-sec)] mb-3">Everything in Free, plus:</p>
            <ul className="space-y-2 text-sm text-[var(--text-sec)] mb-5">
              {[
                "Multiple configurable pre-event reminders",
                "Custom reminder timing and schedules",
                "Custom email branding (logo, colors, signature)",
                "Automated required-form and waiver reminders",
                "Advanced reminder content (directions, prep notes)",
                "Advanced waitlist controls",
                "Attendance and no-show analytics",
                "Reminder performance analytics",
                "5 GB file storage",
                "Higher upload-rate limits",
                "Small featured placement boost in student browse when opportunities are otherwise similarly relevant",
              ].map((f) => (
                <li key={f} className="flex gap-2">
                  <span className="text-[var(--action)] flex-shrink-0 mt-0.5">✦</span>
                  {f}
                </li>
              ))}
            </ul>

            {!isPro && (
              <>
                {upgradeError && (
                  <div className="mb-3 p-2 bg-[var(--er-bg)] border border-[var(--er-b)] rounded-[2px] text-xs text-[var(--er-t)]">
                    {upgradeError}
                  </div>
                )}
                <button
                  onClick={handleUpgrade}
                  disabled={upgrading}
                  className="w-full px-4 py-2 bg-[var(--action)] text-white rounded-[2px] text-sm font-semibold hover:opacity-85 disabled:opacity-50"
                >
                  {upgrading ? "Redirecting to checkout..." : `Upgrade to Pro — ${interval === "annual" ? cents(summary.proAnnualPriceCents) + "/yr" : cents(summary.proMonthlyPriceCents) + "/mo"}`}
                </button>
                <p className="mt-2 text-xs text-[var(--text-faint)] text-center">
                  Secure checkout powered by Stripe. Cancel anytime.
                </p>
                <p className="mt-2 text-xs text-[var(--text-faint)] text-center">
                  Placement boost is intentionally small and only acts as a tie-break after student relevance and eligibility.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Procurement / quote flow ── */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-6 space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="font-medium text-[var(--text)] mb-1">Procurement, quote, or invoicing</h3>
            <p className="text-sm text-[var(--text-sec)] max-w-2xl">
              If your organization needs a monthly or annual quote, invoice, purchase order, or tax-exempt billing flow,
              request procurement here. Stripe checkout is still the fastest path for instant activation.
            </p>
          </div>
          {!activeProcurementRequest && !showInvoiceForm && (
            <button
              onClick={() => setShowInvoiceForm(true)}
              className="px-4 py-2 border border-[var(--border-s)] text-[var(--text)] rounded-[2px] text-sm hover:bg-[var(--surface-alt)]"
            >
              Request a Quote
            </button>
          )}
        </div>

        <div className="grid sm:grid-cols-3 gap-4 p-4 bg-[var(--surface-alt)] border border-[var(--border)] rounded-[2px]">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)] mb-1">Monthly Pro</div>
            <div className="text-[20px] font-bold text-[var(--text)]">{cents(summary.proMonthlyPriceCents)}</div>
            <div className="text-xs text-[var(--text-sec)] mt-0.5">Card checkout, immediate activation</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)] mb-1">Annual Pro</div>
            <div className="text-[20px] font-bold text-[var(--text)]">{cents(summary.proAnnualPriceCents)}</div>
            <div className="text-xs text-[var(--text-sec)] mt-0.5">Best fit for invoice and PO workflows</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)] mb-1">Supported payment methods</div>
            <div className="text-sm text-[var(--text)] leading-6">ACH, check, purchase order, bank transfer, or card</div>
          </div>
        </div>

        {invoiceMessage && (
          <div className={`p-3 rounded-[2px] text-sm ${invoiceIsError ? "bg-[var(--er-bg)] border border-[var(--er-b)] text-[var(--er-t)]" : "bg-[var(--ok-bg)] border border-[var(--ok-b)] text-[var(--ok-t)]"}`}>
            {invoiceMessage}
          </div>
        )}

        {activeProcurementRequest && (
          <div className="space-y-5 border border-[var(--border)] rounded-[3px] p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h4 className="font-medium text-[var(--text)]">Current procurement request</h4>
                <p className="text-sm text-[var(--text-sec)] mt-1">
                  Submitted {new Date(activeProcurementRequest.createdAt).toLocaleDateString()} for {activeProcurementRequest.legalName}
                </p>
              </div>
              <span className="text-xs font-medium text-[var(--text-sec)] bg-[var(--surface-alt)] border border-[var(--border)] px-2 py-1 rounded-full w-fit">
                {INVOICE_REQUEST_STATUS_LABELS[activeProcurementRequest.status] ?? activeProcurementRequest.status}
              </span>
            </div>

            {!TERMINAL_PROCUREMENT_STATUSES.includes(activeProcurementRequest.status as ProcurementRequestStatus) && (
              <div className="space-y-0">
                {PROCUREMENT_STEPS.map((step, i) => {
                  const state = procurementStepState(step, activeProcurementRequest.status as ProcurementRequestStatus);
                  return (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          state === "completed" ? "bg-[var(--ok-t)] border-[var(--ok-t)]" :
                          state === "current" ? "bg-[var(--action)] border-[var(--action)]" :
                          "bg-white border-[var(--border-s)]"
                        }`}>
                          {state === "completed" && <span className="text-white text-[10px]">✓</span>}
                          {state === "current" && <span className="w-2 h-2 rounded-full bg-white block" />}
                        </div>
                        {i < PROCUREMENT_STEPS.length - 1 && (
                          <div className={`w-0.5 h-7 mt-0.5 ${state === "completed" ? "bg-[var(--ok-t)]" : "bg-[var(--border)]"}`} />
                        )}
                      </div>
                      <div className="pb-6">
                        <p className={`text-sm font-medium ${
                          state === "current" ? "text-[var(--action)]" :
                          state === "completed" ? "text-[var(--ok-t)]" :
                          "text-[var(--text-faint)]"
                        }`}>
                          {step.label}
                          {state === "current" && (
                            <span className="ml-2 text-[10px] font-semibold bg-[var(--action-lt)] text-[var(--action)] px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                              Current
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div>
                <span className="text-[var(--text-faint)] uppercase tracking-wide text-[11px] font-semibold block mb-0.5">Legal name</span>
                <span className="text-[var(--text)] font-medium">{activeProcurementRequest.legalName}</span>
              </div>
              <div>
                <span className="text-[var(--text-faint)] uppercase tracking-wide text-[11px] font-semibold block mb-0.5">Billing contact</span>
                <span className="text-[var(--text)] font-medium">
                  {activeProcurementRequest.billingContactName} · {activeProcurementRequest.billingContactEmail}
                </span>
              </div>
              <div>
                <span className="text-[var(--text-faint)] uppercase tracking-wide text-[11px] font-semibold block mb-0.5">Preferred payment method</span>
                <span className="text-[var(--text)] font-medium">{activeProcurementRequest.preferredPaymentMethod || "Not specified"}</span>
              </div>
              <div>
                <span className="text-[var(--text-faint)] uppercase tracking-wide text-[11px] font-semibold block mb-0.5">Requested billing interval</span>
                <span className="text-[var(--text)] font-medium">
                  {activeProcurementRequest.requestedBillingInterval === "annual"
                    ? "Annual"
                    : activeProcurementRequest.requestedBillingInterval === "monthly"
                      ? "Monthly"
                      : "Not specified"}
                </span>
              </div>
              <div>
                <span className="text-[var(--text-faint)] uppercase tracking-wide text-[11px] font-semibold block mb-0.5">Requirements</span>
                <span className="text-[var(--text)] font-medium">
                  {[
                    activeProcurementRequest.purchaseOrderRequired ? "Purchase order required" : null,
                    activeProcurementRequest.taxExempt ? "Tax-exempt" : null,
                  ].filter(Boolean).join(" · ") || "No special requirements noted"}
                </span>
              </div>
              <div>
                <span className="text-[var(--text-faint)] uppercase tracking-wide text-[11px] font-semibold block mb-0.5">Quoted amount</span>
                <span className="text-[var(--text)] font-medium">
                  {activeProcurementRequest.quoteAmountCents != null ? cents(activeProcurementRequest.quoteAmountCents) : "Pending"}
                </span>
              </div>
              <div>
                <span className="text-[var(--text-faint)] uppercase tracking-wide text-[11px] font-semibold block mb-0.5">Invoice number</span>
                <span className="text-[var(--text)] font-medium">{activeProcurementRequest.invoiceNumber || "Pending"}</span>
              </div>
              <div>
                <span className="text-[var(--text-faint)] uppercase tracking-wide text-[11px] font-semibold block mb-0.5">Quote sent</span>
                <span className="text-[var(--text)] font-medium">{fmtDate(activeProcurementRequest.quoteSentAt)}</span>
              </div>
              <div>
                <span className="text-[var(--text-faint)] uppercase tracking-wide text-[11px] font-semibold block mb-0.5">Invoice sent</span>
                <span className="text-[var(--text)] font-medium">{fmtDate(activeProcurementRequest.invoiceSentAt)}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-[var(--text-faint)] uppercase tracking-wide text-[11px] font-semibold block mb-0.5">Organization address</span>
                <span className="text-[var(--text)] font-medium">{activeProcurementRequest.address}</span>
              </div>
              {activeProcurementRequest.additionalNotes && (
                <div className="sm:col-span-2">
                  <span className="text-[var(--text-faint)] uppercase tracking-wide text-[11px] font-semibold block mb-0.5">Additional notes</span>
                  <span className="text-[var(--text)] font-medium whitespace-pre-wrap">{activeProcurementRequest.additionalNotes}</span>
                </div>
              )}
              {activeProcurementRequest.rejectedReason && (
                <div className="sm:col-span-2">
                  <span className="text-[var(--text-faint)] uppercase tracking-wide text-[11px] font-semibold block mb-0.5">Decision note</span>
                  <span className="text-[var(--text)] font-medium whitespace-pre-wrap">{activeProcurementRequest.rejectedReason}</span>
                </div>
              )}
            </div>

            {activeProcurementRequest.auditLogs && activeProcurementRequest.auditLogs.length > 0 && (
              <div className="space-y-3">
                <h5 className="text-sm font-medium text-[var(--text)]">Status History</h5>
                <div className="space-y-2">
                  {activeProcurementRequest.auditLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between rounded-[2px] border border-[var(--border)] px-3 py-2 text-sm">
                      <div className="text-[var(--text)]">
                        {log.entryType === "CONTACT"
                          ? (log.subject || "Update from GoodHours")
                          : (INVOICE_REQUEST_STATUS_LABELS[log.newStatus] ?? log.newStatus)}
                        {log.note ? ` · ${log.note}` : ""}
                      </div>
                      <div className="text-[var(--text-faint)]">{fmtDate(log.changedAt)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeProcurementRequest.artifacts && activeProcurementRequest.artifacts.length > 0 && (
              <div className="space-y-3">
                <h5 className="text-sm font-medium text-[var(--text)]">Shared Documents</h5>
                <div className="space-y-2">
                  {activeProcurementRequest.artifacts.map((artifact) => (
                    <div key={artifact.id} className="flex items-center justify-between rounded-[2px] border border-[var(--border)] px-3 py-2 text-sm">
                      <div>
                        <div className="font-medium text-[var(--text)]">{artifact.originalName}</div>
                        <div className="text-xs text-[var(--text-faint)]">
                          {artifact.documentType} · {formatBytes(artifact.fileSizeBytes)} · {fmtDate(artifact.createdAt)}
                        </div>
                      </div>
                      <button
                        onClick={() => void handleArtifactDownload(activeProcurementRequest.id, artifact.id, artifact.originalName)}
                        className="text-[var(--action)] hover:underline"
                      >
                        Download
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-3 bg-[var(--in-bg)] border border-[var(--in-b)] rounded-[2px] text-sm text-[var(--in-t)]">
              GoodHours will contact the billing contact listed above with quote details, invoice instructions, or any follow-up procurement questions.
            </div>
          </div>
        )}

        {procurementHistory.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-[var(--text)]">Request history</h4>
            {procurementHistory.map((req) => (
              <div key={req.id} className="flex items-center justify-between p-3 bg-[var(--surface-alt)] border border-[var(--border)] rounded-[2px] text-sm">
                <div>
                  <span className="font-medium text-[var(--text)]">{req.legalName}</span>
                  <span className="ml-2 text-[var(--text-faint)]">·</span>
                  <span className="ml-2 text-[var(--text-sec)]">{new Date(req.createdAt).toLocaleDateString()}</span>
                </div>
                <span className="text-xs font-medium text-[var(--text-sec)] bg-[var(--surface)] border border-[var(--border)] px-2 py-0.5 rounded-full">
                  {INVOICE_REQUEST_STATUS_LABELS[req.status] ?? req.status}
                </span>
              </div>
            ))}
          </div>
        )}

        {!activeProcurementRequest && showInvoiceForm && (
          <form onSubmit={handleInvoiceSubmit} className="space-y-4 border-t border-[var(--border)] pt-4">
            <p className="text-xs text-[var(--text-faint)]">
              This creates a tracked procurement request. It does not automatically activate Pro.
            </p>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">Organization legal name <span className="text-[var(--er-t)]">*</span></label>
                <input
                  required
                  value={invoiceForm.legalName}
                  onChange={(e) => setInvoiceForm((p) => ({ ...p, legalName: e.target.value }))}
                  className="w-full px-3 py-[7px] border border-[var(--border-s)] rounded-[2px] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--action)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">Organization address <span className="text-[var(--er-t)]">*</span></label>
                <input
                  required
                  value={invoiceForm.address}
                  onChange={(e) => setInvoiceForm((p) => ({ ...p, address: e.target.value }))}
                  className="w-full px-3 py-[7px] border border-[var(--border-s)] rounded-[2px] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--action)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">Billing contact name <span className="text-[var(--er-t)]">*</span></label>
                <input
                  required
                  value={invoiceForm.billingContactName}
                  onChange={(e) => setInvoiceForm((p) => ({ ...p, billingContactName: e.target.value }))}
                  className="w-full px-3 py-[7px] border border-[var(--border-s)] rounded-[2px] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--action)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">Billing contact email <span className="text-[var(--er-t)]">*</span></label>
                <input
                  required
                  type="email"
                  value={invoiceForm.billingContactEmail}
                  onChange={(e) => setInvoiceForm((p) => ({ ...p, billingContactEmail: e.target.value }))}
                  className="w-full px-3 py-[7px] border border-[var(--border-s)] rounded-[2px] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--action)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">Requested billing interval <span className="text-[var(--er-t)]">*</span></label>
              <select
                required
                value={invoiceForm.requestedBillingInterval}
                onChange={(e) => setInvoiceForm((p) => ({ ...p, requestedBillingInterval: e.target.value as "monthly" | "annual" }))}
                className="w-full px-3 py-[7px] border border-[var(--border-s)] rounded-[2px] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--action)]"
              >
                <option value="monthly">Monthly Pro</option>
                <option value="annual">Annual Pro</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">Preferred payment method</label>
              <select
                value={invoiceForm.preferredPaymentMethod}
                onChange={(e) => setInvoiceForm((p) => ({ ...p, preferredPaymentMethod: e.target.value }))}
                className="w-full px-3 py-[7px] border border-[var(--border-s)] rounded-[2px] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--action)]"
              >
                <option value="">Select…</option>
                <option value="ACH">ACH / bank transfer</option>
                <option value="check">Check</option>
                <option value="purchase_order">Purchase order</option>
                <option value="card">Card</option>
              </select>
            </div>

            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm text-[var(--text)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={invoiceForm.purchaseOrderRequired}
                  onChange={(e) => setInvoiceForm((p) => ({ ...p, purchaseOrderRequired: e.target.checked }))}
                  className="rounded border-[var(--border-s)]"
                />
                Purchase order required
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--text)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={invoiceForm.taxExempt}
                  onChange={(e) => setInvoiceForm((p) => ({ ...p, taxExempt: e.target.checked }))}
                  className="rounded border-[var(--border-s)]"
                />
                Tax-exempt organization
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">Additional billing instructions</label>
              <textarea
                rows={3}
                value={invoiceForm.additionalNotes}
                onChange={(e) => setInvoiceForm((p) => ({ ...p, additionalNotes: e.target.value }))}
                placeholder="Vendor registration requirements, billing system details, quote questions, or PO instructions."
                className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--action)]"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={submittingInvoice}
                className="px-5 py-[7px] bg-[var(--action)] text-white rounded-[2px] text-sm font-medium hover:opacity-85 disabled:opacity-50"
              >
                {submittingInvoice ? "Submitting..." : "Submit Procurement Request"}
              </button>
              <button
                type="button"
                onClick={() => setShowInvoiceForm(false)}
                className="px-4 py-[7px] border border-[var(--border-s)] text-[var(--text)] rounded-[2px] text-sm hover:bg-[var(--surface-alt)]"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
