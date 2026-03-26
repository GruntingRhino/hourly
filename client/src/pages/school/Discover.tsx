import { useEffect, useState, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-markercluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "react-leaflet-markercluster/dist/styles.min.css";

// Fix Leaflet default icon paths broken by Vite bundling
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

import { api, ApiError } from "../../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NearbyBeneficiary {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  latitude: number;
  longitude: number;
  distanceMiles: number;
  approvalStatus: "APPROVED" | "PENDING" | null;
  ein: string | null;
  email: string | null;
  website: string | null;
  phone: string | null;
  nteeCode: string | null;
  claimed: boolean;
}

interface SchoolLocation {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  latitude: number | null;
  longitude: number | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RADIUS_OPTIONS = [5, 10, 15, 25, 50];

const CATEGORY_OPTIONS = [
  "All",
  "Arts & Culture",
  "Community Improvement",
  "Education",
  "Education - School",
  "Environment",
  "Animal Welfare",
  "Food & Nutrition",
  "Health",
  "Housing & Shelter",
  "Human Services",
  "Recreation & Sports",
  "Youth Development",
];

const CATEGORY_COLORS: Record<string, string> = {
  "Arts & Culture": "#8b5cf6",
  "Community Improvement": "#0ea5e9",
  "Education": "#3b82f6",
  "Education - School": "#1d4ed8",
  "Environment": "#22c55e",
  "Animal Welfare": "#84cc16",
  "Food & Nutrition": "#f97316",
  "Health": "#ef4444",
  "Housing & Shelter": "#d97706",
  "Human Services": "#ec4899",
  "Recreation & Sports": "#06b6d4",
  "Youth Development": "#a855f7",
};

function categoryColor(category: string | null): string {
  if (!category) return "#6b7280";
  for (const [key, color] of Object.entries(CATEGORY_COLORS)) {
    if (category.toLowerCase().includes(key.toLowerCase())) return color;
  }
  return "#6b7280";
}

// ─── Custom Map Icons ─────────────────────────────────────────────────────────

function createBeneficiaryIcon(category: string | null, isHighlighted: boolean): L.DivIcon {
  const color = categoryColor(category);
  const size = isHighlighted ? 18 : 14;
  return L.divIcon({
    html: `<div style="
      width:${size}px;height:${size}px;
      border-radius:50%;
      background:${color};
      border:2px solid white;
      box-shadow:0 1px 4px rgba(0,0,0,0.4);
    "></div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function createApprovedIcon(category: string | null): L.DivIcon {
  const color = categoryColor(category);
  return L.divIcon({
    html: `<div style="position:relative;width:18px;height:18px;">
      <div style="
        width:18px;height:18px;
        border-radius:50%;
        background:${color};
        border:2px solid white;
        box-shadow:0 1px 4px rgba(0,0,0,0.4);
      "></div>
      <div style="
        position:absolute;top:-4px;right:-4px;
        width:12px;height:12px;
        background:#2563eb;border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        color:white;font-size:8px;font-weight:bold;
        box-shadow:0 1px 3px rgba(0,0,0,0.3);
      ">✓</div>
    </div>`,
    className: "",
    iconSize: [22, 22],
    iconAnchor: [9, 9],
  });
}

const SCHOOL_ICON = L.divIcon({
  html: `<div style="
    width:28px;height:28px;
    border-radius:50%;
    background:#1d4ed8;
    border:3px solid white;
    box-shadow:0 2px 6px rgba(0,0,0,0.4);
    display:flex;align-items:center;justify-content:center;
    color:white;font-size:14px;
  ">★</div>`,
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

// ─── Map Controller (fly to location) ────────────────────────────────────────

function MapController({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo(target, Math.min(Math.max(map.getZoom(), 14), 16), { duration: 0.8 });
    }
  }, [target, map]);
  return null;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BeneficiaryDiscover() {
  const [school, setSchool] = useState<SchoolLocation | null>(null);
  const [beneficiaries, setBeneficiaries] = useState<NearbyBeneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [radius, setRadius] = useState(10);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [mapTarget, setMapTarget] = useState<[number, number] | null>(null);

  const [geocodingInProgress, setGeocodingInProgress] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [approving, setApproving] = useState<string | null>(null);
  const [approveConfirm, setApproveConfirm] = useState<string | null>(null);

  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // ─── Load data ─────────────────────────────────────────────────────────────

  const loadData = useCallback(async (schoolData: SchoolLocation) => {
    if (!schoolData.latitude || !schoolData.longitude) return;
    setLoading(true);
    try {
      const categoryParam =
        selectedCategory !== "All" ? `&category=${encodeURIComponent(selectedCategory)}` : "";
      const data = await api.get<{ items: NearbyBeneficiary[]; geocodingInProgress: boolean }>(
        `/beneficiaries/directory/nearby?lat=${schoolData.latitude}&lng=${schoolData.longitude}&radius=${radius}&limit=100${categoryParam}`
      );
      setBeneficiaries(data.items);
      setGeocodingInProgress(data.geocodingInProgress ?? false);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load nearby partners.");
      }
    } finally {
      setLoading(false);
    }
  }, [radius, selectedCategory]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      setError(null);
      try {
        const schoolData = await api.get<SchoolLocation>("/schools/location");
        setSchool(schoolData);
        if (schoolData.latitude && schoolData.longitude) {
          await loadData(schoolData);
        } else {
          setLoading(false);
        }
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Failed to load school data.");
        }
        setLoading(false);
      }
    }
    init();
  }, []);

  // Reload when radius or category changes
  useEffect(() => {
    if (school) loadData(school);
  }, [radius, selectedCategory]);

  // ─── Filtered list ─────────────────────────────────────────────────────────

  const filtered = beneficiaries.filter((b) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      b.name.toLowerCase().includes(q) ||
      (b.category || "").toLowerCase().includes(q) ||
      (b.city || "").toLowerCase().includes(q)
    );
  });

  // ─── Approve handler ───────────────────────────────────────────────────────

  const handleApprove = async (directoryId: string) => {
    setApproving(directoryId);
    try {
      await api.post("/beneficiaries/approve-from-directory", { directoryId });
      setBeneficiaries((prev) =>
        prev.map((b) => (b.id === directoryId ? { ...b, approvalStatus: "APPROVED" } : b))
      );
    } catch (err) {
      // Silently show error state — could add toast here
      console.error("Approve failed:", err);
    } finally {
      setApproving(null);
      setApproveConfirm(null);
    }
  };

  // ─── Marker click: scroll to card ─────────────────────────────────────────

  const handleMarkerClick = (id: string) => {
    setHighlightedId(id);
    setExpandedId(id);
    const card = cardRefs.current[id];
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  // ─── Card hover: pan map ───────────────────────────────────────────────────

  const handleCardHover = (b: NearbyBeneficiary) => {
    setHighlightedId(b.id);
    setMapTarget([b.latitude, b.longitude]);
  };

  const handleCardLeave = () => {
    setHighlightedId(null);
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const defaultCenter: [number, number] =
    school?.latitude && school?.longitude
      ? [school.latitude, school.longitude]
      : [39.5, -98.35]; // US center fallback

  if (!school && loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  const noCoords = school && (!school.latitude || !school.longitude);

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)", overflow: "hidden" }}>
      {/* Header */}
      <div className="flex-none px-4 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Discover Community Partners</h1>
            <p className="text-sm text-gray-500">Find and approve organizations near your school</p>
          </div>
          <div className="text-sm text-gray-500">
            {loading ? "Loading..." : `${filtered.length} partners within ${radius} miles`}
          </div>
        </div>
      </div>

      {geocodingInProgress && (
        <div className="flex-none px-4 py-2 bg-amber-50 border-b border-amber-200 text-sm text-amber-800 flex items-center gap-2">
          <svg className="w-4 h-4 animate-spin flex-none" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
          Building your area map for the first time — partners will appear within a few minutes. Refresh to check progress.
        </div>
      )}

      {noCoords ? (
        <div className="flex items-center justify-center flex-1 bg-gray-50">
          <div className="text-center max-w-sm p-8">
            <div className="w-16 h-16 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-gray-800 mb-2">Add your school address</h2>
            <p className="text-sm text-gray-500 mb-5 leading-relaxed">
              Set your school's address in Settings to discover nearby community partners on the map.
            </p>
            <a
              href="/settings"
              className="inline-block px-4 py-2 bg-blue-700 text-white rounded-md text-sm font-medium hover:bg-blue-800 transition-colors"
            >
              Go to Settings
            </a>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Map pane */}
          <div className="flex-1" style={{ minWidth: 0 }}>
            <MapContainer
              center={defaultCenter}
              zoom={12}
              minZoom={10}
              maxZoom={18}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapController target={mapTarget} />

              {/* School marker */}
              {school?.latitude && school.longitude && (
                <Marker
                  position={[school.latitude, school.longitude]}
                  icon={SCHOOL_ICON}
                >
                  <Popup>
                    <div className="font-semibold">{school.name}</div>
                    <div className="text-xs text-gray-500">Your school</div>
                  </Popup>
                </Marker>
              )}

              {/* Beneficiary markers — clustered so city-center stacks show as bubbles */}
              <MarkerClusterGroup
                showCoverageOnHover={false}
                zoomToBoundsOnClick={true}
                spiderfyOnMaxZoom={true}
                maxClusterRadius={40}
              >
              {filtered.map((b) => (
                <Marker
                  key={b.id}
                  position={[b.latitude, b.longitude]}
                  icon={
                    b.approvalStatus === "APPROVED"
                      ? createApprovedIcon(b.category)
                      : createBeneficiaryIcon(b.category, highlightedId === b.id)
                  }
                  eventHandlers={{
                    click: () => handleMarkerClick(b.id),
                  }}
                >
                  <Popup>
                    <div className="min-w-[180px]">
                      <div className="font-semibold text-sm">{b.name}</div>
                      {b.category && (
                        <div className="text-xs text-gray-500 mb-1">{b.category}</div>
                      )}
                      <div className="text-xs text-gray-600">
                        {[b.city, b.state].filter(Boolean).join(", ")}
                      </div>
                      <div className="text-xs text-gray-400">{b.distanceMiles} mi away</div>
                      {b.approvalStatus === "APPROVED" && (
                        <div className="text-xs text-blue-600 font-medium mt-1">✓ Approved</div>
                      )}
                      <button
                        className="mt-2 text-xs text-blue-600 font-medium hover:underline block"
                        onClick={() => handleMarkerClick(b.id)}
                      >
                        View details →
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}
              </MarkerClusterGroup>
            </MapContainer>
          </div>

          {/* List pane */}
          <div className="flex-none w-80 xl:w-96 flex flex-col border-l border-gray-200 bg-white overflow-hidden">
            {/* Filters */}
            <div className="flex-none p-3 border-b border-gray-100 space-y-2">
              {/* Search */}
              <input
                type="text"
                placeholder="Search name, category, city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              />

              {/* Radius */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 whitespace-nowrap">Radius:</span>
                <div className="flex gap-1 flex-wrap">
                  {RADIUS_OPTIONS.map((r) => (
                    <button
                      key={r}
                      onClick={() => setRadius(r)}
                      className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                        radius === r
                          ? "bg-blue-600 text-white border-blue-600"
                          : "border-gray-300 text-gray-600 hover:border-blue-400"
                      }`}
                    >
                      {r}mi
                    </button>
                  ))}
                </div>
              </div>

              {/* Category pills */}
              <div className="flex gap-1 flex-wrap">
                {CATEGORY_OPTIONS.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                      selectedCategory === cat
                        ? "bg-blue-600 text-white border-blue-600"
                        : "border-gray-300 text-gray-600 hover:border-blue-400"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
                  Loading nearby partners...
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-gray-400 text-sm text-center px-4">
                  No partners found in this area. Try expanding the radius or changing the category.
                </div>
              ) : (
                filtered.map((b) => (
                  <div
                    key={b.id}
                    ref={(el) => { cardRefs.current[b.id] = el; }}
                    onMouseEnter={() => handleCardHover(b)}
                    onMouseLeave={handleCardLeave}
                    onClick={() => {
                      setHighlightedId(b.id);
                      setMapTarget([b.latitude, b.longitude]);
                      setExpandedId(expandedId === b.id ? null : b.id);
                    }}
                    className={`p-3 border-b border-gray-100 cursor-pointer transition-colors ${
                      expandedId === b.id
                        ? "bg-blue-50 border-l-2 border-l-blue-500"
                        : highlightedId === b.id
                        ? "bg-blue-50"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-none"
                            style={{ backgroundColor: categoryColor(b.category) }}
                          />
                          <span className="font-medium text-sm text-gray-900 truncate">
                            {b.name}
                          </span>
                          {b.approvalStatus === "APPROVED" && (
                            <span className="flex-none text-xs text-blue-600 font-semibold">✓</span>
                          )}
                        </div>

                        {b.category && (
                          <div className="text-xs text-gray-500 mt-0.5 ml-4">{b.category}</div>
                        )}

                        <div className="text-xs text-gray-400 mt-0.5 ml-4">
                          {[b.city, b.state].filter(Boolean).join(", ")}
                          {b.distanceMiles != null && ` · ${b.distanceMiles} mi`}
                        </div>

                        {b.email && expandedId !== b.id && (
                          <div className="text-xs text-gray-400 ml-4 truncate">{b.email}</div>
                        )}

                        {/* Expanded details */}
                        {expandedId === b.id && (
                          <div className="mt-2 ml-4 space-y-1">
                            {b.address && (
                              <div className="text-xs text-gray-600">
                                {[b.address, b.city, b.state, b.zip].filter(Boolean).join(", ")}
                              </div>
                            )}
                            {b.phone && (
                              <div className="text-xs text-gray-600">
                                <span className="text-gray-400">Phone: </span>{b.phone}
                              </div>
                            )}
                            {b.email && (
                              <div className="text-xs text-gray-600 truncate">
                                <span className="text-gray-400">Email: </span>
                                <a
                                  href={`mailto:${b.email}`}
                                  className="text-blue-600 hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {b.email}
                                </a>
                              </div>
                            )}
                            {b.website && (
                              <div className="text-xs truncate">
                                <a
                                  href={b.website.startsWith("http") ? b.website : `https://${b.website}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {b.website}
                                </a>
                              </div>
                            )}
                            {b.ein && (
                              <div className="text-xs text-gray-400">EIN: {b.ein}</div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex-none">
                        {b.approvalStatus === "APPROVED" ? (
                          <span className="inline-block px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                            Approved
                          </span>
                        ) : b.approvalStatus === "PENDING" ? (
                          <span className="inline-block px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full">
                            Pending
                          </span>
                        ) : approveConfirm === b.id ? (
                          <div className="flex gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleApprove(b.id); }}
                              disabled={approving === b.id}
                              className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                              {approving === b.id ? "..." : "Confirm"}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setApproveConfirm(null); }}
                              className="px-2 py-0.5 text-xs border border-gray-300 text-gray-600 rounded hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); setApproveConfirm(b.id); }}
                            className="px-2 py-0.5 text-xs border border-blue-300 text-blue-600 rounded hover:bg-blue-50"
                          >
                            + Approve
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
