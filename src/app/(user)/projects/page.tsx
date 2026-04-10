"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

//struktura projektu z api/projects
type Project = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  owner_email?: string;// volitelne, zobrazuje sa len adminovi a pri share
  thumbnail?: string | null;
  is_collaborator?: boolean;
};

//struktura prihlaseneho usera z api/auth/me
type Me = { id: string; email: string; role: "user" | "admin" };

//stranka so zoznamom projektov pre prihlaseneho usera
export default function ProjectsPage() {
  const router = useRouter();//navigacia(open project, redirect ak je admin atd.)

  const [me, setMe] = useState<Me | null>(null);//bud prihlaseny user alebo null(rozhoduje sa podla toho ci je admin)

  const [activeTab, setActiveTab] = useState<"my-projects" | "shared">("my-projects");

  const [projects, setProjects] = useState<Project[]>([]);//zoznam projektov
  const [sharedProjects, setSharedProjects] = useState<Project[]>([]);
  
  const [loading, setLoading] = useState(true);//ci sa nacitavaju projekty
  const [sharedLoading, setSharedLoading] = useState(true);
  
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

  async function loadSharedProjects() {
    setSharedLoading(true);
    let res: Response;
    try {
      res = await fetch("/api/projects/shared");
    } catch (err) {
      console.error("Network error while loading shared projects", err);
      setSharedLoading(false);
      return;
    }
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) {
      console.error("Failed to load shared projects:", data);
      setSharedLoading(false);
      return;
    }
    setSharedProjects(Array.isArray(data) ? data : []);
    setSharedLoading(false);
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

    //ak generovanie prebehlo uspesne, zobrazi spravu a presmeruje na details projektu
    alert(`Generated: ${json.artifact.filename}`);
    router.push(`/projects/${id}/details`);
  }

  // Exportuje projekt ako VTK subor pre ParaView
  async function exportVTK(id: string) {
    const res = await fetch(`/api/projects/${id}/export-vtk`);
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      alert(`VTK export zlyhal: ${t}`);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    // zistime nazov suboru z hlavicky Content-Disposition ak je dostupna
    const cd = res.headers.get("Content-Disposition") ?? "";
    const match = cd.match(/filename="([^"]+)"/);
    a.download = match?.[1] ?? `project_${id}.vtk`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function cloneProject(id: string) {
    if (!confirm("Clone this project into your account?")) return;
    
    let res: Response;
    try {
      res = await fetch(`/api/projects/${id}/clone`, {
        method: "POST",
      });
    } catch (err) {
      console.error("Network error while cloning", err);
      return;
    }

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      console.error("Clone failed:", data);
      alert(data?.error ?? "Clone failed.");
      return;
    }

    alert("Project cloned successfully!");
    setActiveTab("my-projects");
    await loadProjects();
  }

  //spusti sa raz po prvom renderi
  useEffect(() => {
    void loadMe();//nacita info o prihlasenom userovi
    void loadProjects();//nacita projekty
    void loadSharedProjects();
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

      <div className="flex gap-4 mb-6 border-b border-slate-800">
        <button
          onClick={() => setActiveTab("my-projects")}
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "my-projects"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-slate-400 hover:text-slate-300"
          }`}
        >
          My Projects
        </button>
        <button
          onClick={() => setActiveTab("shared")}
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "shared"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-slate-400 hover:text-slate-300"
          }`}
        >
          Shared & Explore
        </button>
      </div>

      {activeTab === "my-projects" && (
        <>
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
              <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map((p) => (
                  <li
                    key={p.id}
                    className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow duration-200 group"
                  >
                    {/* Thumbnail section */}
                    <div
                      className="w-full h-40 bg-slate-950 relative border-b border-slate-800 flex items-center justify-center cursor-pointer group-hover:opacity-90 transition-opacity"
                      onClick={() => openProject(p.id)}
                    >
                      {p.thumbnail ? (
                        <img
                          src={p.thumbnail}
                          alt={p.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-slate-700 text-sm font-medium">No thumbnail</div>
                      )}
                      <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); renameProject(p); }}
                          className="bg-slate-800/80 hover:bg-slate-700/80 text-white rounded p-1.5 backdrop-blur-sm"
                          title="Rename"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                          className="bg-red-900/80 hover:bg-red-800/80 text-red-100 rounded p-1.5 backdrop-blur-sm"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="p-4 flex-1 flex flex-col">
                      <div className="mb-4 flex-1">
                        <div
                          className="font-semibold text-lg cursor-pointer hover:text-blue-400 transition-colors"
                          onClick={() => openProject(p.id)}
                        >
                          {p.name}
                        </div>
                        {p.description && (
                          <div className="text-sm text-slate-400 mt-1 line-clamp-2">{p.description}</div>
                        )}
                        {p.owner_email && (
                          <div className="text-xs text-slate-500 mt-3 flex items-center gap-1.5">
                            <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
                            <span className="font-mono truncate">{p.owner_email}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-4 border-t border-slate-800/50 flex-wrap">
                        <a
                          className="text-xs py-1.5 px-3 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors"
                          href={`/projects/${p.id}/details`}
                        >
                          Details
                        </a>
                        <button
                          onClick={() => generatePython(p.id)}
                          className="text-xs py-1.5 px-3 bg-blue-900/50 hover:bg-blue-800/50 text-blue-200 rounded-md transition-colors"
                        >
                          Gen Code
                        </button>
                        <button
                          onClick={() => void exportVTK(p.id)}
                          className="text-xs py-1.5 px-3 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors"
                        >
                          VTK
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {activeTab === "shared" && (
        <section className="card">
          <h2 className="text-lg font-medium mb-4">Shared & Explore</h2>
          {sharedLoading && <p className="text-slate-400">Loading projects…</p>}
          {!sharedLoading && sharedProjects.length === 0 && <p className="text-slate-400">No shared or public projects found.</p>}
          {!sharedLoading && sharedProjects.length > 0 && (
            <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sharedProjects.map((p) => (
                <li
                  key={p.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow duration-200 group"
                >
                  {/* Thumbnail section */}
                  <div
                    className="w-full h-40 bg-slate-950 relative border-b border-slate-800 flex items-center justify-center cursor-pointer group-hover:opacity-90 transition-opacity"
                    onClick={() => openProject(p.id)}
                  >
                    {p.thumbnail ? (
                      <img
                        src={p.thumbnail}
                        alt={p.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-slate-700 text-sm font-medium">No thumbnail</div>
                    )}
                  </div>

                  <div className="p-4 flex-1 flex flex-col">
                    <div className="mb-4 flex-1">
                      <div
                        className="font-semibold text-lg cursor-pointer hover:text-blue-400 transition-colors flex items-center gap-2"
                        onClick={() => openProject(p.id)}
                      >
                        {p.name}
                        {p.is_collaborator && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-green-900/50 text-green-300 rounded font-normal uppercase tracking-wider">
                            Collab
                          </span>
                        )}
                      </div>
                      {p.description && (
                        <div className="text-sm text-slate-400 mt-1 line-clamp-2">{p.description}</div>
                      )}
                      {p.owner_email && (
                        <div className="text-xs text-slate-500 mt-3 flex items-center gap-1.5">
                          <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
                          <span className="font-mono truncate">{p.owner_email}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-4 border-t border-slate-800/50 flex-wrap">
                      <a
                        className="text-xs py-1.5 px-3 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors"
                        href={`/projects/${p.id}/details`}
                      >
                        Details
                      </a>
                      <button
                        onClick={() => openProject(p.id)}
                        className="text-xs py-1.5 px-3 bg-blue-900/50 hover:bg-blue-800/50 text-blue-200 rounded-md transition-colors"
                      >
                        Open Editor
                      </button>
                      <button
                        onClick={() => cloneProject(p.id)}
                        className="text-xs py-1.5 px-3 bg-purple-900/40 hover:bg-purple-800/50 text-purple-200 rounded-md transition-colors ml-auto"
                      >
                        Clone Project
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
