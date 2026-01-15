"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Project = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  owner_email?: string; // iba pre admina
};

export default function ProjectsPage() {
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  /* =========================
     LOAD PROJECTS
     ========================= */
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

  /* =========================
     CREATE PROJECT
     ========================= */
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

  /* =========================
     DELETE PROJECT
     ========================= */
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

  /* =========================
     OPEN PROJECT
     ========================= */
  function openProject(id: string) {
    router.push(`/editor?project=${id}`);
  }

  useEffect(() => {
    void loadProjects();
  }, []);

  /* =========================
     RENDER
     ========================= */
  return (
    <main className="page p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Projects</h1>

      {/* CREATE PROJECT */}
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

          <button
            type="submit"
            disabled={creating}
            className="button-primary self-start"
          >
            {creating ? "Creating..." : "Create project"}
          </button>
        </form>
      </section>

      {/* PROJECT LIST */}
      <section className="card">
        <h2 className="text-lg font-medium mb-4">Your projects</h2>

        {loading && <p className="text-slate-400">Loading projects…</p>}

        {!loading && projects.length === 0 && (
          <p className="text-slate-400">No projects yet.</p>
        )}

        {!loading && projects.length > 0 && (
          <ul className="space-y-3">
            {projects.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between bg-slate-900 rounded px-4 py-3"
              >
                <div>
  <div className="font-medium">{p.name}</div>

  {p.description && (
    <div className="text-sm text-slate-400">
      {p.description}
    </div>
  )}

  {p.owner_email && (
    <div className="text-xs text-slate-500 mt-1">
      Owner: <span className="font-mono">{p.owner_email}</span>
    </div>
  )}
</div>


                <div className="flex items-center gap-3">
                  <button
                    onClick={() => openProject(p.id)}
                    className="button-secondary"
                  >
                    Open
                  </button>

                  <button
                    onClick={() => handleDelete(p.id)}
                    className="text-sm text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
