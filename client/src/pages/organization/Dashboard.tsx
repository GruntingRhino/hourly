import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, getErrorMessage } from "../../lib/api";
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
  user: { label: string };
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
  const [overrideHours, setOverrideHours] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
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
  }, [user]);

  useEffect(() => { void (async () => { await loadData(); })(); }, [loadData]);

  const handleApprove = async (sessionId: string) => {
    const raw = overrideHours[sessionId]?.trim();
    const approvedHours = raw ? Number(raw) : undefined;
    const previousPending = pending;
    setPending((prev) => prev.filter((p) => p.id !== sessionId));
    try {
      await api.post(`/verification/${sessionId}/approve`, {
        approvedHours: Number.isFinite(approvedHours) ? approvedHours : undefined,
      });
      void loadData();
    } catch {
      setPending(previousPending);
      setError("Failed to approve pending verification");
    }
  };

  const handleReject = (sessionId: string) => {
    setRejectReason("");
    setRejectModal({ sessionId });
  };

  const handleConfirmReject = async () => {
    if (!rejectModal) return;
    if (!rejectReason.trim()) return;
    setRejecting(true);
    const sessionId = rejectModal.sessionId;
    const previousPending = pending;
    setPending((prev) => prev.filter((p) => p.id !== sessionId));
    try {
      await api.post(`/verification/${sessionId}/reject`, { reason: rejectReason.trim() });
      setRejectModal(null);
      void loadData();
    } catch {
      setPending(previousPending);
      setError("Failed to reject pending verification");
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
    } catch (err: unknown) {
      setAnnounceResult(getErrorMessage(err, "Failed to send announcement"));
    } finally {
      setAnnouncing(false);
    }
  };

  if (loading) return <div className="text-[var(--text-sec)]">Loading dashboard...</div>;
  if (error) return <div className="p-4 bg-[var(--er-bg)] border border-[var(--er-b)] rounded-[3px] text-[var(--er-t)] text-sm">{error}</div>;

  const upcoming = opportunities
    .filter((o) => o.status === "ACTIVE" && new Date(o.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div>
      <div className="mb-5">
        <div className="text-[12px] mb-0.5" style={{ color: "var(--text-faint)" }}>Organization</div>
        <h1 className="text-[20px] font-semibold" style={{ color: "var(--text)" }}>Dashboard</h1>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mb-6">
        <Link
          to="/opportunities/new"
          className="px-6 py-[9px] bg-[var(--action)] text-white rounded-[2px] font-medium hover:opacity-85"
        >
          Create Opportunity
        </Link>
        <Link
          to="/opportunities"
          className="px-6 py-3 bg-[var(--surface-alt)] text-[var(--text)] rounded-[2px] font-medium hover:bg-[var(--border)]"
        >
          My Opportunities
        </Link>
        <button
          onClick={() => { setShowAnnounce(true); setAnnounceResult(""); }}
          className="px-6 py-3 bg-[var(--action)] text-white rounded-[2px] font-medium hover:bg-[var(--action)]"
        >
          Make Announcement
        </button>
      </div>

      {/* Announcement Modal */}
      {showAnnounce && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface)] rounded-[3px] p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Make Announcement</h2>
            {announceResult ? (
              <div>
                <div className="p-3 bg-[var(--ok-bg)] border border-[var(--ok-b)] rounded-[2px] text-[var(--ok-t)] text-sm mb-4">
                  {announceResult}
                </div>
                <button onClick={() => { setShowAnnounce(false); setAnnounceResult(""); }} className="w-full py-[7px] bg-[var(--action)] text-white rounded-[2px] hover:opacity-85">Done</button>
              </div>
            ) : (
              <form onSubmit={handleAnnounce} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-1">Opportunity</label>
                  <select
                    value={announceOppId}
                    onChange={(e) => setAnnounceOppId(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm"
                  >
                    <option value="">Select opportunity...</option>
                    {opportunities.filter((o) => o.status === "ACTIVE").map((o) => (
                      <option key={o.id} value={o.id}>{o.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-1">Message</label>
                  <textarea
                    value={announceMsg}
                    onChange={(e) => setAnnounceMsg(e.target.value)}
                    required
                    rows={4}
                    placeholder="Write your announcement..."
                    className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={announcing} className="flex-1 py-2 bg-[var(--action)] text-white rounded-[2px] font-medium hover:bg-[var(--action)] disabled:opacity-50">
                    {announcing ? "Sending..." : "Send to All Signups"}
                  </button>
                  <button type="button" onClick={() => setShowAnnounce(false)} className="flex-1 py-2 border border-[var(--border-s)] rounded-[2px] hover:bg-[var(--surface-alt)]">
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
          <div className="bg-[var(--surface)] rounded-[3px] p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-3">Reject Hours</h2>
            <p className="text-sm text-[var(--text-sec)] mb-4">A rejection reason is required.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason (required)"
              rows={3}
              autoFocus
              className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={handleConfirmReject}
                disabled={rejecting}
                className="flex-1 py-2 bg-red-600 text-white rounded-[2px] text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {rejecting ? "Rejecting..." : "Reject"}
              </button>
              <button
                onClick={() => setRejectModal(null)}
                className="flex-1 py-2 border border-[var(--border-s)] rounded-[2px] text-sm hover:bg-[var(--surface-alt)]"
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
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Pending Verifications</h2>
            {pending.length === 0 ? (
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-4 text-sm text-[var(--text-sec)]">
                No pending verifications.
              </div>
            ) : (
              <div className="space-y-2">
                {pending.map((p) => (
                  <div key={p.id} className="bg-[var(--surface)] border border-[var(--wn-b)] rounded-[3px] p-4 flex justify-between items-center gap-4">
                    <div>
                      <div className="font-medium text-sm">{p.user.label}</div>
                      <div className="text-xs text-[var(--text-sec)]">
                        {p.opportunity.title} &middot; {p.totalHours} hours
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        placeholder={`Override (${p.totalHours ?? 0})`}
                        value={overrideHours[p.id] ?? ""}
                        onChange={(e) =>
                          setOverrideHours((prev) => ({ ...prev, [p.id]: e.target.value }))
                        }
                        className="w-28 px-2 py-1 border border-[var(--border-s)] rounded text-xs"
                      />
                      <button
                        onClick={() => handleApprove(p.id)}
                        className="h-[28px] px-3 rounded-[2px] text-white text-[12px] font-medium"
                        style={{ background: "var(--ok-t)" }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(p.id)}
                        className="h-[28px] px-3 rounded-[2px] text-white text-[12px] font-medium"
                        style={{ background: "var(--er-t)" }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent activity */}
          <h2 className="text-lg font-semibold mb-3">Recent Activity Feed</h2>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-5">
            {notifications.length === 0 ? (
              <div className="text-[var(--text-sec)] text-sm">No recent activity.</div>
            ) : (
              <div className="space-y-3">
                {notifications.map((n) => (
                  <div key={n.id} className="text-sm text-[var(--text)]">
                    {n.body}
                    <span className="text-[var(--text-faint)] ml-2 text-xs">
                      {new Date(n.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stats */}
          {stats && (
            <div className="mt-6 border rounded-[3px] overflow-hidden grid grid-cols-2" style={{ borderColor: "var(--border)", gap: "1px", background: "var(--border)" }}>
              <div className="bg-[var(--surface)] p-4">
                <div className="text-[12px]" style={{ color: "var(--text-sec)" }}>Total Opportunities</div>
                <div className="text-[28px] font-bold" style={{ color: "var(--text)" }}>{stats.totalOpportunities}</div>
              </div>
              <div className="bg-[var(--surface)] p-4">
                <div className="text-[12px]" style={{ color: "var(--text-sec)" }}>Total Signups</div>
                <div className="text-[28px] font-bold" style={{ color: "var(--text)" }}>{stats.totalSignups}</div>
              </div>
              <div className="bg-[var(--surface)] p-4">
                <div className="text-[12px]" style={{ color: "var(--text-sec)" }}>Approved Hours</div>
                <div className="text-[28px] font-bold" style={{ color: "var(--text)" }}>{stats.totalApprovedHours}</div>
              </div>
              <div className="bg-[var(--surface)] p-4">
                <div className="text-[12px]" style={{ color: "var(--text-sec)" }}>Unique Volunteers</div>
                <div className="text-[28px] font-bold" style={{ color: "var(--text)" }}>{stats.uniqueVolunteers}</div>
              </div>
            </div>
          )}
        </div>

        {/* Upcoming events sidebar */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Upcoming Events</h2>
          {upcoming.length === 0 ? (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-5 text-[var(--text-sec)] text-sm">
              No upcoming events.
            </div>
          ) : (
            <div className="space-y-2">
              {upcoming.slice(0, 6).map((opp) => (
                <div key={opp.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-sm font-medium">
                        {new Date(opp.date).toLocaleDateString()} &middot; {opp.startTime} - {opp.endTime}
                      </div>
                      <div className="text-xs text-[var(--text-sec)]">{opp.title}</div>
                      <div className="text-xs text-[var(--text-faint)]">{opp.location}</div>
                    </div>
                    <div className="text-sm font-bold text-[var(--action)]">
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
