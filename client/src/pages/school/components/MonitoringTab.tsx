import { useEffect, useMemo, useState } from "react";
import { api, getErrorMessage } from "../../../lib/api";
import { useAuth } from "../../../hooks/useAuth";
import type { LaunchWorkspace, ReminderSummary, MonitoringForm } from "./types";
import { MetricCard, formatDate } from "./types";

interface InternalInvoiceRequest {
  id: string;
  status: string;
  legalName: string;
  address: string;
  billingContactName: string;
  billingContactEmail: string;
  purchaseOrderRequired: boolean;
  taxExempt: boolean;
  preferredPaymentMethod: string | null;
  additionalNotes: string | null;
  internalNotes?: string | null;
  quoteAmountCents?: number | null;
  quoteSentAt?: string | null;
  invoiceNumber?: string | null;
  invoiceSentAt?: string | null;
  paidAt?: string | null;
  rejectedReason?: string | null;
  lastContactedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  ownerUser?: {
    id: string;
    name: string;
    email: string;
  } | null;
  beneficiary: {
    id: string;
    name: string;
    email: string | null;
    planTier: "FREE" | "PRO" | null;
  };
  auditLogs?: Array<{
    id: string;
    previousStatus: string | null;
    newStatus: string;
    subject?: string | null;
    entryType?: string;
    visibleToCustomer?: boolean;
    note: string | null;
    changedAt: string;
    changedByUser: {
      id: string;
      name: string;
      email: string;
    };
  }>;
  artifacts?: Array<{
    id: string;
    documentType: string;
    originalName: string;
    mimeType: string;
    fileSizeBytes: number;
    createdAt: string;
    uploadedByUser: {
      id: string;
      name: string;
      email: string;
    };
  }>;
}

interface InternalInvoiceRequestDraft {
  internalNotes: string;
  quoteAmountCents: string;
  invoiceNumber: string;
  rejectedReason: string;
  auditNote: string;
  contactSubject: string;
  contactMessage: string;
  ownerUserId: string;
}

interface InternalOperator {
  id: string;
  name: string;
  email: string;
}

type InternalInvoiceRequestStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "INVOICE_SENT"
  | "PAID"
  | "REJECTED"
  | "CANCELLED";

const INTERNAL_INVOICE_STATUS_LABELS: Record<InternalInvoiceRequestStatus, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  APPROVED: "Approved",
  INVOICE_SENT: "Invoice Sent",
  PAID: "Paid",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

const INTERNAL_INVOICE_STATUS_ACTIONS: Record<InternalInvoiceRequestStatus, InternalInvoiceRequestStatus[]> = {
  SUBMITTED: ["UNDER_REVIEW", "APPROVED", "REJECTED", "CANCELLED"],
  UNDER_REVIEW: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["INVOICE_SENT", "PAID", "REJECTED", "CANCELLED"],
  INVOICE_SENT: ["PAID", "CANCELLED"],
  PAID: [],
  REJECTED: [],
  CANCELLED: [],
};

function invoiceStatusClasses(status: string): string {
  switch (status) {
    case "PAID":
    case "APPROVED":
      return "bg-[var(--ok-bg)] text-[var(--ok-t)] border-[var(--ok-b)]";
    case "REJECTED":
    case "CANCELLED":
      return "bg-[var(--er-bg)] text-[var(--er-t)] border-[var(--er-b)]";
    case "INVOICE_SENT":
    case "UNDER_REVIEW":
      return "bg-[var(--wn-bg)] text-[var(--wn-t)] border-[var(--wn-b)]";
    default:
      return "bg-[var(--in-bg)] text-[var(--action)] border-[var(--in-b)]";
  }
}

function formatCurrencyInput(cents: string): string {
  const value = Number(cents);
  if (!Number.isFinite(value) || value < 0) return "Pending";
  return `$${(value / 100).toFixed(2)}`;
}

function formatArtifactBytes(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${bytes} B`;
}

export default function MonitoringTab({ workspace, onUpdate }: { workspace: LaunchWorkspace; onUpdate: (data: LaunchWorkspace) => void }) {
  const { user } = useAuth();
  const [monitoringForm, setMonitoringForm] = useState<MonitoringForm>({
    launchStartDate: workspace.plan.firstUserMonitoring.launchStartDate ?? "",
    checkCadence: workspace.plan.firstUserMonitoring.checkCadence,
    activeStudentTarget: String(workspace.plan.firstUserMonitoring.activeStudentTarget),
    watchList: workspace.plan.firstUserMonitoring.watchList.join(", "),
    notes: workspace.plan.firstUserMonitoring.notes ?? "",
  });
  const [savingMonitoring, setSavingMonitoring] = useState(false);
  const [monitoringMessage, setMonitoringMessage] = useState("");
  const [runningReminders, setRunningReminders] = useState(false);
  const [latestReminderSummary, setLatestReminderSummary] = useState<ReminderSummary | null>(null);
  const [invoiceRequests, setInvoiceRequests] = useState<InternalInvoiceRequest[]>([]);
  const [loadingInvoiceRequests, setLoadingInvoiceRequests] = useState(false);
  const [updatingInvoiceRequestId, setUpdatingInvoiceRequestId] = useState<string | null>(null);
  const [invoiceQueueMessage, setInvoiceQueueMessage] = useState("");
  const [invoiceDrafts, setInvoiceDrafts] = useState<Record<string, InternalInvoiceRequestDraft>>({});
  const [internalOperators, setInternalOperators] = useState<InternalOperator[]>([]);

  const targetProgress = useMemo(() => {
    const target = Number(monitoringForm.activeStudentTarget) || workspace.plan.firstUserMonitoring.activeStudentTarget;
    return Math.min(100, Math.round((workspace.metrics.studentsWithHours / Math.max(1, target)) * 100));
  }, [monitoringForm.activeStudentTarget, workspace]);

  useEffect(() => {
    queueMicrotask(() => setMonitoringForm({
      launchStartDate: workspace.plan.firstUserMonitoring.launchStartDate ?? "",
      checkCadence: workspace.plan.firstUserMonitoring.checkCadence,
      activeStudentTarget: String(workspace.plan.firstUserMonitoring.activeStudentTarget),
      watchList: workspace.plan.firstUserMonitoring.watchList.join(", "),
      notes: workspace.plan.firstUserMonitoring.notes ?? "",
    }));
  }, [workspace]);

  const loadInvoiceRequests = async () => {
    setLoadingInvoiceRequests(true);
    try {
      const data = await api.get<{ requests: InternalInvoiceRequest[] }>("/billing/organizations/internal/invoice-requests?limit=10");
      setInvoiceRequests(data.requests || []);
      setInvoiceDrafts(
        Object.fromEntries(
          (data.requests || []).map((request) => [
            request.id,
            {
              internalNotes: request.internalNotes || "",
              quoteAmountCents: request.quoteAmountCents != null ? String(request.quoteAmountCents) : "",
              invoiceNumber: request.invoiceNumber || "",
              rejectedReason: request.rejectedReason || "",
              auditNote: "",
              contactSubject: "",
              contactMessage: "",
              ownerUserId: request.ownerUser?.id || "",
            },
          ])
        )
      );
    } catch {
      setInvoiceRequests([]);
    } finally {
      setLoadingInvoiceRequests(false);
    }
  };

  useEffect(() => {
    if (!user?.isInternalAdmin) return;
    queueMicrotask(() => { void loadInvoiceRequests(); });
  }, [user?.isInternalAdmin]);

  useEffect(() => {
    if (!user?.isInternalAdmin) return;
    api.get<{ operators: InternalOperator[] }>("/billing/organizations/internal/operators")
      .then((data) => setInternalOperators(data.operators || []))
      .catch(() => setInternalOperators([]));
  }, [user?.isInternalAdmin]);

  const handleSaveMonitoring = async () => {
    setSavingMonitoring(true);
    setMonitoringMessage("");
    try {
      const data = await api.put<LaunchWorkspace>("/schools/launch", {
        firstUserMonitoring: {
          launchStartDate: monitoringForm.launchStartDate,
          checkCadence: monitoringForm.checkCadence,
          activeStudentTarget: Number(monitoringForm.activeStudentTarget) || 10,
          watchList: monitoringForm.watchList.split(",").map((p) => p.trim()).filter(Boolean),
          notes: monitoringForm.notes,
        },
      });
      onUpdate(data);
      setMonitoringMessage("Monitoring plan saved.");
    } catch (err: unknown) {
      setMonitoringMessage(getErrorMessage(err, "Failed to save monitoring plan."));
    } finally {
      setSavingMonitoring(false);
    }
  };

  const handleRunReminders = async () => {
    setRunningReminders(true);
    setMonitoringMessage("");
    try {
      const summary = await api.post<ReminderSummary | null>("/messages/reminders/run", {});
      setLatestReminderSummary(summary);
      setMonitoringMessage("Reminder cycle completed.");
    } catch (err: unknown) {
      setMonitoringMessage(getErrorMessage(err, "Failed to run reminders."));
    } finally {
      setRunningReminders(false);
    }
  };

  const handleInvoiceStatusUpdate = async (requestId: string, status: InternalInvoiceRequestStatus) => {
    setUpdatingInvoiceRequestId(requestId);
    setInvoiceQueueMessage("");
    try {
      const draft = invoiceDrafts[requestId];
      const updated = await api.patch<InternalInvoiceRequest>(`/billing/organizations/internal/invoice-requests/${requestId}`, {
        status,
        auditNote: draft?.auditNote?.trim() || undefined,
        rejectedReason: status === "REJECTED" ? draft?.rejectedReason?.trim() || null : undefined,
      });
      setInvoiceRequests((current) =>
        current.map((request) => (request.id === requestId ? updated : request))
      );
      setInvoiceDrafts((current) => ({
        ...current,
        [requestId]: {
          internalNotes: updated.internalNotes || "",
          quoteAmountCents: updated.quoteAmountCents != null ? String(updated.quoteAmountCents) : "",
          invoiceNumber: updated.invoiceNumber || "",
          rejectedReason: updated.rejectedReason || "",
          auditNote: "",
          contactSubject: "",
          contactMessage: "",
          ownerUserId: updated.ownerUser?.id || "",
        },
      }));
      setInvoiceQueueMessage(`Request moved to ${INTERNAL_INVOICE_STATUS_LABELS[status]}.`);
    } catch (err: unknown) {
      setInvoiceQueueMessage(getErrorMessage(err, "Failed to update request status."));
    } finally {
      setUpdatingInvoiceRequestId(null);
    }
  };

  const updateInvoiceDraft = (requestId: string, patch: Partial<InternalInvoiceRequestDraft>) => {
    setInvoiceDrafts((current) => ({
      ...current,
      [requestId]: {
        ...(current[requestId] || {
          internalNotes: "",
          quoteAmountCents: "",
          invoiceNumber: "",
          rejectedReason: "",
          auditNote: "",
          contactSubject: "",
          contactMessage: "",
          ownerUserId: "",
        }),
        ...patch,
      },
    }));
  };

  const handleInvoiceRequestSave = async (requestId: string) => {
    const draft = invoiceDrafts[requestId];
    if (!draft) return;
    setUpdatingInvoiceRequestId(requestId);
    setInvoiceQueueMessage("");
    try {
      const updated = await api.patch<InternalInvoiceRequest>(`/billing/organizations/internal/invoice-requests/${requestId}`, {
        internalNotes: draft.internalNotes.trim() || null,
        quoteAmountCents: draft.quoteAmountCents.trim() ? Number(draft.quoteAmountCents) : null,
        invoiceNumber: draft.invoiceNumber.trim() || null,
        rejectedReason: draft.rejectedReason.trim() || null,
        auditNote: draft.auditNote.trim() || undefined,
      });
      setInvoiceRequests((current) => current.map((request) => (request.id === requestId ? updated : request)));
      setInvoiceDrafts((current) => ({
        ...current,
        [requestId]: {
          internalNotes: updated.internalNotes || "",
          quoteAmountCents: updated.quoteAmountCents != null ? String(updated.quoteAmountCents) : "",
          invoiceNumber: updated.invoiceNumber || "",
          rejectedReason: updated.rejectedReason || "",
          auditNote: "",
          contactSubject: "",
          contactMessage: "",
          ownerUserId: updated.ownerUser?.id || "",
        },
      }));
      setInvoiceQueueMessage("Request details saved.");
    } catch (err: unknown) {
      setInvoiceQueueMessage(getErrorMessage(err, "Failed to save request details."));
    } finally {
      setUpdatingInvoiceRequestId(null);
    }
  };

  const handleAssignOwner = async (requestId: string, ownerUserId: string | null) => {
    setUpdatingInvoiceRequestId(requestId);
    setInvoiceQueueMessage("");
    try {
      const updated = await api.patch<InternalInvoiceRequest>(`/billing/organizations/internal/invoice-requests/${requestId}`, {
        ownerUserId,
        auditNote: ownerUserId ? "Owner assigned in Launch Center" : "Owner cleared in Launch Center",
      });
      setInvoiceRequests((current) => current.map((request) => (request.id === requestId ? updated : request)));
      setInvoiceDrafts((current) => ({
        ...current,
        [requestId]: {
          ...(current[requestId] || {
            internalNotes: "",
            quoteAmountCents: "",
            invoiceNumber: "",
            rejectedReason: "",
            auditNote: "",
            contactSubject: "",
            contactMessage: "",
            ownerUserId: "",
          }),
          ownerUserId: updated.ownerUser?.id || "",
        },
      }));
      setInvoiceQueueMessage(ownerUserId ? "Request owner updated." : "Request owner cleared.");
    } catch (err: unknown) {
      setInvoiceQueueMessage(getErrorMessage(err, "Failed to update owner."));
    } finally {
      setUpdatingInvoiceRequestId(null);
    }
  };

  const handleArtifactUpload = async (requestId: string, file: File | null, documentType: string) => {
    if (!file) return;
    setUpdatingInvoiceRequestId(requestId);
    setInvoiceQueueMessage("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("documentType", documentType);
      const artifact = await api.post<NonNullable<InternalInvoiceRequest["artifacts"]>[number]>(
        `/billing/organizations/internal/invoice-requests/${requestId}/artifacts`,
        fd,
      );
      setInvoiceRequests((current) =>
        current.map((request) => request.id === requestId
          ? { ...request, artifacts: [artifact, ...(request.artifacts || [])] }
          : request)
      );
      setInvoiceQueueMessage(`${file.name} uploaded.`);
    } catch (err: unknown) {
      setInvoiceQueueMessage(getErrorMessage(err, "Failed to upload artifact."));
    } finally {
      setUpdatingInvoiceRequestId(null);
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

  const handleArtifactDelete = async (requestId: string, artifactId: string) => {
    setUpdatingInvoiceRequestId(requestId);
    setInvoiceQueueMessage("");
    try {
      await api.delete(`/billing/organizations/internal/invoice-requests/${requestId}/artifacts/${artifactId}`);
      setInvoiceRequests((current) =>
        current.map((request) =>
          request.id === requestId
            ? { ...request, artifacts: (request.artifacts || []).filter((artifact) => artifact.id !== artifactId) }
            : request
        )
      );
      setInvoiceQueueMessage("Artifact removed.");
    } catch (err: unknown) {
      setInvoiceQueueMessage(getErrorMessage(err, "Failed to remove artifact."));
    } finally {
      setUpdatingInvoiceRequestId(null);
    }
  };

  const handleSendCustomerUpdate = async (requestId: string) => {
    const draft = invoiceDrafts[requestId];
    if (!draft?.contactSubject.trim() || !draft?.contactMessage.trim()) return;
    setUpdatingInvoiceRequestId(requestId);
    setInvoiceQueueMessage("");
    try {
      const updated = await api.post<InternalInvoiceRequest>(`/billing/organizations/internal/invoice-requests/${requestId}/contact`, {
        subject: draft.contactSubject.trim(),
        message: draft.contactMessage.trim(),
        visibleToCustomer: true,
      });
      setInvoiceRequests((current) => current.map((request) => (request.id === requestId ? updated : request)));
      setInvoiceDrafts((current) => ({
        ...current,
        [requestId]: {
          ...(current[requestId] || draft),
          contactSubject: "",
          contactMessage: "",
        },
      }));
      setInvoiceQueueMessage("Customer update sent.");
    } catch (err: unknown) {
      setInvoiceQueueMessage(getErrorMessage(err, "Failed to send customer update."));
    } finally {
      setUpdatingInvoiceRequestId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Approved Partners" value={String(workspace.metrics.approvedPartners)} subtext={`${workspace.metrics.pendingPartners} pending`} />
        <MetricCard label="Published Cohorts" value={`${workspace.metrics.publishedCohorts}/${workspace.metrics.totalCohorts}`} subtext="published / total" />
        <MetricCard label="Invited Students" value={String(workspace.metrics.invitedStudents)} subtext={`${workspace.metrics.pendingInvites} pending invites`} />
        <MetricCard label="Students With Hours" value={String(workspace.metrics.studentsWithHours)} subtext={`${workspace.metrics.enrolledStudents} enrolled`} />
        <MetricCard label="Pending Review" value={String(workspace.metrics.pendingReviewCount)} subtext={`${workspace.metrics.pendingSelfSubmissions} self-submissions`} />
        <MetricCard label="Open Bugs" value={String(workspace.metrics.openBugCount)} subtext={`${workspace.metrics.criticalBugCount} critical`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr,1fr]">
        <div className="rounded-[3px] border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[16px] font-semibold text-[var(--text)]">First-user monitoring</h2>
              <p className="mt-1 text-sm text-[var(--text-sec)]">
                Watch the rollout funnel and keep the review queue small while the first student group goes live.
              </p>
            </div>
            <button
              onClick={handleRunReminders}
              disabled={runningReminders}
              className="rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-alt)] disabled:opacity-50"
            >
              {runningReminders ? "Running..." : "Run Reminders"}
            </button>
          </div>

          {monitoringMessage && (
            <div className="mt-4 rounded-[2px] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-sm text-[var(--text)]">
              {monitoringMessage}
            </div>
          )}

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[3px] border border-[var(--border)] p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-sec)]">Launch Window</div>
              <div className="mt-2 text-sm text-[var(--text)]">
                Start: <span className="font-medium">{formatDate(workspace.plan.firstUserMonitoring.launchStartDate)}</span>
              </div>
              <div className="mt-1 text-sm text-[var(--text)]">
                Cadence: <span className="font-medium">{workspace.plan.firstUserMonitoring.checkCadence.replace("_", " ")}</span>
              </div>
              <div className="mt-1 text-sm text-[var(--text)]">
                Target: <span className="font-medium">{workspace.plan.firstUserMonitoring.activeStudentTarget} students with hours</span>
              </div>
            </div>

            <div className="rounded-[3px] border border-[var(--border)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-sec)]">Target Progress</div>
                  <div className="mt-1 text-2xl font-semibold text-[var(--text)]">{targetProgress}%</div>
                </div>
                <div className="text-right text-sm text-[var(--text-sec)]">
                  {workspace.metrics.studentsWithHours} / {workspace.plan.firstUserMonitoring.activeStudentTarget}
                </div>
              </div>
              <div className="mt-3 h-2 rounded-full bg-[var(--surface-alt)]">
                <div className="h-2 rounded-full bg-[var(--action)]" style={{ width: `${targetProgress}%` }} />
              </div>
            </div>
          </div>

          {latestReminderSummary && (
            <div className="mt-5 rounded-[3px] border border-[var(--in-b)] bg-[var(--in-bg)] p-4">
              <div className="font-medium text-[var(--navy)]">Latest reminder run</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-5 text-center">
                <div>
                  <div className="text-[16px] font-semibold text-[var(--navy)]">{latestReminderSummary.deadlineReminders}</div>
                  <div className="text-xs text-[var(--action)]">Deadline reminders</div>
                </div>
                <div>
                  <div className="text-[16px] font-semibold text-[var(--navy)]">{latestReminderSummary.behindAlerts}</div>
                  <div className="text-xs text-[var(--action)]">Behind alerts</div>
                </div>
                <div>
                  <div className="text-[16px] font-semibold text-[var(--navy)]">{latestReminderSummary.adminAlerts}</div>
                  <div className="text-xs text-[var(--action)]">Admin alerts</div>
                </div>
                <div>
                  <div className="text-[16px] font-semibold text-[var(--navy)]">{latestReminderSummary.pendingReviewCount}</div>
                  <div className="text-xs text-[var(--action)]">Pending reviews</div>
                </div>
                <div>
                  <div className="text-[16px] font-semibold text-[var(--navy)]">{latestReminderSummary.atRiskStudents}</div>
                  <div className="text-xs text-[var(--action)]">At-risk students</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-[3px] border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-[16px] font-semibold text-[var(--text)]">Monitoring plan</h2>
          <p className="mt-1 text-sm text-[var(--text-sec)]">
            Persist the operating target and the people you want to watch most closely.
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text)]">Launch start date</label>
              <input
                type="date"
                aria-label="Launch start date"
                value={monitoringForm.launchStartDate}
                onChange={(e) => setMonitoringForm((current) => ({ ...current, launchStartDate: e.target.value }))}
                className="w-full rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text)]">Check cadence</label>
              <select
                aria-label="Check cadence"
                value={monitoringForm.checkCadence}
                onChange={(e) =>
                  setMonitoringForm((current) => ({
                    ...current,
                    checkCadence: e.target.value as MonitoringForm["checkCadence"],
                  }))
                }
                className="w-full rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm"
              >
                <option value="DAILY">Daily</option>
                <option value="TWICE_DAILY">Twice daily</option>
                <option value="WEEKDAYS">Weekdays only</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text)]">Students with hours target</label>
              <input
                type="number"
                min="1"
                aria-label="Students with hours target"
                value={monitoringForm.activeStudentTarget}
                onChange={(e) => setMonitoringForm((current) => ({ ...current, activeStudentTarget: e.target.value }))}
                className="w-full rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text)]">Watch list</label>
              <input
                type="text"
                aria-label="Watch list"
                value={monitoringForm.watchList}
                onChange={(e) => setMonitoringForm((current) => ({ ...current, watchList: e.target.value }))}
                placeholder="Student names or owners, comma-separated"
                className="w-full rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text)]">Monitoring notes</label>
              <textarea
                rows={5}
                aria-label="Monitoring notes"
                value={monitoringForm.notes}
                onChange={(e) => setMonitoringForm((current) => ({ ...current, notes: e.target.value }))}
                className="w-full rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={handleSaveMonitoring}
              disabled={savingMonitoring}
              className="rounded-[2px] bg-[var(--action)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--navy)] disabled:opacity-50"
            >
              {savingMonitoring ? "Saving..." : "Save First-User Monitoring"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Accepted Invites" value={String(workspace.metrics.acceptedInvites)} subtext={`${workspace.metrics.pendingInvites} still pending`} />
        <MetricCard label="Approved Hours" value={`${workspace.metrics.totalApprovedHours.toFixed(1)}h`} subtext={`${workspace.metrics.totalPendingHours.toFixed(1)}h pending`} />
        <MetricCard label="At-Risk Students" value={String(workspace.metrics.atRiskStudents)} subtext={`${workspace.metrics.completedStudents} completed`} />
        <MetricCard label="No-Shows" value={String(workspace.metrics.noShowCount)} subtext={`${workspace.metrics.pendingLegacyVerifications} legacy verifications pending`} />
      </div>

      {user?.isInternalAdmin && (
        <div className="rounded-[3px] border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[16px] font-semibold text-[var(--text)]">Organization Invoice Requests</h2>
              <p className="mt-1 text-sm text-[var(--text-sec)]">
                Internal queue for organizations that want quote, invoice, or purchase-order based billing.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => void loadInvoiceRequests()}
                disabled={loadingInvoiceRequests}
                className="rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-alt)] disabled:opacity-50"
              >
                {loadingInvoiceRequests ? "Refreshing..." : "Refresh Queue"}
              </button>
              <div className="text-sm text-[var(--text-sec)]">
                {loadingInvoiceRequests ? "Loading..." : `${invoiceRequests.length} recent`}
              </div>
            </div>
          </div>

          {invoiceQueueMessage && (
            <div className="mt-4 rounded-[2px] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-sm text-[var(--text)]">
              {invoiceQueueMessage}
            </div>
          )}

          <div className="mt-4 space-y-3">
            {loadingInvoiceRequests ? (
              <div className="text-sm text-[var(--text-sec)]">Loading invoice requests...</div>
            ) : invoiceRequests.length === 0 ? (
              <div className="rounded-[3px] border border-dashed border-[var(--border)] p-4 text-sm text-[var(--text-sec)]">
                No invoice requests yet.
              </div>
            ) : (
              invoiceRequests.map((request) => {
                const draft = invoiceDrafts[request.id] || {
                  internalNotes: "",
                  quoteAmountCents: "",
                  invoiceNumber: "",
                  rejectedReason: "",
                  auditNote: "",
                };

                return (
                  <div key={request.id} className="rounded-[3px] border border-[var(--border)] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[var(--text)]">{request.legalName}</div>
                        <div className="mt-1 text-xs text-[var(--text-sec)]">
                          {request.beneficiary.name}
                          {request.beneficiary.planTier ? ` · ${request.beneficiary.planTier}` : ""}
                          {request.beneficiary.email ? ` · ${request.beneficiary.email}` : ""}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold uppercase tracking-wide ${invoiceStatusClasses(request.status)}`}>
                          {INTERNAL_INVOICE_STATUS_LABELS[request.status as InternalInvoiceRequestStatus] ?? request.status}
                        </div>
                        <div className="mt-1 text-xs text-[var(--text-faint)]">{new Date(request.createdAt).toLocaleString()}</div>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-2 text-sm">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">Billing Contact</div>
                        <div className="mt-1 text-[var(--text)]">{request.billingContactName}</div>
                        <a href={`mailto:${request.billingContactEmail}`} className="text-[var(--action)] hover:underline">
                          {request.billingContactEmail}
                        </a>
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">Preferences</div>
                        <div className="mt-1 text-[var(--text)]">{request.preferredPaymentMethod || "No preferred method specified"}</div>
                        <div className="mt-1 text-xs text-[var(--text-sec)]">
                          {request.purchaseOrderRequired ? "Purchase order required" : "Purchase order not required"}
                          {" · "}
                          {request.taxExempt ? "Tax exempt" : "Not marked tax exempt"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">Owner</div>
                        <div className="mt-1 text-[var(--text)]">
                          {request.ownerUser ? `${request.ownerUser.name} · ${request.ownerUser.email}` : "Unassigned"}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 items-center">
                          <select
                            aria-label="Request owner"
                            value={draft.ownerUserId}
                            onChange={(e) => updateInvoiceDraft(request.id, { ownerUserId: e.target.value })}
                            className="rounded-[2px] border border-[var(--border-s)] px-3 py-1.5 text-xs"
                          >
                            <option value="">Unassigned</option>
                            {internalOperators.map((operator) => (
                              <option key={operator.id} value={operator.id}>
                                {operator.name} ({operator.email})
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => void handleAssignOwner(request.id, draft.ownerUserId || null)}
                            disabled={updatingInvoiceRequestId === request.id}
                            className="rounded-[2px] border border-[var(--border-s)] px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-alt)] disabled:opacity-50"
                          >
                            Save owner
                          </button>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">Commercials</div>
                        <div className="mt-1 text-[var(--text)]">
                          Quote {request.quoteAmountCents != null ? formatCurrencyInput(String(request.quoteAmountCents)) : "Pending"}
                        </div>
                        <div className="mt-1 text-xs text-[var(--text-sec)]">
                          Invoice {request.invoiceNumber || "Pending"}
                          {" · "}
                          {request.paidAt ? `Paid ${formatDate(request.paidAt)}` : "Not paid"}
                          {" · "}
                          {request.lastContactedAt ? `Last contacted ${formatDate(request.lastContactedAt)}` : "No recent outbound update"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 text-sm text-[var(--text-sec)]">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">Address</div>
                      <div className="mt-1">{request.address}</div>
                    </div>

                    {request.additionalNotes && (
                      <div className="mt-3 text-sm text-[var(--text-sec)]">
                        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">Requester Notes</div>
                        <div className="mt-1 whitespace-pre-wrap">{request.additionalNotes}</div>
                      </div>
                    )}

                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div className="space-y-3 rounded-[3px] border border-[var(--border)] p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">Internal Working Notes</div>
                        <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]" htmlFor={`internal-notes-${request.id}`}>
                          Internal notes
                        </label>
                        <textarea
                          id={`internal-notes-${request.id}`}
                          aria-label="Internal notes"
                          rows={4}
                          value={draft.internalNotes}
                          onChange={(e) => updateInvoiceDraft(request.id, { internalNotes: e.target.value })}
                          className="w-full rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm"
                        />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]" htmlFor={`quote-amount-${request.id}`}>Quote amount (cents)</label>
                            <input
                              id={`quote-amount-${request.id}`}
                              aria-label="Quote amount (cents)"
                              type="number"
                              min="0"
                              value={draft.quoteAmountCents}
                              onChange={(e) => updateInvoiceDraft(request.id, { quoteAmountCents: e.target.value })}
                              className="w-full rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]" htmlFor={`invoice-number-${request.id}`}>Invoice number</label>
                            <input
                              id={`invoice-number-${request.id}`}
                              aria-label="Invoice number"
                              type="text"
                              value={draft.invoiceNumber}
                              onChange={(e) => updateInvoiceDraft(request.id, { invoiceNumber: e.target.value })}
                              className="w-full rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]" htmlFor={`rejection-reason-${request.id}`}>Rejection reason</label>
                          <textarea
                            id={`rejection-reason-${request.id}`}
                            aria-label="Rejection reason"
                            rows={2}
                            value={draft.rejectedReason}
                            onChange={(e) => updateInvoiceDraft(request.id, { rejectedReason: e.target.value })}
                            className="w-full rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]" htmlFor={`audit-note-${request.id}`}>Audit note for next change</label>
                          <input
                            id={`audit-note-${request.id}`}
                            aria-label="Audit note for next change"
                            type="text"
                            value={draft.auditNote}
                            onChange={(e) => updateInvoiceDraft(request.id, { auditNote: e.target.value })}
                            className="w-full rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm"
                          />
                        </div>
                        <button
                          onClick={() => void handleInvoiceRequestSave(request.id)}
                          disabled={updatingInvoiceRequestId === request.id}
                          className="rounded-[2px] bg-[var(--action)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--navy)] disabled:opacity-50"
                        >
                          {updatingInvoiceRequestId === request.id ? "Saving..." : "Save Request Details"}
                        </button>
                      </div>

                      <div className="space-y-3 rounded-[3px] border border-[var(--border)] p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">Artifacts</div>
                        {request.artifacts?.length ? (
                          <div className="space-y-2">
                            {request.artifacts.map((artifact) => (
                              <div key={artifact.id} className="flex items-center justify-between rounded-[2px] border border-[var(--border)] px-3 py-2 text-sm">
                                <div>
                                  <div className="font-medium text-[var(--text)]">{artifact.originalName}</div>
                                  <div className="text-xs text-[var(--text-faint)]">
                                    {artifact.documentType} · {formatArtifactBytes(artifact.fileSizeBytes)} · {formatDate(artifact.createdAt)}
                                  </div>
                                </div>
                                <button
                                  onClick={() => void handleArtifactDownload(request.id, artifact.id, artifact.originalName)}
                                  className="text-[var(--action)] hover:underline"
                                >
                                  Download
                                </button>
                                <button
                                  onClick={() => void handleArtifactDelete(request.id, artifact.id)}
                                  className="text-[var(--er-t)] hover:underline ml-3"
                                >
                                  Delete
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-[var(--text-sec)]">No artifacts uploaded yet.</div>
                        )}
                        <div className="grid gap-3 sm:grid-cols-[180px,1fr]">
                          <select
                            defaultValue="QUOTE"
                            className="rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm"
                            id={`artifact-type-${request.id}`}
                          >
                            <option value="QUOTE">Quote</option>
                            <option value="INVOICE">Invoice</option>
                            <option value="PURCHASE_ORDER">Purchase Order</option>
                            <option value="W9">W-9</option>
                            <option value="SERVICE_AGREEMENT">Service Agreement</option>
                            <option value="DATA_PRIVACY_AGREEMENT">Data Privacy Agreement</option>
                            <option value="SECURITY_DOCUMENT">Security Document</option>
                            <option value="CERTIFICATE_OF_INSURANCE">Certificate of Insurance</option>
                            <option value="NOTE">Note</option>
                            <option value="OTHER">Other</option>
                          </select>
                          <input
                            type="file"
                            onChange={(e) => {
                              const documentType = (document.getElementById(`artifact-type-${request.id}`) as HTMLSelectElement | null)?.value || "QUOTE";
                              void handleArtifactUpload(request.id, e.target.files?.[0] || null, documentType);
                              e.currentTarget.value = "";
                            }}
                            className="text-sm"
                          />
                        </div>
                      </div>

                      <div className="space-y-3 rounded-[3px] border border-[var(--border)] p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">Customer Update</div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]" htmlFor={`contact-subject-${request.id}`}>Email subject</label>
                          <input
                            id={`contact-subject-${request.id}`}
                            aria-label="Email subject"
                            type="text"
                            value={draft.contactSubject}
                            onChange={(e) => updateInvoiceDraft(request.id, { contactSubject: e.target.value })}
                            className="w-full rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]" htmlFor={`contact-message-${request.id}`}>Email message</label>
                          <textarea
                            id={`contact-message-${request.id}`}
                            aria-label="Email message"
                            rows={4}
                            value={draft.contactMessage}
                            onChange={(e) => updateInvoiceDraft(request.id, { contactMessage: e.target.value })}
                            className="w-full rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm"
                          />
                        </div>
                        <button
                          onClick={() => void handleSendCustomerUpdate(request.id)}
                          disabled={updatingInvoiceRequestId === request.id || !draft.contactSubject.trim() || !draft.contactMessage.trim()}
                          className="rounded-[2px] bg-[var(--action)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--navy)] disabled:opacity-50"
                        >
                          {updatingInvoiceRequestId === request.id ? "Sending..." : "Send Customer Update"}
                        </button>
                      </div>
                    </div>

                    {request.auditLogs?.length ? (
                      <div className="mt-4 space-y-2 rounded-[3px] border border-[var(--border)] p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">Status History</div>
                        {request.auditLogs.map((log) => (
                          <div key={log.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[2px] border border-[var(--border)] px-3 py-2 text-sm">
                            <div className="text-[var(--text)]">
                              {log.entryType === "CONTACT"
                                ? `Customer update${log.subject ? `: ${log.subject}` : ""}`
                                : (INTERNAL_INVOICE_STATUS_LABELS[log.newStatus as InternalInvoiceRequestStatus] ?? log.newStatus)}
                              {log.note ? ` · ${log.note}` : ""}
                              {log.visibleToCustomer ? " · visible to org" : ""}
                            </div>
                            <div className="text-xs text-[var(--text-faint)]">
                              {log.changedByUser.name} · {new Date(log.changedAt).toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">
                        Next Actions
                      </div>
                      {INTERNAL_INVOICE_STATUS_ACTIONS[request.status as InternalInvoiceRequestStatus]?.length ? (
                        INTERNAL_INVOICE_STATUS_ACTIONS[request.status as InternalInvoiceRequestStatus].map((nextStatus) => (
                          <button
                            key={nextStatus}
                            onClick={() => void handleInvoiceStatusUpdate(request.id, nextStatus)}
                            disabled={updatingInvoiceRequestId === request.id}
                            className="rounded-[2px] border border-[var(--border-s)] px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-alt)] disabled:opacity-50"
                          >
                            {updatingInvoiceRequestId === request.id
                              ? "Updating..."
                              : `Mark ${INTERNAL_INVOICE_STATUS_LABELS[nextStatus]}`}
                          </button>
                        ))
                      ) : (
                        <div className="text-sm text-[var(--text-sec)]">No further actions. Request is closed.</div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
