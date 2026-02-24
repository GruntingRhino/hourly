import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
  organization: { id: string; name: string };
}

function getOptimisticOpportunityFromQuery(search: string): Opportunity | null {
  const params = new URLSearchParams(search);
  const id = params.get("updatedId");
  const title = params.get("updatedTitle");
  if (!id || !title) return null;
  return {
    id,
    title,
    date: params.get("updatedDate") || new Date().toISOString(),
    startTime: params.get("updatedStartTime") || "",
    endTime: params.get("updatedEndTime") || "",
    location: params.get("updatedLocation") || "",
    capacity: Number(params.get("updatedCapacity") || 0),
    status: "ACTIVE",
    _count: { signups: 0 },
    organization: { id: "", name: "" },
  };
}

function applyOptimisticRows(
  base: Opportunity[],
  optimisticById: Record<string, Opportunity>,
  filter: string,
): Opportunity[] {
  const merged = base.map((opp) => (optimisticById[opp.id] ? { ...opp, ...optimisticById[opp.id] } : opp));
  const seen = new Set(merged.map((opp) => opp.id));

  for (const optimistic of Object.values(optimisticById)) {
    if (optimistic.status !== filter) continue;
    if (!seen.has(optimistic.id)) {
      merged.unshift(optimistic);
      seen.add(optimistic.id);
    }
  }

  return merged.filter((opp) => opp.status === filter);
}

export default function OrgOpportunities() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [optimisticById, setOptimisticById] = useState<Record<string, Opportunity>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ACTIVE");
  const optimisticFromQuery = useMemo(
    () => getOptimisticOpportunityFromQuery(location.search),
    [location.search],
  );
  const effectiveOptimisticById = useMemo(() => {
    if (!optimisticFromQuery) return optimisticById;
    // Explicit in-memory updates (e.g. cancel) must win over URL-derived optimistic state.
    return { [optimisticFromQuery.id]: optimisticFromQuery, ...optimisticById };
  }, [optimisticById, optimisticFromQuery]);

  const visibleOpportunities = useMemo(
    () => applyOptimisticRows(opportunities, effectiveOptimisticById, filter),
    [filter, opportunities, effectiveOptimisticById],
  );

  useEffect(() => {
    if (!user?.organizationId) return;
    void loadData();
  }, [filter, user?.organizationId]);

  const loadData = async () => {
    if (!user?.organizationId) {
      setOpportunities([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const opps = await api.get<Opportunity[]>(
        `/opportunities?organizationId=${user.organizationId}&status=${filter}`,
      );
      setOpportunities(opps);
    } catch {
      setOpportunities([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id: string) => {
    const target = visibleOpportunities.find((opp) => opp.id === id) || opportunities.find((opp) => opp.id === id);
    if (!target) return;

    const previousOptimistic = optimisticById[id];
    setOptimisticById((prev) => ({ ...prev, [id]: { ...target, status: "CANCELLED" } }));
    setOpportunities((prev) => prev.filter((opp) => opp.id !== id));

    try {
      await api.post(`/opportunities/${id}/cancel`);
      void loadData();
    } catch {
      setOptimisticById((prev) => {
        const next = { ...prev };
        if (previousOptimistic) {
          next[id] = previousOptimistic;
        } else {
          delete next[id];
        }
        return next;
      });
      setOpportunities((prev) => (prev.some((opp) => opp.id === id) ? prev : [target, ...prev]));
    }
  };

  const showLoadingState = loading && visibleOpportunities.length === 0;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">My Opportunities</h1>
        <Link
          to="/opportunities/new"
          className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800"
        >
          Create New
        </Link>
      </div>

      <div className="flex gap-2 mb-4">
        {["ACTIVE", "COMPLETED", "CANCELLED"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-sm ${
              filter === f ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {showLoadingState ? (
        <div className="text-gray-500">Loading...</div>
      ) : visibleOpportunities.length === 0 ? (
        <div className="text-gray-500 text-center py-8">
          No {filter.toLowerCase()} opportunities.
        </div>
      ) : (
        <div className="space-y-3">
          {visibleOpportunities.map((opp) => (
            <div key={opp.id} className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{opp.title}</h3>
                  <div className="text-sm text-gray-500 mt-1">
                    {new Date(opp.date).toLocaleDateString()} &middot; {opp.startTime} - {opp.endTime}
                  </div>
                  <div className="text-sm text-gray-400">{opp.location}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-blue-600">
                    {opp._count.signups}/{opp.capacity}
                  </div>
                  <div className="text-xs text-gray-400">enrolled</div>
                </div>
              </div>
              {opp.status === "ACTIVE" && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex gap-3">
                  <button
                    onClick={() => navigate(`/opportunities/${opp.id}/edit`)}
                    className="text-sm text-blue-600 hover:underline font-medium"
                  >
                    Edit Details
                  </button>
                  <button
                    onClick={() => handleCancel(opp.id)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
