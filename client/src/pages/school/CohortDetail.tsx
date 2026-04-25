import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";

interface Student {
  id: string;
  name: string;
  email: string;
  grade: string | null;
  house: string | null;
  approvedHours: number;
  pendingHours?: number;
  status?: "COMPLETED" | "ON_TRACK" | "AT_RISK";
  riskReasons?: string[];
}

interface Invitation {
  id: string;
  email: string;
  name: string | null;
  grade: string | null;
  house: string | null;
  status: string;
  createdAt: string;
  expiresAt: string;
}

interface CohortDetail {
  id: string;
  name: string;
  status: string;
  requiredHours: number;
  startYear: number | null;
  endYear: number | null;
  publishedAt: string | null;
  students: Student[];
  invitations: Invitation[];
  pendingVerifications: number;
}

interface ImportResult {
  added: number;
  skipped: number;
  errors: Array<{ row: number; email: string | null; reason: string }>;
  preview?: {
    totalRows: number;
    importedRows: number;
    skippedRows: number;
  };
}

export default function CohortDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [cohort, setCohort] = useState<CohortDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"students" | "invitations" | "import" | "analytics">("students");
  const [csvData, setCsvData] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [addEmail, setAddEmail] = useState("");
  const [addName, setAddName] = useState("");
  const [addGrade, setAddGrade] = useState("");
  const [addHouse, setAddHouse] = useState("");
  const [addingStudent, setAddingStudent] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [publishToast, setPublishToast] = useState("");

  const isAdmin = user?.role === "SCHOOL_ADMIN";

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get<CohortDetail>(`/cohorts/${id}`);
      setCohort(data);
    } catch {
      setError("Failed to load cohort.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [id]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvData((ev.target?.result as string) || "");
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!csvData.trim()) return;
    setImporting(true);
    setImportResult(null);
    try {
      const result = await api.post<ImportResult>(`/cohorts/${id}/import`, { csvData });
      setImportResult(result);
      setCsvData("");
      void load();
    } catch (err: any) {
      setError(err.message || "Import failed.");
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = "name,email,grade,house\nJohn Smith,john@school.edu,10th,Red\nJane Doe,jane@school.edu,11th,Blue\n";
    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${cohortFilename || "cohort"}-import-template.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingStudent(true);
    try {
      await api.post(`/cohorts/${id}/add-student`, {
        email: addEmail,
        name: addName || undefined,
        grade: addGrade || undefined,
        house: addHouse || undefined,
      });
      setAddEmail("");
      setAddName("");
      setAddGrade("");
      setAddHouse("");
      void load();
    } catch (err: any) {
      setError(err.message || "Failed to add student.");
    } finally {
      setAddingStudent(false);
    }
  };

  const handlePublish = async () => {
    try {
      const result = await api.post<any>(`/cohorts/${id}/publish`);
      setPublishToast(`Resent ${result.sent} invitation${result.sent !== 1 ? "s" : ""}.`);
      setTimeout(() => setPublishToast(""), 4000);
      void load();
    } catch (err: any) {
      setError(err.message || "Failed to resend invitations.");
    }
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
      setError(err.message || "Failed to export cohort report.");
    } finally {
      setDownloadingReport(null);
    }
  };

  const requiredHours = cohort?.requiredHours ?? 0;

  const stats = useMemo(() => {
    if (!cohort) return { total: 0, active: 0, onTrack: 0, offTrack: 0, totalHours: 0, mean: 0, median: 0, highest: 0, lowest: 0, avgPct: 0, offPct: 0, dist: { "0–10h": 0, "10–25h": 0, "25–50h": 0, "50+h": 0 } };
    const hours = cohort.students.map((s) => s.approvedHours);
    const total = cohort.students.length;
    const active = cohort.students.filter((s) => s.approvedHours > 0).length;
    const onTrack = cohort.students.filter((s) => (s.status ?? (s.approvedHours >= requiredHours * 0.5 ? "ON_TRACK" : "AT_RISK")) !== "AT_RISK").length;
    const offTrack = cohort.students.filter((s) => (s.status ?? (s.approvedHours >= requiredHours * 0.5 ? "ON_TRACK" : "AT_RISK")) === "AT_RISK").length;
    const totalHours = hours.reduce((a, b) => a + b, 0);
    const mean = total > 0 ? totalHours / total : 0;
    const sorted = [...hours].sort((a, b) => a - b);
    const median = sorted.length > 0
      ? sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)]
      : 0;
    const highest = sorted.length > 0 ? sorted[sorted.length - 1] : 0;
    const lowest = sorted.length > 0 ? sorted[0] : 0;
    const avgPct = total > 0 ? Math.round((onTrack / total) * 100) : 0;
    const offPct = total > 0 ? Math.round((offTrack / total) * 100) : 0;
    const dist = {
      "0–10h": hours.filter((h) => h < 10).length,
      "10–25h": hours.filter((h) => h >= 10 && h < 25).length,
      "25–50h": hours.filter((h) => h >= 25 && h < 50).length,
      "50+h": hours.filter((h) => h >= 50).length,
    };
    return { total, active, onTrack, offTrack, totalHours, mean, median, highest, lowest, avgPct, offPct, dist };
  }, [cohort, requiredHours]);

  if (loading) return <div className="text-gray-500 py-8 text-center">Loading cohort...</div>;
  if (error) return <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>;
  if (!cohort) return null;

  const pendingInvitations = cohort.invitations.filter((i) => i.status === "PENDING").length;
  const cohortFilename = cohort.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <Link to="/cohorts" className="text-gray-500 hover:text-gray-800 text-sm">← Cohorts</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold">{cohort.name}</h1>
        <span className={`text-xs px-2 py-0.5 rounded-full ${cohort.status === "PUBLISHED" ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
          {cohort.status}
        </span>
        <div className="ml-auto flex gap-2">
          {user?.schoolId && (
            <>
              <button
                type="button"
                onClick={() => handleDownload(`/schools/${user.schoolId}/students/at-risk?cohortId=${id}&format=csv`, `${cohortFilename}-at-risk.csv`, "at-risk")}
                disabled={downloadingReport !== null}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 text-gray-600"
              >
                {downloadingReport === "at-risk" ? "Exporting..." : "At-Risk CSV"}
              </button>
              <button
                type="button"
                onClick={() => handleDownload(`/schools/${user.schoolId}/export?cohortId=${id}`, `${cohortFilename}-students.csv`, "students")}
                disabled={downloadingReport !== null}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 text-gray-600"
              >
                {downloadingReport === "students" ? "Exporting..." : "Export CSV"}
              </button>
            </>
          )}
        </div>
      </div>

      {publishToast && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">{publishToast}</div>
      )}
      {isAdmin && pendingInvitations > 0 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded flex justify-between items-center">
          <span className="text-sm text-blue-800">{pendingInvitations} student invitation{pendingInvitations !== 1 ? "s" : ""} still pending acceptance.</span>
          <button onClick={handlePublish} className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">
            Resend Invites
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 border-b mb-6">
        {([
          { key: "students", label: `Enrolled Students (${cohort.students.length})` },
          { key: "analytics", label: "Analytics" },
          { key: "invitations", label: `Pending Invites (${pendingInvitations})` },
          ...(isAdmin ? [{ key: "import", label: "Import" }] : []),
        ] as { key: string; label: string }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`pb-2 text-sm font-medium border-b-2 ${tab === t.key ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "students" && (
        <div>
          <div className="flex gap-2 mb-4">
            <Link to={`/cohorts/${id}/on-track`}
              className="px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded text-xs font-medium hover:bg-green-100">
              View On-Track ({cohort.students.filter((s) => (s.status ?? (s.approvedHours >= requiredHours * 0.5 ? "ON_TRACK" : "AT_RISK")) !== "AT_RISK").length})
            </Link>
            <Link to={`/cohorts/${id}/off-track`}
              className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded text-xs font-medium hover:bg-red-100">
              View Off-Track ({cohort.students.filter((s) => (s.status ?? (s.approvedHours >= requiredHours * 0.5 ? "ON_TRACK" : "AT_RISK")) === "AT_RISK").length})
            </Link>
          </div>
          {isAdmin && (
            <form onSubmit={handleAddStudent} className="mb-4 grid gap-2 sm:grid-cols-4">
              <input type="text" value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Name (optional)"
                className="px-3 py-2 border border-gray-300 rounded-md text-sm" />
              <input type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="Student email" required
                className="px-3 py-2 border border-gray-300 rounded-md text-sm" />
              <input type="text" value={addGrade} onChange={(e) => setAddGrade(e.target.value)} placeholder="Grade"
                className="px-3 py-2 border border-gray-300 rounded-md text-sm" />
              <div className="flex gap-2">
                <input type="text" value={addHouse} onChange={(e) => setAddHouse(e.target.value)} placeholder="House"
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm flex-1" />
                <button type="submit" disabled={addingStudent} className="px-4 py-[7px] bg-blue-600 text-white rounded-md text-[13.5px] font-medium hover:opacity-85 disabled:opacity-50">
                {addingStudent ? "Adding..." : "Add"}
                </button>
              </div>
            </form>
          )}

          {cohort.students.length === 0 ? (
            <div className="text-gray-500 text-sm py-4 text-center">No students enrolled yet.</div>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Name</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Email</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Grade</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">House</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600">Hours</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {cohort.students.map((s) => {
                    const status = s.status ?? (s.approvedHours >= requiredHours ? "COMPLETED" : s.approvedHours >= requiredHours * 0.5 ? "ON_TRACK" : "AT_RISK");
                    return (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2">{s.name}</td>
                        <td className="px-4 py-2 text-gray-500 text-xs">{s.email}</td>
                        <td className="px-4 py-2 text-gray-500">{s.grade || "-"}</td>
                        <td className="px-4 py-2 text-gray-500">{s.house || "-"}</td>
                        <td className="px-4 py-2 text-right">
                          <span className="font-medium">{s.approvedHours.toFixed(1)}</span>
                          <span className="text-gray-400 text-xs">/{requiredHours}h</span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            status === "COMPLETED" ? "bg-green-50 text-green-700" :
                            status === "ON_TRACK" ? "bg-blue-50 text-blue-700" :
                            "bg-red-50 text-red-600"
                          }`}>{status.replace("_", " ")}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "analytics" && (
        <div className="space-y-6">
          {stats.total === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-500">No students enrolled yet.</div>
          ) : (
            <>
              {/* Participation */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Participation</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Total Students", value: stats.total, color: "" },
                    { label: "On Track", value: stats.onTrack, color: "text-green-600" },
                    { label: "Off Track", value: stats.offTrack, color: "text-red-500" },
                    { label: "% On Track", value: `${stats.avgPct}%`, color: "text-green-600" },
                    { label: "% Off Track", value: `${stats.offPct}%`, color: "text-red-500" },
                    { label: "Pending Verifications", value: cohort.pendingVerifications, color: "text-yellow-600" },
                  ].map((s) => (
                    <div key={s.label} className="bg-white border border-gray-200 rounded-lg p-3 text-center">
                      <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hours */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Hours Metrics</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Total Verified Hours", value: stats.totalHours.toFixed(1) + "h" },
                    { label: "Mean Hours", value: stats.mean.toFixed(1) + "h" },
                    { label: "Median Hours", value: stats.median.toFixed(1) + "h" },
                    { label: "Max Hours", value: stats.highest.toFixed(1) + "h" },
                    { label: "Min Hours", value: stats.lowest.toFixed(1) + "h" },
                  ].map((s) => (
                    <div key={s.label} className="bg-white border border-gray-200 rounded-lg p-3 text-center">
                      <div className="text-xl font-bold">{s.value}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Progress */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Progress</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { label: "Avg Hours / Student", value: (stats.totalHours / stats.total).toFixed(1) + "h" },
                    { label: "Avg Completion", value: `${Math.round((stats.totalHours / (stats.total * requiredHours)) * 100)}%` },
                  ].map((s) => (
                    <div key={s.label} className="bg-white border border-gray-200 rounded-lg p-3 text-center">
                      <div className="text-xl font-bold text-blue-600">{s.value}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Distribution */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Hours Distribution</h3>
                <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                  {Object.entries(stats.dist).map(([range, count]) => (
                    <div key={range} className="flex items-center gap-3">
                      <span className="w-14 text-xs text-gray-600 text-right shrink-0">{range}</span>
                      <div className="flex-1 bg-gray-100 rounded h-6 relative overflow-hidden">
                        <div
                          className="bg-blue-400 h-6 rounded transition-all"
                          style={{ width: `${stats.total > 0 ? Math.round((count / stats.total) * 100) : 0}%` }}
                        />
                      </div>
                      <span className="w-8 text-xs text-gray-600 text-right shrink-0">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "invitations" && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Email</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Grade</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">House</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {cohort.invitations.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">{inv.email}</td>
                  <td className="px-4 py-2 text-gray-500">{inv.name || "-"}</td>
                  <td className="px-4 py-2 text-gray-500">{inv.grade || "-"}</td>
                  <td className="px-4 py-2 text-gray-500">{inv.house || "-"}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      inv.status === "ACCEPTED" ? "bg-green-50 text-green-700" :
                      inv.status === "PENDING" ? "bg-yellow-50 text-yellow-700" :
                      "bg-gray-100 text-gray-500"
                    }`}>{inv.status}</span>
                  </td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{new Date(inv.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {cohort.invitations.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">No invitations sent yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "import" && isAdmin && (
        <div className="max-w-lg">
          <h2 className="font-semibold mb-3">CSV Import</h2>
          <p className="text-sm text-gray-600 mb-4">
            Upload a CSV file with columns: <code className="bg-gray-100 px-1 rounded">name, email, grade, house</code> (name and email required).
          </p>

          {importResult && (
            <div className={`mb-4 p-3 rounded text-sm border ${importResult.errors?.length ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"}`}>
              <div>
                Import complete: <strong>{importResult.added}</strong> added, <strong>{importResult.skipped}</strong> skipped.
                {importResult.preview && (
                  <span className="text-gray-500"> ({importResult.preview.totalRows} rows processed)</span>
                )}
              </div>
              {importResult.errors?.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs font-semibold text-amber-800 mb-1">Rows that need attention</div>
                  <ul className="space-y-1 text-xs text-amber-900">
                    {importResult.errors.slice(0, 10).map((entry) => (
                      <li key={`${entry.row}-${entry.email ?? "missing"}`}>
                        Row {entry.row}{entry.email ? ` (${entry.email})` : ""}: {entry.reason}
                      </li>
                    ))}
                  </ul>
                  {importResult.errors.length > 10 && (
                    <div className="mt-2 text-xs text-amber-700">
                      Showing first 10 issues of {importResult.errors.length}.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
              <div className="flex gap-2">
                <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50">
                  Choose CSV File
                </button>
                <button onClick={downloadTemplate} className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50">
                  Download Template
                </button>
              </div>
            </div>
            {csvData && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Preview (first 200 chars): {csvData.slice(0, 200)}{csvData.length > 200 ? "..." : ""}</p>
                <button onClick={handleImport} disabled={importing} className="px-4 py-[7px] bg-blue-600 text-white rounded-md text-[13.5px] font-medium hover:opacity-85 disabled:opacity-50">
                  {importing ? "Importing..." : "Import Students"}
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 p-3 bg-gray-50 rounded text-xs text-gray-600">
            <p className="font-medium mb-1">CSV Format Example:</p>
            <pre className="font-mono">name,email,grade,house{"\n"}John Smith,john@school.edu,10th,Red{"\n"}Jane Doe,jane@school.edu,11th,Blue</pre>
          </div>
        </div>
      )}
    </div>
  );
}
