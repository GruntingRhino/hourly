import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";

interface SchoolEntry {
  id: string;
  name: string;
  type: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  claimed: boolean;
}

type Step = "google" | "search" | "contact" | "sent";

export default function SchoolRegister() {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState<Step>("google");
  const [googleUrl, setGoogleUrl] = useState<string | null>(null);
  const [registrationToken, setRegistrationToken] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchState, setSearchState] = useState("");
  const [searchResults, setSearchResults] = useState<SchoolEntry[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<SchoolEntry | null>(null);
  const [customSchoolName, setCustomSchoolName] = useState("");

  const [contactEmail, setContactEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState("");

  // Handle OAuth callback — look for ?code= in URL
  useEffect(() => {
    const code = searchParams.get("code");
    if (code) {
      handleOAuthCallback(code);
    }
    // Fetch Google OAuth URL
    api.get<{ url: string }>("/auth/google/url").then((data) => {
      setGoogleUrl(data.url);
    }).catch(() => {});
  }, []);

  const handleOAuthCallback = async (code: string) => {
    try {
      const result = await api.post<any>("/auth/google/callback", { code });
      if (result.token && !result.requiresSchoolRegistration) {
        // Already registered — log them in
        loginWithToken(result.token, result.user);
        navigate("/dashboard");
        return;
      }
      if (result.requiresSchoolRegistration) {
        setRegistrationToken(result.registrationToken);
        setUserEmail(result.email);
        setUserName(result.name);
        setStep("search");
      }
    } catch (err: any) {
      setError(err.message || "Google sign-in failed. Please try again.");
    }
  };

  const handleGoogleSignIn = () => {
    if (googleUrl) {
      window.location.href = googleUrl;
    }
  };

  const handleSearch = async () => {
    if (searchQuery.trim().length < 2) return;
    setSearching(true);
    try {
      const results = await api.get<SchoolEntry[]>(`/auth/google/schools?search=${encodeURIComponent(searchQuery)}&state=${encodeURIComponent(searchState)}`);
      setSearchResults(results);
    } catch {
      setError("Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const handleSelectSchool = (school: SchoolEntry) => {
    if (school.claimed) {
      setError(`This school is already registered on GoodHours. Contact your school's GoodHours administrator to get access.`);
      return;
    }
    setSelectedSchool(school);
    setContactEmail("");
    setStep("contact");
  };

  const handleCustomSchool = () => {
    if (!customSchoolName.trim()) return;
    setSelectedSchool(null);
    setStep("contact");
  };

  const handleSubmitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const payload: any = {
        registrationToken,
        schoolName: selectedSchool?.name || customSchoolName,
        contactEmail,
      };
      if (selectedSchool) {
        payload.directorySchoolId = selectedSchool.id;
      }
      const result = await api.post<any>("/auth/google/register-school", payload);
      setSentTo(result.sentTo || contactEmail);
      setStep("sent");
    } catch (err: any) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (step === "google") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm">
          <Link to="/" className="block text-center text-2xl font-bold italic mb-8">GoodHours</Link>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold mb-2">Register Your School</h2>
            <p className="text-sm text-gray-600 mb-6">
              School administrators sign in with their Google account to begin registration.
            </p>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
            )}
            <button
              onClick={handleGoogleSignIn}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border-2 border-gray-300 rounded-md font-medium hover:bg-gray-50 text-gray-800"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
            <p className="mt-4 text-center text-sm text-gray-500">
              Already registered?{" "}
              <Link to="/login" className="text-blue-600 hover:underline">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (step === "search") {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-8">
        <div className="max-w-xl mx-auto">
          <Link to="/" className="block text-center text-2xl font-bold italic mb-8">GoodHours</Link>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold mb-2">Find Your School</h2>
            <p className="text-sm text-gray-600 mb-6">
              Welcome, {userName || userEmail}. Search for your school in our directory.
            </p>

            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                placeholder="School name or city..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={searchState}
                onChange={(e) => setSearchState(e.target.value)}
                className="px-2 py-2 border border-gray-300 rounded-md text-sm focus:outline-none"
              >
                <option value="">All States</option>
                {["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <button
                onClick={handleSearch}
                disabled={searching}
                className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm hover:bg-gray-800 disabled:opacity-50"
              >
                {searching ? "..." : "Search"}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="mt-4 border border-gray-200 rounded-md divide-y">
                {searchResults.map((school) => (
                  <button
                    key={school.id}
                    onClick={() => handleSelectSchool(school)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 flex justify-between items-center"
                  >
                    <div>
                      <div className="font-medium text-sm">{school.name}</div>
                      <div className="text-xs text-gray-500">{[school.city, school.state].filter(Boolean).join(", ")} {school.type && `• ${school.type}`}</div>
                    </div>
                    {school.claimed && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">Registered</span>}
                  </button>
                ))}
              </div>
            )}

            {searchResults.length === 0 && searchQuery.length >= 2 && !searching && (
              <div className="mt-4 text-sm text-gray-500">No results found.</div>
            )}

            <div className="mt-6 border-t pt-4">
              <p className="text-sm text-gray-600 mb-3">Can't find your school?</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customSchoolName}
                  onChange={(e) => setCustomSchoolName(e.target.value)}
                  placeholder="Enter school name manually"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleCustomSchool}
                  disabled={!customSchoolName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
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

  if (step === "contact") {
    const schoolName = selectedSchool?.name || customSchoolName;
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm">
          <Link to="/" className="block text-center text-2xl font-bold italic mb-8">GoodHours</Link>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <button onClick={() => setStep("search")} className="text-sm text-blue-600 hover:underline mb-4 block">← Back to search</button>
            <h2 className="text-xl font-bold mb-2">Verify Your School</h2>
            <p className="text-sm text-gray-600 mb-1">Registering: <strong>{schoolName}</strong></p>
            <p className="text-sm text-gray-600 mb-6">
              We'll send a verification link to the school's official email address to confirm this registration.
            </p>

            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

            <form onSubmit={handleSubmitRegistration} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  School Contact Email
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  required
                  placeholder="principal@schoolname.edu"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Must be an official school email address.</p>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2 bg-gray-900 text-white rounded-md font-medium hover:bg-gray-800 disabled:opacity-50 text-sm"
              >
                {submitting ? "Sending..." : "Send Verification Link"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Step: sent
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
            We've sent a verification link to <strong>{sentTo}</strong>. Click the link in that email to complete your school's registration.
          </p>
          <p className="text-xs text-gray-400">
            The link expires in 24 hours. Didn't receive it? Check your spam folder, or{" "}
            <button onClick={() => setStep("contact")} className="text-blue-600 hover:underline">try again</button>.
          </p>
          <div className="mt-6">
            <Link to="/login" className="text-sm text-blue-600 hover:underline">Go to Sign In</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
