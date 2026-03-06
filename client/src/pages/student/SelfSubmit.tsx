import { useEffect, useState } from "react";
import { api } from "../../lib/api";

interface SelfSubmission {
  id: string;
  status: string;
  organizationName: string;
  description: string;
  date: string;
  hours: number;
  createdAt: string;
  rejectionReason: string | null;
}

export default function StudentSelfSubmit() {
  const [submissions, setSubmissions] = useState<SelfSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    organizationName: "",
    description: "",
    date: "",
    hours: "",
    evidenceNote: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get<SelfSubmission[]>("/self-submissions");
      setSubmissions(data);
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
      });
      setForm({ organizationName: "", description: "", date: "", hours: "", evidenceNote: "" });
      setShowForm(false);
      setSuccess("Submission sent for review.");
      void load();
    } catch (err: any) {
      setError(err.message || "Failed to submit.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Self-Submitted Hours</h1>
        <button onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm hover:bg-gray-800">
          + Submit Hours
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">{success}</div>}

      {showForm && (
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
            <div key={sub.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium">{sub.organizationName}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {new Date(sub.date).toLocaleDateString()} &middot; {sub.hours}h
                  </div>
                  <div className="text-sm text-gray-600 mt-1">{sub.description}</div>
                  {sub.rejectionReason && (
                    <div className="text-xs text-red-500 mt-1 italic">Reason: {sub.rejectionReason}</div>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ml-3 shrink-0 ${
                  sub.status === "APPROVED" ? "bg-green-50 text-green-700" :
                  sub.status === "REJECTED" ? "bg-red-50 text-red-600" :
                  "bg-yellow-50 text-yellow-700"
                }`}>
                  {sub.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
