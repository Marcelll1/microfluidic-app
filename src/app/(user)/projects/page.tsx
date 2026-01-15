"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Project = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  owner_email?: string;
};

type Me = { id: string; email: string; role: "user" | "admin" };

export default function ProjectsPage() {
  const router = useRouter();

  const [me, setMe] = useState<Me | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  async function loadMe() {
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) return;
      setMe(await res.json());
    } catch {
      // ignore
    }
  }

  useEffect(() => {
  if (me?.role === "admin") {
    router.replace("/admin");
  }
}, [me, router]);


  async function loadProjects() {
    setLoading(true);

    let res: Response;
    try {
      res = await fetch("/api/projects");
    } catch (err) {
      console.error("Network error while loading projects", err);
      setLoading(false);
      return;
    }

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      console.error("Failed to load projects:", data);
      setLoading(false);
      return;
    }

    setProjects(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      alert("Project name is required.");
      return;
    }

    setCreating(true);

    let res: Response;
    try {
      res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
        }),
      });
    } catch (err) {
      console.error("Network error while creating project", err);
      setCreating(false);
      return;
    }

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    setCreating(false);

    if (!res.ok) {
      console.error("Create project failed:", data);
      alert(data?.error ?? "Create project failed.");
      return;
    }

    setName("");
    setDescription("");
    await loadProjects();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this project?")) return;

    let res: Response;
    try {
      res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    } catch (err) {
      console.error("Network error while deleting project", err);
      return;
    }

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      console.error("Delete failed:", data);
      alert(data?.error ?? "Delete failed.");
      return;
    }

    await loadProjects();
  }

  function openProject(id: string) {
    router.push(`/editor?project=${id}`);
  }

  async function generatePython(id: string) {
    const res = await fetch(`/api/projects/${id}/generate-python`, { method: "POST" });
    let json: any = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }

    if (!res.ok) {
      console.error("Generate failed:", res.status, json);
      alert(json?.error ?? "Generate failed.");
      return;
    }

    alert(`Generated: ${json.artifact.filename}`);
    router.push("/dashboard");
  }

  async function exportProject(id: string) {
    const res = await fetch(`/api/projects/${id}/export`);
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      alert(`Export failed: ${t}`);
      return;
    }

    const blob = new Blob([await res.text()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `project_${id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    void loadMe();
    void loadProjects();
  }, []);

  return (
    <main className="page p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold">Projects</h1>

        <div className="flex items-center gap-2">
          <a className="button-secondary" href="/dashboard">
            Dashboard (downloads)
          </a>

          {me?.role === "admin" && (
            <a className="button-secondary" href="/admin">
              Admin dashboard
            </a>
          )}
        </div>
      </div>

      <section className="card mb-8">
        <h2 className="text-lg font-medium mb-4">Create new project</h2>

        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="form-input"
            disabled={creating}
          />

          <textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="form-textarea"
            disabled={creating}
          />

          <button type="submit" disabled={creating} className="button-primary self-start">
            {creating ? "Creating..." : "Create project"}
          </button>
        </form>
      </section>

      <section className="card">
        <h2 className="text-lg font-medium mb-4">
          {me?.role === "admin" ? "All projects" : "Your projects"}
        </h2>

        {loading && <p className="text-slate-400">Loading projects…</p>}

        {!loading && projects.length === 0 && <p className="text-slate-400">No projects yet.</p>}

        {!loading && projects.length > 0 && (
          <ul className="space-y-3">
            {projects.map((p) => (
              <li key={p.id} className="bg-slate-900 rounded px-4 py-3">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="font-medium">{p.name}</div>
                    {p.description && <div className="text-sm text-slate-400">{p.description}</div>}
                    {p.owner_email && (
                      <div className="text-xs text-slate-500 mt-1">
                        Owner: <span className="font-mono">{p.owner_email}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => openProject(p.id)} className="button-secondary">
                      Open
                    </button>

                    <button onClick={() => generatePython(p.id)} className="button-secondary">
                      Generate code
                    </button>

                    <button onClick={() => exportProject(p.id)} className="button-secondary">
                      Export JSON
                    </button>

                    <button
                      onClick={() => handleDelete(p.id)}
                      className="text-sm text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
