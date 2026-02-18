import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { api } from "../../lib/api";

export default function StudentSettings() {
  const { user, logout, refreshUser } = useAuth();
  const [tab, setTab] = useState<"profile" | "classroom" | "security">("profile");
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordIsError, setPasswordIsError] = useState(false);

  // Classroom join
  const [inviteCode, setInviteCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [classroomMessage, setClassroomMessage] = useState("");
  const [classroomIsError, setClassroomIsError] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setIsError(false);
    try {
      await api.put("/auth/profile", { name, phone, bio });
      await refreshUser();
      setMessage("Profile updated!");
    } catch (err: any) {
      setMessage(err.message || "Failed to update profile");
      setIsError(true);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
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

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="flex gap-2 mb-6">
        {(["profile", "classroom", "security"] as const).map((t) => (
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
              {user?.school && (
                <div className="text-sm text-gray-400">{user.school.name}</div>
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
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm hover:bg-gray-800 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={handleExport}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
              >
                Export Hours (CSV)
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
                  {user.classroom?.name || "Classroom"}
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
    </div>
  );
}
