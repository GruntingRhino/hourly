import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";

interface TimeSlotBasic {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity: number | null;
  _count?: { signups: number };
}

interface Opportunity {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  requirementsNote: string | null;
  schoolRestrictions: string | null;
  status: string;
  timeSlots: TimeSlotBasic[];
}

interface SignupRecord {
  id: string;
  status: string;
  verificationStatus: string;
  checkedIn: boolean;
  checkedOut: boolean;
  totalHours: number | null;
  rejectionReason: string | null;
  slot: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    durationHours: number;
    opportunity: { title: string };
  };
  student: { label: string };
}

interface ApprovedSchool {
  id: string;
  name: string;
}

interface VerificationHistoryEntry {
  id: string;
  action: string;
  details: string | null;
  createdAt: string;
  actor: { id: string; name: string; role: string };
}

interface SignupHistoryResponse {
  signup: {
    id: string;
    status: string;
    verificationStatus: string;
    totalHours: number | null;
    rejectionReason: string | null;
    student: { id?: string; label: string } | null;
    slot: {
      date: string;
      startTime: string;
      endTime: string;
      durationHours: number;
      opportunity: {
        title: string;
        category: string | null;
        beneficiary: { id: string; name: string; category: string | null };
      };
    };
  };
  history: VerificationHistoryEntry[];
}

function calcDurationHours(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
}

function getDisplayStatus(timeSlots: TimeSlotBasic[]): string {
  if (!timeSlots.length) return "Active";
  const today = new Date().toISOString().split("T")[0];
  let allPast = true;
  let allFuture = true;
  for (const slot of timeSlots) {
    const slotDate = new Date(slot.date).toISOString().split("T")[0];
    if (slotDate > today) allPast = false;
    else if (slotDate < today) allFuture = false;
    else { allPast = false; allFuture = false; }
  }
  if (allPast) return "Expired";
  if (allFuture) return "Upcoming";
  return "Active";
}

const emptyForm = {
  title: "",
  description: "",
  location: "",
  requirementsNote: "",
  slots: [{ date: "", startTime: "", endTime: "", capacity: "" }],
};

export default function BeneficiaryOpportunities() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"opportunities" | "signups">("opportunities");
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [signups, setSignups] = useState<SignupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [signupsLoading, setSignupsLoading] = useState(false);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<{ [id: string]: string }>({});
  const [filterOpen, setFilterOpen] = useState(false);
  const [visibleStatuses, setVisibleStatuses] = useState<string[]>(["Active", "Upcoming"]);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [noShowConfirmId, setNoShowConfirmId] = useState<string | null>(null);
  const [noShowId, setNoShowId] = useState<string | null>(null);
  const [historySignup, setHistorySignup] = useState<SignupHistoryResponse | null>(null);
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null);
  const [approvedSchools, setApprovedSchools] = useState<ApprovedSchool[]>([]);
  const [selectedSchools, setSelectedSchools] = useState<string[]>([]);
  const [form, setForm] = useState(emptyForm);

  // Edit / delete state
  const [editOppId, setEditOppId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const benId = user?.beneficiaryId;

  const loadOpportunities = async () => {
    if (!benId) return;
    setLoading(true);
    try {
      const data = await api.get<Opportunity[]>(`/beneficiaries/${benId}/opportunities`);
      setOpportunities(data);
    } catch {
      setError("Failed to load opportunities.");
    } finally {
      setLoading(false);
    }
  };

  const loadSignups = async () => {
    if (!benId) return;
    setSignupsLoading(true);
    try {
      const data = await api.get<SignupRecord[]>(`/beneficiaries/${benId}/signups`);
      setSignups(data);
    } catch {
      setError("Failed to load signups.");
    } finally {
      setSignupsLoading(false);
    }
  };

  const prefillLocation = () => {
    if (!benId) return;
    api.get<{ address?: string; city?: string; state?: string; zip?: string }>(`/beneficiaries/${benId}`)
      .then((ben) => {
        const parts = [ben.address, ben.city, ben.state, ben.zip].filter(Boolean);
        if (parts.length) setForm((p) => ({ ...p, location: parts.join(", ") }));
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (!benId) return;
    void loadOpportunities();
    prefillLocation();
    api.get<ApprovedSchool[]>(`/beneficiaries/${benId}/schools`)
      .then((schools) => {
        setApprovedSchools(schools);
        setSelectedSchools(schools.map((s) => s.id));
      })
      .catch(() => {});
  }, [benId]);

  useEffect(() => {
    if (tab === "signups") void loadSignups();
  }, [tab, benId]);

  const addSlot = () => setForm((p) => ({ ...p, slots: [...p.slots, { date: "", startTime: "", endTime: "", capacity: "" }] }));
  const updateSlot = (i: number, field: string, value: string) =>
    setForm((p) => ({ ...p, slots: p.slots.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)) }));
  const removeSlot = (i: number) => setForm((p) => ({ ...p, slots: p.slots.filter((_, idx) => idx !== i) }));
  const toggleSchool = (id: string) =>
    setSelectedSchools((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  const toggleAllSchools = () =>
    setSelectedSchools((prev) => prev.length === approvedSchools.length ? [] : approvedSchools.map((s) => s.id));

  const handleEdit = (opp: Opportunity) => {
    setEditOppId(opp.id);
    setForm({
      title: opp.title,
      description: opp.description ?? "",
      location: opp.location ?? "",
      requirementsNote: opp.requirementsNote ?? "",
      slots: [],
    });
    const restrictions: string[] = opp.schoolRestrictions ? JSON.parse(opp.schoolRestrictions) : approvedSchools.map((s) => s.id);
    setSelectedSchools(restrictions);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    setEditOppId(null);
    setForm(emptyForm);
    setSelectedSchools(approvedSchools.map((s) => s.id));
    prefillLocation();
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (editOppId) {
      setSaving(true);
      try {
        const updated = await api.patch<Opportunity>(`/beneficiaries/${benId}/opportunities/${editOppId}`, {
          title: form.title,
          description: form.description,
          location: form.location || null,
          requirementsNote: form.requirementsNote || null,
          schoolRestrictions: selectedSchools.length > 0 ? selectedSchools : null,
        });
        setOpportunities((prev) => prev.map((o) => o.id === editOppId ? updated : o));
        handleCancelEdit();
      } catch (err: any) {
        setError(err.message || "Failed to save changes.");
      } finally {
        setSaving(false);
      }
      return;
    }

    setCreating(true);
    try {
      await api.post(`/beneficiaries/${benId}/opportunities`, {
        title: form.title,
        description: form.description,
        location: form.location || undefined,
        requirementsNote: form.requirementsNote || undefined,
        startDate: form.slots[0]?.date || new Date().toISOString().split("T")[0],
        schoolRestrictions: selectedSchools.length > 0 ? selectedSchools : undefined,
        timeSlots: form.slots.map((s) => ({
          date: s.date,
          startTime: s.startTime,
          endTime: s.endTime,
          durationHours: calcDurationHours(s.startTime, s.endTime) || 1,
          capacity: s.capacity ? parseInt(s.capacity) : 10,
        })),
      });
      setForm(emptyForm);
      prefillLocation();
      setSelectedSchools(approvedSchools.map((s) => s.id));
      void loadOpportunities();
    } catch (err: any) {
      setError(err.message || "Failed to create opportunity.");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (oppId: string) => {
    setDeleting(true);
    setError("");
    try {
      await api.delete(`/beneficiaries/${benId}/opportunities/${oppId}`);
      setOpportunities((prev) => prev.filter((o) => o.id !== oppId));
      setDeleteConfirmId(null);
      if (editOppId === oppId) handleCancelEdit();
    } catch (err: any) {
      setError(err.message || "Failed to delete opportunity.");
      setDeleteConfirmId(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleApprove = async (signupId: string, hours: number) => {
    setActionId(signupId);
    try {
      await api.post(`/beneficiaries/signups/${signupId}/approve`, { approvedHours: hours });
      setSignups((prev) =>
        prev.map((s) => s.id === signupId ? { ...s, verificationStatus: "APPROVED", totalHours: hours } : s)
      );
    } catch (err: any) {
      setError(err.message || "Failed to approve.");
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (signupId: string) => {
    const reason = rejectReason[signupId]?.trim();
    if (!reason) { setError("Please enter a reason for rejection."); return; }
    setRejectingId(signupId);
    try {
      await api.post(`/beneficiaries/signups/${signupId}/reject`, { reason });
      setSignups((prev) =>
        prev.map((s) => s.id === signupId ? { ...s, verificationStatus: "REJECTED", rejectionReason: reason } : s)
      );
      setRejectReason((prev) => ({ ...prev, [signupId]: "" }));
    } catch (err: any) {
      setError(err.message || "Failed to reject.");
    } finally {
      setRejectingId(null);
    }
  };

  const handleNoShow = async (signupId: string) => {
    setNoShowId(signupId);
    setNoShowConfirmId(null);
    try {
      await api.post(`/beneficiaries/signups/${signupId}/no-show`, {});
      setSignups((prev) => prev.map((s) => s.id === signupId ? { ...s, status: "NO_SHOW" } : s));
    } catch (err: any) {
      setError(err.message || "Failed to mark no-show.");
    } finally {
      setNoShowId(null);
    }
  };

  const loadHistory = async (signupId: string) => {
    setHistoryLoadingId(signupId);
    setError("");
    try {
      const data = await api.get<SignupHistoryResponse>(`/beneficiaries/signups/${signupId}/history`);
      setHistorySignup(data);
    } catch (err: any) {
      setError(err.message || "Failed to load verification history.");
    } finally {
      setHistoryLoadingId(null);
    }
  };

  const formatHistoryDetails = (raw: string | null) => {
    if (!raw) return "";
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return Object.entries(parsed).map(([key, value]) => `${key}: ${String(value)}`).join(" · ");
    } catch {
      return raw;
    }
  };

  const pendingSignups = signups.filter((s) => s.status === "CONFIRMED" && s.verificationStatus === "PENDING");
  const reviewedSignups = signups.filter((s) => s.verificationStatus !== "PENDING" || s.status === "NO_SHOW" || s.status === "CANCELLED");

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Opportunities</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b mb-6">
        <button onClick={() => setTab("opportunities")}
          className={`pb-2 text-sm font-medium border-b-2 ${tab === "opportunities" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          Opportunities
        </button>
        <button onClick={() => setTab("signups")}
          className={`pb-2 text-sm font-medium border-b-2 ${tab === "signups" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          Student Signups
          {pendingSignups.length > 0 && tab !== "signups" && (
            <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded-full">{pendingSignups.length}</span>
          )}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
      )}

      {/* Opportunities tab — two-panel layout */}
      {tab === "opportunities" && (
        <div className="flex gap-6 items-start">
          {/* Left panel: Create / Edit form */}
          <div className="w-[55%] flex-shrink-0 bg-white border border-gray-200 rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">{editOppId ? "Edit Opportunity" : "Create New Opportunity"}</h2>
              {editOppId && (
                <button type="button" onClick={handleCancelEdit} className="text-xs text-gray-400 hover:text-gray-600">
                  Cancel edit
                </button>
              )}
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input type="text" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input type="text" value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                  placeholder="Address or virtual" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Requirements / Notes for Volunteers</label>
                <input type="text" value={form.requirementsNote} onChange={(e) => setForm((p) => ({ ...p, requirementsNote: e.target.value }))}
                  placeholder="e.g. Bring closed-toe shoes, minimum age 16"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>

              {/* Time slots — only shown when creating */}
              {!editOppId && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700">Time Slots *</label>
                    <button type="button" onClick={addSlot} className="text-xs text-blue-600 hover:underline">+ Add slot</button>
                  </div>
                  <div className="space-y-2">
                    {form.slots.map((slot, i) => (
                      <div key={i} className="grid grid-cols-5 gap-2 items-center">
                        <input type="date" value={slot.date} onChange={(e) => updateSlot(i, "date", e.target.value)}
                          required className="px-2 py-1.5 border border-gray-300 rounded text-sm col-span-2" />
                        <input type="time" value={slot.startTime} onChange={(e) => updateSlot(i, "startTime", e.target.value)}
                          required className="px-2 py-1.5 border border-gray-300 rounded text-sm" />
                        <input type="time" value={slot.endTime} onChange={(e) => updateSlot(i, "endTime", e.target.value)}
                          required className="px-2 py-1.5 border border-gray-300 rounded text-sm" />
                        <div className="flex gap-1 items-center">
                          <input type="number" value={slot.capacity} onChange={(e) => updateSlot(i, "capacity", e.target.value)}
                            placeholder="Max #" min={1} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                            title="Maximum # Volunteers" />
                          {form.slots.length > 1 && (
                            <button type="button" onClick={() => removeSlot(i)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {editOppId && (
                <div className="text-xs text-gray-400 bg-gray-50 rounded px-3 py-2">
                  Time slots cannot be edited after creation. To add new dates, create a new opportunity.
                </div>
              )}

              {/* Schools panel */}
              <div className="border-t pt-4">
                <div className="text-sm font-medium text-gray-700 mb-2">Schools that can participate</div>
                {approvedSchools.length === 0 ? (
                  <p className="text-xs text-gray-400">No schools have approved this beneficiary yet.</p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={selectedSchools.length === approvedSchools.length}
                        onChange={toggleAllSchools} className="h-4 w-4 rounded border-gray-300" />
                      <span className="font-medium text-gray-700">All schools</span>
                    </label>
                    <div className="ml-1 space-y-1">
                      {approvedSchools.map((school) => (
                        <label key={school.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={selectedSchools.includes(school.id)}
                            onChange={() => toggleSchool(school.id)} className="h-4 w-4 rounded border-gray-300" />
                          <span className="text-gray-600">{school.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button type="submit" disabled={creating || saving}
                className="w-full px-4 py-[7px] bg-blue-600 text-white rounded-md text-sm hover:opacity-85 disabled:opacity-50">
                {editOppId
                  ? (saving ? "Saving..." : "Save Changes")
                  : (creating ? "Creating..." : "Create Opportunity")}
              </button>
            </form>
          </div>

          {/* Right panel: Opportunities list */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-700">Created Opportunities</h2>
              <div className="relative">
                <button onClick={() => setFilterOpen((p) => !p)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border ${visibleStatuses.length < 3 ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                  </svg>
                  Filter
                  {visibleStatuses.length < 3 && (
                    <span className="bg-white text-gray-900 rounded-full px-1.5 font-semibold">{visibleStatuses.length}</span>
                  )}
                </button>
                {filterOpen && (
                  <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-10 p-3 space-y-2">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Show</div>
                    {(["Active", "Upcoming", "Expired"] as const).map((status) => (
                      <label key={status} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={visibleStatuses.includes(status)}
                          onChange={() => setVisibleStatuses((prev) => prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status])}
                          className="h-4 w-4 rounded border-gray-300" />
                        <span className={status === "Active" ? "text-green-700" : status === "Upcoming" ? "text-blue-700" : "text-gray-500"}>{status}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {loading ? (
              <div className="text-gray-500 text-sm">Loading...</div>
            ) : opportunities.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-gray-500 text-sm">No opportunities yet.</div>
            ) : (() => {
              const statusOrder: Record<string, number> = { Active: 0, Upcoming: 1, Expired: 2 };
              const sorted = [...opportunities]
                .map((opp) => ({ opp, displayStatus: getDisplayStatus(opp.timeSlots) }))
                .filter(({ displayStatus }) => visibleStatuses.includes(displayStatus))
                .sort((a, b) => (statusOrder[a.displayStatus] ?? 3) - (statusOrder[b.displayStatus] ?? 3));

              return sorted.length === 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-gray-500 text-sm">No opportunities match the current filter.</div>
              ) : (
                <div className="space-y-3">
                  {sorted.map(({ opp, displayStatus }) => (
                    <div key={opp.id} className={`bg-white border rounded-lg p-4 ${editOppId === opp.id ? "border-blue-400 ring-1 ring-blue-200" : "border-gray-200"}`}>
                      <div className="flex justify-between items-start mb-1">
                        <div className="font-medium text-sm">{opp.title}</div>
                        <div className="flex items-center gap-2 ml-2 shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${displayStatus === "Active" ? "bg-green-50 text-green-700" : displayStatus === "Upcoming" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                            {displayStatus}
                          </span>
                          <button onClick={() => handleEdit(opp)}
                            className="text-xs text-blue-600 hover:underline">
                            Edit
                          </button>
                          {deleteConfirmId === opp.id ? (
                            <span className="flex items-center gap-1 text-xs">
                              <button onClick={() => handleDelete(opp.id)} disabled={deleting}
                                className="text-red-600 hover:underline disabled:opacity-50">
                                {deleting ? "..." : "Confirm"}
                              </button>
                              <button onClick={() => setDeleteConfirmId(null)} className="text-gray-400 hover:text-gray-600">Cancel</button>
                            </span>
                          ) : (
                            <button onClick={() => setDeleteConfirmId(opp.id)}
                              className="text-xs text-red-400 hover:text-red-600">
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                      {opp.location && <div className="text-xs text-gray-500">{opp.location}</div>}
                      {opp.description && <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{opp.description}</div>}
                      {opp.timeSlots.length > 0 && (
                        <div className="mt-2 border-t pt-2 space-y-1">
                          {opp.timeSlots.map((slot) => (
                            <div key={slot.id} className="flex justify-between text-xs text-gray-600">
                              <span>{new Date(slot.date).toLocaleDateString(undefined, { timeZone: "UTC" })} · {slot.startTime}–{slot.endTime}</span>
                              <span className="text-gray-400">{slot._count?.signups || 0}{slot.capacity ? `/${slot.capacity}` : ""} signed up</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Signups tab */}
      {tab === "signups" && (
        <div>
          {signupsLoading ? (
            <div className="text-gray-500 text-sm">Loading signups...</div>
          ) : signups.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-500">No student signups yet.</div>
          ) : (
            <div className="space-y-6">
              {pendingSignups.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-gray-700 mb-3">Pending Review ({pendingSignups.length})</h2>
                  <div className="space-y-3">
                    {pendingSignups.map((s) => (
                      <div key={s.id} className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <div className="font-medium text-sm">{s.student.label}</div>
                            <div className="text-xs text-gray-400">Student identity is hidden for school privacy compliance.</div>
                            <div className="text-xs text-gray-600 mt-1">
                              {s.slot.opportunity.title} · {new Date(s.slot.date).toLocaleDateString(undefined, { timeZone: "UTC" })} {s.slot.startTime}–{s.slot.endTime}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              Duration: {s.slot.durationHours}h
                              {s.checkedIn && s.checkedOut ? " · Attended" : s.checkedIn ? " · Checked in" : " · Not checked in"}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 shrink-0 min-w-[120px]">
                            <button onClick={() => handleApprove(s.id, s.totalHours ?? s.slot.durationHours)}
                              disabled={actionId === s.id}
                              className="px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50">
                              {actionId === s.id ? "..." : `Approve ${s.totalHours ?? s.slot.durationHours}h`}
                            </button>
                            <div className="flex gap-1">
                              <input type="text" value={rejectReason[s.id] || ""}
                                onChange={(e) => setRejectReason((prev) => ({ ...prev, [s.id]: e.target.value }))}
                                placeholder="Reason..."
                                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 rounded text-xs" />
                              <button onClick={() => handleReject(s.id)} disabled={rejectingId === s.id}
                                className="px-2 py-1 bg-red-50 text-red-600 border border-red-200 rounded text-xs hover:bg-red-100 disabled:opacity-50">
                                {rejectingId === s.id ? "..." : "Reject"}
                              </button>
                            </div>
                            <button onClick={() => setNoShowConfirmId(s.id)} disabled={noShowId === s.id}
                              className="px-2 py-1 text-gray-500 border border-gray-200 rounded text-xs hover:bg-gray-50 disabled:opacity-50">
                              {noShowId === s.id ? "..." : "No-Show"}
                            </button>
                            <button onClick={() => loadHistory(s.id)} disabled={historyLoadingId === s.id}
                              className="px-2 py-1 text-gray-500 border border-gray-200 rounded text-xs hover:bg-gray-50 disabled:opacity-50">
                              {historyLoadingId === s.id ? "..." : "History"}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {reviewedSignups.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-gray-700 mb-3">Reviewed ({reviewedSignups.length})</h2>
                  <div className="space-y-2">
                    {reviewedSignups.map((s) => (
                      <div key={s.id} className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex justify-between items-center">
                        <div>
                          <div className="font-medium text-sm">{s.student.label}</div>
                          <div className="text-xs text-gray-500">
                            {s.slot.opportunity.title} · {new Date(s.slot.date).toLocaleDateString(undefined, { timeZone: "UTC" })} · {s.totalHours ?? s.slot.durationHours}h
                          </div>
                          {s.rejectionReason && <div className="text-xs text-red-500 mt-0.5 italic">{s.rejectionReason}</div>}
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => loadHistory(s.id)} disabled={historyLoadingId === s.id}
                            className="px-2 py-1 text-gray-500 border border-gray-200 rounded text-xs hover:bg-gray-50 disabled:opacity-50">
                            {historyLoadingId === s.id ? "..." : "History"}
                          </button>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${s.status === "NO_SHOW" ? "bg-gray-100 text-gray-600" : s.verificationStatus === "APPROVED" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                            {s.status === "NO_SHOW" ? "No-Show" : s.verificationStatus}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* No-show confirmation modal */}
      {noShowConfirmId && (() => {
        const signup = signups.find((s) => s.id === noShowConfirmId);
        if (!signup) return null;
        return (
          <div className="fixed inset-0 z-30 bg-black/40 flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white rounded-xl shadow-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-2">Mark as No-Show?</h3>
              <p className="text-sm text-gray-600 mb-1">
                <strong>{signup.student.label}</strong> will be marked as a no-show for:
              </p>
              <p className="text-sm text-gray-500 mb-4">
                {signup.slot.opportunity.title} · {new Date(signup.slot.date).toLocaleDateString(undefined, { timeZone: "UTC" })}
              </p>
              <p className="text-xs text-gray-400 mb-5">This cannot be undone. The student's hours will not be counted.</p>
              <div className="flex gap-3">
                <button onClick={() => handleNoShow(noShowConfirmId)}
                  className="flex-1 px-4 py-[7px] bg-blue-600 text-white rounded-md text-sm hover:opacity-85">
                  Confirm No-Show
                </button>
                <button onClick={() => setNoShowConfirmId(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-600 rounded-md text-sm hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Verification history modal */}
      {historySignup && (
        <div className="fixed inset-0 z-30 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-xl border border-gray-200 max-h-[85vh] overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
              <div>
                <div className="font-semibold text-gray-900">Verification History</div>
                <div className="text-sm text-gray-500 mt-1">
                  {(historySignup.signup.student?.label || "Anonymous volunteer")} · {historySignup.signup.slot.opportunity.title}
                </div>
              </div>
              <button onClick={() => setHistorySignup(null)} className="text-gray-400 hover:text-gray-600 text-sm">Close</button>
            </div>
            <div className="px-5 py-4 border-b border-gray-100 text-sm text-gray-600">
              <div>{new Date(historySignup.signup.slot.date).toLocaleDateString(undefined, { timeZone: "UTC" })} · {historySignup.signup.slot.startTime}–{historySignup.signup.slot.endTime} · {historySignup.signup.totalHours ?? historySignup.signup.slot.durationHours}h</div>
              <div className="mt-1">Current status: <strong>{historySignup.signup.status === "NO_SHOW" ? "No-Show" : historySignup.signup.verificationStatus}</strong></div>
              {historySignup.signup.rejectionReason && <div className="mt-1 text-red-600">Reason: {historySignup.signup.rejectionReason}</div>}
            </div>
            <div className="p-5 overflow-y-auto max-h-[55vh] space-y-3">
              {historySignup.history.length === 0 ? (
                <div className="text-sm text-gray-500">No audit events recorded yet.</div>
              ) : (
                historySignup.history.map((entry) => (
                  <div key={entry.id} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{entry.action}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{entry.actor.name} · {entry.actor.role}</div>
                      </div>
                      <div className="text-xs text-gray-400 shrink-0">{new Date(entry.createdAt).toLocaleString()}</div>
                    </div>
                    {formatHistoryDetails(entry.details) && (
                      <div className="text-xs text-gray-600 mt-2">{formatHistoryDetails(entry.details)}</div>
                    )}
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
