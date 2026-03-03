import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";

interface Signup {
  id: string;
  status: string;
  student: { name: string; email: string };
  slot: {
    opportunity: { title: string };
    startTime: string;
  };
  totalHours: number | null;
}

interface Stats {
  pendingApprovalCount: number;
  totalApprovedHours: number;
  totalStudents: number;
  upcomingSlots: number;
}

export default function BeneficiaryDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [pendingSignups, setPendingSignups] = useState<Signup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [approving, setApproving] = useState<string | null>(null);

  const benId = user?.beneficiaryId;

  const load = async () => {
    if (!benId) return;
    setLoading(true);
    try {
      const signups = await api.get<Signup[]>(`/beneficiaries/${benId}/signups?status=PENDING`);
      setPendingSignups(signups);
      setStats({
        pendingApprovalCount: signups.length,
        totalApprovedHours: 0,
        totalStudents: 0,
        upcomingSlots: 0,
      });
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
    const reason = window.prompt("Reason for rejection:");
    if (reason === null) return;
    setApproving(signupId);
    try {
      await api.post(`/beneficiaries/signups/${signupId}/reject`, { reason });
      void load();
    } catch (err: any) {
      setError(err.message || "Failed to reject.");
    } finally {
      setApproving(null);
    }
  };

  if (loading) return <div className="text-gray-500 py-8 text-center">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
      <p className="text-gray-500 text-sm mb-6">{user?.beneficiary?.name}</p>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg p-5 text-center">
          <div className="text-3xl font-bold text-orange-500">{stats?.pendingApprovalCount || 0}</div>
          <div className="text-sm text-gray-500 mt-1">Pending Hour Approvals</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5 text-center">
          <Link to="/opportunities" className="block">
            <div className="text-3xl font-bold text-blue-600">+</div>
            <div className="text-sm text-gray-500 mt-1">Manage Opportunities</div>
          </Link>
        </div>
      </div>

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
                    <div className="text-sm text-gray-600 mt-1">
                      {signup.totalHours !== null ? `${signup.totalHours}h` : "Hours not logged"}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(signup.id, signup.totalHours || 0)}
                      disabled={approving === signup.id}
                      className="px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50">
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(signup.id)}
                      disabled={approving === signup.id}
                      className="px-3 py-1.5 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200 disabled:opacity-50">
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pendingSignups.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-500">
          No pending approvals. <Link to="/opportunities" className="text-blue-600 hover:underline">Create opportunities</Link> for students.
        </div>
      )}
    </div>
  );
}
