import { DateTime } from "luxon";
import { Check, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { api } from "../api/client";
import { ASSIGN_STYLE, SessionMine } from "../api/types";
import { Pill, EmptyState, Spinner } from "../components/ui";

export default function MySessions() {
  const [sessions, setSessions] = useState<SessionMine[] | null>(null);
  const [busyId, setBusyId] = useState("");

  const load = useCallback(() => {
    api
      .get<{ sessions: SessionMine[] }>(`/sessions`)
      .then((d) => setSessions(d.sessions))
      .catch(() => setSessions([]));
  }, []);

  useEffect(load, [load]);

  if (!sessions) return <Spinner />;

  const now = new Date().toISOString();
  const upcoming = sessions
    .filter((s) => s.startsAt > now && s.status === "SCHEDULED")
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = sessions.filter((s) => s.startsAt <= now || s.status !== "SCHEDULED");

  const respond = async (id: string, accepted: boolean) => {
    setBusyId(id);
    try {
      await api.post(`/sessions/${id}/respond`, { accepted });
      load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusyId("");
    }
  };

  const renderSession = (s: SessionMine) => {
    const status = s.myStatus;
    return (
      <div key={s.id} className="px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{s.title}</div>
          <div className="text-xs text-muted truncate">
            {DateTime.fromISO(s.startsAt, { zone: "Asia/Dubai" }).toFormat("ccc, LLL d '·' h:mm a")} · {s.durationMinutes} min ·{" "}
            {s.format.replace("_", " ").toLowerCase()} · {s.trainerNames.join(", ") || "—"}
          </div>
          {(s.venue || s.link) && (
            <div className="text-xs text-muted truncate">
              {s.venue && `📍 ${s.venue} `}
              {s.link && `🔗 ${s.link}`}
            </div>
          )}
        </div>
        {status === "ASSIGNED" ? (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => respond(s.id, true)}
              disabled={busyId === s.id}
              className="inline-flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-xs text-white disabled:opacity-40"
            >
              <Check size={14} /> Accept
            </button>
            <button
              onClick={() => respond(s.id, false)}
              disabled={busyId === s.id}
              className="inline-flex items-center gap-1 rounded-md border border-line2 px-3 py-1.5 text-xs text-sub hover:bg-[#f2e3e0] hover:text-danger"
            >
              <X size={14} /> Decline
            </button>
          </div>
        ) : status ? (
          <Pill {...ASSIGN_STYLE[status]}>{status[0] + status.slice(1).toLowerCase()}</Pill>
        ) : null}
      </div>
    );
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight mb-4">My sessions</h1>

      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-2">Upcoming ({upcoming.length})</h2>
      {upcoming.length === 0 ? (
        <EmptyState>You have no upcoming sessions.</EmptyState>
      ) : (
        <div className="card divide-y divide-line overflow-hidden mb-8">{upcoming.map(renderSession)}</div>
      )}

      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-2">Past & cancelled</h2>
      {past.length === 0 ? (
        <EmptyState>Nothing here yet.</EmptyState>
      ) : (
        <div className="card divide-y divide-line overflow-hidden opacity-80">{past.map(renderSession)}</div>
      )}
    </div>
  );
}