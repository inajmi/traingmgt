import { DateTime } from "luxon";
import { CalendarDays, CheckCircle2, Clock, Inbox as InboxIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../api/client";
import { SessionMine } from "../api/types";
import { ASSIGN_STYLE } from "../api/types";
import { Pill, Spinner } from "../components/ui";
import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionMine[] | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const now = new Date();
    const start = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString();
    const end = new Date(now.getTime() + 180 * 24 * 3600 * 1000).toISOString();
    api.get<{ sessions: SessionMine[] }>(`/sessions?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`)
      .then((d) => setSessions(d.sessions))
      .catch(() => setSessions([]));
    api.get<{ unreadTotal: number }>("/notifications").then((d) => setUnread(d.unreadTotal)).catch(() => {});
  }, []);

  if (!sessions) return <Spinner />;

  const upcoming = sessions.filter((s) => s.startsAt > new Date().toISOString() && s.status === "SCHEDULED");
  const acceptPending = upcoming.filter((s) => s.myStatus === "ASSIGNED").length;
  const acceptedUpcoming = upcoming.filter((s) => s.myStatus === "ACCEPTED").length;
  const nextThree = upcoming.slice(0, 3);

  const cards = [
    { label: "Upcoming accepted", value: acceptedUpcoming, color: "#33623f" },
    { label: "Awaiting your reply", value: acceptPending, color: "#b8862f" },
    { label: "Unread messages", value: unread, color: "#3d5680" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome, {user?.fullName.split(" ")[0]}</h1>
      <p className="text-sm text-muted mt-1">Here's what's coming up for you.</p>

      <div className="grid grid-cols-3 gap-3 mt-6">
        {cards.map((c) => (
          <div key={c.label} className="card px-4 py-3">
            <div className="text-2xl font-semibold" style={{ color: c.color }}>{c.value}</div>
            <div className="text-xs text-muted mt-0.5">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-3">Next sessions</h2>
        {nextThree.length === 0 ? (
          <div className="card px-4 py-8 text-center text-sm text-muted">You have no upcoming sessions.</div>
        ) : (
          <div className="card divide-y divide-line overflow-hidden">
            {nextThree.map((s) => {
              const style = ASSIGN_STYLE[s.myStatus ?? "ASSIGNED"] ?? { bg: "#eee9dd", fg: "#6b6355" };
              return (
                <button key={s.id} onClick={() => navigate("/sessions")} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{s.title}</div>
                    <div className="text-xs text-muted truncate">
                      {DateTime.fromISO(s.startsAt, { zone: "Asia/Dubai" }).toFormat("ccc, LLL d '·' h:mm a")} — {s.trainerNames.join(", ")}
                    </div>
                  </div>
                  <Pill {...style}>{s.myStatus ?? "Assigned"}</Pill>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-8 grid sm:grid-cols-3 gap-3">
        <button onClick={() => navigate("/calendar")} className="card p-4 flex items-center gap-3 text-left hover:bg-surface">
          <CalendarDays className="text-accent" size={20} />
          <span className="text-sm font-medium">View training calendar</span>
        </button>
        <button onClick={() => navigate("/sessions")} className="card p-4 flex items-center gap-3 text-left hover:bg-surface">
          <Clock className="text-accent" size={20} />
          <span className="text-sm font-medium">Respond to sessions</span>
        </button>
        <button onClick={() => navigate("/inbox")} className="card p-4 flex items-center gap-3 text-left hover:bg-surface">
          <InboxIcon className="text-accent" size={20} />
          <span className="text-sm font-medium">Open inbox {unread > 0 && `(${unread} unread)`}</span>
        </button>
      </div>
    </div>
  );
}