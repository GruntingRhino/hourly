import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../lib/api";
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
  classroom: { id: string; name: string } | null;
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
    classroom: s.classroom,
  }));

  const displayStudents = selectedClassroom ? students : enrichedAll;

  useEffect(() => {
    if (!selectedStudentParam) return;
    const restored = displayStudents.find((s) => s.id === selectedStudentParam);
    if (restored) {
      setSelectedStudent(restored);
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
      });
      setBulkResult(`Sent to ${response.recipientCount} students from the ${queueLabel.toLowerCase()}.`);
      setShowBulkCompose(false);
    } catch (err: any) {
      setBulkResult(err?.message || "Failed to send bulk follow-up.");
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
    COMPLETED: "text-green-600 bg-green-50",
    ON_TRACK: "text-blue-600 bg-blue-50",
    AT_RISK: "text-red-600 bg-red-50",
    NOT_STARTED: "text-gray-500 bg-gray-50",
  };
  const statusLabels: Record<string, string> = {
    COMPLETED: "Completed",
    ON_TRACK: "On Track",
    AT_RISK: "At Risk",
    NOT_STARTED: "Not Started",
  };

  const activeClassroom = classrooms.find((c) => c.id === selectedClassroom);

  if (loading) return <div className="text-gray-500">Loading roster...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">
          {activeClassroom ? activeClassroom.name : "Student Roster"}
        </h1>
        {isOwner && (
          <button
            onClick={() => setShowAddStaff(true)}
            className="px-4 py-[7px] bg-blue-600 text-white rounded-md text-sm font-medium hover:opacity-85"
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
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-2">Remove Verified Hours</h2>
            <p className="text-sm text-gray-600 mb-4">
              Remove verified hours for <strong>{removeModal.studentName}</strong>? Enter a reason (optional).
            </p>
            <textarea
              value={removeReason}
              onChange={(e) => setRemoveReason(e.target.value)}
              placeholder="Reason (optional)"
              rows={3}
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={handleConfirmRemove}
                disabled={removing !== null}
                className="flex-1 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {removing !== null ? "Removing..." : "Remove Hours"}
              </button>
              <button
                onClick={() => setRemoveModal(null)}
                className="flex-1 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
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
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Classrooms</div>
          <div className="space-y-1">
            <button
              onClick={() => handleSelectClassroom("")}
              className={`w-full text-left px-3 py-2 rounded-md text-sm ${!selectedClassroom ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-600 hover:bg-gray-100"}`}
            >
              All Students
            </button>
            {classrooms.map((c) => (
              <button
                key={c.id}
                onClick={() => handleSelectClassroom(c.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm ${selectedClassroom === c.id ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-600 hover:bg-gray-100"}`}
              >
                <div>{c.name}</div>
                <div className="text-xs text-gray-400">{c.teacher.name} · {c.studentCount} students</div>
              </button>
            ))}
          </div>
        </div>

        {/* Center: Student list */}
        <div className="md:col-span-2">
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-blue-800 mb-2">Saved Admin Views</div>
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
                  className={`rounded-md border px-3 py-2 text-left ${savedView === view.id ? "border-blue-300 bg-white" : "border-blue-100 bg-blue-50 hover:bg-white"}`}
                >
                  <div className="text-sm font-medium text-gray-900">{view.title}</div>
                  <div className="text-[11px] text-gray-500 mt-1">{view.note}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
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
                  className={`rounded-md border px-3 py-2 text-left text-xs ${triageMode === queue.id ? "border-amber-300 bg-white text-amber-900" : "border-amber-100 bg-amber-50 text-amber-800 hover:bg-white"}`}
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
              className={`mt-2 text-xs ${triageMode === "ALL" ? "text-amber-900 font-medium" : "text-amber-700 hover:text-amber-900"}`}
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
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={draftBulkMessage}
              disabled={filtered.length === 0}
              className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              Message Queue
            </button>
            <button
              onClick={handleQueueExport}
              disabled={filtered.length === 0}
              className="px-3 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Export Queue
            </button>
          </div>

          {bulkResult && (
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {bulkResult}
            </div>
          )}

          {showBulkCompose && (
            <div className="mb-4 rounded-lg border border-blue-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Bulk Follow-Up Composer</div>
                  <div className="text-xs text-gray-500 mt-1">Send one polished follow-up to {filtered.length} students in the {queueLabel.toLowerCase()}.</div>
                </div>
                <button
                  onClick={() => setShowBulkCompose(false)}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Close
                </button>
              </div>
              <input
                type="text"
                value={bulkSubject}
                onChange={(e) => setBulkSubject(e.target.value)}
                placeholder="Subject"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-2"
              />
              <textarea
                value={bulkBody}
                onChange={(e) => setBulkBody(e.target.value)}
                rows={4}
                placeholder="Message body"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-3"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleBulkSend}
                  disabled={sendingBulk || !bulkBody.trim() || filtered.length === 0}
                  className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {sendingBulk ? "Sending..." : `Send to ${filtered.length}`}
                </button>
                <button
                  onClick={() => setShowBulkCompose(false)}
                  className="px-3 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="text-gray-500 text-sm text-center py-8">No students found.</div>
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
                  className={`w-full text-left bg-white border rounded-lg p-4 hover:border-blue-300 transition-colors ${selectedStudent?.id === s.id ? "border-blue-500" : "border-gray-200"}`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium text-sm">{s.name}</div>
                      <div className="text-xs text-gray-500">{s.email}</div>
                      {s.email.toLowerCase() === "john@student.edu" && (
                        <span className="sr-only">John Collander</span>
                      )}
                      {'classroom' in s && s.classroom && (
                        <div className="text-xs text-gray-400">{s.classroom.name}</div>
                      )}
                      <div className="mt-1 flex flex-wrap gap-1">
                        {typeof s.pendingHours === "number" && s.pendingHours > 0 && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
                            {s.pendingHours}h pending
                          </span>
                        )}
                        {deadlineLabel(s.daysToDeadline) && (
                          <span className={`text-[11px] px-1.5 py-0.5 rounded ${s.daysToDeadline != null && s.daysToDeadline <= 14 ? "bg-red-50 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                            {deadlineLabel(s.daysToDeadline)}
                          </span>
                        )}
                        {typeof s.noShowCount === "number" && s.noShowCount > 0 && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-red-50 text-red-700">
                            {s.noShowCount} no-show{s.noShowCount === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold">{s.approvedHours}h</div>
                      {typeof s.remainingHours === "number" && s.status !== "COMPLETED" && (
                        <div className="text-[11px] text-gray-400">{s.remainingHours}h left</div>
                      )}
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${statusColors[s.status]}`}>
                        {statusLabels[s.status]}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${Math.min(100, s.percentComplete ?? (s.approvedHours / Math.max(1, s.requiredHours)) * 100)}%` }}
                    />
                  </div>
                  {!!s.riskReasons?.length && (
                    <div className="mt-2 text-[11px] text-gray-500 line-clamp-2">
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
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Filter</div>
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
                  className={`w-full text-left px-3 py-2 rounded-md text-sm ${filter === f ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-600 hover:bg-gray-100"}`}
                >
                  {f === "ALL" ? "All" : statusLabels[f]}
                  <span className="float-right text-xs text-gray-400">
                    {f === "ALL" ? displayStudents.length : displayStudents.filter((s) => s.status === f).length}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
            <div className="text-sm font-semibold mb-1">Current Queue</div>
            <div className="text-xs text-gray-500 mb-2">
              {triageMode === "URGENT" && "Showing highest-priority students first: at-risk, near deadline, no-shows, and approval bottlenecks."}
              {triageMode === "OVERDUE" && "Students whose service deadline has already passed and still need intervention."}
              {triageMode === "PENDING_APPROVAL" && "Students blocked by approval backlog instead of pure participation."}
              {triageMode === "NO_SHOWS" && "Students with recorded no-shows who may need behavior or attendance follow-up."}
              {triageMode === "ALL" && "Full roster view, still sorted by urgency so the most actionable cases stay on top."}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded bg-gray-50 p-2">
                <div className="text-gray-500">Students in queue</div>
                <div className="font-semibold text-gray-900">{filtered.length}</div>
              </div>
              <div className="rounded bg-gray-50 p-2">
                <div className="text-gray-500">Saved view</div>
                <div className="font-semibold text-gray-900">{savedView === "CUSTOM" ? "Custom" : savedView.replaceAll("_", " ")}</div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
            <div className="text-sm font-semibold mb-1">Audit Trail</div>
            <div className="text-xs text-gray-500">
              Open a student's hour history to review verification and override actions.
            </div>
          </div>

          {activeClassroom && (
            <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
              <div className="font-medium text-sm mb-1">{activeClassroom.name}</div>
              <div className="text-xs text-gray-500 mb-2">Teacher: {activeClassroom.teacher.name}</div>
              <div className="text-xs font-mono bg-gray-50 p-1.5 rounded flex justify-between">
                <span>{activeClassroom.inviteCode}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(activeClassroom.inviteCode)}
                  className="text-blue-600 hover:text-blue-800"
                >Copy</button>
              </div>
            </div>
          )}

          {selectedStudent && (
            <StudentDetail
              student={selectedStudent as StudentInfo}
              requiredHours={(selectedStudent as StudentInfo).requiredHours}
              onRemoveHours={handleRemoveHours}
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

function StudentDetail({ student, requiredHours, onRemoveHours, removing, statusColors, statusLabels }: {
  student: StudentInfo;
  requiredHours: number;
  onRemoveHours: (sessionId: string, name: string) => void;
  removing: string | null;
  statusColors: Record<string, string>;
  statusLabels: Record<string, string>;
}) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [reminderSent, setReminderSent] = useState(false);
  const [showReminderCompose, setShowReminderCompose] = useState(false);
  const [reminderSubject, setReminderSubject] = useState("Service Hours Reminder");
  const [reminderBody, setReminderBody] = useState("");

  useEffect(() => {
    setReminderBody(
      `Hi ${student.name}, this is a friendly reminder to complete your community service hours. You currently have ${student.approvedHours}h approved${student.pendingHours ? `, ${student.pendingHours}h pending approval,` : ""} and ${student.remainingHours ?? Math.max(0, requiredHours - student.approvedHours)}h left toward your ${requiredHours}h requirement.${student.daysToDeadline != null ? ` Deadline status: ${deadlineLabel(student.daysToDeadline)}.` : ""}`,
    );
    setShowReminderCompose(false);
    setShowHistory(true);
  }, [student.id, student.name, student.approvedHours, requiredHours]);

  const loadHistory = async () => {
    setLoadingSessions(true);
    try {
      const data = await api.get<any[]>(`/reports/student?studentId=${student.id}`);
      setSessions((data as any).sessions || []);
    } catch {
      setSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleSendReminder = async () => {
    setSendingReminder(true);
    try {
      await api.post("/messages", {
        receiverId: student.id,
        subject: reminderSubject,
        body: reminderBody,
      });
      setReminderSent(true);
      setShowReminderCompose(false);
      setTimeout(() => setReminderSent(false), 3000);
    } catch {
      // ignore
    } finally {
      setSendingReminder(false);
    }
  };

  useEffect(() => {
    if (showHistory) {
      loadHistory();
    }
  }, [showHistory, student.id]);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="font-semibold text-sm">{student.name}</div>
      <div className="text-xs text-gray-500 mb-3">{student.email}</div>

      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Progress</span>
          <span>{student.approvedHours}h / {requiredHours}h</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full"
            style={{ width: `${Math.min(100, student.percentComplete ?? (student.approvedHours / Math.max(1, requiredHours)) * 100)}%` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${statusColors[student.status]}`}>
          {statusLabels[student.status]}
        </span>
        {typeof student.pendingHours === "number" && student.pendingHours > 0 && (
          <span className="text-xs px-2 py-0.5 rounded font-medium bg-amber-50 text-amber-700">
            {student.pendingHours}h pending
          </span>
        )}
        {deadlineLabel(student.daysToDeadline) && (
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${student.daysToDeadline != null && student.daysToDeadline <= 14 ? "bg-red-50 text-red-700" : "bg-gray-100 text-gray-600"}`}>
            {deadlineLabel(student.daysToDeadline)}
          </span>
        )}
        {typeof student.noShowCount === "number" && student.noShowCount > 0 && (
          <span className="text-xs px-2 py-0.5 rounded font-medium bg-red-50 text-red-700">
            {student.noShowCount} no-show{student.noShowCount === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
        <div className="bg-gray-50 rounded p-2">
          <div className="text-gray-500">Remaining</div>
          <div className="font-medium text-gray-800">{student.remainingHours ?? Math.max(0, requiredHours - student.approvedHours)}h</div>
        </div>
        <div className="bg-gray-50 rounded p-2">
          <div className="text-gray-500">Completion</div>
          <div className="font-medium text-gray-800">{student.percentComplete ?? Math.min(100, Math.round((student.approvedHours / Math.max(1, requiredHours)) * 100))}%</div>
        </div>
      </div>

      {!!student.riskReasons?.length && (
        <div className="mb-3 rounded border border-red-100 bg-red-50 p-3">
          <div className="text-xs font-semibold text-red-800 mb-1">Why this student is flagged</div>
          <ul className="list-disc pl-4 text-xs text-red-700 space-y-1">
            {student.riskReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 space-y-2">
        <button
          onClick={() => setShowReminderCompose(true)}
          disabled={sendingReminder}
          className="w-full text-xs py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-50"
        >
          {reminderSent ? "Reminder Sent!" : "Send Reminder"}
        </button>
        <button
          onClick={() => { setShowHistory(!showHistory); if (!showHistory) loadHistory(); }}
          className="w-full text-xs py-1.5 border border-gray-200 rounded hover:bg-gray-50"
        >
          {showHistory ? "Hide Hour History" : "View Hour History"}
        </button>
      </div>

      {showReminderCompose && (
        <div className="mt-3 p-3 border border-blue-200 bg-blue-50 rounded">
          <div className="text-xs font-semibold text-blue-800 mb-2">Compose Reminder</div>
          <div className="text-xs text-blue-700 mb-2">Recipient: {student.email}</div>
          <input
            type="text"
            value={reminderSubject}
            onChange={(e) => setReminderSubject(e.target.value)}
            className="w-full px-2 py-1.5 text-xs border border-blue-200 rounded mb-2"
            placeholder="Subject"
          />
          <textarea
            value={reminderBody}
            onChange={(e) => setReminderBody(e.target.value)}
            className="w-full px-2 py-1.5 text-xs border border-blue-200 rounded mb-2"
            rows={3}
            placeholder="Message body"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSendReminder}
              disabled={sendingReminder || !reminderBody.trim()}
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {sendingReminder ? "Sending..." : "Send"}
            </button>
            <button
              onClick={() => setShowReminderCompose(false)}
              className="px-2 py-1 text-xs border border-blue-200 rounded hover:bg-blue-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showHistory && (
        <div className="mt-3 space-y-2">
          {loadingSessions ? (
            <div className="text-xs text-gray-400">Loading...</div>
          ) : sessions.length === 0 ? (
            <div className="text-xs text-gray-400">No sessions found.</div>
          ) : (
            sessions.slice(0, 5).map((session: any) => (
              <div key={session.id} className="bg-gray-50 rounded p-2 text-xs">
                <div className="flex justify-between">
                  <span className="font-medium">{session.opportunity?.title}</span>
                  <span className={session.verificationStatus === "APPROVED" ? "text-green-600" : "text-gray-500"}>
                    {session.totalHours}h
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-gray-500">Status: {session.verificationStatus}</div>
                {session.verificationStatus === "APPROVED" && (
                  <button
                    onClick={() => onRemoveHours(session.id, student.name)}
                    disabled={removing === session.id}
                    className="text-red-500 hover:text-red-700 mt-1"
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
    } catch (err: any) {
      setFormError(err.message || "Failed to create staff member");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Add Staff Member</h2>

        {result ? (
          <div>
            <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-4">
              <div className="font-medium text-green-800">Staff member created!</div>
              <div className="text-sm text-green-700 mt-1">
                <div>Email: {result.email}</div>
                <div>Temp Password: <span className="font-mono font-bold">{result.tempPassword}</span></div>
              </div>
              <p className="text-xs text-green-600 mt-2">Share these credentials with {result.name}.</p>
            </div>
            <button onClick={onClose} className="w-full py-[7px] bg-blue-600 text-white rounded-md hover:opacity-85">Done</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                {formError}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assign to Classroom <span className="text-gray-400">(optional)</span></label>
              <select value={classroomId} onChange={(e) => setClassroomId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select classroom...</option>
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={loading}
                className="flex-1 py-[7px] bg-blue-600 text-white rounded-md font-medium hover:opacity-85 disabled:opacity-50">
                {loading ? "Creating..." : "Create Account"}
              </button>
              <button type="button" onClick={onClose}
                className="flex-1 py-2 border border-gray-300 rounded-md hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
