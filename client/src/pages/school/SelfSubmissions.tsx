import { useEffect, useEffectEvent, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { api, getErrorMessage } from "../../lib/api";

interface SelfSubmission {
  id: string;
  status: string;
  organizationName: string;
  description: string;
  date: string;
  hours: number;
  createdAt: string;
  reviewedAt: string | null;
  revisionNote: string | null;
  timesRevised: number;
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
  const runLoad = useEffectEvent(() => { void load(); });

  useEffect(() => { runLoad(); }, [filter]);

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
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to approve."));
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
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to reject."));
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
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to request revision."));
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
    } catch (err: unknown) {
      setImportError(getErrorMessage(err, "Import failed."));
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
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to export report."));
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
        <h1 className="text-[28px] font-bold">Self-Submitted Hours</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setShowImport((v) => !v); setImportResult(null); setImportError(""); }}
            className="px-3 py-1.5 text-xs border border-[var(--in-b)] rounded hover:bg-[var(--in-bg)] text-[var(--action)] font-medium"
          >
            {showImport ? "Close Import" : "Import Prior Hours"}
          </button>
          {schoolId && (
            <>
              <button
                type="button"
                onClick={() => handleDownload(`/schools/${schoolId}/students/at-risk?format=csv`, "at-risk-students.csv", "at-risk")}
                disabled={downloadingReport !== null}
                className="px-3 py-1.5 text-xs border border-[var(--border-s)] rounded hover:bg-[var(--surface-alt)] text-[var(--text-sec)]"
              >
                {downloadingReport === "at-risk" ? "Exporting..." : "Export At-Risk CSV"}
              </button>
              <button
                type="button"
                onClick={() => handleDownload(`/schools/${schoolId}/export`, "all-students.csv", "students")}
                disabled={downloadingReport !== null}
                className="px-3 py-1.5 text-xs border border-[var(--border-s)] rounded hover:bg-[var(--surface-alt)] text-[var(--text-sec)]"
              >
                {downloadingReport === "students" ? "Exporting..." : "Export All Students CSV"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Bulk import panel */}
      {showImport && (
        <div className="mb-6 bg-[var(--in-bg)] border border-[var(--in-b)] rounded-[3px] p-5">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h2 className="font-semibold text-[var(--navy)]">Import Prior Hours</h2>
              <p className="text-xs text-[var(--action)] mt-0.5">
                Upload hours your students completed before joining GoodHours. Rows are marked as approved immediately.
              </p>
            </div>
            <button type="button" onClick={downloadTemplate} className="text-xs text-[var(--action)] underline hover:text-[var(--navy)] shrink-0 ml-4">
              Download template
            </button>
          </div>

          <div className="text-xs text-[var(--navy)] mb-2 font-mono bg-[var(--in-bg)] rounded p-2 leading-relaxed">
            Required columns: <strong>student_email, organization_name, date, hours</strong><br />
            Optional: <strong>description, category</strong> &nbsp;·&nbsp; Date format: <strong>YYYY-MM-DD</strong> &nbsp;·&nbsp; Max 500 rows
          </div>

          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={6}
            placeholder={"student_email,organization_name,date,hours,description,category\njohn@student.edu,City Food Bank,2024-11-15,3,Sorted donations,community"}
            className="w-full px-3 py-2 border border-[var(--in-b)] rounded text-sm font-mono bg-[var(--surface)] focus:outline-none focus:ring-1 focus:ring-blue-400"
          />

          {importError && (
            <div className="mt-2 text-xs text-[var(--er-t)] bg-[var(--er-bg)] border border-[var(--er-b)] rounded px-3 py-2">{importError}</div>
          )}

          {importResult && (
            <div className="mt-2 space-y-1">
              <div className="text-xs text-[var(--ok-t)] bg-[var(--ok-bg)] border border-[var(--ok-b)] rounded px-3 py-2">
                {importResult.imported} row{importResult.imported !== 1 ? "s" : ""} imported successfully.
                {importResult.skipped.length > 0 && ` ${importResult.skipped.length} skipped.`}
              </div>
              {importResult.skipped.length > 0 && (
                <div className="text-xs bg-[var(--wn-bg)] border border-[var(--wn-b)] rounded px-3 py-2 space-y-0.5">
                  <div className="font-medium text-[var(--wn-t)] mb-1">Skipped rows:</div>
                  {importResult.skipped.map((s) => (
                    <div key={s.row} className="text-[var(--wn-t)]">
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
              className="px-4 py-1.5 bg-[var(--action)] text-white rounded text-sm hover:bg-[var(--action)] disabled:opacity-50"
            >
              {importing ? "Importing..." : "Import"}
            </button>
            <button
              type="button"
              onClick={() => { setCsvText(""); setImportResult(null); setImportError(""); }}
              className="px-4 py-1.5 border border-[var(--border-s)] text-[var(--text-sec)] rounded text-sm hover:bg-[var(--surface-alt)]"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {error && <div className="mb-4 p-3 bg-[var(--er-bg)] border border-[var(--er-b)] rounded text-[var(--er-t)] text-sm">{error}</div>}

      {/* Filter tabs */}
      <div className="flex gap-4 border-b mb-6 overflow-x-auto">
        {(["PENDING", "APPROVED", "REJECTED", "REVISION_REQUESTED"] as FilterStatus[]).map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`pb-2 text-sm font-medium border-b-2 whitespace-nowrap ${filter === s ? "border-[var(--action)] text-[var(--action)]" : "border-transparent text-[var(--text-sec)] hover:text-[var(--text)]"}`}>
            {filterLabels[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-[var(--text-sec)] text-sm">Loading...</div>
      ) : submissions.length === 0 ? (
        <div className="bg-[var(--surface-alt)] border border-[var(--border)] rounded-[3px] p-8 text-center text-[var(--text-sec)]">
          No {filterLabels[filter].toLowerCase()} submissions.
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map((sub) => (
            <div key={sub.id} className={`bg-[var(--surface)] border rounded-[3px] p-4 ${
              sub.status === "PENDING" && sub.revisionNote ? "border-amber-300" : "border-[var(--border)]"
            }`}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="font-medium">{sub.organizationName}</div>
                  <div className="text-xs text-[var(--text-sec)] mt-0.5">
                    {sub.student.name} &middot; {new Date(sub.date).toLocaleDateString()}
                  </div>
                  {sub.status === "PENDING" && sub.revisionNote && (
                    <div className="mt-2 inline-flex items-center rounded-full bg-[var(--wn-bg)] px-2.5 py-1 text-xs font-medium text-[var(--wn-t)] border border-[var(--wn-b)]">
                      {`Revision ${Math.max(1, sub.timesRevised)}`}
                    </div>
                  )}
                  <div className="text-sm text-[var(--text-sec)] mt-1">{sub.description}</div>
                  <div className="text-sm mt-1">
                    <span className="font-medium">{sub.hours}h requested</span>
                  </div>
                  {sub.rejectionReason && (
                    <div className="text-xs text-[var(--er-t)] mt-1 italic">Rejected: {sub.rejectionReason}</div>
                  )}
                  {sub.revisionNote && (
                    <div className="text-xs text-[var(--wn-t)] mt-1 italic">
                      {sub.status === "PENDING"
                        ? `Revised after note (${`Revision ${Math.max(1, sub.timesRevised)}`}):`
                        : "Revision note:"}{" "}
                      {sub.revisionNote}
                    </div>
                  )}
                </div>
                <div className="ml-4 flex flex-col items-end gap-2">
                  {filter === "PENDING" && reviewingId !== sub.id && (
                    <button onClick={() => openReview(sub.id, sub.hours)}
                      className="px-3 py-1.5 bg-[var(--action)] text-white rounded text-xs hover:bg-[var(--action)]">
                      Review
                    </button>
                  )}
                  {sub.status !== "PENDING" && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      sub.status === "APPROVED" ? "bg-[var(--ok-bg)] text-[var(--ok-t)]" :
                      sub.status === "REVISION_REQUESTED" ? "bg-[var(--wn-bg)] text-[var(--wn-t)]" :
                      "bg-[var(--er-bg)] text-[var(--er-t)]"}`}>
                      {filterLabels[sub.status as FilterStatus] ?? sub.status}
                    </span>
                  )}
                </div>
              </div>

              {reviewingId === sub.id && (
                <div className="mt-3 pt-3 border-t border-[var(--border)] space-y-2">
                  {/* Action selector */}
                  <div className="flex gap-2 text-xs">
                    {(["approve", "revision", "reject"] as const).map((mode) => (
                      <button key={mode} onClick={() => setReviewMode(mode === reviewMode ? null : mode)}
                        className={`px-2.5 py-1 rounded border ${reviewMode === mode ? "bg-[var(--action)] text-white border-[var(--action)]" : "border-[var(--border-s)] text-[var(--text-sec)] hover:border-[var(--action)]"}`}>
                        {mode === "approve" ? "Approve" : mode === "revision" ? "Request Revision" : "Reject"}
                      </button>
                    ))}
                    <button onClick={() => setReviewingId(null)} className="px-2.5 py-1 text-[var(--text-faint)] hover:text-[var(--text-sec)] text-xs">
                      Cancel
                    </button>
                  </div>

                  {reviewMode === "approve" && (
                    <div className="space-y-2">
                      <div className="flex gap-2 items-center">
                        <label className="text-xs text-[var(--text-sec)] font-medium w-28">Hours to approve:</label>
                        <input type="number" value={hoursOverride} onChange={(e) => setHoursOverride(e.target.value)}
                          min={0} step={0.5} className="w-24 px-2 py-1 border border-[var(--border-s)] rounded text-sm" />
                      </div>
                      <button onClick={() => handleApprove(sub.id)} disabled={submitting}
                        className="px-3 py-1.5 bg-[var(--ok-t)] text-white rounded text-xs hover:bg-[var(--ok-t)] disabled:opacity-50">
                        {submitting ? "..." : "Confirm Approval"}
                      </button>
                    </div>
                  )}

                  {(reviewMode === "revision" || reviewMode === "reject") && (
                    <div className="space-y-2">
                      <div className="flex gap-2 items-start">
                        <label className="text-xs text-[var(--text-sec)] font-medium w-28 pt-1">
                          {reviewMode === "revision" ? "Revision note:" : "Rejection reason:"}
                        </label>
                        <textarea value={reviewNote} onChange={(e) => setReviewNote(e.target.value)}
                          rows={2} placeholder={reviewMode === "revision" ? "What needs to be changed..." : "Why this is rejected..."}
                          className="flex-1 px-2 py-1 border border-[var(--border-s)] rounded text-sm" />
                      </div>
                      <button onClick={() => reviewMode === "revision" ? handleRequestRevision(sub.id) : handleReject(sub.id)} disabled={submitting}
                        className={`px-3 py-1.5 text-white rounded text-xs disabled:opacity-50 ${reviewMode === "revision" ? "bg-amber-600 hover:bg-amber-700" : "bg-[var(--er-t)] hover:bg-[var(--er-t)]"}`}>
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
