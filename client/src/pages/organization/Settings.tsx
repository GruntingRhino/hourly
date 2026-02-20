import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { api } from "../../lib/api";

type Tab = "profile" | "schools" | "security" | "notifications" | "analytics" | "data";

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

interface OrgStats {
  totalVolunteers: number;
  totalHours: number;
  totalOpportunities: number;
}

interface Volunteer {
  id: string;
  name: string;
  totalHours: number;
}

export default function OrgSettings() {
  const { user, logout, refreshUser } = useAuth();
  const [tab, setTab] = useState<Tab>("profile");
  const [org, setOrg] = useState<OrgData | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [twitter, setTwitter] = useState("");
  const [youtube, setYoutube] = useState("");
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

  // Security
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordIsError, setPasswordIsError] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Notifications
  const defaultNotifPrefs = {
    studentSignup: { email: true, inApp: true },
    hourRequest: { email: true, inApp: true },
    schoolApproval: { email: true, inApp: true },
  };
  const [notifPrefs, setNotifPrefs] = useState<typeof defaultNotifPrefs>(
    (user as any)?.notificationPreferences || defaultNotifPrefs
  );
  const [savingNotif, setSavingNotif] = useState(false);
  const [notifMessage, setNotifMessage] = useState("");

  // Analytics
  const [orgStats, setOrgStats] = useState<OrgStats | null>(null);
  const [topVolunteers, setTopVolunteers] = useState<Volunteer[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

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
            setTiktok(links.tiktok || "");
            setTwitter(links.twitter || "");
            setYoutube(links.youtube || "");
          } catch {}
        }
      });
      loadApprovals();
    }
  }, [user]);

  useEffect(() => {
    if (tab === "analytics" && user?.organizationId && !orgStats) {
      loadAnalytics();
    }
  }, [tab]);

  const loadAnalytics = async () => {
    if (!user?.organizationId) return;
    setAnalyticsLoading(true);
    try {
      const [stats, volunteers] = await Promise.all([
        api.get<OrgStats>(`/organizations/${user.organizationId}/stats`),
        api.get<Volunteer[]>(`/organizations/${user.organizationId}/volunteers`).catch(() => [] as Volunteer[]),
      ]);
      setOrgStats(stats);
      const sorted = [...volunteers].sort((a, b) => b.totalHours - a.totalHours).slice(0, 5);
      setTopVolunteers(sorted);
    } catch {} finally {
      setAnalyticsLoading(false);
    }
  };

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
        socialLinks: { instagram, tiktok, twitter, youtube },
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

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage("");
    setPasswordIsError(false);
    if (newPassword !== confirmPassword) {
      setPasswordMessage("Passwords do not match");
      setPasswordIsError(true);
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMessage("Password must be at least 8 characters");
      setPasswordIsError(true);
      return;
    }
    setChangingPassword(true);
    try {
      await api.put("/auth/password", { currentPassword, newPassword });
      setPasswordMessage("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordMessage(err.message || "Failed to change password");
      setPasswordIsError(true);
    } finally {
      setChangingPassword(false);
    }
  };

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

  const handleSaveNotifications = async () => {
    setSavingNotif(true);
    setNotifMessage("");
    try {
      await api.put("/auth/profile", { notificationPreferences: notifPrefs });
      setNotifMessage("Notification preferences saved!");
    } catch {
      setNotifMessage("Failed to save preferences");
    } finally {
      setSavingNotif(false);
    }
  };

  const toggleNotif = (key: keyof typeof defaultNotifPrefs, channel: "email" | "inApp") => {
    setNotifPrefs((prev) => ({
      ...prev,
      [key]: { ...prev[key], [channel]: !prev[key][channel] },
    }));
  };

  const handleExportCSV = async () => {
    if (!user?.organizationId) return;
    try {
      const volunteers = await api.get<any[]>(`/organizations/${user.organizationId}/volunteers`);
      const rows = [
        ["Name", "Email", "Total Hours", "Sessions"],
        ...volunteers.map((v) => [v.name, v.email || "", v.totalHours?.toString() || "0", v.sessionCount?.toString() || "0"]),
      ];
      const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "volunteer-data.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setMessage(err.message || "Failed to export");
      setIsError(true);
    }
  };

  const statusColor: Record<string, string> = {
    APPROVED: "text-green-600",
    PENDING: "text-yellow-600",
    REJECTED: "text-red-600",
    BLOCKED: "text-gray-400",
  };

  const notifRows = [
    { key: "studentSignup" as const, label: "New Signup Alert" },
    { key: "hourRequest" as const, label: "Hour Request Alert" },
    { key: "schoolApproval" as const, label: "School Approval Request" },
  ];

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="flex flex-wrap gap-2 mb-6">
        {(["profile", "schools", "security", "notifications", "analytics", "data"] as Tab[]).map((t) => (
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
                  placeholder="TikTok"
                  value={tiktok}
                  onChange={(e) => setTiktok(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <input
                  type="text"
                  placeholder="Twitter / X"
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <input
                  type="text"
                  placeholder="YouTube"
                  value={youtube}
                  onChange={(e) => setYoutube(e.target.value)}
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

      {tab === "security" && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold mb-4">Change Password</h3>
          {passwordMessage && (
            <div className={`mb-4 p-3 rounded-md text-sm ${
              passwordIsError
                ? "bg-red-50 border border-red-200 text-red-700"
                : "bg-green-50 border border-green-200 text-green-700"
            }`}>
              {passwordMessage}
            </div>
          )}
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <button
              type="submit"
              disabled={changingPassword}
              className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm hover:bg-gray-800 disabled:opacity-50"
            >
              {changingPassword ? "Changing..." : "Change Password"}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-200">
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
        </div>
      )}

      {tab === "notifications" && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold mb-1">Notification Preferences</h3>
          <p className="text-sm text-gray-500 mb-6">Choose how you want to be notified.</p>

          {notifMessage && (
            <div className="mb-4 p-3 rounded-md text-sm bg-green-50 border border-green-200 text-green-700">
              {notifMessage}
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-100 pb-2">
              <div>Notification</div>
              <div className="text-center">Email</div>
              <div className="text-center">In-App</div>
            </div>
            {notifRows.map(({ key, label }) => (
              <div key={key} className="grid grid-cols-3 gap-4 items-center">
                <div className="text-sm font-medium text-gray-700">{label}</div>
                <div className="flex justify-center">
                  <button
                    onClick={() => toggleNotif(key, "email")}
                    className={`w-10 h-5 rounded-full transition-colors relative ${
                      notifPrefs[key].email ? "bg-blue-600" : "bg-gray-300"
                    }`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      notifPrefs[key].email ? "translate-x-5" : "translate-x-0.5"
                    }`} />
                  </button>
                </div>
                <div className="flex justify-center">
                  <button
                    onClick={() => toggleNotif(key, "inApp")}
                    className={`w-10 h-5 rounded-full transition-colors relative ${
                      notifPrefs[key].inApp ? "bg-blue-600" : "bg-gray-300"
                    }`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      notifPrefs[key].inApp ? "translate-x-5" : "translate-x-0.5"
                    }`} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleSaveNotifications}
            disabled={savingNotif}
            className="mt-6 px-4 py-2 bg-gray-900 text-white rounded-md text-sm hover:bg-gray-800 disabled:opacity-50"
          >
            {savingNotif ? "Saving..." : "Save Preferences"}
          </button>
        </div>
      )}

      {tab === "analytics" && (
        <div className="space-y-6">
          {analyticsLoading ? (
            <div className="text-gray-500">Loading analytics...</div>
          ) : (
            <>
              {orgStats && (
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="font-semibold mb-4">Overview</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{orgStats.totalVolunteers}</div>
                      <div className="text-xs text-gray-500">Total Volunteers</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{orgStats.totalHours}</div>
                      <div className="text-xs text-gray-500">Total Hours</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{orgStats.totalOpportunities}</div>
                      <div className="text-xs text-gray-500">Events Posted</div>
                    </div>
                  </div>
                </div>
              )}

              {topVolunteers.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="font-semibold mb-4">Most Active Volunteers</h3>
                  <div className="space-y-3">
                    {topVolunteers.map((v, i) => (
                      <div key={v.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-500">
                            {i + 1}
                          </span>
                          <span className="text-sm font-medium">{v.name}</span>
                        </div>
                        <span className="text-sm font-bold text-blue-600">{v.totalHours}h</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === "data" && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold mb-2">Export Volunteer Data</h3>
          <p className="text-sm text-gray-500 mb-6">
            Download a CSV of all volunteers and their hours.
          </p>
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm hover:bg-gray-800"
          >
            Export Volunteer Data (CSV)
          </button>
        </div>
      )}
    </div>
  );
}
