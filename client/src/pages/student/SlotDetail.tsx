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

interface SignupResponse {
  id: string;
  status: string;
  verificationStatus?: string;
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
      const created = await api.post<SignupResponse>(`/beneficiaries/slots/${id}/signup`, {});
      setSlot((prev) =>
        prev
          ? {
              ...prev,
              mySignup: {
                id: created.id,
                status: created.status,
                verificationStatus: created.verificationStatus ?? "PENDING",
              },
              _count: {
                signups: created.status === "CONFIRMED" ? prev._count.signups + 1 : prev._count.signups,
              },
            }
          : prev
      );
      setActionMsg(created.status === "WAITLISTED" ? "Added to the waitlist." : "Signed up successfully!");
      setActionOk(true);
    } catch (err: any) {
      setActionMsg(err.message || "Failed to sign up.");
      setActionOk(false);
    } finally {
      setSigningUp(false);
    }
  };

  if (loading) return <div className="text-[var(--text-sec)] p-4">Loading...</div>;
  if (error) return <div className="text-[var(--er-t)] p-4">{error}</div>;
  if (!slot) return <div className="text-[var(--er-t)] p-4">Slot not found</div>;

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
      <button onClick={() => navigate(-1)} className="text-sm text-[var(--text-sec)] hover:text-[var(--text)] mb-4 block">
        ← Back
      </button>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-6">
        <div className="mb-4">
          <div className="text-sm text-[var(--text-sec)] mb-1">{opp.beneficiary.name}</div>
          {opp.category && (
            <span className="inline-block px-2 py-0.5 text-xs bg-purple-50 text-purple-700 rounded-full mb-2">
              {opp.category}
            </span>
          )}
          <h1 className="text-[28px] font-bold">{opp.title}</h1>
        </div>

        <div className="bg-[var(--in-bg)] border border-blue-100 rounded-[3px] p-4 mb-4">
          <div className="font-semibold text-[var(--navy)]">{dateStr}</div>
          <div className="text-[var(--action)] mt-1">
            {slot.startTime} – {slot.endTime} ·{" "}
            <span className="font-medium">{slot.durationHours}h</span>
          </div>
          <div className="text-sm text-[var(--action)] mt-1">
            {isFull
              ? "Full"
              : `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} remaining`}{" "}
            · {slot._count.signups}/{slot.capacity} signed up
          </div>
        </div>

        {opp.description && <p className="text-[var(--text)] mb-4">{opp.description}</p>}

        <div className="space-y-2 mb-4 text-sm">
          {opp.location && (
            <div>
              <span className="text-[var(--text-sec)]">Location: </span>
              <span className="font-medium">{opp.location}</span>
            </div>
          )}
          {opp.address && (
            <div>
              <span className="text-[var(--text-sec)]">Address: </span>
              <span className="font-medium">{opp.address}</span>
            </div>
          )}
        </div>

        {opp.requirementsNote && (
          <div className="mb-4 p-3 bg-orange-50 border border-orange-100 rounded-[2px] text-sm text-orange-700">
            <span className="font-medium">Requirements: </span>
            {opp.requirementsNote}
          </div>
        )}

        <div className="border-t border-[var(--border)] pt-4 mb-4">
          <h3 className="text-sm font-semibold text-[var(--text)] mb-2">
            About {opp.beneficiary.name}
          </h3>
          {opp.beneficiary.description && (
            <p className="text-sm text-[var(--text-sec)] mb-2">{opp.beneficiary.description}</p>
          )}
          {(opp.beneficiary.city || opp.beneficiary.state) && (
            <p className="text-xs text-[var(--text-sec)] mb-1">
              {[opp.beneficiary.city, opp.beneficiary.state].filter(Boolean).join(", ")}
            </p>
          )}
          {opp.beneficiary.website && (
            <a
              href={opp.beneficiary.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[var(--action)] hover:underline"
            >
              {opp.beneficiary.website}
            </a>
          )}
        </div>

        <div className="border-t border-[var(--border)] pt-4">
          {actionMsg && (
            <div
              className={`mb-3 p-3 rounded-[2px] text-sm ${
                actionOk ? "bg-[var(--ok-bg)] text-[var(--ok-t)]" : "bg-[var(--er-bg)] text-[var(--er-t)]"
              }`}
            >
              {actionMsg}
            </div>
          )}
          {isSignedUp ? (
            <div
              className={`p-3 rounded-[2px] text-sm text-center font-medium ${
                isWaitlisted ? "bg-[var(--wn-bg)] text-[var(--wn-t)]" : "bg-[var(--ok-bg)] text-[var(--ok-t)]"
              }`}
            >
              {isWaitlisted
                ? "You're on the waitlist for this slot. You'll be notified if a spot opens."
                : "You're signed up for this slot"}
            </div>
          ) : (
            <button
              onClick={handleSignup}
              disabled={signingUp}
              className={`w-full py-3 text-white rounded-[2px] font-medium disabled:opacity-50 ${
                isFull ? "bg-amber-600 hover:bg-amber-700" : "bg-[var(--action)] hover:bg-[var(--action)]"
              }`}
            >
              {signingUp
                ? "Submitting..."
                : isFull
                ? "Join Waitlist"
                : "Sign Up for This Slot"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
