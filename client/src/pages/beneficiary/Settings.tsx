import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";

interface BeneficiaryProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  description: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  category: string | null;
}

export default function BeneficiarySettings() {
  const { user } = useAuth();
  const benId = user?.beneficiaryId;

  const [profile, setProfile] = useState<BeneficiaryProfile | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    description: "",
    website: "",
    address: "",
    city: "",
    state: "",
    zip: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!benId) return;
    api.get<BeneficiaryProfile>(`/beneficiaries/${benId}`)
      .then((data) => {
        setProfile(data);
        setForm({
          name: data.name ?? "",
          email: data.email ?? "",
          phone: data.phone ?? "",
          description: data.description ?? "",
          website: data.website ?? "",
          address: data.address ?? "",
          city: data.city ?? "",
          state: data.state ?? "",
          zip: data.zip ?? "",
        });
      })
      .catch(() => setError("Failed to load profile."))
      .finally(() => setLoading(false));
  }, [benId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!benId) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const updated = await api.patch<BeneficiaryProfile>(`/beneficiaries/${benId}/profile`, {
        name: form.name || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        description: form.description || undefined,
        website: form.website || undefined,
        address: form.address || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        zip: form.zip || undefined,
      });
      setProfile(updated);
      setSuccess("Profile updated.");
    } catch (err: any) {
      setError(err.message || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-[var(--text-sec)] py-8 text-center">Loading...</div>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-[20px] font-semibold mb-6">Settings</h1>

      {error && <div className="mb-4 p-3 bg-[var(--er-bg)] border border-[var(--er-b)] rounded text-[var(--er-t)] text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-[var(--ok-bg)] border border-[var(--ok-b)] rounded text-[var(--ok-t)] text-sm">{success}</div>}

      <div className="bg-white border border-[var(--border)] rounded-[3px] p-6 mb-6">
        <h2 className="font-semibold text-[var(--text)] mb-4">Organization Profile</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">Organization Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                required
                className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--action)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">Contact Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--action)]"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--action)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">Website</label>
              <input
                type="url"
                value={form.website}
                onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
                placeholder="https://"
                className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--action)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={3}
              placeholder="Brief description of your organization and its mission..."
              className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--action)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-1">Address</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
              placeholder="Street address"
              className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--action)]"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="block text-sm font-medium text-[var(--text)] mb-1">City</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--action)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">State</label>
              <input
                type="text"
                value={form.state}
                onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))}
                maxLength={2}
                placeholder="NY"
                className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--action)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">ZIP</label>
              <input
                type="text"
                value={form.zip}
                onChange={(e) => setForm((p) => ({ ...p, zip: e.target.value }))}
                maxLength={5}
                placeholder="10001"
                className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--action)]"
              />
            </div>
          </div>

          {profile?.category && (
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">Category</label>
              <div className="px-3 py-2 border border-[var(--border)] rounded-[2px] text-sm text-[var(--text-sec)] bg-[var(--surface-alt)]">
                {profile.category} <span className="text-xs text-[var(--text-faint)]">(contact support to change)</span>
              </div>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-[7px] bg-[var(--action)] text-white rounded-[2px] text-sm font-medium hover:opacity-85 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white border border-[var(--border)] rounded-[3px] p-6">
        <h2 className="font-semibold text-[var(--text)] mb-1">Account</h2>
        <p className="text-sm text-[var(--text-sec)] mb-4">Logged in as: {user?.name} ({user?.email})</p>
        <p className="text-xs text-[var(--text-faint)]">
          To change your login credentials, use the Forgot Password flow from the login page.
        </p>
      </div>
    </div>
  );
}
