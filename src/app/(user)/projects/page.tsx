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

  // client-side validácia
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  function validateForm(): boolean {
    setError(null);
    setSuccess(null);

    const trimmedName = name.trim();
    const trimmedDesc = description.trim();

    if (!trimmedName) {
      setError("Project name is required.");
      return false;
    }

    if (trimmedName.length < 3) {
      setError("Project name must be at least 3 characters long.");
      return false;
    }

    if (trimmedName.length > 100) {
      setError("Project name must be at most 100 characters.");
      return false;
    }

    if (trimmedDesc.length > 500) {
      setError("Description must be at most 500 characters.");
      return false;
    }

    return true;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    const trimmedName = name.trim();
    const trimmedDesc = description.trim();

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: trimmedName,
        description: trimmedDesc || null,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      console.error("Create project failed:", data);
      setError(data.error ?? "Failed to create project.");
      return;
    }

    setName("");
    setDescription("");
    setSuccess("Project created successfully.");
    await loadProjects();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this project?")) return;
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      console.error("Delete project failed:", data);
      setError(data.error ?? "Failed to delete project.");
      return;
    }
    await loadProjects();
  }

  return (
    <main className="page page--projects h-[calc(100vh-60px)] w-full text-slate-100">
      <section className="card card--form">
        <h2 className="text-lg font-semibold mb-3">Create new project</h2>

        <form onSubmit={handleCreate} className="form-grid">
          <div className="form-field">
            <label className="form-field-label" htmlFor="name">
              Project name
            </label>
            <input
              id="name"
              type="text"
              placeholder="Project name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-field">
            <label className="form-field-label" htmlFor="description">
              Description (optional)
            </label>
            <textarea
              id="description"
              placeholder="Short description of the project"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="form-textarea"
            />
          </div>

          {error && <p className="form-error">{error}</p>}
          {success && <p className="form-success">{success}</p>}

          <button
            type="submit"
            disabled={loading}
            className="button-primary mt-1"
          >
            {loading ? "Creating..." : "Create project"}
          </button>
        </form>
      </section>

      <section className="card flex-1 overflow-auto">
        <h2 className="text-lg font-semibold mb-3">Projects</h2>
        {projects.length === 0 ? (
          <p className="text-sm text-slate-400">No projects yet.</p>
        ) : (
          <ul className="projects-list">
            {projects.map((p) => (
              <li key={p.id} className="projects-item">
                <div className="projects-item-main">
                  <span className="projects-item-title">{p.name}</span>
                  {p.description && (
                    <span className="projects-item-description">
                      {p.description}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/editor?project=${p.id}`}
                    className="button-primary"
                  >
                    Open in editor
                  </Link>
                  <button
                    type="button"
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
