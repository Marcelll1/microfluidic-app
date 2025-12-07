"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function validateForm(): string | null {
    const e = email.trim();
    const p = password.trim();
    const pc = passwordConfirm.trim();

    if (!e) return "Email is required.";
    if (!e.includes("@")) return "Email must contain @.";
    if (!p) return "Password is required.";
    if (p.length < 6) return "Password must be at least 6 characters long.";
    if (p !== pc) return "Passwords do not match.";

    return null;
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const validation = validateForm();
    if (validation) {
      setError(validation);
      return;
    }

    setLoading(true);

    const { data, error: supaError } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);

    if (supaError) {
      setError(supaError.message);
      return;
    }

    setSuccess("Registration successful! Redirecting to login...");
    setTimeout(() => router.push("/login"), 1500);
  }

  return (
    <main className="page flex flex-col items-center justify-center h-screen">
      <section className="card card--form w-full max-w-md">
        <h1 className="text-xl font-semibold mb-4">Register</h1>

        <form onSubmit={handleRegister} className="form-grid">

          <div className="form-field">
            <label className="form-field-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
              placeholder="your@email.com"
            />
          </div>

          <div className="form-field">
            <label className="form-field-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
              placeholder="********"
            />
          </div>

          <div className="form-field">
            <label className="form-field-label" htmlFor="passwordConfirm">
              Confirm Password
            </label>
            <input
              id="passwordConfirm"
              type="password"
              required
              minLength={6}
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className="form-input"
              placeholder="********"
            />
          </div>

          {error && <p className="form-error">{error}</p>}
          {success && <p className="form-success">{success}</p>}

          <button type="submit" disabled={loading} className="button-primary mt-1">
            {loading ? "Registering..." : "Register"}
          </button>
        </form>
      </section>
    </main>
  );
}
