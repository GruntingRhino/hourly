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
  requiredHours: number;
  status: "COMPLETED" | "ON_TRACK" | "AT_RISK" | "NOT_STARTED";
  classroom?: { id: string; name: string } | null;
}

interface AllStudent {
  id: string;
  name: string;
  email: string;
  grade: string | null;
  approvedHours: number;
  classroom: { id: string; name: string } | null;
}

export default function SchoolGroups() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [allStudents, setAllStudents] = useState<AllStudent[]>([]);
  const [selectedClassroom, setSelectedClassroom] = useState(searchParams.get("classroom") || "");
  const [selectedStudent, setSelectedStudent] = useState<StudentInfo | AllStudent | null>(null);
  const [filter, setFilter] = useState(searchParams.get("filter")?.toUpperCase().replace(" ", "_") || "ALL");
  const [search, setSearch] = useState("");
  const [requiredHours, setRequiredHours] = useState(40);
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
      api.get<StudentInfo[]>(`/schools/${schoolId}/groups/${selectedClassroom}/students`)
        .then(setStudents)
        .catch(() => {
          // Try loading all students and filtering by classroom
          api.get<AllStudent[]>(`/schools/${schoolId}/students`).then((all) => {
            const cls = all.filter((s) => s.classroom?.id === selectedClassroom);
            setStudents(cls.map((s) => ({
              ...s,
              requiredHours,
              status: calcStatus(s.approvedHours, requiredHours),
            })));
          });
        });
    }
  }, [selectedClassroom]);

  const loadData = async () => {
    if (!schoolId) return;
    try {
      const [cls, all, school] = await Promise.all([
        api.get<Classroom[]>(`/classrooms`),
        api.get<AllStudent[]>(`/schools/${schoolId}/students`),
        api.get<{ requiredHours: number }>(`/schools/${schoolId}`),
      ]);
      setClassrooms(cls);
      setAllStudents(all);
      setRequiredHours(school.requiredHours);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectClassroom = (id: string) => {
    setSelectedClassroom(id);
    setSelectedStudent(null);
    setSearchParams(id ? { classroom: id } : {});
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
    requiredHours,
    status: calcStatus(s.approvedHours, requiredHours),
  }));

  const displayStudents = selectedClassroom ? students : enrichedAll;

  const filtered = displayStudents.filter((s) => {
    const statusMatch = filter === "ALL" || s.status === filter;
    const searchMatch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase());
    return statusMatch && searchMatch;
  });

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
            className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800"
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
          onAdded={() => { setShowAddStaff(false); loadData(); }}
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
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="Search students..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {filtered.length === 0 ? (
            <div className="text-gray-500 text-sm text-center py-8">No students found.</div>
          ) : (
            <div className="space-y-2">
              {filtered.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedStudent(s)}
                  className={`w-full text-left bg-white border rounded-lg p-4 hover:border-blue-300 transition-colors ${selectedStudent?.id === s.id ? "border-blue-500" : "border-gray-200"}`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium text-sm">{s.name}</div>
                      <div className="text-xs text-gray-500">{s.email}</div>
                      {'classroom' in s && s.classroom && (
                        <div className="text-xs text-gray-400">{s.classroom.name}</div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold">{s.approvedHours}h</div>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${statusColors[s.status]}`}>
                        {statusLabels[s.status]}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (s.approvedHours / requiredHours) * 100)}%` }}
                    />
                  </div>
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
                  onClick={() => setFilter(f)}
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
              requiredHours={requiredHours}
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
  const [showHistory, setShowHistory] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [reminderSent, setReminderSent] = useState(false);

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
        subject: "Service Hours Reminder",
        body: `Hi ${student.name}, this is a friendly reminder to complete your community service hours. You currently have ${student.approvedHours}h of ${requiredHours}h required. Please sign up for opportunities and get your hours verified soon!`,
      });
      setReminderSent(true);
      setTimeout(() => setReminderSent(false), 3000);
    } catch {
      // ignore
    } finally {
      setSendingReminder(false);
    }
  };

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
            style={{ width: `${Math.min(100, (student.approvedHours / requiredHours) * 100)}%` }}
          />
        </div>
      </div>

      <span className={`text-xs px-2 py-0.5 rounded font-medium ${statusColors[student.status]}`}>
        {statusLabels[student.status]}
      </span>

      <div className="mt-3 space-y-2">
        <button
          onClick={handleSendReminder}
          disabled={sendingReminder}
          className="w-full text-xs py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-50"
        >
          {reminderSent ? "Reminder Sent!" : sendingReminder ? "Sending..." : "Send Reminder"}
        </button>
        <button
          onClick={() => { setShowHistory(!showHistory); if (!showHistory) loadHistory(); }}
          className="w-full text-xs py-1.5 border border-gray-200 rounded hover:bg-gray-50"
        >
          {showHistory ? "Hide Hour History" : "View Hour History"}
        </button>
      </div>

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
            <button onClick={onClose} className="w-full py-2 bg-gray-900 text-white rounded-md">Done</button>
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
                className="flex-1 py-2 bg-gray-900 text-white rounded-md font-medium hover:bg-gray-800 disabled:opacity-50">
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
