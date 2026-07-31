import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, getErrorMessage } from "../../lib/api";
import type { Tab, LaunchWorkspace } from "./components/types";
import { summaryClasses, badgeClasses } from "./components/types";
import MonitoringTab from "./components/MonitoringTab";
import OnboardingTab from "./components/OnboardingTab";
import SupportTab from "./components/SupportTab";
import RollbackTab from "./components/RollbackTab";
import BugsTab from "./components/BugsTab";

export default function LaunchCenter() {
  const [tab, setTab] = useState<Tab>("monitoring");
  const [workspace, setWorkspace] = useState<LaunchWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadWorkspace = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.get<LaunchWorkspace>("/schools/launch");
      setWorkspace(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to load launch center."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadWorkspace(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (loading) {
    return <div className="text-[var(--text-sec)]">Loading launch center...</div>;
  }

  if (error || !workspace) {
    return (
      <div className="rounded-[3px] border border-[var(--er-b)] bg-[var(--er-bg)] p-4 text-sm text-[var(--er-t)]">
        {error || "Launch center unavailable."}
      </div>
    );
  }

  const tabs: Array<[Tab, string]> = [
    ["monitoring", "Monitoring"],
    ["onboarding", "Onboarding"],
    ["support", "Support"],
    ["rollback", "Rollback"],
    ["bugs", "Bug Triage"],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold text-[var(--text)]">Launch Center</h1>
          <p className="mt-1 text-sm text-[var(--text-sec)]">
            Operational controls for onboarding, support, rollback, bug triage, and first-user monitoring.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/dashboard"
            className="rounded-[2px] border border-[var(--border-s)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-alt)]"
          >
            Dashboard
          </Link>
          <Link
            to="/messages"
            className="px-4 py-[7px] bg-[var(--action)] text-white rounded-[2px] text-sm font-medium hover:opacity-85"
          >
            Messages
          </Link>
        </div>
      </div>

      <div className={`rounded-[3px] border p-5 ${summaryClasses(workspace.summary.readiness)}`}>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClasses(workspace.summary.readiness)}`}>
            {workspace.summary.readiness.replace("_", " ")}
          </span>
          <div className="font-semibold">{workspace.summary.headline}</div>
        </div>
        <div className="mt-2 text-sm opacity-90">{workspace.summary.detail}</div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-[var(--border)]">
        {tabs.map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === value
                ? "border-blue-700 text-[var(--action)]"
                : "border-transparent text-[var(--text-sec)] hover:text-[var(--text)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "monitoring" && <MonitoringTab workspace={workspace} onUpdate={setWorkspace} />}
      {tab === "onboarding" && <OnboardingTab workspace={workspace} onUpdate={setWorkspace} />}
      {tab === "support" && <SupportTab workspace={workspace} onUpdate={setWorkspace} />}
      {tab === "rollback" && <RollbackTab workspace={workspace} onUpdate={setWorkspace} />}
      {tab === "bugs" && <BugsTab workspace={workspace} onUpdate={setWorkspace} />}
    </div>
  );
}
