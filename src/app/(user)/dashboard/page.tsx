"use client";

import { useEffect, useState } from "react";

type Artifact = {
  id: string;
  kind: string;
  filename: string;
  created_at: string;
  project_id: string;
  project_name?: string;
  created_by_email?: string;
};

export default function DashboardPage() {
  const [items, setItems] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);

  // change password
  const [oldPass, setOldPass] = useState("");
  const [newPass1, setNewPass1] = useState("");
  const [newPass2, setNewPass2] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadArtifacts() {
    setLoading(true);
    const res = await fetch("/api/generated");
    const json = await res.json().catch(() => null);

    if (!res.ok) {
      console.error("Failed to load artifacts:", json);
      setItems([]);
      setLoading(false);
      return;
    }

    setItems(Array.isArray(json) ? json : []);
    setLoading(false);
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();

    if (!oldPass) return alert("Old password is required.");
    if (!newPass1) return alert("New password is required.");
    if (newPass1.length < 6) return alert("New password must be at least 6 characters.");
    if (newPass1 !== newPass2) return alert("New passwords do not match.");

    setSaving(true);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ old_password: oldPass, new_password: newPass1 }),
    });

    const json = await res.json().catch(() => null);
    setSaving(false);

    if (!res.ok) {
      alert(json?.error ?? "Change password failed.");
      return;
    }

    setOldPass("");
    setNewPass1("");
    setNewPass2("");
    alert("Password changed.");
  }

  useEffect(() => {
    void loadArtifacts();
  }, []);

  return (
    <main className="page p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <a className="button-secondary" href="/projects">
          Projects
        </a>
      </div>

      <section className="card mb-8 p-4">
        <h2 className="text-lg font-medium mb-3">Change password</h2>

        <form onSubmit={changePassword} className="flex flex-col gap-3 max-w-lg">
          <input
            className="form-input"
            type="password"
            placeholder="Old password"
            value={oldPass}
            onChange={(e) => setOldPass(e.target.value)}
            disabled={saving}
          />
          <input
            className="form-input"
            type="password"
            placeholder="New password (min 6)"
            value={newPass1}
            onChange={(e) => setNewPass1(e.target.value)}
            disabled={saving}
          />
          <input
            className="form-input"
            type="password"
            placeholder="Repeat new password"
            value={newPass2}
            onChange={(e) => setNewPass2(e.target.value)}
            disabled={saving}
          />
          <button className="button-primary self-start" type="submit" disabled={saving}>
            {saving ? "Saving..." : "Update password"}
          </button>
        </form>
      </section>

      <section className="card p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h2 className="text-lg font-medium">Generated files (download)</h2>
          <button className="button-secondary" onClick={() => loadArtifacts()} disabled={loading}>
            Refresh
          </button>
        </div>

        {loading && <p className="text-slate-400">Loading…</p>}
        {!loading && items.length === 0 && <p className="text-slate-400">No generated files.</p>}

        {!loading && items.length > 0 && (
          <ul className="space-y-3">
            {items.map((it) => (
              <li key={it.id} className="bg-slate-900 rounded px-4 py-3">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <div className="font-medium">{it.filename}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {it.kind} • {new Date(it.created_at).toLocaleString()}
                      {it.project_name ? ` • ${it.project_name}` : ""}
                    </div>
                  </div>

                  <a className="button-secondary" href={`/api/generated/${it.id}`}>
                    Download
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
