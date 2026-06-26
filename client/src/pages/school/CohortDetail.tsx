import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { formatAuditDetails } from "../../lib/auditDetails";
import { useAuth } from "../../hooks/useAuth";

type FieldTarget = "name" | "email" | "grade" | "house" | "hours" | "skip";
type ImportStep = "upload" | "map";
const FIELD_ORDER: Exclude<FieldTarget, "skip">[] = ["name", "email", "grade", "house", "hours"];
const FIELD_ALIASES: Record<Exclude<FieldTarget, "skip">, string[]> = {
  name:  ["name", "studentname", "fullname", "pupilname", "student"],
  email: ["email", "emailaddress", "studentemail", "mail", "emailaddr"],
  grade: ["grade", "gradelevel", "year", "class", "yr", "form", "gradeyear"],
  house: ["house", "homeroom", "group", "team", "section", "advisory", "formgroup"],
  hours: ["hours", "hrs", "servicehours", "hourscompleted", "completedhours", "totalhours", "volunteerhours", "startinghours"],
};
const FIELD_LABELS: Record<Exclude<FieldTarget, "skip">, string> = {
  name: "Name", email: "Email", grade: "Grade", house: "House / Homeroom", hours: "Starting Hours",
};

function suggestMapping(headers: string[]): Record<string, FieldTarget> {
  const mapping: Record<string, FieldTarget> = {};
  const used = new Set<FieldTarget>();
  for (const header of headers) {
    const normalized = header.toLowerCase().replace(/[\s_\-\.]+/g, "");
    let matched: FieldTarget = "skip";
    for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [Exclude<FieldTarget, "skip">, string[]][]) {
      if (!used.has(field) && aliases.some((a) => normalized === a || normalized.startsWith(a) || a.startsWith(normalized))) {
        matched = field;
        used.add(field);
        break;
      }
    }
    mapping[header] = matched;
  }
  return mapping;
}

function parseHeadersAndPreview(raw: string): { headers: string[]; rows: string[][] } {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows = lines.slice(1, 6).map((line) => line.split(",").map((c) => c.trim().replace(/^"|"$/g, "")));
  return { headers, rows };
}

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
  usesHouseField: boolean;
  startYear: number | null;
  endYear: number | null;
  publishedAt: string | null;
  students: Student[];
  invitations: Invitation[];
  pendingVerifications: number;
  teachers: TeacherSummary[];
}

interface TeacherSummary {
  id: string;
  name: string;
  email: string;
}

interface ImportResult {
  added: number;
  skipped: number;
  errors: ImportIssue[];
  preview?: {
    totalRows: number;
    importedRows: number;
    skippedRows: number;
  };
}

interface ImportIssue {
  row: number;
  email: string | null;
  reason: string;
}

interface HourBreakdownActor {
  id: string;
  name: string;
  role: string;
}

interface HourBreakdownAuditEntry {
  id: string;
  action: string;
  details: string | null;
  createdAt: string;
  actor: HourBreakdownActor;
}

interface HourBreakdownRecord {
  id: string;
  source: "BENEFICIARY" | "SELF_SUBMISSION" | "LEGACY_SESSION";
  title: string;
  organizationName: string;
  category?: string | null;
  date: string;
  status: string;
  verificationStatus?: string;
  displayHours: number;
  approvedHours: number;
  pendingHours: number;
  rejectionReason?: string | null;
  revisionNote?: string | null;
  timesRevised?: number;
  description?: string;
  evidenceNote?: string | null;
  reviewedAt?: string | null;
  reviewer?: HourBreakdownActor | null;
  auditTrail?: HourBreakdownAuditEntry[];
}

interface HourBreakdownData {
  student: {
    id: string;
    name: string;
    email: string;
    grade: string | null;
    cohortName: string | null;
    classroomName: string | null;
  };
  totals: {
    approved: number;
    pending: number;
    bySource: {
      beneficiary: { approved: number; pending: number; count: number };
      selfSubmission: { approved: number; pending: number; count: number };
      legacy: { approved: number; pending: number; count: number };
    };
    reconciliation: {
      expectedApproved: number;
      expectedPending: number;
      reconciled: boolean;
    };
  };
  records: {
    beneficiary: HourBreakdownRecord[];
    selfSubmission: HourBreakdownRecord[];
    legacy: HourBreakdownRecord[];
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
  const [includeHouseColumn, setIncludeHouseColumn] = useState(false);
  const [importing, setImporting] = useState(false);
  const [savingHouseField, setSavingHouseField] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importIssues, setImportIssues] = useState<ImportIssue[]>([]);
  const [importErrorMessage, setImportErrorMessage] = useState("");
  const [importStep, setImportStep] = useState<ImportStep>("upload");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvPreviewRows, setCsvPreviewRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, FieldTarget>>({});
  const [addEmail, setAddEmail] = useState("");
  const [addName, setAddName] = useState("");
  const [addGrade, setAddGrade] = useState("");
  const [addHouse, setAddHouse] = useState("");
  const [addingStudent, setAddingStudent] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [publishToast, setPublishToast] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [addingTeacher, setAddingTeacher] = useState(false);
  const [breakdownLoadingId, setBreakdownLoadingId] = useState<string | null>(null);
  const [breakdownData, setBreakdownData] = useState<HourBreakdownData | null>(null);

  const isAdmin = user?.role === "SCHOOL_ADMIN";

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get<CohortDetail>(`/cohorts/${id}`);
      setCohort(data);
      setIncludeHouseColumn(data.usesHouseField);
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
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = (ev) => {
      const raw = (ev.target?.result as string) || "";
      setCsvData(raw);
      setImportResult(null);
      setImportIssues([]);
      setImportErrorMessage("");
      const { headers, rows } = parseHeadersAndPreview(raw);
      setCsvHeaders(headers);
      setCsvPreviewRows(rows);
      setColumnMapping(suggestMapping(headers));
      setImportStep("map");
    };
    reader.readAsText(file);
  };

  const handleBackToUpload = () => {
    setImportStep("upload");
    setCsvData("");
    setCsvHeaders([]);
    setCsvPreviewRows([]);
    setColumnMapping({});
    setImportResult(null);
    setImportIssues([]);
    setImportErrorMessage("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImport = async () => {
    if (!csvData.trim()) return;
    setImporting(true);
    setImportResult(null);
    setImportIssues([]);
    setImportErrorMessage("");
    try {
      const result = await api.post<ImportResult>(`/cohorts/${id}/import`, { csvData, columnMapping });
      setImportResult(result);
      setImportIssues(result.errors ?? []);
      if ((result.errors ?? []).length === 0) {
        handleBackToUpload();
      }
      void load();
    } catch (err: any) {
      if (err instanceof ApiError && err.body && typeof err.body === "object") {
        const body = err.body as { error?: string; errors?: ImportIssue[] };
        setImportErrorMessage(body.error || err.message || "Import failed.");
        setImportIssues(body.errors ?? []);
      } else {
        setImportErrorMessage(err.message || "Import failed.");
        setImportIssues([]);
      }
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = includeHouseColumn
      ? "name,email,grade,house\nJohn Smith,john@school.edu,10th,Red\nJane Doe,jane@school.edu,11th,Blue\n"
      : "name,email,grade\nJohn Smith,john@school.edu,10th\nJane Doe,jane@school.edu,11th\n";
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

  const handleHouseFieldToggle = async (checked: boolean) => {
    if (!cohort) return;
    const previous = includeHouseColumn;
    setIncludeHouseColumn(checked);
    setSavingHouseField(true);
    setError("");
    try {
      const updated = await api.put<CohortDetail>(`/cohorts/${cohort.id}`, {
        usesHouseField: checked,
      });
      setCohort((prev) => (prev ? { ...prev, usesHouseField: updated.usesHouseField } : prev));
      if (!checked) setAddHouse("");
    } catch (err: any) {
      setIncludeHouseColumn(previous);
      setError(err.message || "Failed to update house field setting.");
    } finally {
      setSavingHouseField(false);
    }
  };

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingTeacher(true);
    setError("");
    try {
      await api.post(`/cohorts/${id}/teachers`, {
        name: teacherName,
        email: teacherEmail,
      });
      setTeacherName("");
      setTeacherEmail("");
      void load();
    } catch (err: any) {
      setError(err.message || "Failed to assign teacher.");
    } finally {
      setAddingTeacher(false);
    }
  };

  const handleRemoveTeacher = async (teacherId: string) => {
    setError("");
    try {
      await api.delete(`/cohorts/${id}/teachers/${teacherId}`);
      void load();
    } catch (err: any) {
      setError(err.message || "Failed to remove teacher.");
    }
  };

  const loadHourBreakdown = async (studentId: string) => {
    if (!user?.schoolId) return;
    setBreakdownLoadingId(studentId);
    setError("");
    try {
      const data = await api.get<HourBreakdownData>(`/schools/${user.schoolId}/students/${studentId}/hour-breakdown`);
      setBreakdownData(data);
    } catch (err: any) {
      setError(err.message || "Failed to load hour breakdown.");
    } finally {
      setBreakdownLoadingId(null);
    }
  };

  const formatHistoryDetails = formatAuditDetails;

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

  if (loading) return <div className="text-[var(--text-sec)] py-8 text-center">Loading cohort...</div>;
  if (error) return <div className="p-4 bg-[var(--er-bg)] border border-[var(--er-b)] rounded text-[var(--er-t)] text-sm">{error}</div>;
  if (!cohort) return null;

  const pendingInvitations = cohort.invitations.filter((i) => i.status === "PENDING").length;
  const cohortFilename = cohort.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const showHouseField = cohort.usesHouseField;
  const csvExample = includeHouseColumn
    ? 'name,email,grade,house\nJohn Smith,john@school.edu,10th,Red\nJane Doe,jane@school.edu,11th,Blue'
    : 'name,email,grade\nJohn Smith,john@school.edu,10th\nJane Doe,jane@school.edu,11th';

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <Link to="/cohorts" className="text-[var(--text-sec)] hover:text-[var(--text)] text-sm">← Cohorts</Link>
        <span className="text-[var(--text-faint)]">/</span>
        <h1 className="text-[20px] font-semibold">{cohort.name}</h1>
        <span className={`text-xs px-2 py-0.5 rounded-full ${cohort.status === "PUBLISHED" ? "bg-[var(--ok-bg)] text-[var(--ok-t)]" : "bg-[var(--wn-bg)] text-[var(--wn-t)]"}`}>
          {cohort.status}
        </span>
        <div className="ml-auto flex gap-2">
          {user?.schoolId && (
            <>
              <button
                type="button"
                onClick={() => handleDownload(`/schools/${user.schoolId}/students/at-risk?cohortId=${id}&format=csv`, `${cohortFilename}-at-risk.csv`, "at-risk")}
                disabled={downloadingReport !== null}
                className="px-3 py-1.5 text-xs border border-[var(--border-s)] rounded hover:bg-[var(--surface-alt)] text-[var(--text-sec)]"
              >
                {downloadingReport === "at-risk" ? "Exporting..." : "At-Risk CSV"}
              </button>
              <button
                type="button"
                onClick={() => handleDownload(`/schools/${user.schoolId}/export?cohortId=${id}`, `${cohortFilename}-students.csv`, "students")}
                disabled={downloadingReport !== null}
                className="px-3 py-1.5 text-xs border border-[var(--border-s)] rounded hover:bg-[var(--surface-alt)] text-[var(--text-sec)]"
              >
                {downloadingReport === "students" ? "Exporting..." : "Export CSV"}
              </button>
            </>
          )}
        </div>
      </div>

      {publishToast && (
        <div className="mb-4 p-3 bg-[var(--ok-bg)] border border-[var(--ok-b)] rounded text-[var(--ok-t)] text-sm">{publishToast}</div>
      )}
      <div className="mb-6 bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-4">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h2 className="font-semibold text-[var(--text)]">Teacher Owners</h2>
            <p className="text-sm text-[var(--text-sec)]">
              Assigned teachers can manage this cohort. If none are assigned, school admins retain control automatically.
            </p>
          </div>
        </div>
        {cohort.teachers.length === 0 ? (
          <div className="text-sm text-[var(--text-sec)] mb-4">No teachers assigned yet.</div>
        ) : (
          <div className="flex flex-wrap gap-2 mb-4">
            {cohort.teachers.map((teacher) => (
              <div key={teacher.id} className="flex items-center gap-2 px-3 py-2 rounded-[3px] bg-[var(--surface-alt)] border border-[var(--border)]">
                <div>
                  <div className="text-sm font-medium text-[var(--text)]">{teacher.name}</div>
                  <div className="text-xs text-[var(--text-sec)]">{teacher.email}</div>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleRemoveTeacher(teacher.id)}
                    className="text-xs text-[var(--er-t)] hover:text-[var(--er-t)]"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {isAdmin && (
            <div className="grid gap-4">
              <form onSubmit={handleAddTeacher} className="space-y-2">
                <div className="text-sm font-medium text-[var(--text)]">Assign Manually</div>
              <input
                type="text"
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                placeholder="Teacher name"
                className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)] text-sm"
                required
              />
              <input
                type="email"
                value={teacherEmail}
                onChange={(e) => setTeacherEmail(e.target.value)}
                placeholder="Teacher email"
                className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)] text-sm"
                required
              />
              <button type="submit" disabled={addingTeacher} className="h-[34px] px-4 bg-[var(--action)] text-white rounded-[2px] text-[13px] font-medium text-sm font-medium hover:opacity-85 disabled:opacity-50">
                {addingTeacher ? "Assigning..." : "Assign Teacher"}
              </button>
            </form>
          </div>
        )}
      </div>
      {isAdmin && pendingInvitations > 0 && (
        <div className="mb-4 p-3 bg-[var(--in-bg)] border border-[var(--in-b)] rounded flex justify-between items-center">
          <span className="text-sm text-[var(--navy)]">{pendingInvitations} student invitation{pendingInvitations !== 1 ? "s" : ""} still pending acceptance.</span>
          <button onClick={handlePublish} className="px-3 py-1.5 bg-[var(--action)] text-white rounded text-xs hover:bg-[var(--action)]">
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
            className={`pb-2 text-sm font-medium border-b-2 ${tab === t.key ? "border-blue-600 text-[var(--action)]" : "border-transparent text-[var(--text-sec)] hover:text-[var(--text)]"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "students" && (
        <div>
          <div className="flex gap-2 mb-4">
            <Link to={`/cohorts/${id}/on-track`}
              className="px-3 py-1.5 bg-[var(--ok-bg)] text-[var(--ok-t)] border border-[var(--ok-b)] rounded text-xs font-medium hover:bg-[var(--ok-bg)]">
              View On-Track ({cohort.students.filter((s) => (s.status ?? (s.approvedHours >= requiredHours * 0.5 ? "ON_TRACK" : "AT_RISK")) !== "AT_RISK").length})
            </Link>
            <Link to={`/cohorts/${id}/off-track`}
              className="px-3 py-1.5 bg-[var(--er-bg)] text-[var(--er-t)] border border-[var(--er-b)] rounded text-xs font-medium hover:bg-[var(--er-bg)]">
              View Off-Track ({cohort.students.filter((s) => (s.status ?? (s.approvedHours >= requiredHours * 0.5 ? "ON_TRACK" : "AT_RISK")) === "AT_RISK").length})
            </Link>
          </div>
          {isAdmin && (
            <form onSubmit={handleAddStudent} className={`mb-4 grid gap-2 ${showHouseField ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
              <input type="text" value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Name (optional)"
                className="h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)] text-sm" />
              <input type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="Student email" required
                className="h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)] text-sm" />
              <input type="text" value={addGrade} onChange={(e) => setAddGrade(e.target.value)} placeholder="Grade"
                className="h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)] text-sm" />
              {showHouseField ? (
                <div className="flex gap-2">
                  <input type="text" value={addHouse} onChange={(e) => setAddHouse(e.target.value)} placeholder="House"
                    className="h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)] text-sm flex-1" />
                  <button type="submit" disabled={addingStudent} className="h-[34px] px-4 bg-[var(--action)] text-white rounded-[2px] text-[13px] font-medium text-[13.5px] font-medium hover:opacity-85 disabled:opacity-50">
                  {addingStudent ? "Adding..." : "Add"}
                  </button>
                </div>
              ) : (
                <button type="submit" disabled={addingStudent} className="h-[34px] px-4 bg-[var(--action)] text-white rounded-[2px] text-[13px] font-medium text-[13.5px] font-medium hover:opacity-85 disabled:opacity-50">
                {addingStudent ? "Adding..." : "Add"}
                </button>
              )}
            </form>
          )}

          {cohort.students.length === 0 ? (
            <div className="text-[var(--text-sec)] text-sm py-4 text-center">No students enrolled yet.</div>
          ) : (
            <div className="border border-[var(--border)] rounded-[3px] overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[var(--surface-alt)] border-b">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-[var(--text-sec)]">Name</th>
                    <th className="text-left px-4 py-2 font-medium text-[var(--text-sec)]">Email</th>
                    <th className="text-left px-4 py-2 font-medium text-[var(--text-sec)]">Grade</th>
                    {showHouseField && <th className="text-left px-4 py-2 font-medium text-[var(--text-sec)]">House</th>}
                    <th className="text-right px-4 py-2 font-medium text-[var(--text-sec)]">Hours</th>
                    <th className="text-right px-4 py-2 font-medium text-[var(--text-sec)]">Status</th>
                    <th className="text-right px-4 py-2 font-medium text-[var(--text-sec)]">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {cohort.students.map((s) => {
                    const status = s.status ?? (s.approvedHours >= requiredHours ? "COMPLETED" : s.approvedHours >= requiredHours * 0.5 ? "ON_TRACK" : "AT_RISK");
                    return (
                      <tr key={s.id} className="hover:bg-[var(--surface-alt)]">
                        <td className="px-4 py-2">{s.name}</td>
                        <td className="px-4 py-2 text-[var(--text-sec)] text-xs">{s.email}</td>
                        <td className="px-4 py-2 text-[var(--text-sec)]">{s.grade || "-"}</td>
                        {showHouseField && <td className="px-4 py-2 text-[var(--text-sec)]">{s.house || "-"}</td>}
                        <td className="px-4 py-2 text-right">
                          <span className="font-medium">{s.approvedHours.toFixed(1)}</span>
                          <span className="text-[var(--text-faint)] text-xs">/{requiredHours}h</span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            status === "COMPLETED" ? "bg-[var(--ok-bg)] text-[var(--ok-t)]" :
                            status === "ON_TRACK" ? "bg-[var(--in-bg)] text-[var(--action)]" :
                            "bg-[var(--er-bg)] text-[var(--er-t)]"
                          }`}>{status.replace("_", " ")}</span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={() => loadHourBreakdown(s.id)}
                            disabled={breakdownLoadingId === s.id}
                            className="px-2.5 py-1 border border-[var(--border-s)] rounded text-xs text-[var(--text-sec)] hover:bg-[var(--surface-alt)] disabled:opacity-50"
                          >
                            {breakdownLoadingId === s.id ? "..." : "Hours"}
                          </button>
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

      {breakdownData && (
        <div className="fixed inset-0 z-30 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-5xl bg-[var(--surface)] rounded-[3px]  border border-[var(--border)] max-h-[88vh] overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-start justify-between gap-4">
              <div>
                <div className="font-semibold text-[var(--text)]">Student Hour Breakdown</div>
                <div className="text-sm text-[var(--text-sec)] mt-1">
                  {breakdownData.student.name} · {breakdownData.student.email}
                  {breakdownData.student.cohortName ? ` · ${breakdownData.student.cohortName}` : ""}
                </div>
              </div>
              <button onClick={() => setBreakdownData(null)} className="text-[var(--text-faint)] hover:text-[var(--text-sec)] text-sm">
                Close
              </button>
            </div>
            <div className="p-5 overflow-y-auto max-h-[75vh] space-y-6">
              <div className="grid sm:grid-cols-4 gap-3">
                <div className="rounded-[3px] border border-[var(--border)] p-3">
                  <div className="text-xs text-[var(--text-sec)]">Approved</div>
                  <div className="text-[28px] font-bold text-[var(--ok-t)]">{breakdownData.totals.approved.toFixed(1)}h</div>
                </div>
                <div className="rounded-[3px] border border-[var(--border)] p-3">
                  <div className="text-xs text-[var(--text-sec)]">Pending</div>
                  <div className="text-[28px] font-bold text-yellow-600">{breakdownData.totals.pending.toFixed(1)}h</div>
                </div>
                <div className="rounded-[3px] border border-[var(--border)] p-3">
                  <div className="text-xs text-[var(--text-sec)]">Expected Approved</div>
                  <div className="text-[28px] font-bold text-[var(--text)]">{breakdownData.totals.reconciliation.expectedApproved.toFixed(1)}h</div>
                </div>
                <div className={`rounded-[3px] border p-3 ${breakdownData.totals.reconciliation.reconciled ? "border-[var(--ok-b)] bg-[var(--ok-bg)]" : "border-[var(--er-b)] bg-[var(--er-bg)]"}`}>
                  <div className="text-xs text-[var(--text-sec)]">Reconciliation</div>
                  <div className={`text-sm font-semibold mt-1 ${breakdownData.totals.reconciliation.reconciled ? "text-[var(--ok-t)]" : "text-[var(--er-t)]"}`}>
                    {breakdownData.totals.reconciliation.reconciled ? "Reconciled" : "Mismatch detected"}
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-3">
                {([
                  { label: "Beneficiary", totals: breakdownData.totals.bySource.beneficiary },
                  { label: "Self-Submitted", totals: breakdownData.totals.bySource.selfSubmission },
                  { label: "Legacy", totals: breakdownData.totals.bySource.legacy },
                ]).map(({ label, totals }) => (
                  <div key={label} className="rounded-[3px] border border-[var(--border)] p-4">
                    <div className="text-sm font-semibold text-[var(--text)]">{label}</div>
                    <div className="text-xs text-[var(--text-sec)] mt-1">{totals.count} record{totals.count === 1 ? "" : "s"}</div>
                    <div className="mt-3 space-y-1 text-sm">
                      <div>Approved: <strong>{totals.approved.toFixed(1)}h</strong></div>
                      <div>Pending: <strong>{totals.pending.toFixed(1)}h</strong></div>
                    </div>
                  </div>
                ))}
              </div>

              {([
                { label: "Beneficiary Records", records: breakdownData.records.beneficiary },
                { label: "Self-Submitted Records", records: breakdownData.records.selfSubmission },
                { label: "Legacy Records", records: breakdownData.records.legacy },
              ] as const).map((section) => (
                <div key={section.label}>
                  <div className="font-medium text-[var(--text)] mb-3">{section.label}</div>
                  {section.records.length === 0 ? (
                    <div className="rounded-[3px] border border-dashed border-[var(--border)] p-4 text-sm text-[var(--text-sec)]">
                      No records in this source.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {section.records.map((record) => (
                        <div key={record.id} className="rounded-[3px] border border-[var(--border)] p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="font-medium text-sm text-[var(--text)]">{record.title}</div>
                              <div className="text-xs text-[var(--text-sec)] mt-1">
                                {record.organizationName} · {new Date(record.date).toLocaleDateString()}
                                {record.category ? ` · ${record.category}` : ""}
                              </div>
                              {record.source === "SELF_SUBMISSION" && record.status === "PENDING" && record.revisionNote && (
                                <div className="mt-2 inline-flex items-center rounded-full bg-[var(--wn-bg)] px-2.5 py-1 text-xs font-medium text-[var(--wn-t)] border border-[var(--wn-b)]">
                                  {`Revision ${Math.max(1, record.timesRevised ?? 1)}`}
                                </div>
                              )}
                            </div>
                            <div className="text-right text-xs">
                              <div className="font-semibold text-[var(--text)]">{record.status}{record.verificationStatus ? ` · ${record.verificationStatus}` : ""}</div>
                              <div className="text-[var(--text-sec)] mt-1">
                                {record.approvedHours > 0 ? `${record.approvedHours.toFixed(1)}h approved` : `${record.pendingHours.toFixed(1)}h pending`}
                              </div>
                            </div>
                          </div>

                          {(record.description || record.evidenceNote || record.rejectionReason || record.revisionNote) && (
                            <div className="mt-3 space-y-1 text-xs text-[var(--text-sec)]">
                              {record.description && <div>Description: {record.description}</div>}
                              {record.evidenceNote && <div>Evidence: {record.evidenceNote}</div>}
                              {record.rejectionReason && <div className="text-[var(--er-t)]">Rejected: {record.rejectionReason}</div>}
                              {record.revisionNote && (
                                <div className="text-[var(--wn-t)]">
                                  {record.status === "PENDING"
                                    ? `Revised after note (${`Revision ${Math.max(1, record.timesRevised ?? 1)}`}):`
                                    : "Revision requested:"}{" "}
                                  {record.revisionNote}
                                </div>
                              )}
                            </div>
                          )}

                          {record.reviewer && (
                            <div className="mt-3 text-xs text-[var(--text-sec)]">
                              Reviewed by {record.reviewer.name} ({record.reviewer.role})
                              {record.reviewedAt ? ` · ${new Date(record.reviewedAt).toLocaleString()}` : ""}
                            </div>
                          )}

                          {record.auditTrail && record.auditTrail.length > 0 && (
                            <div className="mt-3 space-y-2">
                              {record.auditTrail.map((entry) => (
                                <div key={entry.id} className="rounded bg-[var(--surface-alt)] border border-[var(--border)] p-2">
                                  <div className="flex justify-between gap-3">
                                    <div className="text-xs font-medium text-[var(--text)]">{entry.action}</div>
                                    <div className="text-xs text-[var(--text-faint)]">{new Date(entry.createdAt).toLocaleString()}</div>
                                  </div>
                                  <div className="text-xs text-[var(--text-sec)] mt-0.5">{entry.actor.name} · {entry.actor.role}</div>
                                  {formatHistoryDetails(entry.details) && (
                                    <div className="text-xs text-[var(--text-sec)] mt-1">{formatHistoryDetails(entry.details)}</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "analytics" && (
        <div className="space-y-6">
          {stats.total === 0 ? (
            <div className="bg-[var(--surface-alt)] border border-[var(--border)] rounded-[3px] p-8 text-center text-[var(--text-sec)]">No students enrolled yet.</div>
          ) : (
            <>
              {/* Participation */}
              <div>
                <h3 className="text-sm font-semibold text-[var(--text)] mb-3">Participation</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Total Students", value: stats.total, color: "" },
                    { label: "On Track", value: stats.onTrack, color: "text-[var(--ok-t)]" },
                    { label: "Off Track", value: stats.offTrack, color: "text-[var(--er-t)]" },
                    { label: "% On Track", value: `${stats.avgPct}%`, color: "text-[var(--ok-t)]" },
                    { label: "% Off Track", value: `${stats.offPct}%`, color: "text-[var(--er-t)]" },
                    { label: "Pending Verifications", value: cohort.pendingVerifications, color: "text-yellow-600" },
                  ].map((s) => (
                    <div key={s.label} className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-3 text-center">
                      <div className={`text-[20px] font-semibold ${s.color}`}>{s.value}</div>
                      <div className="text-xs text-[var(--text-sec)] mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hours */}
              <div>
                <h3 className="text-sm font-semibold text-[var(--text)] mb-3">Hours Metrics</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Total Verified Hours", value: stats.totalHours.toFixed(1) + "h" },
                    { label: "Mean Hours", value: stats.mean.toFixed(1) + "h" },
                    { label: "Median Hours", value: stats.median.toFixed(1) + "h" },
                    { label: "Max Hours", value: stats.highest.toFixed(1) + "h" },
                    { label: "Min Hours", value: stats.lowest.toFixed(1) + "h" },
                  ].map((s) => (
                    <div key={s.label} className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-3 text-center">
                      <div className="text-[20px] font-semibold">{s.value}</div>
                      <div className="text-xs text-[var(--text-sec)] mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Progress */}
              <div>
                <h3 className="text-sm font-semibold text-[var(--text)] mb-3">Progress</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { label: "Avg Hours / Student", value: (stats.totalHours / stats.total).toFixed(1) + "h" },
                    { label: "Avg Completion", value: `${Math.round((stats.totalHours / (stats.total * requiredHours)) * 100)}%` },
                  ].map((s) => (
                    <div key={s.label} className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-3 text-center">
                      <div className="text-[20px] font-semibold text-[var(--action)]">{s.value}</div>
                      <div className="text-xs text-[var(--text-sec)] mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Distribution */}
              <div>
                <h3 className="text-sm font-semibold text-[var(--text)] mb-3">Hours Distribution</h3>
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-4 space-y-3">
                  {Object.entries(stats.dist).map(([range, count]) => (
                    <div key={range} className="flex items-center gap-3">
                      <span className="w-14 text-xs text-[var(--text-sec)] text-right shrink-0">{range}</span>
                      <div className="flex-1 bg-[var(--surface-alt)] rounded h-6 relative overflow-hidden">
                        <div
                          className="bg-[var(--action)] h-6 rounded transition-all"
                          style={{ width: `${stats.total > 0 ? Math.round((count / stats.total) * 100) : 0}%` }}
                        />
                      </div>
                      <span className="w-8 text-xs text-[var(--text-sec)] text-right shrink-0">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "invitations" && (
        <div className="border border-[var(--border)] rounded-[3px] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-alt)] border-b">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-[var(--text-sec)]">Email</th>
                <th className="text-left px-4 py-2 font-medium text-[var(--text-sec)]">Name</th>
                <th className="text-left px-4 py-2 font-medium text-[var(--text-sec)]">Grade</th>
                {showHouseField && <th className="text-left px-4 py-2 font-medium text-[var(--text-sec)]">House</th>}
                <th className="text-left px-4 py-2 font-medium text-[var(--text-sec)]">Status</th>
                <th className="text-left px-4 py-2 font-medium text-[var(--text-sec)]">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {cohort.invitations.map((inv) => (
                <tr key={inv.id} className="hover:bg-[var(--surface-alt)]">
                  <td className="px-4 py-2">{inv.email}</td>
                  <td className="px-4 py-2 text-[var(--text-sec)]">{inv.name || "-"}</td>
                  <td className="px-4 py-2 text-[var(--text-sec)]">{inv.grade || "-"}</td>
                  {showHouseField && <td className="px-4 py-2 text-[var(--text-sec)]">{inv.house || "-"}</td>}
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      inv.status === "ACCEPTED" ? "bg-[var(--ok-bg)] text-[var(--ok-t)]" :
                      inv.status === "PENDING" ? "bg-[var(--wn-bg)] text-[var(--wn-t)]" :
                      "bg-[var(--surface-alt)] text-[var(--text-sec)]"
                    }`}>{inv.status}</span>
                  </td>
                  <td className="px-4 py-2 text-[var(--text-sec)] text-xs">{new Date(inv.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {cohort.invitations.length === 0 && (
                <tr><td colSpan={showHouseField ? 6 : 5} className="px-4 py-6 text-center text-[var(--text-faint)]">No invitations sent yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "import" && isAdmin && (() => {
        const activeMapped = FIELD_ORDER
          .filter((f) => Object.values(columnMapping).includes(f))
          .map((f) => ({ target: f, col: Object.entries(columnMapping).find(([, v]) => v === f)![0] }));
        const nonSkipTargets = Object.values(columnMapping).filter((v) => v !== "skip");
        const mappingErrors: string[] = [];
        if (!nonSkipTargets.includes("name")) mappingErrors.push("Map a column to Name (required)");
        if (!nonSkipTargets.includes("email")) mappingErrors.push("Map a column to Email (required)");
        if (new Set(nonSkipTargets).size < nonSkipTargets.length) mappingErrors.push("Each field can only be mapped to one column");

        return (
          <div className="max-w-2xl">
            <h2 className="font-semibold mb-4">CSV Import</h2>

            {importResult && (
              <div className={`mb-4 p-3 rounded text-sm border ${importResult.errors?.length ? "bg-[var(--wn-bg)] border-[var(--wn-b)]" : "bg-[var(--ok-bg)] border-[var(--ok-b)]"}`}>
                <div>
                  Import complete: <strong>{importResult.added}</strong> added, <strong>{importResult.skipped}</strong> skipped.
                  {importResult.preview && <span className="text-[var(--text-sec)]"> ({importResult.preview.totalRows} rows processed)</span>}
                </div>
                {importResult.errors?.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-amber-900">
                    {importResult.errors.slice(0, 10).map((e) => (
                      <li key={`${e.row}-${e.email ?? "x"}`}>Row {e.row}{e.email ? ` (${e.email})` : ""}: {e.reason}</li>
                    ))}
                    {importResult.errors.length > 10 && <li className="text-[var(--wn-t)]">…and {importResult.errors.length - 10} more</li>}
                  </ul>
                )}
              </div>
            )}

            {importErrorMessage && (
              <div className="mb-4 p-3 rounded text-sm border bg-[var(--er-bg)] border-[var(--er-b)] text-[var(--er-t)]">
                <div className="font-medium">{importErrorMessage}</div>
                {importIssues.length > 0 && <div className="mt-1 text-xs">{importIssues.length} problem{importIssues.length === 1 ? "" : "s"} found.</div>}
              </div>
            )}

            {importStep === "upload" && (
              <>
                <p className="text-sm text-[var(--text-sec)] mb-4">Upload a CSV file — any format. You'll map the columns before importing.</p>
                <label className="mb-4 flex items-center gap-2 text-sm text-[var(--text)]">
                  <input type="checkbox" checked={includeHouseColumn} onChange={(e) => void handleHouseFieldToggle(e.target.checked)} disabled={savingHouseField} className="rounded border-[var(--border-s)]" />
                  Include <code className="bg-[var(--surface-alt)] px-1 rounded">house</code> column in template
                  {savingHouseField && <span className="text-xs text-[var(--text-faint)] ml-1">Saving...</span>}
                </label>
                <div className="flex gap-2">
                  <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                  <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 border border-[var(--border-s)] rounded-[2px] text-sm hover:bg-[var(--surface-alt)]">Choose CSV File</button>
                  <button onClick={downloadTemplate} className="px-4 py-2 border border-[var(--border-s)] rounded-[2px] text-sm hover:bg-[var(--surface-alt)]">Download Template</button>
                </div>
                <div className="mt-6 p-3 bg-[var(--surface-alt)] rounded text-xs text-[var(--text-sec)]">
                  <p className="font-medium mb-1">Example format (any column names work):</p>
                  <pre className="font-mono whitespace-pre-wrap">{csvExample}</pre>
                </div>
              </>
            )}

            {importStep === "map" && (
              <>
                <button onClick={handleBackToUpload} className="text-sm text-[var(--action)] hover:underline mb-4 block">← Choose a different file</button>

                <h3 className="text-sm font-semibold mb-2">Map your columns</h3>
                <p className="text-xs text-[var(--text-sec)] mb-3">We guessed the mapping from your headers. Adjust any that are wrong, and skip columns you don't need.</p>
                <div className="rounded border border-[var(--border)] overflow-hidden mb-6">
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--surface-alt)] border-b border-[var(--border)]">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-[var(--text-sec)] text-xs">CSV Column</th>
                        <th className="text-left px-3 py-2 font-medium text-[var(--text-sec)] text-xs">Sample Values</th>
                        <th className="text-left px-3 py-2 font-medium text-[var(--text-sec)] text-xs w-44">Maps To</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvHeaders.map((header) => {
                        const idx = csvHeaders.indexOf(header);
                        const samples = csvPreviewRows.slice(0, 3).map((r) => r[idx]).filter(Boolean).join(", ");
                        return (
                          <tr key={header} className="border-t border-[var(--border)]">
                            <td className="px-3 py-2 font-mono text-xs text-[var(--text)]">{header}</td>
                            <td className="px-3 py-2 text-xs text-[var(--text-faint)] max-w-[160px] truncate">{samples || "—"}</td>
                            <td className="px-3 py-2">
                              <select
                                value={columnMapping[header] ?? "skip"}
                                onChange={(e) => setColumnMapping((prev) => ({ ...prev, [header]: e.target.value as FieldTarget }))}
                                className="text-xs border border-[var(--border-s)] rounded px-2 py-1 w-full bg-[var(--surface)]"
                              >
                                {FIELD_ORDER.map((f) => <option key={f} value={f}>{FIELD_LABELS[f]}</option>)}
                                <option value="skip">— Skip —</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {activeMapped.length > 0 && csvPreviewRows.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold mb-2">Preview <span className="font-normal text-[var(--text-faint)]">(first {csvPreviewRows.length} rows)</span></h3>
                    <div className="overflow-x-auto rounded border border-[var(--border)]">
                      <table className="w-full text-xs">
                        <thead className="bg-[var(--surface-alt)] border-b border-[var(--border)]">
                          <tr>
                            {activeMapped.map(({ target }) => (
                              <th key={target} className="text-left px-3 py-2 font-medium text-[var(--text-sec)] capitalize">{FIELD_LABELS[target]}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {csvPreviewRows.map((row, ri) => (
                            <tr key={ri} className="border-t border-[var(--border)]">
                              {activeMapped.map(({ target, col }) => {
                                const ci = csvHeaders.indexOf(col);
                                return <td key={target} className="px-3 py-2 text-[var(--text)] font-mono">{ci >= 0 ? (row[ci] || "—") : "—"}</td>;
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {mappingErrors.length > 0 && (
                  <div className="mb-4 p-3 rounded border border-[var(--er-b)] bg-[var(--er-bg)] text-sm text-[var(--er-t)] space-y-1">
                    {mappingErrors.map((e, i) => <div key={i}>{e}</div>)}
                  </div>
                )}

                <button
                  onClick={handleImport}
                  disabled={importing || mappingErrors.length > 0}
                  className="h-[34px] px-4 bg-[var(--action)] text-white rounded-[2px] text-[13px] font-medium text-[13.5px] font-medium hover:opacity-85 disabled:opacity-50"
                >
                  {importing ? "Importing..." : "Import Students"}
                </button>
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
}
