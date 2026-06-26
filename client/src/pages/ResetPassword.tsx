import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--surface-alt)] px-4">
        <div className="text-center">
          <div className="text-4xl mb-4">❌</div>
          <h2 className="text-[20px] font-semibold text-[var(--er-t)]">Invalid reset link</h2>
          <p className="text-[var(--text-sec)] mt-2 text-sm">This link is missing a token.</p>
          <Link to="/forgot-password" className="mt-4 inline-block text-[var(--action)] hover:underline text-sm">
            Request a new reset link
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      setSuccess(true);
      setTimeout(() => navigate("/login"), 2500);
    } catch (err: any) {
      setError(err.message || "Reset failed. The link may have expired.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--surface-alt)] px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="block text-center text-[28px] font-bold italic mb-8">
          GoodHours
        </Link>
        <div className="bg-[var(--surface)] rounded-[3px] border border-[var(--border)] p-6">
          {success ? (
            <div className="text-center">
              <div className="text-4xl mb-4">✅</div>
              <h2 className="text-[20px] font-semibold text-[var(--ok-t)]">Password reset!</h2>
              <p className="text-[var(--text-sec)] text-sm mt-2">Redirecting to sign in...</p>
            </div>
          ) : (
            <>
              <h2 className="text-[20px] font-semibold mb-6 text-center">Set new password</h2>

              {error && (
                <div className="mb-4 p-3 bg-[var(--er-bg)] border border-[var(--er-b)] rounded-[2px] text-[var(--er-t)] text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-1">
                    New password <span className="text-[var(--text-faint)] font-normal">(min 8 characters)</span>
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-[var(--action)]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-1">Confirm new password</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-[var(--action)]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-[7px] bg-[var(--action)] text-white rounded-[2px] font-medium hover:opacity-85 disabled:opacity-50"
                >
                  {loading ? "Resetting..." : "Reset Password"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
