import { useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";

export default function ClassroomJoin() {
  const { refreshUser, logout } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/classrooms/join", { inviteCode: code.trim().toLowerCase() });
      await refreshUser();
    } catch (err: any) {
      setError(err.message || "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold italic">Hourly</h1>
          <p className="text-gray-500 mt-2 text-sm">Welcome! Enter a classroom code to get started.</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-bold mb-1">Join a Classroom</h2>
          <p className="text-sm text-gray-500 mb-4">
            Ask your teacher for the classroom invite code, then enter it below.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Classroom Code</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toLowerCase())}
                placeholder="e.g. a1b2c3d4"
                maxLength={8}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-center text-lg tracking-widest"
              />
              <p className="text-xs text-gray-400 mt-1">8-character code (letters and numbers)</p>
            </div>
            <button
              type="submit"
              disabled={loading || code.length !== 8}
              className="w-full py-2 bg-gray-900 text-white rounded-md font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? "Joining..." : "Join Classroom"}
            </button>
          </form>
        </div>

        <div className="mt-4 text-center">
          <button onClick={logout} className="text-sm text-gray-400 hover:text-gray-600">
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
