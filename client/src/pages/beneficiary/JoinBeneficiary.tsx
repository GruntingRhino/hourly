import { useEffect, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";

const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "One lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "One number", test: (p: string) => /[0-9]/.test(p) },
  { label: "One special character", test: (p: string) => /[^a-zA-Z0-9]/.test(p) },
];

interface InvInfo {
  beneficiaryName: string;
  schoolName: string;
  sentTo: string;
  beneficiaryId: string;
}

export default function JoinBeneficiary() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();

  const token = searchParams.get("token") || "";
  const [invInfo, setInvInfo] = useState<InvInfo | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [declined, setDeclined] = useState(false);
  const [declining, setDeclining] = useState(false);

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const passwordOk = PASSWORD_RULES.every((r) => r.test(password));

  useEffect(() => {
    if (!token) {
      setLoadError("No invitation token found.");
      setLoading(false);
      return;
    }
    api.get<InvInfo>(`/invitations/beneficiary?token=${token}`)
      .then((info) => {
        setInvInfo(info);
        setLoading(false);
      })
      .catch((err) => {
        setLoadError(err.message || "Invalid or expired invitation link.");
        setLoading(false);
      });
  }, [token]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordOk) { setError("Password does not meet all requirements"); return; }
    setError("");
    setSubmitting(true);
    try {
      const result = await api.post<any>("/invitations/beneficiary/accept", { token, name, password });
      loginWithToken(result.token, result.user);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to accept invitation.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    setDeclining(true);
    try {
      await api.post("/invitations/beneficiary/decline", { token });
      setDeclined(true);
    } catch (err: any) {
      setError(err.message || "Failed to decline invitation.");
    } finally {
      setDeclining(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[var(--surface-alt)]"><div className="text-[var(--text-sec)]">Loading invitation...</div></div>;

  if (loadError) return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--surface-alt)] px-4">
      <div className="max-w-md w-full">
        <Link to="/" className="flex justify-center mb-8">
          <img src="/logo-full.png" alt="GoodHours" className="h-10 w-auto"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; (e.currentTarget.nextElementSibling as HTMLElement)!.style.display = "block"; }} />
          <span className="hidden text-[20px] font-semibold text-[var(--action)]">GoodHours</span>
        </Link>
        <div className="bg-white rounded-[3px] border border-[var(--border)]  p-8 text-center">
          <h2 className="text-xl font-semibold mb-2 text-[var(--er-t)]">Invitation Error</h2>
          <p className="text-sm text-[var(--text-sec)] break-words">{loadError}</p>
        </div>
      </div>
    </div>
  );

  if (declined) return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--surface-alt)] px-4">
      <div className="max-w-md w-full">
        <Link to="/" className="flex justify-center mb-8">
          <img src="/logo-full.png" alt="GoodHours" className="h-10 w-auto"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; (e.currentTarget.nextElementSibling as HTMLElement)!.style.display = "block"; }} />
          <span className="hidden text-[20px] font-semibold text-[var(--action)]">GoodHours</span>
        </Link>
        <div className="bg-white rounded-[3px] border border-[var(--border)]  p-8 text-center">
          <h2 className="text-xl font-semibold mb-2 text-[var(--text)]">Invitation Declined</h2>
          <p className="text-sm text-[var(--text-sec)] break-words">You declined the partnership from {invInfo?.schoolName}. You can contact them if you change your mind.</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--surface-alt)] px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="flex justify-center mb-8">
          <img src="/logo-full.png" alt="GoodHours" className="h-10 w-auto"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; (e.currentTarget.nextElementSibling as HTMLElement)!.style.display = "block"; }} />
          <span className="hidden text-[20px] font-semibold text-[var(--action)]">GoodHours</span>
        </Link>
        <div className="bg-white rounded-[3px] border border-[var(--border)]  p-8">
          <div className="mb-5 rounded-[3px] border border-blue-100 bg-[var(--in-bg)] px-4 py-3 text-sm text-[var(--navy)] text-center">
            <div className="font-semibold break-words">{invInfo?.schoolName}</div>
            <div className="text-xs mt-1 text-[var(--action)]">has invited <strong>{invInfo?.beneficiaryName}</strong> to partner</div>
          </div>

          <h2 className="text-2xl font-semibold text-[var(--text)] mb-1">Accept Partnership</h2>
          <p className="text-sm text-[var(--text-sec)] mb-5 break-words">
            Create your administrator account for <strong>{invInfo?.beneficiaryName}</strong>.<br />
            Account email: <strong>{invInfo?.sentTo}</strong>
          </p>

          {error && <div className="mb-3 p-3 bg-[var(--er-bg)] border border-[var(--er-b)] rounded text-[var(--er-t)] text-sm">{error}</div>}

          <form onSubmit={handleAccept} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">Your Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
                className="w-full px-3 py-2.5 border border-[var(--border-s)] rounded-[3px] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--action)]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                className="w-full px-3 py-2.5 border border-[var(--border-s)] rounded-[3px] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--action)]" />
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
            <button type="submit" disabled={submitting || !passwordOk}
              className="w-full py-[10px] bg-[var(--action)] text-white rounded-[3px] font-medium hover:opacity-85 disabled:opacity-50 text-sm">
              {submitting ? "Creating account..." : "Accept & Create Account"}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button onClick={handleDecline} disabled={declining}
              className="text-xs text-[var(--text-faint)] hover:text-[var(--er-t)] underline">
              {declining ? "Declining..." : "Decline this invitation"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
