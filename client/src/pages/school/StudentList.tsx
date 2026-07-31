import { useEffect, useState } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import { api, getErrorMessage } from "../../lib/api";
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

interface CohortResponse {
  name: string;
  requiredHours: number;
  students: Array<Student & { approvedHours: number; riskReasons?: string[] }>;
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

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [cohortId, location.pathname]);

  const load = async () => {
    setLoading(true);
    try {
      if (cohortId) {
        const cohort = await api.get<CohortResponse>(`/cohorts/${cohortId}`);
        setCohortName(cohort.name);
        const req = cohort.requiredHours;
        const mapped: Student[] = cohort.students.map((s) => ({
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
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to load verification history."));
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
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to load hour breakdown."));
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
        <Link to={backLink} className="text-[var(--text-sec)] hover:text-[var(--text)] text-sm">{backLabel}</Link>
        <span className="text-[var(--text-faint)]">/</span>
        <h1 className="text-[20px] font-semibold">{title}</h1>
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
                  ? "border-blue-600 text-[var(--action)]"
                  : "border-transparent text-[var(--text-sec)] hover:text-[var(--text)]"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      )}

      {error && <div className="p-3 bg-[var(--er-bg)] border border-[var(--er-b)] rounded text-[var(--er-t)] text-sm mb-4">{error}</div>}

      {loading ? (
        <div className="text-[var(--text-sec)] text-sm py-8 text-center">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-[var(--surface-alt)] border border-[var(--border)] rounded-[3px] p-8 text-center text-[var(--text-sec)]">
          No students found.
        </div>
      ) : (
        <div>
          <div className="text-sm text-[var(--text-sec)] mb-3">{filtered.length} student{filtered.length !== 1 ? "s" : ""}</div>
          <div className="border border-[var(--border)] rounded-[3px] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-alt)] border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-[var(--text-sec)]">Name</th>
                  <th className="text-left px-4 py-2 font-medium text-[var(--text-sec)]">Email</th>
                  {!cohortId && <th className="text-left px-4 py-2 font-medium text-[var(--text-sec)]">Cohort</th>}
                  <th className="text-right px-4 py-2 font-medium text-[var(--text-sec)]">Hours</th>
                  <th className="text-right px-4 py-2 font-medium text-[var(--text-sec)]">Remaining</th>
                  <th className="text-right px-4 py-2 font-medium text-[var(--text-sec)]">Required</th>
                  <th className="text-right px-4 py-2 font-medium text-[var(--text-sec)]">Status</th>
                  <th className="text-left px-4 py-2 font-medium text-[var(--text-sec)]">Intervention</th>
                  <th className="text-right px-4 py-2 font-medium text-[var(--text-sec)]">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-[var(--surface-alt)]">
                    <td className="px-4 py-2 font-medium">{s.name}</td>
                    <td className="px-4 py-2 text-[var(--text-sec)] text-xs">{s.email}</td>
                    {!cohortId && <td className="px-4 py-2 text-[var(--text-sec)] text-xs">{s.cohortName}</td>}
                    <td className="px-4 py-2 text-right font-medium">{s.approvedHours.toFixed(1)}</td>
                    <td className="px-4 py-2 text-right font-medium text-[var(--er-t)]">{(s.remainingHours ?? Math.max(0, s.requiredHours - s.approvedHours)).toFixed(1)}h</td>
                    <td className="px-4 py-2 text-right text-[var(--text-faint)]">{s.requiredHours}h</td>
                    <td className="px-4 py-2 text-right">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        s.status === "COMPLETED" ? "bg-[var(--ok-bg)] text-[var(--ok-t)]" :
                        s.status === "ON_TRACK" ? "bg-[var(--in-bg)] text-[var(--action)]" :
                        "bg-[var(--er-bg)] text-[var(--er-t)]"
                      }`}>{s.status.replace("_", " ")}</span>
                    </td>
                    <td className="px-4 py-2 text-xs text-[var(--text-sec)]">
                      {s.interventionCase ? (
                        <div>
                          <div className={`inline-flex px-2 py-0.5 rounded-full font-medium ${s.interventionCase.status === 'RESOLVED' ? 'bg-[var(--ok-bg)] text-[var(--ok-t)]' : s.interventionCase.priority === 'URGENT' ? 'bg-[var(--er-bg)] text-[var(--er-t)]' : 'bg-[var(--in-bg)] text-[var(--action)]'}`}>{s.interventionCase.status.replaceAll('_', ' ')}</div>
                          {s.interventionCase.summary && <div className="mt-1 text-[var(--text-sec)]">{s.interventionCase.summary}</div>}
                        </div>
                      ) : (
                        <span className="text-[var(--text-faint)]">No case</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          onClick={() => loadHourBreakdown(s.id)}
                          disabled={breakdownLoadingId === s.id}
                          className="px-2.5 py-1 border border-[var(--border-s)] rounded text-xs text-[var(--text-sec)] hover:bg-[var(--surface-alt)] disabled:opacity-50"
                        >
                          {breakdownLoadingId === s.id ? "..." : "Hours"}
                        </button>
                        <button
                          onClick={() => loadVerificationHistory(s.id)}
                          disabled={historyLoadingId === s.id}
                          className="px-2.5 py-1 border border-[var(--border-s)] rounded text-xs text-[var(--text-sec)] hover:bg-[var(--surface-alt)] disabled:opacity-50"
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

      {historyData && (
        <div className="fixed inset-0 z-30 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-[var(--surface)] rounded-[3px]  border border-[var(--border)] max-h-[85vh] overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-start justify-between gap-4">
              <div>
                <div className="font-semibold text-[var(--text)]">Beneficiary Verification History</div>
                <div className="text-sm text-[var(--text-sec)] mt-1">
                  {historyData.student.name} · {historyData.student.email}
                </div>
              </div>
              <button onClick={() => setHistoryData(null)} className="text-[var(--text-faint)] hover:text-[var(--text-sec)] text-sm">
                Close
              </button>
            </div>
            <div className="p-5 overflow-y-auto max-h-[70vh] space-y-4">
              {historyData.signups.length === 0 ? (
                <div className="text-sm text-[var(--text-sec)]">No beneficiary verification activity recorded for this student.</div>
              ) : (
                historyData.signups.map((signup) => (
                  <div key={signup.id} className="border border-[var(--border)] rounded-[3px] p-4">
                    <div className="flex justify-between gap-4">
                      <div>
                        <div className="font-medium text-sm">{signup.slot.opportunity.title}</div>
                        <div className="text-xs text-[var(--text-sec)] mt-0.5">
                          {signup.slot.opportunity.beneficiary.name} · {new Date(signup.slot.date).toLocaleDateString(undefined, { timeZone: "UTC" })} · {signup.totalHours ?? signup.slot.durationHours}h
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-medium text-[var(--text)]">{signup.status === "NO_SHOW" ? "NO_SHOW" : signup.verificationStatus}</div>
                        {signup.rejectionReason && (
                          <div className="text-xs text-[var(--er-t)] mt-1">{signup.rejectionReason}</div>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      {signup.history.length === 0 ? (
                        <div className="text-xs text-[var(--text-faint)]">No audit events recorded.</div>
                      ) : (
                        signup.history.map((entry) => (
                          <div key={entry.id} className="bg-[var(--surface-alt)] border border-[var(--border)] rounded p-2">
                            <div className="flex justify-between gap-3">
                              <div className="text-xs font-medium text-[var(--text)]">{entry.action}</div>
                              <div className="text-xs text-[var(--text-faint)]">{new Date(entry.createdAt).toLocaleString()}</div>
                            </div>
                            <div className="text-xs text-[var(--text-sec)] mt-0.5">{entry.actor.name} · {entry.actor.role}</div>
                            {formatHistoryDetails(entry.details) && (
                              <div className="text-xs text-[var(--text-sec)] mt-1">{formatHistoryDetails(entry.details)}</div>
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
