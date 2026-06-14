import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
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
    setRollbackForm({
      ownerName: workspace.plan.rollbackPlan.ownerName ?? "",
      trigger: workspace.plan.rollbackPlan.trigger ?? "",
      freezeAction: workspace.plan.rollbackPlan.freezeAction ?? "",
      rollbackSteps: workspace.plan.rollbackPlan.rollbackSteps ?? "",
      restoreCheck: workspace.plan.rollbackPlan.restoreCheck ?? "",
      lastDrillAt: workspace.plan.rollbackPlan.lastDrillAt ?? "",
    });
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
    } catch (err: any) {
      setRollbackMessage(err.message || "Failed to save rollback plan.");
    } finally {
      setSavingRollback(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-gray-900">Rollback plan</h2>
        <p className="mt-1 text-sm text-gray-500">
          Define the trigger, freeze action, rollback sequence, and restore checks before the school is fully live.
        </p>
        {rollbackMessage && (
          <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
            {rollbackMessage}
          </div>
        )}
        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Rollback owner</label>
            <input
              type="text"
              aria-label="Rollback owner"
              value={rollbackForm.ownerName}
              onChange={(e) => setRollbackForm((current) => ({ ...current, ownerName: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Trigger</label>
            <textarea
              rows={3}
              aria-label="Trigger"
              value={rollbackForm.trigger}
              onChange={(e) => setRollbackForm((current) => ({ ...current, trigger: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Freeze action</label>
            <textarea
              rows={2}
              aria-label="Freeze action"
              value={rollbackForm.freezeAction}
              onChange={(e) => setRollbackForm((current) => ({ ...current, freezeAction: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Rollback steps</label>
            <textarea
              rows={7}
              aria-label="Rollback steps"
              value={rollbackForm.rollbackSteps}
              onChange={(e) => setRollbackForm((current) => ({ ...current, rollbackSteps: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Restore check</label>
            <textarea
              rows={4}
              aria-label="Restore check"
              value={rollbackForm.restoreCheck}
              onChange={(e) => setRollbackForm((current) => ({ ...current, restoreCheck: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Last rollback drill</label>
            <input
              type="date"
              aria-label="Last rollback drill"
              value={rollbackForm.lastDrillAt}
              onChange={(e) => setRollbackForm((current) => ({ ...current, lastDrillAt: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <button
          onClick={handleSaveRollback}
          disabled={savingRollback}
          className="mt-5 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {savingRollback ? "Saving..." : "Save Rollback Plan"}
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-gray-900">Current risk signals</h2>
        <div className="mt-5 space-y-3">
          <div className="rounded-lg border border-gray-200 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Review queue</div>
            <div className="mt-1 text-sm text-gray-700">
              {workspace.metrics.pendingReviewCount} items are waiting for review.
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Adoption proof</div>
            <div className="mt-1 text-sm text-gray-700">
              {workspace.metrics.studentsWithHours} students have logged hours and {workspace.metrics.completedStudents} have already reached the goal.
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Bug load</div>
            <div className="mt-1 text-sm text-gray-700">
              {workspace.metrics.openBugCount} open bug entries, including {workspace.metrics.criticalBugCount} critical.
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Health checks</div>
            <div className="mt-1 text-sm text-gray-700">
              Keep login, dashboard, partners, cohorts, submissions, and reminders in the restore checklist.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
