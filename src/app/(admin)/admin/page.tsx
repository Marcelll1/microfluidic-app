"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type AdminUser = {
  id: string;
  email: string;
  role: "user" | "admin";
  full_name: string | null;
  created_at: string;
  has_pending_reset: boolean;
  pending_reset_id: string | null;
  pending_reset_note: string | null;
  pending_reset_created_at: string | null;
};

type Project = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

type Artifact = {
  id: string;
  kind: string;
  filename: string;
  created_at: string;
  project_id: string;
  project_name: string;
};

export default function AdminDashboard() {
  const router = useRouter();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [expandedProjects, setExpandedProjects] = useState<Record<string, Project[] | null>>({});
  const [expandedArtifacts, setExpandedArtifacts] = useState<Record<string, Artifact[] | null>>({});

  async function loadUsers() {
    setLoading(true);
    const res = await fetch("/api/admin/overview");
    const json = await res.json().catch(() => null);

    if (!res.ok) {
      console.error("Admin overview failed:", json);
      setUsers([]);
      setLoading(false);
      return;
    }

    setUsers(Array.isArray(json) ? json : []);
    setLoading(false);
  }

  async function toggleProjects(userId: string) {
    if (expandedProjects[userId]) {
      setExpandedProjects((p) => ({ ...p, [userId]: null }));
      return;
    }

    const res = await fetch(`/api/admin/users/${userId}/projects`);
    const json = await res.json().catch(() => null);

    if (!res.ok) {
      alert(json?.error ?? "Failed to load projects.");
      return;
    }

    setExpandedProjects((p) => ({ ...p, [userId]: Array.isArray(json) ? json : [] }));
  }

  async function toggleArtifacts(userId: string) {
    if (expandedArtifacts[userId]) {
      setExpandedArtifacts((p) => ({ ...p, [userId]: null }));
      return;
    }

    const res = await fetch(`/api/admin/users/${userId}/artifacts`);
    const json = await res.json().catch(() => null);

    if (!res.ok) {
      alert(json?.error ?? "Failed to load artifacts.");
      return;
    }

    setExpandedArtifacts((p) => ({ ...p, [userId]: Array.isArray(json) ? json : [] }));
  }

  async function approveReset(reqId: string) {
    const res = await fetch(`/api/admin/password-resets/${reqId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: null }),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      alert(json?.error ?? "Approve failed.");
      return;
    }

    alert(`Reset code (give to user): ${json.reset_code}`);
    await loadUsers();
  }

  function openProject(projectId: string) {
    router.push(`/editor?project=${projectId}`);
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  return (
    <main className="page p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold">Admin dashboard</h1>
        <button className="button-secondary" onClick={() => loadUsers()} disabled={loading}>
          Refresh
        </button>
      </div>

      {loading && <p className="text-slate-400">Loading…</p>}

      {!loading && users.length === 0 && <p className="text-slate-400">No users.</p>}

      {!loading && users.length > 0 && (
        <div className="space-y-3">
          {users.map((u) => (
            <div key={u.id} className="bg-slate-900 rounded px-4 py-3">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {u.email}
                    {u.has_pending_reset && (
                      <span className="text-xs bg-red-600/30 text-red-300 px-2 py-1 rounded">
                        RESET REQUEST
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {u.full_name ? `${u.full_name} • ` : ""}
                    role: {u.role} • created: {new Date(u.created_at).toLocaleString()}
                  </div>
                  {u.has_pending_reset && u.pending_reset_created_at && (
                    <div className="text-xs text-slate-400 mt-1">
                      reset requested: {new Date(u.pending_reset_created_at).toLocaleString()}
                      {u.pending_reset_note ? ` • note: ${u.pending_reset_note}` : ""}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {u.has_pending_reset && u.pending_reset_id && (
                    <button className="button-primary" onClick={() => approveReset(u.pending_reset_id!)}>
                      Approve reset
                    </button>
                  )}

                  <button className="button-secondary" onClick={() => toggleProjects(u.id)}>
                    {expandedProjects[u.id] ? "Hide projects" : "Show projects"}
                  </button>

                  <button className="button-secondary" onClick={() => toggleArtifacts(u.id)}>
                    {expandedArtifacts[u.id] ? "Hide codes" : "Show codes"}
                  </button>
                </div>
              </div>

              {/* PROJECTS */}
              {expandedProjects[u.id] && (
                <div className="mt-4 border-t border-slate-800 pt-3">
                  <div className="text-sm text-slate-300 mb-2">Projects</div>
                  {expandedProjects[u.id]!.length === 0 ? (
                    <div className="text-sm text-slate-500">No projects.</div>
                  ) : (
                    <ul className="space-y-2">
                      {expandedProjects[u.id]!.map((p) => (
                        <li key={p.id} className="bg-slate-950/40 rounded px-3 py-2">
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div>
                              <div className="font-medium">{p.name}</div>
                              {p.description && (
                                <div className="text-sm text-slate-400">{p.description}</div>
                              )}
                              <div className="text-xs text-slate-500 mt-1">
                                {new Date(p.created_at).toLocaleString()}
                              </div>
                            </div>
                            <button className="button-secondary" onClick={() => openProject(p.id)}>
                              Open in editor
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* ARTIFACTS */}
              {expandedArtifacts[u.id] && (
                <div className="mt-4 border-t border-slate-800 pt-3">
                  <div className="text-sm text-slate-300 mb-2">Generated codes</div>
                  {expandedArtifacts[u.id]!.length === 0 ? (
                    <div className="text-sm text-slate-500">No generated codes.</div>
                  ) : (
                    <ul className="space-y-2">
                      {expandedArtifacts[u.id]!.map((a) => (
                        <li key={a.id} className="bg-slate-950/40 rounded px-3 py-2">
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div>
                              <div className="font-medium">{a.filename}</div>
                              <div className="text-xs text-slate-500 mt-1">
                                {a.project_name} • {new Date(a.created_at).toLocaleString()}
                              </div>
                            </div>
                            <a className="button-secondary" href={`/api/generated/${a.id}`}>
                              Download
                            </a>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
