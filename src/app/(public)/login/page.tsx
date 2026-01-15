"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  // login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [logging, setLogging] = useState(false);

  // forgot request -> admin
  const [fpEmail, setFpEmail] = useState("");
  const [fpNote, setFpNote] = useState("");
  const [sending, setSending] = useState(false);

  // set new password by code
  const [rcEmail, setRcEmail] = useState("");
  const [rcCode, setRcCode] = useState("");
  const [rcPass1, setRcPass1] = useState("");
  const [rcPass2, setRcPass2] = useState("");
  const [resetting, setResetting] = useState(false);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLogging(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    });

    const json = await res.json().catch(() => null);
    setLogging(false);

    if (!res.ok) {
      alert(json?.error ?? "Login failed.");
      return;
    }

    // po prihlásení bežný user ide na /projects
    // admin layout sám presmeruje na /admin keď príde do user časti
    router.push("/projects");
  }

  async function requestForgot(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);

    await fetch("/api/auth/forgot-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: fpEmail.trim(), note: fpNote.trim() || null }),
    }).catch(() => null);

    setSending(false);
    alert("If the account exists, your request was sent to admin.");
    setFpNote("");
  }

  async function setPasswordWithCode(e: React.FormEvent) {
    e.preventDefault();

    if (rcPass1.length < 8) {
      alert("New password must be at least 8 characters.");
      return;
    }
    if (rcPass1 !== rcPass2) {
      alert("Passwords do not match.");
      return;
    }

    setResetting(true);

    const res = await fetch("/api/auth/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: rcEmail.trim(),
        reset_code: rcCode.trim(),
        new_password: rcPass1,
      }),
    });

    const json = await res.json().catch(() => null);
    setResetting(false);

    if (!res.ok) {
      alert(json?.error ?? "Reset failed.");
      return;
    }

    alert("Password updated. You can login now.");
    setRcCode("");
    setRcPass1("");
    setRcPass2("");
  }

  return (
    <main className="page p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Login</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="card p-4">
          <h2 className="text-lg font-medium mb-3">Login</h2>

          <form onSubmit={login} className="flex flex-col gap-3">
            <input
              className="form-input"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={logging}
            />
            <input
              className="form-input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={logging}
            />
            <button className="button-primary self-start" type="submit" disabled={logging}>
              {logging ? "Logging in..." : "Login"}
            </button>
          </form>

          <div className="mt-4 text-sm text-slate-400">
            <a className="underline" href="/register">
              Create account
            </a>
          </div>
        </section>

        <section className="card p-4">
          <h2 className="text-lg font-medium mb-3">Forgot password</h2>
          <p className="text-sm text-slate-400 mb-3">
            Send a request to admin. Admin will approve and give you a reset code.
          </p>

          <form onSubmit={requestForgot} className="flex flex-col gap-3 mb-6">
            <input
              className="form-input"
              placeholder="Email"
              value={fpEmail}
              onChange={(e) => setFpEmail(e.target.value)}
              disabled={sending}
            />
            <textarea
              className="form-textarea"
              placeholder="Optional note to admin…"
              value={fpNote}
              onChange={(e) => setFpNote(e.target.value)}
              disabled={sending}
            />
            <button className="button-secondary self-start" type="submit" disabled={sending}>
              {sending ? "Sending..." : "Send request"}
            </button>
          </form>

          <h3 className="text-base font-medium mb-2">Set new password (with admin code)</h3>

          <form onSubmit={setPasswordWithCode} className="flex flex-col gap-3">
            <input
              className="form-input"
              placeholder="Email"
              value={rcEmail}
              onChange={(e) => setRcEmail(e.target.value)}
              disabled={resetting}
            />
            <input
              className="form-input"
              placeholder="Reset code"
              value={rcCode}
              onChange={(e) => setRcCode(e.target.value)}
              disabled={resetting}
            />
            <input
              className="form-input"
              type="password"
              placeholder="New password (min 8)"
              value={rcPass1}
              onChange={(e) => setRcPass1(e.target.value)}
              disabled={resetting}
            />
            <input
              className="form-input"
              type="password"
              placeholder="Repeat new password"
              value={rcPass2}
              onChange={(e) => setRcPass2(e.target.value)}
              disabled={resetting}
            />
            <button className="button-primary self-start" type="submit" disabled={resetting}>
              {resetting ? "Saving..." : "Set password"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
