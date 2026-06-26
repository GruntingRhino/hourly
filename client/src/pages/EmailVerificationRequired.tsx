import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";

export default function EmailVerificationRequired() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [bypassing, setBypassing] = useState(false);
  const [error, setError] = useState("");

  const handleBypassVerification = async () => {
    setBypassing(true);
    setError("");
    try {
      await api.post("/auth/dev/bypass-email-verification", {});
      await refreshUser();
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Bypass failed.");
    } finally {
      setBypassing(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError("");
    try {
      await api.post("/auth/resend-verification", {});
      setResent(true);
    } catch (err: any) {
      setError(err.message || "Failed to resend. Please try again.");
    } finally {
      setResending(false);
    }
  };

  const handleSignIn = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--surface-alt)] px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="flex justify-center mb-8">
          <img
            src="/logo-full.png"
            alt="GoodHours"
            className="h-10 w-auto"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
              (e.currentTarget.nextElementSibling as HTMLElement)!.style.display = "block";
            }}
          />
          <span className="hidden text-[20px] font-semibold text-[var(--action)]">GoodHours</span>
        </Link>

        <div className="bg-[var(--surface)] rounded-[3px] border border-[var(--border)]  p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--in-bg)] text-2xl">✉️</div>
          <h2 className="text-2xl font-semibold text-[var(--text)] mb-2">Verify your email</h2>
          <p className="text-[var(--text-sec)] text-sm mb-5 break-words">
            A verification link was sent to <strong>{user?.email}</strong>. Check your inbox and click the link to activate your account.
          </p>

          {resent && (
            <div className="mb-4 p-3 bg-[var(--ok-bg)] border border-[var(--ok-b)] rounded-[2px] text-[var(--ok-t)] text-sm">
              Verification email resent — check your inbox.
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-[var(--er-bg)] border border-[var(--er-b)] rounded-[2px] text-[var(--er-t)] text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleResend}
            disabled={resending}
            className="w-full py-[9px] bg-[var(--action)] text-white rounded-[3px] font-medium hover:opacity-85 disabled:opacity-50 mb-3"
          >
            {resending ? "Sending..." : "Resend verification email"}
          </button>

          {(import.meta.env.DEV && import.meta.env.VITE_APP_ENV !== "production") && (
            <button
              onClick={handleBypassVerification}
              disabled={bypassing}
              className="w-full py-[9px] bg-[var(--wn-bg)]0 text-white rounded-[3px] font-medium hover:bg-yellow-600 disabled:opacity-50 mb-3 text-sm"
            >
              {bypassing ? "Bypassing..." : "[Dev] Skip email verification"}
            </button>
          )}

          <button onClick={handleSignIn} className="w-full py-[9px] border border-[var(--border-s)] rounded-[3px] text-sm hover:bg-[var(--surface-alt)]">
            Sign in here
          </button>
        </div>
      </div>
    </div>
  );
}
