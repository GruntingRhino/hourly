import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";

interface Opportunity {
  id: string;
  title: string;
  description: string;
  tags: string | null;
  location: string;
  address: string | null;
  date: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  capacity: number;
  ageRequirement: number | null;
  latitude: number | null;
  longitude: number | null;
  organization: { id: string; name: string; zipCodes?: string | null };
  _count: { signups: number };
}

interface SavedOpp {
  id: string;
  status: string;
  opportunityId: string;
}

// Simple haversine distance in miles
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function StudentBrowse() {
  const { user } = useAuth();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [saved, setSaved] = useState<SavedOpp[]>([]);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [approvedOnly, setApprovedOnly] = useState(false);
  const [distanceFilter, setDistanceFilter] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"browse" | "saved" | "skipped" | "discarded">("browse");

  useEffect(() => {
    loadData();
  }, [approvedOnly]);

  const loadData = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (user?.schoolId) params.set("schoolId", user.schoolId);
    if (approvedOnly) params.set("approvedOnly", "true");

    const [opps, savedOpps] = await Promise.all([
      api.get<Opportunity[]>(`/opportunities?${params.toString()}`),
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

  // Collect all unique tags
  const allTags = Array.from(new Set(
    opportunities.flatMap((o) => {
      try { return o.tags ? JSON.parse(o.tags) : []; } catch { return []; }
    })
  )).sort();

  // Get school lat/lng (approximation from first zip if available)
  // Distance filter uses opportunity lat/lng if available
  const filtered = opportunities.filter((opp) => {
    const searchMatch = !search || (
      opp.title.toLowerCase().includes(search.toLowerCase()) ||
      opp.description.toLowerCase().includes(search.toLowerCase()) ||
      opp.location.toLowerCase().includes(search.toLowerCase()) ||
      opp.organization.name.toLowerCase().includes(search.toLowerCase())
    );
    const tagMatch = !tagFilter || (() => {
      try { return opp.tags ? JSON.parse(opp.tags).includes(tagFilter) : false; } catch { return false; }
    })();

    // Distance filter: use opp lat/lng if available
    let distMatch = true;
    if (distanceFilter && opp.latitude && opp.longitude) {
      // We'd need school lat/lng — skip if not available
      // If school has no coords, show all
      distMatch = true; // TODO: full zip-to-lat requires server-side lookup
    }

    return searchMatch && tagMatch && distMatch;
  });

  const savedIds = saved.filter((s) => s.status === "SAVED").map((s) => s.opportunityId);
  const skippedIds = saved.filter((s) => s.status === "SKIPPED").map((s) => s.opportunityId);
  const discardedIds = saved.filter((s) => s.status === "DISCARDED").map((s) => s.opportunityId);
  const hiddenIds = [...skippedIds, ...discardedIds];

  const displayOpps =
    view === "saved"
      ? filtered.filter((o) => savedIds.includes(o.id))
      : view === "skipped"
      ? filtered.filter((o) => skippedIds.includes(o.id))
      : view === "discarded"
      ? filtered.filter((o) => discardedIds.includes(o.id))
      : filtered.filter((o) => !hiddenIds.includes(o.id));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Browse Opportunities</h1>

      {/* Search + view tabs */}
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <input
          type="text"
          placeholder="Search opportunities..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex gap-2 flex-wrap">
          {(["browse", "saved", "skipped", "discarded"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-2 rounded-md text-sm font-medium capitalize ${
                view === v ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {v === "browse" ? "All" : v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6 p-3 bg-gray-50 rounded-lg border border-gray-200">
        {/* Tag filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Tag:</label>
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none"
          >
            <option value="">All tags</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
        </div>

        {/* Distance filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Distance:</label>
          <select
            value={distanceFilter ?? ""}
            onChange={(e) => setDistanceFilter(e.target.value ? Number(e.target.value) : null)}
            className="px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none"
          >
            <option value="">Any distance</option>
            <option value="5">Within 5 mi</option>
            <option value="10">Within 10 mi</option>
            <option value="25">Within 25 mi</option>
            <option value="50">Within 50 mi</option>
          </select>
        </div>

        {/* Approved orgs toggle */}
        {user?.schoolId && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={approvedOnly}
              onChange={(e) => setApprovedOnly(e.target.checked)}
              className="w-4 h-4 text-blue-600"
            />
            <span className="text-sm font-medium text-gray-700">Approved orgs only</span>
          </label>
        )}

        {/* Clear filters */}
        {(tagFilter || approvedOnly || distanceFilter) && (
          <button
            onClick={() => { setTagFilter(""); setApprovedOnly(false); setDistanceFilter(null); }}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-gray-500">Loading opportunities...</div>
      ) : displayOpps.length === 0 ? (
        <div className="text-center py-12">
          {view === "saved" ? (
            <>
              <div className="text-3xl mb-3">★</div>
              <div className="font-medium text-gray-700 mb-1">No saved opportunities</div>
              <div className="text-sm text-gray-500">
                Browse opportunities and click Save to bookmark ones you're interested in.
              </div>
            </>
          ) : view === "skipped" ? (
            <>
              <div className="text-3xl mb-3">—</div>
              <div className="font-medium text-gray-700 mb-1">No skipped opportunities</div>
              <div className="text-sm text-gray-500">
                Opportunities you skip will appear here so you can recover them later.
              </div>
            </>
          ) : view === "discarded" ? (
            <>
              <div className="text-3xl mb-3">✕</div>
              <div className="font-medium text-gray-700 mb-1">No discarded opportunities</div>
              <div className="text-sm text-gray-500">
                Opportunities you discard will appear here. You can recover them any time.
              </div>
            </>
          ) : (
            <>
              <div className="text-3xl mb-3">⌕</div>
              <div className="font-medium text-gray-700 mb-1">No opportunities found</div>
              <div className="text-sm text-gray-500">
                {(tagFilter || approvedOnly)
                  ? "Try adjusting your filters."
                  : "Check back later — new opportunities are added regularly."}
              </div>
              {(tagFilter || approvedOnly) && (
                <button
                  onClick={() => { setTagFilter(""); setApprovedOnly(false); }}
                  className="mt-3 text-sm text-blue-600 hover:underline"
                >
                  Clear filters
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {displayOpps.map((opp) => {
            const tags = opp.tags ? (() => { try { return JSON.parse(opp.tags!); } catch { return []; } })() : [];
            const isSaved = savedIds.includes(opp.id);
            const isDiscarded = discardedIds.includes(opp.id);
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
                    {opp.address && (
                      <div className="text-xs text-gray-400 mt-0.5">{opp.address}</div>
                    )}
                    {opp.ageRequirement != null && opp.ageRequirement > 0 && (
                      <div className="text-xs text-orange-600 mt-0.5">
                        Age requirement: {opp.ageRequirement}+
                      </div>
                    )}
                    {tags.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {tags.map((tag: string) => (
                          <button
                            key={tag}
                            onClick={() => setTagFilter(tag)}
                            className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100"
                          >
                            {tag}
                          </button>
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
                      {(view === "skipped" || view === "discarded" || isDiscarded) ? (
                        <button
                          onClick={() => handleSave(opp.id, "SAVED")}
                          className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        >
                          Recover
                        </button>
                      ) : (
                        <>
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
                          {!isSaved && (
                            <>
                              <button
                                onClick={() => handleSave(opp.id, "SKIPPED")}
                                className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                              >
                                Skip
                              </button>
                              <button
                                onClick={() => handleSave(opp.id, "DISCARDED")}
                                className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                                title="Discard (don't show again)"
                              >
                                ✕
                              </button>
                            </>
                          )}
                        </>
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
