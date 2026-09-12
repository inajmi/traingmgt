import { useCallback, useEffect, useState } from "react";
import { KeyRound, Plus, Search, ShieldBan, ShieldCheck, UserPlus, X } from "lucide-react";

import { api } from "../api/client";
import { AVAIL_COLORS, AVAIL_STATUSES, MEETING_STATUSES, MONTHS, TrainerProfile } from "../api/types";
import { Drawer, Modal } from "../components/ui";
import { FieldDef, FieldGroup } from "../components/fields";

const ADMIN_FIELDS: FieldDef[] = [
  { key: "itsId", label: "ITS ID", type: "text" },
  { key: "name", label: "Full name", type: "text" },
  { key: "email", label: "Email", type: "text" },
  { key: "phone", label: "Phone", type: "text" },
  { key: "profession", label: "Profession", type: "text" },
  { key: "surveyExpertise", label: "Expertise (survey reference)", type: "textarea" },
  { key: "surveyTopics", label: "Proposed topics (survey reference)", type: "textarea" },
  { key: "surveyFormat", label: "Preferred format (survey reference)", type: "textarea" },
  { key: "surveyDayAvailability", label: "Days available (survey reference)", type: "textarea" },
  { key: "finalTopics", label: "Final topics comfortable delivering", type: "textarea" },
  { key: "preferredFormat", label: "Preferred format", type: "text" },
  { key: "preferredDays", label: "Preferred days", type: "text" },
  { key: "preferredTime", label: "Preferred time", type: "text" },
  { key: "maxSessions", label: "Max sessions / month", type: "number" },
  { key: "minNotice", label: "Minimum notice", type: "text" },
  { key: "languages", label: "Languages", type: "text" },
  { key: "constraints", label: "Constraints / support needed", type: "textarea" },
];

const MEETING_OPTIONS: Record<string, string[]> = {
  meetingStatus: MEETING_STATUSES,
  meetingDate: [],
  willingness: ["Regularly", "Occasionally", "Not currently"],
  freeTraining: ["Yes – Volunteer", "No", "Maybe"],
};

const MEETING_FIELDS: (FieldDef & { key: keyof TrainerProfile })[] = [
  { key: "meetingStatus", label: "Meeting status", type: "select", options: MEETING_OPTIONS.meetingStatus },
  { key: "meetingDate", label: "Meeting date", type: "date" },
  { key: "willingness", label: "Willingness", type: "select", options: MEETING_OPTIONS.willingness },
  { key: "freeTraining", label: "Free training", type: "select", options: MEETING_OPTIONS.freeTraining },
  { key: "fee", label: "Fee", type: "text" },
  { key: "followUp", label: "Follow-up notes", type: "textarea" },
];

function ResourcePill({ label, color }: { label: string; color: string }) {
  return <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium mt-1" style={{ backgroundColor: `${color}1a`, color }}>{label}</span>;
}

export default function AdminTrainers() {
  const [rows, setRows] = useState<(TrainerProfile & { availability: Record<string, string> })[] | null>(null);
  const [q, setQ] = useState("");
  const [hasAccount, setHasAccount] = useState<"" | "true" | "false">("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [selected, setSelected] = useState<(TrainerProfile & { availability: Record<string, string> }) | null>(null);
  const [form, setForm] = useState<Partial<TrainerProfile>>({});
  const [avail, setAvail] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newTrainer, setNewTrainer] = useState({ name: "", email: "", phone: "", profession: "", itsId: "" });
  const [creating, setCreating] = useState(false);
  const [accountMsg, setAccountMsg] = useState("");
  const [accountWarn, setAccountWarn] = useState(false);
  const [showTemp, setShowTemp] = useState("");

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (hasAccount) params.set("hasAccount", hasAccount);
    api
      .get<{ trainers: (TrainerProfile & { availability: Record<string, string> })[] }>(`/admin/trainers?${params.toString()}`)
      .then((d) => setRows(d.trainers))
      .catch(() => setRows([]));
  }, [q, hasAccount]);

  useEffect(load, [load]);

  const openDrawer = (t: TrainerProfile & { availability: Record<string, string> }) => {
    setSelected(t);
    setForm(t);
    setAvail(t.availability ?? {});
    setNotice("");
    setAccountMsg("");
    setAccountWarn(false);
    setShowTemp("");
  };

  const update = (key: string, val: string | number | null) => setForm((f) => ({ ...f, [key]: val }));

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    setNotice("");
    try {
      const patch: Record<string, unknown> = {};
      [...ADMIN_FIELDS.map((f) => f.key), ...MEETING_FIELDS.map((f) => f.key)].forEach((k) => {
        patch[k] = (form as Record<string, unknown>)[k] ?? "";
      });
      await api.put(`/admin/trainers/${selected.id}`, patch);
      await api.put(`/admin/trainers/${selected.id}/availability`, {
        year,
        entries: MONTHS.map((m) => ({ month: m, status: avail[m] ?? "" })),
      });
      setNotice("Saved.");
      load();
      setTimeout(() => setNotice(""), 2000);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const act = async (kind: "reset" | "disable" | "enable") => {
    if (!selected?.account?.id) return;
    setAccountMsg("");
    setAccountWarn(false);
    setShowTemp("");
    try {
      if (kind === "reset") {
        const d = await api.post<{ tempPassword: string; emailWarning?: string }>(`/admin/users/${selected.account.id}/reset-password`);
        setShowTemp(d.tempPassword);
        setAccountWarn(!!d.emailWarning);
        setAccountMsg(d.emailWarning ?? "Temporary password generated. It was sent to the trainer's inbox.");
        load();
      } else {
        await api.post(`/admin/users/${selected.account.id}/${kind}`);
        setAccountMsg(kind === "disable" ? "Account disabled." : "Account enabled.");
        load();
      }
    } catch (e) {
      setAccountWarn(true);
      setAccountMsg((e as Error).message);
    }
  };

  const addTrainer = async () => {
    setCreating(true);
    try {
      const d = await api.post<{ trainer: TrainerProfile }>("/admin/trainers", newTrainer);
      setAddOpen(false);
      setNewTrainer({ name: "", email: "", phone: "", profession: "", itsId: "" });
      await load();
      openDrawer({ ...d.trainer, availability: {} });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const fillGrid = (m: string, v: string) => setAvail((a) => ({ ...a, [m]: v }));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Trainers</h1>
        <button onClick={() => setAddOpen(true)} className="btn-primary bg-accent">
          <UserPlus size={15} /> Add trainer
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-muted" />
          <input className="field pl-8" placeholder="Search name, email, profession…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="field w-auto" value={hasAccount} onChange={(e) => setHasAccount(e.target.value as "" | "true" | "false")}>
          <option value="">All</option>
          <option value="true">With account</option>
          <option value="false">No account</option>
        </select>
        <select className="field w-auto" value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {[year - 1, year, year + 1].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {rows === null ? (
        <div className="min-h-[120px] text-sm text-muted">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="card py-10 text-center text-sm text-muted">No trainers match.</div>
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-2 text-[11px] uppercase tracking-wide text-muted bg-surface">
            <div>Name</div>
            <div>Status</div>
            <div>Availability {year}</div>
            <div className="text-right">Meeting</div>
          </div>
          {rows.map((t) => (
            <button key={t.id} onClick={() => openDrawer(t)} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-3 items-center text-left hover:bg-surface">
              <div className="min-w-0">
                <div className="font-medium text-sm truncate flex items-center gap-2">
                  {t.name || t.email || "—"}
                  {t.constraints && <span className="text-[11px] text-[#b8862f]" title="Has constraints">⚠</span>}
                </div>
                <div className="text-xs text-muted truncate">
                  {t.profession} {t.email && `· ${t.email}`}
                </div>
              </div>
              <div>
                {t.account ? (
                  <span className={`text-xs ${t.account.status === "ACTIVE" ? "text-[#33623f]" : t.account.status === "DISABLED" ? "text-[#b8862f]" : "text-danger"}`}>
                    {t.account.status.charAt(0) + t.account.status.slice(1).toLowerCase()}
                  </span>
                ) : (
                  <span className="text-xs text-muted">No account</span>
                )}
              </div>
              <div className="flex gap-1 flex-wrap max-w-[180px]">
                {t.availability ? (
                  MONTHS.map((m) => {
                    const s = t.availability[m];
                    if (!s) return <span key={m} className="h-2 w-2 rounded-full bg-line2" title={m} />;
                    return <span key={m} className="h-2 w-2 rounded-full" style={{ backgroundColor: AVAIL_COLORS[s] }} title={`${m}: ${s}`} />;
                  })
                ) : null}
              </div>
              <div className="text-right">
                {t.meetingStatus ? <span className="inline-block rounded px-1.5 py-0.5 text-[11px]" style={{ backgroundColor: "#eee9dd", color: "#6b6355" }}>{t.meetingStatus}</span> : <span className="text-xs text-muted">—</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <Drawer title={`${selected.itsId ? selected.itsId + " · " : ""}${selected.name || "Trainer"}`} onClose={() => setSelected(null)}>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <button onClick={save} disabled={saving} className="btn-primary bg-accent">
              <Plus size={14} /> Save changes
            </button>
            {notice && <span className="text-sm text-[#33623f]">{notice}</span>}
          </div>

          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Profile & survey</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
            {ADMIN_FIELDS.map((f) => (
              <FieldGroup key={f.key} field={f} value={(form as Record<string, unknown>)[f.key]} onChange={update} />
            ))}
          </div>

          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Meeting & administration</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
            {MEETING_FIELDS.map((f) => (
              <FieldGroup key={f.key} field={f} value={(form as Record<string, unknown>)[f.key]} onChange={update} />
            ))}
          </div>

          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">Monthly availability · {year}</h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-5">
            {MONTHS.map((m) => (
              <div key={m}>
                <label className="block text-[11px] font-medium text-sub mb-1">{m}</label>
                <select value={avail[m] ?? ""} onChange={(e) => fillGrid(m, e.target.value)} className="w-full text-xs rounded-md border border-line2 px-2 py-1.5 bg-white">
                  {["", ...AVAIL_STATUSES].map((s) => (
                    <option key={s || "none"} value={s}>{s === "" ? "—" : s}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Account</h3>
          {selected.account ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm">
                  {selected.account.email} ·{" "}
                  <span className={`text-xs ${selected.account.status === "ACTIVE" ? "text-[#33623f]" : "text-danger"}`}>
                    {selected.account.status.charAt(0) + selected.account.status.slice(1).toLowerCase()}
                  </span>
                </span>
                <button onClick={() => act("reset")} className="btn-ghost btn-sm">
                  <KeyRound size={13} /> Reset password
                </button>
                {selected.account.status === "ACTIVE" ? (
                  <button onClick={() => act("disable")} className="btn-ghost btn-sm">
                    <ShieldBan size={13} /> Disable
                  </button>
                ) : (
                  <button onClick={() => act("enable")} className="btn-ghost btn-sm">
                    <ShieldCheck size={13} /> Enable
                  </button>
                )}
              </div>
              {showTemp && (
                <div className="rounded-lg bg-[#f1ecdd] border border-line p-3 text-sm">
                  <div className="font-medium mb-1">Temporary password (shown once):</div>
                  <code className="text-accent font-semibold">{showTemp}</code>
                  <div className="text-xs text-muted mt-1">The trainer must change it on next sign-in.</div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted">This trainer has no sign-in account yet.</p>
          )}
          {accountMsg && <p className={`text-sm mt-2 ${accountWarn ? "text-danger" : "text-[#33623f]"}`}>{accountMsg}</p>}
        </Drawer>
      )}

      {addOpen && (
        <Modal title="Add trainer" onClose={() => setAddOpen(false)}>
          <div className="space-y-3">
            <div>
              <label className="label">Full name *</label>
              <input className="field" value={newTrainer.name} onChange={(e) => setNewTrainer((n) => ({ ...n, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Email</label>
                <input className="field" value={newTrainer.email} onChange={(e) => setNewTrainer((n) => ({ ...n, email: e.target.value }))} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="field" value={newTrainer.phone} onChange={(e) => setNewTrainer((n) => ({ ...n, phone: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Profession</label>
                <input className="field" value={newTrainer.profession} onChange={(e) => setNewTrainer((n) => ({ ...n, profession: e.target.value }))} />
              </div>
              <div>
                <label className="label">ITS ID</label>
                <input className="field" value={newTrainer.itsId} onChange={(e) => setNewTrainer((n) => ({ ...n, itsId: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-ghost" onClick={() => setAddOpen(false)}><X size={14} /> Cancel</button>
              <button className="btn-primary bg-accent" disabled={creating || !newTrainer.name.trim()} onClick={addTrainer}>
                <Plus size={14} /> Add
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}