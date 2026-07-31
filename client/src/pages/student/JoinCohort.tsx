import { useEffect, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { api, getErrorMessage } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";
import type { User } from "../../hooks/useAuth";

const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "One lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "One number", test: (p: string) => /[0-9]/.test(p) },
  { label: "One special character", test: (p: string) => /[^a-zA-Z0-9]/.test(p) },
];

interface InvitationInfo {
  email: string;
  name: string | null;
  grade: string | null;
  house: string | null;
  cohortName: string;
  schoolName: string;
  schoolId: string;
}

interface AuthResult {
  token: string;
  user: User;
}

export default function JoinCohort() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();

  const token = searchParams.get("token") || "";
  const [invInfo, setInvInfo] = useState<InvitationInfo | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const passwordOk = PASSWORD_RULES.every((r) => r.test(password));

  useEffect(() => {
    if (!token) {
      setLoadError("No invitation token found. Check your email invitation link.");
      setLoading(false);
      return;
    }
    api.get<InvitationInfo>(`/invitations/student?token=${token}`)
      .then((info) => {
        setInvInfo(info);
        if (info.name) setName(info.name);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setLoadError(getErrorMessage(err, "Invalid or expired invitation link."));
        setLoading(false);
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordOk) { setError("Password does not meet all requirements"); return; }
    setError("");
    setSubmitting(true);
    try {
      const result = await api.post<AuthResult>("/invitations/student/accept", {
        token,
        name,
        password,
      });
      loginWithToken(result.token, result.user);
      navigate("/dashboard");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Enrollment failed. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--surface-alt)]">
        <div className="text-[var(--text-sec)]">Loading invitation...</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--surface-alt)] px-4">
        <div className="max-w-sm w-full text-center">
          <Link to="/" className="block text-[20px] font-semibold italic mb-8">GoodHours</Link>
          <div className="bg-[var(--surface)] rounded-[3px] border border-[var(--border)] p-6">
            <h2 className="text-[16px] font-semibold mb-2 text-[var(--er-t)]">Invitation Error</h2>
            <p className="text-sm text-[var(--text-sec)]">{loadError}</p>
            <p className="text-xs text-[var(--text-faint)] mt-4">Contact your school administrator for a new invitation.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--surface-alt)] px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="block text-center text-[20px] font-semibold italic mb-8">GoodHours</Link>
        <div className="bg-[var(--surface)] rounded-[3px] border border-[var(--border)] p-6">
          <div className="mb-4 p-3 bg-[var(--in-bg)] border border-blue-100 rounded text-sm text-[var(--navy)] text-center">
            <div className="font-semibold">{invInfo?.schoolName}</div>
            <div className="text-xs mt-0.5">{invInfo?.cohortName}</div>
          </div>

          <h2 className="text-[20px] font-semibold mb-1">Create Your Account</h2>
          <p className="text-sm text-[var(--text-sec)] mb-4">You're joining as <strong>{invInfo?.email}</strong></p>

          {error && <div className="mb-3 p-3 bg-[var(--er-bg)] border border-[var(--er-b)] rounded text-[var(--er-t)] text-sm">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">Your Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--action)]"
              />
            </div>
            {(invInfo?.grade || invInfo?.house) && (
              <div className="rounded-[2px] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-sm text-[var(--text-sec)]">
                {invInfo.grade && <div>Grade: <strong>{invInfo.grade}</strong></div>}
                {invInfo.house && <div>House: <strong>{invInfo.house}</strong></div>}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--action)]"
              />
              {password.length > 0 && (
                <ul className="mt-2 space-y-0.5">
                  {PASSWORD_RULES.map((r) => (
                    <li key={r.label} className={`text-xs flex items-center gap-1.5 ${r.test(password) ? "text-[var(--ok-t)]" : "text-[var(--text-faint)]"}`}>
                      <span>{r.test(password) ? "✓" : "○"}</span> {r.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              type="submit"
              disabled={submitting || !passwordOk}
              className="w-full py-[7px] bg-[var(--action)] text-white rounded-[2px] font-medium hover:opacity-85 disabled:opacity-50 text-sm"
            >
              {submitting ? "Creating account..." : "Join Cohort"}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-[var(--text-sec)]">
            Already have an account?{" "}
            <Link to="/login" className="text-[var(--action)] hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
