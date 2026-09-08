import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import type { User } from "../hooks/useAuth";
import { api, getErrorMessage } from "../lib/api";

interface AuthResult {
  token: string;
  user: User;
}

export default function Login() {
  const { login, loginWithToken, refreshUser, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);
  const [googleUrl, setGoogleUrl] = useState<string | null>(null);
  const [devGoogleEmail, setDevGoogleEmail] = useState("");
  const [devGoogleLoading, setDevGoogleLoading] = useState(false);
  const acceptingAdminInvitation = useRef(false);
  const justApproved = searchParams.get("approved") === "1";

  useEffect(() => {
    if (!user || acceptingAdminInvitation.current) return;
    const token = searchParams.get("adminInvitation");
    if (!token) { navigate("/dashboard", { replace: true }); return; }
    acceptingAdminInvitation.current = true;
    api.post(`/beneficiaries/admin-invitations/${token}/accept`)
      .then(async () => { await refreshUser(); navigate("/dashboard", { replace: true }); })
      .catch((err: unknown) => {
        acceptingAdminInvitation.current = false;
        setError(getErrorMessage(err, "This administrator invitation could not be accepted."));
      });
  }, [user, navigate, refreshUser, searchParams]);

  useEffect(() => {
    queueMicrotask(() => setGoogleUrl(`${window.location.origin}/api/auth/google/url?state=login`));
    api
      .get<{ url: string }>("/auth/google/url?state=login")
      .then((data) => {
        if (data?.url) setGoogleUrl(data.url);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    if (errorParam) {
      queueMicrotask(() => setError("Google sign-in was cancelled or failed. Please try again."));
      return;
    }
    if (!code) {
      return;
    }

    let cancelled = false;
    queueMicrotask(() => { setLoading(true); setError(""); });

    api
      .post<AuthResult>(`/auth/google/callback${state ? `?state=${encodeURIComponent(state)}` : ""}`, { code })
      .then((result) => {
        if (cancelled) return;
        if (!result.token) {
          throw new Error("No GoodHours account found for this Google account.");
        }
        loginWithToken(result.token, result.user);
        navigate("/dashboard", { replace: true });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(getErrorMessage(err, "Google sign-in failed. Please try again."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [searchParams, loginWithToken, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const nextFieldErrors: { email?: string; password?: string } = {};
    if (!email.trim()) nextFieldErrors.email = "Enter your email address.";
    if (!password) nextFieldErrors.password = "Enter your password.";
    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      if (nextFieldErrors.email) {
        document.getElementById("login-email")?.focus();
      } else {
        document.getElementById("login-password")?.focus();
      }
      return;
    }

    setFieldErrors({});
    setLoading(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Invalid email or password. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleDevGoogleSignin = async () => {
    setError("");
    setDevGoogleLoading(true);
    try {
      const result = await api.post<AuthResult>("/auth/google/dev-signin", {
        email: devGoogleEmail.trim(),
        state: "login",
      });
      if (!result.token) {
        throw new Error("No GoodHours account found for this Google account.");
      }
      loginWithToken(result.token, result.user);
      navigate("/dashboard");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Dev Google sign-in failed."));
    } finally {
      setDevGoogleLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <Link to="/" className="flex justify-center mb-7">
          <img
            src="/logo-full.png"
            alt="GoodHours"
            className="h-9 w-auto"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
              (e.currentTarget.nextElementSibling as HTMLElement)!.style.display = "block";
            }}
          />
          <span className="hidden text-[22px] font-bold" style={{ color: "var(--navy)" }}>GoodHours</span>
        </Link>

        <div className="rounded-[3px] border border-[var(--border)] p-7" style={{ background: "var(--surface)" }}>
          <h1 className="text-[18px] font-semibold mb-1 text-center" style={{ color: "var(--text)" }}>Welcome back</h1>
          <p className="text-[13px] text-center mb-6" style={{ color: "var(--text-sec)" }}>Sign in to your GoodHours account</p>

          {justApproved && (
            <div
              role="status"
              className="mb-4 px-4 py-3 rounded-[3px] border border-[var(--ok-b)] text-[13px]"
              style={{ background: "var(--ok-bg)", color: "var(--ok-t)" }}
            >
              Your school was approved. Sign in again to enter your workspace.
            </div>
          )}

          {error && (
            <div
              id="login-error"
              role="alert"
              aria-live="polite"
              className="mb-4 px-4 py-3 rounded-[3px] border border-[var(--er-b)] text-[13px]"
              style={{ background: "var(--er-bg)", color: "var(--er-t)" }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-[13px] font-medium mb-1" style={{ color: "var(--text)" }}>Email</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) {
                    setFieldErrors((prev) => ({ ...prev, email: undefined }));
                  }
                }}
                required
                autoComplete="email"
                className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)]"
                style={{
                  background: "var(--surface)",
                  color: "var(--text)",
                  borderColor: fieldErrors.email ? "var(--er-b)" : undefined,
                }}
                placeholder="you@school.edu or your email"
                aria-invalid={fieldErrors.email ? "true" : "false"}
                aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
              />
              {fieldErrors.email && (
                <p id="login-email-error" className="mt-1 text-[12px]" style={{ color: "var(--er-t)" }}>
                  {fieldErrors.email}
                </p>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="login-password" className="text-[13px] font-medium" style={{ color: "var(--text)" }}>Password</label>
                <Link
                  to="/forgot-password"
                  className="text-[12px] hover:underline"
                  style={{ color: "var(--action)" }}
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) {
                      setFieldErrors((prev) => ({ ...prev, password: undefined }));
                    }
                  }}
                  required
                  autoComplete="current-password"
                  className="w-full h-[34px] px-3 pr-9 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)]"
                  style={{
                    background: "var(--surface)",
                    color: "var(--text)",
                    borderColor: fieldErrors.password ? "var(--er-b)" : undefined,
                  }}
                  aria-invalid={fieldErrors.password ? "true" : "false"}
                  aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 hover:opacity-70"
                  style={{ color: "var(--text-faint)" }}
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {fieldErrors.password && (
                <p id="login-password-error" className="mt-1 text-[12px]" style={{ color: "var(--er-t)" }}>
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-[34px] text-white rounded-[2px] font-semibold text-[13.5px] disabled:opacity-50 transition-colors"
              style={{ background: "var(--navy)" }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
            <span className="text-[12px] font-medium" style={{ color: "var(--text-faint)" }}>or</span>
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
          </div>

          <button
            onClick={() => googleUrl && (window.location.href = googleUrl)}
            disabled={!googleUrl || loading}
            className="w-full flex items-center justify-center gap-3 px-4 h-[34px] border rounded-[2px] font-medium text-[13px] disabled:opacity-40 transition-colors hover:bg-[var(--surface-alt)]"
            style={{ background: "var(--surface)", borderColor: "var(--border-s)", color: "var(--text)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>

          {(import.meta.env.DEV || import.meta.env.VITE_APP_ENV === "development") && (
            <div className="mt-4 rounded-[3px] border border-[var(--wn-b)] p-4" style={{ background: "var(--wn-bg)" }}>
              <div className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--wn-t)" }}>
                Dev Only
              </div>
              <p className="text-[13px] mb-3" style={{ color: "var(--wn-t)" }}>
                Bypass Google and sign in with any email domain in development.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={devGoogleEmail}
                  onChange={(e) => setDevGoogleEmail(e.target.value)}
                  placeholder="dev@any-domain.test"
                  className="flex-1 h-[34px] px-3 border rounded-[2px] focus:outline-none text-[13px]"
                  style={{ borderColor: "var(--wn-b)", background: "var(--surface)", color: "var(--text)" }}
                />
                <button
                  type="button"
                  onClick={handleDevGoogleSignin}
                  disabled={devGoogleLoading || !devGoogleEmail.trim()}
                  className="px-4 h-[34px] rounded-[2px] font-medium text-[13px] text-white disabled:opacity-50"
                  style={{ background: "#7a4e00" }}
                >
                  {devGoogleLoading ? "Signing in…" : "Dev Google"}
                </button>
              </div>
            </div>
          )}

          <p className="mt-6 text-center text-[13px]" style={{ color: "var(--text-sec)" }}>
            Registering a new school?{" "}
            <Link to="/school/register" className="hover:underline font-medium" style={{ color: "var(--action)" }}>
              Register here
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
