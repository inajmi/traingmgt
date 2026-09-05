import { DateTime } from "luxon";
import { useEffect, useState } from "react";

import { api } from "../api/client";
import { SessionMine } from "../api/types";
import { CalendarEvent, MonthCalendar } from "../components/MonthCalendar";

const ZONE = "Asia/Dubai";

export default function CalendarPage() {
  const [cursor, setCursor] = useState<DateTime>(DateTime.now().setZone(ZONE).startOf("month"));
  const [sessions, setSessions] = useState<SessionMine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const start = cursor.startOf("month").minus({ days: 1 }).toISO() ?? "";
    const end = cursor.endOf("month").plus({ days: 1 }).toISO() ?? "";
    setLoading(true);
    api
      .get<{ sessions: SessionMine[] }>(`/sessions?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`)
      .then((d) => setSessions(d.sessions))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [cursor]);

  const events: CalendarEvent[] = sessions.map((s) => ({
    id: s.id,
    title: s.title,
    startsAt: s.startsAt,
    status: s.status,
  }));
  const highlight = new Set(sessions.filter((s) => s.myStatus === "ACCEPTED").map((s) => s.id));

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight mb-4">Training calendar</h1>
      <p className="text-sm text-muted -mt-3 mb-4">Read-only, all times in Asia/Dubai. Your accepted sessions are highlighted.</p>
      {loading ? (
        <div className="min-h-[200px] text-sm text-muted">Loading…</div>
      ) : (
        <MonthCalendar cursor={cursor} onMove={setCursor} events={events} readOnly highlightIds={highlight} onSelectDay={undefined} />
      )}
    </div>
  );
}