import { useEffect, useMemo, useState } from "react";
import { api } from "../../../lib/api";
import type { LaunchWorkspace, ReminderSummary, MonitoringForm } from "./types";
import { MetricCard, formatDate } from "./types";

export default function MonitoringTab({ workspace, onUpdate }: { workspace: LaunchWorkspace; onUpdate: (data: LaunchWorkspace) => void }) {
  const [monitoringForm, setMonitoringForm] = useState<MonitoringForm>({
    launchStartDate: workspace.plan.firstUserMonitoring.launchStartDate ?? "",
    checkCadence: workspace.plan.firstUserMonitoring.checkCadence,
    activeStudentTarget: String(workspace.plan.firstUserMonitoring.activeStudentTarget),
    watchList: workspace.plan.firstUserMonitoring.watchList.join(", "),
    notes: workspace.plan.firstUserMonitoring.notes ?? "",
  });
  const [savingMonitoring, setSavingMonitoring] = useState(false);
  const [monitoringMessage, setMonitoringMessage] = useState("");
  const [runningReminders, setRunningReminders] = useState(false);
  const [latestReminderSummary, setLatestReminderSummary] = useState<ReminderSummary | null>(null);

  const targetProgress = useMemo(() => {
    const target = Number(monitoringForm.activeStudentTarget) || workspace.plan.firstUserMonitoring.activeStudentTarget;
    return Math.min(100, Math.round((workspace.metrics.studentsWithHours / Math.max(1, target)) * 100));
  }, [monitoringForm.activeStudentTarget, workspace]);

  useEffect(() => {
    setMonitoringForm({
      launchStartDate: workspace.plan.firstUserMonitoring.launchStartDate ?? "",
      checkCadence: workspace.plan.firstUserMonitoring.checkCadence,
      activeStudentTarget: String(workspace.plan.firstUserMonitoring.activeStudentTarget),
      watchList: workspace.plan.firstUserMonitoring.watchList.join(", "),
      notes: workspace.plan.firstUserMonitoring.notes ?? "",
    });
  }, [workspace]);

  const handleSaveMonitoring = async () => {
    setSavingMonitoring(true);
    setMonitoringMessage("");
    try {
      const data = await api.put<LaunchWorkspace>("/schools/launch", {
        firstUserMonitoring: {
          launchStartDate: monitoringForm.launchStartDate,
          checkCadence: monitoringForm.checkCadence,
          activeStudentTarget: Number(monitoringForm.activeStudentTarget) || 10,
          watchList: monitoringForm.watchList.split(",").map((p) => p.trim()).filter(Boolean),
          notes: monitoringForm.notes,
        },
      });
      onUpdate(data);
      setMonitoringMessage("Monitoring plan saved.");
    } catch (err: any) {
      setMonitoringMessage(err.message || "Failed to save monitoring plan.");
    } finally {
      setSavingMonitoring(false);
    }
  };

  const handleRunReminders = async () => {
    setRunningReminders(true);
    setMonitoringMessage("");
    try {
      const summary = await api.post<ReminderSummary | null>("/messages/reminders/run", {});
      setLatestReminderSummary(summary);
      setMonitoringMessage("Reminder cycle completed.");
    } catch (err: any) {
      setMonitoringMessage(err.message || "Failed to run reminders.");
    } finally {
      setRunningReminders(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Approved Partners" value={String(workspace.metrics.approvedPartners)} subtext={`${workspace.metrics.pendingPartners} pending`} />
        <MetricCard label="Published Cohorts" value={`${workspace.metrics.publishedCohorts}/${workspace.metrics.totalCohorts}`} subtext="published / total" />
        <MetricCard label="Invited Students" value={String(workspace.metrics.invitedStudents)} subtext={`${workspace.metrics.pendingInvites} pending invites`} />
        <MetricCard label="Students With Hours" value={String(workspace.metrics.studentsWithHours)} subtext={`${workspace.metrics.enrolledStudents} enrolled`} />
        <MetricCard label="Pending Review" value={String(workspace.metrics.pendingReviewCount)} subtext={`${workspace.metrics.pendingSelfSubmissions} self-submissions`} />
        <MetricCard label="Open Bugs" value={String(workspace.metrics.openBugCount)} subtext={`${workspace.metrics.criticalBugCount} critical`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr,1fr]">
        <div className="rounded-[3px] border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[16px] font-semibold text-[var(--text)]">First-user monitoring</h2>
              <p className="mt-1 text-sm text-[var(--text-sec)]">
                Watch the rollout funnel and keep the review queue small while the first student group goes live.
              </p>
            </div>
            <button
              onClick={handleRunReminders}
              disabled={runningReminders}
              className="rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-alt)] disabled:opacity-50"
            >
              {runningReminders ? "Running..." : "Run Reminders"}
            </button>
          </div>

          {monitoringMessage && (
            <div className="mt-4 rounded-[2px] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-sm text-[var(--text)]">
              {monitoringMessage}
            </div>
          )}

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[3px] border border-[var(--border)] p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-sec)]">Launch Window</div>
              <div className="mt-2 text-sm text-[var(--text)]">
                Start: <span className="font-medium">{formatDate(workspace.plan.firstUserMonitoring.launchStartDate)}</span>
              </div>
              <div className="mt-1 text-sm text-[var(--text)]">
                Cadence: <span className="font-medium">{workspace.plan.firstUserMonitoring.checkCadence.replace("_", " ")}</span>
              </div>
              <div className="mt-1 text-sm text-[var(--text)]">
                Target: <span className="font-medium">{workspace.plan.firstUserMonitoring.activeStudentTarget} students with hours</span>
              </div>
            </div>

            <div className="rounded-[3px] border border-[var(--border)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-sec)]">Target Progress</div>
                  <div className="mt-1 text-2xl font-semibold text-[var(--text)]">{targetProgress}%</div>
                </div>
                <div className="text-right text-sm text-[var(--text-sec)]">
                  {workspace.metrics.studentsWithHours} / {workspace.plan.firstUserMonitoring.activeStudentTarget}
                </div>
              </div>
              <div className="mt-3 h-2 rounded-full bg-[var(--surface-alt)]">
                <div className="h-2 rounded-full bg-[var(--action)]" style={{ width: `${targetProgress}%` }} />
              </div>
            </div>
          </div>

          {latestReminderSummary && (
            <div className="mt-5 rounded-[3px] border border-[var(--in-b)] bg-[var(--in-bg)] p-4">
              <div className="font-medium text-[var(--navy)]">Latest reminder run</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-5 text-center">
                <div>
                  <div className="text-[16px] font-semibold text-[var(--navy)]">{latestReminderSummary.deadlineReminders}</div>
                  <div className="text-xs text-[var(--action)]">Deadline reminders</div>
                </div>
                <div>
                  <div className="text-[16px] font-semibold text-[var(--navy)]">{latestReminderSummary.behindAlerts}</div>
                  <div className="text-xs text-[var(--action)]">Behind alerts</div>
                </div>
                <div>
                  <div className="text-[16px] font-semibold text-[var(--navy)]">{latestReminderSummary.adminAlerts}</div>
                  <div className="text-xs text-[var(--action)]">Admin alerts</div>
                </div>
                <div>
                  <div className="text-[16px] font-semibold text-[var(--navy)]">{latestReminderSummary.pendingReviewCount}</div>
                  <div className="text-xs text-[var(--action)]">Pending reviews</div>
                </div>
                <div>
                  <div className="text-[16px] font-semibold text-[var(--navy)]">{latestReminderSummary.atRiskStudents}</div>
                  <div className="text-xs text-[var(--action)]">At-risk students</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-[3px] border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-[16px] font-semibold text-[var(--text)]">Monitoring plan</h2>
          <p className="mt-1 text-sm text-[var(--text-sec)]">
            Persist the operating target and the people you want to watch most closely.
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text)]">Launch start date</label>
              <input
                type="date"
                aria-label="Launch start date"
                value={monitoringForm.launchStartDate}
                onChange={(e) => setMonitoringForm((current) => ({ ...current, launchStartDate: e.target.value }))}
                className="w-full rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text)]">Check cadence</label>
              <select
                aria-label="Check cadence"
                value={monitoringForm.checkCadence}
                onChange={(e) =>
                  setMonitoringForm((current) => ({
                    ...current,
                    checkCadence: e.target.value as MonitoringForm["checkCadence"],
                  }))
                }
                className="w-full rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm"
              >
                <option value="DAILY">Daily</option>
                <option value="TWICE_DAILY">Twice daily</option>
                <option value="WEEKDAYS">Weekdays only</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text)]">Students with hours target</label>
              <input
                type="number"
                min="1"
                aria-label="Students with hours target"
                value={monitoringForm.activeStudentTarget}
                onChange={(e) => setMonitoringForm((current) => ({ ...current, activeStudentTarget: e.target.value }))}
                className="w-full rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text)]">Watch list</label>
              <input
                type="text"
                aria-label="Watch list"
                value={monitoringForm.watchList}
                onChange={(e) => setMonitoringForm((current) => ({ ...current, watchList: e.target.value }))}
                placeholder="Student names or owners, comma-separated"
                className="w-full rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text)]">Monitoring notes</label>
              <textarea
                rows={5}
                aria-label="Monitoring notes"
                value={monitoringForm.notes}
                onChange={(e) => setMonitoringForm((current) => ({ ...current, notes: e.target.value }))}
                className="w-full rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={handleSaveMonitoring}
              disabled={savingMonitoring}
              className="rounded-[2px] bg-[var(--action)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--navy)] disabled:opacity-50"
            >
              {savingMonitoring ? "Saving..." : "Save First-User Monitoring"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Accepted Invites" value={String(workspace.metrics.acceptedInvites)} subtext={`${workspace.metrics.pendingInvites} still pending`} />
        <MetricCard label="Approved Hours" value={`${workspace.metrics.totalApprovedHours.toFixed(1)}h`} subtext={`${workspace.metrics.totalPendingHours.toFixed(1)}h pending`} />
        <MetricCard label="At-Risk Students" value={String(workspace.metrics.atRiskStudents)} subtext={`${workspace.metrics.completedStudents} completed`} />
        <MetricCard label="No-Shows" value={String(workspace.metrics.noShowCount)} subtext={`${workspace.metrics.pendingLegacyVerifications} legacy verifications pending`} />
      </div>
    </div>
  );
}
