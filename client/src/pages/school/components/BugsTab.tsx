import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import type { LaunchWorkspace, LaunchBug, BugCreateForm, BugEditForm } from "./types";
import { badgeClasses } from "./types";

export default function BugsTab({ workspace, onUpdate }: { workspace: LaunchWorkspace; onUpdate: (data: LaunchWorkspace) => void }) {
  const [createBugForm, setCreateBugForm] = useState<BugCreateForm>({
    title: "",
    description: "",
    severity: "MEDIUM",
    area: "",
    source: "",
    ownerName: "",
    workaround: "",
    nextAction: "",
  });
  const [creatingBug, setCreatingBug] = useState(false);
  const [selectedBugId, setSelectedBugId] = useState<string>("");
  const [bugEditForm, setBugEditForm] = useState<BugEditForm>({
    title: "",
    description: "",
    severity: "MEDIUM",
    status: "OPEN",
    area: "",
    source: "",
    ownerName: "",
    workaround: "",
    nextAction: "",
  });
  const [savingBug, setSavingBug] = useState(false);
  const [bugMessage, setBugMessage] = useState("");

  const selectedBug = workspace.bugs.find((bug) => bug.id === selectedBugId) ?? null;

  useEffect(() => {
    const firstBug = workspace.bugs[0];
    if (!selectedBugId && firstBug) {
      setSelectedBugId(firstBug.id);
    }
  }, [workspace, selectedBugId]);

  useEffect(() => {
    if (!selectedBug) return;
    setBugEditForm({
      title: selectedBug.title,
      description: selectedBug.description,
      severity: selectedBug.severity,
      status: selectedBug.status,
      area: selectedBug.area ?? "",
      source: selectedBug.source ?? "",
      ownerName: selectedBug.ownerName ?? "",
      workaround: selectedBug.workaround ?? "",
      nextAction: selectedBug.nextAction ?? "",
    });
  }, [selectedBug]);

  const handleCreateBug = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingBug(true);
    setBugMessage("");
    try {
      const bug = await api.post<LaunchBug>("/schools/launch/bugs", createBugForm);
      setCreateBugForm({
        title: "",
        description: "",
        severity: "MEDIUM",
        area: "",
        source: "",
        ownerName: "",
        workaround: "",
        nextAction: "",
      });
      setSelectedBugId(bug.id);
      setBugMessage("Bug added to triage.");
      await loadWorkspace();
    } catch (err: any) {
      setBugMessage(err.message || "Failed to create bug.");
    } finally {
      setCreatingBug(false);
    }
  };

  const handleSaveBug = async () => {
    if (!selectedBug) return;
    setSavingBug(true);
    setBugMessage("");
    try {
      await api.put<LaunchBug>(`/schools/launch/bugs/${selectedBug.id}`, bugEditForm);
      setBugMessage("Bug triage entry saved.");
      await loadWorkspace();
    } catch (err: any) {
      setBugMessage(err.message || "Failed to save bug.");
    } finally {
      setSavingBug(false);
    }
  };

  const loadWorkspace = async () => {
    try {
      const data = await api.get<LaunchWorkspace>("/schools/launch");
      onUpdate(data);
    } catch {}
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
      <div className="space-y-6">
        <form onSubmit={handleCreateBug} className="rounded-[3px] border border-[var(--border)] bg-white p-5">
          <h2 className="text-[16px] font-semibold text-[var(--text)]">New bug triage item</h2>
          <p className="mt-1 text-sm text-[var(--text-sec)]">
            Capture rollout defects with enough detail to assign, reproduce, and verify.
          </p>
          {bugMessage && (
            <div className="mt-4 rounded-[2px] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-sm text-[var(--text)]">
              {bugMessage}
            </div>
          )}
          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text)]">Title</label>
              <input
                type="text"
                aria-label="New bug title"
                value={createBugForm.title}
                onChange={(e) => setCreateBugForm((current) => ({ ...current, title: e.target.value }))}
                className="w-full rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm"
                required
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--text)]">Severity</label>
                <select
                  aria-label="New bug severity"
                  value={createBugForm.severity}
                  onChange={(e) =>
                    setCreateBugForm((current) => ({
                      ...current,
                      severity: e.target.value as BugCreateForm["severity"],
                    }))
                  }
                  className="w-full rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--text)]">Area</label>
                <input
                  type="text"
                  aria-label="New bug area"
                  value={createBugForm.area}
                  onChange={(e) => setCreateBugForm((current) => ({ ...current, area: e.target.value }))}
                  placeholder="Onboarding, Partners, Cohorts"
                  className="w-full rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text)]">Description</label>
              <textarea
                rows={4}
                aria-label="New bug description"
                value={createBugForm.description}
                onChange={(e) => setCreateBugForm((current) => ({ ...current, description: e.target.value }))}
                className="w-full rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--text)]">Source</label>
                <input
                  type="text"
                  aria-label="New bug source"
                  value={createBugForm.source}
                  onChange={(e) => setCreateBugForm((current) => ({ ...current, source: e.target.value }))}
                  placeholder="Student report, admin test"
                  className="w-full rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--text)]">Owner</label>
                <input
                  type="text"
                  aria-label="New bug owner"
                  value={createBugForm.ownerName}
                  onChange={(e) => setCreateBugForm((current) => ({ ...current, ownerName: e.target.value }))}
                  className="w-full rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text)]">Workaround</label>
              <textarea
                rows={2}
                aria-label="New bug workaround"
                value={createBugForm.workaround}
                onChange={(e) => setCreateBugForm((current) => ({ ...current, workaround: e.target.value }))}
                className="w-full rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text)]">Next action</label>
              <textarea
                rows={2}
                aria-label="New bug next action"
                value={createBugForm.nextAction}
                onChange={(e) => setCreateBugForm((current) => ({ ...current, nextAction: e.target.value }))}
                className="w-full rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={creatingBug}
              className="rounded-[2px] bg-[var(--action)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--navy)] disabled:opacity-50"
            >
              {creatingBug ? "Saving..." : "Add Bug"}
            </button>
          </div>
        </form>

        <div className="rounded-[3px] border border-[var(--border)] bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[16px] font-semibold text-[var(--text)]">Triage queue</h2>
            <div className="text-sm text-[var(--text-sec)]">{workspace.bugs.length} total</div>
          </div>
          <div className="mt-5 space-y-3">
            {workspace.bugs.length === 0 ? (
              <div className="rounded-[3px] border border-dashed border-[var(--border-s)] p-5 text-sm text-[var(--text-sec)]">
                No rollout bugs yet.
              </div>
            ) : (
              workspace.bugs.map((bug) => (
                <button
                  key={bug.id}
                  onClick={() => setSelectedBugId(bug.id)}
                  className={`w-full rounded-[3px] border p-4 text-left transition-colors ${
                    selectedBugId === bug.id
                      ? "border-blue-300 bg-[var(--in-bg)]"
                      : "border-[var(--border)] bg-white hover:border-[var(--border-s)]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeClasses(bug.severity)}`}>
                      {bug.severity}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeClasses(bug.status)}`}>
                      {bug.status}
                    </span>
                  </div>
                  <div className="mt-2 font-medium text-[var(--text)]">{bug.title}</div>
                  <div className="mt-1 text-sm text-[var(--text-sec)]">
                    {bug.area || "General"} · Updated {new Date(bug.updatedAt).toLocaleDateString()}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-[3px] border border-[var(--border)] bg-white p-5">
        <h2 className="text-[16px] font-semibold text-[var(--text)]">Selected bug</h2>
        {!selectedBug ? (
          <div className="mt-5 rounded-[3px] border border-dashed border-[var(--border-s)] p-5 text-sm text-[var(--text-sec)]">
            Select a bug to edit severity, status, owner, workaround, and next action.
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text)]">Title</label>
              <input
                type="text"
                aria-label="Selected bug title"
                value={bugEditForm.title}
                onChange={(e) => setBugEditForm((current) => ({ ...current, title: e.target.value }))}
                className="w-full rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--text)]">Severity</label>
                <select
                  aria-label="Selected bug severity"
                  value={bugEditForm.severity}
                  onChange={(e) =>
                    setBugEditForm((current) => ({
                      ...current,
                      severity: e.target.value as BugEditForm["severity"],
                    }))
                  }
                  className="w-full rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--text)]">Status</label>
                <select
                  aria-label="Selected bug status"
                  value={bugEditForm.status}
                  onChange={(e) =>
                    setBugEditForm((current) => ({
                      ...current,
                      status: e.target.value as BugEditForm["status"],
                    }))
                  }
                  className="w-full rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm"
                >
                  <option value="OPEN">Open</option>
                  <option value="INVESTIGATING">Investigating</option>
                  <option value="BLOCKED">Blocked</option>
                  <option value="FIXED">Fixed</option>
                  <option value="MONITORING">Monitoring</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--text)]">Area</label>
                <input
                  type="text"
                  aria-label="Selected bug area"
                  value={bugEditForm.area}
                  onChange={(e) => setBugEditForm((current) => ({ ...current, area: e.target.value }))}
                  className="w-full rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--text)]">Source</label>
                <input
                  type="text"
                  aria-label="Selected bug source"
                  value={bugEditForm.source}
                  onChange={(e) => setBugEditForm((current) => ({ ...current, source: e.target.value }))}
                  className="w-full rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text)]">Owner</label>
              <input
                type="text"
                aria-label="Selected bug owner"
                value={bugEditForm.ownerName}
                onChange={(e) => setBugEditForm((current) => ({ ...current, ownerName: e.target.value }))}
                className="w-full rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text)]">Description</label>
              <textarea
                rows={5}
                aria-label="Selected bug description"
                value={bugEditForm.description}
                onChange={(e) => setBugEditForm((current) => ({ ...current, description: e.target.value }))}
                className="w-full rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text)]">Workaround</label>
              <textarea
                rows={3}
                aria-label="Selected bug workaround"
                value={bugEditForm.workaround}
                onChange={(e) => setBugEditForm((current) => ({ ...current, workaround: e.target.value }))}
                className="w-full rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text)]">Next action</label>
              <textarea
                rows={3}
                aria-label="Selected bug next action"
                value={bugEditForm.nextAction}
                onChange={(e) => setBugEditForm((current) => ({ ...current, nextAction: e.target.value }))}
                className="w-full rounded-[2px] border border-[var(--border-s)] px-3 py-2 text-sm"
              />
            </div>
            <div className="text-xs text-[var(--text-faint)]">
              Created {new Date(selectedBug.createdAt).toLocaleString()} · Updated {new Date(selectedBug.updatedAt).toLocaleString()}
            </div>
            <button
              onClick={handleSaveBug}
              disabled={savingBug}
              className="rounded-[2px] bg-[var(--action)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--navy)] disabled:opacity-50"
            >
              {savingBug ? "Saving..." : "Save Bug"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
