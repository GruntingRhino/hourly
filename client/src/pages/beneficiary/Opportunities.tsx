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
  student: { id: string; name: string; email: string };
}

interface ApprovedSchool {
  id: string;
  name: string;
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
  const [approvedSchools, setApprovedSchools] = useState<ApprovedSchool[]>([]);
  const [selectedSchools, setSelectedSchools] = useState<string[]>([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    requirementsNote: "",
    slots: [{ date: "", startTime: "", endTime: "", capacity: "" }],
  });

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

  // Load beneficiary address to pre-fill location, and approved schools
  useEffect(() => {
    if (!benId) return;
    void loadOpportunities();

    api.get<{ address?: string; city?: string; state?: string; zip?: string }>(`/beneficiaries/${benId}`)
      .then((ben) => {
        const parts = [ben.address, ben.city, ben.state, ben.zip].filter(Boolean);
        if (parts.length) {
          setForm((p) => ({ ...p, location: parts.join(", ") }));
        }
      })
      .catch(() => {});

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

  const addSlot = () => {
    setForm((p) => ({
      ...p,
      slots: [...p.slots, { date: "", startTime: "", endTime: "", capacity: "" }],
    }));
  };

  const updateSlot = (i: number, field: string, value: string) => {
    setForm((p) => ({
      ...p,
      slots: p.slots.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)),
    }));
  };

  const removeSlot = (i: number) => {
    setForm((p) => ({ ...p, slots: p.slots.filter((_, idx) => idx !== i) }));
  };

  const toggleSchool = (id: string) => {
    setSelectedSchools((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const toggleAllSchools = () => {
    setSelectedSchools((prev) =>
      prev.length === approvedSchools.length ? [] : approvedSchools.map((s) => s.id)
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError("");
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
      setForm({
        title: "",
        description: "",
        location: "",
        requirementsNote: "",
        slots: [{ date: "", startTime: "", endTime: "", capacity: "" }],
      });
      // Re-populate location from beneficiary address
      api.get<{ address?: string; city?: string; state?: string; zip?: string }>(`/beneficiaries/${benId}`)
        .then((ben) => {
          const parts = [ben.address, ben.city, ben.state, ben.zip].filter(Boolean);
          if (parts.length) setForm((p) => ({ ...p, location: parts.join(", ") }));
        })
        .catch(() => {});
      void loadOpportunities();
    } catch (err: any) {
      setError(err.message || "Failed to create opportunity.");
    } finally {
      setCreating(false);
    }
  };

  const handleApprove = async (signupId: string, hours: number) => {
    setActionId(signupId);
    try {
      await api.post(`/beneficiaries/signups/${signupId}/approve`, { approvedHours: hours });
      setSignups((prev) =>
        prev.map((s) =>
          s.id === signupId ? { ...s, verificationStatus: "APPROVED", totalHours: hours } : s
        )
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
        prev.map((s) =>
          s.id === signupId ? { ...s, verificationStatus: "REJECTED", rejectionReason: reason } : s
        )
      );
      setRejectReason((prev) => ({ ...prev, [signupId]: "" }));
    } catch (err: any) {
      setError(err.message || "Failed to reject.");
    } finally {
      setRejectingId(null);
    }
  };

  const pendingSignups = signups.filter(
    (s) => s.status === "CONFIRMED" && s.verificationStatus === "PENDING"
  );
  const reviewedSignups = signups.filter((s) => s.verificationStatus !== "PENDING");

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Opportunities</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b mb-6">
        <button
          onClick={() => setTab("opportunities")}
          className={`pb-2 text-sm font-medium border-b-2 ${
            tab === "opportunities"
              ? "border-gray-900 text-gray-900"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Opportunities
        </button>
        <button
          onClick={() => setTab("signups")}
          className={`pb-2 text-sm font-medium border-b-2 ${
            tab === "signups"
              ? "border-gray-900 text-gray-900"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Student Signups
          {pendingSignups.length > 0 && tab !== "signups" && (
            <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded-full">
              {pendingSignups.length}
            </span>
          )}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Opportunities tab — two-panel layout */}
      {tab === "opportunities" && (
        <div className="flex gap-6 items-start">
          {/* Left panel: Create form */}
          <div className="w-[55%] flex-shrink-0 bg-white border border-gray-200 rounded-lg p-5">
            <h2 className="font-semibold mb-4">Create New Opportunity</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location of Opportunity
                </label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                  placeholder="Address or virtual"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Requirements / Notes for Volunteers
                </label>
                <input
                  type="text"
                  value={form.requirementsNote}
                  onChange={(e) => setForm((p) => ({ ...p, requirementsNote: e.target.value }))}
                  placeholder="e.g. Bring closed-toe shoes, minimum age 16"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-gray-700">Time Slots *</label>
                  <button
                    type="button"
                    onClick={addSlot}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    + Add slot
                  </button>
                </div>
                <div className="space-y-2">
                  {form.slots.map((slot, i) => (
                    <div key={i} className="grid grid-cols-5 gap-2 items-center">
                      <input
                        type="date"
                        value={slot.date}
                        onChange={(e) => updateSlot(i, "date", e.target.value)}
                        required
                        className="px-2 py-1.5 border border-gray-300 rounded text-sm col-span-2"
                      />
                      <input
                        type="time"
                        value={slot.startTime}
                        onChange={(e) => updateSlot(i, "startTime", e.target.value)}
                        required
                        className="px-2 py-1.5 border border-gray-300 rounded text-sm"
                      />
                      <input
                        type="time"
                        value={slot.endTime}
                        onChange={(e) => updateSlot(i, "endTime", e.target.value)}
                        required
                        className="px-2 py-1.5 border border-gray-300 rounded text-sm"
                      />
                      <div className="flex gap-1 items-center">
                        <input
                          type="number"
                          value={slot.capacity}
                          onChange={(e) => updateSlot(i, "capacity", e.target.value)}
                          placeholder="Max # Volunteers"
                          min={1}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                          title="Maximum # Volunteers"
                        />
                        {form.slots.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSlot(i)}
                            className="text-red-400 hover:text-red-600 text-xs"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Schools panel */}
              <div className="border-t pt-4">
                <div className="text-sm font-medium text-gray-700 mb-2">
                  Schools that can participate
                </div>
                {approvedSchools.length === 0 ? (
                  <p className="text-xs text-gray-400">
                    No schools have approved this beneficiary yet.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedSchools.length === approvedSchools.length}
                        onChange={toggleAllSchools}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <span className="font-medium text-gray-700">All schools</span>
                    </label>
                    <div className="ml-1 space-y-1">
                      {approvedSchools.map((school) => (
                        <label key={school.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedSchools.includes(school.id)}
                            onChange={() => toggleSchool(school.id)}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          <span className="text-gray-600">{school.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={creating}
                className="w-full px-4 py-2 bg-gray-900 text-white rounded-md text-sm hover:bg-gray-800 disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Opportunity"}
              </button>
            </form>
          </div>

          {/* Right panel: Opportunities list */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-700">Created Opportunities</h2>
              {/* Filter toggle */}
              <div className="relative">
                <button
                  onClick={() => setFilterOpen((p) => !p)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border ${
                    visibleStatuses.length < 3
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-300 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                  </svg>
                  Filter
                  {visibleStatuses.length < 3 && (
                    <span className="bg-white text-gray-900 rounded-full px-1.5 font-semibold">
                      {visibleStatuses.length}
                    </span>
                  )}
                </button>
                {filterOpen && (
                  <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-10 p-3 space-y-2">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      Show
                    </div>
                    {(["Active", "Upcoming", "Expired"] as const).map((status) => (
                      <label key={status} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={visibleStatuses.includes(status)}
                          onChange={() =>
                            setVisibleStatuses((prev) =>
                              prev.includes(status)
                                ? prev.filter((s) => s !== status)
                                : [...prev, status]
                            )
                          }
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <span
                          className={
                            status === "Active"
                              ? "text-green-700"
                              : status === "Upcoming"
                              ? "text-blue-700"
                              : "text-gray-500"
                          }
                        >
                          {status}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {loading ? (
              <div className="text-gray-500 text-sm">Loading...</div>
            ) : opportunities.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-gray-500 text-sm">
                No opportunities yet.
              </div>
            ) : (() => {
              const statusOrder: Record<string, number> = { Active: 0, Upcoming: 1, Expired: 2 };
              const sorted = [...opportunities]
                .map((opp) => ({ opp, displayStatus: getDisplayStatus(opp.timeSlots) }))
                .filter(({ displayStatus }) => visibleStatuses.includes(displayStatus))
                .sort((a, b) => (statusOrder[a.displayStatus] ?? 3) - (statusOrder[b.displayStatus] ?? 3));

              return sorted.length === 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-gray-500 text-sm">
                  No opportunities match the current filter.
                </div>
              ) : (
                <div className="space-y-3">
                  {sorted.map(({ opp, displayStatus }) => (
                    <div key={opp.id} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-1">
                        <div className="font-medium text-sm">{opp.title}</div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ml-2 shrink-0 ${
                            displayStatus === "Active"
                              ? "bg-green-50 text-green-700"
                              : displayStatus === "Upcoming"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {displayStatus}
                        </span>
                      </div>
                      {opp.location && (
                        <div className="text-xs text-gray-500">{opp.location}</div>
                      )}
                      {opp.description && (
                        <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{opp.description}</div>
                      )}
                      {opp.timeSlots.length > 0 && (
                        <div className="mt-2 border-t pt-2 space-y-1">
                          {opp.timeSlots.map((slot) => (
                            <div key={slot.id} className="flex justify-between text-xs text-gray-600">
                              <span>
                                {new Date(slot.date).toLocaleDateString(undefined, { timeZone: "UTC" })} ·{" "}
                                {slot.startTime}–{slot.endTime}
                              </span>
                              <span className="text-gray-400">
                                {slot._count?.signups || 0}
                                {slot.capacity ? `/${slot.capacity}` : ""} signed up
                              </span>
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
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-500">
              No student signups yet.
            </div>
          ) : (
            <div className="space-y-6">
              {pendingSignups.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-gray-700 mb-3">
                    Pending Review ({pendingSignups.length})
                  </h2>
                  <div className="space-y-3">
                    {pendingSignups.map((s) => (
                      <div
                        key={s.id}
                        className="bg-white border border-gray-200 rounded-lg p-4"
                      >
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            {s.checkedIn ? (
                              <>
                                <div className="font-medium text-sm">{s.student.name}</div>
                                <div className="text-xs text-gray-500">{s.student.email}</div>
                              </>
                            ) : (
                              <>
                                <div className="font-medium text-sm text-gray-400 italic">Anonymous volunteer</div>
                                <div className="text-xs text-gray-400">Details revealed after check-in</div>
                              </>
                            )}
                            <div className="text-xs text-gray-600 mt-1">
                              {s.slot.opportunity.title} ·{" "}
                              {new Date(s.slot.date).toLocaleDateString(undefined, { timeZone: "UTC" })}{" "}
                              {s.slot.startTime}–{s.slot.endTime}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              Duration: {s.slot.durationHours}h
                              {s.checkedIn && s.checkedOut
                                ? " · Attended"
                                : s.checkedIn
                                ? " · Checked in"
                                : " · Not checked in"}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 shrink-0 min-w-[120px]">
                            <button
                              onClick={() => handleApprove(s.id, s.totalHours ?? s.slot.durationHours)}
                              disabled={actionId === s.id}
                              className="px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50"
                            >
                              {actionId === s.id ? "..." : `Approve ${s.totalHours ?? s.slot.durationHours}h`}
                            </button>
                            <div className="flex gap-1">
                              <input
                                type="text"
                                value={rejectReason[s.id] || ""}
                                onChange={(e) =>
                                  setRejectReason((prev) => ({ ...prev, [s.id]: e.target.value }))
                                }
                                placeholder="Reason..."
                                className="flex-1 min-w-0 px-2 py-1 border border-gray-300 rounded text-xs"
                              />
                              <button
                                onClick={() => handleReject(s.id)}
                                disabled={rejectingId === s.id}
                                className="px-2 py-1 bg-red-50 text-red-600 border border-red-200 rounded text-xs hover:bg-red-100 disabled:opacity-50"
                              >
                                {rejectingId === s.id ? "..." : "Reject"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {reviewedSignups.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-gray-700 mb-3">
                    Reviewed ({reviewedSignups.length})
                  </h2>
                  <div className="space-y-2">
                    {reviewedSignups.map((s) => (
                      <div
                        key={s.id}
                        className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex justify-between items-center"
                      >
                        <div>
                          <div className="font-medium text-sm">
                            {s.checkedIn ? s.student.name : <span className="italic text-gray-400">Anonymous volunteer</span>}
                          </div>
                          <div className="text-xs text-gray-500">
                            {s.slot.opportunity.title} ·{" "}
                            {new Date(s.slot.date).toLocaleDateString(undefined, { timeZone: "UTC" })}{" "}
                            · {s.totalHours ?? s.slot.durationHours}h
                          </div>
                          {s.rejectionReason && (
                            <div className="text-xs text-red-500 mt-0.5 italic">
                              {s.rejectionReason}
                            </div>
                          )}
                        </div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            s.verificationStatus === "APPROVED"
                              ? "bg-green-50 text-green-700"
                              : "bg-red-50 text-red-600"
                          }`}
                        >
                          {s.verificationStatus}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
