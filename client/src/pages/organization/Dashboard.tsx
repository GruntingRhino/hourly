import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";

interface Opportunity {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  capacity: number;
  status: string;
  _count: { signups: number };
}

interface PendingSession {
  id: string;
  totalHours: number | null;
  user: { id: string; name: string; email: string };
  opportunity: { id: string; title: string };
}

interface Stats {
  totalOpportunities: number;
  totalSignups: number;
  totalApprovedHours: number;
  uniqueVolunteers: number;
}

interface Notification {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

export default function OrgDashboard() {
  const { user } = useAuth();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [pending, setPending] = useState<PendingSession[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const orgId = user?.organizationId;
      const [opps, pend, st, notifs] = await Promise.all([
        api.get<Opportunity[]>(`/opportunities?organizationId=${orgId}`),
        api.get<PendingSession[]>("/verification/pending"),
        api.get<Stats>(`/organizations/${orgId}/stats`),
        api.get<Notification[]>("/messages/notifications"),
      ]);
      setOpportunities(opps);
      setPending(pend);
      setStats(st);
      setNotifications(notifs.slice(0, 5));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (sessionId: string) => {
    await api.post(`/verification/${sessionId}/approve`);
    loadData();
  };

  const handleReject = async (sessionId: string) => {
    const reason = prompt("Reason for rejection:");
    if (!reason) return;
    await api.post(`/verification/${sessionId}/reject`, { reason });
    loadData();
  };

  if (loading) return <div className="text-gray-500">Loading dashboard...</div>;

  const upcoming = opportunities
    .filter((o) => o.status === "ACTIVE" && new Date(o.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Actions */}
      <div className="flex gap-3 mb-6">
        <Link
          to="/opportunities/new"
          className="px-6 py-3 bg-gray-900 text-white rounded-md font-medium hover:bg-gray-800"
        >
          Create Opportunity
        </Link>
        <Link
          to="/opportunities"
          className="px-6 py-3 bg-gray-100 text-gray-700 rounded-md font-medium hover:bg-gray-200"
        >
          My Opportunities
        </Link>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Activity feed / pending verifications */}
        <div className="md:col-span-2">
          {/* Pending verifications */}
          {pending.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-3">Pending Verifications</h2>
              <div className="space-y-2">
                {pending.map((p) => (
                  <div key={p.id} className="bg-white border border-yellow-200 rounded-lg p-4 flex justify-between items-center">
                    <div>
                      <div className="font-medium text-sm">{p.user.name}</div>
                      <div className="text-xs text-gray-500">
                        {p.opportunity.title} &middot; {p.totalHours} hours
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(p.id)}
                        className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(p.id)}
                        className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent activity */}
          <h2 className="text-lg font-semibold mb-3">Recent Activity Feed</h2>
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            {notifications.length === 0 ? (
              <div className="text-gray-500 text-sm">No recent activity.</div>
            ) : (
              <div className="space-y-3">
                {notifications.map((n) => (
                  <div key={n.id} className="text-sm text-gray-700">
                    {n.body}
                    <span className="text-gray-400 ml-2 text-xs">
                      {new Date(n.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 gap-3 mt-6">
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="text-sm text-gray-500">Total Opportunities</div>
                <div className="text-2xl font-bold">{stats.totalOpportunities}</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="text-sm text-gray-500">Total Signups</div>
                <div className="text-2xl font-bold">{stats.totalSignups}</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="text-sm text-gray-500">Approved Hours</div>
                <div className="text-2xl font-bold">{stats.totalApprovedHours}</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="text-sm text-gray-500">Unique Volunteers</div>
                <div className="text-2xl font-bold">{stats.uniqueVolunteers}</div>
              </div>
            </div>
          )}
        </div>

        {/* Upcoming events sidebar */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Upcoming Events</h2>
          {upcoming.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-5 text-gray-500 text-sm">
              No upcoming events.
            </div>
          ) : (
            <div className="space-y-2">
              {upcoming.slice(0, 6).map((opp) => (
                <div key={opp.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-sm font-medium">
                        {new Date(opp.date).toLocaleDateString()} &middot; {opp.startTime} - {opp.endTime}
                      </div>
                      <div className="text-xs text-gray-500">{opp.title}</div>
                      <div className="text-xs text-gray-400">{opp.location}</div>
                    </div>
                    <div className="text-sm font-bold text-blue-600">
                      {opp._count.signups}/{opp.capacity}
                    </div>
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
