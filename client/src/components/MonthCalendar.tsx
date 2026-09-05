import { DateTime } from "luxon";
import { ChevronLeft, ChevronRight } from "lucide-react";

const ZONE = "Asia/Dubai";

export type CalendarEvent = {
  id: string;
  title: string;
  startsAt: string;
  status: string;
};

export function MonthCalendar({
  cursor,
  onMove,
  events,
  onSelectDay,
  onSelectEvent,
  readOnly,
  highlightIds,
}: {
  cursor: DateTime;
  onMove: (next: DateTime) => void;
  events: CalendarEvent[];
  onSelectDay?: (iso: string) => void;
  onSelectEvent?: (id: string) => void;
  readOnly?: boolean;
  highlightIds?: Set<string>;
}) {
  const today = DateTime.now().setZone(ZONE).toISODate();
  const first = cursor.startOf("month");
  const startWeek = first.startOf("week");
  const cells: DateTime[] = [];
  for (let i = 0; i < 42; i++) cells.push(startWeek.plus({ days: i }));

  const byDay: Record<string, CalendarEvent[]> = {};
  for (const e of events) {
    const d = DateTime.fromISO(e.startsAt, { zone: ZONE });
    if (!d.isValid) continue;
    const key = d.toISODate();
    byDay[key] = byDay[key] ?? [];
    byDay[key].push({ ...e, startsAt: d.toFormat("HH:mm") });
  }

  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <button className="btn-ghost" onClick={() => onMove(cursor.minus({ months: 1 }))} aria-label="Previous month">
          <ChevronLeft size={16} />
        </button>
        <h2 className="font-semibold">{cursor.toFormat("LLLL yyyy")}</h2>
        <button className="btn-ghost" onClick={() => onMove(cursor.plus({ months: 1 }))} aria-label="Next month">
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] text-muted border-b border-line">
        {weekdays.map((w) => (
          <div key={w} className="px-1 py-2">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day) => {
          const iso = day.toISODate() ?? "";
          const inMonth = day.month === cursor.month;
          const dayEvents = byDay[iso] ?? [];
          const isToday = iso === today;
          return (
            <div
              key={iso}
              onClick={() => onSelectDay?.(iso)}
              className={`border-b border-r border-line min-h-[92px] p-1.5 text-xs align-top ${
                inMonth ? "bg-white" : "bg-[#faf7f0] text-muted/60"
              } ${onSelectDay && inMonth ? "cursor-pointer hover:bg-surface" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${isToday ? "bg-accent text-white font-semibold" : ""}`}>
                  {day.day}
                </span>
                {!readOnly && dayEvents.length > 0 && <span className="text-[10px] text-muted">{dayEvents.length}</span>}
              </div>
              <div className="mt-1 space-y-1">
                {dayEvents.slice(0, 3).map((e: CalendarEvent) => {
                  const hl = highlightIds?.has(e.id);
                  return (
                    <button
                      key={e.id}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onSelectEvent?.(e.id);
                      }}
                      className={`w-full text-left rounded px-1.5 py-0.5 leading-tight truncate border ${
                        hl ? "border-accent bg-[#eef1e8] text-[#3a472c]" : "border-line bg-surface text-ink"
                      } ${e.status === "CANCELLED" ? "line-through opacity-60" : ""}`}
                    >
                      <span className="block truncate font-medium">{e.title}</span>
                      <span className="block text-[10px] text-muted">{e.startsAt}</span>
                    </button>
                  );
                })}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-muted pl-1">+{dayEvents.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}