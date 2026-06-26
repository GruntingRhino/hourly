import { useEffect, useState } from "react";
import { ApiError, api } from "../../lib/api";
import { buildOpportunityCategoryOptions } from "../../lib/opportunityCategories";

interface SchoolRules {
  allowSelfSubmission: boolean;
  blockedCategories: string[];
  categoryCapStatuses: CategoryCapStatus[];
}

interface CategoryCapStatus {
  category: string;
  cap: number;
  approvedHours: number;
  remainingHours: number;
  maxedOut: boolean;
  alreadyOverCap: boolean;
}

interface SelfSubmission {
  id: string;
  status: string;
  organizationName: string;
  description: string;
  date: string;
  hours: number;
  createdAt: string;
  rejectionReason: string | null;
  revisionNote: string | null;
  timesRevised?: number;
  category?: string | null;
}

type EditForm = {
  organizationName: string;
  description: string;
  date: string;
  hours: string;
  evidenceNote: string;
  category: string;
};

const STATUS_FILTERS = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
  { key: "REVISION_REQUESTED", label: "Needs Revision" },
  { key: "CANCELLED", label: "Cancelled" },
];

export default function StudentSelfSubmit() {
  const [submissions, setSubmissions] = useState<SelfSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [allowSelfSubmission, setAllowSelfSubmission] = useState<boolean | null>(null);
  const [blockedCategories, setBlockedCategories] = useState<string[]>([]);
  const [categoryCapStatuses, setCategoryCapStatuses] = useState<CategoryCapStatus[]>([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [form, setForm] = useState<EditForm>({
    organizationName: "",
    description: "",
    date: "",
    hours: "",
    evidenceNote: "",
    category: "general",
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  // Editing a revision-requested submission
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ organizationName: "", description: "", date: "", hours: "", evidenceNote: "", category: "general" });

  const load = async () => {
    setLoading(true);
    try {
      const [data, rules] = await Promise.all([
        api.get<SelfSubmission[]>("/self-submissions"),
        api.get<SchoolRules>("/schools/my-rules").catch(() => null),
      ]);
      setSubmissions(data);
      setAllowSelfSubmission(rules?.allowSelfSubmission ?? true);
      setBlockedCategories((rules?.blockedCategories ?? []).slice().sort((a, b) => a.localeCompare(b)));
      setCategoryCapStatuses(rules?.categoryCapStatuses ?? []);
    } catch {
      setError("Failed to load submissions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const blockedCategorySet = new Set(blockedCategories);
  const categoryOptions = buildOpportunityCategoryOptions([
    form.category,
    editForm.category,
    ...submissions.map((submission) => submission.category),
  ]).filter((category) => !blockedCategorySet.has(category));

  const activeBlockedCategory = categoryCapStatuses.find(
    (status) => status.category === form.category && (status.maxedOut || status.alreadyOverCap),
  ) ?? null;
  const activeEditBlockedCategory = categoryCapStatuses.find(
    (status) => status.category === editForm.category && (status.maxedOut || status.alreadyOverCap),
  ) ?? null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await api.post("/self-submissions", {
        organizationName: form.organizationName,
        description: form.description,
        date: form.date,
        hours: parseFloat(form.hours),
        evidenceNote: form.evidenceNote || undefined,
        category: form.category,
      });
      setForm({ organizationName: "", description: "", date: "", hours: "", evidenceNote: "", category: "general" });
      setShowForm(false);
      setSuccess("Submission sent for review.");
      void load();
    } catch (err: any) {
      if (err instanceof ApiError && typeof err.body === "object" && err.body && "categoryBlocked" in err.body) {
        void load();
      }
      setError(err.message || "Failed to submit.");
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (sub: SelfSubmission) => {
    setEditingId(sub.id);
    setEditForm({
      organizationName: sub.organizationName,
      description: sub.description,
      date: new Date(sub.date).toISOString().split("T")[0],
      hours: String(sub.hours),
      evidenceNote: "",
      category: sub.category || "general",
    });
    setError("");
  };

  const handleResubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setSubmitting(true);
    setError("");
    try {
      await api.put(`/self-submissions/${editingId}`, {
        organizationName: editForm.organizationName,
        description: editForm.description,
        date: editForm.date,
        hours: parseFloat(editForm.hours),
        evidenceNote: editForm.evidenceNote || undefined,
        category: editForm.category,
      });
      setEditingId(null);
      setSuccess("Resubmitted for review.");
      void load();
    } catch (err: any) {
      if (err instanceof ApiError && typeof err.body === "object" && err.body && "categoryBlocked" in err.body) {
        void load();
      }
      setError(err.message || "Failed to resubmit.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelSubmission = async (submissionId: string) => {
    setCancelingId(submissionId);
    setError("");
    setSuccess("");
    try {
      await api.post(`/self-submissions/${submissionId}/cancel`, {});
      if (editingId === submissionId) {
        setEditingId(null);
      }
      setSuccess("Submission cancelled.");
      void load();
    } catch (err: any) {
      setError(err.message || "Failed to cancel submission.");
    } finally {
      setCancelingId(null);
    }
  };

  const statusColor = (status: string) => {
    if (status === "APPROVED") return "bg-[var(--ok-bg)] text-[var(--ok-t)]";
    if (status === "REJECTED") return "bg-[var(--er-bg)] text-[var(--er-t)]";
    if (status === "REVISION_REQUESTED") return "bg-[var(--wn-bg)] text-[var(--wn-t)]";
    if (status === "CANCELLED") return "bg-[var(--surface-alt)] text-[var(--text-sec)]";
    return "bg-[var(--wn-bg)] text-[var(--wn-t)]";
  };

  const statusLabel = (status: string) => {
    if (status === "REVISION_REQUESTED") return "Needs Revision";
    return status.charAt(0) + status.slice(1).toLowerCase();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-[28px] font-bold">Self-Submitted Hours</h1>
        {allowSelfSubmission !== false && (
          <button onClick={() => { setShowForm(true); setError(""); setSuccess(""); }}
            className="h-[34px] px-4 bg-[var(--action)] text-white rounded-[2px] text-[13px] font-medium text-sm hover:opacity-85">
            + Submit Hours
          </button>
        )}
      </div>

      {allowSelfSubmission === false && (
        <div className="mb-6 p-4 bg-[var(--wn-bg)] border border-[var(--wn-b)] rounded-[3px] text-[var(--wn-t)] text-sm">
          Your school does not accept self-submitted hours. Only hours completed through school-organized events will count.
        </div>
      )}

      {blockedCategories.length > 0 && (
        <div className="mb-6 p-4 bg-[var(--wn-bg)] border border-[var(--wn-b)] rounded-[3px] text-[var(--wn-t)] text-sm">
          Your school has capped these categories for you: {blockedCategories.join(", ")}. You have already reached the maximum allowed hours there, so they are hidden from new self-submissions.
        </div>
      )}

      {error && <div className="mb-4 p-3 bg-[var(--er-bg)] border border-[var(--er-b)] rounded text-[var(--er-t)] text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-[var(--ok-bg)] border border-[var(--ok-b)] rounded text-[var(--ok-t)] text-sm">{success}</div>}

      {showForm && allowSelfSubmission !== false && (
        <div className="mb-6 bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-5 max-w-lg">
          <h2 className="font-semibold mb-4">Report Volunteer Hours</h2>
          <p className="text-sm text-[var(--text-sec)] mb-4">
            Use this form to report hours you completed outside of school-organized events.
            Your school administrator will review and approve.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            {activeBlockedCategory && (
              <div className="rounded-[2px] border border-[var(--er-b)] bg-[var(--er-bg)] px-3 py-2 text-sm text-[var(--er-t)]">
                Your school is preventing you from doing more {activeBlockedCategory.category}. You have already completed {activeBlockedCategory.approvedHours.toFixed(1)}h, which meets or exceeds the {activeBlockedCategory.cap}h maximum.
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">Organization Name *</label>
                <input type="text" value={form.organizationName}
                  onChange={(e) => setForm((p) => ({ ...p, organizationName: e.target.value }))} required
                  placeholder="e.g. Local Food Bank"
                  className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)] text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">Date of Service *</label>
                <input type="date" value={form.date}
                  onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} required
                  max={new Date().toISOString().split("T")[0]}
                  className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)] text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">Description *</label>
              <textarea value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} required
                rows={3} placeholder="Describe what you did..."
                className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)] text-sm" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">Hours *</label>
                <input type="number" value={form.hours}
                  onChange={(e) => setForm((p) => ({ ...p, hours: e.target.value }))} required
                  min={0.5} max={24} step={0.5} placeholder="e.g. 3"
                  className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)] text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">Evidence / Notes</label>
                <input type="text" value={form.evidenceNote}
                  onChange={(e) => setForm((p) => ({ ...p, evidenceNote: e.target.value }))}
                  placeholder="Supervisor name, confirmation #..."
                  className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)] text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)] text-sm"
              >
                <option value="general">General / Unspecified</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={submitting}
                className="h-[34px] px-4 bg-[var(--action)] text-white rounded-[2px] text-[13px] font-medium text-sm hover:opacity-85 disabled:opacity-50">
                {submitting ? "Submitting..." : "Submit for Review"}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-3 py-2 text-[var(--text-sec)] hover:text-[var(--text)] text-sm">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {!loading && submissions.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {STATUS_FILTERS.map((f) => {
            const count = f.key === "ALL" ? submissions.length : submissions.filter(s => s.status === f.key).length;
            return (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  statusFilter === f.key
                    ? "bg-[var(--action)] text-white border-[var(--action)]"
                    : "bg-[var(--surface)] text-[var(--text-sec)] border-[var(--border-s)] hover:border-[var(--action)]"
                }`}
              >
                {f.label}
                {count > 0 && f.key !== "ALL" && (
                  <span className={`ml-1.5 ${statusFilter === f.key ? "opacity-75" : "text-[var(--text-faint)]"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="text-[var(--text-sec)] text-sm">Loading...</div>
      ) : submissions.length === 0 ? (
        <div className="bg-[var(--surface-alt)] border border-[var(--border)] rounded-[3px] p-8 text-center text-[var(--text-sec)]">
          No submissions yet. Click "+ Submit Hours" to report volunteer work done outside school events.
        </div>
      ) : (() => {
        const filtered = (statusFilter === "ALL" ? submissions : submissions.filter(s => s.status === statusFilter))
          .slice()
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return filtered.length === 0 ? (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-8 text-center text-[var(--text-sec)] text-sm">
            No {STATUS_FILTERS.find(f => f.key === statusFilter)?.label.toLowerCase()} submissions.
          </div>
        ) : (
        <div className="space-y-3">
          {filtered.map((sub) => (
            <div key={sub.id} className={`bg-[var(--surface)] border rounded-[3px] p-4 ${sub.status === "REVISION_REQUESTED" ? "border-amber-300" : "border-[var(--border)]"}`}>
              {editingId === sub.id ? (
                <div>
                  <div className="font-medium mb-3 text-[var(--wn-t)]">Revising submission — update and resubmit</div>
                  {sub.revisionNote && (
                    <div className="mb-3 p-2 bg-[var(--wn-bg)] border border-[var(--wn-b)] rounded text-xs text-[var(--wn-t)]">
                      <strong>Reviewer note:</strong> {sub.revisionNote}
                    </div>
                  )}
                  <form onSubmit={handleResubmit} className="space-y-3">
                    {activeEditBlockedCategory && (
                      <div className="rounded-[2px] border border-[var(--er-b)] bg-[var(--er-bg)] px-3 py-2 text-sm text-[var(--er-t)]">
                        Your school is preventing you from doing more {activeEditBlockedCategory.category}. You have already completed {activeEditBlockedCategory.approvedHours.toFixed(1)}h, which meets or exceeds the {activeEditBlockedCategory.cap}h maximum.
                      </div>
                    )}
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-[var(--text)] mb-1">Organization Name *</label>
                        <input type="text" value={editForm.organizationName}
                          onChange={(e) => setEditForm((p) => ({ ...p, organizationName: e.target.value }))} required
                          className="w-full px-2 py-1.5 border border-[var(--border-s)] rounded text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--text)] mb-1">Date *</label>
                        <input type="date" value={editForm.date}
                          onChange={(e) => setEditForm((p) => ({ ...p, date: e.target.value }))} required
                          max={new Date().toISOString().split("T")[0]}
                          className="w-full px-2 py-1.5 border border-[var(--border-s)] rounded text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--text)] mb-1">Description *</label>
                      <textarea value={editForm.description}
                        onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))} required
                        rows={2} className="w-full px-2 py-1.5 border border-[var(--border-s)] rounded text-sm" />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-[var(--text)] mb-1">Hours *</label>
                        <input type="number" value={editForm.hours}
                          onChange={(e) => setEditForm((p) => ({ ...p, hours: e.target.value }))} required
                          min={0.5} max={24} step={0.5}
                          className="w-full px-2 py-1.5 border border-[var(--border-s)] rounded text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--text)] mb-1">Evidence / Notes</label>
                        <input type="text" value={editForm.evidenceNote}
                          onChange={(e) => setEditForm((p) => ({ ...p, evidenceNote: e.target.value }))}
                          className="w-full px-2 py-1.5 border border-[var(--border-s)] rounded text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--text)] mb-1">Category</label>
                      <select
                        value={editForm.category}
                        onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value }))}
                        className="w-full px-2 py-1.5 border border-[var(--border-s)] rounded text-sm"
                      >
                        <option value="general">General / Unspecified</option>
                        {categoryOptions.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" disabled={submitting}
                        className="px-3 py-1.5 bg-[var(--action)] text-white rounded text-xs hover:opacity-85 disabled:opacity-50">
                        {submitting ? "..." : "Resubmit for Review"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCancelSubmission(sub.id)}
                        disabled={cancelingId === sub.id}
                        className="px-3 py-1.5 bg-[var(--er-bg)] text-[var(--er-t)] rounded text-xs hover:bg-[var(--er-bg)] disabled:opacity-50"
                      >
                        {cancelingId === sub.id ? "Cancelling..." : "Cancel Request"}
                      </button>
                      <button type="button" onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 text-[var(--text-sec)] hover:text-[var(--text)] text-xs">
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-medium">{sub.organizationName}</div>
                    <div className="text-xs text-[var(--text-sec)] mt-0.5">
                      {new Date(sub.date).toLocaleDateString()} &middot; {sub.hours}h
                    </div>
                    {sub.category && (
                      <div className="text-xs text-[var(--text-faint)] mt-0.5">
                        Category: {sub.category}
                      </div>
                    )}
                    <div className="text-sm text-[var(--text-sec)] mt-1">{sub.description}</div>
                    {sub.rejectionReason && (
                      <div className="text-xs text-[var(--er-t)] mt-1 italic">Rejected: {sub.rejectionReason}</div>
                    )}
                    {sub.revisionNote && (
                      <div className="text-xs text-[var(--wn-t)] mt-1 italic">Revision needed: {sub.revisionNote}</div>
                    )}
                    {sub.timesRevised ? (
                      <div className="text-xs text-[var(--text-faint)] mt-1">{`Revision ${sub.timesRevised}`}</div>
                    ) : null}
                  </div>
                  <div className="ml-3 flex flex-col items-end gap-2 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(sub.status)}`}>
                      {statusLabel(sub.status)}
                    </span>
                    {sub.status === "REVISION_REQUESTED" && allowSelfSubmission !== false && (
                      <button onClick={() => openEdit(sub)}
                        className="px-2.5 py-1 bg-amber-600 text-white rounded text-xs hover:bg-amber-700">
                        Edit & Resubmit
                      </button>
                    )}
                    {["PENDING", "REVISION_REQUESTED"].includes(sub.status) && (
                      <button
                        onClick={() => void handleCancelSubmission(sub.id)}
                        disabled={cancelingId === sub.id}
                        className="px-2.5 py-1 bg-[var(--er-bg)] text-[var(--er-t)] rounded text-xs hover:bg-[var(--er-bg)] disabled:opacity-50"
                      >
                        {cancelingId === sub.id ? "Cancelling..." : "Cancel Request"}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        );
      })()}
    </div>
  );
}
