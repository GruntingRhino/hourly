import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";

interface Cohort {
  id: string;
  name: string;
  status: string;
  requiredHours: number;
  startYear: number | null;
  endYear: number | null;
  publishedAt: string | null;
  studentCount: number;
  invitationsSent: number;
  invitationsAccepted: number;
  invitationsPending: number;
  totalHours: number;
  completedCount: number;
  atRiskCount: number;
  completionPercentage: number;
}

export default function SchoolCohorts() {
  const { user } = useAuth();
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createHours, setCreateHours] = useState("");
  const [createStartYear, setCreateStartYear] = useState("");
  const [creating, setCreating] = useState(false);

  const loadCohorts = async () => {
    setLoading(true);
    try {
      const data = await api.get<Cohort[]>("/cohorts");
      setCohorts(data);
    } catch {
      setError("Failed to load cohorts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadCohorts(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post("/cohorts", {
        name: createName,
        requiredHours: createHours ? parseFloat(createHours) : undefined,
        startYear: createStartYear ? parseInt(createStartYear) : undefined,
        endYear: createStartYear ? parseInt(createStartYear) + 4 : undefined,
      });
      setCreateName("");
      setCreateHours("");
      setCreateStartYear("");
      setShowCreateForm(false);
      void loadCohorts();
    } catch (err: any) {
      setError(err.message || "Failed to create cohort.");
    } finally {
      setCreating(false);
    }
  };

  const handlePublish = async (cohortId: string, cohortName: string) => {
    if (!window.confirm(`Send invitation emails to all imported students in "${cohortName}"?`)) return;
    try {
      const result = await api.post<any>(`/cohorts/${cohortId}/publish`);
      alert(`Sent ${result.sent} invitation${result.sent !== 1 ? "s" : ""}. ${result.failed > 0 ? `${result.failed} failed.` : ""}`);
      void loadCohorts();
    } catch (err: any) {
      setError(err.message || "Failed to publish cohort.");
    }
  };

  if (loading) return <div className="text-gray-500 py-8 text-center">Loading cohorts...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Cohorts</h1>
        {user?.role === "SCHOOL_ADMIN" && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800"
          >
            + New Cohort
          </button>
        )}
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

      {showCreateForm && (
        <div className="mb-6 bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="font-semibold mb-4">Create Cohort</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">Cohort Name *</label>
                <input type="text" value={createName} onChange={(e) => setCreateName(e.target.value)} required
                  placeholder="Class of 2028" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Required Hours</label>
                <input type="number" value={createHours} onChange={(e) => setCreateHours(e.target.value)}
                  placeholder="School default" min={0} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Start Year</label>
                <input type="number" value={createStartYear} onChange={(e) => setCreateStartYear(e.target.value)}
                  placeholder="e.g. 2024" min={2020} max={2040} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={creating} className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm hover:bg-gray-800 disabled:opacity-50">
                {creating ? "Creating..." : "Create"}
              </button>
              <button type="button" onClick={() => setShowCreateForm(false)} className="px-3 py-2 text-gray-500 hover:text-gray-800 text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {cohorts.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-500">
          No cohorts yet. Create one to get started.
        </div>
      ) : (
        <div className="space-y-4">
          {cohorts.map((cohort) => (
            <div key={cohort.id} className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{cohort.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      cohort.status === "PUBLISHED" ? "bg-green-50 text-green-700" :
                      cohort.status === "ARCHIVED" ? "bg-gray-100 text-gray-500" :
                      "bg-yellow-50 text-yellow-700"
                    }`}>{cohort.status}</span>
                  </div>
                  {(cohort.startYear || cohort.endYear) && (
                    <div className="text-xs text-gray-500 mt-0.5">
                      {cohort.startYear && cohort.endYear ? `${cohort.startYear}–${cohort.endYear}` : cohort.startYear ?? cohort.endYear}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Link
                    to={`/cohorts/${cohort.id}`}
                    className="px-3 py-1.5 border border-gray-300 rounded text-xs hover:bg-gray-50"
                  >
                    Manage
                  </Link>
                  {cohort.status !== "PUBLISHED" && user?.role === "SCHOOL_ADMIN" && cohort.invitationsPending > 0 && (
                    <button
                      onClick={() => handlePublish(cohort.id, cohort.name)}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                    >
                      Publish & Send Invites
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div className="bg-gray-50 rounded p-2 text-center">
                  <div className="text-lg font-bold">{cohort.studentCount}</div>
                  <div className="text-xs text-gray-500">Students</div>
                </div>
                <div className="bg-gray-50 rounded p-2 text-center">
                  <div className="text-lg font-bold">{cohort.invitationsPending}</div>
                  <div className="text-xs text-gray-500">Pending Invites</div>
                </div>
                <div className="bg-gray-50 rounded p-2 text-center">
                  <div className="text-lg font-bold text-green-600">{cohort.completedCount}</div>
                  <div className="text-xs text-gray-500">Completed Goal</div>
                </div>
                <div className="bg-gray-50 rounded p-2 text-center">
                  <div className="text-lg font-bold text-red-500">{cohort.atRiskCount}</div>
                  <div className="text-xs text-gray-500">At Risk</div>
                </div>
              </div>

              {cohort.studentCount > 0 && (
                <div className="mt-3">
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${cohort.completionPercentage}%` }} />
                  </div>
                  <div className="text-xs text-gray-400 mt-1">{cohort.completionPercentage}% completed {cohort.requiredHours}h goal</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
