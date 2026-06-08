import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import type { LaunchWorkspace, SupportForm } from "./types";

export default function SupportTab({ workspace, onUpdate }: { workspace: LaunchWorkspace; onUpdate: (data: LaunchWorkspace) => void }) {
  const [supportForm, setSupportForm] = useState<SupportForm>({
    ownerName: workspace.plan.supportProcess.ownerName,
    ownerEmail: workspace.plan.supportProcess.ownerEmail,
    responseTimeHours: String(workspace.plan.supportProcess.responseTimeHours),
    escalationAfterHours: String(workspace.plan.supportProcess.escalationAfterHours),
    intakeChannels: workspace.plan.supportProcess.intakeChannels.join(", "),
    notes: workspace.plan.supportProcess.notes,
  });
  const [savingSupport, setSavingSupport] = useState(false);
  const [supportMessage, setSupportMessage] = useState("");

  useEffect(() => {
    setSupportForm({
      ownerName: workspace.plan.supportProcess.ownerName,
      ownerEmail: workspace.plan.supportProcess.ownerEmail,
      responseTimeHours: String(workspace.plan.supportProcess.responseTimeHours),
      escalationAfterHours: String(workspace.plan.supportProcess.escalationAfterHours),
      intakeChannels: workspace.plan.supportProcess.intakeChannels.join(", "),
      notes: workspace.plan.supportProcess.notes,
    });
  }, [workspace]);

  const handleSaveSupport = async () => {
    setSavingSupport(true);
    setSupportMessage("");
    try {
      const data = await api.put<LaunchWorkspace>("/schools/launch", {
        supportProcess: {
          ownerName: supportForm.ownerName,
          ownerEmail: supportForm.ownerEmail,
          responseTimeHours: Number(supportForm.responseTimeHours) || 24,
          escalationAfterHours: Number(supportForm.escalationAfterHours) || 48,
          intakeChannels: supportForm.intakeChannels.split(",").map((p) => p.trim()).filter(Boolean),
          notes: supportForm.notes,
        },
      });
      onUpdate(data);
      setSupportMessage("Support process saved.");
    } catch (err: any) {
      setSupportMessage(err.message || "Failed to save support process.");
    } finally {
      setSavingSupport(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-gray-900">Support process</h2>
        <p className="mt-1 text-sm text-gray-500">
          Define the operating owner, intake channel, and escalation window before the first live support request lands.
        </p>
        {supportMessage && (
          <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
            {supportMessage}
          </div>
        )}
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Support owner</label>
            <input
              type="text"
              aria-label="Support owner"
              value={supportForm.ownerName}
              onChange={(e) => setSupportForm((current) => ({ ...current, ownerName: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Owner email</label>
            <input
              type="email"
              aria-label="Owner email"
              value={supportForm.ownerEmail}
              onChange={(e) => setSupportForm((current) => ({ ...current, ownerEmail: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">First response SLA (hours)</label>
            <input
              type="number"
              min="1"
              aria-label="First response SLA (hours)"
              value={supportForm.responseTimeHours}
              onChange={(e) => setSupportForm((current) => ({ ...current, responseTimeHours: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Escalate after (hours)</label>
            <input
              type="number"
              min="1"
              aria-label="Escalate after (hours)"
              value={supportForm.escalationAfterHours}
              onChange={(e) => setSupportForm((current) => ({ ...current, escalationAfterHours: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Intake channels</label>
            <input
              type="text"
              aria-label="Intake channels"
              value={supportForm.intakeChannels}
              onChange={(e) => setSupportForm((current) => ({ ...current, intakeChannels: e.target.value }))}
              placeholder="Messages, Email, Office hours"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Support notes</label>
            <textarea
              rows={6}
              aria-label="Support notes"
              value={supportForm.notes}
              onChange={(e) => setSupportForm((current) => ({ ...current, notes: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <button
          onClick={handleSaveSupport}
          disabled={savingSupport}
          className="mt-5 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {savingSupport ? "Saving..." : "Save Support Process"}
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-gray-900">Support flow</h2>
        <div className="mt-5 space-y-3">
          <div className="rounded-lg border border-gray-200 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">1. Intake</div>
            <div className="mt-1 text-sm text-gray-700">
              Route new issues through <span className="font-medium">{supportForm.intakeChannels || "Messages"}</span>.
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">2. First response</div>
            <div className="mt-1 text-sm text-gray-700">
              Respond within <span className="font-medium">{supportForm.responseTimeHours || "24"} hours</span> with owner and workaround.
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">3. Escalation</div>
            <div className="mt-1 text-sm text-gray-700">
              Escalate unresolved issues after <span className="font-medium">{supportForm.escalationAfterHours || "48"} hours</span>.
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">4. Triage</div>
            <div className="mt-1 text-sm text-gray-700">
              Move any product defect into the bug triage list so support, engineering, and rollout state stay aligned.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
