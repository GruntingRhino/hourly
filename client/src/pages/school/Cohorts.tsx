import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";

interface Cohort {
  id: string;
  name: string;
  status: string;
  requiredHours: number;
  startYear: number | null;
  endYear: number | null;
  publishedAt: string | null;
  studentCount: number;
  invitationsSent: number;
  invitationsAccepted: number;
  invitationsPending: number;
  totalHours: number;
  completedCount: number;
  atRiskCount: number;
  completionPercentage: number;
  teachers?: Array<{ id: string; name: string; email: string }>;
}

interface TeacherImportIssue {
  row: number;
  email: string | null;
  cohort: string | null;
  reason: string;
}

interface TeacherImportResult {
  assigned: number;
  created: number;
  skipped: number;
  errors: TeacherImportIssue[];
}

interface SubmissionSummary {
  id: string;
  status: string;
  organizationName: string;
  date: string;
  hours: number;
  createdAt: string;
  revisionNote: string | null;
  student: { id: string; name: string; email: string };
}

export default function SchoolCohorts() {
  const { user } = useAuth();
  const isAdmin = user?.role === "SCHOOL_ADMIN";
  const isTeacher = user?.role === "TEACHER";
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createHours, setCreateHours] = useState("");
  const [createStartYear, setCreateStartYear] = useState("");
  const [creating, setCreating] = useState(false);
  const [publishToast, setPublishToast] = useState("");
  const [teacherCsvData, setTeacherCsvData] = useState("");
  const [teacherImporting, setTeacherImporting] = useState(false);
  const [teacherImportResult, setTeacherImportResult] = useState<TeacherImportResult | null>(null);
  const [downloadingReport, setDownloadingReport] = useState<string | null>(null);
  const [pendingSubmissions, setPendingSubmissions] = useState<SubmissionSummary[]>([]);
  const [revisionSubmissions, setRevisionSubmissions] = useState<SubmissionSummary[]>([]);

  const loadCohorts = async () => {
    setLoading(true);
    try {
      const [cohortData, pendingData, revisionData] = await Promise.all([
        api.get<Cohort[]>("/cohorts"),
        api.get<SubmissionSummary[]>("/self-submissions?status=PENDING").catch(() => []),
        api.get<SubmissionSummary[]>("/self-submissions?status=REVISION_REQUESTED").catch(() => []),
      ]);
      setCohorts(cohortData);
      setPendingSubmissions(pendingData);
      setRevisionSubmissions(revisionData);
    } catch {
      setError("Could not load cohorts. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadCohorts(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post("/cohorts", {
        name: createName,
        requiredHours: createHours ? parseFloat(createHours) : undefined,
        startYear: createStartYear ? parseInt(createStartYear) : undefined,
        endYear: createStartYear ? parseInt(createStartYear) + 4 : undefined,
      });
      setCreateName("");
      setCreateHours("");
      setCreateStartYear("");
      setShowCreateForm(false);
      void loadCohorts();
    } catch (err: any) {
      setError(err.message || "Failed to create cohort.");
    } finally {
      setCreating(false);
    }
  };

  const handlePublish = async (cohortId: string) => {
    try {
      const result = await api.post<any>(`/cohorts/${cohortId}/publish`);
      setPublishToast(`Resent ${result.sent} invitation${result.sent !== 1 ? "s" : ""}.${result.failed > 0 ? ` ${result.failed} failed.` : ""}`);
      setTimeout(() => setPublishToast(""), 4000);
      void loadCohorts();
    } catch (err: any) {
      setError(err.message || "Failed to resend invitations.");
    }
  };

  const handleTeacherImport = async () => {
    if (!teacherCsvData.trim()) return;
    setTeacherImporting(true);
    setError("");
    try {
      const result = await api.post<TeacherImportResult>("/cohorts/teachers/import", { csvData: teacherCsvData });
      setTeacherImportResult(result);
      if ((result.errors ?? []).length === 0) {
        setTeacherCsvData("");
      }
      void loadCohorts();
    } catch (err: any) {
      setError(err.message || "Failed to import teacher assignments.");
    } finally {
      setTeacherImporting(false);
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
      setError(err.message || "Failed to export CSV.");
    } finally {
      setDownloadingReport(null);
    }
  };

  if (loading) return <div className="text-gray-500 py-8 text-center">Loading cohorts...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-[22px] font-bold text-gray-900">{isTeacher ? "Assigned Cohorts" : "Cohorts"}</h1>
        <div className="flex items-center gap-2">
          {user?.schoolId && (
            <>
              <button
                type="button"
                onClick={() => handleDownload(`/schools/${user.schoolId}/export`, "all-students.csv", "students")}
                disabled={downloadingReport !== null}
                className="px-3 py-[7px] bg-white border border-gray-300 rounded-md text-[13px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {downloadingReport === "students" ? "Exporting..." : "Student CSV"}
              </button>
              <button
                type="button"
                onClick={() => handleDownload(`/cohorts/export`, isTeacher ? "assigned-cohorts.csv" : "school-cohorts.csv", "cohorts")}
                disabled={downloadingReport !== null}
                className="px-3 py-[7px] bg-white border border-gray-300 rounded-md text-[13px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {downloadingReport === "cohorts" ? "Exporting..." : "Cohort CSV"}
              </button>
              <button
                type="button"
                onClick={() => handleDownload(`/schools/${user.schoolId}/students/at-risk?format=csv`, "at-risk-students.csv", "at-risk")}
                disabled={downloadingReport !== null}
                className="px-3 py-[7px] bg-white border border-gray-300 rounded-md text-[13px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {downloadingReport === "at-risk" ? "Exporting..." : "At-Risk CSV"}
              </button>
            </>
          )}
          {isAdmin && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-[7px] bg-blue-600 text-white rounded-md text-[13.5px] font-medium hover:opacity-85"
            >
              + New Cohort
            </button>
          )}
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}
      {publishToast && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">{publishToast}</div>}
      {isAdmin && (
        <div className="mb-6 bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="font-semibold mb-2">Assign Teachers by CSV</h2>
          <div className="text-xs text-gray-500 mb-3">Headers must be exactly <span className="font-mono">name,email,cohort</span>. Cohort must match the cohort name exactly.</div>
          <textarea
            value={teacherCsvData}
            onChange={(e) => setTeacherCsvData(e.target.value)}
            rows={6}
            placeholder={"name,email,cohort\nJamie Smith,jamie@school.edu,PW Cohort B"}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
          />
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={handleTeacherImport}
              disabled={teacherImporting}
              className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {teacherImporting ? "Importing..." : "Import Teacher Assignments"}
            </button>
          </div>
          {teacherImportResult && (
            <div className="mt-3 text-xs bg-gray-50 border border-gray-200 rounded p-3 space-y-1">
              <div>{teacherImportResult.assigned} existing teacher assignment{teacherImportResult.assigned === 1 ? "" : "s"} added.</div>
              <div>{teacherImportResult.created} new teacher account{teacherImportResult.created === 1 ? "" : "s"} created and assigned.</div>
              {teacherImportResult.skipped > 0 && <div>{teacherImportResult.skipped} row{teacherImportResult.skipped === 1 ? "" : "s"} skipped.</div>}
              {teacherImportResult.errors.map((issue) => (
                <div key={`${issue.row}-${issue.email || "unknown"}-${issue.cohort || "unknown"}`} className="text-red-600">
                  Row {issue.row}{issue.email ? ` (${issue.email})` : ""}{issue.cohort ? ` · ${issue.cohort}` : ""}: {issue.reason}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {showCreateForm && (
        <div className="mb-6 bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="font-semibold mb-4">Create Cohort</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">Cohort Name *</label>
                <input type="text" value={createName} onChange={(e) => setCreateName(e.target.value)} required
                  placeholder="Class of 2028" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Required Hours</label>
                <input type="number" value={createHours} onChange={(e) => setCreateHours(e.target.value)}
                  placeholder="Use school goal" min={0} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Start Year</label>
                <input type="number" value={createStartYear} onChange={(e) => setCreateStartYear(e.target.value)}
                  placeholder="e.g. 2024" min={2020} max={2040} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={creating} className="px-4 py-[7px] bg-blue-600 text-white rounded-md text-[13.5px] font-medium hover:opacity-85 disabled:opacity-50">
                {creating ? "Creating..." : "Create"}
              </button>
              <button type="button" onClick={() => setShowCreateForm(false)} className="px-3 py-[7px] text-[13.5px] text-gray-500 hover:text-gray-800">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="mb-6 bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-[15px] font-semibold text-gray-900">Self-Submitted Hours</h2>
            <p className="text-sm text-gray-500 mt-1">
              Review queue now sits alongside cohorts instead of consuming a dedicated top-level tab.
            </p>
          </div>
          <Link
            to="/submissions"
            className="px-3.5 py-[7px] bg-white border border-gray-200 rounded-md text-[13px] font-medium text-gray-700 hover:bg-gray-50"
          >
            Open Review Queue
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 mb-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Pending Review</div>
            <div className="mt-1 text-2xl font-bold text-gray-900">{pendingSubmissions.length}</div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-amber-700">Needs Revision</div>
            <div className="mt-1 text-2xl font-bold text-amber-800">{revisionSubmissions.length}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Latest Activity</div>
            <div className="mt-1 text-sm font-medium text-gray-900">
              {(pendingSubmissions[0] || revisionSubmissions[0])
                ? new Date((pendingSubmissions[0] || revisionSubmissions[0])!.createdAt).toLocaleDateString()
                : "No active requests"}
            </div>
          </div>
        </div>

        {(pendingSubmissions.length > 0 || revisionSubmissions.length > 0) ? (
          <div className="space-y-2">
            {[...pendingSubmissions.slice(0, 3), ...revisionSubmissions.slice(0, 2)].map((submission) => (
              <Link
                key={submission.id}
                to="/submissions"
                className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 px-4 py-3 hover:bg-gray-50"
              >
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {submission.student.name} · {submission.organizationName}
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    {submission.hours}h · {new Date(submission.date).toLocaleDateString()}
                  </div>
                  {submission.revisionNote && (
                    <div className="text-xs text-amber-700 mt-1">{submission.revisionNote}</div>
                  )}
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                  submission.status === "REVISION_REQUESTED"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-blue-50 text-blue-700"
                }`}>
                  {submission.status === "REVISION_REQUESTED" ? "Needs revision" : "Pending"}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
            No active self-submitted hour requests.
          </div>
        )}
      </div>

      {cohorts.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-[13.5px] text-gray-500">
          No cohorts yet. Create one to get started.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {cohorts.map((cohort) => (
            <div key={cohort.id} className="bg-white border border-gray-200 rounded-lg p-[18px]">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2.5">
                  <div>
                    <div className="font-bold text-[15px] text-gray-900">{cohort.name}</div>
                    {(cohort.startYear || cohort.endYear) && (
                    <div className="text-[12.5px] text-gray-500 mt-0.5">
                      {cohort.startYear && cohort.endYear ? `${cohort.startYear}–${cohort.endYear}` : cohort.startYear ?? cohort.endYear} · {cohort.requiredHours}h goal
                    </div>
                  )}
                  {!!cohort.teachers?.length && (
                    <div className="mt-1 text-[12px] text-gray-500">
                      Teachers: {cohort.teachers.map((teacher) => teacher.name).join(", ")}
                    </div>
                  )}
                </div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded uppercase tracking-wide ${
                    cohort.status === "PUBLISHED" ? "bg-blue-50 text-blue-600" :
                    cohort.status === "ARCHIVED" ? "bg-gray-100 text-gray-500" :
                    "bg-amber-50 text-amber-600"
                  }`}>{cohort.status.toLowerCase()}</span>
                </div>
                <div className="flex gap-2">
                  {user?.schoolId && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleDownload(`/schools/${user.schoolId}/export?cohortId=${cohort.id}`, `${cohort.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-students.csv`, `students-${cohort.id}`)}
                        disabled={downloadingReport !== null}
                        className="px-3.5 py-[7px] bg-white border border-gray-200 rounded-md text-[13px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        {downloadingReport === `students-${cohort.id}` ? "Exporting..." : "Students CSV"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownload(`/schools/${user.schoolId}/students/at-risk?cohortId=${cohort.id}&format=csv`, `${cohort.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-at-risk.csv`, `at-risk-${cohort.id}`)}
                        disabled={downloadingReport !== null}
                        className="px-3.5 py-[7px] bg-white border border-gray-200 rounded-md text-[13px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        {downloadingReport === `at-risk-${cohort.id}` ? "Exporting..." : "At-Risk CSV"}
                      </button>
                    </>
                  )}
                  <Link
                    to={`/cohorts/${cohort.id}`}
                    className="px-3.5 py-[7px] bg-white border border-gray-200 rounded-md text-[13px] font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Manage
                  </Link>
                  {isAdmin && cohort.invitationsPending > 0 && (
                    <button
                      onClick={() => handlePublish(cohort.id)}
                      className="px-3.5 py-[7px] bg-blue-600 text-white rounded-md text-[13px] font-medium hover:opacity-85"
                    >
                      Resend Invites
                    </button>
                  )}
                </div>
              </div>

              <div className="flex gap-6 mb-3">
                {[
                  { label: "Students", value: cohort.studentCount, color: "text-gray-900" },
                  { label: "Pending Invites", value: cohort.invitationsPending, color: "text-gray-500" },
                  { label: "On-Track", value: cohort.studentCount - cohort.atRiskCount, color: "text-green-600" },
                  { label: "Off-Track", value: cohort.atRiskCount, color: cohort.atRiskCount > 0 ? "text-red-500" : "text-gray-400" },
                  { label: "Avg Hours", value: cohort.studentCount > 0 ? `${(cohort.totalHours / cohort.studentCount).toFixed(1)}h` : "0h", color: "text-blue-600" },
                ].map((stat) => (
                  <div key={stat.label}>
                    <div className={`text-lg font-bold ${stat.color}`}>{stat.value}</div>
                    <div className="text-[11.5px] text-gray-500">{stat.label}</div>
                  </div>
                ))}
              </div>

              {cohort.studentCount > 0 && (
                <>
                  <div className="w-full bg-gray-200 rounded-full h-[5px]">
                    <div
                      className={`h-[5px] rounded-full ${cohort.completionPercentage >= 80 ? "bg-green-500" : cohort.completionPercentage >= 50 ? "bg-amber-400" : "bg-red-400"}`}
                      style={{ width: `${cohort.completionPercentage}%` }}
                    />
                  </div>
                  <div className="text-[11.5px] text-gray-400 mt-1">{cohort.completionPercentage}% completed {cohort.requiredHours}h goal</div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
