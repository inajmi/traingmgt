import { FormEvent, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";

import { api } from "../api/client";

export default function Register() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [profession, setProfession] = useState("");
  const [itsId, setItsId] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await api.post("/auth/register", { fullName, email, phone, profession, itsId, password });
      setDone(true);
    } catch (ex) {
      setErr((ex as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
        <div className="card p-8 max-w-sm w-full text-center bg-surface">
          <CheckCircle2 size={32} className="mx-auto text-accent mb-3" />
          <h1 className="text-lg font-semibold mb-2">Registration submitted</h1>
          <p className="text-sm text-muted mb-4">
            Your account is pending admin approval. You'll be able to sign in once an admin approves it.
          </p>
          <Link to="/login" className="text-accent font-medium text-sm">Back to sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <form onSubmit={submit} className="card p-6 space-y-3 bg-surface">
          <h1 className="text-lg font-semibold">Create a trainer account</h1>
          <p className="text-sm text-muted">An admin must approve your account before you can sign in.</p>
          <div>
            <label className="label">Full name</label>
            <input className="field" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Phone</label>
              <input className="field" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="label">Profession</label>
              <input className="field" value={profession} onChange={(e) => setProfession(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">ITS ID (optional)</label>
            <input className="field" value={itsId} onChange={(e) => setItsId(e.target.value)} />
          </div>
          <div>
            <label className="label">Password (min 8 characters)</label>
            <input type="password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {err && <p className="text-sm text-danger">{err}</p>}
          <button type="submit" disabled={busy} className="btn-primary bg-accent w-full justify-center mt-2">
            Submit for approval
          </button>
          <div className="text-center text-sm">
            <Link to="/login" className="text-accent font-medium">Already have an account? Sign in</Link>
          </div>
        </form>
      </div>
    </div>
  );
}