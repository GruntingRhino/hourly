import { useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";

export default function EmailVerificationRequired() {
  const { user, logout } = useAuth();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState("");

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold italic mb-8">GoodHours</h1>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="text-4xl mb-4">✉️</div>
          <h2 className="text-xl font-bold mb-2">Verify your email</h2>
          <p className="text-gray-600 text-sm mb-4">
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
            className="w-full py-2 bg-gray-900 text-white rounded-md font-medium hover:bg-gray-800 disabled:opacity-50 mb-3"
          >
            {resending ? "Sending..." : "Resend verification email"}
          </button>

          <button onClick={logout} className="w-full py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50">
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
