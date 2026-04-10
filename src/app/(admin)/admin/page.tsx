"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

//overview typov pre admin dashboard
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

//projekty z usera /api/admin/users/:id/projects
type Project = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

//artifacty z usera /api/admin/users/:id/artifacts
type Artifact = {
  id: string;
  kind: string;
  filename: string;
  created_at: string;
  project_id: string;
  project_name: string;
};

export default function AdminDashboard() {
  const router = useRouter(); //pouziva sa pre openProject

  const [users, setUsers] = useState<AdminUser[]>([]);//list uzivatelov
  const [loading, setLoading] = useState(true); //ci sa nacitavaju data

  const [expandedProjects, setExpandedProjects] = useState<Record<string, Project[] | null>>({});//rozbalene projekty pre jednotlivych userov
  const [expandedArtifacts, setExpandedArtifacts] = useState<Record<string, Artifact[] | null>>({});//rozbalene artifacty pre jednotlivych userov

  const [activeTab, setActiveTab] = useState<"users" | "stats">("users");
  const [stats, setStats] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  //nacita prehlad uzivatelov
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

  //pre konkretneho usera rozbali alebo zbali projekty
  async function toggleProjects(userId: string) {
    if (expandedProjects[userId]) {
      setExpandedProjects((p) => ({ ...p, [userId]: null }));//zbali projekty
      return;
    }

    //inak nacita projekty zo servera
    const res = await fetch(`/api/admin/users/${userId}/projects`);
    const json = await res.json().catch(() => null);

    if (!res.ok) {
      alert(json?.error ?? "Failed to load projects.");
      return;
    }

    setExpandedProjects((p) => ({ ...p, [userId]: Array.isArray(json) ? json : [] }));//rozbali projekty
  }

  //pre konkretneho usera rozbali alebo zbali artifacty
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

  //schvali password reset poziadavku pre usera
  async function approveReset(reqId: string) {
    const res = await fetch(`/api/admin/password-resets/${reqId}/approve`, { //POST poziadavka
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: null }), //zatial bez poznamky
    });

    const json = await res.json().catch(() => null);

    //ak nie je OK, zobrazi chybu
    if (!res.ok) {
      alert(json?.error ?? "Approve failed.");
      return;
    }

    //uspesne schvaleny reset - zobrazi kod
    alert(`Reset code (give to user): ${json.reset_code}`);
    await loadUsers();
  }
  //nacita staty a activity logy
  async function loadStatsAndLogs(userIdFilter: string = selectedUserId) {
    setLoading(true);
    const url = userIdFilter ? `/api/admin/stats?userId=${userIdFilter}` : "/api/admin/stats";
    const res = await fetch(url);
    const json = await res.json().catch(() => null);

    if (!res.ok) {
      console.error("Admin stats failed:", json);
      setStats(null);
      setLogs([]);
      setLoading(false);
      return;
    }

    setStats(json.stats);
    setLogs(json.logs || []);
    setLoading(false);
  }

  //otvori projekt v editori
  function openProject(projectId: string) {
    router.push(`/editor?project=${projectId}`);
  }

  //nacita data podla aktivnej taby pri zmene alebo prvom renderi
  useEffect(() => {
    if (activeTab === "users") {
      void loadUsers();
    } else {
      void loadStatsAndLogs();
    }
  }, [activeTab]);

  return (
    <main className="page p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold">Admin dashboard</h1>
        <div className="flex gap-2 p-1 bg-slate-900 rounded-md">
          <button
            className={`px-4 py-2 text-sm rounded ${activeTab === "users" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"}`}
            onClick={() => setActiveTab("users")}
          >
            User Management
          </button>
          <button
            className={`px-4 py-2 text-sm rounded ${activeTab === "stats" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"}`}
            onClick={() => setActiveTab("stats")}
          >
            Platform Stats & Live Activity
          </button>
        </div>
        <button
          className="button-secondary"
          onClick={() => (activeTab === "users" ? loadUsers() : loadStatsAndLogs())}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {loading && <p className="text-slate-400">Loading…</p>}

      {/* USER MANAGEMENT TAB */}
      {activeTab === "users" && (
        <>
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
        </>
      )}

      {/* STATS & LIVE ACTIVITY TAB */}
      {activeTab === "stats" && !loading && (
        <div className="space-y-8">
          
          {/* STATS GRID */}
          {stats?.isGlobal ? (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-slate-900 rounded p-6 text-center shadow border border-slate-800">
                <div className="text-slate-400 text-sm mb-1 uppercase tracking-wider">Total Users</div>
                <div className="text-4xl font-bold text-white">{stats?.totalUsers || 0}</div>
              </div>
              <div className="bg-slate-900 rounded p-6 text-center shadow border border-slate-800">
                <div className="text-slate-400 text-sm mb-1 uppercase tracking-wider">Global Projects</div>
                <div className="text-4xl font-bold text-white">{stats?.totalProjects || 0}</div>
              </div>
              <div className="bg-slate-900 rounded p-6 text-center shadow border border-slate-800">
                <div className="text-slate-400 text-sm mb-1 uppercase tracking-wider">Global Codes</div>
                <div className="text-4xl font-bold text-white">{stats?.totalArtifacts || 0}</div>
              </div>
              <div className="bg-slate-900 rounded p-6 text-center shadow border border-slate-800">
                <div className="text-slate-400 text-sm mb-1 uppercase tracking-wider">Recent Actions</div>
                <div className="text-4xl font-bold text-white">{logs.length}</div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-slate-900 rounded p-6 text-center shadow border border-blue-900/50">
                <div className="text-blue-400 text-sm mb-1 uppercase tracking-wider">User Projects</div>
                <div className="text-4xl font-bold text-white">{stats?.totalProjects || 0}</div>
              </div>
              <div className="bg-slate-900 rounded p-6 text-center shadow border border-purple-900/50">
                <div className="text-purple-400 text-sm mb-1 uppercase tracking-wider">Codes Generated</div>
                <div className="text-4xl font-bold text-white">{stats?.totalArtifacts || 0}</div>
              </div>
              <div className="bg-slate-900 rounded p-6 text-center shadow border border-green-900/50">
                <div className="text-green-400 text-sm mb-1 uppercase tracking-wider">Last Active</div>
                <div className="text-lg font-bold text-white mt-3 leading-tight">
                  {stats?.lastActive ? new Date(stats.lastActive).toLocaleDateString() : "Never"}
                </div>
              </div>
              <div className="bg-slate-900 rounded p-6 text-center shadow border border-orange-900/50">
                <div className="text-orange-400 text-sm mb-1 uppercase tracking-wider">Recent Actions</div>
                <div className="text-4xl font-bold text-white">{logs.length}</div>
              </div>
            </div>
          )}

          {/* ACTIVITY LOGS */}
          <div className="bg-slate-900 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 bg-slate-850 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Latest Activity Log</h2>
              
              <div className="w-full md:w-64">
                <select
                  value={selectedUserId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedUserId(val);
                    loadStatsAndLogs(val);
                  }}
                  className="w-full form-input bg-slate-950 border-slate-800 text-sm"
                >
                  <option value="">All users</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="p-0">
              {logs.length === 0 ? (
                <div className="p-6 text-slate-500 text-sm">No activity logs found.</div>
              ) : (
                <ul className="divide-y divide-slate-800">
                  {logs.map((log) => (
                    <li key={log.id} className="p-4 hover:bg-slate-800/50 transition-colors flex flex-col md:flex-row md:items-start gap-4">
                      {/* ACTION BADGE */}
                      <div className="shrink-0 w-[100px]">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-bold font-mono tracking-wider w-full text-center ${
                          log.action?.includes('CREATE') ? 'bg-green-900/40 text-green-400 border border-green-800/50' :
                          log.action?.includes('DELETE') ? 'bg-red-900/40 text-red-400 border border-red-800/50' :
                          log.action?.includes('UPDATE') ? 'bg-blue-900/40 text-blue-400 border border-blue-800/50' :
                          'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}>
                          {log.action}
                        </span>
                      </div>
                      
                      {/* DETAILS */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="font-medium text-slate-200">
                            {log.users?.email || 'Unknown User'}
                          </span>
                          <span className="text-slate-500 text-sm">on</span>
                          <span className="text-slate-300 font-mono text-sm">
                            {log.entity} {log.entity_id && `#${log.entity_id.slice(0, 8)}`}
                          </span>
                        </div>
                        {log.meta && Object.keys(log.meta).length > 0 && (
                          <div className="text-xs font-mono text-slate-400 bg-slate-950 p-2 rounded mt-2 overflow-x-auto">
                            {JSON.stringify(log.meta)}
                          </div>
                        )}
                      </div>
                      
                      {/* TIMESTAMP */}
                      <div className="shrink-0 text-slate-500 text-xs text-right whitespace-nowrap md:w-32">
                        {new Date(log.created_at).toLocaleString()}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
