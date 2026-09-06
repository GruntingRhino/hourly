import { useEffect, useEffectEvent, useState } from "react";
import { api, getErrorMessage } from "../../lib/api";
import { useAuth } from "../../hooks/useAuth";

type Admin = { id: string; name: string; email: string; beneficiaryAdminRole: "OWNER" | "ADMIN" | null };
type Invitation = { id: string; email: string; expiresAt: string };

export function AdminTeam({ beneficiaryId }: { beneficiaryId: string }) {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const isOwner = admins.some((admin) => admin.id === user?.id && admin.beneficiaryAdminRole === "OWNER");
  const load = async () => {
    try {
      const team = await api.get<Admin[]>(`/beneficiaries/${beneficiaryId}/admins`);
      setAdmins(team);
      if (team.some((admin) => admin.id === user?.id && admin.beneficiaryAdminRole === "OWNER")) {
        setInvitations(await api.get<Invitation[]>(`/beneficiaries/${beneficiaryId}/admin-invitations`));
      } else {
        setInvitations([]);
      }
    } catch (err: unknown) {
      setMessage(getErrorMessage(err, "Unable to load the organization team."));
    }
  };
  const runLoad = useEffectEvent(() => { void load(); });

  useEffect(() => { const timer = window.setTimeout(runLoad, 0); return () => window.clearTimeout(timer); }, [beneficiaryId, user?.id]);

  const invite = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true); setMessage("");
    try {
      await api.post(`/beneficiaries/${beneficiaryId}/admin-invitations`, { email });
      setEmail(""); setMessage("Invitation email sent.");
      await load();
    } catch (err: unknown) {
      setMessage(getErrorMessage(err, "Invitation failed."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (admin: Admin) => {
    if (!window.confirm(`Remove ${admin.name} from this organization?`)) return;
    setSaving(true); setMessage("");
    try {
      await api.delete(`/beneficiaries/${beneficiaryId}/admins/${admin.id}`);
      setMessage("Administrator removed.");
      await load();
    } catch (err: unknown) {
      setMessage(getErrorMessage(err, "Unable to remove administrator."));
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (invitation: Invitation) => {
    setSaving(true); setMessage("");
    try {
      await api.delete(`/beneficiaries/${beneficiaryId}/admin-invitations/${invitation.id}`);
      setMessage("Invitation revoked.");
      await load();
    } catch (err: unknown) {
      setMessage(getErrorMessage(err, "Unable to revoke invitation."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-6">
        <h2 className="font-semibold mb-2">Organization administrators</h2>
        <p className="text-sm text-[var(--text-sec)] mb-4">Owners can invite and remove administrators. At least one owner is always retained.</p>
        <div className="divide-y divide-[var(--border)]">
          {admins.map((admin) => (
            <div key={admin.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <div className="min-w-0"><div className="font-medium text-[var(--text)]">{admin.name}</div><div className="text-xs text-[var(--text-sec)] truncate">{admin.email}</div></div>
              <div className="flex items-center gap-3 shrink-0"><span className="text-xs text-[var(--text-sec)]">{admin.beneficiaryAdminRole ?? "OWNER"}</span>{isOwner && admin.id !== user?.id && <button disabled={saving} onClick={() => void remove(admin)} className="text-xs text-[var(--er-t)] hover:underline disabled:opacity-50">Remove</button>}</div>
            </div>
          ))}
        </div>
      </div>

      {isOwner && <>
        <form onSubmit={invite} className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-6 space-y-3">
          <label htmlFor="admin-invite-email" className="block text-sm font-medium">Invite administrator by email</label>
          <p className="text-xs text-[var(--text-sec)]">The recipient must sign in with this email to accept the invitation.</p>
          <input id="admin-invite-email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full px-3 py-2 border border-[var(--border-s)] rounded text-sm" />
          <button disabled={saving} className="px-4 py-2 bg-[var(--action)] text-white rounded text-sm disabled:opacity-50">Send invitation</button>
        </form>
        {invitations.length > 0 && <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-6"><h2 className="font-semibold mb-3">Pending invitations</h2><div className="divide-y divide-[var(--border)]">{invitations.map((invitation) => <div key={invitation.id} className="flex justify-between gap-3 py-3 text-sm"><div><div>{invitation.email}</div><div className="text-xs text-[var(--text-sec)]">Expires {new Date(invitation.expiresAt).toLocaleDateString()}</div></div><button disabled={saving} onClick={() => void revoke(invitation)} className="text-xs text-[var(--er-t)] hover:underline disabled:opacity-50">Revoke</button></div>)}</div></div>}
      </>}
      {message && <p role="status" className="text-sm text-[var(--text-sec)] break-all">{message}</p>}
    </div>
  );
}
