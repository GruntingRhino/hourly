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
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [signups, setSignups] = useState<Signup[]>([]);
  const [selfSubs, setSelfSubs] = useState<SelfSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [s, ss] = await Promise.all([
        api.get<Signup[]>("/beneficiaries/my-signups"),
        api.get<SelfSubmission[]>("/self-submissions").catch(() => [] as SelfSubmission[]),
      ]);
      setSignups(s);
      setSelfSubs(ss);
    } catch {
      setError("Failed to load dashboard. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadData(); }, []);

  if (loading) return <div className="text-gray-500">Loading dashboard...</div>;
  if (error) return <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>;

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Calculate approved hours
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
    .filter((s) => s.status === "PENDING")
    .reduce((sum, s) => sum + s.hours, 0);
  const totalPendingHours = pendingBenHours + pendingSelfHours;

  const requiredHours = user?.cohort?.requiredHours ?? 40;

  const upcoming = signups
    .filter((s) => s.status === "CONFIRMED" && new Date(s.slot.date) >= now)
    .sort((a, b) => new Date(a.slot.date).getTime() - new Date(b.slot.date).getTime());

  const recent = signups
    .filter((s) => new Date(s.slot.date) < now || s.verificationStatus === "APPROVED")
    .slice(0, 5);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Cohort info */}
      {user?.cohort && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          Cohort: <strong>{user.cohort.name}</strong>
          {user.cohort.requiredHours && <span className="ml-2 text-blue-600">Goal: {user.cohort.requiredHours}h</span>}
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
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
          <div className="text-3xl font-bold text-purple-600">{signups.length}</div>
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
  };
  return (
    <span className={`text-xs px-2 py-1 rounded-full font-medium ${colors[status] || "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}
