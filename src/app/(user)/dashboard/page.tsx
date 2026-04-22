"use client";

import { useEffect, useState } from "react";

//Typ projektu
type Project = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  thumbnail?: string | null;
};

//Typ artifactu z GET /api/generated
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
  const [lastProject, setLastProject] = useState<Project | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);

  // Multi-select status pre artefakty
  const [selectedArtifacts, setSelectedArtifacts] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState(false);

  // change password
  const [oldPass, setOldPass] = useState(""); //stare heslo
  const [newPass1, setNewPass1] = useState("");//nove heslo
  const [newPass2, setNewPass2] = useState("");//nove heslo potvrdenie
  const [saving, setSaving] = useState(false);//ci sa heslo aktualizuje

  async function loadDashboardData() {
    setLoading(true);
    setSelectedArtifacts(new Set()); // zmazat vyber pri nahrati db

    try {
      // 1. Ziskaj projekty
      const pRes = await fetch("/api/projects");
      const pJson = await pRes.json().catch(() => null);

      if (!pRes.ok) {
        throw new Error(pJson?.error ?? "Failed to load projects");
      }

      const projects = Array.isArray(pJson) ? pJson : [];
      if (projects.length === 0) {
        setLastProject(null);
        setArtifacts([]);
        return;
      }

      // 2. Najnovsi projekt je prvy (API by ho malo vracat podla created_at desc)
      const latest = projects[0];
      setLastProject(latest);

      // 3. Ziskaj artefakty a vyfiltruj iba tie pre najnovsi projekt
      const aRes = await fetch("/api/generated");
      const aJson = await aRes.json().catch(() => null);

      if (aRes.ok && Array.isArray(aJson)) {
        setArtifacts(aJson.filter((x: Artifact) => x.project_id === latest.id));
      } else {
        setArtifacts([]);
      }
    } catch (e: any) {
      console.error(e);
      setLastProject(null);
      setArtifacts([]);
    } finally {
      setLoading(false);
    }
  }

  //handler pre zmenu hesla
  async function changePassword(e: React.FormEvent) {
    e.preventDefault(); //zakaze reload stranky

    //client-side validacia formulara
    if (!oldPass) return alert("Old password is required.");
    if (!newPass1) return alert("New password is required.");
    if (newPass1.length < 6) return alert("New password must be at least 6 characters.");
    if (newPass1 !== newPass2) return alert("New passwords do not match.");

    setSaving(true);//zacina save
    const res = await fetch("/api/auth/change-password", {//posle POST poziadavku na zmenu hesla
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ old_password: oldPass, new_password: newPass1 }),//posle stare a nove heslo
    });

    const json = await res.json().catch(() => null);//parsuje JSON
    setSaving(false);//konci save

    //ak nie je OK, zobrazi chybu
    if (!res.ok) {
      alert(json?.error ?? "Change password failed.");
      return;
    }

    //uspesne zmenene heslo - vycisti formular a zobrazi spravu
    setOldPass("");
    setNewPass1("");
    setNewPass2("");
    alert("Password changed.");
  }

  useEffect(() => {
    void loadDashboardData();
  }, []);

  const toggleSelection = (artifactId: string) => {
    setSelectedArtifacts((prev) => {
      const next = new Set(prev);
      if (next.has(artifactId)) next.delete(artifactId);
      else next.add(artifactId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedArtifacts.size === artifacts.length && artifacts.length > 0) {
      setSelectedArtifacts(new Set());
    } else {
      setSelectedArtifacts(new Set(artifacts.map((a) => a.id)));
    }
  };

  const handleDownloadSelected = () => {
    artifacts
      .filter((a) => selectedArtifacts.has(a.id))
      .forEach((a) => {
        const link = document.createElement("a");
        link.href = `/api/generated/${a.id}`;
        link.download = String(a.filename);
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
  };

  const handleDeleteSelected = async () => {
    if (!confirm("Are you sure you want to delete the selected files?")) return;
    setActionLoading(true);
    try {
      const selectedIds = Array.from(selectedArtifacts);
      for (const artifactId of selectedIds) {
        await fetch(`/api/generated/${artifactId}`, { method: "DELETE" });
      }
      await loadDashboardData();
    } catch (e: any) {
      alert("Failed to delete some files");
    } finally {
      setActionLoading(false);
    }
  };

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
        <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
          <h2 className="text-lg font-medium">Last Project</h2>
          <button className="button-secondary" onClick={() => loadDashboardData()} disabled={loading}>
            Refresh
          </button>
        </div>

        {loading && <p className="text-[var(--muted)]">Loading…</p>}
        {!loading && !lastProject && <p className="text-[var(--muted)]">No projects found.</p>}

        {!loading && lastProject && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="col-span-1">
              <div className="bg-[var(--card-bg)] rounded-lg p-4 border border-[var(--border)]">
                {lastProject.thumbnail ? (
                  <img
                    src={lastProject.thumbnail}
                    alt={lastProject.name}
                    className="w-full h-auto aspect-video object-cover rounded mb-4 bg-[var(--item-bg-alpha)]"
                  />
                ) : (
                  <div className="w-full aspect-video rounded mb-4 bg-[var(--item-bg-alpha)] flex items-center justify-center text-[var(--muted)]">
                    No Thumbnail
                  </div>
                )}
                <h3 className="font-medium text-lg mb-1">{lastProject.name}</h3>
                <p className="text-sm text-[var(--muted)] mb-3 block">
                  {lastProject.description || <span className="text-[var(--muted)]">—</span>}
                </p>
                <div className="text-xs text-[var(--muted)] mb-5">
                  Created: {new Date(lastProject.created_at).toLocaleString()}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <a className="button-primary text-sm px-3 py-1.5" href={`/editor?project=${lastProject.id}`}>
                    Open Editor
                  </a>
                  <a className="button-secondary text-sm px-3 py-1.5" href={`/projects/${lastProject.id}/details`}>
                    Details
                  </a>
                </div>
              </div>
            </div>

            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
                <h3 className="font-medium text-[var(--foreground)]">Generated files</h3>
                {artifacts.length > 0 && (
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-[var(--foreground)]">
                      <input
                        type="checkbox"
                        className="rounded bg-[var(--item-bg-alpha)] border-[var(--border)] text-blue-500 focus:ring-blue-500 cursor-pointer"
                        checked={selectedArtifacts.size === artifacts.length && artifacts.length > 0}
                        onChange={toggleAll}
                      />
                      Select All
                    </label>
                    <button
                      className="button-secondary text-sm px-3 py-1.5"
                      onClick={handleDownloadSelected}
                      disabled={selectedArtifacts.size === 0 || actionLoading}
                    >
                      Download Selected
                    </button>
                    <button
                      className="bg-red-500/10 text-red-400 hover:bg-red-500/20 px-3 py-1.5 rounded transition-colors disabled:opacity-50 text-sm font-medium"
                      onClick={handleDeleteSelected}
                      disabled={selectedArtifacts.size === 0 || actionLoading}
                    >
                      Delete Selected
                    </button>
                  </div>
                )}
              </div>

              {artifacts.length === 0 ? (
                <p className="text-[var(--muted)] text-sm">No generated files for this project.</p>
              ) : (
                <ul className="space-y-3">
                  {artifacts.map((it) => (
                    <li
                      key={it.id}
                      className="bg-[var(--card-bg)] rounded px-4 py-3 flex items-center gap-4 border border-[var(--border)] hover:border-[var(--border)] transition-colors"
                    >
                      <input
                        type="checkbox"
                        className="rounded bg-[var(--card-bg)] border-[var(--border)] accent-[var(--accent)] text-blue-500 focus:ring-blue-500 cursor-pointer w-4 h-4"
                        checked={selectedArtifacts.has(it.id)}
                        onChange={() => toggleSelection(it.id)}
                      />
                      <div className="flex-1 flex items-center justify-between gap-4 flex-wrap">
                        <div>
                          <div className="font-medium">{it.filename}</div>
                          <div className="text-xs text-[var(--muted)] mt-1">
                            {it.kind} • {new Date(it.created_at).toLocaleString()}
                          </div>
                        </div>

                        <a
                          className="button-secondary text-sm px-3 py-1.5"
                          href={`/api/generated/${it.id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Download
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

