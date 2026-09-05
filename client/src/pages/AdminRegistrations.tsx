import { useCallback, useEffect, useState } from "react";
import { Check, X } from "lucide-react";

import { api } from "../api/client";
import { Modal, EmptyState } from "../components/ui";

type Registration = {
  id: string;
  email: string;
  fullName: string;
  status: string;
  createdAt: string;
  phone: string;
  profession: string;
  itsId: string;
  trainerId: string | null;
};

type UnlinkedTrainer = { id: string; name: string; email: string };

export default function AdminRegistrations() {
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [rows, setRows] = useState<Registration[] | null>(null);
  const [approving, setApproving] = useState<Registration | null>(null);
  const [rejecting, setRejecting] = useState<Registration | null>(null);
  const [reason, setReason] = useState("");
  const [unlinked, setUnlinked] = useState<UnlinkedTrainer[]>([]);
  const [linkedId, setLinkedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(() => {
    api
      .get<{ registrations: Registration[] }>(`/admin/registrations?filter=${tab}`)
      .then((d) => setRows(d.registrations))
      .catch(() => setRows([]));
  }, [tab]);

  useEffect(load, [load]);

  const openApprove = async (r: Registration) => {
    setApproving(r);
    setLinkedId("");
    setNotice("");
    const d = await api.get<{ trainers: UnlinkedTrainer[] }>("/admin/trainers?hasAccount=false");
    setUnlinked(d.trainers);
  };

  const doApprove = async () => {
    if (!approving) return;
    setBusy(true);
    setNotice("");
    try {
      const d = await api.post<{ trainerId: string }>(`/admin/registrations/${approving.id}/approve`, {
        ...(linkedId ? { linkedTrainerId: linkedId } : {}),
      });
      setNotice(`Approved and linked to ${d.trainerId ? "a trainer profile" : "a new profile"}. `);
      setApproving(null);
      load();
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doReject = async () => {
    if (!rejecting) return;
    setBusy(true);
    try {
      await api.post(`/admin/registrations/${rejecting.id}/reject`, { reason });
      setRejecting(null);
      setReason("");
      load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const tabs = [
    { id: "pending" as const, label: "Pending" },
    { id: "approved" as const, label: "Approved" },
    { id: "rejected" as const, label: "Rejected" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight mb-4">Trainer registrations</h1>

      <div className="flex gap-1 mb-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-md px-3 py-1.5 text-sm ${
              tab === t.id ? "bg-[#eee6d5] text-ink font-medium" : "text-sub hover:bg-[#f3edde]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {rows === null ? (
        <div className="min-h-[120px] text-sm text-muted">Loading…</div>
      ) : rows.length === 0 ? (
        <EmptyState>No {tab} registrations.</EmptyState>
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {rows.map((r) => (
            <div key={r.id} className="px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{r.fullName}</div>
                <div className="text-xs text-muted truncate">
                  {r.email} {r.phone && `· ${r.phone}`} {r.profession && `· ${r.profession}`} {r.itsId && `· ITS ${r.itsId}`}
                </div>
              </div>
              <div className="text-xs text-muted shrink-0">{new Date(r.createdAt).toLocaleDateString()}</div>
              {tab === "pending" ? (
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => openApprove(r)} className="inline-flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-xs text-white">
                    <Check size={14} /> Approve
                  </button>
                  <button onClick={() => setRejecting(r)} className="inline-flex items-center gap-1 rounded-md border border-line2 px-3 py-1.5 text-xs text-sub hover:bg-[#f2e3e0] hover:text-danger">
                    <X size={14} /> Reject
                  </button>
                </div>
              ) : (
                <span className={`text-xs ${r.status === "ACTIVE" ? "text-[#33623f]" : "text-danger"}`}>
                  {r.status === "ACTIVE" ? "Approved" : "Rejected"}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {approving && (
        <Modal title={`Approve ${approving.fullName}`} onClose={() => setApproving(null)}>
          <div className="space-y-3">
            <p className="text-sm text-muted">
              Link to an existing trainer profile if one of the imported records is the same person. Leave it blank to match by email
              automatically or create a new profile.
            </p>
            {unlinked.length > 0 ? (
              <select className="field" value={linkedId} onChange={(e) => setLinkedId(e.target.value)}>
                <option value="">— Auto-match by email or create new profile —</option>
                {unlinked.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.email ? `(${t.email})` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-muted">No unlinked trainer profiles available — a new profile will be created.</p>
            )}
            {notice && <p className={`text-sm ${notice.includes("failed") ? "text-danger" : "text-[#33623f]"}`}>{notice}</p>}
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setApproving(null)}>Cancel</button>
              <button className="btn-primary bg-accent" disabled={busy} onClick={doApprove}>Approve</button>
            </div>
          </div>
        </Modal>
      )}

      {rejecting && (
        <Modal title={`Reject ${rejecting.fullName}`} onClose={() => setRejecting(null)}>
          <div className="space-y-3">
            <label className="label">Reason (sent to the trainer, optional)</label>
            <textarea className="field" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setRejecting(null)}>Cancel</button>
              <button className="btn-primary bg-danger" disabled={busy} onClick={doReject}>Reject</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}