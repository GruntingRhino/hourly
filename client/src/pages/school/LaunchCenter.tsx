import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
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
    } catch (err: any) {
      setError(err.message || "Failed to load launch center.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadWorkspace();
  }, []);

  if (loading) {
    return <div className="text-gray-500">Loading launch center...</div>;
  }

  if (error || !workspace) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
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
          <h1 className="text-2xl font-bold text-gray-900">Launch Center</h1>
          <p className="mt-1 text-sm text-gray-500">
            Operational controls for onboarding, support, rollback, bug triage, and first-user monitoring.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/dashboard"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Dashboard
          </Link>
          <Link
            to="/messages"
            className="px-4 py-[7px] bg-blue-600 text-white rounded-md text-sm font-medium hover:opacity-85"
          >
            Messages
          </Link>
        </div>
      </div>

      <div className={`rounded-2xl border p-5 ${summaryClasses(workspace.summary.readiness)}`}>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClasses(workspace.summary.readiness)}`}>
            {workspace.summary.readiness.replace("_", " ")}
          </span>
          <div className="font-semibold">{workspace.summary.headline}</div>
        </div>
        <div className="mt-2 text-sm opacity-90">{workspace.summary.detail}</div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-gray-200">
        {tabs.map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === value
                ? "border-blue-700 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-800"
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
