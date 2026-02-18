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
  const [error, setError] = useState("");
  const [showAnnounce, setShowAnnounce] = useState(false);
  const [announceOppId, setAnnounceOppId] = useState("");
  const [announceMsg, setAnnounceMsg] = useState("");
  const [announcing, setAnnouncing] = useState(false);
  const [announceResult, setAnnounceResult] = useState("");
  const [rejectModal, setRejectModal] = useState<{ sessionId: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

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
    } catch {
      setError("Failed to load dashboard. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (sessionId: string) => {
    await api.post(`/verification/${sessionId}/approve`);
    loadData();
  };

  const handleReject = (sessionId: string) => {
    setRejectReason("");
    setRejectModal({ sessionId });
  };

  const handleConfirmReject = async () => {
    if (!rejectModal) return;
    setRejecting(true);
    try {
      await api.post(`/verification/${rejectModal.sessionId}/reject`, { reason: rejectReason });
      setRejectModal(null);
      loadData();
    } finally {
      setRejecting(false);
    }
  };

  const handleAnnounce = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announceOppId || !announceMsg) return;
    setAnnouncing(true);
    setAnnounceResult("");
    try {
      const result = await api.post<{ sent: number }>(`/opportunities/${announceOppId}/announce`, { message: announceMsg });
      setAnnounceResult(`Announcement sent to ${result.sent} student${result.sent !== 1 ? "s" : ""}.`);
      setAnnounceMsg("");
    } catch (err: any) {
      setAnnounceResult(err.message || "Failed to send announcement");
    } finally {
      setAnnouncing(false);
    }
  };

  if (loading) return <div className="text-gray-500">Loading dashboard...</div>;
  if (error) return <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>;

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
        <button
          onClick={() => { setShowAnnounce(true); setAnnounceResult(""); }}
          className="px-6 py-3 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700"
        >
          Make Announcement
        </button>
      </div>

      {/* Announcement Modal */}
      {showAnnounce && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Make Announcement</h2>
            {announceResult ? (
              <div>
                <div className="p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm mb-4">
                  {announceResult}
                </div>
                <button onClick={() => { setShowAnnounce(false); setAnnounceResult(""); }} className="w-full py-2 bg-gray-900 text-white rounded-md">Done</button>
              </div>
            ) : (
              <form onSubmit={handleAnnounce} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Opportunity</label>
                  <select
                    value={announceOppId}
                    onChange={(e) => setAnnounceOppId(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="">Select opportunity...</option>
                    {opportunities.filter((o) => o.status === "ACTIVE").map((o) => (
                      <option key={o.id} value={o.id}>{o.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                  <textarea
                    value={announceMsg}
                    onChange={(e) => setAnnounceMsg(e.target.value)}
                    required
                    rows={4}
                    placeholder="Write your announcement..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={announcing} className="flex-1 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:opacity-50">
                    {announcing ? "Sending..." : "Send to All Signups"}
                  </button>
                  <button type="button" onClick={() => setShowAnnounce(false)} className="flex-1 py-2 border border-gray-300 rounded-md hover:bg-gray-50">
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-3">Reject Hours</h2>
            <p className="text-sm text-gray-600 mb-4">Optionally provide a reason for this rejection.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason (optional)"
              rows={3}
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={handleConfirmReject}
                disabled={rejecting}
                className="flex-1 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {rejecting ? "Rejecting..." : "Reject"}
              </button>
              <button
                onClick={() => setRejectModal(null)}
                className="flex-1 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
