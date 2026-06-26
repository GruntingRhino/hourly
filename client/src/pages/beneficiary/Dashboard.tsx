import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";

interface Signup {
  id: string;
  status: string;
  verificationStatus: string;
  totalHours: number | null;
  student: { id?: string; label: string };
  slot: {
    durationHours: number;
    opportunity: { title: string };
    startTime: string;
    endTime: string;
    date: string;
  };
}

function getSlotEndAt(date: string, endTime: string): Date {
  const [hours, minutes] = endTime.split(":").map(Number);
  const endAt = new Date(date);
  endAt.setUTCHours(hours, minutes, 0, 0);
  return endAt;
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
      setPendingSignups(
        signups.filter(
          (signup) =>
            signup.status === "CONFIRMED" &&
            signup.verificationStatus === "PENDING" &&
            getSlotEndAt(signup.slot.date, signup.slot.endTime) <= new Date()
        )
      );
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

  if (loading) return <div className="text-[var(--text-sec)] py-8 text-center">Loading...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="text-sm font-semibold text-[var(--action)] mb-1">{user?.beneficiary?.name || "Beneficiary"}</div>
          <h1 className="text-[22px] font-bold text-[var(--text)]">Dashboard</h1>
        </div>
        <Link to="/opportunities" className="px-4 py-[7px] bg-[var(--action)] text-white rounded-[2px] text-[13.5px] font-medium hover:opacity-85">
          + New Opportunity
        </Link>
      </div>

      {error && <div className="mb-4 px-3.5 py-2.5 bg-[var(--er-bg)] border border-[var(--er-b)] rounded-[3px] text-[var(--er-t)] text-[13px]">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-7">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-4">
          <div className="text-[11px] font-medium text-[var(--text-sec)] uppercase tracking-wide mb-1.5">Pending Approvals</div>
          <div className="text-[24px] font-semibold text-amber-500 leading-none">{pendingSignups.length}</div>
          <div className="text-xs text-[var(--text-faint)] mt-1">awaiting your review</div>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-4">
          <div className="text-[11px] font-medium text-[var(--text-sec)] uppercase tracking-wide mb-1.5">School Invitations</div>
          <div className="text-[24px] font-semibold text-[var(--action)] leading-none">{pendingInvitations.length}</div>
          <div className="text-xs text-[var(--text-faint)] mt-1">pending response</div>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-4">
          <div className="text-[11px] font-medium text-[var(--text-sec)] uppercase tracking-wide mb-1.5">School Partners</div>
          <div className="text-[24px] font-semibold text-[var(--ok-t)] leading-none">{invitations.filter(i => i.status === "ACCEPTED").length}</div>
          <div className="text-xs text-[var(--text-faint)] mt-1">approved</div>
        </div>
      </div>

      {/* School Invitations */}
      {pendingInvitations.length > 0 && (
        <div className="mb-7">
          <h2 className="text-[15px] font-semibold text-[var(--text)] mb-3">Pending School Invitations</h2>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] overflow-hidden">
            {pendingInvitations.map((inv, i, arr) => (
              <div key={inv.id} className={`p-4 flex items-center justify-between gap-4 ${i < arr.length - 1 ? "border-b border-[var(--border)]" : ""}`}>
                <div>
                  <div className="font-semibold text-[13.5px] text-[var(--text)]">{inv.schoolName}</div>
                  <div className="text-[12px] text-[var(--text-faint)] mt-0.5">
                    Invited {new Date(inv.createdAt).toLocaleDateString()} · sent to {inv.sentTo}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleInvitationRespond(inv.id, "ACCEPTED")}
                    disabled={respondingId === inv.id}
                    className="px-3.5 py-[7px] bg-[var(--action)] text-white rounded-[2px] text-[13px] font-medium hover:opacity-85 disabled:opacity-50"
                  >
                    {respondingId === inv.id ? "..." : "Accept"}
                  </button>
                  <button
                    onClick={() => handleInvitationRespond(inv.id, "DECLINED")}
                    disabled={respondingId === inv.id}
                    className="px-3.5 py-[7px] bg-[var(--surface)] border border-[var(--border)] text-[var(--text-sec)] rounded-[2px] text-[13px] font-medium hover:bg-[var(--surface-alt)] disabled:opacity-50"
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
          <h2 className="text-[13px] font-semibold text-[var(--text-sec)] mb-2">Past School Invitations</h2>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] overflow-hidden">
            {invitations.filter((inv) => inv.status !== "PENDING").map((inv, i, arr) => (
              <div key={inv.id} className={`px-4 py-3 flex items-center justify-between ${i < arr.length - 1 ? "border-b border-[var(--border)]" : ""}`}>
                <div className="text-[13.5px] font-medium text-[var(--text)]">{inv.schoolName}</div>
                <span className={`text-[11.5px] font-semibold px-2 py-0.5 rounded uppercase tracking-wide ${
                  inv.status === "ACCEPTED" ? "bg-[var(--ok-bg)] text-[var(--ok-t)]" :
                  inv.status === "DECLINED" ? "bg-[var(--surface-alt)] text-[var(--text-sec)]" :
                  "bg-[var(--wn-bg)] text-[var(--wn-t)]"
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
          <h2 className="text-[15px] font-semibold text-[var(--text)] mb-3">Pending Hour Approvals</h2>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] overflow-hidden">
            {pendingSignups.map((signup, i, arr) => (
              <div key={signup.id} className={`p-4 ${i < arr.length - 1 ? "border-b border-[var(--border)]" : ""}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-[13.5px] text-[var(--text)]">{signup.student.label}</div>
                    <div className="text-[12.5px] text-[var(--text-sec)]">{signup.slot.opportunity.title}</div>
                    <div className="text-[12px] text-[var(--text-faint)]">
                      {new Date(signup.slot.date).toLocaleDateString()} · {signup.slot.startTime}
                    </div>
                    <div className="text-[13px] font-semibold text-[var(--text)] mt-1">
                      {signup.slot.durationHours}h expected
                    </div>
                  </div>
                  {rejectingId !== signup.id && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(signup.id, signup.slot.durationHours)}
                        disabled={approving === signup.id}
                        className="px-3.5 py-[7px] bg-[var(--action)] text-white rounded-[2px] text-[13px] font-medium hover:opacity-85 disabled:opacity-50">
                        {approving === signup.id ? "..." : "Approve"}
                      </button>
                      <button
                        onClick={() => { setRejectingId(signup.id); setRejectReason(""); setError(""); }}
                        disabled={approving === signup.id}
                        className="px-3.5 py-[7px] bg-[var(--surface)] border border-[var(--border)] text-[var(--er-t)] rounded-[2px] text-[13px] font-medium hover:bg-[var(--er-bg)] disabled:opacity-50">
                        Reject
                      </button>
                    </div>
                  )}
                </div>
                {rejectingId === signup.id && (
                  <div className="mt-3 pt-3 border-t border-[var(--border)]">
                    <input
                      type="text"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Reason for rejection..."
                      className="w-full px-3 py-2 border border-[var(--border)] rounded-[2px] text-[13.5px] mb-2 outline-none focus:border-blue-400"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReject(signup.id)}
                        disabled={approving === signup.id}
                        className="px-3.5 py-[7px] bg-[var(--er-t)] text-white rounded-[2px] text-[13px] font-medium hover:opacity-85 disabled:opacity-50">
                        {approving === signup.id ? "..." : "Confirm Reject"}
                      </button>
                      <button
                        onClick={() => { setRejectingId(null); setRejectReason(""); }}
                        className="px-3.5 py-[7px] text-[13px] text-[var(--text-sec)] hover:text-[var(--text)]">
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
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-8 text-center text-[var(--text-sec)] text-[13.5px]">
          No pending items. <Link to="/opportunities" className="text-[var(--action)] hover:underline">Create opportunities</Link> for students.
        </div>
      )}
    </div>
  );
}
