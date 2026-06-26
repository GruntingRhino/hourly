import { useState, useEffect, useRef } from "react";
import { api } from "../../lib/api";

// ── Types ───────────────────────────────────────────────────────────────────

type SchoolBillingStatus =
  | "NONE"
  | "QUOTE_REQUESTED"
  | "QUOTE_IN_REVIEW"
  | "QUOTE_SENT"
  | "PRIVACY_REVIEW"
  | "SECURITY_REVIEW"
  | "CONTRACT_REVIEW"
  | "AWAITING_SIGNATURE"
  | "AWAITING_PURCHASE_ORDER"
  | "PURCHASE_ORDER_RECEIVED"
  | "INVOICED"
  | "PAYMENT_PENDING"
  | "ACTIVE"
  | "PAST_DUE"
  | "EXPIRED"
  | "DECLINED";

type SchoolAccessStatus = "PROCUREMENT" | "PILOT" | "ACTIVE" | "SUSPENDED" | "EXPIRED";

type SchoolProcurementDocumentType =
  | "QUOTE"
  | "SERVICE_AGREEMENT"
  | "DATA_PRIVACY_AGREEMENT"
  | "SECURITY_DOCUMENT"
  | "W9"
  | "CERTIFICATE_OF_INSURANCE"
  | "PURCHASE_ORDER"
  | "INVOICE"
  | "OTHER";

interface ProcurementDocument {
  id: string;
  documentType: SchoolProcurementDocumentType;
  filename: string;
  originalName: string;
  createdAt: string;
  uploadedByUserId: string;
}

interface AuditLog {
  id: string;
  previousStatus: string | null;
  newStatus: string;
  changedAt: string;
  note: string | null;
}

interface BillingRecord {
  id: string;
  billingStatus: SchoolBillingStatus;
  pricePerStudentCents: number | null;
  enrollmentCount: number | null;
  verifiedEnrollment: number | null;
  contractAmountCents: number | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  billingContactName: string | null;
  billingContactEmail: string | null;
  billingContactPhone: string | null;
  purchaseOrderNumber: string | null;
  invoiceNumber: string | null;
  paymentStatus: string | null;
  documents: ProcurementDocument[];
  auditLogs: AuditLog[];
}

interface SchoolBillingSummary {
  id: string;
  name: string;
  billingStatus: SchoolBillingStatus;
  accessStatus: SchoolAccessStatus;
  pilotExpiresAt: string | null;
  billingRecord: BillingRecord | null;
  quoteRequests: Array<{ id: string; enrollment: number; estimatedAnnualCents: number | null; createdAt: string }>;
  pricingConfig: { pricePerStudentCents: number; annualMinimumCents: number };
}

// ── Timeline steps ──────────────────────────────────────────────────────────

const TIMELINE_STEPS: Array<{ statuses: SchoolBillingStatus[]; label: string }> = [
  { statuses: ["QUOTE_REQUESTED"],          label: "Quote requested" },
  { statuses: ["QUOTE_IN_REVIEW"],          label: "Quote prepared" },
  { statuses: ["QUOTE_SENT"],               label: "Quote sent" },
  { statuses: ["PRIVACY_REVIEW", "SECURITY_REVIEW"], label: "Privacy & security review" },
  { statuses: ["CONTRACT_REVIEW", "AWAITING_SIGNATURE"], label: "Agreement review & signature" },
  { statuses: ["AWAITING_PURCHASE_ORDER", "PURCHASE_ORDER_RECEIVED"], label: "Purchase order" },
  { statuses: ["INVOICED", "PAYMENT_PENDING"], label: "Invoice issued" },
  { statuses: ["ACTIVE"],                   label: "Account active" },
];

const TERMINAL_STATUSES: SchoolBillingStatus[] = ["DECLINED", "EXPIRED"];

function stepState(step: typeof TIMELINE_STEPS[0], current: SchoolBillingStatus): "completed" | "current" | "upcoming" {
  if (TERMINAL_STATUSES.includes(current)) return "upcoming";

  const allStatuses = TIMELINE_STEPS.flatMap((s) => s.statuses);
  const currentIdx = allStatuses.indexOf(current);
  const stepStatuses = step.statuses;

  if (currentIdx < 0) return "upcoming";
  const stepLastIdx = Math.max(...stepStatuses.map((s) => allStatuses.indexOf(s)));

  if (current === "ACTIVE" && step.statuses.includes("ACTIVE")) return "completed";
  if (stepLastIdx < currentIdx) return "completed";
  if (stepStatuses.includes(current)) return "current";
  return "upcoming";
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function cents(n: number): string {
  return `$${(n / 100).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

const STATUS_LABELS: Partial<Record<SchoolBillingStatus, string>> = {
  NONE:                    "Not started",
  QUOTE_REQUESTED:         "Quote requested",
  QUOTE_IN_REVIEW:         "Under review",
  QUOTE_SENT:              "Quote sent",
  PRIVACY_REVIEW:          "Privacy review",
  SECURITY_REVIEW:         "Security review",
  CONTRACT_REVIEW:         "Contract review",
  AWAITING_SIGNATURE:      "Awaiting signature",
  AWAITING_PURCHASE_ORDER: "Awaiting purchase order",
  PURCHASE_ORDER_RECEIVED: "Purchase order received",
  INVOICED:                "Invoice issued",
  PAYMENT_PENDING:         "Payment pending",
  ACTIVE:                  "Active",
  PAST_DUE:                "Past due",
  EXPIRED:                 "Expired",
  DECLINED:                "Declined",
};

const DOC_TYPE_LABELS: Record<SchoolProcurementDocumentType, string> = {
  QUOTE:                    "Quote",
  SERVICE_AGREEMENT:        "Service agreement",
  DATA_PRIVACY_AGREEMENT:   "Data privacy agreement",
  SECURITY_DOCUMENT:        "Security documentation",
  W9:                       "W-9",
  CERTIFICATE_OF_INSURANCE: "Certificate of insurance",
  PURCHASE_ORDER:           "Purchase order",
  INVOICE:                  "Invoice",
  OTHER:                    "Other",
};

const UPLOAD_ALLOWED_STATUSES: SchoolBillingStatus[] = [
  "AWAITING_SIGNATURE",
  "CONTRACT_REVIEW",
  "AWAITING_PURCHASE_ORDER",
  "PURCHASE_ORDER_RECEIVED",
  "PRIVACY_REVIEW",
  "SECURITY_REVIEW",
];

// ── Main component ──────────────────────────────────────────────────────────

export function SchoolBilling({ schoolId }: { schoolId: string }) {
  const [summary, setSummary] = useState<SchoolBillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSummary = () => {
    setLoading(true);
    api.get<SchoolBillingSummary>(`/school-procurement/${schoolId}/summary`)
      .then(setSummary)
      .catch((err: any) => setError(err.message || "Failed to load procurement status"))
      .finally(() => setLoading(false));
  };

  useEffect(loadSummary, [schoolId]);

  if (loading) return <div className="text-[var(--text-sec)] text-sm">Loading procurement information...</div>;
  if (error) return (
    <div className="p-3 bg-[var(--er-bg)] border border-[var(--er-b)] rounded-[2px] text-sm text-[var(--er-t)]">{error}</div>
  );
  if (!summary) return null;

  const hasActiveRecord = summary.billingStatus !== "NONE" && summary.billingStatus !== null;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold text-[var(--text)] text-[17px]">School Plan &amp; Procurement</h2>
        {summary.accessStatus === "ACTIVE" && (
          <span className="text-xs font-semibold bg-[var(--ok-bg)] text-[var(--ok-t)] border border-[var(--ok-b)] px-2 py-0.5 rounded-full">
            Active
          </span>
        )}
        {summary.accessStatus === "PILOT" && (
          <span className="text-xs font-semibold bg-[var(--wn-bg)] text-[var(--wn-t)] border border-[var(--wn-b)] px-2 py-0.5 rounded-full">
            Pilot{summary.pilotExpiresAt ? ` · expires ${fmtDate(summary.pilotExpiresAt)}` : ""}
          </span>
        )}
        {summary.accessStatus === "SUSPENDED" && (
          <span className="text-xs font-semibold bg-[var(--er-bg)] text-[var(--er-t)] border border-[var(--er-b)] px-2 py-0.5 rounded-full">
            Suspended
          </span>
        )}
      </div>

      {!hasActiveRecord ? (
        <QuoteRequestState summary={summary} schoolId={schoolId} onSubmitted={loadSummary} />
      ) : (
        <ProcurementStatusState summary={summary} schoolId={schoolId} onRefresh={loadSummary} />
      )}
    </div>
  );
}

// ── State 1: Request a quote ─────────────────────────────────────────────────

function QuoteRequestState({
  summary,
  schoolId,
  onSubmitted,
}: {
  summary: SchoolBillingSummary;
  schoolId: string;
  onSubmitted: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    schoolName: summary.name,
    districtName: "",
    schoolWebsite: "",
    schoolAddress: "",
    schoolState: "",
    enrollment: "",
    gradeLevels: "",
    primaryContactName: "",
    primaryContactTitle: "",
    primaryContactEmail: "",
    primaryContactPhone: "",
    billingContactName: "",
    billingContactEmail: "",
    billingContactPhone: "",
    billingAddress: "",
    purchaseOrderRequired: false,
    vendorRegistrationRequired: false,
    w9Required: false,
    certificateOfInsuranceRequired: false,
    dataPrivacyAgreementRequired: false,
    preferredStartDate: "",
    procurementNotes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const { pricePerStudentCents, annualMinimumCents } = summary.pricingConfig;
  const enrollNum = parseInt(form.enrollment, 10);
  const estimatedCents = !isNaN(enrollNum) && enrollNum > 0
    ? Math.max(enrollNum * pricePerStudentCents, annualMinimumCents)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError("");
    try {
      await api.post(`/school-procurement/${schoolId}/quote-request`, {
        ...form,
        enrollment: parseInt(form.enrollment, 10),
        preferredStartDate: form.preferredStartDate || undefined,
        schoolWebsite: form.schoolWebsite || undefined,
        billingContactEmail: form.billingContactEmail || undefined,
      });
      onSubmitted();
    } catch (err: any) {
      setSubmitError(err.message || "Failed to submit quote request.");
      setSubmitting(false);
    }
  };

  const field = (label: string, key: keyof typeof form, opts?: { type?: string; required?: boolean; placeholder?: string }) => (
    <div>
      <label className="block text-sm font-medium text-[var(--text)] mb-1">
        {label}{opts?.required && <span className="text-[var(--er-t)] ml-0.5">*</span>}
      </label>
      <input
        type={opts?.type ?? "text"}
        required={opts?.required}
        placeholder={opts?.placeholder}
        value={form[key] as string}
        onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
        className="w-full px-3 py-[7px] border border-[var(--border-s)] rounded-[2px] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--action)]"
      />
    </div>
  );

  const check = (label: string, key: keyof typeof form) => (
    <label className="flex items-center gap-2 text-sm text-[var(--text)] cursor-pointer">
      <input
        type="checkbox"
        checked={form[key] as boolean}
        onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.checked }))}
        className="rounded border-[var(--border-s)]"
      />
      {label}
    </label>
  );

  return (
    <div className="space-y-6">
      {/* Hero card */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-6">
        <h3 className="font-semibold text-[var(--text)] text-[16px] mb-2">Bring GoodHours to Your School</h3>
        <div className="space-y-2 text-sm text-[var(--text-sec)] mb-5">
          <p>GoodHours is purchased through an annual school or district agreement, not a consumer subscription.</p>
          <p>Pricing is based on enrolled students. The current founding rate is <strong className="text-[var(--text)]">{cents(pricePerStudentCents)} per student annually</strong>, with a <strong className="text-[var(--text)]">{cents(annualMinimumCents)} annual minimum</strong>.</p>
          <p>A final written quote is provided before any commitment. No card is required to request a quote.</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mb-5 p-4 bg-[var(--surface-alt)] border border-[var(--border)] rounded-[2px]">
          <div className="text-center">
            <div className="text-[20px] font-bold text-[var(--text)]">{cents(pricePerStudentCents)}</div>
            <div className="text-xs text-[var(--text-sec)] mt-0.5">per student / year</div>
          </div>
          <div className="text-center">
            <div className="text-[20px] font-bold text-[var(--text)]">{cents(annualMinimumCents)}</div>
            <div className="text-xs text-[var(--text-sec)] mt-0.5">annual minimum</div>
          </div>
          <div className="text-center">
            <div className="text-[20px] font-bold text-[var(--text)]">Annual</div>
            <div className="text-xs text-[var(--text-sec)] mt-0.5">contract term</div>
          </div>
        </div>

        {!showForm ? (
          <div className="flex flex-col sm:flex-row gap-3 items-start">
            <button
              onClick={() => setShowForm(true)}
              className="px-5 py-2 bg-[var(--action)] text-white rounded-[2px] text-sm font-semibold hover:opacity-85"
            >
              Request a Quote
            </button>
            <div className="text-sm text-[var(--text-faint)] pt-1">
              Already working with GoodHours?{" "}
              <a href="mailto:schools@goodhours.app" className="text-[var(--action)] hover:underline">
                Contact your representative
              </a>
            </div>
          </div>
        ) : null}
      </div>

      {/* Quote request form */}
      {showForm && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-medium text-[var(--text)]">Request a Quote</h3>
            <button onClick={() => setShowForm(false)} className="text-[var(--text-faint)] hover:text-[var(--text)] text-lg leading-none">×</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* School information */}
            <section>
              <h4 className="text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-3">School Information</h4>
              <div className="grid sm:grid-cols-2 gap-4">
                {field("School name", "schoolName", { required: true })}
                {field("District name", "districtName")}
                {field("School website", "schoolWebsite", { type: "url", placeholder: "https://" })}
                {field("School address", "schoolAddress")}
                {field("State", "schoolState")}
                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-1">
                    Approximate student enrollment <span className="text-[var(--er-t)]">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={100000}
                    value={form.enrollment}
                    onChange={(e) => setForm((p) => ({ ...p, enrollment: e.target.value }))}
                    className="w-full px-3 py-[7px] border border-[var(--border-s)] rounded-[2px] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--action)]"
                  />
                </div>
                {field("Grade levels served", "gradeLevels", { placeholder: "e.g. 9–12, K–12" })}
              </div>

              {/* Live estimate */}
              {estimatedCents !== null && (
                <div className="mt-4 p-3 bg-[var(--in-bg)] border border-[var(--in-b)] rounded-[2px]">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--in-t)]">Estimated annual price</span>
                    <span className="text-[18px] font-bold text-[var(--in-t)]">{cents(estimatedCents)}</span>
                  </div>
                  <p className="text-xs text-[var(--in-t)] opacity-80 mt-1">
                    Final pricing is confirmed in your written quote. This estimate uses {cents(pricePerStudentCents)}/student
                    with a {cents(annualMinimumCents)} minimum.
                  </p>
                </div>
              )}
            </section>

            {/* Primary contact */}
            <section>
              <h4 className="text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-3">Primary Contact</h4>
              <div className="grid sm:grid-cols-2 gap-4">
                {field("Name", "primaryContactName", { required: true })}
                {field("Job title", "primaryContactTitle")}
                {field("Work email", "primaryContactEmail", { required: true, type: "email" })}
                {field("Phone number", "primaryContactPhone", { type: "tel" })}
              </div>
            </section>

            {/* Billing contact */}
            <section>
              <h4 className="text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-3">Billing Contact</h4>
              <p className="text-xs text-[var(--text-faint)] mb-3">Leave blank if the same as the primary contact.</p>
              <div className="grid sm:grid-cols-2 gap-4">
                {field("Name", "billingContactName")}
                {field("Email", "billingContactEmail", { type: "email" })}
                {field("Phone", "billingContactPhone", { type: "tel" })}
                {field("Billing address", "billingAddress")}
              </div>
            </section>

            {/* Procurement requirements */}
            <section>
              <h4 className="text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-3">Procurement Requirements</h4>
              <div className="grid sm:grid-cols-2 gap-3">
                {check("Purchase order required", "purchaseOrderRequired")}
                {check("Vendor registration required", "vendorRegistrationRequired")}
                {check("W-9 required", "w9Required")}
                {check("Certificate of insurance required", "certificateOfInsuranceRequired")}
                {check("Student data privacy agreement required", "dataPrivacyAgreementRequired")}
              </div>
              <div className="mt-4 grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-1">Preferred contract start date</label>
                  <input
                    type="date"
                    value={form.preferredStartDate}
                    onChange={(e) => setForm((p) => ({ ...p, preferredStartDate: e.target.value }))}
                    className="w-full px-3 py-[7px] border border-[var(--border-s)] rounded-[2px] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--action)]"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-[var(--text)] mb-1">Additional procurement notes</label>
                <textarea
                  rows={3}
                  value={form.procurementNotes}
                  onChange={(e) => setForm((p) => ({ ...p, procurementNotes: e.target.value }))}
                  placeholder="Vendor portal URLs, special requirements, etc."
                  className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--action)]"
                />
              </div>
            </section>

            {submitError && (
              <div className="p-3 bg-[var(--er-bg)] border border-[var(--er-b)] rounded-[2px] text-sm text-[var(--er-t)]">{submitError}</div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-[var(--action)] text-white rounded-[2px] text-sm font-semibold hover:opacity-85 disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit Quote Request"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-[var(--border-s)] text-[var(--text)] rounded-[2px] text-sm hover:bg-[var(--surface-alt)]"
              >
                Cancel
              </button>
            </div>
            <p className="text-xs text-[var(--text-faint)]">
              Submitting this form will not activate school access. Our team will review your request and be in touch within 2 business days.
            </p>
          </form>
        </div>
      )}
    </div>
  );
}

// ── State 2: Procurement status ──────────────────────────────────────────────

function ProcurementStatusState({
  summary,
  schoolId,
  onRefresh,
}: {
  summary: SchoolBillingSummary;
  schoolId: string;
  onRefresh: () => void;
}) {
  const rec = summary.billingRecord;
  const status = summary.billingStatus as SchoolBillingStatus;
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadDocType, setUploadDocType] = useState<SchoolProcurementDocumentType>("OTHER");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const canUpload = UPLOAD_ALLOWED_STATUSES.includes(status);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    setUploadSuccess("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("documentType", uploadDocType);
      await api.post(`/school-procurement/${schoolId}/documents`, fd);
      setUploadSuccess(`${file.name} uploaded successfully.`);
      onRefresh();
    } catch (err: any) {
      setUploadError(err.message || "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDownloadDoc = (docId: string, originalName: string) => {
    const token = localStorage.getItem("token");
    const url = `/api/school-procurement/${schoolId}/documents/${docId}`;
    const a = document.createElement("a");
    a.href = url;
    a.setAttribute("download", originalName);
    // Use fetch to attach auth header
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const burl = URL.createObjectURL(blob);
        a.href = burl;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(burl);
        document.body.removeChild(a);
      });
  };

  return (
    <div className="space-y-6">
      {/* Status summary card */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-medium text-[var(--text)]">Procurement Status</h3>
            <p className="text-sm text-[var(--text-sec)] mt-0.5">{summary.name}</p>
          </div>
          <StatusBadge status={status} />
        </div>

        {/* Contract details grid */}
        {rec && (
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm mb-4">
            {rec.verifiedEnrollment != null && (
              <Detail label="Contracted enrollment" value={rec.verifiedEnrollment.toLocaleString()} />
            )}
            {rec.pricePerStudentCents != null && (
              <Detail label="Price per student" value={cents(rec.pricePerStudentCents) + "/year"} />
            )}
            {rec.contractAmountCents != null && (
              <Detail label="Annual contract" value={cents(rec.contractAmountCents)} />
            )}
            {rec.contractStartDate && (
              <Detail label="Contract start" value={fmtDate(rec.contractStartDate)} />
            )}
            {rec.contractEndDate && (
              <Detail label="Contract expiration" value={fmtDate(rec.contractEndDate)} />
            )}
            {rec.billingContactName && (
              <Detail label="Billing contact" value={`${rec.billingContactName}${rec.billingContactEmail ? ` · ${rec.billingContactEmail}` : ""}`} />
            )}
            {rec.purchaseOrderNumber && (
              <Detail label="Purchase order #" value={rec.purchaseOrderNumber} />
            )}
            {rec.invoiceNumber && (
              <Detail label="Invoice #" value={rec.invoiceNumber} />
            )}
            {rec.paymentStatus && (
              <Detail label="Payment status" value={rec.paymentStatus} />
            )}
          </div>
        )}

        {status === "PAST_DUE" && (
          <div className="p-3 bg-[var(--er-bg)] border border-[var(--er-b)] rounded-[2px] text-sm text-[var(--er-t)]">
            Your account is past due. Please contact your GoodHours representative.
          </div>
        )}
        {status === "DECLINED" && (
          <div className="p-3 bg-[var(--er-bg)] border border-[var(--er-b)] rounded-[2px] text-sm text-[var(--er-t)]">
            This quote request was declined. Contact{" "}
            <a href="mailto:schools@goodhours.app" className="underline">schools@goodhours.app</a> with any questions.
          </div>
        )}

        <div className="pt-3 border-t border-[var(--border)] mt-3">
          <a href="mailto:schools@goodhours.app" className="text-sm text-[var(--action)] hover:underline">
            Contact GoodHours
          </a>
        </div>
      </div>

      {/* Procurement timeline */}
      {!TERMINAL_STATUSES.includes(status) && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-6">
          <h3 className="font-medium text-[var(--text)] mb-4">Procurement Progress</h3>
          <div className="space-y-0">
            {TIMELINE_STEPS.map((step, i) => {
              const state = stepState(step, status);
              return (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      state === "completed" ? "bg-[var(--ok-t)] border-[var(--ok-t)]" :
                      state === "current"   ? "bg-[var(--action)] border-[var(--action)]" :
                                             "bg-white border-[var(--border-s)]"
                    }`}>
                      {state === "completed" && <span className="text-white text-[10px]">✓</span>}
                      {state === "current" && <span className="w-2 h-2 rounded-full bg-white block" />}
                    </div>
                    {i < TIMELINE_STEPS.length - 1 && (
                      <div className={`w-0.5 h-7 mt-0.5 ${state === "completed" ? "bg-[var(--ok-t)]" : "bg-[var(--border)]"}`} />
                    )}
                  </div>
                  <div className="pb-6">
                    <p className={`text-sm font-medium ${
                      state === "current"   ? "text-[var(--action)]" :
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
        </div>
      )}

      {/* Documents */}
      {rec && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-6">
          <h3 className="font-medium text-[var(--text)] mb-4">Procurement Documents</h3>

          {rec.documents.length === 0 && !canUpload && (
            <p className="text-sm text-[var(--text-faint)]">No documents on file yet.</p>
          )}

          {rec.documents.length > 0 && (
            <div className="space-y-2 mb-4">
              {rec.documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0 text-sm">
                  <div>
                    <span className="font-medium text-[var(--text)]">{doc.originalName}</span>
                    <span className="ml-2 text-xs text-[var(--text-faint)]">
                      {DOC_TYPE_LABELS[doc.documentType as SchoolProcurementDocumentType] ?? doc.documentType}
                      {" · "}
                      {fmtDate(doc.createdAt)}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDownloadDoc(doc.id, doc.originalName)}
                    className="text-xs text-[var(--action)] hover:underline"
                  >
                    Download
                  </button>
                </div>
              ))}
            </div>
          )}

          {canUpload && (
            <div className="space-y-3 border-t border-[var(--border)] pt-4">
              <h4 className="text-sm font-medium text-[var(--text)]">Upload Document</h4>
              {uploadSuccess && (
                <div className="p-2 bg-[var(--ok-bg)] border border-[var(--ok-b)] rounded-[2px] text-xs text-[var(--ok-t)]">{uploadSuccess}</div>
              )}
              {uploadError && (
                <div className="p-2 bg-[var(--er-bg)] border border-[var(--er-b)] rounded-[2px] text-xs text-[var(--er-t)]">{uploadError}</div>
              )}
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="block text-xs font-medium text-[var(--text)] mb-1">Document type</label>
                  <select
                    value={uploadDocType}
                    onChange={(e) => setUploadDocType(e.target.value as SchoolProcurementDocumentType)}
                    className="px-3 py-[7px] border border-[var(--border-s)] rounded-[2px] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--action)]"
                  >
                    {(Object.keys(DOC_TYPE_LABELS) as SchoolProcurementDocumentType[]).map((t) => (
                      <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text)] mb-1">File (PDF, Word, or image, max 20 MB)</label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.tiff"
                    onChange={handleUpload}
                    disabled={uploading}
                    className="text-sm"
                  />
                </div>
              </div>
              {uploading && <p className="text-xs text-[var(--text-faint)]">Uploading...</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Small helpers ────────────────────────────────────────────────────────────

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[var(--text-faint)] uppercase tracking-wide text-[11px] font-semibold block mb-0.5">{label}</span>
      <span className="text-[var(--text)] font-medium">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: SchoolBillingStatus }) {
  const label = STATUS_LABELS[status] ?? status;
  const colorClass =
    status === "ACTIVE"                ? "bg-[var(--ok-bg)] text-[var(--ok-t)] border-[var(--ok-b)]" :
    status === "PAST_DUE"              ? "bg-[var(--er-bg)] text-[var(--er-t)] border-[var(--er-b)]" :
    status === "DECLINED"              ? "bg-[var(--er-bg)] text-[var(--er-t)] border-[var(--er-b)]" :
    status === "EXPIRED"               ? "bg-[var(--er-bg)] text-[var(--er-t)] border-[var(--er-b)]" :
    status === "QUOTE_REQUESTED"       ? "bg-[var(--in-bg)] text-[var(--in-t)] border-[var(--in-b)]" :
                                         "bg-[var(--wn-bg)] text-[var(--wn-t)] border-[var(--wn-b)]";
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${colorClass}`}>{label}</span>
  );
}
