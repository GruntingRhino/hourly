import { useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";

export default function SchoolOnboarding() {
  const { user, refreshUser } = useAuth();
  const [requiredHours, setRequiredHours] = useState("40");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const hours = parseFloat(requiredHours);
    if (!hours || hours < 1) {
      setError("Please enter a valid hours goal (minimum 1).");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.post("/auth/set-graduation-goal", { requiredHours: hours });
      // Mark onboarding complete in localStorage
      if (user?.schoolId) {
        localStorage.setItem(`school_onboarding_${user.schoolId}`, "done");
      }
      await refreshUser();
    } catch (err: any) {
      setError(err.message || "Failed to save hours goal");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-3xl font-bold text-gray-900 mb-2">Welcome to Hourly</div>
          <div className="text-gray-500">Let's set up your school's service hours goal.</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-8">
          <h2 className="text-xl font-semibold mb-2">Set Graduation Hours Goal</h2>
          <p className="text-sm text-gray-500 mb-6">
            This is the number of community service hours students must complete to graduate.
            You can change this later in Settings.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Required Hours per Student
              </label>
              <input
                type="number"
                value={requiredHours}
                onChange={(e) => setRequiredHours(e.target.value)}
                min="1"
                max="1000"
                step="1"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg text-center font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="text-xs text-gray-400 text-center mt-1">hours</div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Continue to Dashboard"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
