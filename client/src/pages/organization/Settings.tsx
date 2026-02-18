import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { api } from "../../lib/api";

interface OrgData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  description: string | null;
  website: string | null;
  socialLinks: string | null;
}

interface SchoolApproval {
  id: string;
  status: string;
  school: { id: string; name: string; domain: string | null };
}

interface SchoolResult {
  id: string;
  name: string;
  domain: string | null;
  verified: boolean;
}

export default function OrgSettings() {
  const { user, logout, refreshUser } = useAuth();
  const [tab, setTab] = useState<"profile" | "schools" | "settings">("profile");
  const [org, setOrg] = useState<OrgData | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [twitter, setTwitter] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  // Schools
  const [approvals, setApprovals] = useState<SchoolApproval[]>([]);
  const [schoolSearch, setSchoolSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SchoolResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [schoolMsg, setSchoolMsg] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await api.delete("/auth/account");
      logout();
    } catch (err: any) {
      setMessage(err.message || "Failed to delete account");
      setIsError(true);
      setDeleting(false);
      setDeleteConfirm(false);
      setDeleteInput("");
    }
  };

  useEffect(() => {
    if (user?.organizationId) {
      api.get<OrgData>(`/organizations/${user.organizationId}`).then((data) => {
        setOrg(data);
        setName(data.name);
        setPhone(data.phone || "");
        setDescription(data.description || "");
        setWebsite(data.website || "");
        if (data.socialLinks) {
          try {
            const links = JSON.parse(data.socialLinks);
            setInstagram(links.instagram || "");
            setTwitter(links.twitter || "");
          } catch {}
        }
      });
      loadApprovals();
    }
  }, [user]);

  const loadApprovals = async () => {
    if (!user?.organizationId) return;
    try {
      const data = await api.get<SchoolApproval[]>(`/organizations/${user.organizationId}/schools`);
      setApprovals(data);
    } catch {}
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.organizationId) return;
    setSaving(true);
    setMessage("");
    setIsError(false);
    try {
      await api.put(`/organizations/${user.organizationId}`, {
        name,
        phone,
        description,
        website,
        socialLinks: { instagram, twitter },
      });
      setMessage("Profile updated!");
      await refreshUser();
    } catch (err: any) {
      setMessage(err.message || "Failed to update profile");
      setIsError(true);
    } finally {
      setSaving(false);
    }
  };

  const handleSearchSchools = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolSearch.trim()) return;
    setSearching(true);
    setSearchResults([]);
    try {
      const results = await api.get<SchoolResult[]>(`/schools?search=${encodeURIComponent(schoolSearch)}`);
      setSearchResults(results);
    } catch {
      setSchoolMsg("Failed to search schools");
    } finally {
      setSearching(false);
    }
  };

  const handleRequestApproval = async (schoolId: string) => {
    if (!user?.organizationId) return;
    setRequesting(schoolId);
    setSchoolMsg("");
    try {
      await api.post(`/organizations/${user.organizationId}/request-school/${schoolId}`);
      setSchoolMsg("Request sent! The school admin will review your request.");
      setSearchResults([]);
      setSchoolSearch("");
      await loadApprovals();
    } catch (err: any) {
      setSchoolMsg(err.message || "Failed to send request");
    } finally {
      setRequesting(null);
    }
  };

  const statusColor: Record<string, string> = {
    APPROVED: "text-green-600",
    PENDING: "text-yellow-600",
    REJECTED: "text-red-600",
    BLOCKED: "text-gray-400",
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="flex gap-2 mb-6">
        {(["profile", "schools", "settings"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium capitalize ${
              tab === t ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center text-2xl text-gray-500">
              {org?.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-semibold text-lg">{org?.name}</div>
              <div className="text-sm text-gray-500">{org?.email}</div>
            </div>
          </div>

          {message && (
            <div className={`mb-4 p-3 rounded-md text-sm ${
              isError
                ? "bg-red-50 border border-red-200 text-red-700"
                : "bg-green-50 border border-green-200 text-green-700"
            }`}>
              {message}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <span className={`text-xs ${description.length > 480 ? "text-red-500" : "text-gray-400"}`}>
                  {description.length}/500
                </span>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Social Links</label>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Instagram"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <input
                  type="text"
                  placeholder="Twitter"
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <button onClick={logout} className="text-red-600 text-sm hover:underline">
              Log Out
            </button>
          </div>
        </div>
      )}

      {tab === "schools" && (
        <div className="space-y-6">
          {/* Existing relationships */}
          {approvals.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold mb-4">School Connections</h3>
              <div className="space-y-2">
                {approvals.map((a) => (
                  <div key={a.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <div className="text-sm font-medium">{a.school.name}</div>
                      {a.school.domain && <div className="text-xs text-gray-400">{a.school.domain}</div>}
                    </div>
                    <span className={`text-xs font-medium ${statusColor[a.status] || "text-gray-500"}`}>
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Request new school approval */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-2">Request School Approval</h3>
            <p className="text-sm text-gray-500 mb-4">
              Search for a school by name or domain to request approval to post opportunities for their students.
            </p>

            {schoolMsg && (
              <div className={`mb-4 p-3 rounded-md text-sm ${
                schoolMsg.startsWith("Request sent")
                  ? "bg-green-50 border border-green-200 text-green-700"
                  : "bg-red-50 border border-red-200 text-red-700"
              }`}>
                {schoolMsg}
              </div>
            )}

            <form onSubmit={handleSearchSchools} className="flex gap-2 mb-4">
              <input
                type="text"
                value={schoolSearch}
                onChange={(e) => setSchoolSearch(e.target.value)}
                placeholder="Search by school name or domain..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <button
                type="submit"
                disabled={searching || !schoolSearch.trim()}
                className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm hover:bg-gray-800 disabled:opacity-50"
              >
                {searching ? "Searching..." : "Search"}
              </button>
            </form>

            {searchResults.length > 0 && (
              <div className="space-y-2">
                {searchResults.map((school) => {
                  const existing = approvals.find((a) => a.school.id === school.id);
                  return (
                    <div key={school.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="text-sm font-medium">{school.name}</div>
                        {school.domain && <div className="text-xs text-gray-400">{school.domain}</div>}
                      </div>
                      {existing ? (
                        <span className={`text-xs font-medium ${statusColor[existing.status] || "text-gray-500"}`}>
                          {existing.status}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleRequestApproval(school.id)}
                          disabled={requesting === school.id}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
                        >
                          {requesting === school.id ? "Sending..." : "Request Approval"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {searchResults.length === 0 && schoolSearch && !searching && (
              <p className="text-sm text-gray-400">No schools found. Try a different search.</p>
            )}
          </div>
        </div>
      )}

      {tab === "settings" && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold text-red-600 mb-1">Delete Account</h3>
          <p className="text-sm text-gray-500 mb-3">
            Permanently deletes your account and personal data. Your organization profile and posted opportunities will remain but will have no active administrator.
          </p>
          {!deleteConfirm ? (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="px-4 py-2 border border-red-300 text-red-600 rounded-md text-sm hover:bg-red-50"
            >
              Delete My Account
            </button>
          ) : (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm font-medium text-red-800 mb-3">
                Type <span className="font-mono font-bold">DELETE</span> to confirm:
              </p>
              <input
                type="text"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                placeholder="DELETE"
                className="w-full px-3 py-2 border border-red-300 rounded-md text-sm mb-3"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteInput !== "DELETE" || deleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? "Deleting..." : "Permanently Delete"}
                </button>
                <button
                  onClick={() => { setDeleteConfirm(false); setDeleteInput(""); }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
