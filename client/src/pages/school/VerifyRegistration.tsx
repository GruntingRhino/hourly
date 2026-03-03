import { useEffect, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";

export default function SchoolVerifyRegistration() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setErrorMsg("No verification token found in the link.");
      return;
    }
    api.get<any>(`/auth/google/verify-school?token=${token}`)
      .then((result) => {
        loginWithToken(result.token, result.user);
        setStatus("success");
        setTimeout(() => navigate("/dashboard"), 2000);
      })
      .catch((err) => {
        setStatus("error");
        setErrorMsg(err.message || "Verification failed. The link may have expired.");
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm text-center">
        <Link to="/" className="block text-2xl font-bold italic mb-8">GoodHours</Link>
        {status === "verifying" && (
          <div className="text-gray-500">Verifying your school registration...</div>
        )}
        {status === "success" && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold mb-2">School Verified!</h2>
            <p className="text-sm text-gray-600">Your school has been registered on GoodHours. Redirecting to your dashboard...</p>
          </div>
        )}
        {status === "error" && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold mb-2">Verification Failed</h2>
            <p className="text-sm text-gray-600 mb-4">{errorMsg}</p>
            <Link to="/school/register" className="text-blue-600 hover:underline text-sm">Restart Registration</Link>
          </div>
        )}
      </div>
    </div>
  );
}
