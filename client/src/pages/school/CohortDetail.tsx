import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";

interface Student {
  id: string;
  name: string;
  email: string;
  grade: string | null;
  house: string | null;
  approvedHours: number;
}

interface Invitation {
  id: string;
  email: string;
  name: string | null;
  status: string;
  createdAt: string;
  expiresAt: string;
}

interface CohortDetail {
  id: string;
  name: string;
  status: string;
  requiredHours: number;
  startYear: number | null;
  endYear: number | null;
  publishedAt: string | null;
  students: Student[];
  invitations: Invitation[];
}

export default function CohortDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [cohort, setCohort] = useState<CohortDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"students" | "invitations" | "import">("students");
  const [csvData, setCsvData] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [addEmail, setAddEmail] = useState("");
  const [addName, setAddName] = useState("");
  const [addingStudent, setAddingStudent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = user?.role === "SCHOOL_ADMIN";

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get<CohortDetail>(`/cohorts/${id}`);
      setCohort(data);
    } catch {
      setError("Failed to load cohort.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [id]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvData((ev.target?.result as string) || "");
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!csvData.trim()) return;
    setImporting(true);
    setImportResult(null);
    try {
      const result = await api.post<any>(`/cohorts/${id}/import`, { csvData });
      setImportResult(result);
      setCsvData("");
      void load();
    } catch (err: any) {
      setError(err.message || "Import failed.");
    } finally {
      setImporting(false);
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingStudent(true);
    try {
      await api.post(`/cohorts/${id}/add-student`, { email: addEmail, name: addName || undefined });
      setAddEmail("");
      setAddName("");
      void load();
    } catch (err: any) {
      setError(err.message || "Failed to add student.");
    } finally {
      setAddingStudent(false);
    }
  };

  const handlePublish = async () => {
    if (!window.confirm("Send invitation emails to all pending students?")) return;
    try {
      const result = await api.post<any>(`/cohorts/${id}/publish`);
      alert(`Sent ${result.sent} invitations.`);
      void load();
    } catch (err: any) {
      setError(err.message || "Failed to publish.");
    }
  };

  if (loading) return <div className="text-gray-500 py-8 text-center">Loading cohort...</div>;
  if (error) return <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>;
  if (!cohort) return null;

  const requiredHours = cohort.requiredHours;
  const pendingInvitations = cohort.invitations.filter((i) => i.status === "PENDING").length;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link to="/cohorts" className="text-gray-500 hover:text-gray-800 text-sm">← Cohorts</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold">{cohort.name}</h1>
        <span className={`text-xs px-2 py-0.5 rounded-full ${cohort.status === "PUBLISHED" ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
          {cohort.status}
        </span>
      </div>

      {isAdmin && cohort.status !== "PUBLISHED" && pendingInvitations > 0 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded flex justify-between items-center">
          <span className="text-sm text-blue-800">{pendingInvitations} student invitation{pendingInvitations !== 1 ? "s" : ""} ready to send.</span>
          <button onClick={handlePublish} className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">
            Publish & Send Invites
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 border-b mb-6">
        {(["students", "invitations", ...(isAdmin ? ["import"] : [])] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t as any)}
            className={`pb-2 text-sm font-medium border-b-2 capitalize ${tab === t ? "border-gray-900 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            {t} {t === "students" ? `(${cohort.students.length})` : t === "invitations" ? `(${cohort.invitations.length})` : ""}
          </button>
        ))}
      </div>

      {tab === "students" && (
        <div>
          {isAdmin && (
            <form onSubmit={handleAddStudent} className="mb-4 flex gap-2 flex-wrap">
              <input type="text" value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Name (optional)"
                className="px-3 py-2 border border-gray-300 rounded-md text-sm flex-1 min-w-32" />
              <input type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="Student email" required
                className="px-3 py-2 border border-gray-300 rounded-md text-sm flex-1 min-w-40" />
              <button type="submit" disabled={addingStudent} className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm hover:bg-gray-800 disabled:opacity-50">
                {addingStudent ? "Adding..." : "Add"}
              </button>
            </form>
          )}

          {cohort.students.length === 0 ? (
            <div className="text-gray-500 text-sm py-4 text-center">No students enrolled yet.</div>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Name</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Email</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Grade</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600">Hours</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {cohort.students.map((s) => {
                    const status = s.approvedHours >= requiredHours ? "COMPLETED" : s.approvedHours >= requiredHours * 0.5 ? "ON_TRACK" : "AT_RISK";
                    return (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2">{s.name}</td>
                        <td className="px-4 py-2 text-gray-500 text-xs">{s.email}</td>
                        <td className="px-4 py-2 text-gray-500">{s.grade || "-"}</td>
                        <td className="px-4 py-2 text-right">
                          <span className="font-medium">{s.approvedHours.toFixed(1)}</span>
                          <span className="text-gray-400 text-xs">/{requiredHours}h</span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            status === "COMPLETED" ? "bg-green-50 text-green-700" :
                            status === "ON_TRACK" ? "bg-blue-50 text-blue-700" :
                            "bg-red-50 text-red-600"
                          }`}>{status.replace("_", " ")}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "invitations" && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Email</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Sent</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {cohort.invitations.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">{inv.email}</td>
                  <td className="px-4 py-2 text-gray-500">{inv.name || "-"}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      inv.status === "ACCEPTED" ? "bg-green-50 text-green-700" :
                      inv.status === "PENDING" ? "bg-yellow-50 text-yellow-700" :
                      "bg-gray-100 text-gray-500"
                    }`}>{inv.status}</span>
                  </td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{new Date(inv.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {cohort.invitations.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">No invitations sent yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "import" && isAdmin && (
        <div className="max-w-lg">
          <h2 className="font-semibold mb-3">CSV Import</h2>
          <p className="text-sm text-gray-600 mb-4">
            Upload a CSV file with columns: <code className="bg-gray-100 px-1 rounded">name, email, grade, house</code> (name and email required).
          </p>

          {importResult && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-sm">
              Import complete: <strong>{importResult.added}</strong> added, <strong>{importResult.skipped}</strong> skipped.
              {importResult.errors?.length > 0 && (
                <ul className="mt-1 text-xs text-red-600">{importResult.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}</ul>
              )}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50">
                Choose CSV File
              </button>
            </div>
            {csvData && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Preview (first 200 chars): {csvData.slice(0, 200)}{csvData.length > 200 ? "..." : ""}</p>
                <button onClick={handleImport} disabled={importing} className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm hover:bg-gray-800 disabled:opacity-50">
                  {importing ? "Importing..." : "Import Students"}
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 p-3 bg-gray-50 rounded text-xs text-gray-600">
            <p className="font-medium mb-1">CSV Format Example:</p>
            <pre className="font-mono">name,email,grade,house{"\n"}John Smith,john@school.edu,10th,Red{"\n"}Jane Doe,jane@school.edu,11th,Blue</pre>
          </div>
        </div>
      )}
    </div>
  );
}
