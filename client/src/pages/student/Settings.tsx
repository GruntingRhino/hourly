import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import { api } from "../../lib/api";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Tab = "profile" | "classroom" | "security" | "notifications" | "privacy";

interface Session {
  id: string;
  totalHours: number | null;
  status: string;
  verificationStatus: string;
  opportunity: { title: string; date: string };
}

export default function StudentSettings() {
  const { user, logout, refreshUser } = useAuth();
  const [tab, setTab] = useState<Tab>("profile");

  // Profile tab
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [grade, setGrade] = useState(user?.grade || "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl || null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarUrl || null);
  const [instagram, setInstagram] = useState((user?.socialLinks as any)?.instagram || "");
  const [tiktok, setTiktok] = useState((user?.socialLinks as any)?.tiktok || "");
  const [twitter, setTwitter] = useState((user?.socialLinks as any)?.twitter || "");
  const [youtube, setYoutube] = useState((user?.socialLinks as any)?.youtube || "");
  const [signupCount, setSignupCount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Security tab
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordIsError, setPasswordIsError] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Classroom tab
  const [inviteCode, setInviteCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [classroomMessage, setClassroomMessage] = useState("");
  const [classroomIsError, setClassroomIsError] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);

  // Notifications tab
  const defaultNotifPrefs = {
    hourApproval: { email: true, inApp: true },
    hourRemoval: { email: true, inApp: true },
    eventChange: { email: true, inApp: true },
    orgRequest: { email: true, inApp: true },
  };
  const [notifPrefs, setNotifPrefs] = useState<typeof defaultNotifPrefs>(
    (user as any)?.notificationPreferences || defaultNotifPrefs
  );
  const [savingNotif, setSavingNotif] = useState(false);
  const [notifMessage, setNotifMessage] = useState("");

  // Privacy tab
  const defaultMsgPrefs = { allowFrom: "EVERYONE", profileVisibility: "EVERYONE" };
  const [msgPrefs, setMsgPrefs] = useState<typeof defaultMsgPrefs>(
    (user as any)?.messagePreferences || defaultMsgPrefs
  );
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [privacyMessage, setPrivacyMessage] = useState("");

  useEffect(() => {
    // Load signup count
    api.get<any[]>("/signups/my").then((s) => setSignupCount(s.length)).catch(() => {});
  }, []);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setAvatarPreview(base64);
      setAvatarUrl(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setIsError(false);
    try {
      await api.put("/auth/profile", {
        name,
        phone,
        bio,
        grade,
        avatarUrl,
        socialLinks: { instagram, tiktok, twitter, youtube },
      });
      await refreshUser();
      setMessage("Profile updated!");
    } catch (err: any) {
      setMessage(err.message || "Failed to update profile");
      setIsError(true);
    } finally {
      setSaving(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const csv = await api.get<string>("/reports/export/csv?type=student");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "my-service-hours.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setMessage(err.message || "Failed to export");
      setIsError(true);
    }
  };

  const handleExportPDF = async () => {
    try {
      const sessions = await api.get<Session[]>("/sessions/my");
      const verified = sessions.filter((s) => s.verificationStatus === "APPROVED");
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text("Service Hours Report", 14, 20);
      doc.setFontSize(11);
      doc.text(`Student: ${user?.name}`, 14, 30);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 37);

      const totalHours = verified.reduce((sum, s) => sum + (s.totalHours || 0), 0);
      doc.text(`Total Verified Hours: ${totalHours.toFixed(1)}`, 14, 44);

      autoTable(doc, {
        startY: 52,
        head: [["Opportunity", "Date", "Hours", "Status"]],
        body: sessions.map((s) => [
          s.opportunity.title,
          new Date(s.opportunity.date).toLocaleDateString(),
          s.totalHours?.toFixed(1) || "—",
          s.verificationStatus,
        ]),
      });

      doc.save("service-hours.pdf");
    } catch (err: any) {
      setMessage(err.message || "Failed to export PDF");
      setIsError(true);
    }
  };

  const handleJoinClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    setClassroomMessage("");
    setClassroomIsError(false);
    setJoining(true);
    try {
      await api.post("/classrooms/join", { inviteCode: inviteCode.trim() });
      setClassroomMessage("Joined classroom successfully!");
      setInviteCode("");
      await refreshUser();
    } catch (err: any) {
      setClassroomMessage(err.message || "Failed to join classroom");
      setClassroomIsError(true);
    } finally {
      setJoining(false);
    }
  };

  const handleLeaveClassroom = async () => {
    setClassroomMessage("");
    setClassroomIsError(false);
    setLeaveConfirm(false);
    try {
      await api.post("/classrooms/leave");
      setClassroomMessage("Left classroom successfully");
      await refreshUser();
    } catch (err: any) {
      setClassroomMessage(err.message || "Failed to leave classroom");
      setClassroomIsError(true);
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
      setPasswordMessage(err.message || "Failed to delete account");
      setPasswordIsError(true);
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

  const notifRows = [
    { key: "hourApproval" as const, label: "Hour Approvals" },
    { key: "hourRemoval" as const, label: "Hour Removals" },
    { key: "eventChange" as const, label: "Event Reminders" },
    { key: "orgRequest" as const, label: "Org Requests" },
  ];

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="flex flex-wrap gap-2 mb-6">
        {(["profile", "classroom", "security", "notifications", "privacy"] as Tab[]).map((t) => (
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
          {/* Avatar */}
          <div className="flex items-center gap-4 mb-6">
            <div
              className="relative w-20 h-20 cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
            >
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Avatar"
                  className="w-20 h-20 rounded-full object-cover"
                />
              ) : (
                <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center text-2xl text-gray-500">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs transition-opacity">
                Change
              </div>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
            <div>
              <div className="font-semibold text-lg">{user?.name}</div>
              <div className="text-sm text-gray-500">{user?.email}</div>
              {user?.school && (
                <div className="text-sm text-gray-400">{user.school.name}</div>
              )}
              <div className="text-sm text-gray-400 mt-1">
                {signupCount !== null ? `${signupCount} signups` : ""}
              </div>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Select grade</option>
                <option value="9">9th Grade</option>
                <option value="10">10th Grade</option>
                <option value="11">11th Grade</option>
                <option value="12">12th Grade</option>
              </select>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700">Biography</label>
                <span className={`text-xs ${bio.length > 280 ? "text-red-500" : "text-gray-400"}`}>
                  {bio.length}/300
                </span>
              </div>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 300))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            {/* Social Links */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Social Links</label>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Instagram (@username or URL)"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <input
                  type="text"
                  placeholder="TikTok (@username or URL)"
                  value={tiktok}
                  onChange={(e) => setTiktok(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <input
                  type="text"
                  placeholder="Twitter/X (@username or URL)"
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <input
                  type="text"
                  placeholder="YouTube (channel URL)"
                  value={youtube}
                  onChange={(e) => setYoutube(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm hover:bg-gray-800 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={handleExportCSV}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
              >
                Export Hours (CSV)
              </button>
              <button
                type="button"
                onClick={handleExportPDF}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
              >
                Export Hours (PDF)
              </button>
            </div>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <button onClick={logout} className="text-red-600 text-sm hover:underline">
              Log Out
            </button>
          </div>
        </div>
      )}

      {tab === "classroom" && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold mb-4">Classroom</h3>

          {classroomMessage && (
            <div className={`mb-4 p-3 rounded-md text-sm ${
              classroomIsError
                ? "bg-red-50 border border-red-200 text-red-700"
                : "bg-green-50 border border-green-200 text-green-700"
            }`}>
              {classroomMessage}
            </div>
          )}

          {user?.classroomId ? (
            <div>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4">
                <div className="font-medium text-blue-900">
                  {(user as any).classroom?.name || "Classroom"}
                </div>
                <div className="text-sm text-blue-700">
                  {user.school?.name || "School"}
                </div>
              </div>
              {leaveConfirm ? (
                <div className="mt-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm font-medium text-yellow-800 mb-1">Leave this classroom?</p>
                  <p className="text-xs text-yellow-700 mb-3">
                    You'll need a new invite code from your teacher to re-join any classroom.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleLeaveClassroom}
                      className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                    >
                      Leave
                    </button>
                    <button
                      onClick={() => setLeaveConfirm(false)}
                      className="px-3 py-1.5 border border-gray-300 rounded text-sm hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setLeaveConfirm(true)}
                  className="text-red-600 text-sm hover:underline"
                >
                  Leave Classroom
                </button>
              )}
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-500 mb-4">
                Enter an invite code from your teacher to join a classroom.
              </p>
              <form onSubmit={handleJoinClassroom} className="flex gap-2">
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="Enter 8-character code"
                  maxLength={8}
                  required
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md font-mono tracking-wider text-center"
                />
                <button
                  type="submit"
                  disabled={joining || inviteCode.trim().length !== 8}
                  className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm hover:bg-gray-800 disabled:opacity-50"
                >
                  {joining ? "Joining..." : "Join"}
                </button>
              </form>
            </div>
          )}
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
              Permanently deletes your account, all your service records, signups, and personal data. This cannot be undone.
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
            {/* Header */}
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
                    className={`w-10 h-5 rounded-full transition-colors ${
                      notifPrefs[key].email ? "bg-blue-600" : "bg-gray-300"
                    } relative`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      notifPrefs[key].email ? "translate-x-5" : "translate-x-0.5"
                    }`} />
                  </button>
                </div>
                <div className="flex justify-center">
                  <button
                    onClick={() => toggleNotif(key, "inApp")}
                    className={`w-10 h-5 rounded-full transition-colors ${
                      notifPrefs[key].inApp ? "bg-blue-600" : "bg-gray-300"
                    } relative`}
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
          <p className="text-sm text-gray-500 mb-6">Control who can see your profile and message you.</p>

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
              <p className="text-xs text-gray-400 mt-1">
                Restricts who can send you direct messages.
              </p>
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
    </div>
  );
}
