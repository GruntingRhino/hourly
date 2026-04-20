import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";

const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "One lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "One number", test: (p: string) => /[0-9]/.test(p) },
  { label: "One special character", test: (p: string) => /[^a-zA-Z0-9]/.test(p) },
];

interface SchoolEntry {
  id: string;
  name: string;
  type: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  claimed: boolean;
  gradeRange: string | null;
  enrollment: number | null;
}

type Step = "google" | "email-collect" | "search" | "contact" | "sent";
type DomainStatus = "personal" | "edu" | "custom" | null;


// ─── Layer 1: personal email provider blocklist (mirrors server) ─────────────
const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com",
  "yahoo.com", "ymail.com", "yahoo.co.uk", "yahoo.co.in", "yahoo.com.au",
  "yahoo.fr", "yahoo.de", "yahoo.es", "yahoo.it", "yahoo.ca",
  "hotmail.com", "outlook.com", "live.com", "msn.com",
  "hotmail.co.uk", "hotmail.fr", "hotmail.de", "hotmail.es",
  "live.co.uk", "live.fr",
  "icloud.com", "me.com", "mac.com",
  "aol.com", "aim.com", "verizon.net",
  "protonmail.com", "pm.me", "proton.me",
  "tutanota.com", "tuta.com",
  "gmx.com", "gmx.net", "mail.com",
  "zoho.com", "zohomail.com",
  "yandex.com", "yandex.ru",
  "qq.com", "163.com", "126.com",
  "mail.ru", "inbox.com", "rediffmail.com",
  "comcast.net", "att.net", "sbcglobal.net", "cox.net",
]);

function isTestEmail(email: string): boolean {
  return /^abhay\.sivaram(\+[^@]*)?@gmail\.com$/i.test(email);
}

function classifyEmailDomain(email: string): DomainStatus {
  const atIdx = email.indexOf("@");
  if (atIdx < 0) return null;
  const domain = email.slice(atIdx + 1).toLowerCase().trim();
  if (!domain || !domain.includes(".")) return null;
  // Personal emails are only blocked in production
  if (import.meta.env.PROD && PERSONAL_EMAIL_DOMAINS.has(domain) && !isTestEmail(email)) {
    return "personal";
  }
  if (domain.endsWith(".edu")) return "edu";
  return "custom";
}

const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-100 text-gray-900 rounded-sm">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function SchoolRegister() {
  const { loginWithToken, signup } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // "google" = signed up via Google OAuth, "email" = email+password path
  const [signupMode, setSignupMode] = useState<"google" | "email">("google");
  // email-collect step state (email/password path only)
  const [emailCollectName, setEmailCollectName] = useState("");
  const [emailCollectEmail, setEmailCollectEmail] = useState("");
  const [emailCollectPassword, setEmailCollectPassword] = useState("");
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const emailPasswordOk = PASSWORD_RULES.every((r) => r.test(emailCollectPassword));

  // Domain-matched school suggestions (from Google email or email-collect step)
  const [domainSuggestions, setDomainSuggestions] = useState<SchoolEntry[]>([]);

  const [step, setStep] = useState<Step>("google");
  const [googleUrl, setGoogleUrl] = useState<string | null>(null);
  const [registrationToken, setRegistrationToken] = useState("");
  const [userName, setUserName] = useState("");
  const [devGoogleEmail, setDevGoogleEmail] = useState("");
  const [devGoogleName, setDevGoogleName] = useState("");
  const [devGoogleLoading, setDevGoogleLoading] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchState, setSearchState] = useState("");
  const [searchResults, setSearchResults] = useState<SchoolEntry[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [selectedSchool, setSelectedSchool] = useState<SchoolEntry | null>(null);
  const [customSchoolName, setCustomSchoolName] = useState("");
  const [alreadyClaimed, setAlreadyClaimed] = useState<SchoolEntry | null>(null);

  // Contact step
  const [contactEmail, setContactEmail] = useState("");
  const [domainStatus, setDomainStatus] = useState<DomainStatus>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    if (code) handleOAuthCallback(code);
    api.get<{ url: string }>("/auth/google/url").then((d) => setGoogleUrl(d.url)).catch(() => {});
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOAuthCallback = async (code: string) => {
    const isLoginFlow = searchParams.get("state") === "login";
    try {
      const result = await api.post<any>("/auth/google/callback", { code });
      if (result.token && !result.requiresSchoolRegistration) {
        loginWithToken(result.token, result.user);
        navigate("/dashboard");
        return;
      }
      if (result.requiresSchoolRegistration) {
        if (isLoginFlow) {
          setError("No GoodHours account found for this Google account. If you're a school administrator, please register your school first.");
          return;
        }
        setRegistrationToken(result.registrationToken);
        setUserName(result.name);
        if (result.domainSuggestions?.length) {
          setDomainSuggestions(result.domainSuggestions);
        }
        // Pre-fill contact email with the Google account email
        setContactEmail(result.email || "");
        setStep("search");
      }
    } catch (err: any) {
      setError(err.message || "Google sign-in failed. Please try again.");
    }
  };

  const handleDevGoogleSignin = async () => {
    setError("");
    setDevGoogleLoading(true);
    try {
      const result = await api.post<any>("/auth/google/dev-signin", {
        email: devGoogleEmail.trim(),
        name: devGoogleName.trim() || undefined,
      });

      if (result.token && !result.requiresSchoolRegistration) {
        loginWithToken(result.token, result.user);
        navigate("/dashboard");
        return;
      }

      if (result.requiresSchoolRegistration) {
        setRegistrationToken(result.registrationToken);
        setUserName(result.name);
        setDomainSuggestions(result.domainSuggestions || []);
        setContactEmail(result.email || "");
        setStep("search");
        return;
      }

      throw new Error("Dev Google sign-in failed.");
    } catch (err: any) {
      setError(err.message || "Dev Google sign-in failed.");
    } finally {
      setDevGoogleLoading(false);
    }
  };

  const doSearch = useCallback(async (query: string, state: string) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    setSearching(true);
    try {
      const results = await api.get<SchoolEntry[]>(
        `/auth/google/schools?search=${encodeURIComponent(query)}&state=${encodeURIComponent(state)}`
      );
      setSearchResults(results);
      setShowDropdown(results.length > 0);
      setActiveIdx(-1);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleQueryChange = (value: string) => {
    setSearchQuery(value);
    setSelectedSchool(null);
    setAlreadyClaimed(null);
    setActiveIdx(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void doSearch(value, searchState);
    }, 280);
  };

  const handleStateChange = (value: string) => {
    setSearchState(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void doSearch(searchQuery, value);
    }, 280);
  };

  const handleSelectSchool = (school: SchoolEntry) => {
    setShowDropdown(false);
    setSearchQuery(school.name);
    if (school.claimed) {
      setAlreadyClaimed(school);
      setSelectedSchool(null);
    } else {
      setSelectedSchool(school);
      setAlreadyClaimed(null);
      setContactEmail("");
      setStep("contact");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || searchResults.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, searchResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx >= 0 && searchResults[activeIdx]) {
        handleSelectSchool(searchResults[activeIdx]);
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  const handleCustomSchool = () => {
    if (!customSchoolName.trim()) return;
    setSelectedSchool(null);
    setAlreadyClaimed(null);
    setContactEmail("");
    setStep("contact");
  };

  const handleSubmitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const schoolName = selectedSchool?.name || customSchoolName;

      if (signupMode === "email") {
        // Email/password path: create account immediately, then redirect to verify email
        const result = await signup({
          email: emailCollectEmail || contactEmail,
          password: emailCollectPassword,
          name: emailCollectName,
          role: "SCHOOL_ADMIN",
          schoolName,
          directorySchoolId: selectedSchool?.id,
        });
        loginWithToken(result.token, result.user);
        navigate("/email-verification-required");
      } else {
        // Google OAuth path: send magic link to complete registration
        const payload: any = {
          registrationToken,
          schoolName,
          contactEmail,
        };
        if (selectedSchool) payload.directorySchoolId = selectedSchool.id;
        const result = await api.post<any>("/auth/google/register-school", payload);
        setSentTo(result.sentTo || contactEmail);
        setStep("sent");
      }
    } catch (err: any) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Step: Google sign-in ────────────────────────────────────────────────────
  if (step === "google") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm">
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
            <h2 className="text-xl font-bold mb-1 text-gray-900">Register Your School</h2>
            <p className="text-sm text-gray-500 mb-6">
              Create a school administrator account to get started.
            </p>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
            )}
            <button
              onClick={() => googleUrl && (window.location.href = googleUrl)}
              disabled={!googleUrl}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-white border border-gray-300 rounded-lg font-medium text-sm hover:bg-gray-50 text-gray-700 disabled:opacity-40 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            {import.meta.env.DEV && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-amber-800 mb-2">
                  Dev Only
                </div>
                <p className="text-sm text-amber-900 mb-3">
                  Bypass Google and continue with any email domain in development.
                </p>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={devGoogleName}
                    onChange={(e) => setDevGoogleName(e.target.value)}
                    placeholder="Admin name"
                    className="w-full h-10 px-3 border border-amber-200 rounded-lg focus:outline-none focus:border-amber-400 bg-white text-sm"
                  />
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={devGoogleEmail}
                      onChange={(e) => setDevGoogleEmail(e.target.value)}
                      placeholder="admin@any-domain.test"
                      className="flex-1 h-10 px-3 border border-amber-200 rounded-lg focus:outline-none focus:border-amber-400 bg-white text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleDevGoogleSignin}
                      disabled={devGoogleLoading || !devGoogleEmail.trim()}
                      className="px-4 h-10 bg-amber-600 text-white rounded-lg font-medium text-sm disabled:opacity-50"
                    >
                      {devGoogleLoading ? "Working..." : "Dev Google"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="my-5 flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400 font-medium">or</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <button
              onClick={() => { setSignupMode("email"); setStep("email-collect"); }}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 transition-colors"
            >
              Register with email & password
            </button>

            <p className="mt-6 text-center text-sm text-gray-500">
              Already registered?{" "}
              <Link to="/login" className="text-blue-600 hover:underline font-medium">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Step: Email/password — collect name + password ─────────────────────────
  if (step === "email-collect") {
    const handleEmailCollectNext = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!emailPasswordOk) return;
      // Pre-fill contact email and fetch domain suggestions
      setContactEmail(emailCollectEmail);
      const domain = emailCollectEmail.split("@")[1]?.toLowerCase().trim();
      if (domain) {
        try {
          const results = await api.get<SchoolEntry[]>(`/auth/google/schools?domain=${encodeURIComponent(domain)}`);
          if (results.length) setDomainSuggestions(results);
        } catch {}
      }
      setStep("search");
    };
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm">
          <Link to="/" className="flex justify-center mb-8">
            <img src="/logo-full.png" alt="GoodHours" className="h-10 w-auto"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; (e.currentTarget.nextElementSibling as HTMLElement)!.style.display = "block"; }} />
            <span className="hidden text-2xl font-bold text-blue-700">GoodHours</span>
          </Link>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
            <button onClick={() => setStep("google")}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <h2 className="text-xl font-bold mb-1 text-gray-900">Create your account</h2>
            <p className="text-sm text-gray-500 mb-6">Step 1 of 3 — Your credentials</p>

            <form onSubmit={handleEmailCollectNext} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input type="text" value={emailCollectName}
                  onChange={(e) => setEmailCollectName(e.target.value)}
                  required autoComplete="name"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="Jane Smith" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">School Email</label>
                <input type="email" value={emailCollectEmail}
                  onChange={(e) => setEmailCollectEmail(e.target.value)}
                  required autoComplete="email"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="you@yourschool.edu" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <input type={showEmailPassword ? "text" : "password"}
                    value={emailCollectPassword}
                    onChange={(e) => setEmailCollectPassword(e.target.value)}
                    required autoComplete="new-password"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm pr-10" />
                  <button type="button" onClick={() => setShowEmailPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                    {showEmailPassword ? (
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
                {emailCollectPassword && (
                  <ul className="mt-2 space-y-1">
                    {PASSWORD_RULES.map((rule) => (
                      <li key={rule.label}
                        className={`flex items-center gap-1.5 text-xs ${rule.test(emailCollectPassword) ? "text-green-600" : "text-gray-400"}`}>
                        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {rule.test(emailCollectPassword) ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 4h.01" />
                          )}
                        </svg>
                        {rule.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button type="submit" disabled={!emailCollectName.trim() || !emailCollectEmail.trim() || !emailPasswordOk}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors">
                Continue — Find Your School
              </button>
            </form>
            <p className="mt-6 text-center text-sm text-gray-500">
              Already have an account?{" "}
              <Link to="/login" className="text-blue-600 hover:underline font-medium">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Step: Smart school search ───────────────────────────────────────────────
  if (step === "search") {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-8">
        <div className="max-w-lg mx-auto">
          <Link to="/" className="flex justify-center mb-8">
            <img src="/logo-full.png" alt="GoodHours" className="h-10 w-auto"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; (e.currentTarget.nextElementSibling as HTMLElement)!.style.display = "block"; }} />
            <span className="hidden text-2xl font-bold text-blue-700">GoodHours</span>
          </Link>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
            <button
              onClick={() => setStep(signupMode === "email" ? "email-collect" : "google")}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <h2 className="text-xl font-bold mb-1 text-gray-900">Find Your School</h2>
            <p className="text-sm text-gray-500 mb-6">
              {signupMode === "email" ? "Step 2 of 3 — " : "Step 1 of 2 — "}
              Welcome{emailCollectName || userName ? `, ${emailCollectName || userName}` : ""}. Start typing to search.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
            )}

            {/* Domain-matched suggestions */}
            {domainSuggestions.length > 0 && !selectedSchool && !alreadyClaimed && (
              <div className="mb-5">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">
                  Suggested for your domain
                </p>
                <div className="space-y-1.5">
                  {domainSuggestions.map((school) => (
                    <button
                      key={school.id}
                      type="button"
                      onClick={() => handleSelectSchool(school)}
                      className="w-full text-left px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{school.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {[school.city, school.state].filter(Boolean).join(", ")}
                          {school.type ? ` · ${school.type}` : ""}
                          {school.gradeRange ? ` · ${school.gradeRange}` : ""}
                        </div>
                      </div>
                      {school.claimed ? (
                        <span className="shrink-0 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">Registered</span>
                      ) : (
                        <span className="shrink-0 text-xs text-blue-600 font-medium">Select →</span>
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">Or search below for a different school.</p>
              </div>
            )}

            {/* Already-registered banner */}
            {alreadyClaimed && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-sm">
                <strong>{alreadyClaimed.name}</strong> is already registered on GoodHours.
                Contact your school's GoodHours administrator to get access.
              </div>
            )}

            {/* State filter + search input */}
            <div className="flex gap-2 mb-1">
              <select
                value={searchState}
                onChange={(e) => handleStateChange(e.target.value)}
                className="px-2 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-24 shrink-0"
              >
                <option value="">All states</option>
                {US_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                  placeholder="School name or city..."
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8"
                />
                {searching && (
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">...</span>
                )}
                {!searching && searchQuery && (
                  <button
                    onClick={() => { setSearchQuery(""); setSearchResults([]); setShowDropdown(false); setAlreadyClaimed(null); inputRef.current?.focus(); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm leading-none"
                    aria-label="Clear"
                  >
                    ✕
                  </button>
                )}

                {/* Dropdown */}
                {showDropdown && searchResults.length > 0 && (
                  <div
                    ref={dropdownRef}
                    className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-y-auto"
                  >
                    {searchResults.map((school, idx) => (
                      <button
                        key={school.id}
                        onMouseDown={(e) => { e.preventDefault(); handleSelectSchool(school); }}
                        className={`w-full text-left px-3 py-2.5 flex items-start justify-between gap-2 transition-colors ${
                          idx === activeIdx ? "bg-blue-50" : "hover:bg-gray-50"
                        } ${idx > 0 ? "border-t border-gray-100" : ""}`}
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {highlightMatch(school.name, searchQuery)}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {[school.city, school.state].filter(Boolean).join(", ")}
                            {school.type ? ` · ${school.type}` : ""}
                            {school.gradeRange ? ` · ${school.gradeRange}` : ""}
                          </div>
                        </div>
                        {school.claimed ? (
                          <span className="shrink-0 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
                            Registered
                          </span>
                        ) : (
                          <span className="shrink-0 text-xs text-blue-600">
                            Select →
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
              <p className="text-xs text-gray-400 mt-1.5">No schools found for "{searchQuery}"</p>
            )}

            <p className="text-xs text-gray-400 mt-3">
              Results from the National Center for Education Statistics school directory.
            </p>

            {/* Manual entry fallback */}
            <div className="mt-6 pt-5 border-t border-gray-100">
              <p className="text-sm font-medium text-gray-700 mb-2">Can't find your school?</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customSchoolName}
                  onChange={(e) => setCustomSchoolName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCustomSchool(); }}}
                  placeholder="Enter school name manually"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleCustomSchool}
                  disabled={!customSchoolName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-40"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Step: Contact email ──────────────────────────────────────────────────────
  if (step === "contact") {
    const schoolName = selectedSchool?.name || customSchoolName;
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm">
          <Link to="/" className="flex justify-center mb-8">
            <img src="/logo-full.png" alt="GoodHours" className="h-10 w-auto"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; (e.currentTarget.nextElementSibling as HTMLElement)!.style.display = "block"; }} />
            <span className="hidden text-2xl font-bold text-blue-700">GoodHours</span>
          </Link>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
            <button
              onClick={() => setStep("search")}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to search
            </button>
            <h2 className="text-xl font-bold mb-1 text-gray-900">Verify Your School</h2>
            <p className="text-sm text-gray-500 mb-1">
              {signupMode === "email" ? "Step 3 of 3" : "Step 2 of 2"} — Registering: <strong>{schoolName}</strong>
            </p>
            {selectedSchool?.city && (
              <p className="text-xs text-gray-400 mb-4">
                {[selectedSchool.city, selectedSchool.state].filter(Boolean).join(", ")}
                {selectedSchool.type ? ` · ${selectedSchool.type}` : ""}
              </p>
            )}
            <p className="text-sm text-gray-500 mb-6">
              {signupMode === "email"
                ? "Enter your school email address. We'll verify the domain and send a confirmation."
                : "We'll send a verification link to confirm this registration."}
            </p>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
            )}
            <form onSubmit={handleSubmitRegistration} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {signupMode === "email" ? "Your School Email" : "Contact Email"}
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => {
                    const val = e.target.value;
                    setContactEmail(val);
                    const status = classifyEmailDomain(val);
                    setDomainStatus(status);
                    if (error) setError("");
                  }}
                  required
                  placeholder="principal@yourschool.edu"
                  className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 transition-colors ${
                    domainStatus === "personal"
                      ? "border-red-300 focus:ring-red-400 bg-red-50"
                      : domainStatus === "edu"
                      ? "border-green-300 focus:ring-green-400"
                      : "border-gray-300 focus:ring-blue-500"
                  }`}
                />

                {/* Layer 1 — Personal email blocked */}
                {domainStatus === "personal" && (
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md flex gap-2.5">
                    <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-red-800">Personal email not accepted</p>
                      <p className="text-xs text-red-600 mt-0.5">
                        Use your school's official email address (e.g.{" "}
                        <span className="font-mono">principal@yourschool.edu</span>).
                        Gmail, Yahoo, and Outlook are not permitted.
                      </p>
                    </div>
                  </div>
                )}

                {/* Layer 2 — .edu fast-track */}
                {domainStatus === "edu" && (
                  <div className="mt-2 p-2.5 bg-green-50 border border-green-200 rounded-md flex gap-2 items-center">
                    <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-sm text-green-700">Institutional .edu address — you're good to go.</p>
                  </div>
                )}

                {!domainStatus && (
                  <p className="text-xs text-gray-400 mt-1">
                    Use your school's official email address.
                  </p>
                )}
              </div>
              <button
                type="submit"
                disabled={submitting || domainStatus === "personal"}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    {signupMode === "email" ? "Creating account…" : "Sending…"}
                  </span>
                ) : signupMode === "email" ? "Create Account & Verify Email" : "Send Verification Link"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ─── Step: Sent ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm text-center">
        <Link to="/" className="block text-2xl font-bold italic mb-8">GoodHours</Link>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2">Check Your Email</h2>
          <p className="text-sm text-gray-600 mb-4">
            We've sent a verification link to <strong>{sentTo}</strong>.
            Click the link to complete your school's registration.
          </p>
          <p className="text-xs text-gray-400">
            The link expires in 24 hours. Didn't receive it?{" "}
            <button onClick={() => setStep("contact")} className="text-blue-600 hover:underline">
              Try again
            </button>.
          </p>
          <div className="mt-6">
            <Link to="/login" className="text-sm text-blue-600 hover:underline">
              Go to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
