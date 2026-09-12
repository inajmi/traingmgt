import { useEffect, useState } from "react";
import { Plus, ShieldCheck, Trash2 } from "lucide-react";

import { api } from "../api/client";
import { AccessRoleFull, PermissionDef, PermissionKey } from "../api/types";
import { EmptyState, InlineNotice, Modal, Pill, Spinner } from "../components/ui";

type RoleForm = { id: string | null; name: string; permissions: Set<PermissionKey> };

const EMPTY_FORM: RoleForm = { id: null, name: "", permissions: new Set() };

export default function AdminRoles() {
  const [roles, setRoles] = useState<AccessRoleFull[] | null>(null);
  const [catalog, setCatalog] = useState<PermissionDef[]>([]);
  const [form, setForm] = useState<RoleForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [deleting, setDeleting] = useState<AccessRoleFull | null>(null);
  const [deleteErr, setDeleteErr] = useState("");

  const load = () => {
    api.get<{ roles: AccessRoleFull[]; catalog: PermissionDef[] }>("/admin/roles").then((d) => {
      setRoles(d.roles);
      setCatalog(d.catalog);
    });
  };

  useEffect(load, []);

  const openCreate = () => {
    setErr("");
    setForm({ ...EMPTY_FORM, permissions: new Set() });
  };

  const openEdit = (r: AccessRoleFull) => {
    setErr("");
    setForm({ id: r.id, name: r.name, permissions: new Set(r.permissions) });
  };

  const togglePermission = (key: PermissionKey) => {
    if (!form) return;
    const next = new Set(form.permissions);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setForm({ ...form, permissions: next });
  };

  const submit = async () => {
    if (!form) return;
    setBusy(true);
    setErr("");
    try {
      const body = { name: form.name, permissions: [...form.permissions] };
      if (form.id) await api.put(`/admin/roles/${form.id}`, body);
      else await api.post("/admin/roles", body);
      setForm(null);
      load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    setDeleteErr("");
    try {
      await api.del(`/admin/roles/${deleting.id}`);
      setDeleting(null);
      load();
    } catch (e) {
      setDeleteErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!roles) return <Spinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Roles & permissions</h1>
          <p className="text-sm text-muted">Define what each admin-side user is allowed to do.</p>
        </div>
        <button className="btn-primary bg-accent" onClick={openCreate}>
          <Plus size={14} /> New role
        </button>
      </div>

      {roles.length === 0 ? (
        <EmptyState>No roles yet.</EmptyState>
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {roles.map((r) => (
            <div key={r.id} className="px-4 py-3 flex items-center gap-3">
              <ShieldCheck size={16} className="text-accent shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm flex items-center gap-2">
                  {r.name}
                  {r.isSystem && <Pill bg="#e4e9f2" fg="#3d5680">Built-in</Pill>}
                </div>
                <div className="text-xs text-muted truncate">
                  {r.permissions.length === 0 ? "No permissions" : r.permissions.map((p) => catalog.find((c) => c.key === p)?.label ?? p).join(", ")}
                </div>
              </div>
              <div className="text-xs text-muted shrink-0">{r.userCount} user{r.userCount === 1 ? "" : "s"}</div>
              {!r.isSystem && (
                <div className="flex items-center gap-2 shrink-0">
                  <button className="btn-ghost" onClick={() => openEdit(r)}>Edit</button>
                  <button
                    className="p-1.5 rounded-md hover:bg-[#f2e3e0] text-sub hover:text-danger"
                    title="Delete role"
                    onClick={() => {
                      setDeleteErr("");
                      setDeleting(r);
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {form && (
        <Modal title={form.id ? "Edit role" : "New role"} onClose={() => setForm(null)}>
          <div className="space-y-4">
            <div>
              <label className="label">Role name</label>
              <input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Permissions</label>
              <div className="space-y-2">
                {catalog.map((p) => (
                  <label key={p.key} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={form.permissions.has(p.key)}
                      onChange={() => togglePermission(p.key)}
                    />
                    <span>
                      <span className="font-medium">{p.label}</span>
                      <span className="block text-xs text-muted">{p.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            {err && <InlineNotice kind="err">{err}</InlineNotice>}
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setForm(null)}>Cancel</button>
              <button className="btn-primary bg-accent" disabled={busy || !form.name.trim()} onClick={submit}>
                {form.id ? "Save" : "Create role"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleting && (
        <Modal title={`Delete "${deleting.name}"?`} onClose={() => setDeleting(null)}>
          <div className="space-y-3">
            <p className="text-sm text-muted">This can't be undone. Users on this role must be reassigned first.</p>
            {deleteErr && <InlineNotice kind="err">{deleteErr}</InlineNotice>}
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setDeleting(null)}>Cancel</button>
              <button className="btn-primary bg-danger" disabled={busy} onClick={doDelete}>Delete</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
