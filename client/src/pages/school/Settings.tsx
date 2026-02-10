import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { api } from "../../lib/api";

interface SchoolData {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  description: string | null;
  requiredHours: number;
  verificationStandard: string;
}

export default function SchoolSettings() {
  const { user, logout, refreshUser } = useAuth();
  const [tab, setTab] = useState<"profile" | "security" | "notifications">("profile");
  const [school, setSchool] = useState<SchoolData | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [requiredHours, setRequiredHours] = useState("40");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (user?.schoolId) {
      api.get<SchoolData>(`/schools/${user.schoolId}`).then((data) => {
        setSchool(data);
        setName(data.name);
        setPhone(data.phone || "");
        setDescription(data.description || "");
        setAddress(data.address || "");
        setRequiredHours(String(data.requiredHours));
      });
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.schoolId) return;
    setSaving(true);
    setMessage("");
    try {
      await api.put(`/schools/${user.schoolId}`, {
        name,
        phone,
        description,
        address,
        requiredHours: parseFloat(requiredHours),
      });
      setMessage("Settings updated!");
      await refreshUser();
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="flex gap-2 mb-6">
        {(["profile", "security", "notifications"] as const).map((t) => (
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
                <div className="text-sm text-gray-400">{school.name}</div>
              )}
            </div>
          </div>

          {message && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">
              {message}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">School Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
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

            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Edit Details"}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <button onClick={logout} className="text-red-600 text-sm hover:underline">
              Log Out
            </button>
          </div>
        </div>
      )}

      {tab === "security" && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold mb-4">Security</h3>
          <p className="text-sm text-gray-500">
            Security settings will be available in a future update.
          </p>
        </div>
      )}

      {tab === "notifications" && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold mb-4">Notification Preferences</h3>
          <p className="text-sm text-gray-500">
            Notification preferences will be available in a future update.
          </p>
        </div>
      )}
    </div>
  );
}
