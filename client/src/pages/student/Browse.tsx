import { useEffect, useState } from "react";
import { api } from "../../lib/api";

interface TimeSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  capacity: number;
  _count: { signups: number };
  opportunity: {
    id: string;
    title: string;
    description: string;
    location: string | null;
    category: string | null;
    requirementsNote: string | null;
    beneficiary: { id: string; name: string; category: string | null };
  };
}

export default function StudentBrowse() {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [mySignupIds, setMySignupIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signingUp, setSigningUp] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ slotId: string; msg: string; ok: boolean } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [available, mySignups] = await Promise.all([
        api.get<TimeSlot[]>("/beneficiaries/available-slots"),
        api.get<{ slot: { id: string } }[]>("/beneficiaries/my-signups").catch(() => []),
      ]);
      setSlots(available);
      setMySignupIds(new Set(mySignups.map((s) => s.slot.id)));
    } catch {
      setError("Failed to load opportunities. Please refresh.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadData(); }, []);

  const handleSignup = async (slotId: string) => {
    setSigningUp(slotId);
    setActionMsg(null);
    try {
      await api.post(`/beneficiaries/slots/${slotId}/signup`, {});
      setMySignupIds((prev) => new Set([...prev, slotId]));
      setActionMsg({ slotId, msg: "Signed up!", ok: true });
    } catch (err: any) {
      setActionMsg({ slotId, msg: err.message || "Failed to sign up.", ok: false });
    } finally {
      setSigningUp(null);
    }
  };

  const filtered = slots.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.opportunity.title.toLowerCase().includes(q) ||
      s.opportunity.description.toLowerCase().includes(q) ||
      s.opportunity.beneficiary.name.toLowerCase().includes(q) ||
      (s.opportunity.location?.toLowerCase().includes(q) ?? false) ||
      (s.opportunity.category?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Browse Opportunities</h1>

      <input
        type="text"
        placeholder="Search opportunities, organizations, or categories..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-6"
      />

      {loading ? (
        <div className="text-gray-500">Loading opportunities...</div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-3xl mb-3">⌕</div>
          <div className="font-medium text-gray-700 mb-1">No opportunities found</div>
          <div className="text-sm text-gray-500">
            {search ? "Try a different search term." : "Your school hasn't approved any partner organizations yet. Check back later."}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((slot) => {
            const isSignedUp = mySignupIds.has(slot.id);
            const isFull = slot._count.signups >= slot.capacity;
            const msg = actionMsg?.slotId === slot.id ? actionMsg : null;
            return (
              <div key={slot.id} className="bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-200 transition-colors">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="text-lg font-semibold">{slot.opportunity.title}</div>
                    <div className="text-sm text-gray-500 mt-0.5">{slot.opportunity.beneficiary.name}</div>
                    {slot.opportunity.category && (
                      <div className="text-xs text-purple-600 mt-0.5">{slot.opportunity.category}</div>
                    )}
                    <div className="text-sm text-gray-600 mt-2">
                      {new Date(slot.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                      {" "}&middot;{" "}
                      {slot.startTime}–{slot.endTime}
                      {" "}&middot;{" "}
                      <span className="font-medium text-blue-700">{slot.durationHours}h</span>
                    </div>
                    {slot.opportunity.location && (
                      <div className="text-sm text-gray-500 mt-0.5">{slot.opportunity.location}</div>
                    )}
                    {slot.opportunity.description && (
                      <div className="text-sm text-gray-600 mt-2">{slot.opportunity.description}</div>
                    )}
                    {slot.opportunity.requirementsNote && (
                      <div className="text-xs text-orange-600 mt-1">Note: {slot.opportunity.requirementsNote}</div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-medium text-gray-700">{slot._count.signups}/{slot.capacity}</div>
                    <div className="text-xs text-gray-400">spots</div>
                    <div className="mt-3">
                      {isSignedUp ? (
                        <span className="text-xs px-3 py-1.5 bg-green-100 text-green-700 rounded-full font-medium">Signed Up</span>
                      ) : isFull ? (
                        <span className="text-xs px-3 py-1.5 bg-gray-100 text-gray-500 rounded-full">Full</span>
                      ) : (
                        <button
                          onClick={() => handleSignup(slot.id)}
                          disabled={signingUp === slot.id}
                          className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                          {signingUp === slot.id ? "Signing up..." : "Sign Up"}
                        </button>
                      )}
                    </div>
                    {msg && (
                      <div className={`text-xs mt-1 ${msg.ok ? "text-green-600" : "text-red-500"}`}>{msg.msg}</div>
                    )}
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
