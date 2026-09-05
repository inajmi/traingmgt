import { useEffect, useState } from "react";
import { Save } from "lucide-react";

import { api } from "../api/client";
import { AVAIL_STATUSES, MONTHS, TrainerProfile } from "../api/types";
import { FieldGroup, FieldDef } from "../components/fields";
import { useUnread } from "../hooks/useUnread";

const PROFILE_FIELDS: FieldDef[] = [
  { key: "name", label: "Full name", type: "text" },
  { key: "phone", label: "Phone", type: "text" },
  { key: "itsId", label: "ITS ID", type: "text" },
  { key: "profession", label: "Profession", type: "text" },
  { key: "finalTopics", label: "Final topics comfortable delivering", type: "textarea" },
  { key: "preferredFormat", label: "Preferred format", type: "select", options: ["", "In-person", "Online", "Hybrid", "Flexible"] },
  { key: "preferredDays", label: "Preferred days", type: "select", options: ["", "Weekdays", "Weekends", "Both"] },
  { key: "preferredTime", label: "Preferred time", type: "select", options: ["", "Morning", "Afternoon", "Evening", "Flexible"] },
  { key: "maxSessions", label: "Max sessions / month", type: "number" },
  { key: "minNotice", label: "Minimum notice required", type: "select", options: ["", "3 days", "1 week", "2 weeks", "1 month"] },
  { key: "languages", label: "Languages comfortable in", type: "text" },
  { key: "constraints", label: "Constraints / support needed", type: "textarea" },
];

function AvailabilityEditor({ entries, onChange }: { entries: Record<string, string>; onChange: (m: string, v: string) => void }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {MONTHS.map((m) => (
        <div key={m}>
          <label className="block text-[11px] font-medium text-sub mb-1">{m}</label>
          <select
            value={entries[m] ?? ""}
            onChange={(e) => onChange(m, e.target.value)}
            className="w-full text-xs rounded-md border border-line2 px-2 py-1.5 bg-white"
          >
            {["", ...AVAIL_STATUSES].map((s) => (
              <option key={s || "none"} value={s}>{s === "" ? "—" : s}</option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

export default function Profile() {
  const { refresh: refreshUnread } = useUnread();
  const [profile, setProfile] = useState<TrainerProfile | null>(null);
  const [avail, setAvail] = useState<Record<string, string>>({});
  const [year, setYear] = useState(new Date().getFullYear());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const load = () => {
    api.get<{ trainer: TrainerProfile }>("/trainers/me")
      .then((d) => setProfile(d.trainer))
      .catch(() => setProfile(null));
    api.get<{ year: number; entries: { month: string; status: string }[] }>("/trainers/me/availability")
      .then((d) => {
        setYear(d.year);
        const map: Record<string, string> = {};
        d.entries.forEach((e) => (map[e.month] = e.status));
        setAvail(map);
      }) 
      .catch(() => {});
  };

  useEffect(load, []);

  if (!profile) return <div className="min-h-[200px] text-sm text-muted">Loading profile…</div>;

  const update = (key: string, val: string | number | null) => {
    setProfile((p) => (p ? { ...p, [key]: val } : p));
  };

  const saveProfile = async () => {
    setSaving(true);
    setMsg("");
    setErr("");
    setSaving(true);
    try {
      const patch: Record<string, unknown> = {};
      PROFILE_FIELDS.forEach((f) => {
        patch[f.key] = (profile as unknown as Record<string, unknown>)[f.key] ?? "";
      });
      await api.put("/trainers/me", patch);
      await api.put("/trainers/me/availability", { year, entries: MONTHS.map((m) => ({ month: m, status: avail[m] ?? "" })) });
      setMsg("Saved.");
      refreshUnread();
      setTimeout(() => setMsg(""), 2000);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const changePw = async () => {
    setPwErr("");
    setPwMsg("");
    if (newPw.length < 8) {
      setPwErr("New password must be at least 8 characters.");
      return;
    }
    if (newPw !== confirmPw) {
      setPwErr("Passwords do not match.");
      return;
    }
    setPwBusy(true);
    try {
      await api.post("/auth/change-password", { currentPassword: curPw, newPassword: newPw });
      setPwMsg("Password updated.");
      setCurPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (e) {
      setPwErr((e as Error).message);
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">My profile</h1>
        <button onClick={saveProfile} disabled={saving} className="btn-primary bg-accent">
          <Save size={14} /> Save changes
        </button>
      </div>
      {msg && <div className="mb-3 text-sm text-[#33623f]">{msg}</div>}
      {err && <div className="mb-3 text-sm text-danger">{err}</div>}

      <section className="card p-5 mb-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-3">Profile & preferences</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PROFILE_FIELDS.map((f) => (
            <FieldGroup key={f.key} field={f} value={(profile as unknown as Record<string, unknown>)[f.key]} onChange={update} span2={f.type === "textarea"} />
          ))}
        </div>
      </section>

      <section className="card p-5 mb-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">Monthly availability — {year}</h2>
        <p className="text-xs text-muted mb-3">Admins use this to plan the training calendar.</p>
        <AvailabilityEditor entries={avail} onChange={(m, v) => setAvail((a) => ({ ...a, [m]: v }))} />
      </section>

      {profile.surveyTopics || profile.surveyExpertise ? (
        <section className="card p-5 mb-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Survey reference (read-only)</h2>
          <div className="text-sm text-[#4a4636] space-y-2 bg-[#f1ecdd] rounded-lg p-3 border border-line">
            {profile.surveyExpertise && <div><span className="font-medium">Expertise:</span> {profile.surveyExpertise.split("\n").join(", ")}</div>}
            {profile.surveyTopics && <div><span className="font-medium">Proposed topics:</span> <span className="whitespace-pre-line">{profile.surveyTopics}</span></div>}
            {profile.surveyFormat && <div><span className="font-medium">Format:</span> {profile.surveyFormat.split("\n").join(", ")}</div>}
            {profile.surveyDayAvailability && <div><span className="font-medium">Day availability:</span> {profile.surveyDayAvailability}</div>}
          </div>
        </section>
      ) : null}

      <section className="card p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-3">Change password</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input type="password" className="field" placeholder="Current password" value={curPw} onChange={(e) => setCurPw(e.target.value)} />
          <input type="password" className="field" placeholder="New password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
          <input type="password" className="field" placeholder="Confirm new password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
        </div>
        {pwErr && <p className="text-sm text-danger mt-3">{pwErr}</p>}
        {pwMsg && <p className="text-sm text-[#33623f] mt-3">{pwMsg}</p>}
        <button onClick={changePw} disabled={pwBusy} className="btn-ghost mt-3">Update password</button>
      </section>
    </div>
  );
}