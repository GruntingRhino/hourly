import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";

interface Opportunity {
  id: string;
  title: string;
  description: string;
  tags: string | null;
  location: string;
  date: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  capacity: number;
  ageRequirement: number | null;
  organization: { id: string; name: string };
  _count: { signups: number };
}

interface SavedOpp {
  id: string;
  status: string;
  opportunityId: string;
}

export default function StudentBrowse() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [saved, setSaved] = useState<SavedOpp[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"browse" | "saved" | "skipped">("browse");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [opps, savedOpps] = await Promise.all([
      api.get<Opportunity[]>("/opportunities"),
      api.get<SavedOpp[]>("/saved").catch(() => [] as SavedOpp[]),
    ]);
    setOpportunities(opps);
    setSaved(savedOpps);
    setLoading(false);
  };

  const handleSave = async (oppId: string, status: string) => {
    await api.post("/saved", { opportunityId: oppId, status });
    loadData();
  };

  const filtered = opportunities.filter((opp) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      opp.title.toLowerCase().includes(s) ||
      opp.description.toLowerCase().includes(s) ||
      opp.location.toLowerCase().includes(s) ||
      opp.organization.name.toLowerCase().includes(s)
    );
  });

  const savedIds = saved.filter((s) => s.status === "SAVED").map((s) => s.opportunityId);
  const skippedIds = saved.filter((s) => s.status === "SKIPPED" || s.status === "DISCARDED").map((s) => s.opportunityId);

  const displayOpps =
    view === "saved"
      ? filtered.filter((o) => savedIds.includes(o.id))
      : view === "skipped"
      ? filtered.filter((o) => skippedIds.includes(o.id))
      : filtered.filter((o) => !skippedIds.includes(o.id));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Browse Opportunities</h1>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <input
          type="text"
          placeholder="Search opportunities..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex gap-2">
          <button
            onClick={() => setView("browse")}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              view === "browse" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setView("saved")}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              view === "saved" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Saved
          </button>
          <button
            onClick={() => setView("skipped")}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              view === "skipped" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Skipped
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-500">Loading opportunities...</div>
      ) : displayOpps.length === 0 ? (
        <div className="text-gray-500 text-center py-8">No opportunities found.</div>
      ) : (
        <div className="space-y-4">
          {displayOpps.map((opp) => {
            const tags = opp.tags ? JSON.parse(opp.tags) : [];
            const isSaved = savedIds.includes(opp.id);
            return (
              <div
                key={opp.id}
                className="bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-200 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <Link
                      to={`/opportunity/${opp.id}`}
                      className="text-lg font-semibold hover:text-blue-600"
                    >
                      {opp.title}
                    </Link>
                    <div className="text-sm text-gray-500 mt-1">
                      {opp.organization.name}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {new Date(opp.date).toLocaleDateString()} &middot; {opp.startTime} - {opp.endTime} &middot; {opp.location}
                    </div>
                    {tags.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {tags.map((tag: string) => (
                          <span
                            key={tag}
                            className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-lg font-bold text-blue-600">
                      {opp._count.signups}/{opp.capacity}
                    </div>
                    <div className="text-xs text-gray-400">spots taken</div>
                    <div className="flex gap-1 mt-2">
                      <button
                        onClick={() => handleSave(opp.id, isSaved ? "SKIPPED" : "SAVED")}
                        className={`text-xs px-2 py-1 rounded ${
                          isSaved
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {isSaved ? "Saved" : "Save"}
                      </button>
                      {view !== "skipped" && !isSaved && (
                        <button
                          onClick={() => handleSave(opp.id, "SKIPPED")}
                          className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                        >
                          Skip
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
