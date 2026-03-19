import { useEffect, useState, useRef } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";

interface Beneficiary {
  id: string;
  name: string;
  category: string | null;
  city: string | null;
  state: string | null;
  description: string | null;
  email: string | null;
  approvalStatus: string;
  claimed: boolean;
}

interface DirEntry {
  id: string;
  name: string;
  category: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  zip: string | null;
  description: string | null;
  claimed: boolean;
  distanceMiles?: number;
}

export default function SchoolBeneficiaries() {
  const { user } = useAuth();
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [dirResults, setDirResults] = useState<DirEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"pending" | "approved" | "search" | "create" | "csv">("approved");
  const [dirSearch, setDirSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [inviteEmail, setInviteEmail] = useState<{ [id: string]: string }>({});
  const [inviting, setInviting] = useState<string | null>(null);
  const [newBen, setNewBen] = useState({ name: "", category: "", city: "", state: "", zip: "", email: "", description: "", visibility: "PRIVATE" as "PUBLIC" | "PRIVATE" });
  const [creating, setCreating] = useState(false);
  const [csvData, setCsvData] = useState("");
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState<{ added: number; failed: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [schoolLocation, setSchoolLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [proximityRadius, setProximityRadius] = useState(10);
  const [proximityResults, setProximityResults] = useState<DirEntry[]>([]);
  const [proximityLoading, setProximityLoading] = useState(false);

  const isAdmin = user?.role === "SCHOOL_ADMIN";

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get<Beneficiary[]>("/beneficiaries?status=ALL");
      setBeneficiaries(data);
    } catch {
      setError("Failed to load beneficiaries.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const handleDirSearch = async () => {
    if (dirSearch.trim().length < 2) return;
    setSearching(true);
    try {
      const results = await api.get<DirEntry[]>(`/beneficiaries/directory?search=${encodeURIComponent(dirSearch)}`);
      setDirResults(results);
    } catch {
      setError("Directory search failed.");
    } finally {
      setSearching(false);
    }
  };

  const loadProximityResults = async (lat: number, lng: number, radius: number) => {
    setProximityLoading(true);
    try {
      const results = await api.get<DirEntry[]>(
        `/beneficiaries/directory/nearby?lat=${lat}&lng=${lng}&radius=${radius}`
      );
      setProximityResults(results);
    } catch {
      // Silently fail — proximity search is best-effort
      setProximityResults([]);
    } finally {
      setProximityLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "search" && isAdmin) {
      if (!schoolLocation) {
        // Fetch school location, then load proximity results
        api.get<{ lat: number; lng: number } | null>("/schools/location")
          .then((loc) => {
            if (loc?.lat && loc?.lng) {
              setSchoolLocation(loc);
              void loadProximityResults(loc.lat, loc.lng, proximityRadius);
            }
          })
          .catch(() => {
            // No location available — proximity search won't show
          });
      } else {
        void loadProximityResults(schoolLocation.lat, schoolLocation.lng, proximityRadius);
      }
    }
  }, [tab, isAdmin]);

  useEffect(() => {
    if (tab === "search" && isAdmin && schoolLocation) {
      void loadProximityResults(schoolLocation.lat, schoolLocation.lng, proximityRadius);
    }
  }, [proximityRadius]);

  const handleApproveFromDir = async (directoryId: string) => {
    try {
      await api.post("/beneficiaries/approve-from-directory", { directoryId });
      void load();
      setDirResults((prev) => prev.filter((d) => d.id !== directoryId));
    } catch (err: any) {
      setError(err.message || "Failed to approve.");
    }
  };

  const handleInvite = async (benId: string) => {
    const email = inviteEmail[benId]?.trim();
    if (!email) return;
    setInviting(benId);
    try {
      await api.post(`/beneficiaries/${benId}/invite`, { email });
      setInviteEmail((prev) => ({ ...prev, [benId]: "" }));
      alert("Invitation sent!");
    } catch (err: any) {
      setError(err.message || "Failed to send invitation.");
    } finally {
      setInviting(null);
    }
  };

  const handleDrop = async (benId: string, name: string) => {
    if (!window.confirm(`Remove "${name}" from your approved list?`)) return;
    // Optimistically remove
    setBeneficiaries((prev) => prev.filter((b) => b.id !== benId));
    try {
      await api.post(`/beneficiaries/${benId}/drop`);
    } catch (err: any) {
      setError(err.message || "Failed to drop beneficiary.");
      void load(); // reload on error to restore state
    }
  };

  const handleApprove = async (benId: string) => {
    setApprovingId(benId);
    // Optimistically move from pending to approved
    setBeneficiaries((prev) => prev.map((b) => b.id === benId ? { ...b, approvalStatus: "APPROVED" } : b));
    try {
      await api.post(`/beneficiaries/${benId}/approve`, {});
    } catch (err: any) {
      setError(err.message || "Failed to approve.");
      void load(); // reload on error to restore state
    } finally {
      setApprovingId(null);
    }
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvData((ev.target?.result as string) || "");
    reader.readAsText(file);
  };

  const handleCsvImport = async () => {
    if (!csvData.trim()) return;
    setCsvImporting(true);
    setCsvResult(null);
    try {
      const result = await api.post<{ added: number; failed: number; errors: string[] }>("/beneficiaries/import-csv", { csvData });
      setCsvResult(result);
      setCsvData("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      void load();
    } catch (err: any) {
      setError(err.message || "CSV import failed.");
    } finally {
      setCsvImporting(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post("/beneficiaries", newBen);
      setNewBen({ name: "", category: "", city: "", state: "", zip: "", email: "", description: "", visibility: "PRIVATE" });
      setTab("approved");
      void load();
    } catch (err: any) {
      setError(err.message || "Failed to create beneficiary.");
    } finally {
      setCreating(false);
    }
  };

  const approved = beneficiaries.filter((b) => b.approvalStatus === "APPROVED");
  const pending = beneficiaries.filter((b) => b.approvalStatus === "PENDING");

  // Auto-switch away from pending tab when no more pending items
  useEffect(() => {
    if (tab === "pending" && pending.length === 0 && !loading) {
      setTab("approved");
    }
  }, [pending.length, tab, loading]);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Community Partners</h1>
        <div className="flex items-center gap-3">
          {pending.length > 0 && (
            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">{pending.length} pending</span>
          )}
          <span className="text-sm text-gray-500">{approved.length} approved</span>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

      {/* Tabs */}
      <div className="flex gap-4 border-b mb-6 flex-wrap">
        {[
          ...(pending.length > 0 ? [{ key: "pending", label: `Pending Requests (${pending.length})` }] : []),
          { key: "approved", label: "Approved" },
          ...(isAdmin ? [
            { key: "search", label: "Add from Directory" },
            { key: "create", label: "Create Custom" },
            { key: "csv", label: "Upload CSV" },
          ] : []),
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`pb-2 text-sm font-medium border-b-2 ${tab === t.key ? "border-gray-900 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "pending" && (
        <div>
          {pending.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-500">
              No pending organization requests.
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map((b) => (
                <div key={b.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 mr-4">
                      <div className="font-medium">{b.name}</div>
                      <div className="text-sm text-gray-500">{[b.category, b.city, b.state].filter(Boolean).join(" · ")}</div>
                      {b.description && (
                        <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{b.description}</p>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleApprove(b.id)}
                          disabled={approvingId === b.id}
                          className="px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50">
                          {approvingId === b.id ? "..." : "Approve"}
                        </button>
                        <button
                          onClick={() => handleDrop(b.id, b.name)}
                          disabled={approvingId === b.id}
                          className="px-3 py-1.5 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200 disabled:opacity-50">
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "approved" && (
        <div>
          {loading ? <div className="text-gray-500 text-sm">Loading...</div> : approved.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-500">
              No approved community partners yet. Add from the directory or create a custom one.
            </div>
          ) : (
            <div className="space-y-3">
              {approved.map((b) => (
                <div key={b.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{b.name}</div>
                      <div className="text-sm text-gray-500">{[b.category, b.city, b.state].filter(Boolean).join(" · ")}</div>
                      {b.description && <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{b.description}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {b.claimed && <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded">Registered</span>}
                      {isAdmin && (
                        <button onClick={() => handleDrop(b.id, b.name)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                      )}
                    </div>
                  </div>
                  {isAdmin && !b.claimed && (
                    <div className="mt-3 flex gap-2">
                      <input type="email" value={inviteEmail[b.id] || ""} onChange={(e) => setInviteEmail((prev) => ({ ...prev, [b.id]: e.target.value }))}
                        placeholder={b.email || "Email to send invitation"} className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-xs" />
                      <button onClick={() => handleInvite(b.id)} disabled={inviting === b.id}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50">
                        {inviting === b.id ? "Sending..." : "Send Invite"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "search" && isAdmin && (
        <div>
          <div className="flex gap-2 mb-4">
            <input type="text" value={dirSearch} onChange={(e) => setDirSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleDirSearch(); }}
              placeholder="Search by name, category, or city..." className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm" />
            <button onClick={handleDirSearch} disabled={searching} className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm hover:bg-gray-800 disabled:opacity-50">
              {searching ? "..." : "Search"}
            </button>
          </div>

          {/* Text search results */}
          {dirSearch.length >= 2 && (
            <>
              {dirResults.length > 0 ? (
                <div className="border border-gray-200 rounded-lg divide-y">
                  {dirResults.map((d) => (
                    <div key={d.id} className="px-4 py-3 flex justify-between items-center">
                      <div>
                        <div className="font-medium text-sm">{d.name}</div>
                        <div className="text-xs text-gray-500">{[d.category, d.city, d.state].filter(Boolean).join(" · ")}</div>
                      </div>
                      {d.claimed ? (
                        <span className="text-xs text-gray-400">Already registered</span>
                      ) : (
                        <button onClick={() => handleApproveFromDir(d.id)} className="px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700">
                          Approve & Invite
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : !searching ? (
                <div className="text-gray-500 text-sm">No results found. Try creating a custom partner instead.</div>
              ) : null}
            </>
          )}

          {/* Proximity results (shown when no search term) */}
          {dirSearch.length < 2 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-medium text-gray-700">
                  {schoolLocation ? "Nearby Organizations" : "Directory"}
                </div>
                {schoolLocation && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span>Within</span>
                    <select
                      value={proximityRadius}
                      onChange={(e) => setProximityRadius(Number(e.target.value))}
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                    >
                      <option value={5}>5 miles</option>
                      <option value={10}>10 miles</option>
                      <option value={15}>15 miles</option>
                      <option value={25}>25 miles</option>
                    </select>
                  </div>
                )}
              </div>

              {proximityLoading ? (
                <div className="text-gray-400 text-sm">Loading nearby organizations...</div>
              ) : proximityResults.length > 0 ? (
                <div className="border border-gray-200 rounded-lg divide-y">
                  {proximityResults.map((d) => (
                    <div key={d.id} className="px-4 py-3 flex justify-between items-center">
                      <div>
                        <div className="font-medium text-sm">{d.name}</div>
                        <div className="text-xs text-gray-500">
                          {[d.category, d.city, d.state].filter(Boolean).join(" · ")}
                          {d.distanceMiles != null && (
                            <span className="ml-1 text-blue-500">{d.distanceMiles.toFixed(1)} mi</span>
                          )}
                        </div>
                        {d.description && (
                          <div className="text-xs text-gray-400 mt-0.5 line-clamp-1">{d.description}</div>
                        )}
                      </div>
                      {d.claimed ? (
                        <span className="text-xs text-gray-400">Already registered</span>
                      ) : (
                        <button onClick={() => handleApproveFromDir(d.id)} className="px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700">
                          Approve & Invite
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : !proximityLoading && schoolLocation ? (
                <div className="text-gray-500 text-sm">No organizations found within {proximityRadius} miles. Try a larger radius or search by name.</div>
              ) : !schoolLocation ? (
                <div className="text-gray-400 text-sm">Enter a search term to find organizations, or add your school address in Settings to see nearby suggestions.</div>
              ) : null}
            </div>
          )}
        </div>
      )}

      {tab === "csv" && isAdmin && (
        <div className="max-w-lg">
          <h2 className="font-semibold mb-2">Bulk Upload Community Partners</h2>
          <p className="text-sm text-gray-600 mb-4">
            Upload a CSV with columns: <code className="bg-gray-100 px-1 rounded text-xs">organization_name, contact_name, contact_email, phone, website, address, city, state, zip, description, approved</code>
          </p>

          {csvResult && (
            <div className={`mb-4 p-3 rounded border text-sm ${csvResult.failed > 0 ? "bg-yellow-50 border-yellow-200" : "bg-green-50 border-green-200"}`}>
              <div><strong>{csvResult.added}</strong> partners added, <strong>{csvResult.failed}</strong> failed.</div>
              {csvResult.errors.length > 0 && (
                <ul className="mt-2 text-xs text-red-600 space-y-0.5">
                  {csvResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <input ref={fileInputRef} type="file" accept=".csv" onChange={handleCsvFileUpload} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50">
                Choose CSV File
              </button>
              {csvData && <span className="ml-2 text-xs text-gray-500">File loaded ({csvData.split("\n").length - 1} rows)</span>}
            </div>
            {csvData && (
              <button onClick={handleCsvImport} disabled={csvImporting}
                className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm hover:bg-gray-800 disabled:opacity-50">
                {csvImporting ? "Importing..." : "Import Partners"}
              </button>
            )}
          </div>

          <div className="mt-6 p-3 bg-gray-50 rounded text-xs text-gray-600">
            <p className="font-medium mb-1">CSV Format Example:</p>
            <pre className="font-mono text-xs overflow-x-auto">organization_name,contact_name,contact_email,phone,website,address,city,state,zip,description,approved{"\n"}Green Earth,John Smith,john@greenearth.org,6175551234,https://greenearth.org,123 Main St,Boston,MA,02110,Environmental org,true</pre>
          </div>
        </div>
      )}

      {tab === "create" && isAdmin && (
        <div className="max-w-lg">
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name *</label>
                <input type="text" value={newBen.name} onChange={(e) => setNewBen((p) => ({ ...p, name: e.target.value }))} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <input type="text" value={newBen.category} onChange={(e) => setNewBen((p) => ({ ...p, category: e.target.value }))}
                  placeholder="e.g. Food Bank, Environment" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input type="text" value={newBen.city} onChange={(e) => setNewBen((p) => ({ ...p, city: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input type="text" value={newBen.state} onChange={(e) => setNewBen((p) => ({ ...p, state: e.target.value }))}
                  placeholder="e.g. MA" maxLength={2} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
                <input type="email" value={newBen.email} onChange={(e) => setNewBen((p) => ({ ...p, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
                <select value={newBen.visibility} onChange={(e) => setNewBen((p) => ({ ...p, visibility: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                  <option value="PRIVATE">Private (this school only)</option>
                  <option value="PUBLIC">Public (submit for global directory)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={newBen.description} onChange={(e) => setNewBen((p) => ({ ...p, description: e.target.value }))}
                rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
            </div>
            <button type="submit" disabled={creating} className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm hover:bg-gray-800 disabled:opacity-50">
              {creating ? "Creating..." : "Create Partner"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
