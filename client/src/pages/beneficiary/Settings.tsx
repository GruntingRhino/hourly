import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";
import { ProGate, ProBadge } from "../../components/ProGate";

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

interface TierInfo {
  tier: "FREE" | "PRO";
  limits: {
    configurableReminders: boolean;
    customEmailBranding: boolean;
    automatedFormReminders: boolean;
    advancedReminderContent: boolean;
    advancedWaitlistControls: boolean;
    attendanceAnalytics: boolean;
  };
}

interface ReminderEntry {
  minutesBefore: number;
  enabled: boolean;
  label: string;
}

interface ReminderConfig {
  reminders: ReminderEntry[];
  waitlistCutoffHours: number | null;
  requireApprovalForPromotion: boolean;
  disableAutoPromotion: boolean;
  promoMessageTemplate: string | null;
  tier: "FREE" | "PRO";
}

interface Branding {
  brandColor: string;
  logoUrl: string;
  emailSignature: string;
}

type Tab = "profile" | "reminders" | "branding" | "account";

const MINUTES_OPTIONS = [
  { value: 60,   label: "1 hour before" },
  { value: 180,  label: "3 hours before" },
  { value: 720,  label: "12 hours before" },
  { value: 1440, label: "24 hours before" },
  { value: 2880, label: "48 hours before" },
  { value: 4320, label: "72 hours before" },
  { value: 10080, label: "1 week before" },
];

export default function BeneficiarySettings() {
  const { user } = useAuth();
  const benId = user?.beneficiaryId;

  const [tab, setTab] = useState<Tab>("profile");
  const [profile, setProfile] = useState<BeneficiaryProfile | null>(null);
  const [tierInfo, setTierInfo] = useState<TierInfo | null>(null);
  const [form, setForm] = useState({
    name: "", email: "", phone: "", description: "", website: "",
    address: "", city: "", state: "", zip: "",
  });
  const [branding, setBranding] = useState<Branding>({ brandColor: "#2563eb", logoUrl: "", emailSignature: "" });
  const [reminderConfig, setReminderConfig] = useState<ReminderConfig | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingBranding, setSavingBranding] = useState(false);
  const [savingReminders, setSavingReminders] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!benId) return;
    Promise.all([
      api.get<BeneficiaryProfile>(`/beneficiaries/${benId}`),
      api.get<TierInfo>(`/beneficiaries/${benId}/tier`),
      api.get<ReminderConfig>(`/beneficiaries/${benId}/reminder-config`),
    ])
      .then(([prof, tier, remCfg]) => {
        setProfile(prof);
        setForm({
          name: prof.name ?? "", email: prof.email ?? "", phone: prof.phone ?? "",
          description: prof.description ?? "", website: prof.website ?? "",
          address: prof.address ?? "", city: prof.city ?? "", state: prof.state ?? "", zip: prof.zip ?? "",
        });
        setTierInfo(tier);
        setReminderConfig(remCfg);
      })
      .catch(() => setError("Failed to load settings."))
      .finally(() => setLoading(false));
  }, [benId]);

  // Also load branding when tab switches to branding
  useEffect(() => {
    if (tab !== "branding" || !benId) return;
    api.get<{ brandColor: string | null; logoUrl: string | null; emailSignature: string | null }>(`/beneficiaries/${benId}`)
      .then((data) => setBranding({
        brandColor: data.brandColor ?? "#2563eb",
        logoUrl: data.logoUrl ?? "",
        emailSignature: data.emailSignature ?? "",
      }))
      .catch(() => {});
  }, [tab, benId]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!benId) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const updated = await api.patch<BeneficiaryProfile>(`/beneficiaries/${benId}/profile`, {
        name: form.name || undefined, email: form.email || undefined, phone: form.phone || undefined,
        description: form.description || undefined, website: form.website || undefined,
        address: form.address || undefined, city: form.city || undefined,
        state: form.state || undefined, zip: form.zip || undefined,
      });
      setProfile(updated);
      setSuccess("Profile updated.");
    } catch (err: any) {
      setError(err.message || "Failed to save profile.");
    } finally { setSaving(false); }
  };

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!benId) return;
    setSavingBranding(true); setError(""); setSuccess("");
    try {
      await api.patch(`/beneficiaries/${benId}/branding`, {
        brandColor: branding.brandColor || undefined,
        logoUrl: branding.logoUrl || undefined,
        emailSignature: branding.emailSignature || undefined,
      });
      setSuccess("Branding saved.");
    } catch (err: any) {
      setError(err.message || "Failed to save branding.");
    } finally { setSavingBranding(false); }
  };

  const handleSaveReminders = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!benId || !reminderConfig) return;
    setSavingReminders(true); setError(""); setSuccess("");
    try {
      const updated = await api.put<ReminderConfig>(`/beneficiaries/${benId}/reminder-config`, {
        reminders: reminderConfig.reminders,
        waitlistCutoffHours: reminderConfig.waitlistCutoffHours,
        requireApprovalForPromotion: reminderConfig.requireApprovalForPromotion,
        disableAutoPromotion: reminderConfig.disableAutoPromotion,
        promoMessageTemplate: reminderConfig.promoMessageTemplate,
      });
      setReminderConfig(updated);
      setSuccess("Reminder configuration saved.");
    } catch (err: any) {
      setError(err.message || "Failed to save reminder config.");
    } finally { setSavingReminders(false); }
  };

  const addReminder = () => {
    if (!reminderConfig) return;
    setReminderConfig((prev) => prev && ({
      ...prev,
      reminders: [...prev.reminders, { minutesBefore: 1440, enabled: true, label: "24 hours before" }],
    }));
  };

  const removeReminder = (idx: number) => {
    if (!reminderConfig || reminderConfig.reminders.length <= 1) return;
    setReminderConfig((prev) => prev && ({
      ...prev,
      reminders: prev.reminders.filter((_, i) => i !== idx),
    }));
  };

  const updateReminder = (idx: number, patch: Partial<ReminderEntry>) => {
    if (!reminderConfig) return;
    setReminderConfig((prev) => {
      if (!prev) return prev;
      const reminders = prev.reminders.map((r, i) => {
        if (i !== idx) return r;
        const next = { ...r, ...patch };
        if (patch.minutesBefore !== undefined) {
          next.label = MINUTES_OPTIONS.find((o) => o.value === patch.minutesBefore)?.label ?? `${patch.minutesBefore} min before`;
        }
        return next;
      });
      return { ...prev, reminders };
    });
  };

  if (loading) return <div className="text-[var(--text-sec)] py-8 text-center">Loading...</div>;

  const isPro = tierInfo?.tier === "PRO";

  const TABS: { id: Tab; label: string }[] = [
    { id: "profile", label: "Profile" },
    { id: "reminders", label: "Reminders" },
    { id: "branding", label: "Branding" },
    { id: "account", label: "Account" },
  ];

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[20px] font-semibold">Settings</h1>
        {tierInfo && (
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${isPro ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}>
            {isPro ? "✦ Pro" : "Free"}
          </span>
        )}
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 border-b border-[var(--border)] mb-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setError(""); setSuccess(""); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? "border-[var(--action)] text-[var(--action)]"
                : "border-transparent text-[var(--text-sec)] hover:text-[var(--text)]"
            }`}
          >
            {t.label}
            {(t.id === "branding" || t.id === "reminders") && !isPro && <ProBadge />}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 p-3 bg-[var(--er-bg)] border border-[var(--er-b)] rounded text-[var(--er-t)] text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-[var(--ok-bg)] border border-[var(--ok-b)] rounded text-[var(--ok-t)] text-sm">{success}</div>}

      {/* ── Profile tab ── */}
      {tab === "profile" && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-6">
          <h2 className="font-semibold text-[var(--text)] mb-4">Organization Profile</h2>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">Organization Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required
                  className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--action)]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">Contact Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--action)]" />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">Phone</label>
                <input type="tel" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--action)]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">Website</label>
                <input type="url" value={form.website} onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))} placeholder="https://"
                  className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--action)]" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">Description</label>
              <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={3}
                placeholder="Brief description of your organization and its mission..."
                className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--action)]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1">Address</label>
              <input type="text" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} placeholder="Street address"
                className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--action)]" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <label className="block text-sm font-medium text-[var(--text)] mb-1">City</label>
                <input type="text" value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                  className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--action)]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">State</label>
                <input type="text" value={form.state} onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))} maxLength={2} placeholder="NY"
                  className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--action)]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">ZIP</label>
                <input type="text" value={form.zip} onChange={(e) => setForm((p) => ({ ...p, zip: e.target.value }))} maxLength={5} placeholder="10001"
                  className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--action)]" />
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
              <button type="submit" disabled={saving}
                className="px-5 py-[7px] bg-[var(--action)] text-white rounded-[2px] text-sm font-medium hover:opacity-85 disabled:opacity-50">
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Reminders tab ── */}
      {tab === "reminders" && reminderConfig && (
        <div className="space-y-6">
          {/* Standardized Free reminder — always visible */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-6">
            <h2 className="font-semibold text-[var(--text)] mb-1">Standardized Reminder</h2>
            <p className="text-sm text-[var(--text-sec)] mb-3">
              All organizations send one automatic reminder 24 hours before each event. This cannot be disabled.
            </p>
            <div className="flex items-center gap-2 text-sm text-[var(--text-sec)]">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
              24 hours before — always active
            </div>
          </div>

          {/* Configurable reminders — Pro only */}
          <ProGate
            feature="Configurable Reminder Schedule"
            benefit="Send multiple reminders at the times that work best for your volunteers."
            isPro={isPro}
          >
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-6">
              <form onSubmit={handleSaveReminders} className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-semibold text-[var(--text)]">Custom Reminder Schedule</h2>
                  <button type="button" onClick={addReminder}
                    className="text-sm text-[var(--action)] hover:underline">+ Add reminder</button>
                </div>

                {reminderConfig.reminders.map((r, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <input type="checkbox" checked={r.enabled} onChange={(e) => updateReminder(idx, { enabled: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300" />
                    <select value={r.minutesBefore}
                      onChange={(e) => updateReminder(idx, { minutesBefore: parseInt(e.target.value, 10) })}
                      className="flex-1 px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm">
                      {MINUTES_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    {reminderConfig.reminders.length > 1 && (
                      <button type="button" onClick={() => removeReminder(idx)}
                        className="text-[var(--er-t)] text-sm hover:underline">Remove</button>
                    )}
                  </div>
                ))}

                <div className="border-t border-[var(--border)] pt-4 mt-4">
                  <h3 className="text-sm font-medium text-[var(--text)] mb-3">
                    Waitlist Controls <ProBadge />
                  </h3>
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-sm text-[var(--text)]">
                      <input type="checkbox"
                        checked={reminderConfig.disableAutoPromotion}
                        onChange={(e) => setReminderConfig((p) => p && ({ ...p, disableAutoPromotion: e.target.checked }))}
                        className="h-4 w-4 rounded" />
                      Disable automatic waitlist promotion
                    </label>
                    <label className="flex items-center gap-2 text-sm text-[var(--text)]">
                      <input type="checkbox"
                        checked={reminderConfig.requireApprovalForPromotion}
                        onChange={(e) => setReminderConfig((p) => p && ({ ...p, requireApprovalForPromotion: e.target.checked }))}
                        className="h-4 w-4 rounded" />
                      Require manual approval before promotion
                    </label>
                    <div>
                      <label className="block text-sm font-medium text-[var(--text)] mb-1">
                        Stop promoting waitlist (hours before event)
                      </label>
                      <input type="number" min={0} max={168}
                        value={reminderConfig.waitlistCutoffHours ?? ""}
                        onChange={(e) => setReminderConfig((p) => p && ({ ...p, waitlistCutoffHours: e.target.value ? parseInt(e.target.value, 10) : null }))}
                        placeholder="No cutoff"
                        className="w-32 px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm" />
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button type="submit" disabled={savingReminders}
                    className="px-5 py-[7px] bg-[var(--action)] text-white rounded-[2px] text-sm font-medium hover:opacity-85 disabled:opacity-50">
                    {savingReminders ? "Saving..." : "Save Reminder Settings"}
                  </button>
                </div>
              </form>
            </div>
          </ProGate>
        </div>
      )}

      {/* ── Branding tab ── */}
      {tab === "branding" && (
        <ProGate
          feature="Custom Email Branding"
          benefit="Add your logo and brand colors to volunteer reminder emails."
          isPro={isPro}
        >
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-6">
            <h2 className="font-semibold text-[var(--text)] mb-4">Email Branding</h2>
            <form onSubmit={handleSaveBranding} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">Accent Color</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={branding.brandColor}
                    onChange={(e) => setBranding((p) => ({ ...p, brandColor: e.target.value }))}
                    className="h-9 w-14 rounded cursor-pointer border border-[var(--border-s)]" />
                  <input type="text" value={branding.brandColor}
                    onChange={(e) => setBranding((p) => ({ ...p, brandColor: e.target.value }))}
                    placeholder="#2563eb"
                    className="w-32 px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm" />
                </div>
                <p className="mt-1 text-xs text-[var(--text-faint)]">Used for email header background and CTA buttons.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">Logo URL</label>
                <input type="url" value={branding.logoUrl}
                  onChange={(e) => setBranding((p) => ({ ...p, logoUrl: e.target.value }))}
                  placeholder="https://your-org.com/logo.png"
                  className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm" />
                <p className="mt-1 text-xs text-[var(--text-faint)]">Displayed at the top of reminder emails. Max 40px tall.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">Email Signature</label>
                <textarea value={branding.emailSignature}
                  onChange={(e) => setBranding((p) => ({ ...p, emailSignature: e.target.value }))}
                  rows={3} placeholder="Questions? Contact us at volunteer@yourorg.org"
                  className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm" />
              </div>
              <div className="pt-2">
                <button type="submit" disabled={savingBranding}
                  className="px-5 py-[7px] bg-[var(--action)] text-white rounded-[2px] text-sm font-medium hover:opacity-85 disabled:opacity-50">
                  {savingBranding ? "Saving..." : "Save Branding"}
                </button>
              </div>
            </form>
          </div>
        </ProGate>
      )}

      {/* ── Account tab ── */}
      {tab === "account" && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-6">
          <h2 className="font-semibold text-[var(--text)] mb-1">Account</h2>
          <p className="text-sm text-[var(--text-sec)] mb-4">Logged in as: {user?.name} ({user?.email})</p>
          <div className="mb-4 p-3 rounded bg-gray-50 border border-[var(--border)]">
            <p className="text-sm font-medium text-[var(--text)]">Plan: {isPro ? "GoodHours Pro" : "Free"}</p>
            {!isPro && (
              <p className="text-xs text-[var(--text-sec)] mt-1">
                Upgrade to Pro for configurable reminders, custom branding, and attendance analytics.{" "}
                <a href="mailto:hello@goodhours.app?subject=GoodHours Pro" className="text-[var(--action)] hover:underline">
                  Contact us — $30/month
                </a>
              </p>
            )}
          </div>
          <p className="text-xs text-[var(--text-faint)]">
            To change your login credentials, use the Forgot Password flow from the login page.
          </p>
        </div>
      )}
    </div>
  );
}
