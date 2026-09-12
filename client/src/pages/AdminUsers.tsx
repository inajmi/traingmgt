import { useEffect, useState } from "react";
import { KeyRound, Plus, ShieldBan, ShieldCheck, UserPlus } from "lucide-react";

import { api } from "../api/client";
import { AccessRoleSummary, StaffUser } from "../api/types";
import { EmptyState, InlineNotice, Modal, Pill, Spinner } from "../components/ui";

type NewUserForm = {
  fullName: string;
  email: string;
  role: "ADMIN" | "TRAINER";
  accessRoleId: string;
  phone: string;
  profession: string;
  itsId: string;
};

const EMPTY_FORM: NewUserForm = { fullName: "", email: "", role: "TRAINER", accessRoleId: "", phone: "", profession: "", itsId: "" };

const STATUS_COLOR: Record<string, string> = {
  active: "text-[#33623f]",
  pending: "text-[#b8862f]",
  disabled: "text-danger",
  rejected: "text-danger",
};

export default function AdminUsers() {
  const [users, setUsers] = useState<StaffUser[] | null>(null);
  const [roles, setRoles] = useState<AccessRoleSummary[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<NewUserForm>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState("");
  const [tempPassword, setTempPassword] = useState<{ email: string; password: string; emailWarning?: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowMsg, setRowMsg] = useState<{ id: string; text: string } | null>(null);

  const load = () => {
    api.get<{ users: StaffUser[] }>("/admin/users").then((d) => setUsers(d.users));
    api.get<{ roles: AccessRoleSummary[] }>("/admin/roles").then((d) => setRoles(d.roles));
  };

  useEffect(load, []);

  const openAdd = () => {
    setCreateErr("");
    setForm(EMPTY_FORM);
    setAddOpen(true);
  };

  const submitAdd = async () => {
    setCreating(true);
    setCreateErr("");
    try {
      const d = await api.post<{ tempPassword: string; emailWarning?: string }>("/admin/users", {
        fullName: form.fullName,
        email: form.email,
        role: form.role,
        ...(form.role === "ADMIN" && form.accessRoleId ? { accessRoleId: form.accessRoleId } : {}),
        phone: form.phone,
        profession: form.profession,
        itsId: form.itsId,
      });
      setAddOpen(false);
      setTempPassword({ email: form.email, password: d.tempPassword, emailWarning: d.emailWarning });
      load();
    } catch (e) {
      setCreateErr((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const changeAccessRole = async (u: StaffUser, accessRoleId: string) => {
    setBusyId(u.id);
    try {
      await api.put(`/admin/users/${u.id}/access-role`, { accessRoleId: accessRoleId || null });
      load();
    } catch (e) {
      setRowMsg({ id: u.id, text: (e as Error).message });
    } finally {
      setBusyId(null);
    }
  };

  const act = async (u: StaffUser, kind: "reset" | "disable" | "enable") => {
    setBusyId(u.id);
    setRowMsg(null);
    try {
      if (kind === "reset") {
        const d = await api.post<{ tempPassword: string; emailWarning?: string }>(`/admin/users/${u.id}/reset-password`);
        setTempPassword({ email: u.email, password: d.tempPassword, emailWarning: d.emailWarning });
      } else {
        await api.post(`/admin/users/${u.id}/${kind}`);
      }
      load();
    } catch (e) {
      setRowMsg({ id: u.id, text: (e as Error).message });
    } finally {
      setBusyId(null);
    }
  };

  if (!users) return <Spinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted">Every sign-in account — admin-side and trainer.</p>
        </div>
        <button className="btn-primary bg-accent" onClick={openAdd}>
          <UserPlus size={14} /> Add user
        </button>
      </div>

      {users.length === 0 ? (
        <EmptyState>No users yet.</EmptyState>
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {users.map((u) => (
            <div key={u.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[180px]">
                <div className="font-medium text-sm flex items-center gap-2">
                  {u.fullName}
                  <Pill bg={u.role === "admin" ? "#e4e9f2" : "#eee9dd"} fg={u.role === "admin" ? "#3d5680" : "#6b6355"}>
                    {u.role === "admin" ? "Admin" : "Trainer"}
                  </Pill>
                </div>
                <div className="text-xs text-muted truncate">{u.email}</div>
              </div>
              <div className={`text-xs w-20 shrink-0 ${STATUS_COLOR[u.status] ?? "text-muted"}`}>
                {u.status.charAt(0).toUpperCase() + u.status.slice(1)}
              </div>
              {u.role === "admin" ? (
                <select
                  className="field w-auto text-xs py-1.5 shrink-0"
                  disabled={busyId === u.id}
                  value={u.accessRole?.id ?? ""}
                  onChange={(e) => changeAccessRole(u, e.target.value)}
                >
                  <option value="">No role (full access)</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              ) : (
                <div className="w-32 shrink-0" />
              )}
              <div className="flex items-center gap-1 shrink-0">
                <button className="btn-ghost" disabled={busyId === u.id} onClick={() => act(u, "reset")} title="Reset password">
                  <KeyRound size={13} />
                </button>
                {u.status === "disabled" ? (
                  <button className="btn-ghost" disabled={busyId === u.id} onClick={() => act(u, "enable")} title="Enable">
                    <ShieldCheck size={13} />
                  </button>
                ) : (
                  <button className="btn-ghost" disabled={busyId === u.id} onClick={() => act(u, "disable")} title="Disable">
                    <ShieldBan size={13} />
                  </button>
                )}
              </div>
              {rowMsg?.id === u.id && (
                <div className="w-full"><InlineNotice kind="err">{rowMsg.text}</InlineNotice></div>
              )}
            </div>
          ))}
        </div>
      )}

      {addOpen && (
        <Modal title="Add user" onClose={() => setAddOpen(false)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Full name *</label>
                <input className="field" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              </div>
              <div>
                <label className="label">Email *</label>
                <input className="field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Account type</label>
                <select className="field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "ADMIN" | "TRAINER" })}>
                  <option value="TRAINER">Trainer</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              {form.role === "ADMIN" && (
                <div>
                  <label className="label">Role</label>
                  <select className="field" value={form.accessRoleId} onChange={(e) => setForm({ ...form, accessRoleId: e.target.value })}>
                    <option value="">Administrator (default)</option>
                    {roles.filter((r) => r.name !== "Administrator").map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Phone</label>
                <input className="field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <label className="label">ITS ID</label>
                <input className="field" value={form.itsId} onChange={(e) => setForm({ ...form, itsId: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label">Profession</label>
              <input className="field" value={form.profession} onChange={(e) => setForm({ ...form, profession: e.target.value })} />
            </div>
            {createErr && <InlineNotice kind="err">{createErr}</InlineNotice>}
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-ghost" onClick={() => setAddOpen(false)}>Cancel</button>
              <button className="btn-primary bg-accent" disabled={creating || !form.fullName.trim() || !form.email.trim()} onClick={submitAdd}>
                <Plus size={14} /> Create account
              </button>
            </div>
          </div>
        </Modal>
      )}

      {tempPassword && (
        <Modal title="Account created" onClose={() => setTempPassword(null)}>
          <div className="space-y-3">
            <p className="text-sm text-muted">
              Temporary password for <span className="font-medium text-ink">{tempPassword.email}</span> (shown once
              {tempPassword.emailWarning ? "" : " — it was also emailed to them"}):
            </p>
            <div className="rounded-lg bg-[#f1ecdd] border border-line p-3 text-sm">
              <code className="text-accent font-semibold">{tempPassword.password}</code>
              <div className="text-xs text-muted mt-1">They must change it on next sign-in.</div>
            </div>
            {tempPassword.emailWarning && <InlineNotice kind="err">{tempPassword.emailWarning} Share this password with them directly.</InlineNotice>}
            <div className="flex justify-end">
              <button className="btn-primary bg-accent" onClick={() => setTempPassword(null)}>Done</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
