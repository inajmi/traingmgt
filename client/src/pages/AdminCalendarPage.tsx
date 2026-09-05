import { DateTime } from "luxon";
import { CalendarPlus, Plus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { api } from "../api/client";
import { AVAIL_COLORS, MONTHS, SessionAdmin, TrainerProfile } from "../api/types";
import { CalendarEvent, MonthCalendar } from "../components/MonthCalendar";
import { Drawer, Modal, EmptyState } from "../components/ui";

const ZONE = "Asia/Dubai";
const FORMAT_LABELS: Record<string, string> = { IN_PERSON: "In-person", ONLINE: "Online", HYBRID: "Hybrid" };

type TrainerRow = TrainerProfile & { availability: Record<string, string> };

function TrainersPicker({
  trainers,
  selected,
  toggle,
}: {
  trainers: TrainerRow[];
  selected: string[];
  toggle: (id: string) => void;
}) {
  return (
    <div className="border border-line2 rounded-md max-h-60 overflow-y-auto divide-y divide-line">
      {trainers.map((t) => (
        <label key={t.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-surface">
          <input type="checkbox" checked={selected.includes(t.id)} onChange={() => toggle(t.id)} />
          <span className="font-medium min-w-0 truncate">{t.name || t.email || "—"}</span>
          <span className="flex gap-0.5">
            {MONTHS.map((m) => {
              const s = t.availability?.[m];
              return s ? (
                <span key={m} className="h-2 w-2 rounded-full" style={{ backgroundColor: AVAIL_COLORS[s] }} title={`${m}: ${s}`} />
              ) : (
                <span key={m} className="h-2 w-2 rounded-full bg-line2" title={m} />
              );
            })}
          </span>
        </label>
      ))}
    </div>
  );
}

export default function AdminCalendarPage() {
  const [cursor, setCursor] = useState<DateTime>(DateTime.now().setZone(ZONE).startOf("month"));
  const [sessions, setSessions] = useState<SessionAdmin[]>([]);
  const [trainers, setTrainers] = useState<TrainerRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [createDay, setCreateDay] = useState("");
  const [viewing, setViewing] = useState<SessionAdmin | null>(null);

  const loadSessions = useCallback(async (cursorDt: DateTime) => {
    const start = cursorDt.startOf("month").minus({ days: 1 }).toISO() ?? "";
    const end = cursorDt.endOf("month").plus({ days: 1 }).toISO() ?? "";
    setLoading(true);
    try {
      const d = await api.get<{ sessions: SessionAdmin[] }>(`/sessions?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
      setSessions(d.sessions);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTrainers = useCallback(async () => {
    try {
      const d = await api.get<{ trainers: TrainerRow[] }>("/admin/trainers");
      setTrainers(d.trainers);
    } catch {
      setTrainers([]);
    }
  }, []);

  useEffect(() => {
    loadSessions(cursor);
    loadTrainers();
  }, [cursor, loadSessions, loadTrainers]);

  const search = (id: string) => (sessions.find((s) => s.id === id) ?? viewing) ?? null;

  const events: CalendarEvent[] = sessions.map((s) => ({ id: s.id, title: s.title, startsAt: s.startsAt, status: s.status }));

  const openCreate = (iso?: string) => {
    setCreateOpen(true);
    setCreateDay(iso ?? "");
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Session planning</h1>
        <button onClick={() => openCreate()} className="btn-primary bg-accent">
          <CalendarPlus size={15} /> New session
        </button>
      </div>

      {loading ? (
        <div className="min-h-[200px] text-sm text-muted">Loading…</div>
      ) : (
        <MonthCalendar cursor={cursor} onMove={setCursor} events={events} onSelectDay={(iso) => openCreate(iso)} onSelectEvent={(id) => setViewing(search(id))} />
      )}

      {createOpen && (
        <SessionForm
          day={createDay}
          trainers={trainers}
          onClose={() => setCreateOpen(false)}
          onDone={() => {
            setCreateOpen(false);
            loadSessions(cursor);
          }}
        />
      )}

      {viewing && (
        <SessionDrawer
          session={viewing}
          trainers={trainers}
          onClose={() => setViewing(null)}
          onSaved={(s) => {
            loadSessions(cursor);
            setViewing(s);
          }}
          onDeleted={() => {
            setViewing(null);
            loadSessions(cursor);
          }}
        />
      )}
    </div>
  );
}

function SessionForm({ day, trainers, onClose, onDone }: { day: string; trainers: TrainerRow[]; onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [startsAt, setStartsAt] = useState(
    day ? `${day}T10:00` : DateTime.now().setZone(ZONE).plus({ days: 1 }).set({ hour: 10, minute: 0 }).toFormat("yyyy-MM-dd'T'HH:mm"),
  );
  const [duration, setDuration] = useState(90);
  const [format, setFormat] = useState<"IN_PERSON" | "ONLINE" | "HYBRID">("IN_PERSON");
  const [venue, setVenue] = useState("");
  const [link, setLink] = useState("");
  const [notes, setNotes] = useState("");
  const [trainerIds, setTrainerIds] = useState<string[]>([]);
  const [seriesOn, setSeriesOn] = useState(false);
  const [frequency, setFrequency] = useState<"WEEKLY" | "MONTHLY">("WEEKLY");
  const [interval, setInterval] = useState(1);
  const [until, setUntil] = useState(day ? `${day}` : "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) => setTrainerIds((ts) => (ts.includes(id) ? ts.filter((x) => x !== id) : [...ts, id]));

  const submit = async () => {
    setErr("");
    const dt = DateTime.fromFormat(startsAt, "yyyy-MM-dd'T'HH:mm", { zone: ZONE });
    if (!dt.isValid) {
      setErr("Invalid start time.");
      return;
    }
    if (seriesOn && !until) {
      setErr("Set a repeat-until date.");
      return;
    }
    setBusy(true);
    try {
      await api.post("/sessions", {
        title,
        topic: topic || null,
        startsAt: dt.toISO(),
        durationMinutes: duration,
        format,
        venue: venue || null,
        link: link || null,
        notes: notes || null,
        trainerIds,
        ...(seriesOn ? { series: { frequency, interval, until } } : {}),
      });
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={day ? `New session · ${DateTime.fromISO(day, { zone: ZONE }).toFormat("LLL d")}` : "New session"} onClose={onClose} wide>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Title *</label>
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="label">Topic</label>
          <input className="field" value={topic} onChange={(e) => setTopic(e.target.value)} />
        </div>
        <div>
          <label className="label">Start (Asia/Dubai)</label>
          <input type="datetime-local" className="field" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Duration (min)</label>
            <input type="number" min={15} step={15} className="field" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Format</label>
            <select className="field" value={format} onChange={(e) => setFormat(e.target.value as typeof format)}>
              {(["IN_PERSON", "ONLINE", "HYBRID"] as const).map((f) => (
                <option key={f} value={f}>{FORMAT_LABELS[f]}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Venue</label>
          <input className="field" value={venue} onChange={(e) => setVenue(e.target.value)} />
        </div>
        <div>
          <label className="label">Link</label>
          <input className="field" value={link} onChange={(e) => setLink(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Notes</label>
          <textarea className="field" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Trainers ({trainerIds.length} selected — dots show each trainer's {new Date().getFullYear()} availability)</label>
          <TrainersPicker trainers={trainers} selected={trainerIds} toggle={toggle} />
        </div>
        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={seriesOn} onChange={(e) => setSeriesOn(e.target.checked)} />
            <span className="font-medium">Repeat (create a recurring series)</span>
          </label>
          {seriesOn && (
            <div className="grid grid-cols-3 gap-3 mt-2">
              <div>
                <label className="label">Frequency</label>
                <select className="field" value={frequency} onChange={(e) => setFrequency(e.target.value as typeof frequency)}>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
              </div>
              <div>
                <label className="label">Interval</label>
                <input type="number" min={1} max={12} className="field" value={interval} onChange={(e) => setInterval(Number(e.target.value))} />
              </div>
              <div>
                <label className="label">Until (inclusive)</label>
                <input type="date" className="field" value={until} onChange={(e) => setUntil(e.target.value)} />
              </div>
            </div>
          )}
        </div>
      </div>
      {err && <p className="text-sm text-danger mt-3">{err}</p>}
      <div className="flex justify-end gap-2 mt-4">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary bg-accent" disabled={busy || !title.trim()} onClick={submit}>
          <Plus size={14} /> Create
        </button>
      </div>
    </Modal>
  );
}

function SessionDrawer({
  session,
  trainers,
  onClose,
  onSaved,
  onDeleted,
}: {
  session: SessionAdmin;
  trainers: TrainerRow[];
  onClose: () => void;
  onSaved: (s: SessionAdmin) => void;
  onDeleted: () => void;
}) {
  const [form, setForm] = useState({
    title: session.title,
    topic: session.topic ?? "",
    venue: session.venue ?? "",
    link: session.link ?? "",
    notes: session.notes ?? "",
  });
  const [addPicker, setAddPicker] = useState(false);
  const [addSel, setAddSel] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    setErr("");
    try {
      const d = await api.patch<{ session: SessionAdmin }>(`/sessions/${session.id}`, form);
      onSaved(d.session);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const addTrainers = async () => {
    setBusy(true);
    setErr("");
    try {
      const d = await api.post<{ session: SessionAdmin }>(`/sessions/${session.id}/trainers`, { trainerIds: addSel });
      setAddPicker(false);
      setAddSel([]);
      onSaved(d.session);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!confirm("Cancel this session? Trainers will be notified.")) return;
    setBusy(true);
    setErr("");
    try {
      await api.post(`/sessions/${session.id}/cancel`);
      onDeleted();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const assignments = session.assignments ?? [];

  return (
    <Drawer title={session.title} subtitle={DateTime.fromISO(session.startsAt, { zone: ZONE }).toFormat("cccc, LLL d yyyy · h:mm a")} onClose={onClose}>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs px-2 py-0.5 rounded-full bg-surface border border-line">{FORMAT_LABELS[session.format] ?? session.format}</span>
        {session.durationMinutes && <span className="text-xs text-muted">{session.durationMinutes} min</span>}
        {session.seriesId && <span className="text-xs text-muted">Recurring series</span>}
        {session.status === "CANCELLED" && <span className="text-xs text-danger font-medium">CANCELLED</span>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <div>
          <label className="label">Title</label>
          <input className="field" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        </div>
        <div>
          <label className="label">Topic</label>
          <input className="field" value={form.topic} onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))} />
        </div>
        <div>
          <label className="label">Venue</label>
          <input className="field" value={form.venue} onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))} />
        </div>
        <div>
          <label className="label">Link</label>
          <input className="field" value={form.link} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Notes</label>
          <textarea className="field" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <button className="btn-primary bg-accent" disabled={busy} onClick={save}>Save changes</button>
        {session.status !== "CANCELLED" && (
          <button className="btn-ghost text-danger" disabled={busy} onClick={cancel}>Cancel session</button>
        )}
        {err && <span className="text-sm text-danger">{err}</span>}
      </div>

      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
        Assigned trainers ({assignments.length})
      </h3>
      {assignments.length === 0 ? (
        <EmptyState small>No trainers assigned yet.</EmptyState>
      ) : (
        <div className="divide-y divide-line border border-line rounded-lg overflow-hidden mb-3">
          {assignments.map((a) => (
            <div key={a.trainer.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span className="font-medium min-w-0 truncate">{a.trainer.name || a.trainer.email || "—"}</span>
              <span className="text-xs text-muted truncate">{a.trainer.profession}</span>
              <span className="ml-auto text-xs" style={{ color: a.status === "ACCEPTED" ? "#33623f" : a.status === "DECLINED" ? "#a8433a" : "#b8862f" }}>
                {a.status[0] + a.status.slice(1).toLowerCase()}
                {a.respondedAt ? ` · ${new Date(a.respondedAt).toLocaleDateString()}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      {addPicker ? (
        <div>
          <label className="label">Add trainers</label>
          <TrainersPicker trainers={trainers} selected={addSel} toggle={(id) => setAddSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))} />
          <div className="flex justify-end gap-2 mt-3">
            <button className="btn-ghost" onClick={() => setAddPicker(false)}><X size={14} /> Close</button>
            <button className="btn-primary bg-accent" disabled={busy || addSel.length === 0} onClick={addTrainers}>
              <Plus size={14} /> Assign selected
            </button>
          </div>
        </div>
      ) : (
        session.status !== "CANCELLED" && (
          <button className="btn-ghost" onClick={() => setAddPicker(true)}>
            <Plus size={14} /> Add trainers
          </button>
        )
      )}
    </Drawer>
  );
}