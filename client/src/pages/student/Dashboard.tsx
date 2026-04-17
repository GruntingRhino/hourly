import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";

interface Signup {
  id: string;
  status: string;
  verificationStatus: string;
  totalHours: number | null;
  createdAt: string;
  slot: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    durationHours: number;
    opportunity: {
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

/** Returns the effective service deadline: cohort override first, then school. */
function resolveDeadline(user: any): Date | null {
  const cohortEnd = user?.cohort?.serviceEndDate;
  const schoolEnd = user?.school?.serviceEndDate ?? user?.cohort?.school?.serviceEndDate;
  const raw = cohortEnd ?? schoolEnd ?? null;
  return raw ? new Date(raw) : null;
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

export default function StudentDashboard() {
  const { user } = useAuth();
  const [signups, setSignups] = useState<Signup[]>([]);
  const [selfSubs, setSelfSubs] = useState<SelfSubmission[]>([]);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [s, ss, slots] = await Promise.all([
        api.get<Signup[]>("/beneficiaries/my-signups"),
        api.get<SelfSubmission[]>("/self-submissions").catch(() => [] as SelfSubmission[]),
        api.get<AvailableSlot[]>("/beneficiaries/available-slots").catch(() => [] as AvailableSlot[]),
      ]);
      setSignups(s);
      setSelfSubs(ss);
      setAvailableSlots(slots);
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

  if (loading) return <div className="text-gray-500">Loading dashboard...</div>;
  if (error) return <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>;

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const approvedBenHours = signups
    .filter((s) => s.verificationStatus === "APPROVED")
    .reduce((sum, s) => sum + (s.totalHours ?? s.slot.durationHours), 0);
  const approvedSelfHours = selfSubs
    .filter((s) => s.status === "APPROVED")
    .reduce((sum, s) => sum + s.hours, 0);
  const totalApprovedHours = approvedBenHours + approvedSelfHours;

  const pendingBenHours = signups
    .filter((s) => s.verificationStatus === "PENDING" && s.status === "CONFIRMED")
    .reduce((sum, s) => sum + s.slot.durationHours, 0);
  const pendingSelfHours = selfSubs
    .filter((s) => s.status === "PENDING" || s.status === "REVISION_REQUESTED")
    .reduce((sum, s) => sum + s.hours, 0);
  const totalPendingHours = pendingBenHours + pendingSelfHours;

  const requiredHours = user?.cohort?.requiredHours ?? user?.school?.requiredHours ?? 40;
  const remainingHours = Math.max(0, requiredHours - totalApprovedHours);
  const deadline = resolveDeadline(user);

  const upcoming = signups
    .filter((s) => s.status === "CONFIRMED" && new Date(s.slot.date) >= now)
    .sort((a, b) => new Date(a.slot.date).getTime() - new Date(b.slot.date).getTime());

  const recent = signups
    .filter((s) => new Date(s.slot.date) < now || s.verificationStatus === "APPROVED")
    .slice(0, 5);

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
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Deadline countdown */}
      {deadline && (
        <DeadlineBanner deadline={deadline} approvedHours={totalApprovedHours} requiredHours={requiredHours} />
      )}

      {/* Revision needed alert */}
      {revisionNeeded.length > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-lg text-amber-800 text-sm">
          <strong>{revisionNeeded.length} submission{revisionNeeded.length > 1 ? "s" : ""} need revision.</strong>{" "}
          <Link to="/submit" className="underline hover:text-amber-900">Review &rarr;</Link>
        </div>
      )}

      {/* Cohort info */}
      {user?.cohort && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          Cohort: <strong>{user.cohort.name}</strong>
          {user.cohort.requiredHours && <span className="ml-2 text-blue-600">Goal: {user.cohort.requiredHours}h</span>}
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="text-sm text-gray-500 mb-1">Verified Hours</div>
          <div className="text-3xl font-bold text-green-600">{totalApprovedHours.toFixed(1)}</div>
          <div className="text-sm text-gray-400 mt-1">of {requiredHours} required</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="text-sm text-gray-500 mb-1">Pending Verification</div>
          <div className="text-3xl font-bold text-yellow-600">{totalPendingHours.toFixed(1)}h</div>
          <div className="text-sm text-gray-400 mt-1">awaiting approval</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="text-sm text-gray-500 mb-1">Activities Signed Up</div>
          <div className="text-3xl font-bold text-purple-600">{signups.filter(s => s.status !== "CANCELLED").length}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="text-sm text-gray-500 mb-1">Hours Remaining</div>
          <div className="text-3xl font-bold text-blue-600">{remainingHours.toFixed(1)}h</div>
          <div className="text-sm text-gray-400 mt-1">needed to reach your goal</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-8">
        <div className="flex justify-between text-sm mb-2">
          <span className="font-medium">Progress toward goal</span>
          <span className="text-gray-500">{totalApprovedHours.toFixed(1)} / {requiredHours} hours</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-blue-500 h-3 rounded-full transition-all"
            style={{ width: `${Math.min(100, (totalApprovedHours / requiredHours) * 100)}%` }}
          />
        </div>
        {totalPendingHours > 0 && (
          <div className="text-xs text-gray-400 mt-1">{totalPendingHours.toFixed(1)}h more pending approval</div>
        )}
      </div>

      {recommended.length > 0 && totalApprovedHours < requiredHours && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Recommended Opportunities</h2>
            <Link to="/browse" className="text-sm text-blue-600 hover:underline">
              Browse all
            </Link>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {recommended.map(({ slot, openSpots, reasons }) => {
              const slotCategory = slot.opportunity.category || slot.opportunity.beneficiary.category || "General";
              return (
                <Link
                  key={slot.id}
                  to={`/slot/${slot.id}`}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-gray-900">{slot.opportunity.title}</div>
                      <div className="text-sm text-gray-500 mt-1">{slot.opportunity.beneficiary.name}</div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${openSpots > 0 ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
                      {openSpots > 0 ? "Open" : "Waitlist"}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 mt-3">
                    {new Date(slot.date).toLocaleDateString()} · {slot.startTime}–{slot.endTime}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {slot.durationHours}h · {slotCategory}
                  </div>
                  {slot.opportunity.location && (
                    <div className="text-sm text-gray-500 mt-1">{slot.opportunity.location}</div>
                  )}
                  {reasons.length > 0 && (
                    <div className="text-xs text-blue-700 mt-3">
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
          <h2 className="text-lg font-semibold mb-3">Upcoming Activities</h2>
          {upcoming.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-5 text-gray-500 text-sm">
              No upcoming activities.{" "}
              <Link to="/browse" className="text-blue-600 hover:underline">Browse opportunities</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {upcoming.slice(0, 5).map((s) => (
                <div key={s.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-medium">{s.slot.opportunity.title}</div>
                      <div className="text-sm text-gray-500">
                        {new Date(s.slot.date).toLocaleDateString()} &middot; {s.slot.startTime}–{s.slot.endTime}
                      </div>
                      <div className="text-sm text-gray-400">{s.slot.opportunity.beneficiary.name}</div>
                      {s.slot.opportunity.location && (
                        <div className="text-xs text-gray-400">{s.slot.opportunity.location}</div>
                      )}
                      <div className="text-xs text-blue-600 mt-1">{s.slot.durationHours}h</div>
                    </div>
                    <button
                      onClick={() => handleCancel(s.id)}
                      disabled={cancelling === s.id}
                      className="ml-2 text-xs text-gray-400 hover:text-red-500 disabled:opacity-40"
                      title="Cancel signup"
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
          <h2 className="text-lg font-semibold mb-3">Recent Activity</h2>
          {recent.length === 0 && selfSubs.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-5 text-gray-500 text-sm">
              No activity yet.
            </div>
          ) : (
            <div className="space-y-2">
              {recent.map((s) => (
                <div key={s.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{s.slot.opportunity.title}</div>
                      <div className="text-sm text-gray-500">{s.slot.opportunity.beneficiary.name}</div>
                      {s.totalHours != null && (
                        <div className="text-sm text-gray-400 mt-1">{s.totalHours}h verified</div>
                      )}
                    </div>
                    <StatusBadge status={s.verificationStatus} />
                  </div>
                </div>
              ))}
              {selfSubs.slice(0, 3).map((ss) => (
                <div key={ss.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{ss.organizationName}</div>
                      <div className="text-sm text-gray-500">Self-submitted &middot; {new Date(ss.date).toLocaleDateString()}</div>
                      <div className="text-sm text-gray-400 mt-1">{ss.hours}h</div>
                    </div>
                    <StatusBadge status={ss.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    APPROVED: "bg-green-100 text-green-700",
    PENDING: "bg-yellow-100 text-yellow-700",
    REJECTED: "bg-red-100 text-red-700",
    CONFIRMED: "bg-blue-100 text-blue-700",
    WAITLISTED: "bg-gray-100 text-gray-600",
    REVISION_REQUESTED: "bg-amber-100 text-amber-700",
  };
  const labels: Record<string, string> = { REVISION_REQUESTED: "Needs Revision" };
  return (
    <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${colors[status] || "bg-gray-100 text-gray-600"}`}>
      {labels[status] ?? status}
    </span>
  );
}
