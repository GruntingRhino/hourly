import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, getErrorMessage } from "../lib/api";
import { useAuth } from "../hooks/useAuth";

export default function AgeEligibility() {
  const { logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!confirmed) {
      setError("Please confirm that you are 13 or older to continue.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await api.post("/auth/eligibility/attest", { eligible13Plus: true });
      await refreshUser();
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, "We could not save your eligibility confirmation."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-6 py-12">
      <section className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--action)]">Account setup</p>
        <h1 className="mt-2 text-2xl font-bold text-[var(--text)]">Confirm your eligibility</h1>
        <p className="mt-4 text-[var(--text-sec)]">GoodHours is available to people who are 13 or older. Confirm this before continuing. We do not ask you to provide your date of birth or identity documents here.</p>
        {error && <p role="alert" className="mt-4 rounded border border-[var(--er-b)] bg-[var(--er-bg)] p-3 text-sm text-[var(--er-t)]">{error}</p>}
        <form onSubmit={submit} className="mt-6 space-y-5">
          <label className="flex items-start gap-3 text-sm text-[var(--text)]">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1 h-4 w-4" />
            <span>I confirm that I am 13 or older.</span>
          </label>
          <button type="submit" disabled={submitting || !confirmed} className="w-full rounded px-4 py-2 font-medium text-white disabled:opacity-50" style={{ background: "var(--action)" }}>
            {submitting ? "Saving…" : "Continue"}
          </button>
        </form>
        <button type="button" onClick={logout} className="mt-4 w-full rounded border border-[var(--border)] px-4 py-2 text-sm text-[var(--text)]">Sign out</button>
      </section>
    </main>
  );
}
