import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../../hooks/useAuth";
import { api, getErrorMessage } from "../../lib/api";

const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "One lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "One number", test: (p: string) => /[0-9]/.test(p) },
  { label: "One special character", test: (p: string) => /[^a-zA-Z0-9]/.test(p) },
];

function ZipCodeInput({ zipCodes, onChange }: { zipCodes: string[]; onChange: (z: string[]) => void }) {
  const [input, setInput] = useState("");
  const addZip = () => {
    const z = input.trim();
    if (z && /^\d{5}$/.test(z) && !zipCodes.includes(z)) {
      onChange([z, ...zipCodes]);
      setInput("");
    }
  };
  return (
    <div>
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addZip(); } }}
          placeholder="e.g. 02101"
          maxLength={5}
          className="flex-1 h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--action)]"
        />
        <button type="button" onClick={addZip} className="px-3 py-2 bg-[var(--surface-alt)] text-[var(--text)] rounded-[2px] hover:bg-[var(--border)] text-sm">
          Add
        </button>
      </div>
      <div className="flex flex-wrap gap-1">
        {zipCodes.map((z) => (
          <span key={z} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[var(--in-bg)] text-[var(--action)] rounded-full text-sm">
            {z}
            <button type="button" onClick={() => onChange(zipCodes.filter((x) => x !== z))} className="text-blue-400 hover:text-[var(--action)]">×</button>
          </span>
        ))}
      </div>
    </div>
  );
}

type Tab = "profile" | "schools" | "security" | "notifications" | "analytics" | "data";

type NotificationChannelPreferences = { email?: boolean; inApp?: boolean };
type NotificationPreferences = Partial<Record<"studentSignup" | "hourRequest" | "schoolApproval", NotificationChannelPreferences>>;

const defaultNotifPrefs = {
  studentSignup: { email: true, inApp: true },
  hourRequest: { email: true, inApp: true },
  schoolApproval: { email: true, inApp: true },
};

function mergeNotifPrefs(incoming?: NotificationPreferences) {
  return {
    studentSignup: {
      email: incoming?.studentSignup?.email ?? defaultNotifPrefs.studentSignup.email,
      inApp: incoming?.studentSignup?.inApp ?? defaultNotifPrefs.studentSignup.inApp,
    },
    hourRequest: {
      email: incoming?.hourRequest?.email ?? defaultNotifPrefs.hourRequest.email,
      inApp: incoming?.hourRequest?.inApp ?? defaultNotifPrefs.hourRequest.inApp,
    },
    schoolApproval: {
      email: incoming?.schoolApproval?.email ?? defaultNotifPrefs.schoolApproval.email,
      inApp: incoming?.schoolApproval?.inApp ?? defaultNotifPrefs.schoolApproval.inApp,
    },
  };
}

interface OrgData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  description: string | null;
  website: string | null;
  socialLinks: string | null;
  zipCodes: string | null;
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
  label: string;
  totalHours: number;
  sessionCount: number;
}

export default function OrgSettings() {
  const { user, logout, refreshUser } = useAuth();
  const organizationId = user?.organizationId;
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
  const [zipCodes, setZipCodes] = useState<string[]>([]);
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
  const [notifPrefs, setNotifPrefs] = useState<typeof defaultNotifPrefs>(
    () => mergeNotifPrefs(user?.notificationPreferences ?? undefined)
  );
  const notifPrefsRef = useRef(notifPrefs);
  const [savingNotif, setSavingNotif] = useState(false);
  const [notifMessage, setNotifMessage] = useState("");

  // Analytics
  const [orgStats, setOrgStats] = useState<OrgStats | null>(null);
  const [topVolunteers, setTopVolunteers] = useState<Volunteer[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const loadAnalytics = useCallback(async () => {
    if (!organizationId) return;
    setAnalyticsLoading(true);
    try {
      const [stats, volunteers] = await Promise.all([
        api.get<OrgStats>(`/organizations/${organizationId}/stats`),
        api.get<Volunteer[]>(`/organizations/${organizationId}/volunteers`).catch(() => [] as Volunteer[]),
      ]);
      setOrgStats(stats);
      setTopVolunteers([...volunteers].sort((a, b) => b.totalHours - a.totalHours).slice(0, 5));
    } catch { /* Analytics is optional; retain the existing dashboard state. */ } finally {
      setAnalyticsLoading(false);
    }
  }, [organizationId]);

  const loadApprovals = useCallback(async () => {
    if (!organizationId) return;
    try {
      setApprovals(await api.get<SchoolApproval[]>(`/organizations/${organizationId}/schools`));
    } catch { /* Keep the current approval list if refresh fails. */ }
  }, [organizationId]);

  useEffect(() => {
    if (organizationId) {
      api.get<OrgData>(`/organizations/${organizationId}`).then((data) => {
        setOrg(data);
        setName(data.name);
        setPhone(data.phone || "");
        setDescription(data.description || "");
        setWebsite(data.website || "");
        if (data.zipCodes) {
          try { setZipCodes(JSON.parse(data.zipCodes)); } catch { /* Ignore malformed legacy preferences. */ }
        }
        if (data.socialLinks) {
          try {
            const links = JSON.parse(data.socialLinks);
            setInstagram(links.instagram || "");
            setTiktok(links.tiktok || "");
            setTwitter(links.twitter || "");
            setYoutube(links.youtube || "");
          } catch { /* Ignore malformed legacy preferences. */ }
        }
      });
      queueMicrotask(() => { void loadApprovals(); });
    }
  }, [loadApprovals, organizationId]);

  useEffect(() => {
    if (tab === "analytics" && organizationId && !orgStats) {
      queueMicrotask(() => { void loadAnalytics(); });
    }
  }, [loadAnalytics, orgStats, organizationId, tab]);

  useEffect(() => {
    queueMicrotask(() => { notifPrefsRef.current = notifPrefs; });
  }, [notifPrefs]);


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
        zipCodes,
      });
      setMessage("Profile updated!");
      await refreshUser();
    } catch (err: unknown) {
      setMessage(getErrorMessage(err, "Failed to update profile"));
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
    } catch (err: unknown) {
      setSchoolMsg(getErrorMessage(err, "Failed to send request"));
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
    const failedRule = PASSWORD_RULES.find((r) => !r.test(newPassword));
    if (failedRule) {
      setPasswordMessage(failedRule.label + " required");
      setPasswordIsError(true);
      return;
    }
    setChangingPassword(true);
    try {
      await api.put("/auth/password", { currentPassword, newPassword });
      // Changing the password revokes all previous tokens; the server
      // already refreshed the HttpOnly session cookie on this same response.
      setPasswordMessage("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      setPasswordMessage(getErrorMessage(err, "Failed to change password"));
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
    } catch (err: unknown) {
      setMessage(getErrorMessage(err, "Failed to delete account"));
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
      await api.put("/auth/profile", { notificationPreferences: notifPrefsRef.current });
      void refreshUser();
      setNotifMessage("Notification preferences saved!");
    } catch {
      setNotifMessage("Failed to save preferences");
    } finally {
      setSavingNotif(false);
    }
  };

  const toggleNotif = (key: keyof typeof defaultNotifPrefs, channel: "email" | "inApp") => {
    setNotifPrefs((prev) => {
      const next = {
        ...prev,
        [key]: { ...prev[key], [channel]: !prev[key][channel] },
      };
      notifPrefsRef.current = next;
      return next;
    });
  };

  const handleExportCSV = async () => {
    if (!user?.organizationId) return;
    try {
      const volunteers = await api.get<Volunteer[]>(`/organizations/${user.organizationId}/volunteers`);
      const rows = [
        ["Volunteer", "Total Hours", "Sessions"],
        ...volunteers.map((v) => [v.label || "Anonymous volunteer", v.totalHours?.toString() || "0", v.sessionCount?.toString() || "0"]),
      ];
      const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "volunteer-data.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setMessage(getErrorMessage(err, "Failed to export"));
      setIsError(true);
    }
  };

  const statusColor: Record<string, string> = {
    APPROVED: "text-[var(--ok-t)]",
    PENDING: "text-yellow-600",
    REJECTED: "text-[var(--er-t)]",
    BLOCKED: "text-[var(--text-faint)]",
  };

  const notifRows = [
    { key: "studentSignup" as const, label: "New Signup Alert" },
    { key: "hourRequest" as const, label: "Hour Request Alert" },
    { key: "schoolApproval" as const, label: "School Approval Request" },
  ];

  return (
    <div className="max-w-2xl">
      <h1 className="text-[20px] font-semibold mb-5">Settings</h1>

      <div className="flex flex-wrap gap-2 mb-6">
        {(["profile", "schools", "security", "notifications", "analytics", "data"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-[2px] text-sm font-medium capitalize ${
              tab === t ? "bg-[var(--in-bg)] text-[var(--action)]" : "text-[var(--text-sec)] hover:bg-[var(--surface-alt)]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-20 h-20 bg-[var(--border)] rounded-full flex items-center justify-center text-[20px] text-[var(--text-sec)]">
              {org?.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-semibold text-lg">{org?.name}</div>
              <div className="text-sm text-[var(--text-sec)]">{org?.email}</div>
            </div>
          </div>

          {message && (
            <div className={`mb-4 p-3 rounded-[2px] text-sm ${
              isError
                ? "bg-[var(--er-bg)] border border-[var(--er-b)] text-[var(--er-t)]"
                : "bg-[var(--ok-bg)] border border-[var(--ok-b)] text-[var(--ok-t)]"
            }`}>
              {message}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">Organization Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)]"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-[var(--text)]">Description</label>
                <span className={`text-xs ${description.length > 480 ? "text-[var(--er-t)]" : "text-[var(--text-faint)]"}`}>
                  {description.length}/500
                </span>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                rows={3}
                className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">Website</label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-2">Social Links</label>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Instagram"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)] text-sm"
                />
                <input
                  type="text"
                  placeholder="TikTok"
                  value={tiktok}
                  onChange={(e) => setTiktok(e.target.value)}
                  className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)] text-sm"
                />
                <input
                  type="text"
                  placeholder="Twitter / X"
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                  className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)] text-sm"
                />
                <input
                  type="text"
                  placeholder="YouTube"
                  value={youtube}
                  onChange={(e) => setYoutube(e.target.value)}
                  className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)] text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">
                Service Area ZIP Codes
              </label>
              {zipCodes.length === 0 && (
                <div className="mb-2 p-3 bg-[var(--wn-bg)] border border-[var(--wn-b)] rounded-[2px] text-[var(--wn-t)] text-xs">
                  No ZIP codes set. If students sort by distance, your opportunities will appear at the bottom of the list since your location is unknown.
                </div>
              )}
              <ZipCodeInput zipCodes={zipCodes} onChange={setZipCodes} />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="h-[34px] px-4 bg-[var(--action)] text-white rounded-[2px] text-[13px] font-medium text-sm hover:opacity-85 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-[var(--border)]">
            <button onClick={logout} className="text-[var(--er-t)] text-sm hover:underline">
              Log Out
            </button>
          </div>
        </div>
      )}

      {tab === "schools" && (
        <div className="space-y-6">
          {approvals.length > 0 && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-6">
              <h3 className="font-semibold mb-4">School Connections</h3>
              <div className="space-y-2">
                {approvals.map((a) => (
                  <div key={a.id} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
                    <div>
                      <div className="text-sm font-medium">{a.school.name}</div>
                      {a.school.domain && <div className="text-xs text-[var(--text-faint)]">{a.school.domain}</div>}
                    </div>
                    <span className={`text-xs font-medium ${statusColor[a.status] || "text-[var(--text-sec)]"}`}>
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-6">
            <h3 className="font-semibold mb-2">Request School Approval</h3>
            <p className="text-sm text-[var(--text-sec)] mb-4">
              Search for a school by name or domain to request approval to post opportunities for their students.
            </p>

            {schoolMsg && (
              <div className={`mb-4 p-3 rounded-[2px] text-sm ${
                schoolMsg.startsWith("Request sent")
                  ? "bg-[var(--ok-bg)] border border-[var(--ok-b)] text-[var(--ok-t)]"
                  : "bg-[var(--er-bg)] border border-[var(--er-b)] text-[var(--er-t)]"
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
                className="flex-1 h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)] text-sm"
              />
              <button
                type="submit"
                disabled={searching || !schoolSearch.trim()}
                className="h-[34px] px-4 bg-[var(--action)] text-white rounded-[2px] text-[13px] font-medium text-sm hover:opacity-85 disabled:opacity-50"
              >
                {searching ? "Searching..." : "Search"}
              </button>
            </form>

            {searchResults.length > 0 && (
              <div className="space-y-2">
                {searchResults.map((school) => {
                  const existing = approvals.find((a) => a.school.id === school.id);
                  return (
                    <div key={school.id} className="flex items-center justify-between p-3 bg-[var(--surface-alt)] rounded-[3px]">
                      <div>
                        <div className="text-sm font-medium">{school.name}</div>
                        {school.domain && <div className="text-xs text-[var(--text-faint)]">{school.domain}</div>}
                      </div>
                      {existing ? (
                        <span className={`text-xs font-medium ${statusColor[existing.status] || "text-[var(--text-sec)]"}`}>
                          {existing.status}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleRequestApproval(school.id)}
                          disabled={requesting === school.id}
                          className="px-3 py-1 bg-[var(--action)] text-white rounded text-xs hover:bg-[var(--action)] disabled:opacity-50"
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
              <p className="text-sm text-[var(--text-faint)]">No schools found. Try a different search.</p>
            )}
          </div>
        </div>
      )}

      {tab === "security" && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-6">
          <h3 className="font-semibold mb-4">Change Password</h3>
          {passwordMessage && (
            <div className={`mb-4 p-3 rounded-[2px] text-sm ${
              passwordIsError
                ? "bg-[var(--er-bg)] border border-[var(--er-b)] text-[var(--er-t)]"
                : "bg-[var(--ok-bg)] border border-[var(--ok-b)] text-[var(--ok-t)]"
            }`}>
              {passwordMessage}
            </div>
          )}
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)]"
              />
              {newPassword.length > 0 && (
                <ul className="mt-2 space-y-0.5">
                  {PASSWORD_RULES.map((r) => (
                    <li key={r.label} className={`text-xs flex items-center gap-1.5 ${r.test(newPassword) ? "text-[var(--ok-t)]" : "text-[var(--text-faint)]"}`}>
                      <span>{r.test(newPassword) ? "✓" : "○"}</span> {r.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)]"
              />
            </div>
            <button
              type="submit"
              disabled={changingPassword}
              className="h-[34px] px-4 bg-[var(--action)] text-white rounded-[2px] text-[13px] font-medium text-sm hover:opacity-85 disabled:opacity-50"
            >
              {changingPassword ? "Changing..." : "Change Password"}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-[var(--border)]">
            <h3 className="font-semibold text-[var(--er-t)] mb-1">Delete Account</h3>
            <p className="text-sm text-[var(--text-sec)] mb-3">
              Permanently deletes your account and personal data. Your organization profile and posted opportunities will remain but will have no active administrator.
            </p>
            {!deleteConfirm ? (
              <button
                onClick={() => setDeleteConfirm(true)}
                className="px-4 py-2 border border-[var(--er-b)] text-[var(--er-t)] rounded-[2px] text-sm hover:bg-[var(--er-bg)]"
              >
                Delete My Account
              </button>
            ) : (
              <div className="p-4 bg-[var(--er-bg)] border border-[var(--er-b)] rounded-[3px]">
                <p className="text-sm font-medium text-[var(--er-t)] mb-3">
                  Type <span className="font-mono font-bold">DELETE</span> to confirm:
                </p>
                <input
                  type="text"
                  value={deleteInput}
                  onChange={(e) => setDeleteInput(e.target.value)}
                  placeholder="DELETE"
                  className="w-full px-3 py-2 border border-[var(--er-b)] rounded-[2px] text-sm mb-3"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleteInput !== "DELETE" || deleting}
                    className="px-4 py-2 bg-[var(--er-t)] text-white rounded-[2px] text-sm hover:bg-[var(--er-t)] disabled:opacity-50"
                  >
                    {deleting ? "Deleting..." : "Permanently Delete"}
                  </button>
                  <button
                    onClick={() => { setDeleteConfirm(false); setDeleteInput(""); }}
                    className="px-4 py-2 border border-[var(--border-s)] rounded-[2px] text-sm hover:bg-[var(--surface-alt)]"
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
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-6">
          <h3 className="font-semibold mb-1">Notification Preferences</h3>
          <p className="text-sm text-[var(--text-sec)] mb-6">Choose how you want to be notified.</p>

          {notifMessage && (
            <div className="mb-4 p-3 rounded-[2px] text-sm bg-[var(--ok-bg)] border border-[var(--ok-b)] text-[var(--ok-t)]">
              {notifMessage}
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-xs font-medium text-[var(--text-sec)] uppercase tracking-wide border-b border-[var(--border)] pb-2">
              <div>Notification</div>
              <div className="text-center">Email</div>
              <div className="text-center">In-App</div>
            </div>
            {notifRows.map(({ key, label }) => (
              <div key={key} className="grid grid-cols-3 gap-4 items-center">
                <div className="text-sm font-medium text-[var(--text)]">{label}</div>
                <div className="flex justify-center">
                  <button
                    onClick={() => toggleNotif(key, "email")}
                    className={`w-10 h-5 rounded-full transition-colors relative ${
                      notifPrefs[key].email ? "bg-[var(--action)]" : "bg-[var(--border-s)]"
                    }`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-[var(--surface)] rounded-full shadow transition-transform ${
                      notifPrefs[key].email ? "translate-x-5" : "translate-x-0.5"
                    }`} />
                  </button>
                </div>
                <div className="flex justify-center">
                  <button
                    onClick={() => toggleNotif(key, "inApp")}
                    className={`w-10 h-5 rounded-full transition-colors relative ${
                      notifPrefs[key].inApp ? "bg-[var(--action)]" : "bg-[var(--border-s)]"
                    }`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-[var(--surface)] rounded-full shadow transition-transform ${
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
            className="mt-6 h-[34px] px-4 bg-[var(--action)] text-white rounded-[2px] text-[13px] font-medium text-sm hover:opacity-85 disabled:opacity-50"
          >
            {savingNotif ? "Saving..." : "Save Preferences"}
          </button>
        </div>
      )}

      {tab === "analytics" && (
        <div className="space-y-6">
          {analyticsLoading ? (
            <div className="text-[var(--text-sec)]">Loading analytics...</div>
          ) : (
            <>
              {orgStats && (
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-6">
                  <h3 className="font-semibold mb-4">Overview</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-[28px] font-bold text-[var(--action)]">{orgStats.totalVolunteers}</div>
                      <div className="text-xs text-[var(--text-sec)]">Total Volunteers</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[28px] font-bold text-[var(--ok-t)]">{orgStats.totalHours}</div>
                      <div className="text-xs text-[var(--text-sec)]">Total Hours</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[20px] font-semibold">{orgStats.totalOpportunities}</div>
                      <div className="text-xs text-[var(--text-sec)]">Events Posted</div>
                    </div>
                  </div>
                </div>
              )}

              {topVolunteers.length > 0 && (
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-6">
                  <h3 className="font-semibold mb-4">Most Active Volunteers</h3>
                  <div className="space-y-3">
                    {topVolunteers.map((v, i) => (
                      <div key={v.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 bg-[var(--surface-alt)] rounded-full flex items-center justify-center text-xs font-bold text-[var(--text-sec)]">
                            {i + 1}
                          </span>
                          <span className="text-sm font-medium">{v.label}</span>
                        </div>
                        <span className="text-sm font-bold text-[var(--action)]">{v.totalHours}h</span>
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
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-6">
          <h3 className="font-semibold mb-2">Export Volunteer Data</h3>
          <p className="text-sm text-[var(--text-sec)] mb-6">
            Download a CSV of anonymized volunteer summaries and hours.
          </p>
          <button
            onClick={handleExportCSV}
            className="h-[34px] px-4 bg-[var(--action)] text-white rounded-[2px] text-[13px] font-medium text-sm hover:opacity-85"
          >
            Export Volunteer Data (CSV)
          </button>
        </div>
      )}
    </div>
  );
}
