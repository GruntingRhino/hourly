import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";
import { CollapsibleList } from "../../components/CollapsibleList";

interface Signup {
  id: string;
  status: string;
  verificationStatus: string;
  totalHours: number | null;
  createdAt: string;
  updatedAt: string;
  auditLogs: {
    id: string;
    action: string;
    details: string | null;
    createdAt: string;
  }[];
  slot: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    durationHours: number;
    opportunity: {
      id: string;
      title: string;
      location: string | null;
      beneficiary: { id: string; name: string; category: string | null };
    };
  };
}

interface SelfSubmission {
  id: string;
  status: string;
  organizationName: string;
  hours: number;
  date: string;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string | null;
  revisionNote?: string | null;
  rejectionReason?: string | null;
  timesRevised?: number;
  category?: string | null;
}

interface AvailableSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  capacity: number;
  _count: { signups: number };
  opportunity: {
    title: string;
    location: string | null;
    category: string | null;
    beneficiary: { id: string; name: string; category: string | null };
  };
}

interface PastActivityItem {
  id: string;
  sortTime: number;
  title: string;
  subtitle: string;
  meta: string;
  hoursLabel: string;
  status: string;
}

interface RecentActivityItem {
  id: string;
  sortTime: number;
  title: string;
  detail: string;
  status: string;
}

function parseJsonDetails(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function describeSignupAuditEvent(signup: Signup, audit: Signup["auditLogs"][number]): RecentActivityItem {
  const details = parseJsonDetails(audit.details);
  const dateLabel = new Date(audit.createdAt).toLocaleDateString();

  if (audit.action === "SIGNUP_CONFIRMED") {
    return {
      id: audit.id,
      sortTime: new Date(audit.createdAt).getTime(),
      title: signup.slot.opportunity.title,
      detail: `${signup.slot.opportunity.beneficiary.name} · Signed up on ${dateLabel}`,
      status: "CONFIRMED",
    };
  }

  if (audit.action === "SIGNUP_WAITLISTED") {
    return {
      id: audit.id,
      sortTime: new Date(audit.createdAt).getTime(),
      title: signup.slot.opportunity.title,
      detail: `${signup.slot.opportunity.beneficiary.name} · Joined waitlist on ${dateLabel}`,
      status: "WAITLISTED",
    };
  }

  if (audit.action === "WAITLIST_PROMOTED") {
    return {
      id: audit.id,
      sortTime: new Date(audit.createdAt).getTime(),
      title: signup.slot.opportunity.title,
      detail: `${signup.slot.opportunity.beneficiary.name} · Promoted off waitlist on ${dateLabel}`,
      status: "CONFIRMED",
    };
  }

  if (audit.action === "SIGNUP_CANCELLED") {
    return {
      id: audit.id,
      sortTime: new Date(audit.createdAt).getTime(),
      title: signup.slot.opportunity.title,
      detail: `${signup.slot.opportunity.beneficiary.name} · Cancelled on ${dateLabel}`,
      status: "CANCELLED",
    };
  }

  if (audit.action === "APPROVE" || audit.action === "APPROVAL_UPDATED" || audit.action === "CAP_OVERRIDE") {
    const approvedHours = typeof details.approvedHours === "number" ? `${details.approvedHours}h` : `${(signup.totalHours ?? signup.slot.durationHours).toFixed(1)}h`;
    return {
      id: audit.id,
      sortTime: new Date(audit.createdAt).getTime(),
      title: signup.slot.opportunity.title,
      detail: `${signup.slot.opportunity.beneficiary.name} · Approved ${approvedHours} on ${dateLabel}`,
      status: "APPROVED",
    };
  }

  if (audit.action === "REJECT" || audit.action === "REJECTION_UPDATED") {
    const reason = typeof details.reason === "string" ? ` · ${details.reason}` : "";
    return {
      id: audit.id,
      sortTime: new Date(audit.createdAt).getTime(),
      title: signup.slot.opportunity.title,
      detail: `${signup.slot.opportunity.beneficiary.name} · Rejected on ${dateLabel}${reason}`,
      status: "REJECTED",
    };
  }

  if (audit.action === "REVIEW_RESET") {
    return {
      id: audit.id,
      sortTime: new Date(audit.createdAt).getTime(),
      title: signup.slot.opportunity.title,
      detail: `${signup.slot.opportunity.beneficiary.name} · Review reset on ${dateLabel}`,
      status: "PENDING",
    };
  }

  if (audit.action === "NO_SHOW") {
    return {
      id: audit.id,
      sortTime: new Date(audit.createdAt).getTime(),
      title: signup.slot.opportunity.title,
      detail: `${signup.slot.opportunity.beneficiary.name} · Marked no-show on ${dateLabel}`,
      status: "NO_SHOW",
    };
  }

  return {
    id: audit.id,
    sortTime: new Date(audit.createdAt).getTime(),
    title: signup.slot.opportunity.title,
    detail: `${signup.slot.opportunity.beneficiary.name} · ${audit.action} on ${dateLabel}`,
    status: signup.verificationStatus,
  };
}

/** Returns the effective service deadline: cohort override first, then school. */
function resolveDeadline(user: any): Date | null {
  const cohortEnd = user?.cohort?.serviceEndDate;
  const firstLinkedCohortEnd = user?.cohorts?.[0]?.serviceEndDate ?? null;
  const schoolEnd = user?.school?.serviceEndDate ?? user?.cohort?.school?.serviceEndDate;
  const raw = cohortEnd ?? firstLinkedCohortEnd ?? schoolEnd ?? null;
  return raw ? new Date(raw) : null;
}

function getSlotEndAt(slotDate: string, endTime: string): Date {
  const [hours, minutes] = endTime.split(":").map(Number);
  const endAt = new Date(slotDate);
  endAt.setUTCHours(hours, minutes, 0, 0);
  return endAt;
}

function DeadlineBanner({ deadline, approvedHours, requiredHours }: { deadline: Date; approvedHours: number; requiredHours: number }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysLeft = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const hoursLeft = Math.max(0, requiredHours - approvedHours);
  const done = approvedHours >= requiredHours;

  if (done) return null; // no banner needed once complete

  const urgent = daysLeft <= 14;
  const pastDue = daysLeft < 0;

  if (pastDue) {
    return (
      <div className="mb-6 px-4 py-3 rounded-[3px] border border-[var(--er-b)] text-[13px]" style={{ background: "var(--er-bg)", color: "var(--er-t)" }}>
        <strong>Service period ended</strong> on {deadline.toLocaleDateString()}. You still need{" "}
        <strong>{hoursLeft.toFixed(1)}h</strong> — contact your school administrator.
      </div>
    );
  }

  return (
    <div className={`mb-6 px-4 py-3 rounded-[3px] border text-[13px]`} style={urgent
      ? { background: "var(--wn-bg)", borderColor: "var(--wn-b)", color: "var(--wn-t)" }
      : { background: "var(--in-bg)", borderColor: "var(--in-b)", color: "var(--in-t)" }
    }>
      <strong>{daysLeft} day{daysLeft !== 1 ? "s" : ""} left</strong> to complete{" "}
      <strong>{hoursLeft.toFixed(1)}h</strong> more by{" "}
      {deadline.toLocaleDateString()}
      {!urgent && "."}
    </div>
  );
}

interface HourTotals {
  totalApprovedHours: number;
  totalPendingHours: number;
  requiredHours: number;
  interventionCase?: {
    id: string;
    status: string;
    priority: string;
    reason: string | null;
    summary: string | null;
    nextStepForStudent: string | null;
    nextStepForStaff: string | null;
    staffNote: string | null;
    studentMessage: string | null;
    dueDate: string | null;
    lastContactedAt: string | null;
    lastStudentActionAt: string | null;
    resolvedAt: string | null;
    owner?: { id: string; name: string; role: string; email?: string | null } | null;
  } | null;
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [signups, setSignups] = useState<Signup[]>([]);
  const [selfSubs, setSelfSubs] = useState<SelfSubmission[]>([]);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [hourTotals, setHourTotals] = useState<HourTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Array<{
    id: string;
    opportunityId: string;
    status: string;
    verificationStatus: string;
    checkInTime: string | null;
    checkOutTime: string | null;
    submittedAt: string | null;
    totalHours: number | null;
    opportunity: {
      id: string;
      title: string;
      date: string;
      startTime: string;
      endTime: string;
    };
  }>>([]);
  const [verificationSession, setVerificationSession] = useState<(typeof sessions)[number] | null>(null);
  const [verificationSignature, setVerificationSignature] = useState("");
  const [verificationLoading, setVerificationLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [s, ss, slots, report, studentSessions] = await Promise.all([
        api.get<Signup[]>("/beneficiaries/my-signups"),
        api.get<SelfSubmission[]>("/self-submissions").catch(() => [] as SelfSubmission[]),
        api.get<AvailableSlot[]>("/beneficiaries/available-slots").catch(() => [] as AvailableSlot[]),
        api.get<HourTotals>("/reports/student").catch(() => null),
        api.get<Array<{
          id: string;
          opportunityId: string;
          status: string;
          verificationStatus: string;
          checkInTime: string | null;
          checkOutTime: string | null;
          submittedAt: string | null;
          totalHours: number | null;
          opportunity: {
            id: string;
            title: string;
            date: string;
            startTime: string;
            endTime: string;
          };
        }>>("/sessions/my").catch(() => []),
      ]);
      setSignups(s);
      setSelfSubs(ss);
      setAvailableSlots(slots);
      setHourTotals(report);
      setSessions(studentSessions);
    } catch {
      setError("Failed to load dashboard. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadData(); }, []);

  const handleCancel = async (signupId: string) => {
    if (!confirm("Cancel your spot in this activity?")) return;
    setCancelling(signupId);
    try {
      await api.post(`/beneficiaries/signups/${signupId}/cancel`, {});
      void loadData();
    } catch (err: any) {
      alert(err.message || "Failed to cancel signup.");
    } finally {
      setCancelling(null);
    }
  };

  const handleSessionAction = async (sessionId: string, action: "checkin" | "checkout") => {
    try {
      await api.post(`/sessions/${sessionId}/${action}`, {});
      await loadData();
    } catch (err: any) {
      alert(err.message || `Failed to ${action === "checkin" ? "check in" : "check out"}.`);
    }
  };

  const handleVerificationSubmit = async () => {
    if (!verificationSession) return;
    const signature = verificationSignature.trim();
    if (!signature) {
      alert("Please type your full name to sign the verification.");
      return;
    }
    setVerificationLoading(true);
    try {
      await api.post(`/sessions/${verificationSession.id}/submit-verification`, {
        signatureType: "DRAWN",
        signatureData: signature,
      });
      setVerificationSession(null);
      setVerificationSignature("");
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to submit verification.");
    } finally {
      setVerificationLoading(false);
    }
  };

  if (loading) return <div style={{ color: "var(--text-faint)" }}>Loading dashboard...</div>;
  if (error) return <div className="px-4 py-3 rounded-[3px] border border-[var(--er-b)] text-[13px]" style={{ background: "var(--er-bg)", color: "var(--er-t)" }}>{error}</div>;

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Use server-computed totals so all three hour sources (BeneficiarySignup,
  // SelfSubmittedRequest, ServiceSession) are included — matching school reports.
  const fallbackRequired = user?.cohort?.requiredHours ?? user?.school?.requiredHours ?? 40;
  const totalApprovedHours = hourTotals?.totalApprovedHours ?? 0;
  const totalPendingHours = hourTotals?.totalPendingHours ?? 0;
  const requiredHours = hourTotals?.requiredHours ?? fallbackRequired;
  const remainingHours = Math.max(0, requiredHours - totalApprovedHours);
  const deadline = resolveDeadline(user);

  const upcoming = signups
    .filter((s) => s.status === "CONFIRMED" && new Date(s.slot.date) >= now)
    .sort((a, b) => new Date(a.slot.date).getTime() - new Date(b.slot.date).getTime());
  const sessionByOpportunityId = new Map(sessions.map((session) => [session.opportunityId, session]));

  const recentActivity: RecentActivityItem[] = [
    ...signups.flatMap((s) => s.auditLogs.map((audit) => describeSignupAuditEvent(s, audit))),
    ...selfSubs
      .filter((s) => s.status !== "PENDING" || !!s.reviewedAt || !!s.revisionNote)
      .map((s) => ({
        id: `self-change-${s.id}`,
        sortTime: new Date(s.reviewedAt || s.updatedAt || s.createdAt).getTime(),
        title: s.organizationName,
        detail: (() => {
          const dateLabel = new Date(s.reviewedAt || s.updatedAt || s.createdAt).toLocaleDateString();
          if (s.status === "REVISION_REQUESTED" && s.revisionNote) {
            return `Self-submitted · Revision requested on ${dateLabel}: ${s.revisionNote}`;
          }
          if (s.status === "PENDING" && (s.timesRevised ?? 0) > 0) {
            return `Self-submitted · Resubmitted as Revision ${s.timesRevised} on ${dateLabel}`;
          }
          if (s.status === "APPROVED") {
            return `Self-submitted · Approved on ${dateLabel}`;
          }
          if (s.status === "REJECTED") {
            return `Self-submitted · Rejected on ${dateLabel}${s.rejectionReason ? `: ${s.rejectionReason}` : ""}`;
          }
          if (s.status === "CANCELLED") {
            return `Self-submitted · Cancelled on ${dateLabel}`;
          }
          return `Self-submitted · ${dateLabel}`;
        })(),
        status: s.status,
      })),
  ]
    .sort((a, b) => b.sortTime - a.sortTime)
    .slice(0, 6);

  const pastActivities: PastActivityItem[] = [
    ...signups
      .filter((s) => s.status !== "CANCELLED" && s.status !== "WAITLISTED")
      .filter((s) => getSlotEndAt(s.slot.date, s.slot.endTime).getTime() < Date.now() || s.verificationStatus === "APPROVED")
      .map((s) => ({
        id: `signup-${s.id}`,
        sortTime: getSlotEndAt(s.slot.date, s.slot.endTime).getTime(),
        title: s.slot.opportunity.title,
        subtitle: s.slot.opportunity.beneficiary.name,
        meta: `${new Date(s.slot.date).toLocaleDateString()} · ${s.slot.startTime}–${s.slot.endTime}`,
        hoursLabel: `${(s.totalHours ?? s.slot.durationHours).toFixed(1)}h`,
        status: s.verificationStatus,
      })),
    ...selfSubs
      .filter((s) => s.status !== "CANCELLED")
      .map((s) => ({
        id: `self-${s.id}`,
        sortTime: new Date(s.date).getTime(),
        title: s.organizationName,
        subtitle: "Self-submitted",
        meta: new Date(s.date).toLocaleDateString(),
        hoursLabel: `${s.hours.toFixed(1)}h`,
        status: s.status,
      })),
  ]
    .sort((a, b) => b.sortTime - a.sortTime)
    .slice(0, 8);

  const revisionNeeded = selfSubs.filter((s) => s.status === "REVISION_REQUESTED");
  const signedUpSlotIds = new Set(signups.map((signup) => signup.slot.id));
  const categoryHistory = new Map<string, number>();
  for (const signup of signups) {
    if (signup.status === "CANCELLED") continue;
    const category = signup.slot.opportunity.beneficiary.category || "general";
    categoryHistory.set(category, (categoryHistory.get(category) ?? 0) + 1);
  }
  for (const submission of selfSubs) {
    if (submission.status === "REJECTED") continue;
    const category = submission.category || "general";
    categoryHistory.set(category, (categoryHistory.get(category) ?? 0) + 1);
  }

  const recommended = availableSlots
    .filter((slot) => !signedUpSlotIds.has(slot.id))
    .map((slot) => {
      const slotDate = new Date(slot.date);
      const daysUntil = Math.max(0, Math.ceil((slotDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      const category = slot.opportunity.category || slot.opportunity.beneficiary.category || "general";
      const priorCount = categoryHistory.get(category) ?? 0;
      const openSpots = Math.max(0, slot.capacity - slot._count.signups);
      const reasons = [];

      if (priorCount === 0) reasons.push("new category");
      if (openSpots > 0) reasons.push(`${openSpots} open spot${openSpots === 1 ? "" : "s"}`);
      if (daysUntil <= 14) reasons.push(daysUntil === 0 ? "today" : `${daysUntil} day${daysUntil === 1 ? "" : "s"} away`);
      if (remainingHours > 0) reasons.push(`${Math.min(slot.durationHours, remainingHours).toFixed(1)}h toward goal`);

      let score = 0;
      score += Math.min(slot.durationHours, Math.max(remainingHours, slot.durationHours)) * 6;
      score += Math.max(0, 21 - Math.min(daysUntil, 21));
      score += openSpots > 0 ? 20 : 6;
      score += priorCount === 0 ? 16 : Math.max(0, 10 - priorCount * 3);
      if (daysUntil <= 7) score += 6;
      if (openSpots === 0) score -= 8;

      return {
        slot,
        score,
        openSpots,
        reasons: reasons.slice(0, 3),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return (
    <div>
      <div className="mb-6">
        <div className="text-[12px] mb-1" style={{ color: "var(--text-faint)" }}>Dashboard / Student</div>
        <h1 className="text-[20px] font-semibold" style={{ color: "var(--text)" }}>Dashboard</h1>
      </div>

      {deadline && (
        <DeadlineBanner deadline={deadline} approvedHours={totalApprovedHours} requiredHours={requiredHours} />
      )}

      {hourTotals?.interventionCase && hourTotals.interventionCase.status !== "RESOLVED" && (
        <div className="mb-4 rounded-[3px] border border-[var(--er-b)] px-4 py-3 text-[13px]" style={{ background: "var(--er-bg)", color: "var(--er-t)" }}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--er-t)" }}>School Follow-Up Active</div>
              <div className="font-semibold">{hourTotals.interventionCase.summary || `${remainingHours.toFixed(1)}h still remaining`}</div>
              <div className="mt-1">
                {hourTotals.interventionCase.studentMessage || hourTotals.interventionCase.reason || `You still need ${remainingHours.toFixed(1)}h to finish your requirement.`}
              </div>
              {hourTotals.interventionCase.nextStepForStudent && (
                <div className="mt-2">
                  Next step: <strong>{hourTotals.interventionCase.nextStepForStudent}</strong>
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-3 text-[12px]">
                <span>Priority: {hourTotals.interventionCase.priority}</span>
                {hourTotals.interventionCase.dueDate && <span>Follow up by {new Date(hourTotals.interventionCase.dueDate).toLocaleDateString(undefined, { timeZone: 'UTC' })}</span>}
                {hourTotals.interventionCase.owner?.name && <span>Owner: {hourTotals.interventionCase.owner.name}</span>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/browse" className="h-[34px] px-3 flex items-center rounded-[2px] text-white text-[13px] font-medium" style={{ background: "var(--er-t)" }}>
                Find Hours
              </Link>
              <Link to="/messages" className="h-[34px] px-3 flex items-center rounded-[2px] border text-[13px] font-medium" style={{ borderColor: "var(--er-b)", color: "var(--er-t)", background: "var(--surface)" }}>
                Contact School
              </Link>
            </div>
          </div>
        </div>
      )}

      {revisionNeeded.length > 0 && (
        <div className="mb-4 px-4 py-3 rounded-[3px] border border-[var(--wn-b)] text-[13px]" style={{ background: "var(--wn-bg)", color: "var(--wn-t)" }}>
          <strong>{revisionNeeded.length} submission{revisionNeeded.length > 1 ? "s" : ""} need revision.</strong>{" "}
          <Link to="/submit" className="underline hover:opacity-75">Review &rarr;</Link>
        </div>
      )}

      {user?.cohort && (
        <div className="mb-4 px-4 py-3 rounded-[3px] border border-[var(--in-b)] text-[13px]" style={{ background: "var(--in-bg)", color: "var(--in-t)" }}>
          Cohort: <strong>{user.cohort.name}</strong>
          {user.cohort.requiredHours && <span className="ml-2">Goal: {user.cohort.requiredHours}h</span>}
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="mb-6 border border-[var(--border)] rounded-[3px] p-4" style={{ background: "var(--surface)" }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>Attendance & Verification</h2>
            <span className="text-[12px]" style={{ color: "var(--text-faint)" }}>Check in at start, check out when you finish</span>
          </div>
          <div className="space-y-3">
            {upcoming.slice(0, 3).map((signup) => {
              const session = sessionByOpportunityId.get(signup.slot.opportunity.id);
              const sessionStatus = session?.status ?? signup.status;
              const isPendingCheckIn = sessionStatus === "PENDING_CHECKIN" || sessionStatus === "COMMITTED";
              const isCheckedIn = sessionStatus === "CHECKED_IN";
              const isCheckedOut = sessionStatus === "CHECKED_OUT";
              const canVerify = isCheckedOut || session?.verificationStatus === "PENDING";

              return (
                <div key={signup.id} className="rounded-[3px] border border-[var(--border)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-[13.5px]" style={{ color: "var(--text)" }}>{signup.slot.opportunity.title}</div>
                      <div className="text-[12.5px] mt-0.5" style={{ color: "var(--text-sec)" }}>
                        {new Date(signup.slot.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} · {signup.slot.startTime}–{signup.slot.endTime}
                      </div>
                      <div className="text-[12px] mt-0.5" style={{ color: "var(--text-faint)" }}>{signup.slot.opportunity.beneficiary.name}</div>
                    </div>
                    <StatusBadge status={session?.verificationStatus === "APPROVED" ? "APPROVED" : signup.verificationStatus} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {session && isPendingCheckIn && (
                      <button
                        onClick={() => handleSessionAction(session.id, "checkin")}
                        className="h-[34px] px-3 rounded-[2px] text-[13px] font-medium text-white"
                        style={{ background: "var(--action)" }}
                      >
                        Check In
                      </button>
                    )}
                    {session && isCheckedIn && (
                      <button
                        onClick={() => handleSessionAction(session.id, "checkout")}
                        className="h-[34px] px-3 rounded-[2px] text-[13px] font-medium text-white"
                        style={{ background: "var(--ok-t)" }}
                      >
                        Check Out
                      </button>
                    )}
                    {session && canVerify && (
                      <button
                        onClick={() => setVerificationSession(session)}
                        className="h-[34px] px-3 rounded-[2px] border text-[13px] font-medium"
                        style={{ borderColor: "var(--border-s)", color: "var(--text)", background: "var(--surface)" }}
                      >
                        Submit Verification
                      </button>
                    )}
                    {session?.status === "CHECKED_OUT" && session.verificationStatus === "PENDING" && (
                      <span className="h-[34px] px-3 flex items-center rounded-[2px] text-[13px] font-medium" style={{ background: "var(--wn-bg)", color: "var(--wn-t)" }}>
                        Awaiting school review
                      </span>
                    )}
                    {session?.verificationStatus === "APPROVED" && (
                      <span className="h-[34px] px-3 flex items-center rounded-[2px] text-[13px] font-medium" style={{ background: "var(--ok-bg)", color: "var(--ok-t)" }}>
                        Verified
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 mb-6" style={{ border: "1px solid var(--border)", borderRadius: 3, overflow: "hidden" }}>
        {[
          { label: "Verified Hours", value: totalApprovedHours.toFixed(1), sub: `of ${requiredHours} required`, color: "var(--ok-t)" },
          { label: "Pending Verification", value: `${totalPendingHours.toFixed(1)}h`, sub: "awaiting approval", color: "var(--wn-t)" },
          { label: "Activities Signed Up", value: String(signups.filter(s => s.status !== "CANCELLED").length), sub: "upcoming", color: "var(--action)" },
          { label: "Hours Remaining", value: `${remainingHours.toFixed(1)}h`, sub: "needed to reach goal", color: remainingHours > 0 ? "var(--er-t)" : "var(--text)" },
        ].map((stat, i) => (
          <div key={stat.label} className={`px-5 py-4 ${i < 3 ? "border-r" : ""}`} style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="text-[11px] font-semibold uppercase tracking-[.07em] mb-2" style={{ color: "var(--text-faint)" }}>{stat.label}</div>
            <div className="text-[28px] font-bold leading-none" style={{ color: stat.color }}>{stat.value}</div>
            <div className="text-[12px] mt-1" style={{ color: "var(--text-faint)" }}>{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="border border-[var(--border)] rounded-[3px] px-5 py-4 mb-6" style={{ background: "var(--surface)" }}>
        <div className="flex justify-between text-[13.5px] mb-2">
          <span className="font-semibold" style={{ color: "var(--text)" }}>Progress toward goal</span>
          <span style={{ color: "var(--text-sec)" }}>{totalApprovedHours.toFixed(1)} / {requiredHours} hours</span>
        </div>
        <div className="w-full rounded-full h-[5px] border border-[var(--border)]" style={{ background: "var(--surface-alt)" }}>
          <div
            className="h-[5px] rounded-full transition-all"
            style={{ width: `${Math.min(100, (totalApprovedHours / requiredHours) * 100)}%`, background: "var(--action)" }}
          />
        </div>
        {totalPendingHours > 0 && (
          <div className="text-[12px] mt-1.5" style={{ color: "var(--wn-t)" }}>{totalPendingHours.toFixed(1)}h more pending approval</div>
        )}
      </div>

      {recommended.length > 0 && totalApprovedHours < requiredHours && (
        <div className="mb-7">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>Recommended Opportunities</h2>
            <Link to="/browse" className="text-[13px] hover:opacity-75" style={{ color: "var(--action)" }}>Browse all</Link>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            {recommended.map(({ slot, openSpots, reasons }) => {
              const slotCategory = slot.opportunity.category || slot.opportunity.beneficiary.category || "General";
              return (
                <Link
                  key={slot.id}
                  to={`/slot/${slot.id}`}
                  className="border border-[var(--border)] rounded-[3px] p-4 transition-colors hover:border-[var(--action)]"
                  style={{ background: "var(--surface)" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-[13.5px]" style={{ color: "var(--text)" }}>{slot.opportunity.title}</div>
                      <div className="text-[12.5px] mt-0.5" style={{ color: "var(--text-sec)" }}>{slot.opportunity.beneficiary.name}</div>
                    </div>
                    <StatusBadge status={openSpots > 0 ? "OPEN" : "WAITLISTED"} />
                  </div>
                  <div className="text-[12.5px] mt-2.5" style={{ color: "var(--text-sec)" }}>
                    {new Date(slot.date).toLocaleDateString()} · {slot.startTime}–{slot.endTime}
                  </div>
                  <div className="text-[12.5px] font-semibold mt-0.5" style={{ color: "var(--action)" }}>
                    {slot.durationHours}h · {slotCategory}
                  </div>
                  {slot.opportunity.location && (
                    <div className="text-[12px] mt-0.5" style={{ color: "var(--text-faint)" }}>{slot.opportunity.location}</div>
                  )}
                  {reasons.length > 0 && (
                    <div className="text-[11.5px] mt-2" style={{ color: "var(--action)" }}>
                      Recommended because {reasons.join(" · ")}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Upcoming */}
        <div>
          <h2 className="text-[14px] font-semibold mb-3" style={{ color: "var(--text)" }}>Upcoming Activities</h2>
          {upcoming.length === 0 ? (
            <div className="border border-[var(--border)] rounded-[3px] p-5 text-[13.5px]" style={{ background: "var(--surface)", color: "var(--text-sec)" }}>
              No upcoming activities.{" "}
              <Link to="/browse" className="hover:underline" style={{ color: "var(--action)" }}>Browse opportunities</Link>
            </div>
          ) : (
            <div className="border border-[var(--border)] rounded-[3px] overflow-hidden" style={{ background: "var(--surface)" }}>
              {upcoming.slice(0, 5).map((s, i, arr) => (
                <div key={s.id} className={`p-4 ${i < arr.length - 1 ? "border-b border-[var(--border)]" : ""}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-semibold text-[13.5px]" style={{ color: "var(--text)" }}>{s.slot.opportunity.title}</div>
                      <div className="text-[12.5px] mt-0.5" style={{ color: "var(--text-sec)" }}>
                        {new Date(s.slot.date).toLocaleDateString()} · {s.slot.startTime}–{s.slot.endTime}
                      </div>
                      <div className="text-[12.5px]" style={{ color: "var(--text-faint)" }}>{s.slot.opportunity.beneficiary.name}</div>
                      {s.slot.opportunity.location && (
                        <div className="text-[12px]" style={{ color: "var(--text-faint)" }}>{s.slot.opportunity.location}</div>
                      )}
                      <div className="text-[12px] font-semibold mt-1" style={{ color: "var(--action)" }}>{s.slot.durationHours}h</div>
                    </div>
                    <button
                      onClick={() => handleCancel(s.id)}
                      disabled={cancelling === s.id}
                      className="ml-2 text-[12px] hover:opacity-75 disabled:opacity-40"
                      style={{ color: "var(--text-faint)" }}
                    >
                      {cancelling === s.id ? "..." : "Cancel"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div>
          <h2 className="text-[14px] font-semibold mb-3" style={{ color: "var(--text)" }}>Recent Activity</h2>
          {recentActivity.length === 0 ? (
            <div className="border border-[var(--border)] rounded-[3px] p-5 text-[13.5px]" style={{ background: "var(--surface)", color: "var(--text-sec)" }}>
              No recent status changes.
            </div>
          ) : (
            <div className="border border-[var(--border)] rounded-[3px] overflow-hidden" style={{ background: "var(--surface)" }}>
              <CollapsibleList limit={5} items={recentActivity.map((activity, i, arr) => (
                <div key={activity.id} className={`p-4 flex justify-between items-start ${i < arr.length - 1 ? "border-b border-[var(--border)]" : ""}`}>
                  <div>
                    <div className="font-semibold text-[13.5px]" style={{ color: "var(--text)" }}>{activity.title}</div>
                    <div className="text-[12.5px]" style={{ color: "var(--text-sec)" }}>{activity.detail}</div>
                  </div>
                  <StatusBadge status={activity.status} />
                </div>
              ))} />
            </div>
          )}
        </div>
      </div>

      <div className="mt-6">
        <h2 className="text-[14px] font-semibold mb-3" style={{ color: "var(--text)" }}>Past Activity</h2>
        {pastActivities.length === 0 ? (
          <div className="border border-[var(--border)] rounded-[3px] p-5 text-[13.5px]" style={{ background: "var(--surface)", color: "var(--text-sec)" }}>
            No activity yet.
          </div>
        ) : (
          <div className="border border-[var(--border)] rounded-[3px] overflow-hidden" style={{ background: "var(--surface)" }}>
            <CollapsibleList limit={5} items={pastActivities.map((activity, i, arr) => (
              <div key={activity.id} className={`p-4 flex justify-between items-start ${i < arr.length - 1 ? "border-b border-[var(--border)]" : ""}`}>
                <div>
                  <div className="font-semibold text-[13.5px]" style={{ color: "var(--text)" }}>{activity.title}</div>
                  <div className="text-[12.5px]" style={{ color: "var(--text-sec)" }}>{activity.subtitle}</div>
                  <div className="text-[12px] mt-0.5" style={{ color: "var(--text-faint)" }}>{activity.meta}</div>
                  <div className="text-[12px] mt-0.5" style={{ color: "var(--text-faint)" }}>{activity.hoursLabel}</div>
                </div>
                <StatusBadge status={activity.status} />
              </div>
            ))} />
          </div>
        )}
      </div>

      {verificationSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-[3px] border border-[var(--border)] p-5" style={{ background: "var(--surface)" }}>
            <div className="mb-2 text-[16px] font-semibold" style={{ color: "var(--text)" }}>Submit Verification</div>
            <div className="text-[13px] mb-4" style={{ color: "var(--text-sec)" }}>
              Type your full name to sign the verification for <strong>{verificationSession.opportunity.title}</strong>.
            </div>
            <input
              type="text"
              value={verificationSignature}
              onChange={(e) => setVerificationSignature(e.target.value)}
              placeholder="Your full name"
              className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)]"
              style={{ background: "var(--surface)", color: "var(--text)" }}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setVerificationSession(null);
                  setVerificationSignature("");
                }}
                className="h-[34px] px-3 rounded-[2px] border text-[13px] font-medium"
                style={{ borderColor: "var(--border-s)", color: "var(--text)", background: "var(--surface)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleVerificationSubmit}
                disabled={verificationLoading}
                className="h-[34px] px-3 rounded-[2px] text-[13px] font-medium text-white disabled:opacity-50"
                style={{ background: "var(--action)" }}
              >
                {verificationLoading ? "Submitting…" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  type BadgeStyle = { bg: string; color: string; border: string; label: string };
  const map: Record<string, BadgeStyle> = {
    APPROVED:           { bg: "var(--ok-bg)",  color: "var(--ok-t)",  border: "var(--ok-b)",  label: "Verified" },
    OPEN:               { bg: "var(--ok-bg)",  color: "var(--ok-t)",  border: "var(--ok-b)",  label: "Open" },
    PENDING:            { bg: "var(--wn-bg)",  color: "var(--wn-t)",  border: "var(--wn-b)",  label: "Pending" },
    CONFIRMED:          { bg: "var(--in-bg)",  color: "var(--in-t)",  border: "var(--in-b)",  label: "Confirmed" },
    WAITLISTED:         { bg: "var(--wn-bg)",  color: "var(--wn-t)",  border: "var(--wn-b)",  label: "Waitlisted" },
    REJECTED:           { bg: "var(--er-bg)",  color: "var(--er-t)",  border: "var(--er-b)",  label: "Rejected" },
    REVISION_REQUESTED: { bg: "var(--in-bg)",  color: "var(--in-t)",  border: "var(--in-b)",  label: "Needs Revision" },
    CANCELLED:          { bg: "#f0eeea",       color: "var(--text-sec)", border: "var(--border-s)", label: "Cancelled" },
    NO_SHOW:            { bg: "var(--er-bg)",  color: "var(--er-t)",  border: "var(--er-b)",  label: "No Show" },
  };
  const s = map[status] ?? { bg: "#f0eeea", color: "var(--text-sec)", border: "var(--border-s)", label: status };
  return (
    <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-[2px] uppercase tracking-wide border" style={{ background: s.bg, color: s.color, borderColor: s.border }}>
      {s.label}
    </span>
  );
}
