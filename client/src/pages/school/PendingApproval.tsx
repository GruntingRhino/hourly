import { useEffect, useState } from "react";
import { api, getErrorMessage } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../components/useToast";

export default function PendingApproval() {
  const { user, logout, refreshUser } = useAuth();
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const schoolName = user?.school?.name || "your school";

  useEffect(() => {
    if (cooldownUntil <= 0) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [cooldownUntil]);

  const resend = async () => {
    setSending(true);
    setMessage("");
    try {
      const result = await api.post<{ message: string; retryAfterSeconds?: number }>("/auth/ownership-approval/resend");
      setMessage(result.message);
      const seconds = result.retryAfterSeconds ?? 900;
      setCooldownUntil(Date.now() + seconds * 1000);
    } catch (err) {
      const retryAfterSeconds = typeof err === "object" && err !== null && "body" in err
        ? Number((err as { body?: { retryAfterSeconds?: number } }).body?.retryAfterSeconds)
        : 0;
      if (retryAfterSeconds > 0) setCooldownUntil(Date.now() + retryAfterSeconds * 1000);
      setMessage(getErrorMessage(err, "The approval email could not be sent."));
      toast(getErrorMessage(err, "The approval email could not be sent."), "error");
    } finally {
      setSending(false);
    }
  };

  const checkApproval = async () => {
    setRefreshing(true);
    try {
      // refreshUser resolves either way; null means /auth/me did not come back.
      const refreshed = await refreshUser();
      if (refreshed) toast("Approval status refreshed.", "success");
      else toast("Could not refresh approval status. Please try again.", "error");
    } catch (err) {
      toast(getErrorMessage(err, "Could not refresh approval status."), "error");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-6 py-12">
      <section className="w-full max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">Setup access</p>
        <h1 className="mt-2 text-2xl font-bold text-[var(--text)]">Your school is awaiting approval</h1>
        <p className="mt-4 text-[var(--text-sec)]">
          Your email and school-domain affiliation are verified. You can finish account setup, but
          school-management and student-data features stay locked until the GoodHours business owner approves {schoolName}.
        </p>
        <p className="mt-3 text-[var(--text-sec)]">
          In production, an approval email is sent to the configured GoodHours business owner. In development,
          the approval email is explicitly bypassed.
        </p>
        <p className="mt-3 text-[var(--text-sec)]">
          The GoodHours business owner reviews your request. Send the approval email now, or resend it after the 15-minute cooldown.
        </p>
        {message && <p className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] p-3 text-sm text-[var(--text-sec)]">{message}</p>}
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="cursor-pointer rounded-lg bg-[var(--accent)] px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" onClick={() => void resend()} disabled={sending || cooldownUntil > now} aria-busy={sending}>
            {sending ? "Sending…" : cooldownUntil > now ? "Email sent — resend in 15 minutes" : "Send approval email"}
          </button>
          <button type="button" className="cursor-pointer rounded-lg border border-[var(--border)] px-4 py-2 font-medium text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-50" onClick={() => void checkApproval()} disabled={refreshing} aria-busy={refreshing}>
            {refreshing ? "Checking…" : "Check approval status"}
          </button>
          <button type="button" className="cursor-pointer rounded-lg border border-[var(--border)] px-4 py-2 font-medium text-[var(--text)]" onClick={logout}>
            Sign out
          </button>
        </div>
      </section>
    </main>
  );
}
