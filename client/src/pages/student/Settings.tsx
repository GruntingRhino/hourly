import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import { api, getErrorMessage } from "../../lib/api";
import { setAuthSession } from "../../lib/authSession";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Tab = "profile" | "classroom" | "security" | "notifications" | "privacy";

interface StudentNotificationPreferences {
  hourApproval?: { email?: boolean; inApp?: boolean };
  hourRemoval?: { email?: boolean; inApp?: boolean };
  eventChange?: { email?: boolean; inApp?: boolean };
  orgRequest?: { email?: boolean; inApp?: boolean };
}

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
  const [bio, setBio] = useState(user?.bio || "");
  const [grade, setGrade] = useState(user?.grade || "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarUrl || null);
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
  const mergeNotifPrefs = (incoming: StudentNotificationPreferences | null | undefined) => ({
    hourApproval: {
      email: incoming?.hourApproval?.email ?? defaultNotifPrefs.hourApproval.email,
      inApp: incoming?.hourApproval?.inApp ?? defaultNotifPrefs.hourApproval.inApp,
    },
    hourRemoval: {
      email: incoming?.hourRemoval?.email ?? defaultNotifPrefs.hourRemoval.email,
      inApp: incoming?.hourRemoval?.inApp ?? defaultNotifPrefs.hourRemoval.inApp,
    },
    eventChange: {
      email: incoming?.eventChange?.email ?? defaultNotifPrefs.eventChange.email,
      inApp: incoming?.eventChange?.inApp ?? defaultNotifPrefs.eventChange.inApp,
    },
    orgRequest: {
      email: incoming?.orgRequest?.email ?? defaultNotifPrefs.orgRequest.email,
      inApp: incoming?.orgRequest?.inApp ?? defaultNotifPrefs.orgRequest.inApp,
    },
  });
  const [notifPrefs, setNotifPrefs] = useState<typeof defaultNotifPrefs>(
    mergeNotifPrefs(user?.notificationPreferences)
  );
  const notifPrefsRef = useRef(notifPrefs);
  const [savingNotif, setSavingNotif] = useState(false);
  const [notifMessage, setNotifMessage] = useState("");

  // Privacy tab
  const defaultMsgPrefs = { allowFrom: "EVERYONE", profileVisibility: "EVERYONE" };
  const [msgPrefs, setMsgPrefs] = useState<typeof defaultMsgPrefs>(() => ({
    allowFrom: user?.messagePreferences?.allowFrom ?? defaultMsgPrefs.allowFrom,
    profileVisibility: user?.messagePreferences?.profileVisibility ?? defaultMsgPrefs.profileVisibility,
  }));
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [privacyMessage, setPrivacyMessage] = useState("");

  useEffect(() => {
    // Load signup count
    api.get<unknown[]>("/signups/my").then((s) => setSignupCount(s.length)).catch(() => {});
  }, []);

  useEffect(() => {
    notifPrefsRef.current = notifPrefs;
  }, [notifPrefs]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setAvatarPreview(base64);
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
        grade: grade || undefined,
      });
      await refreshUser();
      setMessage("Profile updated!");
    } catch (err: unknown) {
      setMessage(getErrorMessage(err, "Failed to update profile"));
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
    } catch (err: unknown) {
      setMessage(getErrorMessage(err, "Failed to export"));
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
    } catch (err: unknown) {
      setMessage(getErrorMessage(err, "Failed to export PDF"));
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
    } catch (err: unknown) {
      setClassroomMessage(getErrorMessage(err, "Failed to join classroom"));
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
    } catch (err: unknown) {
      setClassroomMessage(getErrorMessage(err, "Failed to leave classroom"));
      setClassroomIsError(true);
    }
  };

  const activeCohorts = user?.cohorts ?? [];

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
      const result = await api.put<{ token?: string }>("/auth/password", { currentPassword, newPassword });
      // Changing the password revokes all previous tokens — adopt the fresh one
      if (result?.token) setAuthSession(result.token);
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
      setPasswordMessage(getErrorMessage(err, "Failed to delete account"));
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
      await api.put("/auth/profile", { notificationPreferences: notifPrefsRef.current });
      void refreshUser();
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
      await refreshUser();
      setPrivacyMessage("Privacy settings saved!");
    } catch {
      setPrivacyMessage("Failed to save settings");
    } finally {
      setSavingPrivacy(false);
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

  const notifRows = [
    { key: "hourApproval" as const, label: "Hour Approvals" },
    { key: "hourRemoval" as const, label: "Hour Removals" },
    { key: "eventChange" as const, label: "Event Reminders" },
    { key: "orgRequest" as const, label: "Org Requests" },
  ];

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <div className="text-[12px] mb-1" style={{ color: "var(--text-faint)" }}>Student / Settings</div>
        <h1 className="text-[20px] font-semibold" style={{ color: "var(--text)" }}>Settings</h1>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-6">
        {(["profile", "classroom", "security", "notifications", "privacy"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="h-[32px] px-4 rounded-[2px] text-[13px] font-medium capitalize transition-colors"
            style={tab === t
              ? { background: "var(--navy)", color: "#fff" }
              : { background: "var(--surface)", color: "var(--text-sec)", border: "1px solid var(--border)" }
            }
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <div className="border border-[var(--border)] rounded-[3px] p-6" style={{ background: "var(--surface)" }}>
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
                <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl" style={{ background: "var(--surface-alt)", color: "var(--text-faint)" }}>
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
              <div className="font-semibold text-[15px]" style={{ color: "var(--text)" }}>{user?.name}</div>
              <div className="text-[13px]" style={{ color: "var(--text-sec)" }}>{user?.email}</div>
              {user?.school && (
                <div className="text-[13px]" style={{ color: "var(--text-faint)" }}>{user.school.name}</div>
              )}
              <div className="text-[13px] mt-1" style={{ color: "var(--text-faint)" }}>
                {signupCount !== null ? `${signupCount} signups` : ""}
              </div>
            </div>
          </div>

          {activeCohorts.length > 0 && (
            <div className="mb-6 rounded-[3px] border border-[var(--border)] p-4" style={{ background: "var(--surface-alt)" }}>
              <h3 className="font-semibold" style={{ color: "var(--text)" }}>Active Cohorts</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {activeCohorts.map((cohort) => (
                  <div
                    key={cohort.id}
                    className="rounded-[2px] border px-3 py-1 text-[13px]"
                    style={{ borderColor: "var(--border-s)", background: "var(--surface)", color: "var(--text-sec)" }}
                  >
                    {cohort.name}
                    {cohort.serviceEndDate
                      ? ` • ends ${new Date(cohort.serviceEndDate).toLocaleDateString()}`
                      : ""}
                  </div>
                ))}
              </div>
            </div>
          )}

          {message && (
            <div
              className="mb-4 px-3 py-2 rounded-[3px] border text-[13px]"
              style={isError
                ? { background: "var(--er-bg)", borderColor: "var(--er-b)", color: "var(--er-t)" }
                : { background: "var(--ok-bg)", borderColor: "var(--ok-b)", color: "var(--ok-t)" }}
            >
              {message}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-[13px] font-medium mb-1" style={{ color: "var(--text)" }}>Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)]"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-1" style={{ color: "var(--text)" }}>Grade</label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)]"
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
                <label className="block text-[13px] font-medium" style={{ color: "var(--text)" }}>Biography</label>
                <span className="text-[12px]" style={{ color: bio.length > 280 ? "var(--er-t)" : "var(--text-faint)" }}>
                  {bio.length}/300
                </span>
              </div>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 300))}
                rows={3}
                className="w-full px-3 py-2 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)]"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="h-[34px] px-4 rounded-[2px] text-white text-[13px] font-medium disabled:opacity-50"
                style={{ background: "var(--navy)" }}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={handleExportCSV}
                className="h-[34px] px-4 border rounded-[2px] text-[13px]"
                style={{ borderColor: "var(--border-s)", color: "var(--text)", background: "var(--surface)" }}
              >
                Export Hours (CSV)
              </button>
              <button
                type="button"
                onClick={handleExportPDF}
                className="h-[34px] px-4 border rounded-[2px] text-[13px]"
                style={{ borderColor: "var(--border-s)", color: "var(--text)", background: "var(--surface)" }}
              >
                Export Hours (PDF)
              </button>
            </div>
          </form>

          <div className="mt-6 rounded-[3px] border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-alt)" }}>
            <h3 className="font-semibold text-[14px]" style={{ color: "var(--text)" }}>Parent Progress Sharing</h3>
            <p className="mt-1 text-[13px]" style={{ color: "var(--text-sec)" }}>
              Direct student-generated parent links are disabled. Parent or guardian progress sharing must be managed through a school-controlled FERPA-safe workflow.
            </p>
          </div>

          <div className="mt-8 pt-6 border-t" style={{ borderColor: "var(--border)" }}>
            <button onClick={logout} className="text-[13px] hover:underline" style={{ color: "var(--er-t)" }}>
              Log Out
            </button>
          </div>
        </div>
      )}

      {tab === "classroom" && (
        <div className="border rounded-[3px] p-6" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <h3 className="font-semibold mb-4" style={{ color: "var(--text)" }}>Classroom</h3>

          {classroomMessage && (
            <div
              className="mb-4 px-3 py-2 rounded-[3px] border text-[13px]"
              style={classroomIsError
                ? { background: "var(--er-bg)", borderColor: "var(--er-b)", color: "var(--er-t)" }
                : { background: "var(--ok-bg)", borderColor: "var(--ok-b)", color: "var(--ok-t)" }}
            >
              {classroomMessage}
            </div>
          )}

          {activeCohorts.length > 0 && (
            <div className="mb-4 rounded-[3px] border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-alt)" }}>
              <div className="text-[13px] font-medium" style={{ color: "var(--text)" }}>Linked Cohorts</div>
              <div className="mt-2 text-[13px]" style={{ color: "var(--text-sec)" }}>
                {activeCohorts.map((cohort) => cohort.name).join(", ")}
              </div>
            </div>
          )}

          {user?.classroomId ? (
            <div>
              <div className="p-4 rounded-[3px] border mb-4" style={{ background: "var(--in-bg)", borderColor: "var(--in-b)" }}>
                <div className="font-medium text-[14px]" style={{ color: "var(--in-t)" }}>
                  {user?.classroom?.name || "Classroom"}
                </div>
                <div className="text-[13px]" style={{ color: "var(--in-t)" }}>
                  {user.school?.name || "School"}
                </div>
              </div>
              {leaveConfirm ? (
                <div className="mt-2 p-4 rounded-[3px] border" style={{ background: "var(--wn-bg)", borderColor: "var(--wn-b)" }}>
                  <p className="text-[13px] font-medium mb-1" style={{ color: "var(--wn-t)" }}>Leave this classroom?</p>
                  <p className="text-[12px] mb-3" style={{ color: "var(--wn-t)" }}>
                    You'll need a new invite code from your teacher to re-join any classroom.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleLeaveClassroom}
                      className="h-[34px] px-3 rounded-[2px] text-white text-[13px] font-medium"
                      style={{ background: "var(--er-t)" }}
                    >
                      Leave
                    </button>
                    <button
                      onClick={() => setLeaveConfirm(false)}
                      className="h-[34px] px-3 border rounded-[2px] text-[13px]"
                      style={{ borderColor: "var(--border-s)", color: "var(--text)", background: "var(--surface)" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setLeaveConfirm(true)}
                  className="text-[13px] hover:underline"
                  style={{ color: "var(--er-t)" }}
                >
                  Leave Classroom
                </button>
              )}
            </div>
          ) : (
            <div>
              <p className="text-[13px] mb-4" style={{ color: "var(--text-sec)" }}>
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
                  className="flex-1 h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] font-mono tracking-wider text-center focus:outline-none focus:border-[var(--action)] bg-[var(--surface)]"
                />
                <button
                  type="submit"
                  disabled={joining || inviteCode.trim().length !== 8}
                  className="h-[34px] px-4 rounded-[2px] text-white text-[13px] font-medium disabled:opacity-50"
                  style={{ background: "var(--navy)" }}
                >
                  {joining ? "Joining..." : "Join"}
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {tab === "security" && (
        <div className="border rounded-[3px] p-6" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <h3 className="font-semibold mb-4" style={{ color: "var(--text)" }}>Change Password</h3>
          {passwordMessage && (
            <div
              className="mb-4 px-3 py-2 rounded-[3px] border text-[13px]"
              style={passwordIsError
                ? { background: "var(--er-bg)", borderColor: "var(--er-b)", color: "var(--er-t)" }
                : { background: "var(--ok-bg)", borderColor: "var(--ok-b)", color: "var(--ok-t)" }}
            >
              {passwordMessage}
            </div>
          )}
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-[13px] font-medium mb-1" style={{ color: "var(--text)" }}>Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)]"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-1" style={{ color: "var(--text)" }}>New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)]"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-1" style={{ color: "var(--text)" }}>Confirm New Password</label>
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
              className="h-[34px] px-4 rounded-[2px] text-white text-[13px] font-medium disabled:opacity-50"
              style={{ background: "var(--navy)" }}
            >
              {changingPassword ? "Changing..." : "Change Password"}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t" style={{ borderColor: "var(--border)" }}>
            <h3 className="font-semibold mb-1 text-[14px]" style={{ color: "var(--er-t)" }}>Delete Account</h3>
            <p className="text-[13px] mb-3" style={{ color: "var(--text-sec)" }}>
              Permanently deletes your account, all your service records, signups, and personal data. This cannot be undone.
            </p>
            {!deleteConfirm ? (
              <button
                onClick={() => setDeleteConfirm(true)}
                className="h-[34px] px-4 border rounded-[2px] text-[13px]"
                style={{ borderColor: "var(--er-b)", color: "var(--er-t)", background: "var(--er-bg)" }}
              >
                Delete My Account
              </button>
            ) : (
              <div className="p-4 rounded-[3px] border" style={{ background: "var(--er-bg)", borderColor: "var(--er-b)" }}>
                <p className="text-[13px] font-medium mb-3" style={{ color: "var(--er-t)" }}>
                  Type <span className="font-mono font-bold">DELETE</span> to confirm:
                </p>
                <input
                  type="text"
                  value={deleteInput}
                  onChange={(e) => setDeleteInput(e.target.value)}
                  placeholder="DELETE"
                  className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--er-b)] rounded-[2px] focus:outline-none mb-3 bg-[var(--surface)]"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleteInput !== "DELETE" || deleting}
                    className="h-[34px] px-4 rounded-[2px] text-white text-[13px] font-medium disabled:opacity-50"
                    style={{ background: "var(--er-t)" }}
                  >
                    {deleting ? "Deleting..." : "Permanently Delete"}
                  </button>
                  <button
                    onClick={() => { setDeleteConfirm(false); setDeleteInput(""); }}
                    className="h-[34px] px-4 border rounded-[2px] text-[13px]"
                    style={{ borderColor: "var(--border-s)", color: "var(--text)", background: "var(--surface)" }}
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
        <div className="border rounded-[3px] p-6" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <h3 className="font-semibold mb-1" style={{ color: "var(--text)" }}>Notification Preferences</h3>
          <p className="text-[13px] mb-6" style={{ color: "var(--text-sec)" }}>Choose how you want to be notified.</p>

          {notifMessage && (
            <div className="mb-4 px-3 py-2 rounded-[3px] border text-[13px]"
              style={{ background: "var(--ok-bg)", borderColor: "var(--ok-b)", color: "var(--ok-t)" }}>
              {notifMessage}
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-[11px] font-semibold uppercase tracking-[.07em] border-b pb-2"
              style={{ color: "var(--text-faint)", borderColor: "var(--border)" }}>
              <div>Notification</div>
              <div className="text-center">Email</div>
              <div className="text-center">In-App</div>
            </div>
            {notifRows.map(({ key, label }) => (
              <div key={key} className="grid grid-cols-3 gap-4 items-center">
                <div className="text-[13px] font-medium" style={{ color: "var(--text)" }}>{label}</div>
                <div className="flex justify-center">
                  <button
                    onClick={() => toggleNotif(key, "email")}
                    className="w-10 h-5 rounded-full transition-colors relative"
                    style={{ background: notifPrefs[key].email ? "var(--action)" : "var(--border-s)" }}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-[var(--surface)] rounded-full transition-transform ${
                      notifPrefs[key].email ? "translate-x-5" : "translate-x-0.5"
                    }`} />
                  </button>
                </div>
                <div className="flex justify-center">
                  <button
                    onClick={() => toggleNotif(key, "inApp")}
                    className="w-10 h-5 rounded-full transition-colors relative"
                    style={{ background: notifPrefs[key].inApp ? "var(--action)" : "var(--border-s)" }}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-[var(--surface)] rounded-full transition-transform ${
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
            className="mt-6 h-[34px] px-4 rounded-[2px] text-white text-[13px] font-medium disabled:opacity-50"
            style={{ background: "var(--navy)" }}
          >
            {savingNotif ? "Saving..." : "Save Preferences"}
          </button>
        </div>
      )}

      {tab === "privacy" && (
        <div className="border rounded-[3px] p-6" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <h3 className="font-semibold mb-1" style={{ color: "var(--text)" }}>Privacy Settings</h3>
          <p className="text-[13px] mb-6" style={{ color: "var(--text-sec)" }}>Control who can see your profile and message you.</p>

          {privacyMessage && (
            <div className="mb-4 px-3 py-2 rounded-[3px] border text-[13px]"
              style={{ background: "var(--ok-bg)", borderColor: "var(--ok-b)", color: "var(--ok-t)" }}>
              {privacyMessage}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-[13px] font-medium mb-1" style={{ color: "var(--text)" }}>Profile Visibility</label>
              <select
                value={msgPrefs.profileVisibility}
                onChange={(e) => setMsgPrefs((p) => ({ ...p, profileVisibility: e.target.value }))}
                className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)]"
              >
                <option value="EVERYONE">Everyone</option>
                <option value="SCHOOL">School Only</option>
                <option value="PRIVATE">Private</option>
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-1" style={{ color: "var(--text)" }}>Message Restrictions</label>
              <select
                value={msgPrefs.allowFrom}
                onChange={(e) => setMsgPrefs((p) => ({ ...p, allowFrom: e.target.value }))}
                className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)]"
              >
                <option value="EVERYONE">Everyone</option>
                <option value="ORGS_ONLY">Organizations Only</option>
                <option value="ADMINS_ONLY">Admins Only</option>
              </select>
              <p className="text-[12px] mt-1" style={{ color: "var(--text-faint)" }}>
                Restricts who can send you direct messages.
              </p>
            </div>
          </div>

          <button
            onClick={handleSavePrivacy}
            disabled={savingPrivacy}
            className="mt-6 h-[34px] px-4 rounded-[2px] text-white text-[13px] font-medium disabled:opacity-50"
            style={{ background: "var(--navy)" }}
          >
            {savingPrivacy ? "Saving..." : "Save Settings"}
          </button>
        </div>
      )}
    </div>
  );
}
