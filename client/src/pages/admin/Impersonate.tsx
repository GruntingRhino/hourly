import { useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";
import { useNavigate } from "react-router-dom";

// DEV-ONLY page: accessible only when Vite runs in dev mode (import.meta.env.DEV is set by Vite, never true in production builds)
const IS_DEV = import.meta.env.DEV === true;

export default function ImpersonatePage() {
  const { user, loginWithToken } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!IS_DEV) {
    return <div className="text-center py-16 text-gray-500">Not available in production.</div>;
  }

  if (user?.role !== "SCHOOL_ADMIN") {
    return <div className="text-center py-16 text-gray-500">Admin access required.</div>;
  }

  const handleImpersonate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await api.post<any>("/auth/impersonate", { targetEmail: email });
      loginWithToken(result.token, result.user);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to impersonate user.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md">
      <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
        <strong>Dev-only:</strong> This feature is disabled in production. All impersonation actions are logged.
      </div>
      <h1 className="text-2xl font-bold mb-4">Impersonate User</h1>
      <form onSubmit={handleImpersonate} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">User Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
        {error && <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-yellow-600 text-white rounded-md text-sm hover:bg-yellow-700 disabled:opacity-50"
        >
          {loading ? "Logging in as user..." : "Login as User"}
        </button>
      </form>
    </div>
  );
}
