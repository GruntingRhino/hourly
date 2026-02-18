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

interface Classroom {
  id: string;
  name: string;
  inviteCode: string;
  isActive: boolean;
  teacher: { id: string; name: string };
  studentCount: number;
  totalHours: number;
  completedCount: number;
  atRiskCount: number;
  completionPercentage: number;
}

interface OrgApproval {
  approvals: {
    id: string;
    status: string;
    organization: { id: string; name: string; description: string | null };
  }[];
  pendingOrgs: { id: string; name: string; description: string | null }[];
}

export default function SchoolDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [orgData, setOrgData] = useState<OrgApproval | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [blockConfirmOrgId, setBlockConfirmOrgId] = useState<string | null>(null);
  const [blocking, setBlocking] = useState(false);

  const schoolId = user?.schoolId;
  const isOwner = user?.role === "SCHOOL_ADMIN";

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!schoolId) return;
    try {
      const [st, cls] = await Promise.all([
        api.get<Stats>(`/schools/${schoolId}/stats`),
        api.get<Classroom[]>(`/classrooms`),
      ]);
      setStats(st);
      setClassrooms(cls);

      if (isOwner) {
        const orgs = await api.get<OrgApproval>(`/schools/${schoolId}/organizations`);
        setOrgData(orgs);
      }
    } catch {
      setError("Failed to load dashboard. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveOrg = async (orgId: string) => {
    await api.post(`/schools/${schoolId}/organizations/${orgId}/approve`);
    loadData();
  };
  const handleRejectOrg = async (orgId: string) => {
    await api.post(`/schools/${schoolId}/organizations/${orgId}/reject`);
    loadData();
  };
  const handleBlockOrg = (orgId: string) => {
    setBlockConfirmOrgId(orgId);
  };

  const handleConfirmBlock = async () => {
    if (!blockConfirmOrgId) return;
    setBlocking(true);
    try {
      await api.post(`/schools/${schoolId}/organizations/${blockConfirmOrgId}/block`);
      setBlockConfirmOrgId(null);
      loadData();
    } finally {
      setBlocking(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (loading) return <div className="text-gray-500">Loading dashboard...</div>;
  if (error) return <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>;

  const pendingOrgs = orgData?.pendingOrgs || [];
  const approvedOrgs = orgData?.approvals.filter((a) => a.status === "APPROVED") || [];

  return (
    <div>
      {/* Block Org Confirm Modal */}
      {blockConfirmOrgId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-2">Block Organization?</h2>
            <p className="text-sm text-gray-600 mb-6">
              Their opportunities will be hidden from your students. You can re-approve them later.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleConfirmBlock}
                disabled={blocking}
                className="flex-1 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {blocking ? "Blocking..." : "Block"}
              </button>
              <button
                onClick={() => setBlockConfirmOrgId(null)}
                className="flex-1 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        {isOwner && (
          <div className="flex gap-2">
            <Link
              to="/groups"
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200"
            >
              Student Roster
            </Link>
          </div>
        )}
      </div>

      {/* School-wide stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-500">Total Students</div>
            <div className="text-2xl font-bold">{stats.totalStudents}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-500">Total Hours</div>
            <div className="text-2xl font-bold text-blue-600">{stats.totalSchoolHours}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-500">Goal Completion</div>
            <div className="text-2xl font-bold text-green-600">
              {stats.studentsCompletedGoal}/{stats.totalStudents}
            </div>
            <div className="text-xs text-gray-400">{stats.completionPercentage}% on track</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-500">At Risk</div>
            <div className="text-2xl font-bold text-red-600">{stats.studentsAtRisk}</div>
            <div className="text-xs text-gray-400">below 50% of {stats.requiredHours}h goal</div>
          </div>
        </div>
      )}

      {/* Quick links */}
      {stats && (
        <div className="flex gap-3 mb-8">
          <Link to="/groups?filter=ON_TRACK" className="px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-md text-sm font-medium hover:bg-green-100">
            View On-Track Students
          </Link>
          <Link to="/groups?filter=AT_RISK" className="px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-md text-sm font-medium hover:bg-red-100">
            View At-Risk Students ({stats.studentsAtRisk})
          </Link>
        </div>
      )}

      {/* Classrooms */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Classrooms</h2>
          {isOwner && (
            <CreateClassroomButton onCreated={loadData} />
          )}
        </div>

        {classrooms.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-gray-500">
            No classrooms yet.{" "}
            {isOwner && "Create one to get started."}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {classrooms.map((cls) => (
              <div key={cls.id} className="bg-white border border-gray-200 rounded-lg p-5">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-semibold">{cls.name}</div>
                    <div className="text-sm text-gray-500">{cls.teacher.name}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${cls.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {cls.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center mb-3">
                  <div>
                    <div className="text-lg font-bold">{cls.studentCount}</div>
                    <div className="text-xs text-gray-500">Students</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-green-600">{cls.completedCount}</div>
                    <div className="text-xs text-gray-500">Completed</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-red-500">{cls.atRiskCount}</div>
                    <div className="text-xs text-gray-500">At Risk</div>
                  </div>
                </div>

                {cls.studentCount > 0 && (
                  <div className="mb-3">
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full"
                        style={{ width: `${cls.completionPercentage}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-400 mt-1">{cls.completionPercentage}% completion</div>
                  </div>
                )}

                {/* Invite code */}
                <div className="flex items-center gap-2 bg-gray-50 rounded p-2">
                  <span className="text-xs text-gray-500 font-mono flex-1">{cls.inviteCode}</span>
                  <button
                    onClick={() => copyCode(cls.inviteCode)}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    {copiedCode === cls.inviteCode ? "Copied!" : "Copy"}
                  </button>
                </div>

                <div className="mt-3">
                  <Link
                    to={`/groups?classroom=${cls.id}`}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    View students →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Org approvals (owner only) */}
      {isOwner && (
        <>
          {pendingOrgs.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-3">Pending Organization Requests</h2>
              <div className="space-y-2">
                {pendingOrgs.map((org) => (
                  <div key={org.id} className="bg-white border border-yellow-200 rounded-lg p-4 flex justify-between items-center">
                    <div>
                      <div className="font-medium">{org.name}</div>
                      {org.description && <div className="text-sm text-gray-500">{org.description}</div>}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleApproveOrg(org.id)} className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">
                        Approve
                      </button>
                      <button onClick={() => handleRejectOrg(org.id)} className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700">
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {approvedOrgs.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Approved Organizations</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {approvedOrgs.map((a) => (
                  <div key={a.id} className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{a.organization.name}</div>
                      <span className="text-xs text-green-600">Approved</span>
                    </div>
                    <button onClick={() => handleBlockOrg(a.organization.id)} className="text-xs text-red-400 hover:text-red-600">
                      Block
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CreateClassroomButton({ onCreated }: { onCreated: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await api.post<{ inviteCode: string; name: string }>("/classrooms", { name });
      setNewCode(result.inviteCode);
      setName("");
      onCreated();
    } finally {
      setLoading(false);
    }
  };

  if (newCode) {
    return (
      <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-md px-3 py-2 text-sm">
        <span className="text-green-700">Classroom created! Code:</span>
        <span className="font-mono font-bold text-green-800">{newCode}</span>
        <button onClick={() => { setNewCode(null); setShowForm(false); }} className="text-green-600 hover:text-green-800 ml-2">×</button>
      </div>
    );
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800"
      >
        + New Classroom
      </button>
    );
  }

  return (
    <form onSubmit={handleCreate} className="flex gap-2">
      <input
        autoFocus
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Classroom name"
        required
        className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button type="submit" disabled={loading} className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm hover:bg-gray-800 disabled:opacity-50">
        {loading ? "Creating..." : "Create"}
      </button>
      <button type="button" onClick={() => setShowForm(false)} className="px-3 py-2 text-gray-500 hover:text-gray-800">
        Cancel
      </button>
    </form>
  );
}
