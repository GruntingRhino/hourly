import { useCallback, useEffect, useState } from "react";
import { api, getErrorMessage } from "../../lib/api";

interface Message {
  id: string;
  subject: string | null;
  body: string;
  priority: boolean;
  read: boolean;
  createdAt: string;
  sender: { id: string; name: string; role: string };
  receiver: { id: string; name: string; role: string };
}

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

interface StudentSupportSummary {
  totalApprovedHours: number;
  totalPendingHours: number;
  requiredHours: number;
  interventionCase?: {
    id: string;
    status: string;
    priority: string;
    summary: string | null;
    reason: string | null;
    studentMessage: string | null;
    nextStepForStudent: string | null;
    dueDate: string | null;
    owner?: { id: string; name: string; role: string; email?: string | null } | null;
  } | null;
}

type SenderFilter = "all" | "students" | "organizations" | "schools";

const SENDER_ROLE_MAP: Record<SenderFilter, string[]> = {
  all: [],
  students: ["STUDENT"],
  organizations: ["ORG_ADMIN"],
  schools: ["SCHOOL_ADMIN", "TEACHER"],
};

export default function StudentMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [folder, setFolder] = useState<"inbox" | "sent" | "notifications">("inbox");
  const [senderFilter, setSenderFilter] = useState<SenderFilter>("all");
  const [showCompose, setShowCompose] = useState(false);
  const [supportSummary, setSupportSummary] = useState<StudentSupportSummary | null>(null);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<StudentSupportSummary>("/reports/student").then(setSupportSummary).catch(() => setSupportSummary(null));
  }, []);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      if (folder === "notifications") {
        const data = await api.get<Notification[]>("/messages/notifications");
        setNotifications(data);
      } else {
        const data = await api.get<Message[]>(`/messages?folder=${folder}`);
        setMessages(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [folder]);

  useEffect(() => { void (async () => { await loadMessages(); })(); }, [loadMessages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setSendError("");
    try {
      await api.post("/messages", { receiverEmail: to, subject, body });
      setShowCompose(false);
      setTo("");
      setSubject("");
      setBody("");
      loadMessages();
    } catch (err: unknown) {
      setSendError(getErrorMessage(err, "Failed to send message"));
    } finally {
      setSending(false);
    }
  };

  const markRead = async (id: string) => {
    await api.put(`/messages/${id}/read`);
    loadMessages();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Messages</h1>
        <button
          onClick={() => setShowCompose(!showCompose)}
          className="px-4 py-[7px] bg-[var(--action)] text-white rounded-[2px] text-sm font-medium hover:opacity-85"
        >
          {showCompose ? "Cancel" : "New Message"}
        </button>
      </div>

      {/* Compose */}
      {supportSummary?.interventionCase && supportSummary.interventionCase.status !== "RESOLVED" && (
        <div className="mb-6 rounded-[3px] border border-[var(--er-b)] bg-[var(--er-bg)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--er-t)] mb-1">School Follow-Up Active</div>
              <div className="font-semibold text-red-900">{supportSummary.interventionCase.summary || "Your school needs a response from you"}</div>
              <div className="mt-1 text-sm text-[var(--er-t)]">
                {supportSummary.interventionCase.studentMessage || supportSummary.interventionCase.reason || "Check your remaining hours and message your school if you need help completing them."}
              </div>
              {supportSummary.interventionCase.nextStepForStudent && (
                <div className="mt-2 text-sm text-red-900">Next step: <strong>{supportSummary.interventionCase.nextStepForStudent}</strong></div>
              )}
              <div className="mt-2 text-xs text-[var(--er-t)] flex flex-wrap gap-3">
                <span>Priority: {supportSummary.interventionCase.priority}</span>
                <span>{Math.max(0, supportSummary.requiredHours - supportSummary.totalApprovedHours).toFixed(1)}h remaining</span>
                {supportSummary.interventionCase.dueDate && <span>Follow up by {new Date(supportSummary.interventionCase.dueDate).toLocaleDateString(undefined, { timeZone: 'UTC' })}</span>}
                {supportSummary.interventionCase.owner?.name && <span>Owner: {supportSummary.interventionCase.owner.name}</span>}
              </div>
            </div>
            <button
              onClick={() => {
                setShowCompose(true);
                if (supportSummary.interventionCase?.owner?.email) {
                  setTo(supportSummary.interventionCase.owner.email);
                }
                setSubject(supportSummary.interventionCase?.summary || "Need help with service hours");
                setBody(supportSummary.interventionCase?.nextStepForStudent
                  ? `Hi, I'm following up on my service hours. ${supportSummary.interventionCase.nextStepForStudent}`
                  : "Hi, I need help understanding my remaining service-hour requirements.");
              }}
              className="px-4 py-2 bg-red-600 text-white rounded-[2px] text-sm font-medium hover:bg-red-700"
            >
              Message School Now
            </button>
          </div>
        </div>
      )}

      {/* Compose */}
      {showCompose && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-5 mb-6">
          <h3 className="font-semibold mb-3">Compose Message</h3>
          {sendError && (
            <div className="mb-3 p-3 bg-[var(--er-bg)] border border-[var(--er-b)] rounded-[2px] text-[var(--er-t)] text-sm">
              {sendError}
            </div>
          )}
          <form onSubmit={handleSend} className="space-y-3">
            <input
              type="email"
              placeholder="Recipient email address"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              required
              className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm"
            />
            <input
              type="text"
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm"
            />
            <textarea
              placeholder="Write your message..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={4}
              className="w-full px-3 py-2 border border-[var(--border-s)] rounded-[2px] text-sm"
            />
            <button
              type="submit"
              disabled={sending}
              className="px-4 py-2 bg-[var(--action)] text-white rounded-[2px] text-sm hover:bg-[var(--action)] disabled:opacity-50"
            >
              {sending ? "Sending..." : "Send"}
            </button>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-3">
        {(["inbox", "sent", "notifications"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFolder(f)}
            className={`px-4 py-2 rounded-[2px] text-sm font-medium capitalize ${
              folder === f ? "bg-[var(--action)] text-white" : "bg-[var(--surface-alt)] text-[var(--text)] hover:bg-[var(--border)]"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Sender filter (inbox only) */}
      {folder === "inbox" && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-[var(--text-sec)]">Filter:</span>
          {(["all", "students", "organizations", "schools"] as SenderFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setSenderFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${
                senderFilter === f ? "bg-[var(--action)] text-white" : "bg-[var(--surface-alt)] text-[var(--text-sec)] hover:bg-[var(--border)]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-[var(--text-sec)]">Loading...</div>
      ) : folder === "notifications" ? (
        <div className="space-y-2">
          {notifications.length === 0 ? (
            <div className="text-[var(--text-sec)] text-center py-8">No notifications.</div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`bg-[var(--surface)] border rounded-[3px] p-4 ${n.read ? "border-[var(--border)]" : "border-[var(--in-b)] bg-[var(--in-bg)]"}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-sm">{n.title}</div>
                    <div className="text-sm text-[var(--text-sec)]">{n.body}</div>
                  </div>
                  <div className="text-xs text-[var(--text-faint)]">
                    {new Date(n.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {(() => {
            const allowedRoles = SENDER_ROLE_MAP[senderFilter];
            const filtered = folder === "inbox" && senderFilter !== "all"
              ? messages.filter((m) => allowedRoles.includes(m.sender.role))
              : messages;
            return filtered.length === 0 ? (
              <div className="text-[var(--text-sec)] text-center py-8">No messages.</div>
            ) : (
              filtered.map((m) => (
              <div
                key={m.id}
                onClick={() => !m.read && folder === "inbox" && markRead(m.id)}
                className={`bg-[var(--surface)] border rounded-[3px] p-4 cursor-pointer ${
                  m.read ? "border-[var(--border)]" : "border-[var(--in-b)] bg-[var(--in-bg)]"
                } ${m.priority ? "border-l-4 border-l-red-500" : ""}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-sm">
                      {folder === "inbox" ? m.sender.name : m.receiver.name}
                    </div>
                    {m.subject && <div className="text-sm text-[var(--text)]">{m.subject}</div>}
                    <div className="text-sm text-[var(--text-sec)] mt-1">{m.body}</div>
                  </div>
                  <div className="text-xs text-[var(--text-faint)]">
                    {new Date(m.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))
            );
          })()}
        </div>
      )}
    </div>
  );
}
