import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { api } from "../../lib/api";

interface SelfSubmission {
  id: string;
  status: string;
  organizationName: string;
  description: string;
  date: string;
  hours: number;
  createdAt: string;
  revisionNote: string | null;
  student: { id: string; name: string; email: string };
  rejectionReason: string | null;
}

type FilterStatus = "PENDING" | "APPROVED" | "REJECTED" | "REVISION_REQUESTED";

interface ImportResult {
  imported: number;
  skipped: { row: number; email: string; reason: string }[];
}

const TEMPLATE_CSV = `student_email,organization_name,date,hours,description,category
john@student.edu,City Food Bank,2024-11-15,3,Sorted and distributed food donations,community
jane@student.edu,Public Library,2024-12-01,2,Tutored younger students,education`;

export default function SchoolSelfSubmissions() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<SelfSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("PENDING");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewMode, setReviewMode] = useState<"approve" | "reject" | "revision" | null>(null);
  const [hoursOverride, setHoursOverride] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState<string | null>(null);

  // Import state
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState("");

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

  const openReview = (id: string, requestedHours: number) => {
    setReviewingId(id);
    setReviewMode(null);
    setHoursOverride(String(requestedHours));
    setReviewNote("");
    setError("");
  };

  const handleApprove = async (id: string) => {
    setSubmitting(true);
    setError("");
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
    if (!reviewNote.trim()) { setError("Please provide a reason for rejection."); return; }
    setSubmitting(true);
    setError("");
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

  const handleRequestRevision = async (id: string) => {
    if (!reviewNote.trim()) { setError("Please provide a note explaining what needs to be revised."); return; }
    setSubmitting(true);
    setError("");
    try {
      await api.post(`/self-submissions/${id}/request-revision`, { note: reviewNote });
      setReviewingId(null);
      void load();
    } catch (err: any) {
      setError(err.message || "Failed to request revision.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleImport = async () => {
    if (!csvText.trim()) { setImportError("Paste your CSV data first."); return; }
    setImporting(true);
    setImportError("");
    setImportResult(null);
    try {
      const result = await api.post<ImportResult>("/self-submissions/import", { csvData: csvText });
      setImportResult(result);
      setCsvText("");
      if (result.imported > 0) void load();
    } catch (err: any) {
      setImportError(err.message || "Import failed.");
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "goodhours-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownload = async (path: string, filename: string, label: string) => {
    setDownloadingReport(label);
    setError("");
    try {
      const blob = await api.download(path);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || "Failed to export report.");
    } finally {
      setDownloadingReport(null);
    }
  };

  const filterLabels: Record<FilterStatus, string> = {
    PENDING: "Pending",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    REVISION_REQUESTED: "Needs Revision",
  };

  const schoolId = user?.schoolId;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Self-Submitted Hours</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setShowImport((v) => !v); setImportResult(null); setImportError(""); }}
            className="px-3 py-1.5 text-xs border border-blue-300 rounded hover:bg-blue-50 text-blue-700 font-medium"
          >
            {showImport ? "Close Import" : "Import Prior Hours"}
          </button>
          {schoolId && (
            <>
              <button
                type="button"
                onClick={() => handleDownload(`/schools/${schoolId}/students/at-risk?format=csv`, "at-risk-students.csv", "at-risk")}
                disabled={downloadingReport !== null}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 text-gray-600"
              >
                {downloadingReport === "at-risk" ? "Exporting..." : "Export At-Risk CSV"}
              </button>
              <button
                type="button"
                onClick={() => handleDownload(`/schools/${schoolId}/export`, "all-students.csv", "students")}
                disabled={downloadingReport !== null}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 text-gray-600"
              >
                {downloadingReport === "students" ? "Exporting..." : "Export All Students CSV"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Bulk import panel */}
      {showImport && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-5">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h2 className="font-semibold text-blue-900">Import Prior Hours</h2>
              <p className="text-xs text-blue-700 mt-0.5">
                Upload hours your students completed before joining GoodHours. Rows are marked as approved immediately.
              </p>
            </div>
            <button type="button" onClick={downloadTemplate} className="text-xs text-blue-600 underline hover:text-blue-800 shrink-0 ml-4">
              Download template
            </button>
          </div>

          <div className="text-xs text-blue-800 mb-2 font-mono bg-blue-100 rounded p-2 leading-relaxed">
            Required columns: <strong>student_email, organization_name, date, hours</strong><br />
            Optional: <strong>description, category</strong> &nbsp;·&nbsp; Date format: <strong>YYYY-MM-DD</strong> &nbsp;·&nbsp; Max 500 rows
          </div>

          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={6}
            placeholder={"student_email,organization_name,date,hours,description,category\njohn@student.edu,City Food Bank,2024-11-15,3,Sorted donations,community"}
            className="w-full px-3 py-2 border border-blue-300 rounded text-sm font-mono bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
          />

          {importError && (
            <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{importError}</div>
          )}

          {importResult && (
            <div className="mt-2 space-y-1">
              <div className="text-xs text-green-800 bg-green-50 border border-green-200 rounded px-3 py-2">
                {importResult.imported} row{importResult.imported !== 1 ? "s" : ""} imported successfully.
                {importResult.skipped.length > 0 && ` ${importResult.skipped.length} skipped.`}
              </div>
              {importResult.skipped.length > 0 && (
                <div className="text-xs bg-amber-50 border border-amber-200 rounded px-3 py-2 space-y-0.5">
                  <div className="font-medium text-amber-800 mb-1">Skipped rows:</div>
                  {importResult.skipped.map((s) => (
                    <div key={s.row} className="text-amber-700">
                      Row {s.row}{s.email ? ` (${s.email})` : ""}: {s.reason}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || !csvText.trim()}
              className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {importing ? "Importing..." : "Import"}
            </button>
            <button
              type="button"
              onClick={() => { setCsvText(""); setImportResult(null); setImportError(""); }}
              className="px-4 py-1.5 border border-gray-300 text-gray-600 rounded text-sm hover:bg-gray-50"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

      {/* Filter tabs */}
      <div className="flex gap-4 border-b mb-6 overflow-x-auto">
        {(["PENDING", "APPROVED", "REJECTED", "REVISION_REQUESTED"] as FilterStatus[]).map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`pb-2 text-sm font-medium border-b-2 whitespace-nowrap ${filter === s ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {filterLabels[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : submissions.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-500">
          No {filterLabels[filter].toLowerCase()} submissions.
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
                    <div className="text-xs text-red-500 mt-1 italic">Rejected: {sub.rejectionReason}</div>
                  )}
                  {sub.revisionNote && (
                    <div className="text-xs text-amber-600 mt-1 italic">Revision note: {sub.revisionNote}</div>
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
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      sub.status === "APPROVED" ? "bg-green-50 text-green-700" :
                      sub.status === "REVISION_REQUESTED" ? "bg-amber-50 text-amber-700" :
                      "bg-red-50 text-red-600"}`}>
                      {filterLabels[sub.status as FilterStatus] ?? sub.status}
                    </span>
                  )}
                </div>
              </div>

              {reviewingId === sub.id && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                  {/* Action selector */}
                  <div className="flex gap-2 text-xs">
                    {(["approve", "revision", "reject"] as const).map((mode) => (
                      <button key={mode} onClick={() => setReviewMode(mode === reviewMode ? null : mode)}
                        className={`px-2.5 py-1 rounded border ${reviewMode === mode ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600 hover:border-gray-500"}`}>
                        {mode === "approve" ? "Approve" : mode === "revision" ? "Request Revision" : "Reject"}
                      </button>
                    ))}
                    <button onClick={() => setReviewingId(null)} className="px-2.5 py-1 text-gray-400 hover:text-gray-600 text-xs">
                      Cancel
                    </button>
                  </div>

                  {reviewMode === "approve" && (
                    <div className="space-y-2">
                      <div className="flex gap-2 items-center">
                        <label className="text-xs text-gray-600 font-medium w-28">Hours to approve:</label>
                        <input type="number" value={hoursOverride} onChange={(e) => setHoursOverride(e.target.value)}
                          min={0} step={0.5} className="w-24 px-2 py-1 border border-gray-300 rounded text-sm" />
                      </div>
                      <button onClick={() => handleApprove(sub.id)} disabled={submitting}
                        className="px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50">
                        {submitting ? "..." : "Confirm Approval"}
                      </button>
                    </div>
                  )}

                  {(reviewMode === "revision" || reviewMode === "reject") && (
                    <div className="space-y-2">
                      <div className="flex gap-2 items-start">
                        <label className="text-xs text-gray-600 font-medium w-28 pt-1">
                          {reviewMode === "revision" ? "Revision note:" : "Rejection reason:"}
                        </label>
                        <textarea value={reviewNote} onChange={(e) => setReviewNote(e.target.value)}
                          rows={2} placeholder={reviewMode === "revision" ? "What needs to be changed..." : "Why this is rejected..."}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm" />
                      </div>
                      <button onClick={() => reviewMode === "revision" ? handleRequestRevision(sub.id) : handleReject(sub.id)} disabled={submitting}
                        className={`px-3 py-1.5 text-white rounded text-xs disabled:opacity-50 ${reviewMode === "revision" ? "bg-amber-600 hover:bg-amber-700" : "bg-red-600 hover:bg-red-700"}`}>
                        {submitting ? "..." : reviewMode === "revision" ? "Send for Revision" : "Confirm Rejection"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
