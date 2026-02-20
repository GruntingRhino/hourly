import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { api } from "../../lib/api";

type Tab = "profile" | "classrooms" | "security" | "notifications" | "privacy" | "data";

interface SchoolData {
  id: string;
  name: string;
  domain: string | null;
  verified: boolean;
  requiredHours: number;
  verificationStandard: string;
  zipCodes: string | null;
}

interface ClassroomData {
  id: string;
  name: string;
  inviteCode: string;
  isActive: boolean;
  teacher: { id: string; name: string };
  studentCount: number;
}

export default function SchoolSettings() {
  const { user, logout, refreshUser } = useAuth();
  const [tab, setTab] = useState<Tab>("profile");
  const [school, setSchool] = useState<SchoolData | null>(null);
  const [classrooms, setClassrooms] = useState<ClassroomData[]>([]);
  const [schoolName, setSchoolName] = useState("");
  const [domain, setDomain] = useState("");
  const [requiredHours, setRequiredHours] = useState("40");
  const [zipCodes, setZipCodes] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [newClassroomName, setNewClassroomName] = useState("");
  const [creatingClassroom, setCreatingClassroom] = useState(false);

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
    studentJoin: { email: true, inApp: true },
    hourApproval: { email: true, inApp: true },
    orgRequest: { email: true, inApp: true },
  };
  const [notifPrefs, setNotifPrefs] = useState<typeof defaultNotifPrefs>(
    (user as any)?.notificationPreferences || defaultNotifPrefs
  );
  const [savingNotif, setSavingNotif] = useState(false);
  const [notifMessage, setNotifMessage] = useState("");

  // Privacy
  const defaultMsgPrefs = { allowFrom: "EVERYONE", profileVisibility: "EVERYONE" };
  const [msgPrefs, setMsgPrefs] = useState<typeof defaultMsgPrefs>(
    (user as any)?.messagePreferences || defaultMsgPrefs
  );
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [privacyMessage, setPrivacyMessage] = useState("");

  useEffect(() => {
    if (user?.schoolId) {
      Promise.all([
        api.get<SchoolData>(`/schools/${user.schoolId}`),
        api.get<ClassroomData[]>("/classrooms"),
      ]).then(([schoolData, classroomData]) => {
        setSchool(schoolData);
        setSchoolName(schoolData.name || "");
        setDomain(schoolData.domain || "");
        setRequiredHours(String(schoolData.requiredHours));
        try {
          const zips = schoolData.zipCodes ? JSON.parse(schoolData.zipCodes) : [];
          setZipCodes(Array.isArray(zips) ? zips.join(", ") : "");
        } catch {
          setZipCodes("");
        }
        setClassrooms(classroomData);
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.schoolId) return;
    setSaving(true);
    setMessage("");
    setIsError(false);
    try {
      const zipArray = zipCodes
        ? zipCodes.split(",").map((z) => z.trim()).filter(Boolean)
        : [];
      await api.put(`/schools/${user.schoolId}`, {
        name: schoolName,
        domain: domain || null,
        requiredHours: parseFloat(requiredHours),
        zipCodes: zipArray,
      });
      setMessage("Settings updated!");
      await refreshUser();
    } catch (err: any) {
      setMessage(err.message || "Failed to update settings");
      setIsError(true);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateClassroom = async () => {
    if (!newClassroomName.trim()) return;
    setCreatingClassroom(true);
    try {
      await api.post("/classrooms", { name: newClassroomName.trim() });
      setNewClassroomName("");
      const data = await api.get<ClassroomData[]>("/classrooms");
      setClassrooms(data);
    } catch (err: any) {
      setMessage(err.message || "Failed to create classroom");
      setIsError(true);
    } finally {
      setCreatingClassroom(false);
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

  const handleSavePrivacy = async () => {
    setSavingPrivacy(true);
    setPrivacyMessage("");
    try {
      await api.put("/auth/profile", { messagePreferences: msgPrefs });
      setPrivacyMessage("Privacy settings saved!");
    } catch {
      setPrivacyMessage("Failed to save settings");
    } finally {
      setSavingPrivacy(false);
    }
  };

  const toggleNotif = (key: keyof typeof defaultNotifPrefs, channel: "email" | "inApp") => {
    setNotifPrefs((prev) => ({
      ...prev,
      [key]: { ...prev[key], [channel]: !prev[key][channel] },
    }));
  };

  const handleExportActivityLog = async () => {
    if (!user?.schoolId) return;
    try {
      const sessions = await api.get<any[]>(`/schools/${user.schoolId}/sessions`).catch(() => [] as any[]);
      const rows = [
        ["Student", "Opportunity", "Date", "Hours", "Status"],
        ...sessions.map((s: any) => [
          s.user?.name || "",
          s.opportunity?.title || "",
          s.opportunity?.date ? new Date(s.opportunity.date).toLocaleDateString() : "",
          s.totalHours?.toString() || "",
          s.verificationStatus || s.status || "",
        ]),
      ];
      const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "activity-log.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setMessage(err.message || "Failed to export");
      setIsError(true);
    }
  };

  const notifRows = [
    { key: "studentJoin" as const, label: "Student Joins/Leaves" },
    { key: "hourApproval" as const, label: "Hour Approval Alert" },
    { key: "orgRequest" as const, label: "Org Request Alert" },
  ];

  if (loading) return <div className="text-gray-500">Loading settings...</div>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="flex flex-wrap gap-2 mb-6">
        {(["profile", "classrooms", "security", "notifications", "privacy", "data"] as Tab[]).map((t) => (
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
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-semibold text-lg">{user?.name}</div>
              <div className="text-sm text-gray-500">{user?.email}</div>
              {school && (
                <div className="text-sm text-gray-400">
                  {school.name}
                  {!school.verified && (
                    <span className="ml-2 text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded">
                      Unverified
                    </span>
                  )}
                </div>
              )}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">School Name</label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Domain <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="e.g. lincoln.edu"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Required Service Hours</label>
              <input
                type="number"
                value={requiredHours}
                onChange={(e) => setRequiredHours(e.target.value)}
                min="0"
                step="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                School ZIP Codes <span className="text-gray-400">(comma-separated, for proximity matching)</span>
              </label>
              <input
                type="text"
                value={zipCodes}
                onChange={(e) => setZipCodes(e.target.value)}
                placeholder="e.g. 02101, 02102"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
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

      {tab === "classrooms" && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold mb-4">Classrooms</h3>

          <div className="space-y-3 mb-6">
            {classrooms.map((c) => (
              <div key={c.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-sm text-gray-500">
                      Teacher: {c.teacher.name} &middot; {c.studentCount} students
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                      {c.inviteCode}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">Invite Code</div>
                  </div>
                </div>
              </div>
            ))}
            {classrooms.length === 0 && (
              <div className="text-gray-500 text-sm">No classrooms yet.</div>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newClassroomName}
              onChange={(e) => setNewClassroomName(e.target.value)}
              placeholder="New classroom name"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <button
              onClick={handleCreateClassroom}
              disabled={creatingClassroom || !newClassroomName.trim()}
              className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm hover:bg-gray-800 disabled:opacity-50"
            >
              {creatingClassroom ? "Creating..." : "Create"}
            </button>
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
              Permanently deletes your account and removes all associated school data, classrooms, and student associations. This cannot be undone.
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

      {tab === "privacy" && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold mb-1">Privacy Settings</h3>
          <p className="text-sm text-gray-500 mb-6">Control visibility and message restrictions.</p>

          {privacyMessage && (
            <div className="mb-4 p-3 rounded-md text-sm bg-green-50 border border-green-200 text-green-700">
              {privacyMessage}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Profile Visibility</label>
              <select
                value={msgPrefs.profileVisibility}
                onChange={(e) => setMsgPrefs((p) => ({ ...p, profileVisibility: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="EVERYONE">Everyone</option>
                <option value="SCHOOL">School Only</option>
                <option value="PRIVATE">Private</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message Restrictions</label>
              <select
                value={msgPrefs.allowFrom}
                onChange={(e) => setMsgPrefs((p) => ({ ...p, allowFrom: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="EVERYONE">Everyone</option>
                <option value="ORGS_ONLY">Organizations Only</option>
                <option value="ADMINS_ONLY">Admins Only</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleSavePrivacy}
            disabled={savingPrivacy}
            className="mt-6 px-4 py-2 bg-gray-900 text-white rounded-md text-sm hover:bg-gray-800 disabled:opacity-50"
          >
            {savingPrivacy ? "Saving..." : "Save Settings"}
          </button>
        </div>
      )}

      {tab === "data" && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold mb-2">Export Activity Log</h3>
          <p className="text-sm text-gray-500 mb-6">
            Download a CSV of all student service sessions at your school.
          </p>
          <button
            onClick={handleExportActivityLog}
            className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm hover:bg-gray-800"
          >
            Export Activity Log (CSV)
          </button>
        </div>
      )}
    </div>
  );
}
