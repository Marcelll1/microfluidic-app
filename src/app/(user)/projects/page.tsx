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

  // create form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // edit form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const [loading, setLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadProjects() {
    const res = await fetch("/api/projects");
    const data = await res.json();
    if (res.ok) {
      setProjects(data);
    } else {
      console.error("Failed to load projects:", data);
      setError(data.error ?? "Failed to load projects.");
    }
  }

  useEffect(() => {
    void loadProjects();
  }, []);

  function validateNameAndDescription(
    n: string,
    d: string,
  ): string | null {
    const trimmedName = n.trim();
    const trimmedDesc = d.trim();

    if (!trimmedName) {
      return "Project name is required.";
    }
    if (trimmedName.length < 3) {
      return "Project name must be at least 3 characters long.";
    }
    if (trimmedName.length > 100) {
      return "Project name must be at most 100 characters.";
    }
    if (trimmedDesc.length > 500) {
      return "Description must be at most 500 characters.";
    }
    return null;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const validationError = validateNameAndDescription(name, description);
    if (validationError) {
      setError(validationError);
      return;
    }

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
    setError(null);
    setSuccess(null);
    if (!confirm("Delete this project?")) return;
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      console.error("Delete project failed:", data);
      setError(data.error ?? "Failed to delete project.");
      return;
    }
    setSuccess("Project deleted.");
    await loadProjects();
  }

  async function startEdit(id: string) {
    setError(null);
    setSuccess(null);
    setEditLoading(true);
    setEditingId(id);

    // tu reálne používaš READ DETAIL: GET /api/projects/:id
    const res = await fetch(`/api/projects/${id}`);
    const data = await res.json();
    setEditLoading(false);

    if (!res.ok) {
      console.error("Load project detail failed:", data);
      setError(data.error ?? "Failed to load project detail.");
      setEditingId(null);
      return;
    }

    setEditName(data.name ?? "");
    setEditDescription(data.description ?? "");
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;

    setError(null);
    setSuccess(null);

    const validationError = validateNameAndDescription(
      editName,
      editDescription,
    );
    if (validationError) {
      setError(validationError);
      return;
    }

    setEditLoading(true);

    const trimmedName = editName.trim();
    const trimmedDesc = editDescription.trim();

    // tu reálne používaš UPDATE: PATCH /api/projects/:id
    const res = await fetch(`/api/projects/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: trimmedName,
        description: trimmedDesc || null,
      }),
    });

    const data = await res.json();
    setEditLoading(false);

    if (!res.ok) {
      console.error("Update project failed:", data);
      setError(data.error ?? "Failed to update project.");
      return;
    }

    setSuccess("Project updated.");
    setEditingId(null);
    setEditName("");
    setEditDescription("");
    await loadProjects();
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditDescription("");
    setError(null);
    setSuccess(null);
  }

  return (
    <main className="page page--projects h-[calc(100vh-60px)] w-full text-slate-100">
      {/* CREATE FORM */}
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

          {error && !editingId && (
            <p className="form-error">{error}</p>
          )}
          {success && !editingId && (
            <p className="form-success">{success}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="button-primary mt-1"
          >
            {loading ? "Creating..." : "Create project"}
          </button>
        </form>
      </section>

      {/* EDIT FORM - zobrazuje sa len ak editujeme */}
      {editingId && (
        <section className="card card--form">
          <h2 className="text-lg font-semibold mb-3">
            Edit project
          </h2>

          <form onSubmit={handleUpdate} className="form-grid">
            <div className="form-field">
              <label className="form-field-label" htmlFor="edit-name">
                Project name
              </label>
              <input
                id="edit-name"
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="form-field">
              <label
                className="form-field-label"
                htmlFor="edit-description"
              >
                Description
              </label>
              <textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="form-textarea"
              />
            </div>

            {error && (
              <p className="form-error">{error}</p>
            )}
            {success && (
              <p className="form-success">{success}</p>
            )}

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={editLoading}
                className="button-primary mt-1"
              >
                {editLoading ? "Saving..." : "Save changes"}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="text-xs text-slate-400 hover:text-slate-200 mt-1"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {/* LIST PROJECTS */}
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
                    onClick={() => startEdit(p.id)}
                    className="text-xs text-sky-400 hover:text-sky-300"
                  >
                    Edit
                  </button>
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
