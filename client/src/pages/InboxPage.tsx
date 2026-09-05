import { DateTime } from "luxon";
import { MessageSquare, Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "../api/client";
import { MessageItem, Person, ThreadListItem } from "../api/types";
import { EmptyState, Modal, Spinner } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useUnread } from "../hooks/useUnread";

const KIND_TITLES: Record<string, string> = {
  SYSTEM_ASSIGNED: "New session assignment",
  SYSTEM_ACCEPTED: "Trainer accepted",
  SYSTEM_DECLINED: "Trainer declined",
  SYSTEM_APPROVED: "Account approved",
  SYSTEM_REJECTED: "Registration not approved",
  SYSTEM_RESET: "Password reset",
  SYSTEM_REMINDER: "Reminder",
  SYSTEM_SERIES: "Session series",
  SYSTEM_CANCELLED: "Session cancelled",
};

export default function InboxPage() {
  const { user } = useAuth();
  const { refresh: refreshUnread } = useUnread();
  const [threads, setThreads] = useState<ThreadListItem[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [selPeople, setSelPeople] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [creating, setCreating] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.role === "admin";

  const loadThreads = useCallback(async () => {
    const d = await api.get<{ threads: ThreadListItem[] }>("/messaging/threads");
    setThreads(d.threads);
  }, []);

  useEffect(() => {
    loadThreads().catch(() => setThreads([]));
  }, [loadThreads]);

  const openThread = useCallback(async (id: string) => {
    setActiveId(id);
    const d = await api.get<{ messages: MessageItem[] }>(`/messaging/threads/${id}/messages`);
    setMessages(d.messages);
    await api.post(`/messaging/threads/${id}/read`);
    refreshUnread();
    await loadThreads();
  }, [refreshUnread, loadThreads]);

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [messages]);

  const send = async () => {
    if (!activeId || !draft.trim()) return;
    setSending(true);
    try {
      await api.post(`/messaging/threads/${activeId}/messages`, { body: draft });
      setDraft("");
      await openThread(activeId);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const openNew = async () => {
    setNewOpen(true);
    setSelPeople([]);
    setSubject("");
    const d = await api.get<{ people: Person[] }>("/messaging/people");
    setPeople(d.people);
  };

  const createThread = async () => {
    setCreating(true);
    try {
      const d = await api.post<{ thread: { id: string } }>("/messaging/threads", {
        participantIds: selPeople,
        subject: subject || undefined,
      });
      setNewOpen(false);
      setActiveId(null);
      await openThread(d.thread.id);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const active = threads?.find((t) => t.id === activeId) ?? null;

  if (!threads) return <Spinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
        <button onClick={openNew} className="btn-primary bg-accent">
          <MessageSquare size={15} /> New message
        </button>
      </div>

      <div className="card grid sm:grid-cols-[300px_1fr] min-h-[480px] overflow-hidden">
        <div className="border-b sm:border-b-0 sm:border-r border-line divide-y divide-line max-h-[520px] overflow-y-auto">
          {threads.length === 0 ? (
            <div className="p-6 text-sm text-muted">No conversations yet.</div>
          ) : (
            threads.map((t) => {
              const title =
                t.subject ||
                (t.sessionId ? "Session chat" : `Direct with ${t.others.map((o) => o.fullName).join(", ") || "—"}`);
              return (
                <button
                  key={t.id}
                  onClick={() => openThread(t.id)}
                  className={`w-full flex items-start gap-2 px-4 py-3 text-left hover:bg-surface ${
                    t.id === activeId ? "bg-[#f1ecdd]" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{title}</div>
                    <div className="text-xs text-muted truncate">{t.lastMessage?.body || "No messages"}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {t.unreadCount > 0 && (
                      <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-danger text-white text-[10px] px-1">
                        {t.unreadCount}
                      </span>
                    )}
                    {t.lastMessageAt && (
                      <span className="text-[10px] text-muted">{DateTime.fromISO(t.lastMessageAt, { zone: "Asia/Dubai" }).toFormat("LLL d")}</span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="flex flex-col">
          {!active ? (
            <div className="p-10 text-center text-sm text-muted">Select a conversation.</div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-line bg-surface">
                <div className="font-medium text-sm">
                  {active.subject || (active.sessionId ? "Session chat" : `Direct with ${active.others.map((o) => o.fullName).join(", ") || "—"}`)}
                </div>
              </div>
              <div ref={boxRef} className="flex-1 px-4 py-4 space-y-3 overflow-y-auto max-h-[380px]">
                {messages?.map((m) => {
                  const isSystem = !m.senderId;
                  const mine = m.senderId === user?.id;
                  return (
                    <div key={m.id} className={isSystem ? "" : "flex flex-col"}>
                      {isSystem ? (
                        <div className="text-xs text-muted italic">
                          <span className="font-semibold not-italic text-sub">{(KIND_TITLES[m.kind] ?? "System") + ":"}</span> {m.body}
                        </div>
                      ) : (
                        <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${mine ? "bg-[#eef1e8] self-end" : "bg-[#f1ecdd]"}`}>
                          <div className="text-[11px] text-muted mb-0.5">{mine ? "You" : m.senderName}{" · "}{DateTime.fromISO(m.createdAt, { zone: "Asia/Dubai" }).toFormat("LLL d, h:mm a")}</div>
                          <div className="whitespace-pre-line">{m.body}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-line p-3 flex items-end gap-2">
                <textarea
                  className="field flex-1"
                  rows={2}
                  placeholder="Write a message…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                <button onClick={send} disabled={sending || !draft.trim()} className="btn-primary bg-accent">
                  <Send size={15} /> Send
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {newOpen && (
        <Modal title="New message" onClose={() => setNewOpen(false)} wide>
          <div className="space-y-3">
            <div>
              <label className="label">Subject (optional)</label>
              <input className="field" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div>
              <label className="label">People ({selPeople.length} selected)</label>
              <div className="border border-line2 rounded-md max-h-52 overflow-y-auto divide-y divide-line">
                {people.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-surface">
                    <input
                      type="checkbox"
                      checked={selPeople.includes(p.id)}
                      onChange={(e) => {
                        setSelPeople((s) => (e.target.checked ? [...s, p.id] : s.filter((x) => x !== p.id)));
                      }}
                    />
                    <span className="font-medium">{p.fullName}</span>
                    <span className={`text-xs ${p.role === "admin" ? "text-[#3d5680]" : "text-muted"}`}>
                      {p.role === "admin" ? "Admin" : "Trainer"}
                    </span>
                    {isAdmin && p.email && <span className="text-xs text-muted truncate">{p.email}</span>}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setNewOpen(false)}>Cancel</button>
              <button className="btn-primary bg-accent" disabled={creating || selPeople.length === 0} onClick={createThread}>
                Start conversation
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}