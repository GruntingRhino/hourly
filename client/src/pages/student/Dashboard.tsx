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
      <div className="mb-6 p-4 bg-red-50 border border-red-300 rounded-lg text-red-800 text-sm">
        <strong>Service period ended</strong> on {deadline.toLocaleDateString()}. You still need{" "}
        <strong>{hoursLeft.toFixed(1)}h</strong> — contact your school administrator.
      </div>
    );
  }

  return (
    <div className={`mb-6 p-4 rounded-lg text-sm border ${urgent ? "bg-orange-50 border-orange-300 text-orange-800" : "bg-blue-50 border-blue-200 text-blue-800"}`}>
      {urgent ? "⚠️ " : ""}<strong>{daysLeft} day{daysLeft !== 1 ? "s" : ""} left</strong> to complete{" "}
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

  if (loading) return <div className="text-gray-500">Loading dashboard...</div>;
  if (error) return <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>;

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
        <div className="text-sm font-semibold text-blue-700 mb-1">{user?.name || "Student"}</div>
        <h1 className="text-[22px] font-bold text-gray-900">Dashboard</h1>
      </div>

      {deadline && (
        <DeadlineBanner deadline={deadline} approvedHours={totalApprovedHours} requiredHours={requiredHours} />
      )}

      {hourTotals?.interventionCase && hourTotals.interventionCase.status !== "RESOLVED" && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-900">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-red-700 mb-1">School Follow-Up Active</div>
              <div className="font-semibold">{hourTotals.interventionCase.summary || `${remainingHours.toFixed(1)}h still remaining`}</div>
              <div className="mt-1 text-red-800">
                {hourTotals.interventionCase.studentMessage || hourTotals.interventionCase.reason || `You still need ${remainingHours.toFixed(1)}h to finish your requirement.`}
              </div>
              {hourTotals.interventionCase.nextStepForStudent && (
                <div className="mt-2 text-red-900">
                  Next step: <strong>{hourTotals.interventionCase.nextStepForStudent}</strong>
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-3 text-[12px] text-red-700">
                <span>Priority: {hourTotals.interventionCase.priority}</span>
                {hourTotals.interventionCase.dueDate && <span>Follow up by {new Date(hourTotals.interventionCase.dueDate).toLocaleDateString(undefined, { timeZone: 'UTC' })}</span>}
                {hourTotals.interventionCase.owner?.name && <span>Owner: {hourTotals.interventionCase.owner.name}</span>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/browse" className="rounded-md bg-red-600 px-3 py-2 text-white text-sm font-medium hover:bg-red-700">
                Find Hours
              </Link>
              <Link to="/messages" className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100">
                Contact School
              </Link>
            </div>
          </div>
        </div>
      )}

      {revisionNeeded.length > 0 && (
        <div className="mb-4 px-3.5 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[13px] text-amber-800">
          <strong>{revisionNeeded.length} submission{revisionNeeded.length > 1 ? "s" : ""} need revision.</strong>{" "}
          <Link to="/submit" className="underline hover:text-amber-900">Review &rarr;</Link>
        </div>
      )}

      {user?.cohort && (
        <div className="mb-4 px-3.5 py-2.5 bg-blue-50 border border-blue-200 rounded-lg text-[13px] text-blue-800">
          Cohort: <strong>{user.cohort.name}</strong>
          {user.cohort.requiredHours && <span className="ml-2 text-blue-600">Goal: {user.cohort.requiredHours}h</span>}
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="mb-6 bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-semibold text-gray-900">Attendance & Verification</h2>
            <span className="text-[12px] text-gray-500">Check in at start, check out when you finish</span>
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
                <div key={signup.id} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-gray-900">{signup.slot.opportunity.title}</div>
                      <div className="text-sm text-gray-500 mt-0.5">
                        {new Date(signup.slot.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} · {signup.slot.startTime}–{signup.slot.endTime}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">{signup.slot.opportunity.beneficiary.name}</div>
                    </div>
                    <StatusBadge status={session?.verificationStatus === "APPROVED" ? "APPROVED" : signup.verificationStatus} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {session && isPendingCheckIn && (
                      <button
                        onClick={() => handleSessionAction(session.id, "checkin")}
                        className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        Check In
                      </button>
                    )}
                    {session && isCheckedIn && (
                      <button
                        onClick={() => handleSessionAction(session.id, "checkout")}
                        className="rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
                      >
                        Check Out
                      </button>
                    )}
                    {session && canVerify && (
                      <button
                        onClick={() => setVerificationSession(session)}
                        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Submit Verification
                      </button>
                    )}
                    {session?.status === "CHECKED_OUT" && session.verificationStatus === "PENDING" && (
                      <span className="rounded-md bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
                        Awaiting school review
                      </span>
                    )}
                    {session?.verificationStatus === "APPROVED" && (
                      <span className="rounded-md bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5">Verified Hours</div>
          <div className="text-3xl font-bold text-green-600 leading-none">{totalApprovedHours.toFixed(1)}</div>
          <div className="text-xs text-gray-400 mt-1">of {requiredHours} required</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5">Pending Verification</div>
          <div className="text-3xl font-bold text-amber-500 leading-none">{totalPendingHours.toFixed(1)}h</div>
          <div className="text-xs text-gray-400 mt-1">awaiting approval</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5">Activities Signed Up</div>
          <div className="text-3xl font-bold text-blue-600 leading-none">{signups.filter(s => s.status !== "CANCELLED").length}</div>
          <div className="text-xs text-gray-400 mt-1">upcoming</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5">Hours Remaining</div>
          <div className={`text-3xl font-bold leading-none ${remainingHours > 0 ? "text-red-700" : "text-gray-900"}`}>{remainingHours.toFixed(1)}h</div>
          <div className="text-xs text-gray-400 mt-1">needed to reach goal</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-white border border-gray-200 rounded-lg px-5 py-4 mb-6">
        <div className="flex justify-between text-[13.5px] mb-2">
          <span className="font-semibold text-gray-900">Progress toward goal</span>
          <span className="text-gray-500">{totalApprovedHours.toFixed(1)} / {requiredHours} hours</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-[7px]">
          <div
            className="bg-blue-600 h-[7px] rounded-full transition-all"
            style={{ width: `${Math.min(100, (totalApprovedHours / requiredHours) * 100)}%` }}
          />
        </div>
        {totalPendingHours > 0 && (
          <div className="text-[12px] text-amber-500 mt-1.5">{totalPendingHours.toFixed(1)}h more pending approval</div>
        )}
      </div>

      {recommended.length > 0 && totalApprovedHours < requiredHours && (
        <div className="mb-7">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-semibold text-gray-900">Recommended Opportunities</h2>
            <Link to="/browse" className="text-[13px] text-blue-600 hover:opacity-75">Browse all</Link>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            {recommended.map(({ slot, openSpots, reasons }) => {
              const slotCategory = slot.opportunity.category || slot.opportunity.beneficiary.category || "General";
              return (
                <Link
                  key={slot.id}
                  to={`/slot/${slot.id}`}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-[13.5px] text-gray-900">{slot.opportunity.title}</div>
                      <div className="text-[12.5px] text-gray-500 mt-0.5">{slot.opportunity.beneficiary.name}</div>
                    </div>
                    <StatusBadge status={openSpots > 0 ? "OPEN" : "WAITLISTED"} />
                  </div>
                  <div className="text-[12.5px] text-gray-600 mt-2.5">
                    {new Date(slot.date).toLocaleDateString()} · {slot.startTime}–{slot.endTime}
                  </div>
                  <div className="text-[12.5px] text-blue-600 font-semibold mt-0.5">
                    {slot.durationHours}h · {slotCategory}
                  </div>
                  {slot.opportunity.location && (
                    <div className="text-[12px] text-gray-400 mt-0.5">{slot.opportunity.location}</div>
                  )}
                  {reasons.length > 0 && (
                    <div className="text-[11.5px] text-blue-700 mt-2">
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
          <h2 className="text-[15px] font-semibold text-gray-900 mb-3">Upcoming Activities</h2>
          {upcoming.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-5 text-[13.5px] text-gray-500">
              No upcoming activities.{" "}
              <Link to="/browse" className="text-blue-600 hover:underline">Browse opportunities</Link>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              {upcoming.slice(0, 5).map((s, i, arr) => (
                <div key={s.id} className={`p-4 ${i < arr.length - 1 ? "border-b border-gray-200" : ""}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-semibold text-[13.5px] text-gray-900">{s.slot.opportunity.title}</div>
                      <div className="text-[12.5px] text-gray-500 mt-0.5">
                        {new Date(s.slot.date).toLocaleDateString()} · {s.slot.startTime}–{s.slot.endTime}
                      </div>
                      <div className="text-[12.5px] text-gray-400">{s.slot.opportunity.beneficiary.name}</div>
                      {s.slot.opportunity.location && (
                        <div className="text-[12px] text-gray-400">{s.slot.opportunity.location}</div>
                      )}
                      <div className="text-[12px] font-semibold text-blue-600 mt-1">{s.slot.durationHours}h</div>
                    </div>
                    <button
                      onClick={() => handleCancel(s.id)}
                      disabled={cancelling === s.id}
                      className="ml-2 text-[12px] text-gray-400 hover:text-red-500 disabled:opacity-40"
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
          <h2 className="text-[15px] font-semibold text-gray-900 mb-3">Recent Activity</h2>
          {recentActivity.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-5 text-[13.5px] text-gray-500">
              No recent status changes.
            </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <CollapsibleList limit={5} items={recentActivity.map((activity, i, arr) => (
              <div key={activity.id} className={`p-4 flex justify-between items-start ${i < arr.length - 1 ? "border-b border-gray-200" : ""}`}>
                <div>
                  <div className="font-semibold text-[13.5px] text-gray-900">{activity.title}</div>
                  <div className="text-[12.5px] text-gray-500">{activity.detail}</div>
                </div>
                <StatusBadge status={activity.status} />
              </div>
            ))} />
          </div>
        )}
        </div>
      </div>

      <div className="mt-6">
        <h2 className="text-[15px] font-semibold text-gray-900 mb-3">Past Activity</h2>
        {pastActivities.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-5 text-[13.5px] text-gray-500">
            No activity yet.
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <CollapsibleList limit={5} items={pastActivities.map((activity, i, arr) => (
              <div key={activity.id} className={`p-4 flex justify-between items-start ${i < arr.length - 1 ? "border-b border-gray-200" : ""}`}>
                <div>
                  <div className="font-semibold text-[13.5px] text-gray-900">{activity.title}</div>
                  <div className="text-[12.5px] text-gray-500">{activity.subtitle}</div>
                  <div className="text-[12px] text-gray-400 mt-0.5">{activity.meta}</div>
                  <div className="text-[12px] text-gray-400 mt-0.5">{activity.hoursLabel}</div>
                </div>
                <StatusBadge status={activity.status} />
              </div>
            ))} />
          </div>
        )}
      </div>

      {verificationSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-2 text-lg font-semibold text-gray-900">Submit Verification</div>
            <div className="text-sm text-gray-600 mb-4">
              Type your full name to sign the verification for <strong>{verificationSession.opportunity.title}</strong>.
            </div>
            <input
              type="text"
              value={verificationSignature}
              onChange={(e) => setVerificationSignature(e.target.value)}
              placeholder="Your full name"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setVerificationSession(null);
                  setVerificationSignature("");
                }}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleVerificationSubmit}
                disabled={verificationLoading}
                className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
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
  const map: Record<string, { bg: string; text: string; label: string }> = {
    APPROVED:           { bg: "bg-green-50",  text: "text-green-700",  label: "Verified" },
    OPEN:               { bg: "bg-green-50",  text: "text-green-700",  label: "Open" },
    PENDING:            { bg: "bg-amber-50",  text: "text-amber-600",  label: "Pending" },
    CONFIRMED:          { bg: "bg-blue-50",   text: "text-blue-600",   label: "Confirmed" },
    WAITLISTED:         { bg: "bg-amber-50",  text: "text-amber-600",  label: "Waitlisted" },
    REJECTED:           { bg: "bg-red-50",    text: "text-red-600",    label: "Rejected" },
    REVISION_REQUESTED: { bg: "bg-amber-50",  text: "text-amber-700",  label: "Needs Revision" },
    CANCELLED:          { bg: "bg-gray-100",  text: "text-gray-600",   label: "Cancelled" },
    NO_SHOW:            { bg: "bg-red-50",    text: "text-red-600",    label: "No Show" },
  };
  const { bg, text, label } = map[status] ?? { bg: "bg-gray-100", text: "text-gray-600", label: status };
  return (
    <span className={`shrink-0 text-[11.5px] font-semibold px-2 py-0.5 rounded uppercase tracking-wide ${bg} ${text}`}>
      {label}
    </span>
  );
}
