import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import type { User } from "../../hooks/useAuth";
import { api, getErrorMessage } from "../../lib/api";

const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (value: string) => value.length >= 8 },
  { label: "One uppercase letter", test: (value: string) => /[A-Z]/.test(value) },
  { label: "One lowercase letter", test: (value: string) => /[a-z]/.test(value) },
  { label: "One number", test: (value: string) => /[0-9]/.test(value) },
  { label: "One special character", test: (value: string) => /[^a-zA-Z0-9]/.test(value) },
];

type InvitationInfo = {
  beneficiaryName: string;
  email: string;
  hasExistingAccount: boolean;
};

type AuthResult = {
  token: string;
  user: User;
};

export default function JoinBeneficiaryAdmin() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithToken, refreshUser, user } = useAuth();
  const token = searchParams.get("token") ?? "";
  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const acceptingExistingAccount = useRef(false);
  const passwordOk = PASSWORD_RULES.every((rule) => rule.test(password));

  useEffect(() => {
    if (!token) {
      setError("No administrator invitation token was provided.");
      setLoading(false);
      return;
    }
    api.get<InvitationInfo>(`/invitations/beneficiary-admin?token=${encodeURIComponent(token)}`)
      .then(setInvitation)
      .catch((err: unknown) => setError(getErrorMessage(err, "This administrator invitation is invalid or expired.")))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!user || !token || !invitation || acceptingExistingAccount.current) return;
    acceptingExistingAccount.current = true;
    setSubmitting(true);
    api.post(`/beneficiaries/admin-invitations/${token}/accept`)
      .then(async () => {
        await refreshUser();
        navigate("/dashboard", { replace: true });
      })
      .catch((err: unknown) => {
        acceptingExistingAccount.current = false;
        setError(getErrorMessage(err, "This administrator invitation could not be accepted."));
      })
      .finally(() => setSubmitting(false));
  }, [invitation, navigate, refreshUser, token, user]);

  const createAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!passwordOk) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await api.post<AuthResult>("/invitations/beneficiary-admin/accept", { token, name, password });
      loginWithToken(result.token, result.user);
      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Unable to create the administrator account."));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-[var(--text-sec)]">Loading invitation...</div>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--surface-alt)] px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="flex justify-center mb-8"><img src="/logo-full.png" alt="GoodHours" className="h-10 w-auto" /></Link>
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-8">
          <h1 className="text-2xl font-semibold text-[var(--text)] mb-2">Join the organization team</h1>
          {invitation && <p className="text-sm text-[var(--text-sec)] mb-5"><strong>{invitation.beneficiaryName}</strong> invited <strong>{invitation.email}</strong> to help administer its GoodHours workspace.</p>}
          {error && <div role="alert" className="mb-4 p-3 bg-[var(--er-bg)] border border-[var(--er-b)] rounded text-[var(--er-t)] text-sm">{error}</div>}

          {invitation?.hasExistingAccount ? (
            <div className="space-y-3">
              <p className="text-sm text-[var(--text-sec)]">An account already exists for this email. Sign in to accept the invitation.</p>
              <Link to={`/login?adminInvitation=${encodeURIComponent(token)}`} className="flex justify-center w-full py-[10px] bg-[var(--action)] text-white rounded-[3px] font-medium text-sm">Sign in and accept</Link>
            </div>
          ) : invitation ? (
            <form onSubmit={createAccount} className="space-y-4">
              <div><label className="block text-sm font-medium mb-1">Your name</label><input required value={name} onChange={(event) => setName(event.target.value)} className="w-full px-3 py-2.5 border border-[var(--border-s)] rounded-[3px] text-sm" /></div>
              <div>
                <label className="block text-sm font-medium mb-1">Password</label>
                <input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full px-3 py-2.5 border border-[var(--border-s)] rounded-[3px] text-sm" />
                {password.length > 0 && <ul className="mt-2 space-y-0.5">{PASSWORD_RULES.map((rule) => <li key={rule.label} className={`text-xs ${rule.test(password) ? "text-[var(--ok-t)]" : "text-[var(--text-faint)]"}`}>{rule.test(password) ? "✓" : "○"} {rule.label}</li>)}</ul>}
              </div>
              <button disabled={submitting || !passwordOk} className="w-full py-[10px] bg-[var(--action)] text-white rounded-[3px] font-medium text-sm disabled:opacity-50">{submitting ? "Creating account..." : "Accept and create account"}</button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
