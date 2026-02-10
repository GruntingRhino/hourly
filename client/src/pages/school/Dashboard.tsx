import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";

interface Stats {
  totalStudents: number;
  totalSchoolHours: number;
  studentsCompletedGoal: number;
  studentsAtRisk: number;
  completionPercentage: number;
  requiredHours: number;
}

interface Group {
  id: string;
  name: string;
  _count: { members: number };
}

interface OrgApproval {
  approvals: {
    id: string;
    status: string;
    organization: { id: string; name: string; description: string | null; status: string };
  }[];
  pendingOrgs: { id: string; name: string; description: string | null }[];
}

export default function SchoolDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [orgData, setOrgData] = useState<OrgApproval | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const schoolId = user?.schoolId;
      if (!schoolId) return;
      const [st, gr, orgs] = await Promise.all([
        api.get<Stats>(`/schools/${schoolId}/stats`),
        api.get<Group[]>(`/schools/${schoolId}/groups`),
        api.get<OrgApproval>(`/schools/${schoolId}/organizations`),
      ]);
      setStats(st);
      setGroups(gr);
      setOrgData(orgs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveOrg = async (orgId: string) => {
    await api.post(`/schools/${user?.schoolId}/organizations/${orgId}/approve`);
    loadData();
  };

  const handleRejectOrg = async (orgId: string) => {
    await api.post(`/schools/${user?.schoolId}/organizations/${orgId}/reject`);
    loadData();
  };

  if (loading) return <div className="text-gray-500">Loading dashboard...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Left: Groups */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Groups</h2>
          <div className="space-y-2">
            {groups.map((g) => (
              <Link
                key={g.id}
                to={`/groups?group=${g.id}`}
                className="block bg-white border border-gray-200 rounded-lg p-3 hover:border-blue-300"
              >
                <div className="font-medium text-sm">{g.name}</div>
                <div className="text-xs text-gray-400">{g._count.members} students</div>
              </Link>
            ))}
            {groups.length === 0 && (
              <div className="text-gray-500 text-sm">No groups yet.</div>
            )}
          </div>
        </div>

        {/* Center: Group stats cards */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Group Progress</h2>
          {groups.map((g) => (
            <div key={g.id} className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-2">
              <div className="text-sm font-medium text-blue-800">{g.name}</div>
              <div className="text-lg font-bold text-blue-900">
                {g._count.members} students
              </div>
            </div>
          ))}

          {/* School-wide summary */}
          {stats && (
            <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-2xl font-bold">{stats.totalSchoolHours}</div>
              <div className="text-sm text-gray-500">School Wide Hours</div>
              <div className="mt-2 text-lg font-bold text-red-600">{stats.studentsAtRisk}</div>
              <div className="text-sm text-gray-500">students at risk</div>
            </div>
          )}
        </div>

        {/* Right: Stats + actions */}
        <div>
          {stats && (
            <div className="mb-6">
              {/* Pie chart representation */}
              <div className="bg-white border border-gray-200 rounded-lg p-5 text-center mb-4">
                <div className="text-4xl font-bold text-blue-600">{stats.completionPercentage}%</div>
                <div className="text-sm text-gray-500 mt-1">students on track</div>
              </div>

              <div className="space-y-2">
                <Link
                  to="/groups?filter=ON_TRACK"
                  className="block bg-white border border-gray-200 rounded-lg p-3 text-sm hover:bg-gray-50"
                >
                  View on-track students
                </Link>
                <Link
                  to="/groups?filter=AT_RISK"
                  className="block bg-white border border-gray-200 rounded-lg p-3 text-sm hover:bg-gray-50"
                >
                  View off-track students
                </Link>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Link
              to="/groups"
              className="block bg-white border border-gray-200 rounded-lg p-3 text-sm font-medium text-center hover:bg-gray-50"
            >
              View Roster
            </Link>
          </div>
        </div>
      </div>

      {/* Organization approvals */}
      {orgData && orgData.pendingOrgs.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-3">Pending Organization Approvals</h2>
          <div className="space-y-2">
            {orgData.pendingOrgs.map((org) => (
              <div key={org.id} className="bg-white border border-yellow-200 rounded-lg p-4 flex justify-between items-center">
                <div>
                  <div className="font-medium">{org.name}</div>
                  {org.description && (
                    <div className="text-sm text-gray-500">{org.description}</div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApproveOrg(org.id)}
                    className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleRejectOrg(org.id)}
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

      {/* Approved organizations */}
      {orgData && orgData.approvals.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-3">Approved Organizations</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {orgData.approvals
              .filter((a) => a.status === "APPROVED")
              .map((a) => (
                <div key={a.id} className="bg-white border border-green-200 rounded-lg p-3">
                  <div className="text-sm font-medium">{a.organization.name}</div>
                  <span className="text-xs text-green-600">Approved</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
