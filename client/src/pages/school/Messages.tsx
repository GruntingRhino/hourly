import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../lib/api";
import { getNotificationHref } from "../../lib/notificationRouting";
import type { AppNotification } from "../../lib/notificationRouting";

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

interface CohortSummary {
  id: string;
  name: string;
}

interface ReminderSummary {
  schoolId: string;
  schoolName: string;
  deadlineReminders: number;
  behindAlerts: number;
  adminAlerts: number;
  pendingReviewCount: number;
  atRiskStudents: number;
}

interface InterventionCaseCard {
  id: string;
  status: string;
  priority: string;
  summary: string | null;
  dueDate: string | null;
  followUpSeen: boolean;
  student: {
    id: string;
    name: string;
    email: string;
    remainingHours: number;
    pendingHours: number;
    riskReasons: string[];
    cohortName: string | null;
  };
  owner?: { id: string; name: string; role: string; email?: string | null } | null;
}

export default function SchoolMessages() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [cohorts, setCohorts] = useState<CohortSummary[]>([]);
  const initialFolder = searchParams.get("tab");
  const [folder, setFolder] = useState<"inbox" | "sent" | "notifications">(
    initialFolder === "sent" || initialFolder === "notifications" ? initialFolder : "inbox"
  );
  const [showCompose, setShowCompose] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [broadcastAudience, setBroadcastAudience] = useState<"ALL_STUDENTS" | "AT_RISK_STUDENTS" | "COHORT_STUDENTS">("ALL_STUDENTS");
  const [broadcastCohortId, setBroadcastCohortId] = useState("");
  const [broadcastSubject, setBroadcastSubject] = useState("");
  const [broadcastBody, setBroadcastBody] = useState("");
  const [broadcastPriority, setBroadcastPriority] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [runningReminders, setRunningReminders] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [sendError, setSendError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reminderSummary, setReminderSummary] = useState<ReminderSummary | null>(null);
  const [activeCases, setActiveCases] = useState<InterventionCaseCard[]>([]);

  useEffect(() => {
    loadMessages();
  }, [folder]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "inbox" || tab === "sent" || tab === "notifications") {
      setFolder(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    api.get<CohortSummary[]>("/cohorts").then(setCohorts).catch(() => {});
    api.get<{ cases: InterventionCaseCard[] }>("/messages/interventions/cases?limit=8")
      .then((data) => setActiveCases(data.cases.filter((item) => item.status !== "RESOLVED")))
      .catch(() => setActiveCases([]));
  }, []);

  const loadMessages = async () => {
    setLoading(true);
    try {
      if (folder === "notifications") {
        const data = await api.get<AppNotification[]>("/messages/notifications");
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
    setBroadcastMessage("");
    try {
      await api.post("/messages", { receiverEmail: to, subject, body });
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

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingBroadcast(true);
    setSendError("");
    setBroadcastMessage("");
    try {
      const result = await api.post<{ recipientCount: number }>("/messages/bulk", {
        audience: broadcastAudience,
        cohortId: broadcastAudience === "COHORT_STUDENTS" ? broadcastCohortId : undefined,
        subject: broadcastSubject || undefined,
        body: broadcastBody,
        priority: broadcastPriority,
      });
      setBroadcastMessage(`Sent to ${result.recipientCount} recipient${result.recipientCount === 1 ? "" : "s"}.`);
      setShowBroadcast(false);
      setBroadcastSubject("");
      setBroadcastBody("");
      setBroadcastCohortId("");
      setBroadcastPriority(false);
      loadMessages();
    } catch (err: any) {
      setSendError(err.message || "Failed to send announcement");
    } finally {
      setSendingBroadcast(false);
    }
  };

  const handleRunReminders = async () => {
    setRunningReminders(true);
    setSendError("");
    setBroadcastMessage("");
    try {
      const summary = await api.post<ReminderSummary | null>("/messages/reminders/run", {});
      setReminderSummary(summary);
      setBroadcastMessage("Reminder cycle completed.");
    } catch (err: any) {
      setSendError(err.message || "Failed to run reminders");
    } finally {
      setRunningReminders(false);
    }
  };

  const unreadNotificationCount = notifications.filter((notification) => !notification.read).length;

  const handleFolderChange = (nextFolder: "inbox" | "sent" | "notifications") => {
    setFolder(nextFolder);
    setSearchParams(nextFolder === "inbox" ? {} : { tab: nextFolder });
  };

  const openNotification = async (notification: AppNotification) => {
    if (!notification.read) {
      try {
        await api.put(`/messages/notifications/${notification.id}/read`);
        setNotifications((prev) =>
          prev.map((item) => (item.id === notification.id ? { ...item, read: true } : item))
        );
      } catch {}
    }
    navigate(getNotificationHref(notification));
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-[28px] font-bold">Messages</h1>
        <div className="flex gap-2">
          <button
            onClick={handleRunReminders}
            disabled={runningReminders}
            className="px-4 py-2 border border-[var(--border-s)] rounded-[2px] text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-alt)] disabled:opacity-50"
          >
            {runningReminders ? "Running..." : "Run Reminders"}
          </button>
          <button
            onClick={() => { setShowBroadcast((v) => !v); setShowCompose(false); setSendError(""); }}
            className="h-[34px] px-4 bg-[var(--action)] text-white rounded-[2px] text-[13px] font-medium text-sm font-medium hover:bg-[var(--action)]"
          >
            {showBroadcast ? "Cancel" : "Announcement"}
          </button>
          <button
            onClick={() => { setShowCompose((v) => !v); setShowBroadcast(false); setSendError(""); }}
            className="h-[34px] px-4 bg-[var(--action)] text-white rounded-[2px] text-[13px] font-medium text-sm font-medium hover:opacity-85"
          >
            {showCompose ? "Cancel" : "New Message"}
          </button>
        </div>
      </div>

      {broadcastMessage && (
        <div className="mb-4 p-3 bg-[var(--ok-bg)] border border-[var(--ok-b)] rounded-[2px] text-[var(--ok-t)] text-sm">
          {broadcastMessage}
        </div>
      )}
      {sendError && (
        <div className="mb-4 p-3 bg-[var(--er-bg)] border border-[var(--er-b)] rounded-[2px] text-[var(--er-t)] text-sm">
          {sendError}
        </div>
      )}

      {activeCases.length > 0 && (
        <div className="mb-6 rounded-[3px] border border-[var(--er-b)] bg-[var(--er-bg)] p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--er-t)]">Open Intervention Queue</div>
              <div className="text-sm text-red-900">Students still blocking completion or requiring staff follow-up.</div>
            </div>
            <button onClick={() => navigate('/groups?triage=URGENT&view=ADMIN_MORNING&filter=ALL')} className="px-3 py-2 rounded-[2px] bg-[var(--er-t)] text-white text-sm font-medium hover:bg-[var(--er-t)]">
              Open Triage Roster
            </button>
          </div>
          <div className="space-y-2">
            {activeCases.map((item) => (
              <div key={item.id} className="rounded-[2px] border border-red-100 bg-[var(--surface)] p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-[var(--text)]">{item.student.name}</div>
                    <div className="text-xs text-[var(--text-sec)]">{item.student.cohortName || 'No cohort'} · {item.student.remainingHours.toFixed(1)}h remaining · {item.student.pendingHours.toFixed(1)}h pending</div>
                    <div className="mt-1 text-xs text-[var(--text)]">{item.summary || item.student.riskReasons?.[0] || 'Needs follow-up'}</div>
                  </div>
                  <div className="text-right text-xs text-[var(--text-sec)]">
                    <div>{item.priority}</div>
                    <div>{item.status.replaceAll('_', ' ')}</div>
                    {item.owner?.name && <div>Owner: {item.owner.name}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showCompose && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-5 mb-6">
          <h3 className="font-semibold mb-3">Compose Message</h3>
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

      {showBroadcast && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[3px] p-5 mb-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold">School Announcement / Mass Reminder</h3>
              <p className="text-sm text-[var(--text-sec)]">
                Send one message to all students, only at-risk students, or a single cohort.
              </p>
            </div>
            <div className="text-xs text-[var(--text-faint)] text-right">
              Reminder automation also posts admin alerts for pending reviews.
            </div>
          </div>
          <form onSubmit={handleBroadcast} className="space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">Audience</label>
                <select
                  value={broadcastAudience}
                  onChange={(e) => setBroadcastAudience(e.target.value as typeof broadcastAudience)}
                  className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)] text-sm"
                >
                  <option value="ALL_STUDENTS">All students</option>
                  <option value="AT_RISK_STUDENTS">At-risk students</option>
                  <option value="COHORT_STUDENTS">Single cohort</option>
                </select>
              </div>
              {broadcastAudience === "COHORT_STUDENTS" && (
                <div>
                  <label className="block text-sm font-medium text-[var(--text)] mb-1">Cohort</label>
                  <select
                    value={broadcastCohortId}
                    onChange={(e) => setBroadcastCohortId(e.target.value)}
                    required
                    className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)] text-sm"
                  >
                    <option value="">Select a cohort</option>
                    {cohorts.map((cohort) => (
                      <option key={cohort.id} value={cohort.id}>{cohort.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <input
              type="text"
              placeholder="Subject"
              value={broadcastSubject}
              onChange={(e) => setBroadcastSubject(e.target.value)}
              className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)] text-sm"
            />
            <textarea
              placeholder="Write the announcement or reminder..."
              value={broadcastBody}
              onChange={(e) => setBroadcastBody(e.target.value)}
              required
              rows={4}
              className="w-full h-[34px] px-3 text-[13.5px] border border-[var(--border-s)] rounded-[2px] focus:outline-none focus:border-[var(--action)] bg-[var(--surface)] text-sm"
            />
            <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
              <label className="inline-flex items-center gap-2 text-sm text-[var(--text-sec)]">
                <input
                  type="checkbox"
                  checked={broadcastPriority}
                  onChange={(e) => setBroadcastPriority(e.target.checked)}
                />
                Mark as priority
              </label>
              <button
                type="submit"
                disabled={sendingBroadcast}
                className="h-[34px] px-4 bg-[var(--action)] text-white rounded-[2px] text-[13px] font-medium text-sm hover:bg-[var(--action)] disabled:opacity-50 sm:self-start"
              >
                {sendingBroadcast ? "Sending..." : "Send Announcement"}
              </button>
            </div>
          </form>
        </div>
      )}

      {reminderSummary && (
        <div className="mb-6 bg-[var(--surface-alt)] border border-[var(--border)] rounded-[3px] p-4 text-sm">
          <div className="font-medium text-[var(--text)] mb-2">Latest Reminder Run</div>
          <div className="grid sm:grid-cols-5 gap-3 text-center">
            <div>
              <div className="text-[16px] font-semibold">{reminderSummary.deadlineReminders}</div>
              <div className="text-xs text-[var(--text-sec)]">Deadline reminders</div>
            </div>
            <div>
              <div className="text-[16px] font-semibold">{reminderSummary.behindAlerts}</div>
              <div className="text-xs text-[var(--text-sec)]">Behind alerts</div>
            </div>
            <div>
              <div className="text-[16px] font-semibold">{reminderSummary.adminAlerts}</div>
              <div className="text-xs text-[var(--text-sec)]">Admin alerts</div>
            </div>
            <div>
              <div className="text-[16px] font-semibold">{reminderSummary.pendingReviewCount}</div>
              <div className="text-xs text-[var(--text-sec)]">Pending reviews</div>
            </div>
            <div>
              <div className="text-[16px] font-semibold">{reminderSummary.atRiskStudents}</div>
              <div className="text-xs text-[var(--text-sec)]">At-risk students</div>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {(["inbox", "sent", "notifications"] as const).map((f) => (
          <button
            key={f}
            onClick={() => handleFolderChange(f)}
            className={`px-4 py-2 rounded-[2px] text-sm font-medium capitalize ${
              folder === f ? "bg-[var(--action)] text-white" : "bg-[var(--surface-alt)] text-[var(--text)] hover:bg-[var(--border)]"
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <span>{f}</span>
              {f === "notifications" && unreadNotificationCount > 0 && (
                <span className="min-w-[18px] rounded-full bg-[var(--er-t)] px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-white">
                  {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-[var(--text-sec)]">Loading...</div>
      ) : folder === "notifications" ? (
        <div className="space-y-2">
          {notifications.length === 0 ? (
            <div className="text-[var(--text-sec)] text-center py-8">No notifications.</div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => openNotification(n)}
                className={`w-full text-left bg-[var(--surface)] border rounded-[3px] p-4 transition-colors hover:border-[var(--in-b)] hover:bg-[var(--in-bg)] ${n.read ? "border-[var(--border)]" : "border-[var(--in-b)] bg-[var(--in-bg)]"}`}
              >
                <div className="flex justify-between">
                  <div>
                    <div className="font-medium text-sm">{n.title}</div>
                    <div className="text-sm text-[var(--text-sec)]">{n.body}</div>
                  </div>
                  <div className="text-xs text-[var(--text-faint)]">{new Date(n.createdAt).toLocaleDateString()}</div>
                </div>
              </button>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {messages.length === 0 ? (
            <div className="text-[var(--text-sec)] text-center py-8">No messages.</div>
          ) : (
            messages.map((m) => (
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
          )}
        </div>
      )}
    </div>
  );
}
