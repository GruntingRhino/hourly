import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";

export default function Login() {
  const { login, loginWithToken, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleUrl, setGoogleUrl] = useState<string | null>(null);
  const [devGoogleEmail, setDevGoogleEmail] = useState("");
  const [devGoogleLoading, setDevGoogleLoading] = useState(false);

  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    api
      .get<{ url: string }>("/auth/google/url?state=login")
      .then((data) => setGoogleUrl(data.url))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    if (errorParam) {
      setError("Google sign-in was cancelled or failed. Please try again.");
      return;
    }
    if (!code) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    api
      .post<any>(`/auth/google/callback${state ? `?state=${encodeURIComponent(state)}` : ""}`, { code })
      .then((result) => {
        if (cancelled) return;
        if (!result.token) {
          throw new Error("No GoodHours account found for this Google account.");
        }
        loginWithToken(result.token, result.user);
        navigate("/dashboard", { replace: true });
      })
      .catch((err: any) => {
        if (cancelled) return;
        setError(err.message || "Google sign-in failed. Please try again.");
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
    setLoading(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDevGoogleSignin = async () => {
    setError("");
    setDevGoogleLoading(true);
    try {
      const result = await api.post<any>("/auth/google/dev-signin", {
        email: devGoogleEmail.trim(),
        state: "login",
      });
      if (!result.token) {
        throw new Error("No GoodHours account found for this Google account.");
      }
      loginWithToken(result.token, result.user);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Dev Google sign-in failed.");
    } finally {
      setDevGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
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

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
          <h2 className="text-xl font-bold mb-1 text-center text-gray-900">Welcome back</h2>
          <p className="text-sm text-gray-500 text-center mb-6">Sign in to your GoodHours account</p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="you@school.edu"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-gray-700">Password</label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-blue-600 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
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
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <button
            onClick={() => googleUrl && (window.location.href = googleUrl)}
            disabled={!googleUrl || loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-white border border-gray-300 rounded-lg font-medium text-sm hover:bg-gray-50 text-gray-700 disabled:opacity-40 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>

          {(import.meta.env.DEV || import.meta.env.VITE_APP_ENV === "development") && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-amber-800 mb-2">
                Dev Only
              </div>
              <p className="text-sm text-amber-900 mb-3">
                Bypass Google and sign in with any email domain in development.
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={devGoogleEmail}
                  onChange={(e) => setDevGoogleEmail(e.target.value)}
                  placeholder="dev@any-domain.test"
                  className="flex-1 h-9 px-3 border border-amber-200 rounded-md focus:outline-none focus:border-amber-400 text-[13.5px]"
                />
                <button
                  type="button"
                  onClick={handleDevGoogleSignin}
                  disabled={devGoogleLoading || !devGoogleEmail.trim()}
                  className="px-4 h-9 bg-amber-600 text-white rounded-md font-medium text-[13.5px] disabled:opacity-50"
                >
                  {devGoogleLoading ? "Signing in…" : "Dev Google"}
                </button>
              </div>
            </div>
          )}

          <p className="mt-6 text-center text-sm text-gray-500">
            Registering a new school?{" "}
            <Link to="/school/register" className="text-blue-600 hover:underline font-medium">
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
