"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter(); //router pre navigaciu medzi strankami po uspechu /projects

  // login hodnoty inputov
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

  //klient validacia emailu
  function isValidEmail(v: string) {
    const s = v.trim();
    return s.length >= 3 && s.includes("@") && s.includes(".");
  }

  //handler pre login
  async function login(e: React.FormEvent) {
    e.preventDefault();//zakaze reload stranky

    //klient side validacia formulara
    const e2 = email.trim();
    if (!e2) return alert("Email is required.");
    if (!isValidEmail(e2)) return alert("Email is invalid.");
    if (!password) return alert("Password is required.");
    if (password.length < 6) return alert("Password must be at least 6 characters.");

    setLogging(true);//zacina login

    //posle data na server email, heslo
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: e2, password }),
    });

    //spracuje odpoved zo servera
    const json = await res.json().catch(() => null);
    setLogging(false);

    //ak login neprebehne uspesne, zobrazi chybu
    if (!res.ok) {
      alert(json?.error ?? "Login failed.");
      return;
    }
    //uspesny login - presmeruje na /projects
    router.push("/projects");
  }

  //handler pre forgot password request
  async function requestForgot(e: React.FormEvent) {
    e.preventDefault();

    //klient side validacia formulara
    const e2 = fpEmail.trim();
    if (!e2) return alert("Email is required.");
    if (!isValidEmail(e2)) return alert("Email is invalid.");

    setSending(true);

    //posle poziadavku na server
    await fetch("/api/auth/forgot-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: e2, note: fpNote.trim() || null }),
    }).catch(() => null);//chyby sa riesia na serveri, klientovi je jedno

    setSending(false);
    alert("If the account exists, your request was sent to admin.");//zobrazi spravu
    setFpNote("");//vycisti formular
  }

  //handler pre set new password with code
  async function setPasswordWithCode(e: React.FormEvent) {
    e.preventDefault();

    const e2 = rcEmail.trim();//email
    const c2 = rcCode.trim();//reset kod

    //klient side validacia formulara
    if (!e2) return alert("Email is required.");
    if (!isValidEmail(e2)) return alert("Email is invalid.");
    if (!c2) return alert("Reset code is required.");

    if (!rcPass1) return alert("New password is required.");
    if (rcPass1.length < 6) return alert("New password must be at least 6 characters.");
    if (rcPass1 !== rcPass2) return alert("Passwords do not match.");

    setResetting(true);

    //posle poziadavku na server s emailom, kodom a novym heslom
    const res = await fetch("/api/auth/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: e2,
        reset_code: c2,
        new_password: rcPass1,
      }),
    });

    //spracuje odpoved zo servera
    const json = await res.json().catch(() => null);
    setResetting(false);

    //ak neuspesne, zobrazi chybu
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
              placeholder="Password (min 6)"
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
              placeholder="New password (min 6)"
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
