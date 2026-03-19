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
  slots: TimeSlotBasic[];
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

export default function BeneficiaryOpportunities() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"opportunities" | "signups">("opportunities");
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [signups, setSignups] = useState<SignupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [signupsLoading, setSignupsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<{ [id: string]: string }>({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    requirementsNote: "",
    slots: [{ date: "", startTime: "", endTime: "", durationHours: "", capacity: "" }],
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

  useEffect(() => {
    void loadOpportunities();
  }, [benId]);

  useEffect(() => {
    if (tab === "signups") void loadSignups();
  }, [tab, benId]);

  const addSlot = () => {
    setForm((p) => ({
      ...p,
      slots: [...p.slots, { date: "", startTime: "", endTime: "", durationHours: "", capacity: "" }],
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post(`/beneficiaries/${benId}/opportunities`, {
        title: form.title,
        description: form.description,
        location: form.location || undefined,
        requirementsNote: form.requirementsNote || undefined,
        startDate: form.slots[0]?.date || new Date().toISOString().split("T")[0],
        timeSlots: form.slots.map((s) => ({
          date: s.date,
          startTime: s.startTime,
          endTime: s.endTime,
          durationHours: parseFloat(s.durationHours) || 1,
          capacity: s.capacity ? parseInt(s.capacity) : 10,
        })),
      });
      setForm({
        title: "",
        description: "",
        location: "",
        requirementsNote: "",
        slots: [{ date: "", startTime: "", endTime: "", durationHours: "", capacity: "" }],
      });
      setShowForm(false);
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
        {tab === "opportunities" && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm hover:bg-gray-800"
          >
            + New Opportunity
          </button>
        )}
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

      {/* Opportunities tab */}
      {tab === "opportunities" && (
        <>
          {showForm && (
            <div className="mb-6 bg-white border border-gray-200 rounded-lg p-5">
              <h2 className="font-semibold mb-4">Create Opportunity</h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Title *
                    </label>
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
                      Location
                    </label>
                    <input
                      type="text"
                      value={form.location}
                      onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                      placeholder="Address or virtual"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
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
                    <label className="text-sm font-medium text-gray-700">
                      Time Slots *
                    </label>
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
                      <div key={i} className="grid grid-cols-6 gap-2 items-center">
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
                        <input
                          type="number"
                          value={slot.durationHours}
                          onChange={(e) => updateSlot(i, "durationHours", e.target.value)}
                          placeholder="Hrs"
                          min={0.5}
                          step={0.5}
                          required
                          className="px-2 py-1.5 border border-gray-300 rounded text-sm"
                          title="Duration in hours"
                        />
                        <div className="flex gap-1 items-center">
                          <input
                            type="number"
                            value={slot.capacity}
                            onChange={(e) => updateSlot(i, "capacity", e.target.value)}
                            placeholder="Cap"
                            min={1}
                            className="w-16 px-2 py-1.5 border border-gray-300 rounded text-sm"
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

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm hover:bg-gray-800 disabled:opacity-50"
                  >
                    {creating ? "Creating..." : "Create Opportunity"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-3 py-2 text-gray-500 hover:text-gray-800 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {loading ? (
            <div className="text-gray-500 text-sm">Loading...</div>
          ) : opportunities.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-500">
              No opportunities yet. Create one so students can sign up for volunteer shifts.
            </div>
          ) : (
            <div className="space-y-4">
              {opportunities.map((opp) => (
                <div
                  key={opp.id}
                  className="bg-white border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-medium">{opp.title}</div>
                      {opp.location && (
                        <div className="text-xs text-gray-500 mt-0.5">{opp.location}</div>
                      )}
                      {opp.description && (
                        <div className="text-sm text-gray-600 mt-1">{opp.description}</div>
                      )}
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        opp.status === "ACTIVE"
                          ? "bg-green-50 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {opp.status}
                    </span>
                  </div>
                  {opp.slots.length > 0 && (
                    <div className="mt-2 border-t pt-2 space-y-1">
                      {opp.slots.map((slot) => (
                        <div
                          key={slot.id}
                          className="flex justify-between text-xs text-gray-600"
                        >
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
          )}
        </>
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
