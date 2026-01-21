"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

//struktura projektu z api/projects
type Project = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  owner_email?: string;// volitelne, zobrazuje sa len adminovi
};

//struktura prihlaseneho usera z api/auth/me
type Me = { id: string; email: string; role: "user" | "admin" };

//stranka so zoznamom projektov pre prihlaseneho usera
export default function ProjectsPage() {
  const router = useRouter();//navigacia(open project, redirect ak je admin atd.)

  const [me, setMe] = useState<Me | null>(null);//bud prihlaseny user alebo null(rozhoduje sa podla toho ci je admin)

  const [projects, setProjects] = useState<Project[]>([]);//zoznam projektov
  const [loading, setLoading] = useState(true);//ci sa nacitavaju projekty
  const [creating, setCreating] = useState(false);//ci sa vytvara novy projekt

  const [name, setName] = useState("");//nazov noveho projektu
  const [description, setDescription] = useState("");//popis noveho projektu

  //overi ci je user prihlaseny a jeho rolu
  async function loadMe() {
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) return;
      setMe(await res.json());
    } catch {
      // ignore (treba dorobit logout alebo nieco podobne ak sa neda nacitat session)
    }
  }

  //redirect admina na admin dashboard (druhy safeguard okrem user layoutu)
  useEffect(() => {
    if (me?.role === "admin") {
      router.replace("/admin");
    }
  }, [me, router]);

  //nacita zoznam projektov z api/projects
  async function loadProjects() {
    setLoading(true);//zacina nacitavanie (zabezpeci ze sa zobrazi loading screen)

    //posle GET poziadavku na api endpoint
    let res: Response;//odpoved zo servera
    try {
      res = await fetch("/api/projects");
    } catch (err) {//ak sa nepodarilo nadviazat spojenie
      console.error("Network error while loading projects", err);
      setLoading(false);
      return;
    }
    //spracuje odpoved zo servera
    let data: any = null;
    try {
      data = await res.json();//parsuje JSON odpoved
    } catch {
      data = null;
    }

    if (!res.ok) {
      console.error("Failed to load projects:", data);
      setLoading(false);
      return;
    }
    //nastavi nacitane projekty do stavu
    setProjects(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();//zabranenie refreshu stranky

    //klient side validacia
    if (!name.trim()) {
      alert("Project name is required.");
      return;
    }

    setCreating(true);//zacina vytvaranie projektu

    //posle POST poziadavku na api/projects
    let res: Response;
    try {
      res = await fetch("/api/projects", {
        method: "POST", // CREATE
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

    //spracuje odpoved zo servera
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    setCreating(false);

    //ak vytvorenie projektu neprebehlo uspesne, zobrazi chybu
    if (!res.ok) {
      console.error("Create project failed:", data);
      alert(data?.error ?? "Create project failed.");
      return;
    }

    //ak vytvorenie projektu prebehlo uspesne, vycisti formular a nacita projekty znova
    setName("");
    setDescription("");
    await loadProjects();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this project?")) return;//potvrdenie mazania

    //posle DELETE poziadavku na api/projects/:id
    let res: Response;
    try {
      res = await fetch(`/api/projects/${id}`, { method: "DELETE" }); // DELETE
    } catch (err) {
      console.error("Network error while deleting project", err);
      return;
    }

    //spracuje odpoved zo servera
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    //ak mazanie projektu neprebehlo uspesne, zobrazi chybu
    if (!res.ok) {
      console.error("Delete failed:", data);
      alert(data?.error ?? "Delete failed.");
      return;
    }

    //ak uspesne vymazal, nacita projekty znova
    await loadProjects();
  }
    //prejmenuje projekt pomocou api/projects/:id (UPDATE/PATCH)
  async function renameProject(p: Project) {
    const newName = prompt("New project name:", p.name);//zobrazi prompt na zadanie noveho nazvu([p.name] je predvyplneny aktualny nazov)
    if (!newName) return;//ak user zrusil prompt, ukonci funkciu

    //klient side validacia
    const trimmed = newName.trim();
    if (!trimmed) {
      alert("Project name is required.");
      return;
    }

    //posle PATCH poziadavku na api/projects/:id
    let res: Response;
    try {
      res = await fetch(`/api/projects/${p.id}`, {
        method: "PATCH", // UPDATE
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
    } catch (err) {
      console.error("Network error while updating project", err);
      return;
    }
    //spracuje odpoved zo servera
    const json = await res.json().catch(() => null);

    //ak update projektu neprebehlo uspesne, zobrazi chybu
    if (!res.ok) {
      console.error("Update project failed:", json);
      alert(json?.error ?? "Update failed.");
      return;
    }
    //ak uspesne prejmenoval, nacita projekty znova
    await loadProjects();
  }

  //otvori projekt (navigacia na projektovu stranku)
  function openProject(id: string) {
    // READ (routing)
    router.push(`/projects/${id}`);//presmeruje na editor projektu
  }

  //generuje python kod pre projekt pomocou api/projects/:id/generate-python
  async function generatePython(id: string) {
    const res = await fetch(`/api/projects/${id}/generate-python`, {
      method: "POST",
    });
    //parsuje odpoved zo servera
    let json: any = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }

    //ak generovanie zlyhalo, zobrazi chybu
    if (!res.ok) {
      console.error("Generate failed:", res.status, json);
      alert(json?.error ?? "Generate failed.");
      return;
    }

    //ak generovanie prebehlo uspesne, zobrazi spravu a presmeruje na dashboard
    alert(`Generated: ${json.artifact.filename}`);
    router.push("/dashboard");
  }

  //exportuje projekt ako JSON subor pomocou api/projects/:id/export
  async function exportProject(id: string) {
    const res = await fetch(`/api/projects/${id}/export`); // READ (export)

    //ak export zlyhal, zobrazi text odpovede ako chybu
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      alert(`Export failed: ${t}`);
      return;
    }

    //vytvori a stiahne JSON subor s datami projektu
    const blob = new Blob([await res.text()], { type: "application/json" });//ziska textovu odpoved a vytvori z nej blob
    const url = URL.createObjectURL(blob);//vytvori URL pre blob (docasny download link)
    const a = document.createElement("a");
    a.href = url;
    a.download = `project_${id}.json`;
    a.click();
    URL.revokeObjectURL(url);//uvolni URL po stiahnuti
  }

  //spusti sa raz po prvom renderi
  useEffect(() => {
    void loadMe();//nacita info o prihlasenom userovi
    void loadProjects();//nacita projekty
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

                    <button onClick={() => renameProject(p)} className="button-secondary">
                      Rename
                    </button>

                    <a className="button-secondary" href={`/projects/${p.id}/details`}>
                      Details
                    </a>

                    <a className="button-secondary" href={`/projects/${p.id}/artifacts`}>
                      Artifacts
                    </a>

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
