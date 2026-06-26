import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";

export default function SchoolOnboarding() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
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
      navigate("/launch", { replace: true });
    } catch (err: any) {
      setError(err.message || "Failed to save hours goal");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-8">
          <div className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--action)] mb-3">School Activation</div>
          <h1 className="text-4xl font-semibold text-slate-900 mb-3">Finish initial school setup</h1>
          <p className="max-w-2xl text-base text-slate-600">
            Set the graduation goal once, then continue straight into Launch Center so onboarding follows one clean path.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="bg-white border border-slate-200 rounded-3xl p-8 ">
            <div className="mb-6">
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--action)] mb-2">Primary Action</div>
              <h2 className="text-2xl font-semibold text-slate-900 mb-2">Set the required service hours</h2>
              <p className="text-sm text-slate-600">
                This is the only decision required on this page. After saving, you move directly into the live setup workflow.
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-[var(--er-bg)] border border-[var(--er-b)] rounded-[2px] text-[var(--er-t)] text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">
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
                  className="w-full max-w-xs px-4 py-3 border border-[var(--border-s)] rounded-[3px] text-2xl text-center font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="text-xs text-[var(--text-faint)] mt-2">hours</div>
              </div>

              {goalAlreadyConfigured && (
                <div className="rounded-[3px] border border-[var(--in-b)] bg-[var(--in-bg)] p-4 text-sm text-blue-800">
                  A school goal is already configured at <strong>{user?.school?.requiredHours}</strong> hours.
                  Saving here will overwrite it and complete onboarding.
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-w-[260px] items-center justify-center rounded-[3px] bg-[var(--action)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--action)] disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Goal and Open Launch Center"}
              </button>
            </form>
          </div>

          <aside className="bg-slate-900 text-slate-50 rounded-3xl p-7 ">
            <div className="text-xs font-semibold uppercase tracking-wide text-blue-200 mb-3">Next Steps</div>
            <div className="space-y-4">
              <div>
                <div className="text-sm font-semibold">1. Review service rules</div>
                <div className="mt-1 text-sm text-slate-300">Confirm dates, self-submission policy, and any category caps.</div>
              </div>
              <div>
                <div className="text-sm font-semibold">2. Add community partners</div>
                <div className="mt-1 text-sm text-slate-300">Invite or approve partners before exposing students to the workflow.</div>
              </div>
              <div>
                <div className="text-sm font-semibold">3. Import students</div>
                <div className="mt-1 text-sm text-slate-300">Finish the roster inside Launch Center instead of branching into multiple setup pages.</div>
              </div>
            </div>

            <div className="mt-8 border-t border-slate-700 pt-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">School</div>
              <div className="text-lg font-semibold">{user?.school?.name || "Your School"}</div>
              <div className="mt-1 text-sm text-slate-300">Goal changes here are used across dashboards, cohorts, and reports.</div>
              <Link to="/settings" className="mt-5 inline-block text-sm text-blue-200 hover:text-white">
                Review school settings
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
