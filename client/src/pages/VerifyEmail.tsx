import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [error, setError] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setError("No verification token provided.");
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
      .then(async () => {
        await refreshUser();
        setStatus("success");
        setTimeout(() => navigate("/dashboard"), 2000);
      })
      .catch((err) => {
        setStatus("error");
        setError(err.message);
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm text-center">
        <Link to="/" className="block text-2xl font-bold italic mb-8">Hourly</Link>
        {status === "verifying" && (
          <div>
            <div className="text-4xl mb-4">⏳</div>
            <h2 className="text-xl font-bold">Verifying your email...</h2>
          </div>
        )}
        {status === "success" && (
          <div>
            <div className="text-4xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-green-700">Email verified!</h2>
            <p className="text-gray-600 mt-2">Redirecting to your dashboard...</p>
          </div>
        )}
        {status === "error" && (
          <div>
            <div className="text-4xl mb-4">❌</div>
            <h2 className="text-xl font-bold text-red-700">Verification failed</h2>
            <p className="text-gray-600 mt-2">{error}</p>
            <Link to="/login" className="mt-4 inline-block text-blue-600 hover:underline">Back to Sign In</Link>
          </div>
        )}
      </div>
    </div>
  );
}
