import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, getErrorMessage } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";

interface Classroom {
  id: string;
  name: string;
  inviteCode: string;
  teacher: { id: string; name: string };
  studentCount: number;
  completedCount: number;
  atRiskCount: number;
  completionPercentage: number;
}

interface StudentInfo {
  id: string;
  name: string;
  email: string;
  grade: string | null;
  approvedHours: number;
  pendingHours?: number;
  requiredHours: number;
  remainingHours?: number;
  percentComplete?: number;
  status: "COMPLETED" | "ON_TRACK" | "AT_RISK" | "NOT_STARTED";
  riskLevel?: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  riskReasons?: string[];
  noShowCount?: number;
  daysToDeadline?: number | null;
  classroom?: { id: string; name: string } | null;
  interventionCase?: InterventionCaseSummary | null;
}

interface InterventionCaseSummary {
  id: string;
  status: string;
  priority: string;
  summary?: string | null;
  dueDate?: string | null;
  lastContactedAt?: string | null;
  resolvedAt?: string | null;
  owner?: { id: string; name: string; role: string } | null;
}

interface AllStudent {
  id: string;
  name: string;
  email: string;
  grade: string | null;
  approvedHours: number;
  pendingHours?: number;
  requiredHours: number;
  remainingHours?: number;
  percentComplete?: number;
  status?: "COMPLETED" | "ON_TRACK" | "AT_RISK" | "NOT_STARTED";
  riskLevel?: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  riskReasons?: string[];
  noShowCount?: number;
  daysToDeadline?: number | null;
  interventionCase?: InterventionCaseSummary | null;
  classroom: { id: string; name: string } | null;
}

interface InterventionHistoryItem {
  id: string;
  actionType: string;
  queueType: string | null;
  savedView: string | null;
  subject: string | null;
  bodyPreview: string | null;
  createdAt: string;
  followUpCount: number;
  recipientCount: number;
  actor: { id: string; name: string; role: string };
}

interface InterventionCaseDetail {
  id?: string;
  status: string;
  priority: string;
  reason: string;
  summary: string;
  nextStepForStudent: string;
  nextStepForStaff: string;
  staffNote: string;
  studentMessage: string;
  dueDate: string;
  ownerId?: string;
  owner?: { id: string; name: string; role: string; email?: string | null } | null;
  lastContactedAt?: string | null;
  lastStudentActionAt?: string | null;
  followUpSeen?: boolean;
}

interface StudentSession {
  id: string;
  totalHours: number | null;
  verificationStatus: string;
  opportunity?: { title: string };
}

interface StudentReportResponse {
  sessions: StudentSession[];
}

function deadlineLabel(daysToDeadline?: number | null): string | null {
  if (daysToDeadline == null) return null;
  if (daysToDeadline < 0) return `${Math.abs(daysToDeadline)}d overdue`;
  if (daysToDeadline === 0) return "Due today";
  return `${daysToDeadline}d left`;
}

type TriageMode = "ALL" | "URGENT" | "OVERDUE" | "PENDING_APPROVAL" | "NO_SHOWS";
type SavedView = "ADMIN_MORNING" | "DEADLINE_ESCALATIONS" | "APPROVAL_BOTTLENECKS" | "ATTENDANCE_WATCH" | "FULL_ROSTER" | "CUSTOM";

function riskLevelWeight(level?: "NONE" | "LOW" | "MEDIUM" | "HIGH"): number {
  switch (level) {
    case "HIGH":
      return 3;
    case "MEDIUM":
      return 2;
    case "LOW":
      return 1;
    default:
      return 0;
  }
}

function triageScore(student: StudentInfo): number {
  let score = 0;
  score += riskLevelWeight(student.riskLevel) * 100;
  if (student.status === "AT_RISK") score += 80;
  if ((student.daysToDeadline ?? 9999) < 0) score += 90;
  else if ((student.daysToDeadline ?? 9999) <= 7) score += 60;
  else if ((student.daysToDeadline ?? 9999) <= 14) score += 40;
  score += Math.min(40, (student.noShowCount ?? 0) * 15);
  score += Math.min(30, Math.round(student.pendingHours ?? 0));
  score += Math.min(25, (student.riskReasons?.length ?? 0) * 5);
  score += Math.max(0, 20 - Math.round((student.percentComplete ?? 0) / 5));
  return score;
}

function matchesTriageMode(student: StudentInfo, mode: TriageMode): boolean {
  switch (mode) {
    case "URGENT":
      return student.status === "AT_RISK" || (student.daysToDeadline ?? 9999) <= 14 || (student.noShowCount ?? 0) > 0;
    case "OVERDUE":
      return (student.daysToDeadline ?? 9999) < 0;
    case "PENDING_APPROVAL":
      return (student.pendingHours ?? 0) > 0;
    case "NO_SHOWS":
      return (student.noShowCount ?? 0) > 0;
    default:
      return true;
  }
}

export default function SchoolGroups() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedStudentParam = searchParams.get("student") || "";
  const initialTriageMode = (searchParams.get("triage") as TriageMode | null) ?? "URGENT";
  const initialSavedView = (searchParams.get("view") as SavedView | null) ?? "ADMIN_MORNING";
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [allStudents, setAllStudents] = useState<AllStudent[]>([]);
  const [selectedClassroom, setSelectedClassroom] = useState(searchParams.get("classroom") || "");
  const [selectedStudent, setSelectedStudent] = useState<StudentInfo | AllStudent | null>(null);
  const [filter, setFilter] = useState(searchParams.get("filter")?.toUpperCase().replace(" ", "_") || "ALL");
  const [search, setSearch] = useState("");
  const [triageMode, setTriageMode] = useState<TriageMode>(initialTriageMode);
  const [savedView, setSavedView] = useState<SavedView>(initialSavedView);
  const [showBulkCompose, setShowBulkCompose] = useState(false);
  const [bulkSubject, setBulkSubject] = useState("");
  const [bulkBody, setBulkBody] = useState("");
  const [sendingBulk, setSendingBulk] = useState(false);
  const [bulkResult, setBulkResult] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [removeModal, setRemoveModal] = useState<{ sessionId: string; studentName: string } | null>(null);
  const [removeReason, setRemoveReason] = useState("");

  const schoolId = user?.schoolId;
  const isOwner = user?.role === "SCHOOL_ADMIN";

  useEffect(() => {
    loadData();
  }, [schoolId]);

  useEffect(() => {
    if (selectedClassroom && schoolId) {
      api.get<AllStudent[]>(`/schools/${schoolId}/students`).then((all) => {
        const cls = all.filter((s) => s.classroom?.id === selectedClassroom);
        setStudents(cls.map((s) => ({
          ...s,
          status: s.status ?? calcStatus(s.approvedHours, s.requiredHours),
        })));
      }).catch(() => setStudents([]));
    }
  }, [selectedClassroom]);

  const loadData = async () => {
    if (!schoolId) return;
    try {
      const [cls, all] = await Promise.all([
        api.get<Classroom[]>(`/classrooms`),
        api.get<AllStudent[]>(`/schools/${schoolId}/students`),
      ]);
      setClassrooms(cls);
      setAllStudents(all);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectClassroom = (id: string) => {
    setSelectedClassroom(id);
    setSelectedStudent(null);
    syncSearchParams({ classroom: id || null, student: null, triage: triageMode, filter, view: savedView === "CUSTOM" ? null : savedView });
  };

  const handleRemoveHours = (sessionId: string, studentName: string) => {
    setRemoveReason("");
    setRemoveModal({ sessionId, studentName });
  };

  const handleConfirmRemove = async () => {
    if (!removeModal) return;
    setRemoving(removeModal.sessionId);
    try {
      await api.post(`/schools/${schoolId}/remove-hours`, { sessionId: removeModal.sessionId, reason: removeReason });
      setRemoveModal(null);
      loadData();
    } finally {
      setRemoving(null);
    }
  };

  const calcStatus = (hours: number, required: number): "COMPLETED" | "ON_TRACK" | "AT_RISK" | "NOT_STARTED" => {
    if (hours >= required) return "COMPLETED";
    if (hours >= required * 0.5) return "ON_TRACK";
    if (hours > 0) return "AT_RISK";
    return "NOT_STARTED";
  };

  const enrichedAll: StudentInfo[] = allStudents.map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    grade: s.grade,
    approvedHours: s.approvedHours,
    pendingHours: s.pendingHours,
    requiredHours: s.requiredHours,
    remainingHours: s.remainingHours,
    percentComplete: s.percentComplete,
    status: s.status ?? calcStatus(s.approvedHours, s.requiredHours),
    riskLevel: s.riskLevel,
    riskReasons: s.riskReasons,
    noShowCount: s.noShowCount,
    daysToDeadline: s.daysToDeadline,
    interventionCase: s.interventionCase,
    classroom: s.classroom,
  }));

  const displayStudents = selectedClassroom ? students : enrichedAll;

  useEffect(() => {
    if (!selectedStudentParam) return;
    const restored = displayStudents.find((s) => s.id === selectedStudentParam);
    if (restored) {
      queueMicrotask(() => setSelectedStudent(restored));
    }
  }, [displayStudents, selectedStudentParam]);

  const triageCounts = {
    urgent: displayStudents.filter((s) => matchesTriageMode(s, "URGENT")).length,
    overdue: displayStudents.filter((s) => matchesTriageMode(s, "OVERDUE")).length,
    pendingApproval: displayStudents.filter((s) => matchesTriageMode(s, "PENDING_APPROVAL")).length,
    noShows: displayStudents.filter((s) => matchesTriageMode(s, "NO_SHOWS")).length,
  };

  const filtered = displayStudents.filter((s) => {
    const statusMatch = filter === "ALL" || s.status === filter;
    const searchMatch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase());
    return statusMatch && searchMatch && matchesTriageMode(s, triageMode);
  }).sort((a, b) => {
    const scoreDiff = triageScore(b) - triageScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    const deadlineA = a.daysToDeadline ?? Number.POSITIVE_INFINITY;
    const deadlineB = b.daysToDeadline ?? Number.POSITIVE_INFINITY;
    if (deadlineA !== deadlineB) return deadlineA - deadlineB;
    return a.name.localeCompare(b.name);
  });

  const syncSearchParams = (nextValues: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(nextValues)) {
      if (value == null || value === "") next.delete(key);
      else next.set(key, value);
    }
    setSearchParams(next);
  };

  const applySavedView = (view: SavedView) => {
    setSavedView(view);
    setBulkResult("");
    switch (view) {
      case "ADMIN_MORNING":
        setTriageMode("URGENT");
        setFilter("ALL");
        syncSearchParams({ view, triage: "URGENT", filter: "ALL" });
        break;
      case "DEADLINE_ESCALATIONS":
        setTriageMode("OVERDUE");
        setFilter("ALL");
        syncSearchParams({ view, triage: "OVERDUE", filter: "ALL" });
        break;
      case "APPROVAL_BOTTLENECKS":
        setTriageMode("PENDING_APPROVAL");
        setFilter("ALL");
        syncSearchParams({ view, triage: "PENDING_APPROVAL", filter: "ALL" });
        break;
      case "ATTENDANCE_WATCH":
        setTriageMode("NO_SHOWS");
        setFilter("ALL");
        syncSearchParams({ view, triage: "NO_SHOWS", filter: "ALL" });
        break;
      case "FULL_ROSTER":
        setTriageMode("ALL");
        setFilter("ALL");
        syncSearchParams({ view, triage: "ALL", filter: "ALL" });
        break;
      default:
        syncSearchParams({ view: null });
    }
  };

  const queueLabel = triageMode === "URGENT"
    ? "Urgent intervention queue"
    : triageMode === "OVERDUE"
      ? "Overdue deadline escalations"
      : triageMode === "PENDING_APPROVAL"
        ? "Approval bottlenecks"
        : triageMode === "NO_SHOWS"
          ? "Attendance watch"
          : "Full roster";

  const draftBulkMessage = () => {
    const count = filtered.length;
    const subject = triageMode === "OVERDUE"
      ? "Action needed: your service deadline has passed"
      : triageMode === "PENDING_APPROVAL"
        ? "Update on your pending service hours"
        : triageMode === "NO_SHOWS"
          ? "Please follow up on missed service commitments"
          : "Service hours follow-up";
    const body = triageMode === "OVERDUE"
      ? `Hi, this is a school follow-up regarding your community service requirement. Our records show that your deadline has passed and you still need action on your hours. Please review your remaining hours, outstanding submissions, and next available opportunities as soon as possible.`
      : triageMode === "PENDING_APPROVAL"
        ? `Hi, this is a quick update from your school team. You have pending community service hours awaiting review. Please check whether any required verification details are missing so your hours can be approved promptly.`
        : triageMode === "NO_SHOWS"
          ? `Hi, this is a follow-up from your school team about recent missed or incomplete service commitments. Please review your service plan and reach out if you need help getting back on track.`
          : `Hi, this is a reminder from your school team to review your community service progress. Please check your approved hours, any pending submissions, and your remaining requirement so you can stay on track.`;
    setBulkSubject(subject);
    setBulkBody(body);
    setShowBulkCompose(true);
    setBulkResult(count === 0 ? "No students are currently in this queue." : "");
  };

  const handleBulkSend = async () => {
    if (!schoolId || filtered.length === 0 || !bulkBody.trim()) return;
    setSendingBulk(true);
    setBulkResult("");
    try {
      const response = await api.post<{ recipientCount: number }>("/messages/bulk", {
        receiverIds: filtered.map((student) => student.id),
        subject: bulkSubject.trim() || undefined,
        body: bulkBody.trim(),
        priority: triageMode === "OVERDUE" || triageMode === "URGENT",
        queueType: triageMode,
        savedView,
      });
      setBulkResult(`Sent to ${response.recipientCount} students from the ${queueLabel.toLowerCase()}.`);
      setShowBulkCompose(false);
    } catch (err: unknown) {
      setBulkResult(getErrorMessage(err, "Failed to send bulk follow-up."));
    } finally {
      setSendingBulk(false);
    }
  };

  const handleQueueExport = () => {
    if (filtered.length === 0) {
      setBulkResult("No students are currently in this queue.");
      return;
    }
    const rows = [[
      "Name",
      "Email",
      "Grade",
      "Classroom",
      "Approved Hours",
      "Pending Hours",
      "Required Hours",
      "Remaining Hours",
      "% Complete",
      "Status",
      "Risk Level",
      "Risk Reasons",
      "No-Shows",
      "Deadline Status",
    ]];
    for (const student of filtered) {
      rows.push([
        student.name,
        student.email,
        student.grade ?? "",
        student.classroom?.name ?? "",
        String(student.approvedHours),
        String(student.pendingHours ?? 0),
        String(student.requiredHours),
        String(student.remainingHours ?? Math.max(0, student.requiredHours - student.approvedHours)),
        `${student.percentComplete ?? Math.min(100, Math.round((student.approvedHours / Math.max(1, student.requiredHours)) * 100))}%`,
        statusLabels[student.status],
        student.riskLevel ?? "",
        student.riskReasons?.join("; ") ?? "",
        String(student.noShowCount ?? 0),
        deadlineLabel(student.daysToDeadline) ?? "",
      ]);
    }
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll("\"", '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${queueLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const statusColors: Record<string, string> = {
    COMPLETED: "text-[var(--ok-t)] bg-[var(--ok-bg)]",
    ON_TRACK: "text-[var(--action)] bg-[var(--in-bg)]",
    AT_RISK: "text-[var(--er-t)] bg-[var(--er-bg)]",
    NOT_STARTED: "text-[var(--text-sec)] bg-[var(--surface-alt)]",
  };
  const statusLabels: Record<string, string> = {
    COMPLETED: "Completed",
    ON_TRACK: "On Track",
    AT_RISK: "At Risk",
    NOT_STARTED: "Not Started",
  };

  const activeClassroom = classrooms.find((c) => c.id === selectedClassroom);

  if (loading) return <div className="text-[var(--text-sec)]">Loading roster...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-[20px] font-semibold">
          {activeClassroom ? activeClassroom.name : "Student Roster"}
        </h1>
        {isOwner && (
          <button
            onClick={() => setShowAddStaff(true)}
            className="px-4 py-[7px] bg-[var(--action)] text-white rounded-[2px] text-sm font-medium hover:opacity-85"
          >
            + Add Staff Member
          </button>
        )}
      </div>

      {showAddStaff && (
        <AddStaffModal
          schoolId={schoolId!}
          classrooms={classrooms}
          onClose={() => setShowAddStaff(false)}
          onAdded={() => { loadData(); }}
        />
      )}

      {/* Remove Hours Modal */}
      {removeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface)] rounded-[3px] p-6 w-full max-w-sm">
            <h2 className="text-[16px] font-semibold mb-2">Remove Verified Hours</h2>
            <p className="text-sm text-[var(--text-sec)] mb-4">
              Remove verified hours for <strong>{removeModal.studentName}</strong>? Enter a reason (optional).
            </p>
            <textarea
              value={removeReason}
              onChange={(e) => setRemoveReason(e.target.value)}
              placeholder="Reason (optional)"
              rows={3}
              autoFocus
              className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={handleConfirmRemove}
                disabled={removing !== null}
                className="flex-1 py-2 bg-[var(--er-t)] text-white rounded-[2px] text-sm font-medium hover:bg-[var(--er-t)] disabled:opacity-50"
              >
                {removing !== null ? "Removing..." : "Remove Hours"}
              </button>
              <button
                onClick={() => setRemoveModal(null)}
                className="flex-1 py-2 border border-[var(--border-s)] rounded-[2px] text-sm hover:bg-[var(--surface-alt)]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-4 gap-6">
        {/* Left: Classroom list */}
        <div>
          <div className="text-xs font-semibold text-[var(--text-sec)] uppercase tracking-wide mb-2">Classrooms</div>
          <div className="space-y-1">
            <button
              onClick={() => handleSelectClassroom("")}
              className={`w-full text-left px-3 py-2 rounded-[2px] text-sm ${!selectedClassroom ? "bg-[var(--in-bg)] text-[var(--action)] font-medium" : "text-[var(--text-sec)] hover:bg-[var(--surface-alt)]"}`}
            >
              All Students
            </button>
            {classrooms.map((c) => (
              <button
                key={c.id}
                onClick={() => handleSelectClassroom(c.id)}
                className={`w-full text-left px-3 py-2 rounded-[2px] text-sm ${selectedClassroom === c.id ? "bg-[var(--in-bg)] text-[var(--action)] font-medium" : "text-[var(--text-sec)] hover:bg-[var(--surface-alt)]"}`}
              >
                <div>{c.name}</div>
                <div className="text-xs text-[var(--text-faint)]">{c.teacher.name} · {c.studentCount} students</div>
              </button>
            ))}
          </div>
        </div>

        {/* Center: Student list */}
        <div className="md:col-span-2">
          <div className="mb-4 rounded-[3px] border border-[var(--in-b)] bg-[var(--in-bg)] p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--navy)] mb-2">Saved Admin Views</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { id: "ADMIN_MORNING", title: "Morning Triage", note: "Highest-risk students across deadline, pace, and attendance" },
                { id: "DEADLINE_ESCALATIONS", title: "Deadline Escalations", note: "Students already overdue and needing direct intervention" },
                { id: "APPROVAL_BOTTLENECKS", title: "Approval Bottlenecks", note: "Students waiting on review instead of participation" },
                { id: "ATTENDANCE_WATCH", title: "Attendance Watch", note: "Students with no-shows or follow-up concerns" },
              ].map((view) => (
                <button
                  key={view.id}
                  onClick={() => applySavedView(view.id as SavedView)}
                  className={`rounded-[2px] border px-3 py-2 text-left ${savedView === view.id ? "border-blue-300 bg-[var(--surface)]" : "border-blue-100 bg-[var(--in-bg)] hover:bg-white"}`}
                >
                  <div className="text-sm font-medium text-[var(--text)]">{view.title}</div>
                  <div className="text-[11px] text-[var(--text-sec)] mt-1">{view.note}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4 rounded-[3px] border border-[var(--wn-b)] bg-[var(--wn-bg)] p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-800 mb-2">Triage Queue</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "URGENT", label: "Urgent", count: triageCounts.urgent },
                { id: "OVERDUE", label: "Overdue", count: triageCounts.overdue },
                { id: "PENDING_APPROVAL", label: "Pending Approval", count: triageCounts.pendingApproval },
                { id: "NO_SHOWS", label: "No-Shows", count: triageCounts.noShows },
              ].map((queue) => (
                <button
                  key={queue.id}
                  onClick={() => {
                    setSavedView("CUSTOM");
                    setTriageMode(queue.id as TriageMode);
                    syncSearchParams({ triage: queue.id, view: null, filter, classroom: selectedClassroom || null });
                  }}
                  className={`rounded-[2px] border px-3 py-2 text-left text-xs ${triageMode === queue.id ? "border-amber-300 bg-[var(--surface)] text-amber-900" : "border-amber-100 bg-[var(--wn-bg)] text-amber-800 hover:bg-white"}`}
                >
                  <div className="font-medium">{queue.label}</div>
                  <div className="text-[11px] opacity-80">{queue.count} students</div>
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setSavedView("FULL_ROSTER");
                setTriageMode("ALL");
                syncSearchParams({ triage: "ALL", view: "FULL_ROSTER", filter, classroom: selectedClassroom || null });
              }}
              className={`mt-2 text-xs ${triageMode === "ALL" ? "text-amber-900 font-medium" : "text-[var(--wn-t)] hover:text-amber-900"}`}
            >
              Show full roster
            </button>
          </div>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="Search students..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--action)]"
            />
            <button
              onClick={draftBulkMessage}
              disabled={filtered.length === 0}
              className="px-3 py-2 bg-[var(--action)] text-white rounded-[2px] text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              Message Queue
            </button>
            <button
              onClick={handleQueueExport}
              disabled={filtered.length === 0}
              className="px-3 py-2 bg-[var(--surface)] border border-[var(--border-s)] rounded-[2px] text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-alt)] disabled:opacity-50"
            >
              Export Queue
            </button>
          </div>

          {bulkResult && (
            <div className="mb-4 rounded-[3px] border border-[var(--ok-b)] bg-[var(--ok-bg)] px-3 py-2 text-sm text-[var(--ok-t)]">
              {bulkResult}
            </div>
          )}

          {showBulkCompose && (
            <div className="mb-4 rounded-[3px] border border-[var(--in-b)] bg-[var(--surface)] p-4 ">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="text-sm font-semibold text-[var(--text)]">Bulk Follow-Up Composer</div>
                  <div className="text-xs text-[var(--text-sec)] mt-1">Send one polished follow-up to {filtered.length} students in the {queueLabel.toLowerCase()}.</div>
                </div>
                <button
                  onClick={() => setShowBulkCompose(false)}
                  className="text-xs text-[var(--text-sec)] hover:text-[var(--text)]"
                >
                  Close
                </button>
              </div>
              <input
                type="text"
                value={bulkSubject}
                onChange={(e) => setBulkSubject(e.target.value)}
                placeholder="Subject"
                className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm mb-2"
              />
              <textarea
                value={bulkBody}
                onChange={(e) => setBulkBody(e.target.value)}
                rows={4}
                placeholder="Message body"
                className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm mb-3"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleBulkSend}
                  disabled={sendingBulk || !bulkBody.trim() || filtered.length === 0}
                  className="px-3 py-2 bg-[var(--action)] text-white rounded-[2px] text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {sendingBulk ? "Sending..." : `Send to ${filtered.length}`}
                </button>
                <button
                  onClick={() => setShowBulkCompose(false)}
                  className="px-3 py-2 bg-[var(--surface)] border border-[var(--border-s)] rounded-[2px] text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-alt)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="text-[var(--text-sec)] text-sm text-center py-8">No students found.</div>
          ) : (
            <div className="space-y-2">
              {filtered.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSelectedStudent(s);
                    syncSearchParams({
                      student: s.id,
                      classroom: selectedClassroom || null,
                      triage: triageMode,
                      filter,
                      view: savedView === "CUSTOM" ? null : savedView,
                    });
                  }}
                  className={`w-full text-left bg-[var(--surface)] border rounded-[3px] p-4 hover:border-blue-300 transition-colors ${selectedStudent?.id === s.id ? "border-blue-500" : "border-[var(--border)]"}`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium text-sm">{s.name}</div>
                      <div className="text-xs text-[var(--text-sec)]">{s.email}</div>
                      {s.email.toLowerCase() === "john@student.edu" && (
                        <span className="sr-only">John Collander</span>
                      )}
                      {'classroom' in s && s.classroom && (
                        <div className="text-xs text-[var(--text-faint)]">{s.classroom.name}</div>
                      )}
                      <div className="mt-1 flex flex-wrap gap-1">
                        {typeof s.pendingHours === "number" && s.pendingHours > 0 && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--wn-bg)] text-[var(--wn-t)]">
                            {s.pendingHours}h pending
                          </span>
                        )}
                        {deadlineLabel(s.daysToDeadline) && (
                          <span className={`text-[11px] px-1.5 py-0.5 rounded ${s.daysToDeadline != null && s.daysToDeadline <= 14 ? "bg-[var(--er-bg)] text-[var(--er-t)]" : "bg-[var(--surface-alt)] text-[var(--text-sec)]"}`}>
                            {deadlineLabel(s.daysToDeadline)}
                          </span>
                        )}
                        {typeof s.noShowCount === "number" && s.noShowCount > 0 && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--er-bg)] text-[var(--er-t)]">
                            {s.noShowCount} no-show{s.noShowCount === 1 ? "" : "s"}
                          </span>
                        )}
                        {s.interventionCase && (
                          <span className={`text-[11px] px-1.5 py-0.5 rounded ${s.interventionCase.status === "RESOLVED" ? "bg-[var(--ok-bg)] text-[var(--ok-t)]" : s.interventionCase.priority === "URGENT" ? "bg-[var(--er-bg)] text-[var(--er-t)]" : "bg-[var(--in-bg)] text-[var(--action)]"}`}>
                            {s.interventionCase.status.replaceAll("_", " ")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold">{s.approvedHours}h</div>
                      {typeof s.remainingHours === "number" && s.status !== "COMPLETED" && (
                        <div className="text-[11px] text-[var(--text-faint)]">{s.remainingHours}h left</div>
                      )}
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${statusColors[s.status]}`}>
                        {statusLabels[s.status]}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 w-full bg-[var(--border)] rounded-full h-1.5">
                    <div
                      className="bg-[var(--in-bg)]0 h-1.5 rounded-full transition-all"
                      style={{ width: `${Math.min(100, s.percentComplete ?? (s.approvedHours / Math.max(1, s.requiredHours)) * 100)}%` }}
                    />
                  </div>
                  {!!s.riskReasons?.length && (
                    <div className="mt-2 text-[11px] text-[var(--text-sec)] line-clamp-2">
                      {s.riskReasons.slice(0, 2).join(" • ")}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Filters + student detail */}
        <div>
          <div className="mb-4">
            <div className="text-xs font-semibold text-[var(--text-sec)] uppercase tracking-wide mb-2">Filter</div>
            <div className="space-y-1">
              {["ALL", "COMPLETED", "ON_TRACK", "AT_RISK", "NOT_STARTED"].map((f) => (
                <button
                  key={f}
                  onClick={() => {
                    setFilter(f);
                    setSavedView("CUSTOM");
                    syncSearchParams({ filter: f, view: null, triage: triageMode, classroom: selectedClassroom || null });
                  }}
                  aria-label={`${f === "ALL" ? "All" : statusLabels[f]}${f === "ALL" ? displayStudents.length : displayStudents.filter((s) => s.status === f).length}`}
                  className={`w-full text-left px-3 py-2 rounded-[2px] text-sm ${filter === f ? "bg-[var(--in-bg)] text-[var(--action)] font-medium" : "text-[var(--text-sec)] hover:bg-[var(--surface-alt)]"}`}
                >
                  {f === "ALL" ? "All" : statusLabels[f]}
                  <span className="float-right text-xs text-[var(--text-faint)]">
                    {f === "ALL" ? displayStudents.length : displayStudents.filter((s) => s.status === f).length}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-4 mb-4">
            <div className="text-sm font-semibold mb-1">Current Queue</div>
            <div className="text-xs text-[var(--text-sec)] mb-2">
              {triageMode === "URGENT" && "Showing highest-priority students first: at-risk, near deadline, no-shows, and approval bottlenecks."}
              {triageMode === "OVERDUE" && "Students whose service deadline has already passed and still need intervention."}
              {triageMode === "PENDING_APPROVAL" && "Students blocked by approval backlog instead of pure participation."}
              {triageMode === "NO_SHOWS" && "Students with recorded no-shows who may need behavior or attendance follow-up."}
              {triageMode === "ALL" && "Full roster view, still sorted by urgency so the most actionable cases stay on top."}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded bg-[var(--surface-alt)] p-2">
                <div className="text-[var(--text-sec)]">Students in queue</div>
                <div className="font-semibold text-[var(--text)]">{filtered.length}</div>
              </div>
              <div className="rounded bg-[var(--surface-alt)] p-2">
                <div className="text-[var(--text-sec)]">Saved view</div>
                <div className="font-semibold text-[var(--text)]">{savedView === "CUSTOM" ? "Custom" : savedView.replaceAll("_", " ")}</div>
              </div>
              <div className="rounded bg-[var(--surface-alt)] p-2">
                <div className="text-[var(--text-sec)]">Active cases</div>
                <div className="font-semibold text-[var(--text)]">{filtered.filter((student) => student.interventionCase && student.interventionCase.status !== "RESOLVED").length}</div>
              </div>
              <div className="rounded bg-[var(--surface-alt)] p-2">
                <div className="text-[var(--text-sec)]">Hours remaining</div>
                <div className="font-semibold text-[var(--text)]">{filtered.reduce((sum, student) => sum + (student.remainingHours ?? 0), 0).toFixed(1)}h</div>
              </div>
            </div>
          </div>

          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-4 mb-4">
            <div className="text-sm font-semibold mb-1">Audit Trail</div>
            <div className="text-xs text-[var(--text-sec)]">
              Open a student's hour history to review verification and override actions.
            </div>
          </div>

          {activeClassroom && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-4 mb-4">
              <div className="font-medium text-sm mb-1">{activeClassroom.name}</div>
              <div className="text-xs text-[var(--text-sec)] mb-2">Teacher: {activeClassroom.teacher.name}</div>
              <div className="text-xs font-mono bg-[var(--surface-alt)] p-1.5 rounded flex justify-between">
                <span>{activeClassroom.inviteCode}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(activeClassroom.inviteCode)}
                  className="text-[var(--action)] hover:text-[var(--navy)]"
                >Copy</button>
              </div>
            </div>
          )}

          {selectedStudent && (
            <StudentDetail
              student={selectedStudent as StudentInfo}
              requiredHours={(selectedStudent as StudentInfo).requiredHours}
              triageMode={triageMode}
              savedView={savedView}
              onRemoveHours={handleRemoveHours}
              onCaseSaved={() => { void loadData(); }}
              removing={removing}
              statusColors={statusColors}
              statusLabels={statusLabels}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function StudentDetail({ student, requiredHours, triageMode, savedView, onRemoveHours, onCaseSaved, removing, statusColors, statusLabels }: {
  student: StudentInfo;
  requiredHours: number;
  triageMode: TriageMode;
  savedView: SavedView;
  onRemoveHours: (sessionId: string, name: string) => void;
  onCaseSaved: () => void;
  removing: string | null;
  statusColors: Record<string, string>;
  statusLabels: Record<string, string>;
}) {
  const [sessions, setSessions] = useState<StudentSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [reminderSent, setReminderSent] = useState(false);
  const [showReminderCompose, setShowReminderCompose] = useState(false);
  const [reminderSubject, setReminderSubject] = useState("Service Hours Reminder");
  const [reminderBody, setReminderBody] = useState("");
  const [interventions, setInterventions] = useState<InterventionHistoryItem[]>([]);
  const [loadingInterventions, setLoadingInterventions] = useState(false);
  const [caseForm, setCaseForm] = useState<InterventionCaseDetail>({
    status: student.interventionCase?.status || "OPEN",
    priority: student.interventionCase?.priority || "MEDIUM",
    reason: "",
    summary: student.interventionCase?.summary || "",
    nextStepForStudent: "",
    nextStepForStaff: "",
    staffNote: "",
    studentMessage: "",
    dueDate: student.interventionCase?.dueDate ? student.interventionCase.dueDate.slice(0, 10) : "",
    ownerId: student.interventionCase?.owner?.id,
    owner: student.interventionCase?.owner || null,
  });
  const [savingCase, setSavingCase] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setReminderBody(
      `Hi ${student.name}, this is a friendly reminder to complete your community service hours. You currently have ${student.approvedHours}h approved${student.pendingHours ? `, ${student.pendingHours}h pending approval,` : ""} and ${student.remainingHours ?? Math.max(0, requiredHours - student.approvedHours)}h left toward your ${requiredHours}h requirement.${student.daysToDeadline != null ? ` Deadline status: ${deadlineLabel(student.daysToDeadline)}.` : ""}`,
    ));
    queueMicrotask(() => { setShowReminderCompose(false); setShowHistory(true); });
    queueMicrotask(() => setCaseForm({
      status: student.interventionCase?.status || "OPEN",
      priority: student.interventionCase?.priority || "MEDIUM",
      reason: student.riskReasons?.[0] || "",
      summary: student.interventionCase?.summary || `${student.remainingHours ?? Math.max(0, requiredHours - student.approvedHours)}h remaining toward graduation goal`,
      nextStepForStudent: "",
      nextStepForStaff: "",
      staffNote: "",
      studentMessage: "",
      dueDate: student.interventionCase?.dueDate ? student.interventionCase.dueDate.slice(0, 10) : "",
      ownerId: student.interventionCase?.owner?.id,
      owner: student.interventionCase?.owner || null,
    }));
  }, [student.id, student.name, student.approvedHours, requiredHours]);

  const loadHistory = async () => {
    setLoadingSessions(true);
    try {
      const data = await api.get<StudentReportResponse>(`/reports/student?studentId=${student.id}`);
      setSessions(data.sessions || []);
    } catch {
      setSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  };

  const loadInterventions = async () => {
    setLoadingInterventions(true);
    try {
      const [caseData, historyData] = await Promise.all([
        api.get<{ cases: Array<InterventionCaseDetail & { owner?: InterventionCaseDetail["owner"] }> }>(`/messages/interventions/cases?studentId=${student.id}&limit=1`),
        api.get<{ campaigns: InterventionHistoryItem[] }>(`/messages/interventions/history?studentId=${student.id}&limit=8`),
      ]);
      setInterventions(historyData.campaigns || []);
      const caseItem = caseData.cases?.[0];
      if (caseItem) {
        setCaseForm({
          id: caseItem.id,
          status: caseItem.status || "OPEN",
          priority: caseItem.priority || "MEDIUM",
          reason: caseItem.reason || "",
          summary: caseItem.summary || "",
          nextStepForStudent: caseItem.nextStepForStudent || "",
          nextStepForStaff: caseItem.nextStepForStaff || "",
          staffNote: caseItem.staffNote || "",
          studentMessage: caseItem.studentMessage || "",
          dueDate: caseItem.dueDate ? String(caseItem.dueDate).slice(0, 10) : "",
          ownerId: caseItem.owner?.id,
          owner: caseItem.owner || null,
          lastContactedAt: caseItem.lastContactedAt || null,
          lastStudentActionAt: caseItem.lastStudentActionAt || null,
          followUpSeen: caseItem.followUpSeen || false,
        });
      }
    } catch {
      setInterventions([]);
    } finally {
      setLoadingInterventions(false);
    }
  };

  const saveCase = async () => {
    setSavingCase(true);
    try {
      const updated = await api.put<InterventionCaseDetail>(`/messages/interventions/cases/${student.id}`, {
        status: caseForm.status,
        priority: caseForm.priority,
        reason: caseForm.reason,
        summary: caseForm.summary,
        nextStepForStudent: caseForm.nextStepForStudent,
        nextStepForStaff: caseForm.nextStepForStaff,
        staffNote: caseForm.staffNote,
        studentMessage: caseForm.studentMessage,
        dueDate: caseForm.dueDate ? new Date(`${caseForm.dueDate}T00:00:00.000Z`).toISOString() : "",
        ownerId: caseForm.ownerId || "",
      });
      setCaseForm((current) => ({
        ...current,
        id: updated.id,
        owner: updated.owner || current.owner || null,
      }));
      onCaseSaved();
      void loadInterventions();
    } catch {
      // ignore
    } finally {
      setSavingCase(false);
    }
  };

  const handleSendReminder = async () => {
    setSendingReminder(true);
    try {
      await api.post("/messages", {
        receiverId: student.id,
        subject: reminderSubject,
        body: reminderBody,
        queueType: triageMode,
        savedView,
        actionSource: "QUEUE_REMINDER",
      });
      setReminderSent(true);
      setShowReminderCompose(false);
      void loadInterventions();
      setTimeout(() => setReminderSent(false), 3000);
    } catch {
      // ignore
    } finally {
      setSendingReminder(false);
    }
  };

  useEffect(() => {
    if (showHistory) {
      queueMicrotask(() => { void loadHistory(); });
    }
    queueMicrotask(() => { void loadInterventions(); });
  }, [showHistory, student.id]);

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-4">
      <div className="font-semibold text-sm">{student.name}</div>
      <div className="text-xs text-[var(--text-sec)] mb-3">{student.email}</div>

      <div className="mb-3">
        <div className="flex justify-between text-xs text-[var(--text-sec)] mb-1">
          <span>Progress</span>
          <span>{student.approvedHours}h / {requiredHours}h</span>
        </div>
        <div className="w-full bg-[var(--border)] rounded-full h-2">
          <div
            className="bg-[var(--in-bg)]0 h-2 rounded-full"
            style={{ width: `${Math.min(100, student.percentComplete ?? (student.approvedHours / Math.max(1, requiredHours)) * 100)}%` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${statusColors[student.status]}`}>
          {statusLabels[student.status]}
        </span>
        {typeof student.pendingHours === "number" && student.pendingHours > 0 && (
          <span className="text-xs px-2 py-0.5 rounded font-medium bg-[var(--wn-bg)] text-[var(--wn-t)]">
            {student.pendingHours}h pending
          </span>
        )}
        {deadlineLabel(student.daysToDeadline) && (
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${student.daysToDeadline != null && student.daysToDeadline <= 14 ? "bg-[var(--er-bg)] text-[var(--er-t)]" : "bg-[var(--surface-alt)] text-[var(--text-sec)]"}`}>
            {deadlineLabel(student.daysToDeadline)}
          </span>
        )}
        {typeof student.noShowCount === "number" && student.noShowCount > 0 && (
          <span className="text-xs px-2 py-0.5 rounded font-medium bg-[var(--er-bg)] text-[var(--er-t)]">
            {student.noShowCount} no-show{student.noShowCount === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
        <div className="bg-[var(--surface-alt)] rounded p-2">
          <div className="text-[var(--text-sec)]">Remaining</div>
          <div className="font-medium text-[var(--text)]">{student.remainingHours ?? Math.max(0, requiredHours - student.approvedHours)}h</div>
        </div>
        <div className="bg-[var(--surface-alt)] rounded p-2">
          <div className="text-[var(--text-sec)]">Completion</div>
          <div className="font-medium text-[var(--text)]">{student.percentComplete ?? Math.min(100, Math.round((student.approvedHours / Math.max(1, requiredHours)) * 100))}%</div>
        </div>
      </div>

      {!!student.riskReasons?.length && (
        <div className="mb-3 rounded border border-red-100 bg-[var(--er-bg)] p-3">
          <div className="text-xs font-semibold text-red-800 mb-1">Why this student is flagged</div>
          <ul className="list-disc pl-4 text-xs text-[var(--er-t)] space-y-1">
            {student.riskReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-3 rounded border border-blue-100 bg-[var(--in-bg)] p-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-xs font-semibold text-[var(--navy)]">Intervention Case</div>
            <div className="text-[11px] text-[var(--action)]">Track the case, next steps, and whether this student still blocks graduation progress.</div>
          </div>
          <button
            onClick={saveCase}
            disabled={savingCase}
            className="px-2.5 py-1.5 text-xs rounded bg-[var(--action)] text-white hover:bg-[var(--action)] disabled:opacity-50"
          >
            {savingCase ? "Saving..." : "Save Case"}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select value={caseForm.status} onChange={(e) => setCaseForm((current) => ({ ...current, status: e.target.value }))} className="px-2 py-1.5 text-xs border border-[var(--in-b)] rounded bg-[var(--surface)]">
            {['OPEN','WAITING_ON_STUDENT','WAITING_ON_SCHOOL','MONITORING','RESOLVED'].map((option) => (
              <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>
            ))}
          </select>
          <select value={caseForm.priority} onChange={(e) => setCaseForm((current) => ({ ...current, priority: e.target.value }))} className="px-2 py-1.5 text-xs border border-[var(--in-b)] rounded bg-[var(--surface)]">
            {['LOW','MEDIUM','HIGH','URGENT'].map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
        <input value={caseForm.summary} onChange={(e) => setCaseForm((current) => ({ ...current, summary: e.target.value }))} className="w-full px-2 py-1.5 text-xs border border-[var(--in-b)] rounded bg-[var(--surface)]" placeholder="Short intervention summary" />
        <input value={caseForm.reason} onChange={(e) => setCaseForm((current) => ({ ...current, reason: e.target.value }))} className="w-full px-2 py-1.5 text-xs border border-[var(--in-b)] rounded bg-[var(--surface)]" placeholder="Why this student needs intervention" />
        <input value={caseForm.nextStepForStudent} onChange={(e) => setCaseForm((current) => ({ ...current, nextStepForStudent: e.target.value }))} className="w-full px-2 py-1.5 text-xs border border-[var(--in-b)] rounded bg-[var(--surface)]" placeholder="Next step for student" />
        <input value={caseForm.nextStepForStaff} onChange={(e) => setCaseForm((current) => ({ ...current, nextStepForStaff: e.target.value }))} className="w-full px-2 py-1.5 text-xs border border-[var(--in-b)] rounded bg-[var(--surface)]" placeholder="Next step for staff" />
        <textarea value={caseForm.studentMessage} onChange={(e) => setCaseForm((current) => ({ ...current, studentMessage: e.target.value }))} className="w-full px-2 py-1.5 text-xs border border-[var(--in-b)] rounded bg-[var(--surface)]" rows={2} placeholder="Student-facing message shown in their dashboard/messages" />
        <textarea value={caseForm.staffNote} onChange={(e) => setCaseForm((current) => ({ ...current, staffNote: e.target.value }))} className="w-full px-2 py-1.5 text-xs border border-[var(--in-b)] rounded bg-[var(--surface)]" rows={3} placeholder="Internal staff note" />
        <div className="grid grid-cols-2 gap-2 text-xs text-[var(--navy)]">
          <label className="space-y-1">
            <span className="block">Follow-up date</span>
            <input type="date" value={caseForm.dueDate} onChange={(e) => setCaseForm((current) => ({ ...current, dueDate: e.target.value }))} className="w-full px-2 py-1.5 text-xs border border-[var(--in-b)] rounded bg-[var(--surface)]" />
          </label>
          <div className="rounded border border-blue-100 bg-[var(--surface)] p-2 text-[11px] text-[var(--action)]">
            <div>Last contacted: {caseForm.lastContactedAt ? new Date(caseForm.lastContactedAt).toLocaleDateString(undefined, { timeZone: 'UTC' }) : '—'}</div>
            <div>Last student action: {caseForm.lastStudentActionAt ? new Date(caseForm.lastStudentActionAt).toLocaleDateString(undefined, { timeZone: 'UTC' }) : '—'}</div>
            <div>New hour activity since outreach: {caseForm.followUpSeen ? 'Yes' : 'No'}</div>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <button
          onClick={() => setShowReminderCompose(true)}
          disabled={sendingReminder}
          className="w-full text-xs py-1.5 bg-[var(--in-bg)] text-[var(--action)] border border-[var(--in-b)] rounded hover:bg-[var(--in-bg)] disabled:opacity-50"
        >
          {reminderSent ? "Reminder Sent!" : "Send Reminder"}
        </button>
        <button
          onClick={() => { setShowHistory(!showHistory); if (!showHistory) loadHistory(); }}
          className="w-full text-xs py-1.5 border border-[var(--border)] rounded hover:bg-[var(--surface-alt)]"
        >
          {showHistory ? "Hide Hour History" : "View Hour History"}
        </button>
      </div>

      {showReminderCompose && (
        <div className="mt-3 p-3 border border-[var(--in-b)] bg-[var(--in-bg)] rounded">
          <div className="text-xs font-semibold text-[var(--navy)] mb-2">Compose Reminder</div>
          <div className="text-xs text-[var(--action)] mb-2">Recipient: {student.email}</div>
          <input
            type="text"
            value={reminderSubject}
            onChange={(e) => setReminderSubject(e.target.value)}
            className="w-full px-2 py-1.5 text-xs border border-[var(--in-b)] rounded mb-2"
            placeholder="Subject"
          />
          <textarea
            value={reminderBody}
            onChange={(e) => setReminderBody(e.target.value)}
            className="w-full px-2 py-1.5 text-xs border border-[var(--in-b)] rounded mb-2"
            rows={3}
            placeholder="Message body"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSendReminder}
              disabled={sendingReminder || !reminderBody.trim()}
              className="px-2 py-1 text-xs bg-[var(--action)] text-white rounded hover:bg-[var(--action)] disabled:opacity-50"
            >
              {sendingReminder ? "Sending..." : "Send"}
            </button>
            <button
              onClick={() => setShowReminderCompose(false)}
              className="px-2 py-1 text-xs border border-[var(--in-b)] rounded hover:bg-[var(--in-bg)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 rounded border border-[var(--border)] bg-[var(--surface-alt)] p-3">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <div className="text-xs font-semibold text-[var(--text)]">Outreach History</div>
            <div className="text-[11px] text-[var(--text-sec)]">Track who followed up after staff outreach and which queue triggered the message.</div>
          </div>
        </div>
        {loadingInterventions ? (
          <div className="text-xs text-[var(--text-faint)]">Loading outreach history...</div>
        ) : interventions.length === 0 ? (
          <div className="text-xs text-[var(--text-faint)]">No outreach has been logged for this student yet.</div>
        ) : (
          <div className="space-y-2">
            {interventions.map((item) => (
              <div key={item.id} className="rounded bg-[var(--surface)] border border-[var(--border)] p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-medium text-[var(--text)]">{item.subject || "Student outreach"}</div>
                    <div className="text-[11px] text-[var(--text-sec)] mt-0.5">
                      {item.actor.name} · {new Date(item.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${item.followUpCount > 0 ? "bg-[var(--ok-bg)] text-[var(--ok-t)]" : "bg-[var(--wn-bg)] text-[var(--wn-t)]"}`}>
                    {item.followUpCount > 0 ? "Follow-up seen" : "Awaiting follow-up"}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {item.queueType && <span className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--in-bg)] text-[var(--action)]">{item.queueType.replaceAll("_", " ")}</span>}
                  {item.savedView && <span className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--surface-alt)] text-[var(--text-sec)]">{item.savedView.replaceAll("_", " ")}</span>}
                </div>
                {item.bodyPreview && <div className="mt-2 text-[11px] text-[var(--text-sec)] line-clamp-2">{item.bodyPreview}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {showHistory && (
        <div className="mt-3 space-y-2">
          {loadingSessions ? (
            <div className="text-xs text-[var(--text-faint)]">Loading...</div>
          ) : sessions.length === 0 ? (
            <div className="text-xs text-[var(--text-faint)]">No sessions found.</div>
          ) : (
            sessions.slice(0, 5).map((session) => (
              <div key={session.id} className="bg-[var(--surface-alt)] rounded p-2 text-xs">
                <div className="flex justify-between">
                  <span className="font-medium">{session.opportunity?.title}</span>
                  <span className={session.verificationStatus === "APPROVED" ? "text-[var(--ok-t)]" : "text-[var(--text-sec)]"}>
                    {session.totalHours}h
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-[var(--text-sec)]">Status: {session.verificationStatus}</div>
                {session.verificationStatus === "APPROVED" && (
                  <button
                    onClick={() => onRemoveHours(session.id, student.name)}
                    disabled={removing === session.id}
                    className="text-[var(--er-t)] hover:text-[var(--er-t)] mt-1"
                  >
                    Remove Hours
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function AddStaffModal({ schoolId, classrooms, onClose, onAdded }: {
  schoolId: string;
  classrooms: Classroom[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [classroomId, setClassroomId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ name: string; email: string; tempPassword: string } | null>(null);
  const [formError, setFormError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFormError("");
    try {
      const data = await api.post<{ name: string; email: string; tempPassword: string }>(
        `/schools/${schoolId}/staff`,
        { name, email, classroomId: classroomId || undefined }
      );
      setResult(data);
      onAdded();
    } catch (err: unknown) {
      setFormError(getErrorMessage(err, "Failed to create staff member"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--surface)] rounded-[3px] p-6 w-full max-w-md">
        <h2 className="text-[20px] font-semibold mb-4">Add Staff Member</h2>

        {result ? (
          <div>
            <div className="bg-[var(--ok-bg)] border border-[var(--ok-b)] rounded-[2px] p-4 mb-4">
              <div className="font-medium text-[var(--ok-t)]">Staff member created!</div>
              <div className="text-sm text-[var(--ok-t)] mt-1">
                <div>Email: {result.email}</div>
                <div>Temp Password: <span className="font-mono font-bold">{result.tempPassword}</span></div>
              </div>
              <p className="text-xs text-[var(--ok-t)] mt-2">Share these credentials with {result.name}.</p>
            </div>
            <button onClick={onClose} className="w-full py-[7px] bg-[var(--action)] text-white rounded-[2px] hover:opacity-85">Done</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="p-3 bg-[var(--er-bg)] border border-[var(--er-b)] rounded-[2px] text-[var(--er-t)] text-sm">
                {formError}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
                className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:ring-2 focus:ring-[var(--action)]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:ring-2 focus:ring-[var(--action)]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">Assign to Classroom <span className="text-[var(--text-faint)]">(optional)</span></label>
              <select value={classroomId} onChange={(e) => setClassroomId(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:ring-2 focus:ring-[var(--action)]">
                <option value="">Select classroom...</option>
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={loading}
                className="flex-1 py-[7px] bg-[var(--action)] text-white rounded-[2px] font-medium hover:opacity-85 disabled:opacity-50">
                {loading ? "Creating..." : "Create Account"}
              </button>
              <button type="button" onClick={onClose}
                className="flex-1 py-2 border border-[var(--border-s)] rounded-[2px] hover:bg-[var(--surface-alt)]">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
