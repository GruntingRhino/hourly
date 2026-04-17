import { useEffect, useState } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";

interface Student {
  id: string;
  name: string;
  email: string;
  grade?: string | null;
  cohortId: string;
  cohortName: string;
  approvedHours: number;
  requiredHours: number;
  status: "COMPLETED" | "ON_TRACK" | "AT_RISK";
  riskReasons?: string[];
}

interface VerificationHistoryEntry {
  id: string;
  action: string;
  details: string | null;
  createdAt: string;
  actor: { id: string; name: string; role: string };
}

interface StudentVerificationHistory {
  student: {
    id: string;
    name: string;
    email: string;
    cohortName: string | null;
  };
  signups: Array<{
    id: string;
    status: string;
    verificationStatus: string;
    totalHours: number | null;
    rejectionReason: string | null;
    slot: {
      date: string;
      startTime: string;
      endTime: string;
      durationHours: number;
      opportunity: {
        title: string;
        beneficiary: { id: string; name: string; category: string | null };
      };
    };
    history: VerificationHistoryEntry[];
  }>;
}

export default function StudentList() {
  const { user } = useAuth();
  const { id: cohortId } = useParams<{ id: string }>();
  const location = useLocation();
  const [students, setStudents] = useState<Student[]>([]);
  const [cohortName, setCohortName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<StudentVerificationHistory | null>(null);

  const isOnTrack = location.pathname.endsWith("/on-track");
  const isOffTrack = location.pathname.endsWith("/off-track");
  const filter = isOnTrack ? "on-track" : isOffTrack ? "off-track" : "all";

  useEffect(() => { void load(); }, [cohortId, location.pathname]);

  const load = async () => {
    setLoading(true);
    try {
      if (cohortId) {
        const cohort = await api.get<any>(`/cohorts/${cohortId}`);
        setCohortName(cohort.name);
        const req = cohort.requiredHours;
        const mapped: Student[] = cohort.students.map((s: any) => ({
          ...s,
          cohortId,
          cohortName: cohort.name,
          requiredHours: req,
          status: s.status ?? (s.approvedHours >= req ? "COMPLETED" : s.approvedHours >= req * 0.5 ? "ON_TRACK" : "AT_RISK"),
          riskReasons: s.riskReasons ?? [],
        }));
        setStudents(mapped);
      } else {
        const data = await api.get<Student[]>("/cohorts/school-students");
        setStudents(data);
      }
    } catch {
      setError("Failed to load students.");
    } finally {
      setLoading(false);
    }
  };

  const loadVerificationHistory = async (studentId: string) => {
    if (!user?.schoolId) return;
    setHistoryLoadingId(studentId);
    setError("");
    try {
      const data = await api.get<StudentVerificationHistory>(`/schools/${user.schoolId}/students/${studentId}/verification-history`);
      setHistoryData(data);
    } catch (err: any) {
      setError(err.message || "Failed to load verification history.");
    } finally {
      setHistoryLoadingId(null);
    }
  };

  const formatHistoryDetails = (raw: string | null) => {
    if (!raw) return "";
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return Object.entries(parsed)
        .map(([key, value]) => `${key}: ${String(value)}`)
        .join(" · ");
    } catch {
      return raw;
    }
  };

  const filtered = filter === "on-track"
    ? students.filter((s) => s.status === "ON_TRACK" || s.status === "COMPLETED")
    : filter === "off-track"
    ? students.filter((s) => s.status === "AT_RISK")
    : students;

  const title = cohortId
    ? `${cohortName} — ${filter === "on-track" ? "On-Track Students" : "Off-Track Students"}`
    : filter === "on-track" ? "On-Track Students"
    : filter === "off-track" ? "Off-Track Students"
    : "Student Roster";

  const backLink = cohortId ? `/cohorts/${cohortId}` : "/dashboard";
  const backLabel = cohortId ? `← ${cohortName || "Cohort"}` : "← Dashboard";

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link to={backLink} className="text-gray-500 hover:text-gray-800 text-sm">{backLabel}</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold">{title}</h1>
      </div>

      {/* School-wide filter tabs */}
      {!cohortId && (
        <div className="flex gap-4 border-b mb-6">
          {[
            { label: "All Students", path: "/students" },
            { label: "On Track", path: "/students/on-track" },
            { label: "Off Track", path: "/students/off-track" },
          ].map((t) => (
            <Link
              key={t.path}
              to={t.path}
              className={`pb-2 text-sm font-medium border-b-2 ${
                location.pathname === t.path
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      )}

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm mb-4">{error}</div>}

      {loading ? (
        <div className="text-gray-500 text-sm py-8 text-center">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-500">
          No students found.
        </div>
      ) : (
        <div>
          <div className="text-sm text-gray-500 mb-3">{filtered.length} student{filtered.length !== 1 ? "s" : ""}</div>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Email</th>
                  {!cohortId && <th className="text-left px-4 py-2 font-medium text-gray-600">Cohort</th>}
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Hours</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Required</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Status</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium">{s.name}</td>
                    <td className="px-4 py-2 text-gray-500 text-xs">{s.email}</td>
                    {!cohortId && <td className="px-4 py-2 text-gray-500 text-xs">{s.cohortName}</td>}
                    <td className="px-4 py-2 text-right font-medium">{s.approvedHours.toFixed(1)}</td>
                    <td className="px-4 py-2 text-right text-gray-400">{s.requiredHours}h</td>
                    <td className="px-4 py-2 text-right">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        s.status === "COMPLETED" ? "bg-green-50 text-green-700" :
                        s.status === "ON_TRACK" ? "bg-blue-50 text-blue-700" :
                        "bg-red-50 text-red-600"
                      }`}>{s.status.replace("_", " ")}</span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => loadVerificationHistory(s.id)}
                        disabled={historyLoadingId === s.id}
                        className="px-2.5 py-1 border border-gray-300 rounded text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                      >
                        {historyLoadingId === s.id ? "..." : "History"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {historyData && (
        <div className="fixed inset-0 z-30 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-white rounded-xl shadow-xl border border-gray-200 max-h-[85vh] overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
              <div>
                <div className="font-semibold text-gray-900">Beneficiary Verification History</div>
                <div className="text-sm text-gray-500 mt-1">
                  {historyData.student.name} · {historyData.student.email}
                </div>
              </div>
              <button onClick={() => setHistoryData(null)} className="text-gray-400 hover:text-gray-600 text-sm">
                Close
              </button>
            </div>
            <div className="p-5 overflow-y-auto max-h-[70vh] space-y-4">
              {historyData.signups.length === 0 ? (
                <div className="text-sm text-gray-500">No beneficiary verification activity recorded for this student.</div>
              ) : (
                historyData.signups.map((signup) => (
                  <div key={signup.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between gap-4">
                      <div>
                        <div className="font-medium text-sm">{signup.slot.opportunity.title}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {signup.slot.opportunity.beneficiary.name} · {new Date(signup.slot.date).toLocaleDateString(undefined, { timeZone: "UTC" })} · {signup.totalHours ?? signup.slot.durationHours}h
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-medium text-gray-700">{signup.status === "NO_SHOW" ? "NO_SHOW" : signup.verificationStatus}</div>
                        {signup.rejectionReason && (
                          <div className="text-xs text-red-500 mt-1">{signup.rejectionReason}</div>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      {signup.history.length === 0 ? (
                        <div className="text-xs text-gray-400">No audit events recorded.</div>
                      ) : (
                        signup.history.map((entry) => (
                          <div key={entry.id} className="bg-gray-50 border border-gray-100 rounded p-2">
                            <div className="flex justify-between gap-3">
                              <div className="text-xs font-medium text-gray-800">{entry.action}</div>
                              <div className="text-xs text-gray-400">{new Date(entry.createdAt).toLocaleString()}</div>
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">{entry.actor.name} · {entry.actor.role}</div>
                            {formatHistoryDetails(entry.details) && (
                              <div className="text-xs text-gray-600 mt-1">{formatHistoryDetails(entry.details)}</div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
