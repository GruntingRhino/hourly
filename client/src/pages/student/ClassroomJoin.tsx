import { useState } from "react";
import { api, getErrorMessage } from "../../lib/api";
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
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Invalid code"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--surface-alt)] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-[20px] font-semibold italic">GoodHours</h1>
          <p className="text-[var(--text-sec)] mt-2 text-sm">Welcome! Enter a classroom code to get started.</p>
        </div>

        <div className="bg-[var(--surface)] rounded-[3px] border border-[var(--border)] p-6">
          <h2 className="text-[16px] font-semibold mb-1">Join a Classroom</h2>
          <p className="text-sm text-[var(--text-sec)] mb-4">
            Ask your teacher for the classroom invite code, then enter it below.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-[var(--er-bg)] border border-[var(--er-b)] rounded-[2px] text-[var(--er-t)] text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">Classroom Code</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toLowerCase())}
                placeholder="e.g. a1b2c3d4"
                maxLength={8}
                required
                className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:ring-2 focus:ring-[var(--action)] font-mono text-center text-lg tracking-widest"
              />
              <p className="text-xs text-[var(--text-faint)] mt-1">8-character code (letters and numbers)</p>
            </div>
            <button
              type="submit"
              disabled={loading || code.length !== 8}
              className="w-full py-[7px] bg-[var(--action)] text-white rounded-[2px] font-medium hover:opacity-85 disabled:opacity-50"
            >
              {loading ? "Joining..." : "Join Classroom"}
            </button>
          </form>
        </div>

        <div className="mt-4 text-center">
          <button onClick={logout} className="text-sm text-[var(--text-faint)] hover:text-[var(--text-sec)]">
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
