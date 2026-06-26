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

  if (loading) return <div className="text-[var(--text-sec)] py-8 text-center">Loading cohorts...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-[20px] font-semibold text-[var(--text)]">{isTeacher ? "Assigned Cohorts" : "Cohorts"}</h1>
        <div className="flex items-center gap-2">
          {user?.schoolId && (
            <>
              <button
                type="button"
                onClick={() => handleDownload(`/schools/${user.schoolId}/export`, "all-students.csv", "students")}
                disabled={downloadingReport !== null}
                className="px-3 py-[7px] bg-[var(--surface)] border border-[var(--border-s)] rounded-[2px] text-[13px] font-medium text-[var(--text)] hover:bg-[var(--surface-alt)] disabled:opacity-50"
              >
                {downloadingReport === "students" ? "Exporting..." : "Student CSV"}
              </button>
              <button
                type="button"
                onClick={() => handleDownload(`/cohorts/export`, isTeacher ? "assigned-cohorts.csv" : "school-cohorts.csv", "cohorts")}
                disabled={downloadingReport !== null}
                className="px-3 py-[7px] bg-[var(--surface)] border border-[var(--border-s)] rounded-[2px] text-[13px] font-medium text-[var(--text)] hover:bg-[var(--surface-alt)] disabled:opacity-50"
              >
                {downloadingReport === "cohorts" ? "Exporting..." : "Cohort CSV"}
              </button>
              <button
                type="button"
                onClick={() => handleDownload(`/schools/${user.schoolId}/students/at-risk?format=csv`, "at-risk-students.csv", "at-risk")}
                disabled={downloadingReport !== null}
                className="px-3 py-[7px] bg-[var(--surface)] border border-[var(--border-s)] rounded-[2px] text-[13px] font-medium text-[var(--text)] hover:bg-[var(--surface-alt)] disabled:opacity-50"
              >
                {downloadingReport === "at-risk" ? "Exporting..." : "At-Risk CSV"}
              </button>
            </>
          )}
          {isAdmin && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="h-[34px] px-4 bg-[var(--action)] text-white rounded-[2px] text-[13px] font-medium text-[13.5px] font-medium hover:opacity-85"
            >
              + New Cohort
            </button>
          )}
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-[var(--er-bg)] border border-[var(--er-b)] rounded text-[var(--er-t)] text-sm">{error}</div>}
      {publishToast && <div className="mb-4 p-3 bg-[var(--ok-bg)] border border-[var(--ok-b)] rounded text-[var(--ok-t)] text-sm">{publishToast}</div>}
      {isAdmin && (
        <div className="mb-6 bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-4">
          <h2 className="font-semibold mb-2">Assign Teachers by CSV</h2>
          <div className="text-xs text-[var(--text-sec)] mb-3">Headers must be exactly <span className="font-mono">name,email,cohort</span>. Cohort must match the cohort name exactly.</div>
          <textarea
            value={teacherCsvData}
            onChange={(e) => setTeacherCsvData(e.target.value)}
            rows={6}
            placeholder={"name,email,cohort\nJamie Smith,jamie@school.edu,PW Cohort B"}
            className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)] text-sm font-mono"
          />
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={handleTeacherImport}
              disabled={teacherImporting}
              className="px-4 py-2 bg-[var(--surface)] border border-[var(--border-s)] rounded-[2px] text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-alt)] disabled:opacity-50"
            >
              {teacherImporting ? "Importing..." : "Import Teacher Assignments"}
            </button>
          </div>
          {teacherImportResult && (
            <div className="mt-3 text-xs bg-[var(--surface-alt)] border border-[var(--border)] rounded p-3 space-y-1">
              <div>{teacherImportResult.assigned} existing teacher assignment{teacherImportResult.assigned === 1 ? "" : "s"} added.</div>
              <div>{teacherImportResult.created} new teacher account{teacherImportResult.created === 1 ? "" : "s"} created and assigned.</div>
              {teacherImportResult.skipped > 0 && <div>{teacherImportResult.skipped} row{teacherImportResult.skipped === 1 ? "" : "s"} skipped.</div>}
              {teacherImportResult.errors.map((issue) => (
                <div key={`${issue.row}-${issue.email || "unknown"}-${issue.cohort || "unknown"}`} className="text-[var(--er-t)]">
                  Row {issue.row}{issue.email ? ` (${issue.email})` : ""}{issue.cohort ? ` · ${issue.cohort}` : ""}: {issue.reason}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {showCreateForm && (
        <div className="mb-6 bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-4">
          <h2 className="font-semibold mb-4">Create Cohort</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <label className="block text-xs font-medium text-[var(--text)] mb-1">Cohort Name *</label>
                <input type="text" value={createName} onChange={(e) => setCreateName(e.target.value)} required
                  placeholder="Class of 2028" className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)] text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text)] mb-1">Required Hours</label>
                <input type="number" value={createHours} onChange={(e) => setCreateHours(e.target.value)}
                  placeholder="Use school goal" min={0} className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)] text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text)] mb-1">Start Year</label>
                <input type="number" value={createStartYear} onChange={(e) => setCreateStartYear(e.target.value)}
                  placeholder="e.g. 2024" min={2020} max={2040} className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)] text-sm" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={creating} className="h-[34px] px-4 bg-[var(--action)] text-white rounded-[2px] text-[13px] font-medium text-[13.5px] font-medium hover:opacity-85 disabled:opacity-50">
                {creating ? "Creating..." : "Create"}
              </button>
              <button type="button" onClick={() => setShowCreateForm(false)} className="px-3 py-[7px] text-[13.5px] text-[var(--text-sec)] hover:text-[var(--text)]">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="mb-6 bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--text)]">Self-Submitted Hours</h2>
            <p className="text-sm text-[var(--text-sec)] mt-1">
              Review queue now sits alongside cohorts instead of consuming a dedicated top-level tab.
            </p>
          </div>
          <Link
            to="/submissions"
            className="px-3.5 py-[7px] bg-[var(--surface)] border border-[var(--border)] rounded-[2px] text-[13px] font-medium text-[var(--text)] hover:bg-[var(--surface-alt)]"
          >
            Open Review Queue
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 mb-4">
          <div className="rounded-[3px] border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-sec)]">Pending Review</div>
            <div className="mt-1 text-[28px] font-bold text-[var(--text)]">{pendingSubmissions.length}</div>
          </div>
          <div className="rounded-[3px] border border-[var(--wn-b)] bg-[var(--wn-bg)] px-4 py-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--wn-t)]">Needs Revision</div>
            <div className="mt-1 text-[28px] font-bold text-[var(--wn-t)]">{revisionSubmissions.length}</div>
          </div>
          <div className="rounded-[3px] border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-sec)]">Latest Activity</div>
            <div className="mt-1 text-sm font-medium text-[var(--text)]">
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
                className="flex items-start justify-between gap-3 rounded-[3px] border border-[var(--border)] px-4 py-3 hover:bg-[var(--surface-alt)]"
              >
                <div>
                  <div className="text-sm font-medium text-[var(--text)]">
                    {submission.student.name} · {submission.organizationName}
                  </div>
                  <div className="text-sm text-[var(--text-sec)] mt-0.5">
                    {submission.hours}h · {new Date(submission.date).toLocaleDateString()}
                  </div>
                  {submission.revisionNote && (
                    <div className="text-xs text-[var(--wn-t)] mt-1">{submission.revisionNote}</div>
                  )}
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                  submission.status === "REVISION_REQUESTED"
                    ? "bg-[var(--wn-bg)] text-[var(--wn-t)]"
                    : "bg-[var(--in-bg)] text-[var(--action)]"
                }`}>
                  {submission.status === "REVISION_REQUESTED" ? "Needs revision" : "Pending"}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-[3px] border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--text-sec)]">
            No active self-submitted hour requests.
          </div>
        )}
      </div>

      {cohorts.length === 0 ? (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-8 text-center text-[13.5px] text-[var(--text-sec)]">
          No cohorts yet. Create one to get started.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {cohorts.map((cohort) => (
            <div key={cohort.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-[18px]">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2.5">
                  <div>
                    <div className="font-bold text-[15px] text-[var(--text)]">{cohort.name}</div>
                    {(cohort.startYear || cohort.endYear) && (
                    <div className="text-[12.5px] text-[var(--text-sec)] mt-0.5">
                      {cohort.startYear && cohort.endYear ? `${cohort.startYear}–${cohort.endYear}` : cohort.startYear ?? cohort.endYear} · {cohort.requiredHours}h goal
                    </div>
                  )}
                  {!!cohort.teachers?.length && (
                    <div className="mt-1 text-[12px] text-[var(--text-sec)]">
                      Teachers: {cohort.teachers.map((teacher) => teacher.name).join(", ")}
                    </div>
                  )}
                </div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded uppercase tracking-wide ${
                    cohort.status === "PUBLISHED" ? "bg-[var(--in-bg)] text-[var(--action)]" :
                    cohort.status === "ARCHIVED" ? "bg-[var(--surface-alt)] text-[var(--text-sec)]" :
                    "bg-[var(--wn-bg)] text-amber-600"
                  }`}>{cohort.status.toLowerCase()}</span>
                </div>
                <div className="flex gap-2">
                  {user?.schoolId && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleDownload(`/schools/${user.schoolId}/export?cohortId=${cohort.id}`, `${cohort.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-students.csv`, `students-${cohort.id}`)}
                        disabled={downloadingReport !== null}
                        className="px-3.5 py-[7px] bg-[var(--surface)] border border-[var(--border)] rounded-[2px] text-[13px] font-medium text-[var(--text)] hover:bg-[var(--surface-alt)] disabled:opacity-50"
                      >
                        {downloadingReport === `students-${cohort.id}` ? "Exporting..." : "Students CSV"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownload(`/schools/${user.schoolId}/students/at-risk?cohortId=${cohort.id}&format=csv`, `${cohort.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-at-risk.csv`, `at-risk-${cohort.id}`)}
                        disabled={downloadingReport !== null}
                        className="px-3.5 py-[7px] bg-[var(--surface)] border border-[var(--border)] rounded-[2px] text-[13px] font-medium text-[var(--text)] hover:bg-[var(--surface-alt)] disabled:opacity-50"
                      >
                        {downloadingReport === `at-risk-${cohort.id}` ? "Exporting..." : "At-Risk CSV"}
                      </button>
                    </>
                  )}
                  <Link
                    to={`/cohorts/${cohort.id}`}
                    className="px-3.5 py-[7px] bg-[var(--surface)] border border-[var(--border)] rounded-[2px] text-[13px] font-medium text-[var(--text)] hover:bg-[var(--surface-alt)]"
                  >
                    Manage
                  </Link>
                  {isAdmin && cohort.invitationsPending > 0 && (
                    <button
                      onClick={() => handlePublish(cohort.id)}
                      className="px-3.5 py-[7px] bg-[var(--action)] text-white rounded-[2px] text-[13px] font-medium hover:opacity-85"
                    >
                      Resend Invites
                    </button>
                  )}
                </div>
              </div>

              <div className="flex gap-6 mb-3">
                {[
                  { label: "Students", value: cohort.studentCount, color: "text-[var(--text)]" },
                  { label: "Pending Invites", value: cohort.invitationsPending, color: "text-[var(--text-sec)]" },
                  { label: "On-Track", value: cohort.studentCount - cohort.atRiskCount, color: "text-[var(--ok-t)]" },
                  { label: "Off-Track", value: cohort.atRiskCount, color: cohort.atRiskCount > 0 ? "text-[var(--er-t)]" : "text-[var(--text-faint)]" },
                  { label: "Avg Hours", value: cohort.studentCount > 0 ? `${(cohort.totalHours / cohort.studentCount).toFixed(1)}h` : "0h", color: "text-[var(--action)]" },
                ].map((stat) => (
                  <div key={stat.label}>
                    <div className={`text-[16px] font-semibold ${stat.color}`}>{stat.value}</div>
                    <div className="text-[11.5px] text-[var(--text-sec)]">{stat.label}</div>
                  </div>
                ))}
              </div>

              {cohort.studentCount > 0 && (
                <>
                  <div className="w-full bg-[var(--border)] rounded-full h-[5px]">
                    <div
                      className={`h-[5px] rounded-full ${cohort.completionPercentage >= 80 ? "bg-[var(--ok-bg)]0" : cohort.completionPercentage >= 50 ? "bg-amber-400" : "bg-red-400"}`}
                      style={{ width: `${cohort.completionPercentage}%` }}
                    />
                  </div>
                  <div className="text-[11.5px] text-[var(--text-faint)] mt-1">{cohort.completionPercentage}% completed {cohort.requiredHours}h goal</div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
