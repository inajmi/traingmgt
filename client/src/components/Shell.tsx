import { useState } from "react";
import { Inbox as InboxIcon, LogOut, ShieldCheck, KeyRound } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useUnread } from "../hooks/useUnread";

function ChangePasswordScreen() {
  const { refresh } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr("");
    setOk("");
    if (newPassword.length < 8) {
      setErr("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirm) {
      setErr("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await api.post("/auth/change-password", { currentPassword, newPassword });
      setOk("Password updated.");
      await refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16">
      <div className="card p-6">
        <div className="flex items-center gap-2 text-accent mb-2">
          <KeyRound size={18} />
          <h1 className="font-semibold">Set a new password</h1>
        </div>
        <p className="text-sm text-muted mb-4">An admin reset your password. Choose a new one to continue.</p>
        <div className="space-y-3">
          <div>
            <label className="label">Current (temporary) password</label>
            <input type="password" className="field" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div>
            <label className="label">New password</label>
            <input type="password" className="field" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div>
            <label className="label">Confirm new password</label>
            <input type="password" className="field" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
        </div>
        {err && <p className="text-sm text-danger mt-3">{err}</p>}
        {ok && <p className="text-sm text-[#33623f] mt-3">{ok}</p>}
        <button onClick={submit} disabled={busy} className="btn-primary bg-accent mt-4">
          Update password
        </button>
      </div>
    </div>
  );
}

function Shell() {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const { unread } = useUnread();
  const [confirmLogout, setConfirmLogout] = useState(false);

  if (!user) return null;
  if (user.mustChangePassword) return <ChangePasswordScreen />;

  const isAdmin = user.role === "admin";
  const nav = isAdmin
    ? [
        { to: "/admin", label: "Admin", end: true },
        ...(hasPermission("REGISTRATIONS_MANAGE") ? [{ to: "/admin/registrations", label: "Registrations" }] : []),
        ...(hasPermission("TRAINERS_MANAGE") ? [{ to: "/admin/trainers", label: "Trainers" }] : []),
        ...(hasPermission("SESSIONS_MANAGE") ? [{ to: "/admin/calendar", label: "Calendar" }] : []),
        { to: "/admin/inbox", label: "Inbox", badge: unread },
        ...(hasPermission("USERS_MANAGE") ? [{ to: "/admin/users", label: "Users" }] : []),
        ...(hasPermission("ROLES_MANAGE") ? [{ to: "/admin/roles", label: "Roles" }] : []),
        ...(hasPermission("SETTINGS_MANAGE") ? [{ to: "/admin/settings", label: "Settings" }] : []),
      ]
    : [
        { to: "/", label: "Dashboard", end: true },
        { to: "/profile", label: "My Profile" },
        { to: "/calendar", label: "Calendar" },
        { to: "/sessions", label: "My Sessions" },
        { to: "/inbox", label: "Inbox", badge: unread },
      ];

  const doLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-surface border-b border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3">
          <div className="font-semibold text-lg tracking-tight flex items-center gap-2">
            <ShieldCheck size={18} className="text-accent" />
            Trainer Tracker
          </div>
          <nav className="flex items-center gap-1 flex-wrap">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm ${
                    isActive ? "bg-[#eee6d5] text-ink font-medium" : "text-sub hover:bg-[#f3edde]"
                  }`
                }
              >
                {n.label === "Inbox" && <InboxIcon size={15} />}
                {n.label}
                {n.badge ? (
                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-danger text-white text-[10px] px-1">
                    {n.badge}
                  </span>
                ) : null}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-muted">{user.fullName}</span>
            {!confirmLogout ? (
              <button onClick={() => setConfirmLogout(true)} className="btn-ghost" title="Log out">
                <LogOut size={14} /> Log out
              </button>
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-sub">Log out?</span>
                <button onClick={doLogout} className="text-danger font-medium">Yes</button>
                <button onClick={() => setConfirmLogout(false)} className="text-sub">No</button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}

export default Shell;