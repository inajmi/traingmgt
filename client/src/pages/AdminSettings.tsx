import { useEffect, useState } from "react";
import { Save, Send } from "lucide-react";

import { api } from "../api/client";
import { SystemSettings } from "../api/types";
import { InlineNotice, SectionTitle, Spinner } from "../components/ui";

const PROVIDER_PRESETS: { key: string; label: string; host: string; port: number; secure: boolean; hint: string }[] = [
  {
    key: "gmail",
    label: "Gmail",
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    hint: "Use a 16-character Gmail App Password, not the regular account password — Google Account → Security → App passwords (requires 2-Step Verification to be turned on).",
  },
  {
    key: "outlook",
    label: "Outlook / Hotmail",
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    hint: "Use an app password if the account has 2-step verification enabled — account.microsoft.com → Security → Advanced security options.",
  },
];

const TIMEOUT_OPTIONS = [
  { label: "30 minutes", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "8 hours", minutes: 60 * 8 },
  { label: "24 hours", minutes: 60 * 24 },
  { label: "7 days", minutes: 60 * 24 * 7 },
  { label: "30 days", minutes: 60 * 24 * 30 },
];

export default function AdminSettings() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [smtpPass, setSmtpPass] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [testTo, setTestTo] = useState("");
  const [testBusy, setTestBusy] = useState(false);
  const [testNotice, setTestNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [presetHint, setPresetHint] = useState("");

  const load = () => {
    api.get<{ settings: SystemSettings }>("/admin/settings").then((d) => setSettings(d.settings));
  };

  useEffect(load, []);

  if (!settings) return <Spinner />;

  const set = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) =>
    setSettings({ ...settings, [key]: value });

  const isCustomTimeout = !TIMEOUT_OPTIONS.some((o) => o.minutes === settings.sessionTimeoutMinutes);

  const applyPreset = (p: (typeof PROVIDER_PRESETS)[number]) => {
    setSettings({ ...settings, smtpHost: p.host, smtpPort: p.port, smtpSecure: p.secure });
    setPresetHint(p.hint);
  };

  const save = async () => {
    setSaving(true);
    setNotice(null);
    try {
      const d = await api.put<{ settings: SystemSettings }>("/admin/settings", {
        smtpHost: settings.smtpHost,
        smtpPort: settings.smtpPort,
        smtpSecure: settings.smtpSecure,
        smtpUser: settings.smtpUser,
        smtpFrom: settings.smtpFrom,
        sessionTimeoutMinutes: settings.sessionTimeoutMinutes,
        ...(smtpPass ? { smtpPass } : {}),
      });
      setSettings(d.settings);
      setSmtpPass("");
      setNotice({ kind: "ok", text: "Settings saved." });
    } catch (e) {
      setNotice({ kind: "err", text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setTestBusy(true);
    setTestNotice(null);
    try {
      await api.post("/admin/settings/test-email", { to: testTo });
      setTestNotice({ kind: "ok", text: `Test email sent to ${testTo}.` });
    } catch (e) {
      setTestNotice({ kind: "err", text: (e as Error).message });
    } finally {
      setTestBusy(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight mb-1">System settings</h1>
      <p className="text-sm text-muted mb-6">Configure the outgoing email server and how long a sign-in stays active.</p>

      <div className="card p-5 mb-6">
        <SectionTitle>Email server (SMTP)</SectionTitle>
        <p className="text-xs text-muted mb-4">
          Leave the host blank to keep running on in-app messaging only — email notifications are optional.
        </p>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted mr-1">Quick setup:</span>
          {PROVIDER_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => applyPreset(p)}
              className="rounded-md px-3 py-1.5 text-sm border border-line2 text-sub hover:bg-[#f3edde]"
            >
              {p.label}
            </button>
          ))}
        </div>
        {presetHint && <div className="mb-4"><InlineNotice kind="info">{presetHint}</InlineNotice></div>}

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="label">SMTP host</label>
            <input className="field" value={settings.smtpHost} placeholder="smtp.example.com" onChange={(e) => set("smtpHost", e.target.value)} />
          </div>
          <div>
            <label className="label">Port</label>
            <input
              type="number"
              className="field"
              value={settings.smtpPort}
              onChange={(e) => set("smtpPort", Number(e.target.value) || 587)}
            />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={settings.smtpSecure} onChange={(e) => set("smtpSecure", e.target.checked)} />
              Use TLS (port 465)
            </label>
          </div>
          <div>
            <label className="label">SMTP username</label>
            <input className="field" value={settings.smtpUser} onChange={(e) => set("smtpUser", e.target.value)} />
          </div>
          <div>
            <label className="label">SMTP password {settings.smtpPassSet && <span className="text-muted font-normal">(currently set)</span>}</label>
            <input
              type="password"
              className="field"
              value={smtpPass}
              placeholder={settings.smtpPassSet ? "Leave blank to keep current password" : ""}
              onChange={(e) => setSmtpPass(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">"From" address</label>
            <input className="field" value={settings.smtpFrom} onChange={(e) => set("smtpFrom", e.target.value)} />
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-line flex flex-wrap items-center gap-2">
          <input
            type="email"
            placeholder="you@example.com"
            className="field max-w-xs"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
          />
          <button className="btn-ghost" disabled={testBusy || !testTo} onClick={sendTest}>
            <Send size={14} /> Send test email
          </button>
        </div>
        {testNotice && <div className="mt-2"><InlineNotice kind={testNotice.kind === "ok" ? "ok" : "err"}>{testNotice.text}</InlineNotice></div>}
      </div>

      <div className="card p-5 mb-6">
        <SectionTitle>Sign-in session timeout</SectionTitle>
        <p className="text-xs text-muted mb-4">How long someone stays signed in before they need to log in again.</p>
        <div className="flex flex-wrap gap-2">
          {TIMEOUT_OPTIONS.map((o) => (
            <button
              key={o.minutes}
              onClick={() => set("sessionTimeoutMinutes", o.minutes)}
              className={`rounded-md px-3 py-1.5 text-sm border ${
                settings.sessionTimeoutMinutes === o.minutes ? "bg-[#eee6d5] border-line2 font-medium" : "border-line2 text-sub hover:bg-[#f3edde]"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <label className="label">Custom (minutes)</label>
          <input
            type="number"
            min={5}
            className={`field max-w-[160px] ${isCustomTimeout ? "" : "text-muted"}`}
            value={settings.sessionTimeoutMinutes}
            onChange={(e) => set("sessionTimeoutMinutes", Number(e.target.value) || 5)}
          />
        </div>
      </div>

      {notice && <div className="mb-4"><InlineNotice kind={notice.kind === "ok" ? "ok" : "err"}>{notice.text}</InlineNotice></div>}
      <button className="btn-primary bg-accent" disabled={saving} onClick={save}>
        <Save size={14} /> Save settings
      </button>
    </div>
  );
}
