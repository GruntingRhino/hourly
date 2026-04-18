import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";

export default function SchoolOnboarding() {
  const { user, refreshUser } = useAuth();
  const [requiredHours, setRequiredHours] = useState("40");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const goalAlreadyConfigured = useMemo(() => {
    const current = user?.school?.requiredHours;
    return typeof current === "number" && current > 0;
  }, [user?.school?.requiredHours]);
  const isSchoolAdminLike = user?.role === "SCHOOL_ADMIN";

  if (!isSchoolAdminLike) {
    return <Navigate to="/dashboard" replace />;
  }

  if (user?.school?.onboardingComplete) {
    return <Navigate to="/dashboard" replace />;
  }

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
      // Persist completion flag immediately so route transitions do not race
      // against this network request in fresh contexts.
      if (user?.schoolId) {
        localStorage.setItem(`school_onboarding_${user.schoolId}`, "done");
      }
      await api.post("/auth/set-graduation-goal", { requiredHours: hours });
      await api.put("/schools/onboarding", {});
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
          <div className="text-3xl font-bold text-gray-900 mb-2">Welcome to GoodHours</div>
          <div className="text-gray-500">Let's set up your school's service hours goal.</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-8">
          <div className="mb-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-blue-600 mb-2">Activation Checklist</div>
            <h2 className="text-xl font-semibold mb-2">Finish Initial School Setup</h2>
            <p className="text-sm text-gray-500">
              This gets a new school from account creation to a usable dashboard. Keep it minimal:
              set the hours goal now, then add partners and import or invite students from the dashboard.
            </p>
          </div>

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

            {goalAlreadyConfigured && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                A school goal is already configured at <strong>{user?.school?.requiredHours}</strong> hours.
                Saving here will overwrite it and complete onboarding.
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Goal and Continue"}
            </button>
          </form>

          <div className="mt-6 border-t border-gray-100 pt-4">
            <div className="text-xs font-medium text-gray-500 mb-2">What happens next</div>
            <div className="space-y-2 text-sm text-gray-600">
              <div>1. Add or approve community partners.</div>
              <div>2. Create a cohort and import students by CSV.</div>
              <div>3. Publish invitations and confirm the dashboard shows live student data.</div>
            </div>
            <div className="mt-4">
              <Link to="/settings" className="text-sm text-blue-600 hover:underline">
                Review school settings instead
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
