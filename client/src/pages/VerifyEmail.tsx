import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { getErrorMessage } from "../lib/api";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();

  const [status, setStatus] = useState<"verifying" | "success" | "error">(token ? "verifying" : "error");
  const [error, setError] = useState(token ? "" : "No verification token provided.");

  useEffect(() => {
    if (!token) {
      return;
    }

    fetch(`/api/auth/verify-email?token=${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Verification failed");
        }
        return res.json();
      })
      .then(() => {
        setStatus("success");
        setTimeout(() => navigate("/login"), 3000);
      })
      .catch((err) => {
        setStatus("error");
        setError(getErrorMessage(err, "Request failed."));
      });
  }, [navigate, token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--surface-alt)] px-4">
      <div className="w-full max-w-sm text-center">
        <Link to="/" className="block text-[20px] font-semibold italic mb-8">GoodHours</Link>
        {status === "verifying" && (
          <div>
            <div className="text-4xl mb-4">⏳</div>
            <h2 className="text-[20px] font-semibold">Verifying your email...</h2>
          </div>
        )}
        {status === "success" && (
          <div>
            <div className="text-4xl mb-4">✅</div>
            <h2 className="text-[20px] font-semibold text-[var(--ok-t)]">Email verified!</h2>
            <p className="text-[var(--text-sec)] mt-2">Mailbox verified. School ownership review is still required before sign-in.</p>
          </div>
        )}
        {status === "error" && (
          <div>
            <div className="text-4xl mb-4">❌</div>
            <h2 className="text-[20px] font-semibold text-[var(--er-t)]">Verification failed</h2>
            <p className="text-[var(--text-sec)] mt-2">{error}</p>
            <Link to="/login" className="mt-4 inline-block text-[var(--action)] hover:underline">Back to Sign In</Link>
          </div>
        )}
      </div>
    </div>
  );
}
