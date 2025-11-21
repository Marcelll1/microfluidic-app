"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadProjects() {
    const res = await fetch("/api/projects");
    const data = await res.json();
    if (res.ok) {
      setProjects(data);
    } else {
      console.error("Failed to load projects:", data);
    }
  }

  useEffect(() => {
    void loadProjects();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      console.error("Create project failed:", data);
      return;
    }

    setName("");
    setDescription("");
    await loadProjects();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this project?")) return;
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      console.error("Delete project failed:", data);
      return;
    }
    await loadProjects();
  }

  return (
    <main className="h-[calc(100vh-60px)] w-full flex flex-col gap-6 p-6 text-slate-100">
      <section className="max-w-xl bg-slate-900/80 border border-slate-800 rounded-xl p-4">
        <h2 className="text-lg font-semibold mb-3">Create new project</h2>
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm"
          />
          <textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm min-h-[70px]"
          />
          <button
            type="submit"
            disabled={loading}
            className="self-start bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-md"
          >
            {loading ? "Creating..." : "Create project"}
          </button>
        </form>
      </section>

      <section className="flex-1 bg-slate-900/60 border border-slate-800 rounded-xl p-4 overflow-auto">
        <h2 className="text-lg font-semibold mb-3">Projects</h2>
        {projects.length === 0 ? (
          <p className="text-sm text-slate-400">No projects yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {projects.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between bg-slate-950/60 border border-slate-800 rounded-lg px-4 py-3 text-sm"
              >
                <div className="flex flex-col">
                  <span className="font-medium">{p.name}</span>
                  {p.description && (
                    <span className="text-xs text-slate-400 line-clamp-2">
                      {p.description}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/editor?project=${p.id}`}
                    className="bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded-md text-xs"
                  >
                    Open in editor
                  </Link>
                  <button
                    onClick={() => void handleDelete(p.id)}
                    className="text-xs text-red-400 hover:text-red-300"
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
