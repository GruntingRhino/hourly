import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getErrorMessage } from "../lib/api";

type Confirmation = {
  requiresConfirmation: boolean;
  alreadyCancelled?: boolean;
  opportunityTitle: string;
  date?: string;
  startTime?: string;
  endTime?: string;
};

export default function CancelSignup() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<"loading" | "confirming" | "cancelling" | "done" | "error">("loading");
  const [error, setError] = useState("");
  const [info, setInfo] = useState<Confirmation | null>(null);
  const [resultMessage, setResultMessage] = useState("");

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("No cancellation link provided.");
      return;
    }

    fetch(`/api/beneficiaries/cancel/${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "This cancellation link is invalid or has expired.");
        return data as Confirmation;
      })
      .then((data) => {
        setInfo(data);
        setStatus(data.requiresConfirmation ? "confirming" : "done");
        if (!data.requiresConfirmation && data.alreadyCancelled) {
          setResultMessage(`You were already cancelled from "${data.opportunityTitle}".`);
        }
      })
      .catch((err) => {
        setStatus("error");
        setError(getErrorMessage(err, "Request failed."));
      });
  }, [token]);

  const confirmCancel = () => {
    if (!token) return;
    setStatus("cancelling");
    fetch(`/api/beneficiaries/cancel/${token}`, { method: "POST" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Cancellation failed.");
        return data as { message: string };
      })
      .then((data) => {
        setResultMessage(data.message);
        setStatus("done");
      })
      .catch((err) => {
        setStatus("error");
        setError(getErrorMessage(err, "Request failed."));
      });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--surface-alt)] px-4">
      <div className="w-full max-w-sm text-center">
        <Link to="/" className="block text-[20px] font-semibold italic mb-8">GoodHours</Link>

        {status === "loading" && (
          <div>
            <div className="text-4xl mb-4">⏳</div>
            <h2 className="text-[20px] font-semibold">Looking up your signup...</h2>
          </div>
        )}

        {status === "confirming" && info && (
          <div>
            <h2 className="text-[20px] font-semibold">Cancel this signup?</h2>
            <p className="text-[var(--text-sec)] mt-2">
              {info.opportunityTitle}
              {info.date && ` — ${new Date(info.date).toLocaleDateString()}`}
              {info.startTime && info.endTime && ` (${info.startTime}–${info.endTime})`}
            </p>
            <button
              onClick={confirmCancel}
              className="mt-6 w-full rounded-md bg-[var(--er-t)] text-white py-2 font-medium hover:opacity-90"
            >
              Yes, cancel my spot
            </button>
            <Link to="/" className="mt-3 block text-[var(--action)] hover:underline">Never mind</Link>
          </div>
        )}

        {status === "cancelling" && (
          <div>
            <div className="text-4xl mb-4">⏳</div>
            <h2 className="text-[20px] font-semibold">Cancelling...</h2>
          </div>
        )}

        {status === "done" && (
          <div>
            <div className="text-4xl mb-4">✅</div>
            <h2 className="text-[20px] font-semibold">{resultMessage || "You've been cancelled."}</h2>
          </div>
        )}

        {status === "error" && (
          <div>
            <div className="text-4xl mb-4">❌</div>
            <h2 className="text-[20px] font-semibold text-[var(--er-t)]">Something went wrong</h2>
            <p className="text-[var(--text-sec)] mt-2">{error}</p>
            <Link to="/" className="mt-4 inline-block text-[var(--action)] hover:underline">Back to GoodHours</Link>
          </div>
        )}
      </div>
    </div>
  );
}
