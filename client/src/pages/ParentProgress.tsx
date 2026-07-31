import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { api, getErrorMessage } from "../lib/api";

interface ParentProgressData {
  student: { id: string; name: string; grade?: string | null };
  school: { id: string; name: string } | null;
  cohort: { id: string; name: string } | null;
  approvedHours: number;
  pendingHours: number;
  requiredHours: number;
  remainingHours: number;
  percentComplete: number;
  deadline: string | null;
}

export default function ParentProgress() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [data, setData] = useState<ParentProgressData | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState(token ? "" : "Parent or guardian progress links are disabled.");

  useEffect(() => {
    if (!token) {
      return;
    }

    api.get<ParentProgressData>(`/reports/parent-progress?token=${encodeURIComponent(token)}`)
      .then(setData)
      .catch((err: unknown) => setError(getErrorMessage(err, "Parent or guardian progress links are disabled.")))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-[var(--text-sec)]">Loading progress...</div>;
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-[var(--surface)] border border-[var(--er-b)] rounded-[3px] p-6 text-center">
          <div className="text-[16px] font-semibold text-[var(--er-t)]">Unable to open parent progress</div>
          <div className="text-sm text-[var(--er-t)] mt-2">{error || "Parent or guardian progress links are disabled."}</div>
          <div className="text-sm text-[var(--text-sec)] mt-3">
            Progress sharing must be initiated through a school-controlled workflow.
          </div>
          <Link to="/" className="inline-block mt-4 text-sm text-[var(--action)] hover:underline">
            Return to GoodHours
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--surface-alt)] py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-6">
          <div className="text-sm uppercase tracking-wide text-[var(--action)] font-semibold mb-2">Parent Progress View</div>
          <h1 className="text-[24px] font-semibold text-[var(--text)]">{data.student.name}</h1>
          <div className="text-sm text-[var(--text-sec)] mt-2">
            {[data.school?.name, data.cohort?.name, data.student.grade].filter(Boolean).join(" · ")}
          </div>
        </div>

        <div className="grid sm:grid-cols-4 gap-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-5">
            <div className="text-sm text-[var(--text-sec)]">Approved</div>
            <div className="text-[20px] font-semibold text-[var(--ok-t)] mt-1">{data.approvedHours.toFixed(1)}h</div>
          </div>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-5">
            <div className="text-sm text-[var(--text-sec)]">Pending</div>
            <div className="text-[20px] font-semibold text-yellow-600 mt-1">{data.pendingHours.toFixed(1)}h</div>
          </div>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-5">
            <div className="text-sm text-[var(--text-sec)]">Required</div>
            <div className="text-[20px] font-semibold mt-1">{data.requiredHours.toFixed(1)}h</div>
          </div>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-5">
            <div className="text-sm text-[var(--text-sec)]">Remaining</div>
            <div className="text-[20px] font-semibold text-[var(--action)] mt-1">{data.remainingHours.toFixed(1)}h</div>
          </div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium text-[var(--text)]">Progress toward goal</span>
            <span className="text-[var(--text-sec)]">{data.percentComplete}% complete</span>
          </div>
          <div className="w-full bg-[var(--border)] rounded-full h-3">
            <div className="bg-[var(--in-bg)]0 h-3 rounded-full" style={{ width: `${data.percentComplete}%` }} />
          </div>
          {data.deadline && (
            <div className="text-sm text-[var(--text-sec)] mt-3">
              Service deadline: {new Date(data.deadline).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
