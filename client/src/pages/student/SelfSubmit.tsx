import { useEffect, useState } from "react";
import { api } from "../../lib/api";

interface SchoolRules {
  allowSelfSubmission: boolean;
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

const CATEGORY_OPTIONS = [
  "general",
  "education",
  "environment",
  "food",
  "health",
  "community",
  "arts",
  "mentoring",
];

export default function StudentSelfSubmit() {
  const [submissions, setSubmissions] = useState<SelfSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [allowSelfSubmission, setAllowSelfSubmission] = useState<boolean | null>(null);
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
    } catch {
      setError("Failed to load submissions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

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
      setError(err.message || "Failed to resubmit.");
    } finally {
      setSubmitting(false);
    }
  };

  const statusColor = (status: string) => {
    if (status === "APPROVED") return "bg-green-50 text-green-700";
    if (status === "REJECTED") return "bg-red-50 text-red-600";
    if (status === "REVISION_REQUESTED") return "bg-amber-50 text-amber-700";
    return "bg-yellow-50 text-yellow-700";
  };

  const statusLabel = (status: string) => {
    if (status === "REVISION_REQUESTED") return "Needs Revision";
    return status.charAt(0) + status.slice(1).toLowerCase();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Self-Submitted Hours</h1>
        {allowSelfSubmission !== false && (
          <button onClick={() => { setShowForm(true); setError(""); setSuccess(""); }}
            className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm hover:bg-gray-800">
            + Submit Hours
          </button>
        )}
      </div>

      {allowSelfSubmission === false && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
          Your school does not accept self-submitted hours. Only hours completed through school-organized events will count.
        </div>
      )}

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">{success}</div>}

      {showForm && allowSelfSubmission !== false && (
        <div className="mb-6 bg-white border border-gray-200 rounded-lg p-5 max-w-lg">
          <h2 className="font-semibold mb-4">Report Volunteer Hours</h2>
          <p className="text-sm text-gray-600 mb-4">
            Use this form to report hours you completed outside of school-organized events.
            Your school administrator will review and approve.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name *</label>
                <input type="text" value={form.organizationName}
                  onChange={(e) => setForm((p) => ({ ...p, organizationName: e.target.value }))} required
                  placeholder="e.g. Local Food Bank"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Service *</label>
                <input type="date" value={form.date}
                  onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} required
                  max={new Date().toISOString().split("T")[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
              <textarea value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} required
                rows={3} placeholder="Describe what you did..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hours *</label>
                <input type="number" value={form.hours}
                  onChange={(e) => setForm((p) => ({ ...p, hours: e.target.value }))} required
                  min={0.5} max={24} step={0.5} placeholder="e.g. 3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Evidence / Notes</label>
                <input type="text" value={form.evidenceNote}
                  onChange={(e) => setForm((p) => ({ ...p, evidenceNote: e.target.value }))}
                  placeholder="Supervisor name, confirmation #..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                {CATEGORY_OPTIONS.map((category) => (
                  <option key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={submitting}
                className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm hover:bg-gray-800 disabled:opacity-50">
                {submitting ? "Submitting..." : "Submit for Review"}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-3 py-2 text-gray-500 hover:text-gray-800 text-sm">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : submissions.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-500">
          No submissions yet. Click "+ Submit Hours" to report volunteer work done outside school events.
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map((sub) => (
            <div key={sub.id} className={`bg-white border rounded-lg p-4 ${sub.status === "REVISION_REQUESTED" ? "border-amber-300" : "border-gray-200"}`}>
              {editingId === sub.id ? (
                <div>
                  <div className="font-medium mb-3 text-amber-700">Revising submission — update and resubmit</div>
                  {sub.revisionNote && (
                    <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                      <strong>Reviewer note:</strong> {sub.revisionNote}
                    </div>
                  )}
                  <form onSubmit={handleResubmit} className="space-y-3">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Organization Name *</label>
                        <input type="text" value={editForm.organizationName}
                          onChange={(e) => setEditForm((p) => ({ ...p, organizationName: e.target.value }))} required
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Date *</label>
                        <input type="date" value={editForm.date}
                          onChange={(e) => setEditForm((p) => ({ ...p, date: e.target.value }))} required
                          max={new Date().toISOString().split("T")[0]}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Description *</label>
                      <textarea value={editForm.description}
                        onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))} required
                        rows={2} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Hours *</label>
                        <input type="number" value={editForm.hours}
                          onChange={(e) => setEditForm((p) => ({ ...p, hours: e.target.value }))} required
                          min={0.5} max={24} step={0.5}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Evidence / Notes</label>
                        <input type="text" value={editForm.evidenceNote}
                          onChange={(e) => setEditForm((p) => ({ ...p, evidenceNote: e.target.value }))}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                      <select
                        value={editForm.category}
                        onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value }))}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                      >
                        {CATEGORY_OPTIONS.map((category) => (
                          <option key={category} value={category}>
                            {category.charAt(0).toUpperCase() + category.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" disabled={submitting}
                        className="px-3 py-1.5 bg-gray-900 text-white rounded text-xs hover:bg-gray-800 disabled:opacity-50">
                        {submitting ? "..." : "Resubmit for Review"}
                      </button>
                      <button type="button" onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 text-gray-500 hover:text-gray-700 text-xs">
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-medium">{sub.organizationName}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {new Date(sub.date).toLocaleDateString()} &middot; {sub.hours}h
                    </div>
                    {sub.category && (
                      <div className="text-xs text-gray-400 mt-0.5">
                        Category: {sub.category}
                      </div>
                    )}
                    <div className="text-sm text-gray-600 mt-1">{sub.description}</div>
                    {sub.rejectionReason && (
                      <div className="text-xs text-red-500 mt-1 italic">Rejected: {sub.rejectionReason}</div>
                    )}
                    {sub.revisionNote && (
                      <div className="text-xs text-amber-700 mt-1 italic">Revision needed: {sub.revisionNote}</div>
                    )}
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
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
