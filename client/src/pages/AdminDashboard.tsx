import { useCallback, useEffect, useState } from "react";
import { ClipboardList, CalendarPlus, MessageSquare, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { api } from "../api/client";
import { Spinner } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useUnread } from "../hooks/useUnread";

type Kpis = {
  total: number;
  completed: number;
  regular: number;
  volYes: number;
  notAvailable: number;
  pendingRegistrations: number;
  upcomingSessions: number;
};

export default function AdminDashboard() {
  const { logout } = useAuth();
  const { unread } = useUnread();
  const navigate = useNavigate();
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    api
      .get<Kpis>("/admin/kpis")
      .then(setKpis)
      .catch((e) => {
        setErr((e as Error).message);
        if ((e as Error).message.includes("logged in")) logout();
      });
  }, [logout]);

  useEffect(load, [load]);

  if (!kpis) return err ? <div className="text-sm text-danger">Failed to load: {err}</div> : <Spinner />;

  const cards = [
    { label: "Total trainers", value: kpis.total, to: "/admin/trainers" },
    { label: "Met / meeting status", value: kpis.completed, color: "#33623f", to: "/admin/trainers" },
    { label: "Available regularly", value: kpis.regular, color: "#2f6f4f", to: "/admin/trainers" },
    { label: "Volunteer (free)", value: kpis.volYes, color: "#3d5680", to: "/admin/trainers" },
    { label: "Not currently available", value: kpis.notAvailable, color: "#a8433a", to: "/admin/trainers" },
    { label: "Upcoming sessions", value: kpis.upcomingSessions, color: "#b8862f", to: "/admin/calendar" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-semibold tracking-tight">Admin overview</h1>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5">
        {cards.map((c) => (
          <button key={c.label} onClick={() => navigate(c.to)} className="card px-4 py-3 text-left hover:bg-surface">
            <div className="text-2xl font-semibold" style={{ color: c.color ?? "#333" }}>{c.value}</div>
            <div className="text-xs text-muted mt-0.5">{c.label}</div>
          </button>
        ))}
      </div>

      <div className="mt-8 grid sm:grid-cols-3 gap-3">
        <button
          onClick={() => navigate("/admin/registrations")}
          className="card p-4 flex items-center gap-3 text-left hover:bg-surface"
        >
          <ClipboardList className="text-accent" size={20} />
          <span className="text-sm font-medium">
            Pending registrations
            {kpis.pendingRegistrations > 0 && (
              <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger text-white text-[11px] px-1.5">
                {kpis.pendingRegistrations}
              </span>
            )}
          </span>
        </button>
        <button onClick={() => navigate("/admin/calendar")} className="card p-4 flex items-center gap-3 text-left hover:bg-surface">
          <CalendarPlus className="text-accent" size={20} />
          <span className="text-sm font-medium">Create / manage sessions</span>
        </button>
        <button onClick={() => navigate("/admin/inbox")} className="card p-4 flex items-center gap-3 text-left hover:bg-surface">
          <MessageSquare className="text-accent" size={20} />
          <span className="text-sm font-medium">Inbox {unread > 0 && `(${unread} unread)`}</span>
        </button>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-3">At a glance</h2>
        <div className="card p-5 text-sm text-[#4a4636] space-y-2">
          <div className="flex justify-between"><span>Trainers met (Completed):</span><span className="font-medium">{kpis.completed} / {kpis.total}</span></div>
          <div className="flex justify-between"><span>Willingness “Regularly”:</span><span className="font-medium">{kpis.regular}</span></div>
          <div className="flex justify-between"><span>Offer free training (Volunteer):</span><span className="font-medium">{kpis.volYes}</span></div>
          <div className="flex justify-between"><span>Checked “Not currently”:</span><span className="font-medium">{kpis.notAvailable}</span></div>
        </div>
      </div>
    </div>
  );
}