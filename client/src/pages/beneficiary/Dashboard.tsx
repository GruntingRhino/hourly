import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";

interface Signup {
  id: string;
  status: string;
  verificationStatus: string;
  totalHours: number | null;
  student: { label: string };
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
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="text-sm font-semibold text-blue-700 mb-1">{user?.beneficiary?.name || "Beneficiary"}</div>
          <h1 className="text-[22px] font-bold text-gray-900">Dashboard</h1>
        </div>
        <Link to="/opportunities" className="px-4 py-[7px] bg-blue-600 text-white rounded-md text-[13.5px] font-medium hover:opacity-85">
          + New Opportunity
        </Link>
      </div>

      {error && <div className="mb-4 px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-[13px]">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-7">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5">Pending Approvals</div>
          <div className="text-3xl font-bold text-amber-500 leading-none">{pendingSignups.length}</div>
          <div className="text-xs text-gray-400 mt-1">awaiting your review</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5">School Invitations</div>
          <div className="text-3xl font-bold text-blue-600 leading-none">{pendingInvitations.length}</div>
          <div className="text-xs text-gray-400 mt-1">pending response</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5">School Partners</div>
          <div className="text-3xl font-bold text-green-600 leading-none">{invitations.filter(i => i.status === "ACCEPTED").length}</div>
          <div className="text-xs text-gray-400 mt-1">approved</div>
        </div>
      </div>

      {/* School Invitations */}
      {pendingInvitations.length > 0 && (
        <div className="mb-7">
          <h2 className="text-[15px] font-semibold text-gray-900 mb-3">Pending School Invitations</h2>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {pendingInvitations.map((inv, i, arr) => (
              <div key={inv.id} className={`p-4 flex items-center justify-between gap-4 ${i < arr.length - 1 ? "border-b border-gray-200" : ""}`}>
                <div>
                  <div className="font-semibold text-[13.5px] text-gray-900">{inv.schoolName}</div>
                  <div className="text-[12px] text-gray-400 mt-0.5">
                    Invited {new Date(inv.createdAt).toLocaleDateString()} · sent to {inv.sentTo}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleInvitationRespond(inv.id, "ACCEPTED")}
                    disabled={respondingId === inv.id}
                    className="px-3.5 py-[7px] bg-blue-600 text-white rounded-md text-[13px] font-medium hover:opacity-85 disabled:opacity-50"
                  >
                    {respondingId === inv.id ? "..." : "Accept"}
                  </button>
                  <button
                    onClick={() => handleInvitationRespond(inv.id, "DECLINED")}
                    disabled={respondingId === inv.id}
                    className="px-3.5 py-[7px] bg-white border border-gray-200 text-gray-600 rounded-md text-[13px] font-medium hover:bg-gray-50 disabled:opacity-50"
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
        <div className="mb-7">
          <h2 className="text-[13px] font-semibold text-gray-500 mb-2">Past School Invitations</h2>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {invitations.filter((inv) => inv.status !== "PENDING").map((inv, i, arr) => (
              <div key={inv.id} className={`px-4 py-3 flex items-center justify-between ${i < arr.length - 1 ? "border-b border-gray-200" : ""}`}>
                <div className="text-[13.5px] font-medium text-gray-700">{inv.schoolName}</div>
                <span className={`text-[11.5px] font-semibold px-2 py-0.5 rounded uppercase tracking-wide ${
                  inv.status === "ACCEPTED" ? "bg-green-50 text-green-700" :
                  inv.status === "DECLINED" ? "bg-gray-100 text-gray-500" :
                  "bg-amber-50 text-amber-600"
                }`}>
                  {inv.status.toLowerCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Hour Approvals */}
      {pendingSignups.length > 0 && (
        <div>
          <h2 className="text-[15px] font-semibold text-gray-900 mb-3">Pending Hour Approvals</h2>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {pendingSignups.map((signup, i, arr) => (
              <div key={signup.id} className={`p-4 ${i < arr.length - 1 ? "border-b border-gray-200" : ""}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-[13.5px] text-gray-900">{signup.student.label}</div>
                    <div className="text-[12.5px] text-gray-500">{signup.slot.opportunity.title}</div>
                    <div className="text-[12px] text-gray-400">
                      {new Date(signup.slot.date).toLocaleDateString()} · {signup.slot.startTime}
                    </div>
                    <div className="text-[13px] font-semibold text-gray-700 mt-1">
                      {signup.slot.durationHours}h expected
                    </div>
                  </div>
                  {rejectingId !== signup.id && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(signup.id, signup.slot.durationHours)}
                        disabled={approving === signup.id}
                        className="px-3.5 py-[7px] bg-blue-600 text-white rounded-md text-[13px] font-medium hover:opacity-85 disabled:opacity-50">
                        {approving === signup.id ? "..." : "Approve"}
                      </button>
                      <button
                        onClick={() => { setRejectingId(signup.id); setRejectReason(""); setError(""); }}
                        disabled={approving === signup.id}
                        className="px-3.5 py-[7px] bg-white border border-gray-200 text-red-500 rounded-md text-[13px] font-medium hover:bg-red-50 disabled:opacity-50">
                        Reject
                      </button>
                    </div>
                  )}
                </div>
                {rejectingId === signup.id && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <input
                      type="text"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Reason for rejection..."
                      className="w-full px-3 py-2 border border-gray-200 rounded-md text-[13.5px] mb-2 outline-none focus:border-blue-400"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReject(signup.id)}
                        disabled={approving === signup.id}
                        className="px-3.5 py-[7px] bg-red-600 text-white rounded-md text-[13px] font-medium hover:opacity-85 disabled:opacity-50">
                        {approving === signup.id ? "..." : "Confirm Reject"}
                      </button>
                      <button
                        onClick={() => { setRejectingId(null); setRejectReason(""); }}
                        className="px-3.5 py-[7px] text-[13px] text-gray-500 hover:text-gray-700">
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
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500 text-[13.5px]">
          No pending items. <Link to="/opportunities" className="text-blue-600 hover:underline">Create opportunities</Link> for students.
        </div>
      )}
    </div>
  );
}
