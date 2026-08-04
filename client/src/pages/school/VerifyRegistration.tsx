import { useEffect, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { api, getErrorMessage } from "../../lib/api";

interface VerificationResult {
  requiresSchoolOwnershipReview: true;
  school: {
    id: string;
    name: string;
    verified: false;
    ownershipStatus: "PENDING";
  };
}

export default function SchoolVerifyRegistration() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const [status, setStatus] = useState<"verifying" | "success" | "error">(token ? "verifying" : "error");
  const [errorMsg, setErrorMsg] = useState(token ? "" : "No verification token found in the link.");

  useEffect(() => {
    if (!token) {
      return;
    }
    api.get<VerificationResult>(`/auth/google/verify-school?token=${token}`)
      .then(() => {
        setStatus("success");
        setTimeout(() => navigate("/login"), 4000);
      })
      .catch((err: unknown) => {
        setStatus("error");
        setErrorMsg(getErrorMessage(err, "Verification failed. The link may have expired."));
      });
  }, [navigate, token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--surface-alt)] px-4">
      <div className="w-full max-w-sm text-center">
        <Link to="/" className="block text-2xl font-bold italic mb-8">GoodHours</Link>
        {status === "verifying" && (
          <div className="text-[var(--text-sec)]">Verifying your school registration...</div>
        )}
        {status === "success" && (
          <div className="bg-[var(--surface)] rounded-[3px] border border-[var(--border)] p-6">
            <div className="w-12 h-12 rounded-full bg-[var(--ok-bg)] flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-[var(--ok-t)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold mb-2">School contact verified</h2>
            <p className="text-sm text-[var(--text-sec)]">Your authority claim is pending independent review. No school-administrator access is available until it is approved.</p>
          </div>
        )}
        {status === "error" && (
          <div className="bg-[var(--surface)] rounded-[3px] border border-[var(--border)] p-6">
            <div className="w-12 h-12 rounded-full bg-[var(--er-bg)] flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-[var(--er-t)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold mb-2">Verification Failed</h2>
            <p className="text-sm text-[var(--text-sec)] mb-4">{errorMsg}</p>
            <Link to="/school/register" className="text-[var(--action)] hover:underline text-sm">Restart Registration</Link>
          </div>
        )}
      </div>
    </div>
  );
}
