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
  student: { id: string; name: string; email: string };
  rejectionReason: string | null;
}

export default function SchoolSelfSubmissions() {
  const [submissions, setSubmissions] = useState<SelfSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [hoursOverride, setHoursOverride] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get<SelfSubmission[]>(`/self-submissions?status=${filter}`);
      setSubmissions(data);
    } catch {
      setError("Failed to load submissions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [filter]);

  const openReview = (id: string, requested: number) => {
    setReviewingId(id);
    setHoursOverride(String(requested));
    setReviewNote("");
  };

  const handleApprove = async (id: string) => {
    setSubmitting(true);
    try {
      await api.post(`/self-submissions/${id}/approve`, {
        adjustedHours: hoursOverride ? parseFloat(hoursOverride) : undefined,
      });
      setReviewingId(null);
      void load();
    } catch (err: any) {
      setError(err.message || "Failed to approve.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (id: string) => {
    if (!reviewNote.trim()) {
      setError("Please provide a reason for rejection.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/self-submissions/${id}/reject`, { reason: reviewNote });
      setReviewingId(null);
      void load();
    } catch (err: any) {
      setError(err.message || "Failed to reject.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Self-Submitted Hours</h1>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

      {/* Filter tabs */}
      <div className="flex gap-4 border-b mb-6">
        {(["PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`pb-2 text-sm font-medium border-b-2 capitalize ${filter === s ? "border-gray-900 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : submissions.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-500">
          No {filter.toLowerCase()} submissions.
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map((sub) => (
            <div key={sub.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="font-medium">{sub.organizationName}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {sub.student.name} &middot; {new Date(sub.date).toLocaleDateString()}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">{sub.description}</div>
                  <div className="text-sm mt-1">
                    <span className="font-medium">{sub.hours}h requested</span>
                  </div>
                  {sub.rejectionReason && (
                    <div className="text-xs text-gray-400 mt-1 italic">Reason: {sub.rejectionReason}</div>
                  )}
                </div>
                <div className="ml-4 flex flex-col items-end gap-2">
                  {filter === "PENDING" && reviewingId !== sub.id && (
                    <button onClick={() => openReview(sub.id, sub.hours)}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">
                      Review
                    </button>
                  )}
                  {sub.status !== "PENDING" && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${sub.status === "APPROVED" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                      {sub.status}
                    </span>
                  )}
                </div>
              </div>

              {reviewingId === sub.id && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                  <div className="flex gap-2 items-center">
                    <label className="text-xs text-gray-600 font-medium w-28">Hours to approve:</label>
                    <input type="number" value={hoursOverride} onChange={(e) => setHoursOverride(e.target.value)}
                      min={0} step={0.5} className="w-24 px-2 py-1 border border-gray-300 rounded text-sm" />
                  </div>
                  <div className="flex gap-2 items-start">
                    <label className="text-xs text-gray-600 font-medium w-28 pt-1">Note (optional):</label>
                    <textarea value={reviewNote} onChange={(e) => setReviewNote(e.target.value)}
                      rows={2} className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleApprove(sub.id)} disabled={submitting}
                      className="px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50">
                      {submitting ? "..." : "Approve"}
                    </button>
                    <button onClick={() => handleReject(sub.id)} disabled={submitting}
                      className="px-3 py-1.5 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-50">
                      {submitting ? "..." : "Reject"}
                    </button>
                    <button onClick={() => setReviewingId(null)}
                      className="px-3 py-1.5 text-gray-500 hover:text-gray-700 text-xs">
                      Cancel
                    </button>
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
