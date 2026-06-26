import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../lib/api";
import type { LaunchWorkspace, OnboardingForm } from "./types";

export default function OnboardingTab({ workspace, onUpdate }: { workspace: LaunchWorkspace; onUpdate: (data: LaunchWorkspace) => void }) {
  const [onboardingForm, setOnboardingForm] = useState<OnboardingForm>({
    overview: workspace.plan.onboardingInstructions.overview,
    nextMilestone: workspace.plan.onboardingInstructions.nextMilestone,
  });
  const [savingOnboarding, setSavingOnboarding] = useState(false);
  const [onboardingMessage, setOnboardingMessage] = useState("");

  useEffect(() => {
    setOnboardingForm({
      overview: workspace.plan.onboardingInstructions.overview,
      nextMilestone: workspace.plan.onboardingInstructions.nextMilestone,
    });
  }, [workspace]);

  const handleSaveOnboarding = async () => {
    setSavingOnboarding(true);
    setOnboardingMessage("");
    try {
      const data = await api.put<LaunchWorkspace>("/schools/launch", {
        onboardingInstructions: onboardingForm,
      });
      onUpdate(data);
      setOnboardingMessage("Onboarding instructions saved.");
    } catch (err: any) {
      setOnboardingMessage(err.message || "Failed to save onboarding instructions.");
    } finally {
      setSavingOnboarding(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr,1fr]">
      <div className="rounded-[3px] border border-[var(--border)] bg-white p-5">
        <h2 className="text-[16px] font-semibold text-[var(--text)]">Onboarding instructions</h2>
        <p className="mt-1 text-sm text-[var(--text-sec)]">
          Set the rollout narrative for staff so the pilot follows one consistent path.
        </p>
        {onboardingMessage && (
          <div className="mt-4 rounded-[2px] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-sm text-[var(--text)]">
            {onboardingMessage}
          </div>
        )}
        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text)]">Operator overview</label>
            <textarea
              rows={5}
              aria-label="Operator overview"
              value={onboardingForm.overview}
              onChange={(e) => setOnboardingForm((current) => ({ ...current, overview: e.target.value }))}
              className="w-full rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text)]">Next milestone</label>
            <textarea
              rows={4}
              aria-label="Next milestone"
              value={onboardingForm.nextMilestone}
              onChange={(e) => setOnboardingForm((current) => ({ ...current, nextMilestone: e.target.value }))}
              className="w-full rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={handleSaveOnboarding}
            disabled={savingOnboarding}
            className="rounded-[2px] bg-[var(--action)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--navy)] disabled:opacity-50"
          >
            {savingOnboarding ? "Saving..." : "Save Onboarding Instructions"}
          </button>
        </div>
      </div>

      <div className="rounded-[3px] border border-[var(--border)] bg-white p-5">
        <h2 className="text-[16px] font-semibold text-[var(--text)]">Launch checklist</h2>
        <p className="mt-1 text-sm text-[var(--text-sec)]">
          This checklist reflects live product state, not guesses. Use it before sending the next invite batch.
        </p>
        <div className="mt-5 space-y-3">
          {workspace.checklist.map((item) => (
            <div key={item.id} className="rounded-[3px] border border-[var(--border)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="font-medium text-[var(--text)]">{item.title}</div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${item.done ? "bg-[var(--ok-bg)] text-[var(--ok-t)]" : "bg-[var(--wn-bg)] text-[var(--wn-t)]"}`}>
                      {item.done ? "Done" : "Needs work"}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-[var(--text-sec)]">{item.description}</div>
                </div>
                <Link
                  to={item.actionHref}
                  className="rounded-[2px] border border-[var(--border-s)] px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-alt)]"
                >
                  {item.actionLabel}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
