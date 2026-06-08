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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
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
          <span className="hidden text-2xl font-bold text-blue-700">GoodHours</span>
        </Link>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-2xl">✉️</div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Verify your email</h2>
          <p className="text-gray-600 text-sm mb-5 break-words">
            A verification link was sent to <strong>{user?.email}</strong>. Check your inbox and click the link to activate your account.
          </p>

          {resent && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">
              Verification email resent — check your inbox.
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleResend}
            disabled={resending}
            className="w-full py-[9px] bg-blue-600 text-white rounded-lg font-medium hover:opacity-85 disabled:opacity-50 mb-3"
          >
            {resending ? "Sending..." : "Resend verification email"}
          </button>

          {(import.meta.env.DEV && import.meta.env.VITE_APP_ENV !== "production") && (
            <button
              onClick={handleBypassVerification}
              disabled={bypassing}
              className="w-full py-[9px] bg-yellow-500 text-white rounded-lg font-medium hover:bg-yellow-600 disabled:opacity-50 mb-3 text-sm"
            >
              {bypassing ? "Bypassing..." : "[Dev] Skip email verification"}
            </button>
          )}

          <button onClick={handleSignIn} className="w-full py-[9px] border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
            Sign in here
          </button>
        </div>
      </div>
    </div>
  );
}
