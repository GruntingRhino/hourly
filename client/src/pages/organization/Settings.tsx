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

export default function OrgSettings() {
  const { user, logout, refreshUser } = useAuth();
  const [tab, setTab] = useState<"profile" | "opportunities" | "settings">("profile");
  const [org, setOrg] = useState<OrgData | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [twitter, setTwitter] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

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
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.organizationId) return;
    setSaving(true);
    setMessage("");
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
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="flex gap-2 mb-6">
        {(["profile", "opportunities", "settings"] as const).map((t) => (
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
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
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

      {tab === "opportunities" && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <p className="text-sm text-gray-500">
            View and manage opportunities from the Opportunities tab.
          </p>
        </div>
      )}

      {tab === "settings" && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold mb-4">Account Settings</h3>
          <p className="text-sm text-gray-500">
            Advanced settings will be available in a future update.
          </p>
        </div>
      )}
    </div>
  );
}
