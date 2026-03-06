import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";

interface CohortSummary {
  id: string;
  name: string;
  status: string;
  requiredHours: number;
  studentCount: number;
  totalHours: number;
  completedCount: number;
  atRiskCount: number;
  completionPercentage: number;
  invitationsPending: number;
}

interface Beneficiary {
  id: string;
  name: string;
  category: string | null;
  approvalStatus: string;
}

export default function SchoolDashboard() {
  const { user } = useAuth();
  const [cohorts, setCohorts] = useState<CohortSummary[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [c, b] = await Promise.all([
        api.get<CohortSummary[]>("/cohorts"),
        api.get<Beneficiary[]>("/beneficiaries?status=APPROVED"),
      ]);
      setCohorts(c);
      setBeneficiaries(b);
    } catch {
      setError("Failed to load dashboard. Please refresh.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-gray-500">Loading dashboard...</div>;
  if (error) return <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>;

  // Aggregate stats across all cohorts
  const totalStudents = cohorts.reduce((s, c) => s + c.studentCount, 0);
  const totalHours = cohorts.reduce((s, c) => s + c.totalHours, 0);
  const totalCompleted = cohorts.reduce((s, c) => s + c.completedCount, 0);
  const totalAtRisk = cohorts.reduce((s, c) => s + c.atRiskCount, 0);
  const pendingInvites = cohorts.reduce((s, c) => s + c.invitationsPending, 0);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex gap-2">
          <Link to="/cohorts" className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800">
            Manage Cohorts
          </Link>
        </div>
      </div>

      {/* School-wide stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-500">Total Students</div>
          <div className="text-2xl font-bold">{totalStudents}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-500">Total Hours</div>
          <div className="text-2xl font-bold text-blue-600">{totalHours.toFixed(1)}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-500">Goal Reached</div>
          <div className="text-2xl font-bold text-green-600">{totalCompleted}</div>
          <div className="text-xs text-gray-400">of {totalStudents} students</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-500">At Risk</div>
          <div className="text-2xl font-bold text-red-600">{totalAtRisk}</div>
          <div className="text-xs text-gray-400">below 50% of goal</div>
        </div>
      </div>

      {/* Quick links */}
      <div className="flex gap-3 mb-8 flex-wrap">
        <Link to="/cohorts" className="px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-sm font-medium hover:bg-blue-100">
          View All Cohorts ({cohorts.length})
        </Link>
        <Link to="/beneficiaries" className="px-4 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-md text-sm font-medium hover:bg-purple-100">
          Partners ({beneficiaries.length} approved)
        </Link>
        <Link to="/submissions" className="px-4 py-2 bg-orange-50 text-orange-700 border border-orange-200 rounded-md text-sm font-medium hover:bg-orange-100">
          Self-Submitted Hours
        </Link>
      </div>

      {/* Pending invites alert */}
      {pendingInvites > 0 && (
        <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg flex justify-between items-center">
          <span className="text-sm text-blue-800">{pendingInvites} student invitation{pendingInvites !== 1 ? "s" : ""} pending across cohorts.</span>
          <Link to="/cohorts" className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">
            View Cohorts
          </Link>
        </div>
      )}

      {/* Cohorts list */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Cohorts</h2>
          <Link to="/cohorts" className="text-sm text-blue-600 hover:underline">Manage →</Link>
        </div>

        {cohorts.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-gray-500">
            No cohorts yet.{" "}
            <Link to="/cohorts" className="text-blue-600 hover:underline">Create your first cohort</Link> to get started.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cohorts.map((c) => (
              <Link key={c.id} to={`/cohorts/${c.id}`} className="block bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-300 transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-xs text-gray-500">{c.requiredHours}h goal</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${c.status === "PUBLISHED" ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
                    {c.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center mb-3">
                  <div>
                    <div className="text-lg font-bold">{c.studentCount}</div>
                    <div className="text-xs text-gray-500">Students</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-green-600">{c.completedCount}</div>
                    <div className="text-xs text-gray-500">Completed</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-red-500">{c.atRiskCount}</div>
                    <div className="text-xs text-gray-500">At Risk</div>
                  </div>
                </div>

                {c.studentCount > 0 && (
                  <div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${c.completionPercentage}%` }} />
                    </div>
                    <div className="text-xs text-gray-400 mt-1">{c.completionPercentage}% completion</div>
                  </div>
                )}

                {c.invitationsPending > 0 && (
                  <div className="mt-2 text-xs text-blue-600">{c.invitationsPending} invitation{c.invitationsPending !== 1 ? "s" : ""} pending</div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Partners */}
      {beneficiaries.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Approved Partners</h2>
            <Link to="/beneficiaries" className="text-sm text-blue-600 hover:underline">Manage →</Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {beneficiaries.slice(0, 6).map((b) => (
              <div key={b.id} className="bg-white border border-gray-200 rounded-lg p-3">
                <div className="text-sm font-medium">{b.name}</div>
                {b.category && <div className="text-xs text-gray-400 mt-0.5">{b.category}</div>}
              </div>
            ))}
          </div>
          {beneficiaries.length > 6 && (
            <Link to="/beneficiaries" className="block mt-2 text-sm text-blue-600 hover:underline">
              View all {beneficiaries.length} partners →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
