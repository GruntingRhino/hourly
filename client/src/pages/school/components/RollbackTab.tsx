import { useEffect, useState } from "react";
import { api, getErrorMessage } from "../../../lib/api";
import type { LaunchWorkspace, RollbackForm } from "./types";

export default function RollbackTab({ workspace, onUpdate }: { workspace: LaunchWorkspace; onUpdate: (data: LaunchWorkspace) => void }) {
  const [rollbackForm, setRollbackForm] = useState<RollbackForm>({
    ownerName: workspace.plan.rollbackPlan.ownerName ?? "",
    trigger: workspace.plan.rollbackPlan.trigger ?? "",
    freezeAction: workspace.plan.rollbackPlan.freezeAction ?? "",
    rollbackSteps: workspace.plan.rollbackPlan.rollbackSteps ?? "",
    restoreCheck: workspace.plan.rollbackPlan.restoreCheck ?? "",
    lastDrillAt: workspace.plan.rollbackPlan.lastDrillAt ?? "",
  });
  const [savingRollback, setSavingRollback] = useState(false);
  const [rollbackMessage, setRollbackMessage] = useState("");

  useEffect(() => {
    queueMicrotask(() => setRollbackForm({
      ownerName: workspace.plan.rollbackPlan.ownerName ?? "",
      trigger: workspace.plan.rollbackPlan.trigger ?? "",
      freezeAction: workspace.plan.rollbackPlan.freezeAction ?? "",
      rollbackSteps: workspace.plan.rollbackPlan.rollbackSteps ?? "",
      restoreCheck: workspace.plan.rollbackPlan.restoreCheck ?? "",
      lastDrillAt: workspace.plan.rollbackPlan.lastDrillAt ?? "",
    }));
  }, [workspace]);

  const handleSaveRollback = async () => {
    setSavingRollback(true);
    setRollbackMessage("");
    try {
      const data = await api.put<LaunchWorkspace>("/schools/launch", {
        rollbackPlan: rollbackForm,
      });
      onUpdate(data);
      setRollbackMessage("Rollback plan saved.");
    } catch (err: unknown) {
      setRollbackMessage(getErrorMessage(err, "Failed to save rollback plan."));
    } finally {
      setSavingRollback(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
      <div className="rounded-[3px] border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="text-[16px] font-semibold text-[var(--text)]">Rollback plan</h2>
        <p className="mt-1 text-sm text-[var(--text-sec)]">
          Define the trigger, freeze action, rollback sequence, and restore checks before the school is fully live.
        </p>
        {rollbackMessage && (
          <div className="mt-4 rounded-[2px] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-sm text-[var(--text)]">
            {rollbackMessage}
          </div>
        )}
        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text)]">Rollback owner</label>
            <input
              type="text"
              aria-label="Rollback owner"
              value={rollbackForm.ownerName}
              onChange={(e) => setRollbackForm((current) => ({ ...current, ownerName: e.target.value }))}
              className="w-full rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text)]">Trigger</label>
            <textarea
              rows={3}
              aria-label="Trigger"
              value={rollbackForm.trigger}
              onChange={(e) => setRollbackForm((current) => ({ ...current, trigger: e.target.value }))}
              className="w-full rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text)]">Freeze action</label>
            <textarea
              rows={2}
              aria-label="Freeze action"
              value={rollbackForm.freezeAction}
              onChange={(e) => setRollbackForm((current) => ({ ...current, freezeAction: e.target.value }))}
              className="w-full rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text)]">Rollback steps</label>
            <textarea
              rows={7}
              aria-label="Rollback steps"
              value={rollbackForm.rollbackSteps}
              onChange={(e) => setRollbackForm((current) => ({ ...current, rollbackSteps: e.target.value }))}
              className="w-full rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text)]">Restore check</label>
            <textarea
              rows={4}
              aria-label="Restore check"
              value={rollbackForm.restoreCheck}
              onChange={(e) => setRollbackForm((current) => ({ ...current, restoreCheck: e.target.value }))}
              className="w-full rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text)]">Last rollback drill</label>
            <input
              type="date"
              aria-label="Last rollback drill"
              value={rollbackForm.lastDrillAt}
              onChange={(e) => setRollbackForm((current) => ({ ...current, lastDrillAt: e.target.value }))}
              className="w-full rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm"
            />
          </div>
        </div>
        <button
          onClick={handleSaveRollback}
          disabled={savingRollback}
          className="mt-5 rounded-[2px] bg-[var(--action)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--navy)] disabled:opacity-50"
        >
          {savingRollback ? "Saving..." : "Save Rollback Plan"}
        </button>
      </div>

      <div className="rounded-[3px] border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="text-[16px] font-semibold text-[var(--text)]">Current risk signals</h2>
        <div className="mt-5 space-y-3">
          <div className="rounded-[3px] border border-[var(--border)] p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-sec)]">Review queue</div>
            <div className="mt-1 text-sm text-[var(--text)]">
              {workspace.metrics.pendingReviewCount} items are waiting for review.
            </div>
          </div>
          <div className="rounded-[3px] border border-[var(--border)] p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-sec)]">Adoption proof</div>
            <div className="mt-1 text-sm text-[var(--text)]">
              {workspace.metrics.studentsWithHours} students have logged hours and {workspace.metrics.completedStudents} have already reached the goal.
            </div>
          </div>
          <div className="rounded-[3px] border border-[var(--border)] p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-sec)]">Bug load</div>
            <div className="mt-1 text-sm text-[var(--text)]">
              {workspace.metrics.openBugCount} open bug entries, including {workspace.metrics.criticalBugCount} critical.
            </div>
          </div>
          <div className="rounded-[3px] border border-[var(--border)] p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-sec)]">Health checks</div>
            <div className="mt-1 text-sm text-[var(--text)]">
              Keep login, dashboard, partners, cohorts, submissions, and reminders in the restore checklist.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
