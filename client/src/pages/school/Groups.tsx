import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";

interface Group {
  id: string;
  name: string;
  _count: { members: number };
}

interface StudentInfo {
  id: string;
  name: string;
  email: string;
  grade: string | null;
  approvedHours: number;
  requiredHours: number;
  status: "COMPLETED" | "ON_TRACK" | "AT_RISK";
}

interface AllStudent {
  id: string;
  name: string;
  email: string;
  grade: string | null;
  approvedHours: number;
}

export default function SchoolGroups() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [groups, setGroups] = useState<Group[]>([]);
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [allStudents, setAllStudents] = useState<AllStudent[]>([]);
  const [selectedGroup, setSelectedGroup] = useState(searchParams.get("group") || "");
  const [selectedStudent, setSelectedStudent] = useState<StudentInfo | null>(null);
  const [filter, setFilter] = useState(searchParams.get("filter") || "All");
  const [search, setSearch] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [schoolRequiredHours, setSchoolRequiredHours] = useState(40);
  const [loading, setLoading] = useState(true);

  const schoolId = user?.schoolId;

  useEffect(() => {
    if (!schoolId) return;
    Promise.all([
      api.get<Group[]>(`/schools/${schoolId}/groups`),
      api.get<AllStudent[]>(`/schools/${schoolId}/students`),
      api.get<{ requiredHours: number }>(`/schools/${schoolId}`),
    ]).then(([gr, st, schoolData]) => {
      setGroups(gr);
      setAllStudents(st);
      setSchoolRequiredHours(schoolData.requiredHours);
      setLoading(false);
    });
  }, [schoolId]);

  useEffect(() => {
    if (selectedGroup && schoolId) {
      api.get<StudentInfo[]>(`/schools/${schoolId}/groups/${selectedGroup}/students`).then(setStudents);
    }
  }, [selectedGroup, schoolId]);

  const handleCreateGroup = async () => {
    if (!newGroupName || !schoolId) return;
    await api.post(`/schools/${schoolId}/groups`, { name: newGroupName });
    setNewGroupName("");
    const gr = await api.get<Group[]>(`/schools/${schoolId}/groups`);
    setGroups(gr);
  };

  const handleSelectGroup = (groupId: string) => {
    setSelectedGroup(groupId);
    setSelectedStudent(null);
    setSearchParams({ group: groupId });
  };

  const filtered = (selectedGroup ? students : allStudents.map((s) => ({
    ...s,
    requiredHours: schoolRequiredHours,
    status: (s.approvedHours >= schoolRequiredHours ? "COMPLETED" : s.approvedHours >= schoolRequiredHours * 0.5 ? "ON_TRACK" : "AT_RISK") as "COMPLETED" | "ON_TRACK" | "AT_RISK",
  }))).filter((s) => {
    if (filter !== "All" && s.status !== filter.replace(" ", "_").toUpperCase()) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const statusColors: Record<string, string> = {
    COMPLETED: "text-green-600",
    ON_TRACK: "text-blue-600",
    AT_RISK: "text-red-600",
    NOT_STARTED: "text-gray-500",
  };

  if (loading) return <div className="text-gray-500">Loading...</div>;

  const activeGroup = groups.find((g) => g.id === selectedGroup);
  const groupStudents = selectedGroup ? students : [];
  const completedCount = groupStudents.filter((s) => s.status === "COMPLETED").length;
  const totalInGroup = groupStudents.length;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">
        {activeGroup ? activeGroup.name : "Student Groups"}
      </h1>

      <div className="grid md:grid-cols-4 gap-6">
        {/* Left: Group list */}
        <div>
          <div className="space-y-1 mb-4">
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => handleSelectGroup(g.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm ${
                  selectedGroup === g.id
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {g.name}
              </button>
            ))}
            <button
              onClick={() => {
                setSelectedGroup("");
                setSearchParams({});
              }}
              className={`w-full text-left px-3 py-2 rounded-md text-sm ${
                !selectedGroup ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              All Students
            </button>
          </div>

          <div className="flex gap-1">
            <input
              type="text"
              placeholder="New group name"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
            />
            <button
              onClick={handleCreateGroup}
              className="px-2 py-1 bg-gray-900 text-white rounded text-xs"
            >
              Add
            </button>
          </div>
        </div>

        {/* Center: Student list */}
        <div className="md:col-span-2">
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="Search students..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>

          <div className="space-y-2">
            {filtered.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedStudent(s as StudentInfo)}
                className={`w-full text-left bg-white border rounded-lg p-4 hover:border-blue-300 ${
                  selectedStudent?.id === s.id ? "border-blue-500" : "border-gray-200"
                }`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-gray-500">{s.email}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">{s.approvedHours}h</div>
                    <div className={`text-xs font-medium ${statusColors[s.status] || ""}`}>
                      {s.status === "COMPLETED" ? "Completed" : s.status === "ON_TRACK" ? "On Track" : "At Risk"}
                    </div>
                  </div>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="text-gray-500 text-center py-4 text-sm">No students found.</div>
            )}
          </div>
        </div>

        {/* Right: Filters + group stats */}
        <div>
          <h3 className="font-semibold text-sm mb-2">Status</h3>
          <div className="space-y-1 mb-6">
            {["All", "Completed", "On Track", "At Risk", "Not Started"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm ${
                  filter === f ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {activeGroup && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">{activeGroup.name}</span>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                  {totalInGroup > 0 ? Math.round((completedCount / totalInGroup) * 100) : 0}%
                </span>
              </div>
              <div className="text-sm text-gray-600">
                {completedCount} / {totalInGroup} students completed their goal
              </div>
              <div className="text-sm text-red-500 mt-1">
                {groupStudents.filter((s) => s.status === "AT_RISK").length} students are at risk
              </div>
            </div>
          )}

          {/* Student detail */}
          {selectedStudent && (
            <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
              <div className="font-semibold">{selectedStudent.name}</div>
              <div className="mt-2">
                <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${Math.min(100, (selectedStudent.approvedHours / selectedStudent.requiredHours) * 100)}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500">
                  {selectedStudent.approvedHours}/{selectedStudent.requiredHours} hours verified
                </div>
              </div>
              <div className="mt-2 flex gap-2">
                <span className={`text-xs font-medium ${statusColors[selectedStudent.status]}`}>
                  {selectedStudent.status === "COMPLETED" ? "Completed" : selectedStudent.status === "ON_TRACK" ? "On Track" : "At Risk"}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
