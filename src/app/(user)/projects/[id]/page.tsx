"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ProjectIdPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const projectId = params.id;

  // READ (routing)
  // táto stránka existuje len ako vstupný bod pre /projects/[id]
  // reálne otvorí editor
  useEffect(() => {
    router.replace(`/editor?project=${projectId}`);
  }, [router, projectId]);

  return (
    <main className="page p-6 max-w-3xl mx-auto">
      <p className="text-slate-400">Opening editor…</p>
    </main>
  );
}
