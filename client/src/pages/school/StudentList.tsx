import { useEffect, useState } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import { api } from "../../lib/api";
import { formatAuditDetails } from "../../lib/auditDetails";
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
  remainingHours?: number;
  pendingHours?: number;
  interventionCase?: {
    id: string;
    status: string;
    priority: string;
    summary?: string | null;
    dueDate?: string | null;
  } | null;
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
  const [breakdownLoadingId, setBreakdownLoadingId] = useState<string | null>(null);
  const [breakdownData, setBreakdownData] = useState<HourBreakdownData | null>(null);

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
                  ? "border-blue-600 text-blue-600"
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
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Remaining</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Required</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Intervention</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium">{s.name}</td>
                    <td className="px-4 py-2 text-gray-500 text-xs">{s.email}</td>
                    {!cohortId && <td className="px-4 py-2 text-gray-500 text-xs">{s.cohortName}</td>}
                    <td className="px-4 py-2 text-right font-medium">{s.approvedHours.toFixed(1)}</td>
                    <td className="px-4 py-2 text-right font-medium text-red-700">{(s.remainingHours ?? Math.max(0, s.requiredHours - s.approvedHours)).toFixed(1)}h</td>
                    <td className="px-4 py-2 text-right text-gray-400">{s.requiredHours}h</td>
                    <td className="px-4 py-2 text-right">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        s.status === "COMPLETED" ? "bg-green-50 text-green-700" :
                        s.status === "ON_TRACK" ? "bg-blue-50 text-blue-700" :
                        "bg-red-50 text-red-600"
                      }`}>{s.status.replace("_", " ")}</span>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-600">
                      {s.interventionCase ? (
                        <div>
                          <div className={`inline-flex px-2 py-0.5 rounded-full font-medium ${s.interventionCase.status === 'RESOLVED' ? 'bg-green-50 text-green-700' : s.interventionCase.priority === 'URGENT' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>{s.interventionCase.status.replaceAll('_', ' ')}</div>
                          {s.interventionCase.summary && <div className="mt-1 text-gray-500">{s.interventionCase.summary}</div>}
                        </div>
                      ) : (
                        <span className="text-gray-400">No case</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          onClick={() => loadHourBreakdown(s.id)}
                          disabled={breakdownLoadingId === s.id}
                          className="px-2.5 py-1 border border-gray-300 rounded text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        >
                          {breakdownLoadingId === s.id ? "..." : "Hours"}
                        </button>
                        <button
                          onClick={() => loadVerificationHistory(s.id)}
                          disabled={historyLoadingId === s.id}
                          className="px-2.5 py-1 border border-gray-300 rounded text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        >
                          {historyLoadingId === s.id ? "..." : "History"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {breakdownData && (
        <div className="fixed inset-0 z-30 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-5xl bg-white rounded-xl shadow-xl border border-gray-200 max-h-[88vh] overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
              <div>
                <div className="font-semibold text-gray-900">Student Hour Breakdown</div>
                <div className="text-sm text-gray-500 mt-1">
                  {breakdownData.student.name} · {breakdownData.student.email}
                  {breakdownData.student.cohortName ? ` · ${breakdownData.student.cohortName}` : ""}
                </div>
              </div>
              <button onClick={() => setBreakdownData(null)} className="text-gray-400 hover:text-gray-600 text-sm">
                Close
              </button>
            </div>
            <div className="p-5 overflow-y-auto max-h-[75vh] space-y-6">
              <div className="grid sm:grid-cols-4 gap-3">
                <div className="rounded-lg border border-gray-200 p-3">
                  <div className="text-xs text-gray-500">Approved</div>
                  <div className="text-2xl font-bold text-green-600">{breakdownData.totals.approved.toFixed(1)}h</div>
                </div>
                <div className="rounded-lg border border-gray-200 p-3">
                  <div className="text-xs text-gray-500">Pending</div>
                  <div className="text-2xl font-bold text-yellow-600">{breakdownData.totals.pending.toFixed(1)}h</div>
                </div>
                <div className="rounded-lg border border-gray-200 p-3">
                  <div className="text-xs text-gray-500">Expected Approved</div>
                  <div className="text-2xl font-bold text-gray-900">{breakdownData.totals.reconciliation.expectedApproved.toFixed(1)}h</div>
                </div>
                <div className={`rounded-lg border p-3 ${breakdownData.totals.reconciliation.reconciled ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
                  <div className="text-xs text-gray-500">Reconciliation</div>
                  <div className={`text-sm font-semibold mt-1 ${breakdownData.totals.reconciliation.reconciled ? "text-green-700" : "text-red-700"}`}>
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
                  <div key={label} className="rounded-lg border border-gray-200 p-4">
                    <div className="text-sm font-semibold text-gray-800">{label}</div>
                    <div className="text-xs text-gray-500 mt-1">{totals.count} record{totals.count === 1 ? "" : "s"}</div>
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
                  <div className="font-medium text-gray-900 mb-3">{section.label}</div>
                  {section.records.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-500">
                      No records in this source.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {section.records.map((record) => (
                        <div key={record.id} className="rounded-lg border border-gray-200 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="font-medium text-sm text-gray-900">{record.title}</div>
                              <div className="text-xs text-gray-500 mt-1">
                                {record.organizationName} · {new Date(record.date).toLocaleDateString()}
                                {record.category ? ` · ${record.category}` : ""}
                              </div>
                              {record.source === "SELF_SUBMISSION" && record.status === "PENDING" && record.revisionNote && (
                                <div className="mt-2 inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 border border-amber-200">
                                  {`Revision ${Math.max(1, record.timesRevised ?? 1)}`}
                                </div>
                              )}
                            </div>
                            <div className="text-right text-xs">
                              <div className="font-semibold text-gray-700">{record.status}{record.verificationStatus ? ` · ${record.verificationStatus}` : ""}</div>
                              <div className="text-gray-500 mt-1">
                                {record.approvedHours > 0 ? `${record.approvedHours.toFixed(1)}h approved` : `${record.pendingHours.toFixed(1)}h pending`}
                              </div>
                            </div>
                          </div>

                          {(record.description || record.evidenceNote || record.rejectionReason || record.revisionNote) && (
                            <div className="mt-3 space-y-1 text-xs text-gray-600">
                              {record.description && <div>Description: {record.description}</div>}
                              {record.evidenceNote && <div>Evidence: {record.evidenceNote}</div>}
                              {record.rejectionReason && <div className="text-red-600">Rejected: {record.rejectionReason}</div>}
                              {record.revisionNote && (
                                <div className="text-amber-700">
                                  {record.status === "PENDING"
                                    ? `Revised after note (${`Revision ${Math.max(1, record.timesRevised ?? 1)}`}):`
                                    : "Revision requested:"}{" "}
                                  {record.revisionNote}
                                </div>
                              )}
                            </div>
                          )}

                          {record.reviewer && (
                            <div className="mt-3 text-xs text-gray-500">
                              Reviewed by {record.reviewer.name} ({record.reviewer.role})
                              {record.reviewedAt ? ` · ${new Date(record.reviewedAt).toLocaleString()}` : ""}
                            </div>
                          )}

                          {record.auditTrail && record.auditTrail.length > 0 && (
                            <div className="mt-3 space-y-2">
                              {record.auditTrail.map((entry) => (
                                <div key={entry.id} className="rounded bg-gray-50 border border-gray-100 p-2">
                                  <div className="flex justify-between gap-3">
                                    <div className="text-xs font-medium text-gray-800">{entry.action}</div>
                                    <div className="text-xs text-gray-400">{new Date(entry.createdAt).toLocaleString()}</div>
                                  </div>
                                  <div className="text-xs text-gray-500 mt-0.5">{entry.actor.name} · {entry.actor.role}</div>
                                  {formatHistoryDetails(entry.details) && (
                                    <div className="text-xs text-gray-600 mt-1">{formatHistoryDetails(entry.details)}</div>
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
