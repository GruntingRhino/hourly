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
  schools: ["SCHOOL_ADMIN", "TEACHER", "DISTRICT_ADMIN"],
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
      loadMessages();
    } catch (err: any) {
      setSendError(err.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Messages</h1>
        <button
          onClick={() => setShowCompose(!showCompose)}
          className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800"
        >
          {showCompose ? "Cancel" : "Create Message"}
        </button>
      </div>

      {showCompose && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
          <h3 className="font-semibold mb-3">Compose Message</h3>
          {sendError && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <input
              type="text"
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <textarea
              placeholder="Write your message..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <button
              type="submit"
              disabled={sending}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
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
            className={`px-4 py-2 rounded-md text-sm font-medium capitalize ${
              folder === f ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {f === "notifications" ? "Priority" : f}
          </button>
        ))}
      </div>

      {/* Sender filter (inbox only) */}
      {folder === "inbox" && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-gray-500">Filter:</span>
          {(["all", "students", "organizations", "schools"] as SenderFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setSenderFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${
                senderFilter === f ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : folder === "notifications" ? (
        <div className="space-y-2">
          {notifications.length === 0 ? (
            <div className="text-gray-500 text-center py-8">No notifications.</div>
          ) : (
            notifications.map((n) => (
              <div key={n.id} className={`bg-white border rounded-lg p-4 ${n.read ? "border-gray-200" : "border-blue-300"}`}>
                <div className="flex justify-between">
                  <div>
                    <div className="font-medium text-sm">{n.title}</div>
                    <div className="text-sm text-gray-600">{n.body}</div>
                  </div>
                  <div className="text-xs text-gray-400">{new Date(n.createdAt).toLocaleDateString()}</div>
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
              <div className="text-gray-500 text-center py-8">No messages.</div>
            ) : (
              filtered.map((m) => (
                <div key={m.id} className={`bg-white border rounded-lg p-4 ${m.priority ? "border-l-4 border-l-red-500" : "border-gray-200"}`}>
                  <div className="flex justify-between">
                    <div>
                      <div className="font-medium text-sm">{folder === "inbox" ? m.sender.name : m.receiver.name}</div>
                      {m.subject && <div className="text-sm text-gray-700">{m.subject}</div>}
                      <div className="text-sm text-gray-500 mt-1">{m.body}</div>
                    </div>
                    <div className="text-xs text-gray-400">{new Date(m.createdAt).toLocaleDateString()}</div>
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
