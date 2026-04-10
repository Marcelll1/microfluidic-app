"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

//Typ projektu z GET /api/projects/:id
type Project = {
  id: string;
  name: string;
  description: string | null; //moze byt null
  created_at: string; //ISO datum
  visibility?: string;
  is_owner?: boolean;
  is_collaborator?: boolean;
  can_edit?: boolean;
};

//Typ objektu z GET /api/objects?project_id=:id
type Obj3D = {
  id: string;
  project_id: string;
  type: string; //cube, cylinder
  pos_x: number;
  pos_y: number;
  pos_z: number;
  rotation_y: number;
  params: any; //geometricke parametre objektu
  created_at?: string; //optional ISO datum
};

//Typ artifactu z GET /api/generated
type Artifact = {
  id: string;
  filename: string;
  created_at: string;
  project_id: string;
  kind?: string; //optional ale je to python
};

export default function ProjectDetailsPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [project, setProject] = useState<Project | null>(null); //nacitany projekt
  const [objects, setObjects] = useState<Obj3D[]>([]); //nacitane objekty v projekte
  const [artifacts, setArtifacts] = useState<Artifact[]>([]); //nacitane artifacty(generated files) v projekte
  const [collaborators, setCollaborators] = useState<any[]>([]); // nacitane kolaboratory
  const [loading, setLoading] = useState(true); //ci sa nacitavaju data
  const [err, setErr] = useState<string | null>(null); //chyba pri nacitani

  const [selectedArtifacts, setSelectedArtifacts] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState(false);
  const [newColabEmail, setNewColabEmail] = useState("");
  const [colabLoading, setColabLoading] = useState(false);

  //statistika objektov podla typu (generovane AI)
  const typesSummary = useMemo(() => { //prepočíta sa len keď sa zmenia objekty a pri prvom renderi
    const map = new Map<string, number>(); //mapa typ->pocet kusov
    for (const o of objects) map.set(o.type, (map.get(o.type) ?? 0) + 1);//inkrementuj pocet pre dany typ ak neexistuje tak 0
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);//zoradi zostupne podla poctu(najvacsi hore)
  }, [objects]);

  //zapne loading a vymaze stary error
  async function load() {
    setLoading(true);
    setErr(null);
    setSelectedArtifacts(new Set()); // zmazat vyber pri nahrati

    //nacitanie projektu, objektov projektu, artefaktov projektu
    try {
      // READ
      const pRes = await fetch(`/api/projects/${projectId}`);
      const pJson = await pRes.json().catch(() => null);
      if (!pRes.ok) throw new Error(pJson?.error ?? "Failed to load project.");

      const isOwnerOrCollab = pJson.is_owner || pJson.is_collaborator;

      // READ
      const oRes = isOwnerOrCollab ? await fetch(`/api/objects?project_id=${projectId}`) : null;
      const oJson = oRes ? await oRes.json().catch(() => null) : [];
      if (oRes && !oRes.ok) throw new Error(oJson?.error ?? "Failed to load objects.");

      // READ
      const aRes = isOwnerOrCollab ? await fetch(`/api/generated`) : null;
      const aJson = aRes ? await aRes.json().catch(() => null) : [];
      if (aRes && !aRes.ok) throw new Error(aJson?.error ?? "Failed to load artifacts.");

      setProject(pJson as Project);
      setObjects(Array.isArray(oJson) ? (oJson as Obj3D[]) : []);
      setArtifacts(
        Array.isArray(aJson) ? (aJson as Artifact[]).filter((x) => x?.project_id === projectId) : [] //vyfiltruj len artefakty daneho projektu
      );

      if (isOwnerOrCollab) {
        const cRes = await fetch(`/api/projects/${projectId}/collaborators`);
        if (cRes.ok) {
          const cJson = await cRes.json();
          setCollaborators(cJson || []);
        }
      } else {
        setCollaborators([]);
      }
    } catch (e: any) {
      setErr(e?.message ?? "Load failed.");
      setProject(null);
      setObjects([]);
      setArtifacts([]);
    } finally {
      setLoading(false);
    }
  }
  //vzdy ked sa zmeni projectId (inicialne alebo ked user prejde na iny projekt) tak sa zavola load
  useEffect(() => {
    if (!projectId) return;
    void load();
  }, [projectId]);

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
        link.target = "_blank"; // v zaleźitosti obcas je toto fajn
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
      await load();
    } catch (e: any) {
      alert("Failed to delete some files");
    } finally {
      setActionLoading(false);
    }
  };

  const handleVisibilityChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newVis = e.target.value;
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: newVis }),
      });
      if (!res.ok) throw new Error("Failed to change visibility");
      alert("Visibility updated.");
      await load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddCollaborator = async () => {
    if (!newColabEmail) return;
    setColabLoading(true);
    try {
      // Find the user by email via user search or direct fetch if available?
      // Searching user via /api/users/search?q=email
      const uRes = await fetch(`/api/users/search?q=${encodeURIComponent(newColabEmail)}`);
      if (!uRes.ok) throw new Error("Failed to search user");
      const users = await uRes.json();
      
      const targetUser = users.find((u: any) => u.email === newColabEmail || u.id === newColabEmail);
      if (!targetUser) throw new Error("User not found by email or ID");

      const res = await fetch(`/api/projects/${projectId}/collaborators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: targetUser.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add collaborator");

      alert("Collaborator added.");
      setNewColabEmail("");
      await load();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setColabLoading(false);
    }
  };

  const handleRemoveCollaborator = async (userId: string) => {
    if (!confirm("Remove this collaborator?")) return;
    setColabLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/collaborators/${userId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove collaborator");
      alert("Collaborator removed.");
      await load();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setColabLoading(false);
    }
  };

  return (
    <main className="page p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Project details</h1>
          <div className="text-sm text-slate-400">ID: {projectId}</div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <a className="button-secondary" href="/projects">
            Back
          </a>
          <a className="button-secondary" href={`/editor?project=${projectId}`}>
            Open editor
          </a>
          <button className="button-secondary" onClick={() => load()} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      {loading && <p className="text-slate-400">Loading…</p>}

      {!loading && err && (
        <div className="card p-4">
          <div className="text-red-400 font-medium">Error</div>
          <div className="text-slate-300 mt-1">{err}</div>
        </div>
      )}

      {!loading && !err && project && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section className="card p-4">
            <h2 className="text-lg font-medium mb-3">Project</h2>

            <div className="text-sm text-slate-400">Name</div>
            <div className="text-slate-100 mb-3">{project.name}</div>

            <div className="text-sm text-slate-400">Description</div>
            <div className="text-slate-100 mb-3">
              {project.description ? project.description : <span className="text-slate-500">—</span>}
            </div>

            <div className="text-sm text-slate-400">Created</div>
            <div className="text-slate-100">{new Date(project.created_at).toLocaleString()}</div>

            {project.is_owner && (
              <>
                <div className="text-sm text-slate-400 mt-3">Visibility</div>
                <select
                  value={project.visibility || "private"}
                  onChange={handleVisibilityChange}
                  className="input mt-1"
                >
                  <option value="private">Private</option>
                  <option value="friends">Friends</option>
                  <option value="public">Public</option>
                </select>
              </>
            )}
            
            {!project.is_owner && (
              <>
                <div className="text-sm text-slate-400 mt-3">Visibility</div>
                <div className="text-slate-100 capitalize">{project.visibility || "private"}</div>
              </>
            )}
          </section>

          <section className="card p-4">
            <h2 className="text-lg font-medium mb-3">Stats</h2>

            <div className="flex items-center justify-between py-2 border-b border-slate-800">
              <div className="text-slate-300">Objects</div>
              <div className="font-medium">{objects.length}</div>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-800">
              <div className="text-slate-300">Generated files</div>
              <div className="font-medium">{artifacts.length}</div>
            </div>

            <div className="mt-4">
              <div className="text-sm text-slate-400 mb-2">Objects by type</div>
              {typesSummary.length === 0 && <div className="text-slate-500 text-sm">—</div>}
              {typesSummary.length > 0 && (
                <ul className="space-y-1 text-sm">
                  {typesSummary.map(([t, c]) => (
                    <li key={t} className="flex items-center justify-between">
                      <span className="text-slate-300">{t}</span>
                      <span className="text-slate-100">{c}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      )}

      {!loading && !err && project && project.is_owner && (
        <section className="card p-4 mt-6">
           <h2 className="text-lg font-medium mb-3">Collaborators</h2>
           <div className="flex gap-2 items-center mb-4">
             <input
               className="input flex-1 max-w-sm"
               placeholder="User Email or ID"
               value={newColabEmail}
               onChange={(e) => setNewColabEmail(e.target.value)}
             />
             <button
               className="button-primary"
               onClick={handleAddCollaborator}
               disabled={colabLoading || !newColabEmail}
             >
               Add
             </button>
           </div>
           
           {collaborators.length === 0 ? (
             <p className="text-sm text-slate-500">No collaborators.</p>
           ) : (
             <ul className="space-y-2">
               {collaborators.map(c => (
                 <li key={c.user_id} className="flex items-center justify-between bg-slate-900 px-3 py-2 rounded">
                   <div className="text-sm text-slate-300">{c.users?.email || c.user_id}</div>
                   <button
                     className="text-red-400 text-sm hover:text-red-300"
                     onClick={() => handleRemoveCollaborator(c.user_id)}
                     disabled={colabLoading}
                   >
                     Remove
                   </button>
                 </li>
               ))}
             </ul>
           )}
        </section>
      )}

      {!loading && !err && project && (
        <section className="card p-4 mt-6">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
            <h2 className="text-lg font-medium">Generated files</h2>
            {artifacts.length > 0 && (
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-slate-200">
                  <input
                    type="checkbox"
                    className="rounded bg-slate-800 border-slate-700 text-blue-500 focus:ring-blue-500 cursor-pointer"
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
            <p className="text-slate-500">No generated files.</p>
          ) : (
            <ul className="space-y-3">
              {artifacts.map((it) => (
                <li key={it.id} className="bg-slate-900 rounded px-4 py-3 flex items-center gap-4 hover:bg-slate-800 transition-colors">
                  <input
                    type="checkbox"
                    className="rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500 cursor-pointer w-4 h-4"
                    checked={selectedArtifacts.has(it.id)}
                    onChange={() => toggleSelection(it.id)}
                  />
                  <div className="flex-1 flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <div className="font-medium">{it.filename}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        {(it.kind ?? "artifact")} • {new Date(it.created_at).toLocaleString()}
                      </div>
                    </div>

                    <a className="button-secondary" href={`/api/generated/${it.id}`} target="_blank" rel="noreferrer">
                      Download
                    </a>
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
