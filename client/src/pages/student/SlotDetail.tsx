import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { api } from "../../lib/api";

interface SlotFull {
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
    address: string | null;
    category: string | null;
    requirementsNote: string | null;
    beneficiary: {
      id: string;
      name: string;
      category: string | null;
      address: string | null;
      city: string | null;
      state: string | null;
      description: string | null;
      website: string | null;
      phone: string | null;
    };
  };
  mySignup: { id: string; status: string; verificationStatus: string } | null;
}

export default function SlotDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [slot, setSlot] = useState<SlotFull | null>((location.state as any)?.slot ?? null);
  const [loading, setLoading] = useState(!((location.state as any)?.slot));
  const [error, setError] = useState("");
  const [signingUp, setSigningUp] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [actionOk, setActionOk] = useState(false);

  useEffect(() => {
    if (!slot) {
      setLoading(true);
      api.get<SlotFull>(`/beneficiaries/slots/${id}`)
        .then((data) => { setSlot(data); setLoading(false); })
        .catch(() => { setError("Failed to load details."); setLoading(false); });
    }
  }, [id]);

  const handleSignup = async () => {
    setSigningUp(true);
    setActionMsg("");
    try {
      await api.post(`/beneficiaries/slots/${id}/signup`, {});
      setSlot((prev) =>
        prev
          ? {
              ...prev,
              mySignup: { id: "", status: "CONFIRMED", verificationStatus: "PENDING" },
              _count: { signups: prev._count.signups + 1 },
            }
          : prev
      );
      setActionMsg("Signed up successfully!");
      setActionOk(true);
    } catch (err: any) {
      setActionMsg(err.message || "Failed to sign up.");
      setActionOk(false);
    } finally {
      setSigningUp(false);
    }
  };

  if (loading) return <div className="text-gray-500 p-4">Loading...</div>;
  if (error) return <div className="text-red-500 p-4">{error}</div>;
  if (!slot) return <div className="text-red-500 p-4">Slot not found</div>;

  const opp = slot.opportunity;
  const spotsLeft = slot.capacity - slot._count.signups;
  const isFull = spotsLeft <= 0;
  const isSignedUp = !!slot.mySignup && slot.mySignup.status !== "CANCELLED";
  const isWaitlisted = slot.mySignup?.status === "WAITLISTED";
  const dateStr = new Date(slot.date).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700 mb-4 block">
        ← Back
      </button>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="mb-4">
          <div className="text-sm text-gray-500 mb-1">{opp.beneficiary.name}</div>
          {opp.category && (
            <span className="inline-block px-2 py-0.5 text-xs bg-purple-50 text-purple-700 rounded-full mb-2">
              {opp.category}
            </span>
          )}
          <h1 className="text-2xl font-bold">{opp.title}</h1>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4">
          <div className="font-semibold text-blue-900">{dateStr}</div>
          <div className="text-blue-700 mt-1">
            {slot.startTime} – {slot.endTime} ·{" "}
            <span className="font-medium">{slot.durationHours}h</span>
          </div>
          <div className="text-sm text-blue-600 mt-1">
            {isFull
              ? "Full"
              : `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} remaining`}{" "}
            · {slot._count.signups}/{slot.capacity} signed up
          </div>
        </div>

        {opp.description && <p className="text-gray-700 mb-4">{opp.description}</p>}

        <div className="space-y-2 mb-4 text-sm">
          {opp.location && (
            <div>
              <span className="text-gray-500">Location: </span>
              <span className="font-medium">{opp.location}</span>
            </div>
          )}
          {opp.address && (
            <div>
              <span className="text-gray-500">Address: </span>
              <span className="font-medium">{opp.address}</span>
            </div>
          )}
        </div>

        {opp.requirementsNote && (
          <div className="mb-4 p-3 bg-orange-50 border border-orange-100 rounded-md text-sm text-orange-700">
            <span className="font-medium">Requirements: </span>
            {opp.requirementsNote}
          </div>
        )}

        <div className="border-t border-gray-100 pt-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            About {opp.beneficiary.name}
          </h3>
          {opp.beneficiary.description && (
            <p className="text-sm text-gray-600 mb-2">{opp.beneficiary.description}</p>
          )}
          {(opp.beneficiary.city || opp.beneficiary.state) && (
            <p className="text-xs text-gray-500 mb-1">
              {[opp.beneficiary.city, opp.beneficiary.state].filter(Boolean).join(", ")}
            </p>
          )}
          {opp.beneficiary.website && (
            <a
              href={opp.beneficiary.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline"
            >
              {opp.beneficiary.website}
            </a>
          )}
        </div>

        <div className="border-t border-gray-100 pt-4">
          {actionMsg && (
            <div
              className={`mb-3 p-3 rounded-md text-sm ${
                actionOk ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}
            >
              {actionMsg}
            </div>
          )}
          {isSignedUp ? (
            <div className="p-3 bg-green-50 rounded-md text-green-700 text-sm text-center font-medium">
              You're signed up for this slot
              {isWaitlisted && " (waitlisted — you'll be notified if a spot opens)"}
            </div>
          ) : isFull ? (
            <div className="p-3 bg-gray-50 rounded-md text-gray-500 text-sm text-center">
              This slot is full
            </div>
          ) : (
            <button
              onClick={handleSignup}
              disabled={signingUp}
              className="w-full py-3 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {signingUp ? "Signing up..." : "Sign Up for This Slot"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
