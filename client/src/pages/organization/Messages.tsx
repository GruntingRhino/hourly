import { useEffect, useState } from "react";
import { api } from "../../lib/api";

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

type SenderFilter = "all" | "students" | "organizations" | "schools";

const SENDER_ROLE_MAP: Record<SenderFilter, string[]> = {
  all: [],
  students: ["STUDENT"],
  organizations: ["ORG_ADMIN"],
  schools: ["SCHOOL_ADMIN", "TEACHER"],
};

export default function OrgMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [folder, setFolder] = useState<"inbox" | "sent" | "notifications">("notifications");
  const [senderFilter, setSenderFilter] = useState<SenderFilter>("all");
  const [showCompose, setShowCompose] = useState(false);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMessages();
  }, [folder]);

  const loadMessages = async () => {
    setLoading(true);
    try {
      if (folder === "notifications") {
        const data = await api.get<Notification[]>("/messages/notifications");
        setNotifications(data);
      } else {
        const data = await api.get<Message[]>(`/messages?folder=${folder}`);
        setMessages(data);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setSendError("");
    try {
      await api.post("/messages", { receiverEmail: to, subject, body, priority: true });
      setShowCompose(false);
      setTo("");
      setSubject("");
      setBody("");
      setFolder("sent");
      await loadMessages();
    } catch (err: any) {
      setSendError(err.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-[28px] font-bold">Messages</h1>
        <button
          onClick={() => setShowCompose(!showCompose)}
          className="h-[34px] px-4 bg-[var(--action)] text-white rounded-[2px] text-[13px] font-medium text-sm font-medium hover:opacity-85"
        >
          {showCompose ? "Cancel" : "Create Message"}
        </button>
      </div>

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
              className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)] text-sm"
            />
            <input
              type="text"
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)] text-sm"
            />
            <textarea
              placeholder="Write your message..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={4}
              className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)] text-sm"
            />
            <button
              type="submit"
              disabled={sending}
              className="h-[34px] px-4 bg-[var(--action)] text-white rounded-[2px] text-[13px] font-medium text-sm hover:bg-[var(--action)] disabled:opacity-50"
            >
              {sending ? "Sending..." : "Send"}
            </button>
          </form>
        </div>
      )}

      <div className="flex gap-2 mb-3">
        {(["notifications", "inbox", "sent"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFolder(f)}
            className={`px-4 py-2 rounded-[2px] text-sm font-medium capitalize ${
              folder === f ? "bg-[var(--action)] text-white" : "bg-[var(--surface-alt)] text-[var(--text)] hover:bg-[var(--border)]"
            }`}
          >
            {f === "notifications" ? "Priority" : f}
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
              <div key={n.id} className={`bg-[var(--surface)] border rounded-[3px] p-4 ${n.read ? "border-[var(--border)]" : "border-[var(--in-b)]"}`}>
                <div className="flex justify-between">
                  <div>
                    <div className="font-medium text-sm">{n.title}</div>
                    <div className="text-sm text-[var(--text-sec)]">{n.body}</div>
                  </div>
                  <div className="text-xs text-[var(--text-faint)]">{new Date(n.createdAt).toLocaleDateString()}</div>
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
                <div key={m.id} className={`bg-[var(--surface)] border rounded-[3px] p-4 ${m.priority ? "border-l-4 border-l-red-500" : "border-[var(--border)]"}`}>
                  <div className="flex justify-between">
                    <div>
                      <div className="font-medium text-sm">{folder === "inbox" ? m.sender.name : m.receiver.name}</div>
                      {m.subject && <div className="text-sm text-[var(--text)]">{m.subject}</div>}
                      <div className="text-sm text-[var(--text-sec)] mt-1">{m.body}</div>
                    </div>
                    <div className="text-xs text-[var(--text-faint)]">{new Date(m.createdAt).toLocaleDateString()}</div>
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
