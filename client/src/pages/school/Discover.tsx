import { useEffect, useState, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-markercluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
// @ts-ignore — CSS-only export, no type declarations needed
import "react-leaflet-markercluster/styles";

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

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/(?:^|[\s-])\w/g, (w) => w.toUpperCase());
}

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

interface MapTarget {
  lat: number;
  lng: number;
  zoom?: number; // if omitted → keep current zoom (with soft minimum of 14)
}

function MapController({ target }: { target: MapTarget | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      const zoom = target.zoom !== undefined
        ? target.zoom
        : Math.min(Math.max(map.getZoom(), 14), 15);
      map.flyTo([target.lat, target.lng], zoom, { duration: 0.6 });
    }
  }, [target, map]);
  return null;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BeneficiaryDiscover({ embedded = false }: { embedded?: boolean }) {
  const [school, setSchool] = useState<SchoolLocation | null>(null);
  const [beneficiaries, setBeneficiaries] = useState<NearbyBeneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [radius, setRadius] = useState(10);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [mapTarget, setMapTarget] = useState<MapTarget | null>(null);

  const [geocodingInProgress, setGeocodingInProgress] = useState(false);
  const [total, setTotal] = useState<number | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [approving, setApproving] = useState<string | null>(null);
  const [approveConfirm, setApproveConfirm] = useState<string | null>(null);

  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const hoverCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Load data ─────────────────────────────────────────────────────────────

  const loadData = useCallback(async (schoolData: SchoolLocation) => {
    if (!schoolData.latitude || !schoolData.longitude) return;
    setLoading(true);
    try {
      const categoryParam =
        selectedCategory !== "All" ? `&category=${encodeURIComponent(selectedCategory)}` : "";
      const data = await api.get<{ items: NearbyBeneficiary[]; total: number; geocodingInProgress: boolean }>(
        `/beneficiaries/directory/nearby?lat=${schoolData.latitude}&lng=${schoolData.longitude}&radius=${radius}&limit=500${categoryParam}`
      );
      setBeneficiaries(data.items);
      setTotal(data.total ?? null);
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
      (b.city || "").toLowerCase().includes(q) ||
      (b.zip || "").toLowerCase().includes(q)
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

  // ─── Marker click: scroll to card + zoom to building level ────────────────

  const handleMarkerClick = (id: string, lat: number, lng: number) => {
    setHighlightedId(id);
    setExpandedId(id);
    setMapTarget({ lat, lng, zoom: 18 });
    const card = cardRefs.current[id];
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  // ─── Card hover: highlight marker, pan map (no zoom change) ───────────────

  const handleCardHover = (b: NearbyBeneficiary) => {
    setHighlightedId(b.id);
    setMapTarget({ lat: b.latitude, lng: b.longitude });
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
        <div className="text-[var(--text-sec)]">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[var(--er-t)]">{error}</div>
      </div>
    );
  }

  const noCoords = school && (!school.latitude || !school.longitude);

  return (
    <div className="flex flex-col" style={{ height: embedded ? "calc(100vh - 220px)" : "calc(100vh - 56px)", overflow: "hidden" }}>
      {!embedded && (
        <div className="flex-none px-4 py-3 bg-[var(--surface)] border-b border-[var(--border)]">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h1 className="text-[20px] font-semibold text-[var(--text)]">Discover Community Partners</h1>
              <p className="text-sm text-[var(--text-sec)]">Find and approve organizations near your school</p>
            </div>
            <div className="text-sm text-[var(--text-sec)]">
              {loading
                ? "Loading..."
                : searchQuery
                ? `${filtered.length} of ${total ?? beneficiaries.length} partners`
                : total != null && beneficiaries.length < total
                ? `Showing ${beneficiaries.length} of ${total} partners within ${radius} miles`
                : `${total ?? beneficiaries.length} partners within ${radius} miles`}
            </div>
          </div>
        </div>
      )}

      {geocodingInProgress && (
        <div className="flex-none px-4 py-2 bg-[var(--wn-bg)] border-b border-[var(--wn-b)] text-sm text-[var(--wn-t)] flex items-center gap-2">
          <svg className="w-4 h-4 animate-spin flex-none" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
          Building your area map for the first time — partners will appear within a few minutes. Refresh to check progress.
        </div>
      )}

      {noCoords ? (
        <div className="flex items-center justify-center flex-1 bg-[var(--surface-alt)]">
          <div className="text-center max-w-sm p-8">
            <div className="w-16 h-16 rounded-full bg-[var(--in-bg)] border border-blue-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-[var(--text)] mb-2">Add your school address</h2>
            <p className="text-sm text-[var(--text-sec)] mb-5 leading-relaxed">
              Set your school's address in Settings to discover nearby community partners on the map.
            </p>
            <a
              href="/settings"
              className="inline-block h-[34px] px-4 bg-[var(--action)] text-white rounded-[2px] text-[13px] font-medium text-sm font-medium hover:bg-[var(--navy)] transition-colors"
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
                    <div className="text-xs text-[var(--text-sec)]">Your school</div>
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
                    click: () => handleMarkerClick(b.id, b.latitude, b.longitude),
                    mouseover: (e) => {
                      if (hoverCloseTimerRef.current) clearTimeout(hoverCloseTimerRef.current);
                      e.target.openPopup();
                      setHighlightedId(b.id);
                    },
                    mouseout: (e) => {
                      hoverCloseTimerRef.current = setTimeout(() => {
                        e.target.closePopup();
                      }, 120);
                    },
                  }}
                >
                  <Popup closeButton={false} autoPan={false}>
                    <div style={{ minWidth: "200px", maxWidth: "260px", fontFamily: "inherit" }}>
                      <div style={{ fontWeight: 600, fontSize: "13px", lineHeight: "1.3", marginBottom: "4px" }}>
                        {b.name}
                      </div>
                      {b.category && (
                        <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "6px" }}>{b.category}</div>
                      )}
                      {b.address && (
                        <div style={{ fontSize: "11px", color: "#374151" }}>{b.address}</div>
                      )}
                      <div style={{ fontSize: "11px", color: "#374151" }}>
                        {[b.city, b.state, b.zip].filter(Boolean).join(", ")}
                      </div>
                      <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "4px" }}>
                        {b.distanceMiles} mi away
                      </div>
                      {b.phone && (
                        <div style={{ fontSize: "11px", color: "#374151", marginTop: "4px" }}>
                          📞 {b.phone}
                        </div>
                      )}
                      {b.email && (
                        <div style={{ fontSize: "11px", color: "#374151" }}>
                          ✉ {b.email}
                        </div>
                      )}
                      {b.approvalStatus === "APPROVED" && (
                        <div style={{ fontSize: "11px", color: "#2563eb", fontWeight: 600, marginTop: "6px" }}>
                          ✓ Approved partner
                        </div>
                      )}
                      <div style={{ fontSize: "10px", color: "#9ca3af", marginTop: "6px", borderTop: "1px solid #f3f4f6", paddingTop: "4px" }}>
                        Click to view details
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
              </MarkerClusterGroup>
            </MapContainer>
          </div>

          {/* List pane */}
          <div className="flex-none w-80 xl:w-96 flex flex-col border-l border-[var(--border)] bg-[var(--surface)] overflow-hidden">
            {/* Filters */}
            <div className="flex-none p-3 border-b border-[var(--border)] space-y-2">
              {/* Search */}
              <input
                type="text"
                placeholder="Search name, category, city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:ring-1 focus:ring-[var(--action)]"
              />

              {/* Radius */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-sec)] whitespace-nowrap">Radius:</span>
                <div className="flex gap-1 flex-wrap">
                  {RADIUS_OPTIONS.map((r) => (
                    <button
                      key={r}
                      onClick={() => setRadius(r)}
                      className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                        radius === r
                          ? "bg-[var(--action)] text-white border-[var(--action)]"
                          : "border-[var(--border-s)] text-[var(--text-sec)] hover:border-blue-400"
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
                        ? "bg-[var(--action)] text-white border-[var(--action)]"
                        : "border-[var(--border-s)] text-[var(--text-sec)] hover:border-blue-400"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="flex-none px-3 py-2 border-b border-[var(--border)] bg-[var(--surface-alt)]">
              <div className="text-xs text-[var(--text-faint)] mb-1.5 font-medium">Map legend</div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {Object.entries(CATEGORY_COLORS).slice(0, 8).map(([cat, color]) => (
                  <div key={cat} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full flex-none" style={{ backgroundColor: color }} />
                    <span className="text-xs text-[var(--text-sec)]">{cat}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full flex-none bg-[var(--border-s)]" />
                  <span className="text-xs text-[var(--text-sec)]">Other</span>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-1.5">
                <div className="flex items-center gap-1">
                  <div className="relative w-4 h-4">
                    <div className="w-3.5 h-3.5 rounded-full bg-[var(--in-bg)]0 border-2 border-white" />
                    <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[var(--action)] rounded-full flex items-center justify-center text-white text-[7px]">✓</div>
                  </div>
                  <span className="text-xs text-[var(--text-sec)]">Approved</span>
                </div>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-32 text-[var(--text-faint)] text-sm">
                  Loading nearby partners...
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-[var(--text-faint)] text-sm text-center px-4">
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
                      setMapTarget({ lat: b.latitude, lng: b.longitude, zoom: 18 });
                      setExpandedId(expandedId === b.id ? null : b.id);
                    }}
                    className={`p-3 border-b border-[var(--border)] cursor-pointer transition-colors ${
                      expandedId === b.id
                        ? "bg-[var(--in-bg)] border-l-2 border-l-blue-500"
                        : highlightedId === b.id
                        ? "bg-[var(--in-bg)]"
                        : "hover:bg-[var(--surface-alt)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-none"
                            style={{ backgroundColor: categoryColor(b.category) }}
                          />
                          <span className="font-medium text-sm text-[var(--text)] truncate">
                            {toTitleCase(b.name)}
                          </span>
                          {b.approvalStatus === "APPROVED" && (
                            <span className="flex-none text-xs bg-[var(--in-bg)] text-[var(--action)] px-1.5 py-0.5 rounded font-medium">✓ Partner</span>
                          )}
                        </div>

                        {b.category && (
                          <div className="text-xs text-[var(--text-sec)] mt-0.5 ml-4">{b.category}</div>
                        )}

                        <div className="text-xs text-[var(--text-faint)] mt-0.5 ml-4">
                          {[b.city ? toTitleCase(b.city) : null, b.state].filter(Boolean).join(", ")}
                          {b.distanceMiles != null && ` · ${b.distanceMiles} mi`}
                        </div>

                        {b.email && expandedId !== b.id && (
                          <div className="text-xs text-[var(--text-faint)] ml-4 truncate">{b.email}</div>
                        )}

                        {/* Expanded details */}
                        {expandedId === b.id && (
                          <div className="mt-2 ml-4 space-y-1">
                            {b.address && (
                              <div className="text-xs text-[var(--text-sec)]">
                                {[b.address, b.city, b.state, b.zip].filter(Boolean).join(", ")}
                              </div>
                            )}
                            {b.phone && (
                              <div className="text-xs text-[var(--text-sec)]">
                                <span className="text-[var(--text-faint)]">Phone: </span>{b.phone}
                              </div>
                            )}
                            {b.email && (
                              <div className="text-xs text-[var(--text-sec)] truncate">
                                <span className="text-[var(--text-faint)]">Email: </span>
                                <a
                                  href={`mailto:${b.email}`}
                                  className="text-[var(--action)] hover:underline"
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
                                  className="text-[var(--action)] hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {b.website}
                                </a>
                              </div>
                            )}
                            {b.ein && (
                              <div className="text-xs text-[var(--text-faint)]">EIN: {b.ein}</div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex-none">
                        {b.approvalStatus === "APPROVED" ? (
                          <span className="inline-block px-2 py-0.5 text-xs bg-[var(--in-bg)] text-[var(--action)] rounded-full">
                            Approved
                          </span>
                        ) : b.approvalStatus === "PENDING" ? (
                          <span className="inline-block px-2 py-0.5 text-xs bg-yellow-100 text-[var(--wn-t)] rounded-full">
                            Pending
                          </span>
                        ) : approveConfirm === b.id ? (
                          <div className="flex gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleApprove(b.id); }}
                              disabled={approving === b.id}
                              className="px-2 py-0.5 text-xs bg-[var(--action)] text-white rounded hover:bg-[var(--action)] disabled:opacity-50"
                            >
                              {approving === b.id ? "..." : "Confirm"}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setApproveConfirm(null); }}
                              className="px-2 py-0.5 text-xs border border-[var(--border-s)] text-[var(--text-sec)] rounded hover:bg-[var(--surface-alt)]"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); setApproveConfirm(b.id); }}
                            className="px-2 py-0.5 text-xs border border-[var(--in-b)] text-[var(--action)] rounded hover:bg-[var(--in-bg)]"
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
