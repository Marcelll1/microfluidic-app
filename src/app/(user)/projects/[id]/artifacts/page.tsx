"use client";

import { useEffect, useState } from "react";

type Artifact = {
  id: string;
  filename: string;
  created_at: string;
  project_id: string;
  kind?: string;
};

export default function ProjectArtifactsPage({ params }: { params: { id: string } }) {
  const projectId = params.id;

  const [items, setItems] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      // READ artifacts (fetch all and filter by project_id)
      const res = await fetch("/api/generated");
      const json = await res.json().catch(() => null);

      if (!res.ok) throw new Error(json?.error ?? "Failed to load artifacts.");

      const all = Array.isArray(json) ? (json as Artifact[]) : [];
      setItems(all.filter((x) => x?.project_id === projectId));
    } catch (e: any) {
      setErr(e?.message ?? "Load failed.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [projectId]);

  return (
    <main className="page p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Project artifacts</h1>
          <div className="text-sm text-slate-400">Project ID: {projectId}</div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <a className="button-secondary" href="/projects">
            Back
          </a>
          <a className="button-secondary" href={`/projects/${projectId}/details`}>
            Details
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

      {!loading && !err && items.length === 0 && <p className="text-slate-500">No generated files.</p>}

      {!loading && !err && items.length > 0 && (
        <section className="card p-4">
          <h2 className="text-lg font-medium mb-4">Generated files</h2>

          <ul className="space-y-3">
            {items.map((it) => (
              <li key={it.id} className="bg-slate-900 rounded px-4 py-3">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <div className="font-medium">{it.filename}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {(it.kind ?? "artifact")} • {new Date(it.created_at).toLocaleString()}
                    </div>
                  </div>

                  <a className="button-secondary" href={`/api/generated/${it.id}`}>
                    Download
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
