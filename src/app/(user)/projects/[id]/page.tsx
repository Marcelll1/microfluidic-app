"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ProjectIdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const router = useRouter();

  // READ (routing)
  // táto stránka existuje len ako vstupný bod pre /projects/[id]
  // reálne otvorí editor
  useEffect(() => {
    router.replace(`/editor?project=${projectId}`);//replace a nie push aby sa nedalo vratit spat na tuto stranku(loop)
  }, [router, projectId]);

  return (
    <main className="page p-6 max-w-3xl mx-auto">
      <p className="text-slate-400">Opening editor…</p>
    </main>
  );
}
