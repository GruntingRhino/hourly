import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";

interface Signup {
  id: string;
  status: string;
  verificationStatus: string;
  totalHours: number | null;
  student: { name: string; email: string };
  slot: {
    durationHours: number;
    opportunity: { title: string };
    startTime: string;
    date: string;
  };
}

interface Invitation {
  id: string;
  schoolName: string;
  schoolId: string;
  status: string;
  sentTo: string;
  createdAt: string;
}

export default function BeneficiaryDashboard() {
  const { user } = useAuth();
  const [pendingSignups, setPendingSignups] = useState<Signup[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [approving, setApproving] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const benId = user?.beneficiaryId;

  const load = async () => {
    if (!benId) return;
    setLoading(true);
    try {
      const [signups, invs] = await Promise.all([
        api.get<Signup[]>(`/beneficiaries/${benId}/signups?status=PENDING`),
        api.get<Invitation[]>(`/beneficiaries/${benId}/invitations`).catch(() => [] as Invitation[]),
      ]);
      setPendingSignups(signups);
      setInvitations(invs);
    } catch {
      setError("Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [benId]);

  const handleApprove = async (signupId: string, hours: number) => {
    setApproving(signupId);
    try {
      await api.post(`/beneficiaries/signups/${signupId}/approve`, { hoursApproved: hours });
      void load();
    } catch (err: any) {
      setError(err.message || "Failed to approve.");
    } finally {
      setApproving(null);
    }
  };

  const handleReject = async (signupId: string) => {
    if (!rejectReason.trim()) {
      setError("Please enter a reason for rejection.");
      return;
    }
    setApproving(signupId);
    try {
      await api.post(`/beneficiaries/signups/${signupId}/reject`, { reason: rejectReason });
      setRejectingId(null);
      setRejectReason("");
      void load();
    } catch (err: any) {
      setError(err.message || "Failed to reject.");
    } finally {
      setApproving(null);
    }
  };

  const handleInvitationRespond = async (invId: string, action: "ACCEPTED" | "DECLINED") => {
    setRespondingId(invId);
    try {
      await api.post(`/beneficiaries/invitations/${invId}/respond`, { action });
      setInvitations((prev) =>
        prev.map((inv) => (inv.id === invId ? { ...inv, status: action } : inv))
      );
    } catch (err: any) {
      setError(err.message || "Failed to respond.");
    } finally {
      setRespondingId(null);
    }
  };

  const pendingInvitations = invitations.filter((inv) => inv.status === "PENDING");

  if (loading) return <div className="text-gray-500 py-8 text-center">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
      <p className="text-gray-500 text-sm mb-6">{user?.beneficiary?.name}</p>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg p-5 text-center">
          <div className="text-3xl font-bold text-orange-500">{pendingSignups.length}</div>
          <div className="text-sm text-gray-500 mt-1">Pending Hour Approvals</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5 text-center">
          <div className="text-3xl font-bold text-blue-600">{pendingInvitations.length}</div>
          <div className="text-sm text-gray-500 mt-1">School Invitations</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5 text-center">
          <Link to="/opportunities" className="block">
            <div className="text-3xl font-bold text-gray-700">+</div>
            <div className="text-sm text-gray-500 mt-1">Manage Opportunities</div>
          </Link>
        </div>
      </div>

      {/* School Invitations */}
      {pendingInvitations.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Pending School Invitations</h2>
          <div className="space-y-2">
            {pendingInvitations.map((inv) => (
              <div key={inv.id} className="bg-white border border-blue-100 rounded-lg p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium">{inv.schoolName}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    Invited {new Date(inv.createdAt).toLocaleDateString()} · sent to {inv.sentTo}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleInvitationRespond(inv.id, "ACCEPTED")}
                    disabled={respondingId === inv.id}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
                  >
                    {respondingId === inv.id ? "..." : "Accept"}
                  </button>
                  <button
                    onClick={() => handleInvitationRespond(inv.id, "DECLINED")}
                    disabled={respondingId === inv.id}
                    className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200 disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past invitations */}
      {invitations.filter((inv) => inv.status !== "PENDING").length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-500 mb-2">Past School Invitations</h2>
          <div className="space-y-1">
            {invitations.filter((inv) => inv.status !== "PENDING").map((inv) => (
              <div key={inv.id} className="bg-white border border-gray-100 rounded-lg px-4 py-3 flex items-center justify-between">
                <div className="text-sm font-medium">{inv.schoolName}</div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  inv.status === "ACCEPTED" ? "bg-green-50 text-green-700" :
                  inv.status === "DECLINED" ? "bg-gray-100 text-gray-500" :
                  "bg-yellow-50 text-yellow-700"
                }`}>
                  {inv.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Hour Approvals */}
      {pendingSignups.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Pending Hour Approvals</h2>
          <div className="space-y-2">
            {pendingSignups.map((signup) => (
              <div key={signup.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">{signup.student.name}</div>
                    <div className="text-xs text-gray-500">{signup.slot.opportunity.title}</div>
                    <div className="text-xs text-gray-400">
                      {new Date(signup.slot.date).toLocaleDateString()} &middot; {signup.slot.startTime}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {signup.slot.durationHours}h expected
                    </div>
                  </div>
                  {rejectingId !== signup.id && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(signup.id, signup.slot.durationHours)}
                        disabled={approving === signup.id}
                        className="px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50">
                        {approving === signup.id ? "..." : "Approve"}
                      </button>
                      <button
                        onClick={() => { setRejectingId(signup.id); setRejectReason(""); setError(""); }}
                        disabled={approving === signup.id}
                        className="px-3 py-1.5 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200 disabled:opacity-50">
                        Reject
                      </button>
                    </div>
                  )}
                </div>
                {rejectingId === signup.id && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <input
                      type="text"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Reason for rejection..."
                      className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm mb-2"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReject(signup.id)}
                        disabled={approving === signup.id}
                        className="px-3 py-1.5 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-50">
                        {approving === signup.id ? "..." : "Confirm Reject"}
                      </button>
                      <button
                        onClick={() => { setRejectingId(null); setRejectReason(""); }}
                        className="px-3 py-1.5 text-gray-500 hover:text-gray-700 text-xs">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {pendingSignups.length === 0 && pendingInvitations.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-500">
          No pending items. <Link to="/opportunities" className="text-blue-600 hover:underline">Create opportunities</Link> for students.
        </div>
      )}
    </div>
  );
}
