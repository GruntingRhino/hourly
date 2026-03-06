import { useEffect, useState } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import { api } from "../../lib/api";

interface Student {
  id: string;
  name: string;
  email: string;
  grade?: string | null;
  cohortId: string;
  cohortName: string;
  approvedHours: number;
  requiredHours: number;
  status: "COMPLETED" | "ON_TRACK" | "AT_RISK";
}

export default function StudentList() {
  const { id: cohortId } = useParams<{ id: string }>();
  const location = useLocation();
  const [students, setStudents] = useState<Student[]>([]);
  const [cohortName, setCohortName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isOnTrack = location.pathname.endsWith("/on-track");
  const isOffTrack = location.pathname.endsWith("/off-track");
  const filter = isOnTrack ? "on-track" : isOffTrack ? "off-track" : "all";

  useEffect(() => { void load(); }, [cohortId, location.pathname]);

  const load = async () => {
    setLoading(true);
    try {
      if (cohortId) {
        const cohort = await api.get<any>(`/cohorts/${cohortId}`);
        setCohortName(cohort.name);
        const req = cohort.requiredHours;
        const mapped: Student[] = cohort.students.map((s: any) => ({
          ...s,
          cohortId,
          cohortName: cohort.name,
          requiredHours: req,
          status: s.approvedHours >= req ? "COMPLETED" : s.approvedHours >= req * 0.5 ? "ON_TRACK" : "AT_RISK",
        }));
        setStudents(mapped);
      } else {
        const data = await api.get<Student[]>("/cohorts/school-students");
        setStudents(data);
      }
    } catch {
      setError("Failed to load students.");
    } finally {
      setLoading(false);
    }
  };

  const filtered = filter === "on-track"
    ? students.filter((s) => s.status === "ON_TRACK" || s.status === "COMPLETED")
    : filter === "off-track"
    ? students.filter((s) => s.status === "AT_RISK")
    : students;

  const title = cohortId
    ? `${cohortName} — ${filter === "on-track" ? "On-Track Students" : "Off-Track Students"}`
    : filter === "on-track" ? "On-Track Students"
    : filter === "off-track" ? "Off-Track Students"
    : "Student Roster";

  const backLink = cohortId ? `/cohorts/${cohortId}` : "/dashboard";
  const backLabel = cohortId ? `← ${cohortName || "Cohort"}` : "← Dashboard";

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link to={backLink} className="text-gray-500 hover:text-gray-800 text-sm">{backLabel}</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold">{title}</h1>
      </div>

      {/* School-wide filter tabs */}
      {!cohortId && (
        <div className="flex gap-4 border-b mb-6">
          {[
            { label: "All Students", path: "/students" },
            { label: "On Track", path: "/students/on-track" },
            { label: "Off Track", path: "/students/off-track" },
          ].map((t) => (
            <Link
              key={t.path}
              to={t.path}
              className={`pb-2 text-sm font-medium border-b-2 ${
                location.pathname === t.path
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      )}

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm mb-4">{error}</div>}

      {loading ? (
        <div className="text-gray-500 text-sm py-8 text-center">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-500">
          No students found.
        </div>
      ) : (
        <div>
          <div className="text-sm text-gray-500 mb-3">{filtered.length} student{filtered.length !== 1 ? "s" : ""}</div>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Email</th>
                  {!cohortId && <th className="text-left px-4 py-2 font-medium text-gray-600">Cohort</th>}
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Hours</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Required</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium">{s.name}</td>
                    <td className="px-4 py-2 text-gray-500 text-xs">{s.email}</td>
                    {!cohortId && <td className="px-4 py-2 text-gray-500 text-xs">{s.cohortName}</td>}
                    <td className="px-4 py-2 text-right font-medium">{s.approvedHours.toFixed(1)}</td>
                    <td className="px-4 py-2 text-right text-gray-400">{s.requiredHours}h</td>
                    <td className="px-4 py-2 text-right">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        s.status === "COMPLETED" ? "bg-green-50 text-green-700" :
                        s.status === "ON_TRACK" ? "bg-blue-50 text-blue-700" :
                        "bg-red-50 text-red-600"
                      }`}>{s.status.replace("_", " ")}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
