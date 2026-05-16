import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { api } from "../lib/api";

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
  const [data, setData] = useState<ParentProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setError("Parent or guardian progress links are disabled.");
      setLoading(false);
      return;
    }

    api.get<ParentProgressData>(`/reports/parent-progress?token=${encodeURIComponent(token)}`)
      .then(setData)
      .catch((err: any) => setError(err.message || "Parent or guardian progress links are disabled."))
      .finally(() => setLoading(false));
  }, [params]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading progress...</div>;
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white border border-red-200 rounded-xl p-6 text-center">
          <div className="text-lg font-semibold text-red-700">Unable to open parent progress</div>
          <div className="text-sm text-red-600 mt-2">{error || "Parent or guardian progress links are disabled."}</div>
          <div className="text-sm text-gray-600 mt-3">
            Progress sharing must be initiated through a school-controlled workflow.
          </div>
          <Link to="/" className="inline-block mt-4 text-sm text-blue-600 hover:underline">
            Return to GoodHours
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="text-sm uppercase tracking-wide text-blue-600 font-semibold mb-2">Parent Progress View</div>
          <h1 className="text-3xl font-bold text-gray-900">{data.student.name}</h1>
          <div className="text-sm text-gray-500 mt-2">
            {[data.school?.name, data.cohort?.name, data.student.grade].filter(Boolean).join(" · ")}
          </div>
        </div>

        <div className="grid sm:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="text-sm text-gray-500">Approved</div>
            <div className="text-2xl font-bold text-green-600 mt-1">{data.approvedHours.toFixed(1)}h</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="text-sm text-gray-500">Pending</div>
            <div className="text-2xl font-bold text-yellow-600 mt-1">{data.pendingHours.toFixed(1)}h</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="text-sm text-gray-500">Required</div>
            <div className="text-2xl font-bold mt-1">{data.requiredHours.toFixed(1)}h</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="text-sm text-gray-500">Remaining</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">{data.remainingHours.toFixed(1)}h</div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium text-gray-700">Progress toward goal</span>
            <span className="text-gray-500">{data.percentComplete}% complete</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div className="bg-blue-500 h-3 rounded-full" style={{ width: `${data.percentComplete}%` }} />
          </div>
          {data.deadline && (
            <div className="text-sm text-gray-500 mt-3">
              Service deadline: {new Date(data.deadline).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
