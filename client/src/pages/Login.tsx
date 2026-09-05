import { FormEvent, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Modal } from "../components/ui";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMsg, setForgotMsg] = useState("");
  const [forgotErr, setForgotErr] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const user = await login(email, password);
      navigate(user.role === "admin" ? "/admin" : "/", { replace: true });
    } catch (ex) {
      setErr((ex as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doForgot = async () => {
    setForgotErr("");
    setForgotMsg("");
    try {
      await api.post("/auth/request-reset", { email: forgotEmail });
      setForgotMsg("If the account exists, an admin has been notified to reset it.");
    } catch (ex) {
      setForgotErr((ex as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 text-accent">
            <ShieldCheck size={22} />
            <h1 className="text-xl font-semibold tracking-tight">Trainer Tracker</h1>
          </div>
        </div>
        <form onSubmit={submit} className="card p-6 space-y-4 bg-surface">
          <h2 className="text-lg font-semibold">Sign in</h2>
          <div>
            <label className="label">Email</label>
            <input type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {err && <p className="text-sm text-danger">{err}</p>}
          <button type="submit" disabled={busy} className="btn-primary bg-accent w-full justify-center">
            Sign in
          </button>
          <div className="flex items-center justify-between text-sm">
            <button type="button" className="text-sub hover:text-ink" onClick={() => setForgot(true)}>
              Forgot password?
            </button>
            <Link to="/register" className="text-accent font-medium">Create account</Link>
          </div>
        </form>
      </div>

      {forgot && (
        <Modal title="Reset password" onClose={() => setForgot(false)}>
          <p className="text-sm text-muted mb-3">
            Enter your email and an admin will be notified. They will set a temporary password for you.
          </p>
          <input type="email" className="field" placeholder="you@example.com" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} />
          {forgotErr && <p className="text-sm text-danger mt-3">{forgotErr}</p>}
          {forgotMsg && <p className="text-sm text-[#33623f] mt-3">{forgotMsg}</p>}
          <div className="flex justify-end gap-2 mt-4">
            <button className="btn-ghost" onClick={() => setForgot(false)}>Cancel</button>
            <button className="btn-primary bg-accent" onClick={doForgot}>Notify admin</button>
          </div>
        </Modal>
      )}
    </div>
  );
}