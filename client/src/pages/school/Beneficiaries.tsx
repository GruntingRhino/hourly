import { useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";
import SearchableSelect from "../../components/SearchableSelect";
import BeneficiaryDiscover from "./Discover";
import { buildOpportunityCategoryOptions } from "../../lib/opportunityCategories";

function toTitleCase(str: string) {
  return str.toLowerCase().replace(/(?:^|[\s-])\w/g, (w) => w.toUpperCase());
}

interface Beneficiary {
  id: string;
  name: string;
  category: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  zip: string | null;
  phone: string | null;
  website: string | null;
  description: string | null;
  email: string | null;
  visibility: "PUBLIC" | "PRIVATE";
  createdBySchoolId: string | null;
  approvalStatus: string;
  claimed: boolean;
  latestInvitationStatus?: string | null;
  latestInvitationSentTo?: string | null;
  latestInvitationCreatedAt?: string | null;
}

interface DirEntry {
  id: string;
  name: string;
  category: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  zip: string | null;
  description: string | null;
  claimed: boolean;
  distanceMiles?: number;
  approvalStatus: string | null;
}

interface NearbyDirectoryResponse {
  items: DirEntry[];
}

interface BeneficiaryOpportunity {
  id: string;
  title: string;
  category: string | null;
  startDate: string;
  status: string;
  timeSlots: Array<{
    id: string;
    date: string;
    durationHours: number;
    _count: { signups: number };
  }>;
}

interface ApprovedPartnerOpportunity {
  id: string;
  title: string;
  category: string | null;
  location: string | null;
  status: string;
  beneficiary: { id: string; name: string; category: string | null };
  timeSlots: Array<{
    id: string;
    date: string;
    durationHours: number;
    _count: { signups: number };
  }>;
}

const CATEGORIES = [
  "", "Education", "Environment", "Food & Nutrition", "Health",
  "Housing & Shelter", "Human Services", "Youth Development", "Animal Welfare",
  "Community Improvement", "Arts & Culture", "Recreation & Sports",
];

const EMPTY_PARTNER = {
  name: "",
  category: "",
  city: "",
  state: "",
  address: "",
  zip: "",
  email: "",
  phone: "",
  website: "",
  description: "",
  visibility: "PRIVATE" as "PUBLIC" | "PRIVATE",
};

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-[var(--wn-bg)] text-[var(--text)] rounded-sm">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function SchoolBeneficiaries() {
  const { user } = useAuth();
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"pending" | "approved" | "opportunities" | "search" | "map" | "manage">("approved");
  const [searchQuery, setSearchQuery] = useState("");
  const [smartResults, setSmartResults] = useState<DirEntry[]>([]);
  const [smartLoading, setSmartLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [inviteEmail, setInviteEmail] = useState<Record<string, string>>({});
  const [inviteMessage, setInviteMessage] = useState<Record<string, string>>({});
  const [inviting, setInviting] = useState<string | null>(null);
  const [newBen, setNewBen] = useState(EMPTY_PARTNER);
  const [editingBenId, setEditingBenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [csvData, setCsvData] = useState("");
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState<{ added: number; failed: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [schoolLocation, setSchoolLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [proximityRadius, setProximityRadius] = useState(5);
  const [schoolSearchCity, setSchoolSearchCity] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [inviteEmailError, setInviteEmailError] = useState<Record<string, string>>({});
  const [toastMessage, setToastMessage] = useState("");
  const [confirmDrop, setConfirmDrop] = useState<{ benId: string; name: string } | null>(null);
  const [opportunitiesByBeneficiary, setOpportunitiesByBeneficiary] = useState<Record<string, BeneficiaryOpportunity[]>>({});
  const [expandedBeneficiaryId, setExpandedBeneficiaryId] = useState<string | null>(null);
  const [loadingOpportunityId, setLoadingOpportunityId] = useState<string | null>(null);
  const [drawerBeneficiary, setDrawerBeneficiary] = useState<Beneficiary | null>(null);
  const [schoolInviteTemplate, setSchoolInviteTemplate] = useState("");
  const [approvedPartnerOpportunities, setApprovedPartnerOpportunities] = useState<ApprovedPartnerOpportunity[]>([]);
  const [approvedPartnerOpportunitiesLoading, setApprovedPartnerOpportunitiesLoading] = useState(false);
  const [opportunitySearchQuery, setOpportunitySearchQuery] = useState("");
  const [opportunityCategoryFilter, setOpportunityCategoryFilter] = useState("");

  const isAdmin = user?.role === "SCHOOL_ADMIN";

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get<Beneficiary[]>("/beneficiaries?status=ALL");
      setBeneficiaries(data);
    } catch {
      setError("Failed to load beneficiaries.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!user?.schoolId) return;
    api.get<{ partnerInviteTemplate?: string }>(`/schools/${user.schoolId}`)
      .then((school) => setSchoolInviteTemplate(school.partnerInviteTemplate || ""))
      .catch(() => {});
  }, [user?.schoolId]);

  const approved = beneficiaries.filter((b) => b.approvalStatus === "APPROVED");
  const pending = beneficiaries.filter((b) => b.approvalStatus === "PENDING");

  useEffect(() => {
    if (tab === "pending" && pending.length === 0 && !loading) setTab("approved");
  }, [loading, pending.length, tab]);

  const runSmartSearch = async (query: string, category: string, radius: number, loc: { lat: number; lng: number } | null) => {
    setSmartLoading(true);
    try {
      if (loc) {
        const p = new URLSearchParams({ lat: String(loc.lat), lng: String(loc.lng), radius: String(radius) });
        if (query.trim().length >= 2) p.set("q", query.trim());
        if (category) p.set("category", category);
        const response = await api.get<NearbyDirectoryResponse>(`/beneficiaries/directory/nearby?${p}`);
        setSmartResults(response.items);
      } else {
        const p = new URLSearchParams();
        if (query.trim().length >= 2) p.set("search", query.trim());
        if (category) p.set("category", category);
        setSmartResults(await api.get<DirEntry[]>(`/beneficiaries/directory?${p}`));
      }
    } catch {
      setSmartResults([]);
    } finally {
      setSmartLoading(false);
    }
  };

  useEffect(() => {
    if (tab !== "search" || !isAdmin) return;
    const run = async () => {
      let loc = schoolLocation;
      try {
        const fetched = await api.get<{ latitude: number; longitude: number } | null>("/schools/location");
        if (fetched?.latitude && fetched?.longitude) {
          const nextLoc = { lat: fetched.latitude, lng: fetched.longitude };
          setSchoolLocation(nextLoc);
          loc = nextLoc;
        }
      } catch {}
      try {
        if (user?.schoolId && !schoolSearchCity) {
          const school = await api.get<{ city: string | null }>(`/schools/${user.schoolId}`);
          const city = school.city?.trim() || "";
          if (city) {
            setSchoolSearchCity(city);
            setSearchQuery((prev) => prev || city);
          }
        }
      } catch {}
      await runSmartSearch(searchQuery, selectedCategory, proximityRadius, loc);
    };
    void run();
  }, [tab, isAdmin, user?.schoolId, schoolSearchCity]);

  useEffect(() => {
    if (tab !== "search" || !isAdmin) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runSmartSearch(searchQuery, selectedCategory, proximityRadius, schoolLocation);
    }, 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [tab, isAdmin, searchQuery, selectedCategory, proximityRadius, schoolLocation]);

  useEffect(() => {
    if (tab !== "opportunities" || !user?.schoolId) return;
    setApprovedPartnerOpportunitiesLoading(true);
    api.get<ApprovedPartnerOpportunity[]>(`/schools/${user.schoolId}/partner-opportunities`)
      .then((data) => setApprovedPartnerOpportunities(data))
      .catch((err: any) => setError(err.message || "Failed to load approved partner opportunities."))
      .finally(() => setApprovedPartnerOpportunitiesLoading(false));
  }, [tab, user?.schoolId]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  };

  const handleApproveFromDir = async (directoryId: string) => {
    try {
      await api.post("/beneficiaries/approve-from-directory", { directoryId });
      await load();
      setSmartResults((prev) => prev.map((d) => d.id === directoryId ? { ...d, approvalStatus: "PENDING" } : d));
      setTab("pending");
      showToast("Invitation sent. This partner now appears in Pending.");
    } catch (err: any) {
      setError(err.message || "Failed to invite partner.");
    }
  };

  const handleInvite = async (benId: string) => {
    const beneficiary = beneficiaries.find((item) => item.id === benId);
    const email = (inviteEmail[benId]?.trim() || beneficiary?.email || "").trim();
    if (!email) {
      setInviteEmailError((prev) => ({ ...prev, [benId]: "Please enter an email address" }));
      return;
    }
    setInviteEmailError((prev) => ({ ...prev, [benId]: "" }));
    setInviting(benId);
    try {
      await api.post(`/beneficiaries/${benId}/invite`, {
        email,
        message: inviteMessage[benId]?.trim() || schoolInviteTemplate || undefined,
      });
      setInviteEmail((prev) => ({ ...prev, [benId]: "" }));
      setInviteMessage((prev) => ({ ...prev, [benId]: schoolInviteTemplate }));
      await load();
      setTab("pending");
      showToast("Invitation sent.");
    } catch (err: any) {
      setError(err.message || "Failed to send invitation.");
    } finally {
      setInviting(null);
    }
  };

  const handleApprove = async (benId: string) => {
    setApprovingId(benId);
    setBeneficiaries((prev) => prev.map((b) => b.id === benId ? { ...b, approvalStatus: "APPROVED" } : b));
    try {
      await api.post(`/beneficiaries/${benId}/approve`, {});
      await load();
    } catch (err: any) {
      setError(err.message || "Failed to approve.");
      await load();
    } finally {
      setApprovingId(null);
    }
  };

  const handleDrop = async (benId: string, name: string) => {
    setConfirmDrop({ benId, name });
  };

  const confirmDropAction = async () => {
    if (!confirmDrop) return;
    const { benId } = confirmDrop;
    setConfirmDrop(null);
    try {
      await api.post(`/beneficiaries/${benId}/drop`);
      await load();
      showToast("Partner removed.");
    } catch (err: any) {
      setError(err.message || "Failed to remove partner.");
    }
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvData((ev.target?.result as string) || "");
    reader.readAsText(file);
  };

  const handleCsvImport = async () => {
    if (!csvData.trim()) return;
    setCsvImporting(true);
    setCsvResult(null);
    try {
      const result = await api.post<{ added: number; failed: number; errors: string[] }>("/beneficiaries/import-csv", { csvData });
      setCsvResult(result);
      setCsvData("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await load();
      setTab("pending");
    } catch (err: any) {
      setError(err.message || "CSV import failed.");
    } finally {
      setCsvImporting(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      if (editingBenId) {
        await api.put(`/beneficiaries/${editingBenId}`, newBen);
        showToast("Partner updated.");
      } else {
        await api.post("/beneficiaries", newBen);
        showToast("Partner created in Pending.");
      }
      setNewBen(EMPTY_PARTNER);
      setEditingBenId(null);
      await load();
      setTab("pending");
    } catch (err: any) {
      setError(err.message || "Failed to save partner.");
    } finally {
      setCreating(false);
    }
  };

  const beginEdit = (beneficiary: Beneficiary) => {
    setEditingBenId(beneficiary.id);
    setNewBen({
      name: beneficiary.name,
      category: beneficiary.category || "",
      city: beneficiary.city || "",
      state: beneficiary.state || "",
      address: beneficiary.address || "",
      zip: beneficiary.zip || "",
      email: beneficiary.email || "",
      phone: beneficiary.phone || "",
      website: beneficiary.website || "",
      description: beneficiary.description || "",
      visibility: beneficiary.visibility,
    });
    setTab("manage");
  };

  const loadOpportunities = async (beneficiaryId: string) => {
    if (opportunitiesByBeneficiary[beneficiaryId]) {
      const nextId = expandedBeneficiaryId === beneficiaryId ? null : beneficiaryId;
      setExpandedBeneficiaryId(nextId);
      setDrawerBeneficiary(nextId ? beneficiaries.find((item) => item.id === beneficiaryId) ?? null : null);
      return;
    }
    setLoadingOpportunityId(beneficiaryId);
    try {
      const data = await api.get<BeneficiaryOpportunity[]>(`/beneficiaries/${beneficiaryId}/opportunities`);
      setOpportunitiesByBeneficiary((prev) => ({ ...prev, [beneficiaryId]: data }));
      setExpandedBeneficiaryId(beneficiaryId);
      setDrawerBeneficiary(beneficiaries.find((item) => item.id === beneficiaryId) ?? null);
    } catch (err: any) {
      setError(err.message || "Failed to load partner opportunities.");
    } finally {
      setLoadingOpportunityId(null);
    }
  };

  const renderPartnerCard = (beneficiary: Beneficiary, mode: "pending" | "approved") => {
    const isSchoolCreated = beneficiary.createdBySchoolId === user?.schoolId;
    const isSelfPartner = isSchoolCreated && beneficiary.visibility === "PRIVATE" && beneficiary.name === user?.school?.name;
    const canEdit = isAdmin && isSchoolCreated;
    const showRemove = isAdmin && !isSelfPartner;

    return (
      <div key={beneficiary.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-4">
        <div className="flex justify-between items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="font-medium">{toTitleCase(beneficiary.name)}</div>
            <div className="text-sm text-[var(--text-sec)]">
              {[beneficiary.category, beneficiary.city ? toTitleCase(beneficiary.city) : null, beneficiary.state].filter(Boolean).join(" · ")}
            </div>
            {beneficiary.description && (
              <p className="mt-2 text-sm text-[var(--text-sec)] whitespace-pre-wrap">{beneficiary.description}</p>
            )}
            {beneficiary.latestInvitationStatus && (
              <div className="mt-2 text-xs text-[var(--action)]">
                Invitation {beneficiary.latestInvitationStatus.toLowerCase()}
                {beneficiary.latestInvitationSentTo ? ` · ${beneficiary.latestInvitationSentTo}` : ""}
              </div>
            )}
            {isSelfPartner && (
              <div className="mt-2 rounded-[2px] border border-[var(--in-b)] bg-[var(--in-bg)] px-3 py-2 text-xs text-[var(--action)]">
                This Partner account is used for tracking volunteer opportunities within the school.
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {beneficiary.claimed && <span className="text-xs bg-[var(--ok-bg)] text-[var(--ok-t)] px-2 py-0.5 rounded">Registered</span>}
            {canEdit && (
              <button onClick={() => beginEdit(beneficiary)} className="text-xs text-[var(--action)] hover:text-[var(--navy)]">
                Edit
              </button>
            )}
            {showRemove && (
              <button onClick={() => handleDrop(beneficiary.id, beneficiary.name)} className="text-xs text-[var(--er-t)] hover:text-[var(--er-t)]">
                Remove
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => void loadOpportunities(beneficiary.id)}
            className="px-3 py-1.5 border border-[var(--border-s)] rounded text-xs hover:bg-[var(--surface-alt)]"
          >
            {expandedBeneficiaryId === beneficiary.id ? "Hide Opportunities" : "View Opportunities"}
          </button>
          {mode === "pending" && isAdmin && (
            <button
              onClick={() => handleApprove(beneficiary.id)}
              disabled={approvingId === beneficiary.id}
              className="px-3 py-1.5 bg-[var(--ok-t)] text-white rounded text-xs hover:bg-[var(--ok-t)] disabled:opacity-50"
            >
              {approvingId === beneficiary.id ? "..." : "Approve"}
            </button>
          )}
        </div>

        {isAdmin && !beneficiary.claimed && mode !== "approved" && (
          <div className="mt-3">
            <div className="flex gap-2">
              <input
                type="email"
                value={inviteEmail[beneficiary.id] ?? beneficiary.email ?? ""}
                onChange={(e) => {
                  setInviteEmail((prev) => ({ ...prev, [beneficiary.id]: e.target.value }));
                  setInviteEmailError((prev) => ({ ...prev, [beneficiary.id]: "" }));
                }}
                placeholder="Email to send invitation"
                className={`flex-1 px-3 py-1.5 border rounded text-xs ${inviteEmailError[beneficiary.id] ? "border-red-400" : "border-[var(--border-s)]"}`}
              />
              <button
                onClick={() => handleInvite(beneficiary.id)}
                disabled={inviting === beneficiary.id}
                className="px-3 py-1.5 bg-[var(--action)] text-white rounded text-xs hover:bg-[var(--action)] disabled:opacity-50"
              >
                {inviting === beneficiary.id ? "Sending..." : beneficiary.latestInvitationStatus === "PENDING" ? "Resend Invite" : "Send Invite"}
              </button>
            </div>
            <textarea
              value={inviteMessage[beneficiary.id] ?? schoolInviteTemplate}
              onChange={(e) => setInviteMessage((prev) => ({ ...prev, [beneficiary.id]: e.target.value }))}
              rows={3}
              className="mt-2 w-full px-3 py-2 border border-[var(--border-s)] rounded text-xs"
              placeholder="Optional custom message for this partner"
            />
            {inviteEmailError[beneficiary.id] && <p className="mt-1 text-xs text-[var(--er-t)]">{inviteEmailError[beneficiary.id]}</p>}
          </div>
        )}

        {confirmDrop?.benId === beneficiary.id && (
          <div className="mt-3 rounded-[3px] border border-[var(--border-s)] bg-[var(--surface)] p-3 ">
            <p className="text-sm text-[var(--text)] mb-2">Remove <strong>{toTitleCase(confirmDrop.name)}</strong> from your partner list?</p>
            <div className="flex gap-2">
              <button onClick={confirmDropAction} className="px-3 py-1.5 bg-[var(--er-t)] text-white rounded text-xs hover:bg-[var(--er-t)]">Remove</button>
              <button onClick={() => setConfirmDrop(null)} className="px-3 py-1.5 border border-[var(--border-s)] rounded text-xs hover:bg-[var(--surface-alt)]">Cancel</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const opportunityCategoryOptions = buildOpportunityCategoryOptions(
    approvedPartnerOpportunities.map((opportunity) => opportunity.category),
  );
  const filteredApprovedPartnerOpportunities = approvedPartnerOpportunities.filter((opportunity) => {
    if (opportunityCategoryFilter && (opportunity.category || "") !== opportunityCategoryFilter) return false;
    if (!opportunitySearchQuery.trim()) return true;
    const q = opportunitySearchQuery.trim().toLowerCase();
    return (
      opportunity.title.toLowerCase().includes(q) ||
      opportunity.beneficiary.name.toLowerCase().includes(q) ||
      (opportunity.location?.toLowerCase().includes(q) ?? false) ||
      (opportunity.category?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-[20px] font-semibold">Community Partners</h1>
        <div className="flex items-center gap-3">
          {pending.length > 0 && <span className="text-xs bg-[var(--wn-bg)] text-[var(--wn-t)] px-2 py-0.5 rounded-full">{pending.length} pending</span>}
          <span className="text-sm text-[var(--text-sec)]">{approved.length} approved</span>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-[var(--er-bg)] border border-[var(--er-b)] rounded text-[var(--er-t)] text-sm">{error}</div>}
      {toastMessage && <div className="mb-4 p-3 bg-[var(--ok-bg)] border border-[var(--ok-b)] rounded text-[var(--ok-t)] text-sm">{toastMessage}</div>}

      <div className="flex gap-4 border-b mb-6 flex-wrap">
        {[
          ...(pending.length > 0 ? [{ key: "pending", label: `Pending Partners (${pending.length})` }] : []),
          { key: "approved", label: "Approved" },
          { key: "opportunities", label: "Approved Opportunities" },
          ...(isAdmin ? [
            { key: "search", label: "Add from Directory" },
            { key: "map", label: "Add from Map" },
            { key: "manage", label: editingBenId ? "Edit Custom" : "Create Custom + CSV" },
          ] : []),
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key as typeof tab)}
            className={`pb-2 text-sm font-medium border-b-2 ${tab === item.key ? "border-[var(--action)] text-[var(--action)]" : "border-transparent text-[var(--text-sec)] hover:text-[var(--text)]"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "pending" && (
        pending.length === 0 ? (
          <div className="bg-[var(--surface-alt)] border border-[var(--border)] rounded-[3px] p-8 text-center text-[var(--text-sec)]">
            No pending organization requests.
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((beneficiary) => renderPartnerCard(beneficiary, "pending"))}
          </div>
        )
      )}

      {tab === "approved" && (
        loading ? <div className="text-[var(--text-sec)] text-sm">Loading...</div> : approved.length === 0 ? (
          <div className="bg-[var(--surface-alt)] border border-[var(--border)] rounded-[3px] p-8 text-center text-[var(--text-sec)]">
            No approved community partners yet. Add from the directory or create a custom one.
          </div>
        ) : (
          <div className="space-y-3">
            {approved.map((beneficiary) => renderPartnerCard(beneficiary, "approved"))}
          </div>
        )
      )}

      {tab === "search" && isAdmin && (
        <div>
          <div className="flex gap-2 mb-3 items-center">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, city, or zip code..."
                className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm pr-8"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text-sec)]" aria-label="Clear">
                  ×
                </button>
              )}
            </div>
            <select value={proximityRadius} onChange={(e) => setProximityRadius(Number(e.target.value))} className="px-2 py-2 border border-[var(--border-s)] rounded-[2px] text-sm">
              <option value={5}>5 mi</option>
              <option value={10}>10 mi</option>
              <option value={15}>15 mi</option>
              <option value={25}>25 mi</option>
            </select>
          </div>

          <div className="flex gap-2 mb-4 flex-wrap">
            {CATEGORIES.map((category) => (
              <button
                key={category || "all"}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  selectedCategory === category ? "bg-[var(--action)] text-white border-[var(--action)]" : "bg-[var(--surface)] text-[var(--text-sec)] border-[var(--border-s)] hover:border-[var(--border-s)]"
                }`}
              >
                {category || "All"}
              </button>
            ))}
          </div>

          {smartLoading ? (
            <div className="text-[var(--text-faint)] text-sm py-4">Searching...</div>
          ) : smartResults.length > 0 ? (
            <div className="border border-[var(--border)] rounded-[3px] divide-y">
              {smartResults.map((entry) => (
                <div key={entry.id} className="px-4 py-3 flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{highlightMatch(entry.name, searchQuery)}</div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {entry.category && <span className="text-xs bg-[var(--surface-alt)] text-[var(--text-sec)] px-2 py-0.5 rounded-full">{entry.category}</span>}
                      {entry.distanceMiles != null && <span className="text-xs text-[var(--action)]">{entry.distanceMiles.toFixed(1)} mi</span>}
                      <span className="text-xs text-[var(--text-faint)]">{[entry.city, entry.state].filter(Boolean).join(", ")}</span>
                    </div>
                    {entry.description && <div className="text-xs text-[var(--text-sec)] mt-0.5 line-clamp-1">{entry.description}</div>}
                  </div>
                  <div className="shrink-0">
                    {entry.approvalStatus === "APPROVED" ? (
                      <span className="text-xs bg-[var(--ok-bg)] text-[var(--ok-t)] px-2 py-1 rounded font-medium">Approved ✓</span>
                    ) : entry.approvalStatus === "PENDING" ? (
                      <span className="text-xs bg-[var(--in-bg)] text-[var(--action)] px-2 py-1 rounded font-medium">Pending invite</span>
                    ) : (
                      <button onClick={() => handleApproveFromDir(entry.id)} className="px-3 py-1.5 bg-[var(--ok-t)] text-white rounded text-xs hover:bg-[var(--ok-t)]">
                        Invite
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[var(--text-sec)] text-sm py-4">
              No results. Try a different category or search term.
              {schoolLocation && " You can also try a larger radius."}
            </div>
          )}
        </div>
      )}

      {tab === "opportunities" && (
        <div>
          <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_280px]">
            <input
              type="text"
              value={opportunitySearchQuery}
              onChange={(e) => setOpportunitySearchQuery(e.target.value)}
              placeholder="Search approved opportunities or partners..."
              className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm"
            />
            <SearchableSelect
              value={opportunityCategoryFilter}
              onChange={setOpportunityCategoryFilter}
              options={opportunityCategoryOptions}
              placeholder="Filter by category"
              clearable
              className="w-full px-3 py-2 pr-8 border border-[var(--border-s)] rounded-[2px] text-sm"
            />
          </div>

          {approvedPartnerOpportunitiesLoading ? (
            <div className="text-[var(--text-sec)] text-sm">Loading opportunities...</div>
          ) : filteredApprovedPartnerOpportunities.length === 0 ? (
            <div className="bg-[var(--surface-alt)] border border-[var(--border)] rounded-[3px] p-8 text-center text-[var(--text-sec)]">
              No approved partner opportunities match the current filters.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredApprovedPartnerOpportunities.map((opportunity) => {
                const signupCount = opportunity.timeSlots.reduce((sum, slot) => sum + slot._count.signups, 0);
                return (
                  <div key={opportunity.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-[var(--text)]">{opportunity.title}</div>
                        <div className="mt-1 text-sm text-[var(--text-sec)]">
                          {opportunity.beneficiary.name}
                          {opportunity.location ? ` · ${opportunity.location}` : ""}
                        </div>
                        <div className="mt-1 text-xs text-[var(--text-sec)]">
                          {opportunity.category || "Uncategorized"} · {opportunity.timeSlots.length} slot{opportunity.timeSlots.length !== 1 ? "s" : ""} · {signupCount} signup{signupCount !== 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 space-y-1">
                      {opportunity.timeSlots.slice(0, 6).map((slot) => (
                        <div key={slot.id} className="text-xs text-[var(--text-sec)]">
                          {new Date(slot.date).toLocaleDateString()} · {slot.durationHours}h · {slot._count.signups} signup{slot._count.signups !== 1 ? "s" : ""}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "map" && isAdmin && <BeneficiaryDiscover embedded />}

      {tab === "manage" && isAdmin && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="max-w-3xl">
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-1">Organization Name *</label>
                  <input type="text" value={newBen.name} onChange={(e) => setNewBen((prev) => ({ ...prev, name: e.target.value }))} required className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-1">Category</label>
                  <input type="text" value={newBen.category} onChange={(e) => setNewBen((prev) => ({ ...prev, category: e.target.value }))} className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-1">Email</label>
                  <input type="email" value={newBen.email} onChange={(e) => setNewBen((prev) => ({ ...prev, email: e.target.value }))} className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-1">Phone</label>
                  <input type="text" value={newBen.phone} onChange={(e) => setNewBen((prev) => ({ ...prev, phone: e.target.value }))} className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-1">Website</label>
                  <input type="text" value={newBen.website} onChange={(e) => setNewBen((prev) => ({ ...prev, website: e.target.value }))} className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-1">Visibility</label>
                  <select value={newBen.visibility} onChange={(e) => setNewBen((prev) => ({ ...prev, visibility: e.target.value as "PUBLIC" | "PRIVATE" }))} className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm">
                    <option value="PRIVATE">Private (this school only)</option>
                    <option value="PUBLIC">Public (submit for global directory)</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-[var(--text)] mb-1">Address</label>
                  <input type="text" value={newBen.address} onChange={(e) => setNewBen((prev) => ({ ...prev, address: e.target.value }))} className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-1">City</label>
                  <input type="text" value={newBen.city} onChange={(e) => setNewBen((prev) => ({ ...prev, city: e.target.value }))} className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text)] mb-1">State</label>
                    <input type="text" value={newBen.state} onChange={(e) => setNewBen((prev) => ({ ...prev, state: e.target.value }))} maxLength={2} className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text)] mb-1">ZIP</label>
                    <input type="text" value={newBen.zip} onChange={(e) => setNewBen((prev) => ({ ...prev, zip: e.target.value }))} className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">Description</label>
                <textarea value={newBen.description} onChange={(e) => setNewBen((prev) => ({ ...prev, description: e.target.value }))} rows={3} className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm" />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={creating} className="px-4 py-[7px] bg-[var(--action)] text-white rounded-[2px] text-sm hover:opacity-85 disabled:opacity-50">
                  {creating ? "Saving..." : editingBenId ? "Save Changes" : "Create Partner"}
                </button>
                {editingBenId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingBenId(null);
                      setNewBen(EMPTY_PARTNER);
                    }}
                    className="px-4 py-[7px] border border-[var(--border-s)] rounded-[2px] text-sm hover:bg-[var(--surface-alt)]"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="rounded-[3px] border border-[var(--border)] bg-[var(--surface-alt)] p-4">
            <h2 className="font-semibold mb-2">Bulk Upload Community Partners</h2>
            <p className="text-sm text-[var(--text-sec)] mb-4">
              Upload a CSV with columns aligned to the custom form:
              <code className="ml-1 rounded bg-[var(--surface)] px-1 py-0.5 text-xs">name,category,email,phone,website,address,city,state,zip,description,visibility</code>
            </p>

            {csvResult && (
              <div className={`mb-4 p-3 rounded border text-sm ${csvResult.failed > 0 ? "bg-[var(--wn-bg)] border-[var(--wn-b)]" : "bg-[var(--ok-bg)] border-[var(--ok-b)]"}`}>
                <div><strong>{csvResult.added}</strong> partners added, <strong>{csvResult.failed}</strong> failed.</div>
                {csvResult.errors.length > 0 && (
                  <ul className="mt-2 text-xs text-[var(--er-t)] space-y-0.5">
                    {csvResult.errors.slice(0, 8).map((entry, index) => <li key={index}>{entry}</li>)}
                  </ul>
                )}
              </div>
            )}

            <div className="space-y-3">
              <input ref={fileInputRef} type="file" accept=".csv" onChange={handleCsvFileUpload} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 border border-[var(--border-s)] rounded-[2px] text-sm hover:bg-white">
                Choose CSV File
              </button>
              {csvData && (
                <button onClick={handleCsvImport} disabled={csvImporting} className="block px-4 py-[7px] bg-[var(--action)] text-white rounded-[2px] text-sm hover:opacity-85 disabled:opacity-50">
                  {csvImporting ? "Importing..." : "Import Partners"}
                </button>
              )}
            </div>

            <div className="mt-6 rounded bg-[var(--surface)] p-3 text-xs text-[var(--text-sec)]">
              <p className="font-medium mb-1">CSV Example</p>
              <pre className="overflow-x-auto">name,category,email,phone,website,address,city,state,zip,description,visibility{"\n"}Green Earth,Environment,team@greenearth.org,6175551234,https://greenearth.org,123 Main St,Boston,MA,02110,Environmental org,PRIVATE</pre>
            </div>
          </div>
        </div>
      )}

      {drawerBeneficiary && (
        <div className="fixed top-[54px] inset-x-0 bottom-0 z-[45] bg-black/30">
          <div className="absolute inset-y-0 right-0 w-full max-w-xl bg-[var(--surface)] shadow-2xl border-l border-[var(--border)]">
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[var(--border)]">
              <div>
                <div className="font-semibold text-[var(--text)]">{toTitleCase(drawerBeneficiary.name)}</div>
                <div className="text-sm text-[var(--text-sec)]">Partner opportunities</div>
              </div>
              <button onClick={() => { setDrawerBeneficiary(null); setExpandedBeneficiaryId(null); }} className="text-sm text-[var(--text-sec)] hover:text-[var(--text)]">
                Close
              </button>
            </div>
            <div className="p-5 overflow-y-auto h-[calc(100%-73px)]">
              {loadingOpportunityId === drawerBeneficiary.id ? (
                <div className="text-sm text-[var(--text-sec)]">Loading opportunities...</div>
              ) : !opportunitiesByBeneficiary[drawerBeneficiary.id] || opportunitiesByBeneficiary[drawerBeneficiary.id].length === 0 ? (
                <div className="text-sm text-[var(--text-sec)]">No opportunities published yet.</div>
              ) : (
                <div className="space-y-3">
                  {opportunitiesByBeneficiary[drawerBeneficiary.id].map((opportunity) => {
                    const signupCount = opportunity.timeSlots.reduce((sum, slot) => sum + slot._count.signups, 0);
                    return (
                      <div key={opportunity.id} className="rounded-[3px] border border-[var(--border)] p-4">
                        <div className="font-medium text-[var(--text)]">{opportunity.title}</div>
                        <div className="mt-1 text-xs text-[var(--text-sec)]">
                          {opportunity.category || "General"} · {opportunity.timeSlots.length} slot{opportunity.timeSlots.length !== 1 ? "s" : ""} · {signupCount} signup{signupCount !== 1 ? "s" : ""}
                        </div>
                        <div className="mt-2 space-y-1">
                          {opportunity.timeSlots.slice(0, 6).map((slot) => (
                            <div key={slot.id} className="text-xs text-[var(--text-sec)]">
                              {new Date(slot.date).toLocaleDateString()} · {slot.durationHours}h · {slot._count.signups} signup{slot._count.signups !== 1 ? "s" : ""}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
