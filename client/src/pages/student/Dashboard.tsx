import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";

interface ReportData {
  totalApprovedHours: number;
  totalPendingHours: number;
  totalCommittedHours: number;
  requiredHours: number;
  activitiesCompleted: number;
  sessions: Session[];
}

interface Session {
  id: string;
  status: string;
  verificationStatus: string;
  totalHours: number | null;
  checkInTime: string | null;
  opportunity: {
    id: string;
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    location: string;
    organization: { name: string };
  };
}

interface Signup {
  id: string;
  status: string;
  opportunity: {
    id: string;
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    location: string;
    address: string | null;
    capacity: number;
    organization: { name: string };
    _count: { signups: number };
  };
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [report, setReport] = useState<ReportData | null>(null);
  const [signups, setSignups] = useState<Signup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get<ReportData>("/reports/student"),
      api.get<Signup[]>("/signups/my"),
    ]).then(([r, s]) => {
      setReport(r);
      setSignups(s);
    }).catch(() => {
      setError("Failed to load dashboard. Please refresh the page.");
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-500">Loading dashboard...</div>;
  if (error) return <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>;

  const upcoming = signups.filter(
    (s) => s.status === "CONFIRMED" && new Date(s.opportunity.date) >= new Date()
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Join classroom prompt */}
      {!user?.classroomId && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center justify-between">
          <div>
            <div className="font-medium text-yellow-900">No classroom yet</div>
            <div className="text-sm text-yellow-700">
              Join a classroom with an invite code from your teacher to link to a school.
            </div>
          </div>
          <Link
            to="/settings"
            className="px-4 py-2 bg-yellow-600 text-white rounded-md text-sm hover:bg-yellow-700"
          >
            Join Classroom
          </Link>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="text-sm text-gray-500 mb-1">Committed Hours</div>
          <div className="text-3xl font-bold text-blue-600">
            {(report?.totalApprovedHours || 0) + (report?.totalPendingHours || 0)}
          </div>
          <div className="text-sm text-gray-400 mt-1">
            of {report?.requiredHours || 40} required
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="text-sm text-gray-500 mb-1">Verified Hours</div>
          <div className="text-3xl font-bold text-green-600">
            {report?.totalApprovedHours || 0}
          </div>
          <div className="text-sm text-gray-400 mt-1">
            {report?.totalPendingHours || 0} pending verification
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="text-sm text-gray-500 mb-1">Activities Done</div>
          <div className="text-3xl font-bold text-purple-600">
            {report?.activitiesCompleted || 0}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {report && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 mb-8">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium">Progress toward goal</span>
            <span className="text-gray-500">
              {report.totalApprovedHours} / {report.requiredHours} hours
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-blue-500 h-3 rounded-full transition-all"
              style={{ width: `${Math.min(100, (report.totalApprovedHours / report.requiredHours) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Upcoming */}
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-semibold mb-3">Upcoming Opportunities</h2>
          {upcoming.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-5 text-gray-500 text-sm">
              No upcoming opportunities.{" "}
              <Link to="/browse" className="text-blue-600 hover:underline">
                Browse opportunities
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {upcoming.slice(0, 5).map((s) => (
                <Link
                  key={s.id}
                  to={`/opportunity/${s.opportunity.id}`}
                  className="block bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                >
                  <div className="font-medium">{s.opportunity.title}</div>
                  <div className="text-sm text-gray-500">
                    {new Date(s.opportunity.date).toLocaleDateString()} &middot; {s.opportunity.startTime} - {s.opportunity.endTime}
                  </div>
                  <div className="text-sm text-gray-400">
                    {s.opportunity.organization.name} &middot; {s.opportunity.location}
                  </div>
                  {s.opportunity.address && (
                    <div className="text-xs text-gray-400">{s.opportunity.address}</div>
                  )}
                  <div className="text-xs text-gray-500 mt-0.5">
                    {s.opportunity._count?.signups ?? 0}/{s.opportunity.capacity} spots filled
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Recent Activity</h2>
          {!report?.sessions.length ? (
            <div className="bg-white border border-gray-200 rounded-lg p-5 text-gray-500 text-sm">
              No activity yet.
            </div>
          ) : (
            <div className="space-y-2">
              {report.sessions.slice(0, 5).map((session) => (
                <div
                  key={session.id}
                  className="bg-white border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{session.opportunity.title}</div>
                      <div className="text-sm text-gray-500">
                        {session.opportunity.organization.name}
                      </div>
                    </div>
                    <StatusBadge status={session.verificationStatus} />
                  </div>
                  {session.totalHours && (
                    <div className="text-sm text-gray-400 mt-1">
                      {session.totalHours} hours
                    </div>
                  )}
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
  };
  return (
    <span className={`text-xs px-2 py-1 rounded-full font-medium ${colors[status] || "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}
