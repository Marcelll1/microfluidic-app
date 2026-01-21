"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

//Typ projektu z GET /api/projects/:id
type Project = {
  id: string;
  name: string;
  description: string | null; //moze byt null
  created_at: string; //ISO datum
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
  const [loading, setLoading] = useState(true); //ci sa nacitavaju data
  const [err, setErr] = useState<string | null>(null); //chyba pri nacitani

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

    //nacitanie projektu, objektov projektu, artefaktov projektu
    try {
      // READ
      const pRes = await fetch(`/api/projects/${projectId}`);
      const pJson = await pRes.json().catch(() => null);
      if (!pRes.ok) throw new Error(pJson?.error ?? "Failed to load project.");

      // READ
      const oRes = await fetch(`/api/objects?project_id=${projectId}`);
      const oJson = await oRes.json().catch(() => null);
      if (!oRes.ok) throw new Error(oJson?.error ?? "Failed to load objects.");

      // READ
      const aRes = await fetch(`/api/generated`);
      const aJson = await aRes.json().catch(() => null);
      if (!aRes.ok) throw new Error(aJson?.error ?? "Failed to load artifacts.");

      setProject(pJson as Project);
      setObjects(Array.isArray(oJson) ? (oJson as Obj3D[]) : []);
      setArtifacts(
        Array.isArray(aJson) ? (aJson as Artifact[]).filter((x) => x?.project_id === projectId) : [] //vyfiltruj len artefakty daneho projektu
      );
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
          <a className="button-secondary" href={`/projects/${projectId}/artifacts`}>
            Artifacts
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
    </main>
  );
}
