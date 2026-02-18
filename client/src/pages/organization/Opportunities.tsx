import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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

export default function OrgOpportunities() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ACTIVE");

  useEffect(() => {
    loadData();
  }, [filter]);

  const loadData = async () => {
    setLoading(true);
    const opps = await api.get<Opportunity[]>(
      `/opportunities?organizationId=${user?.organizationId}&status=${filter}`
    );
    setOpportunities(opps);
    setLoading(false);
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this opportunity?")) return;
    await api.post(`/opportunities/${id}/cancel`);
    loadData();
  };

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

      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : opportunities.length === 0 ? (
        <div className="text-gray-500 text-center py-8">
          No {filter.toLowerCase()} opportunities.
        </div>
      ) : (
        <div className="space-y-3">
          {opportunities.map((opp) => (
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
