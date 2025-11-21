"use client";

import { useSearchParams } from "next/navigation";
import Scene3D from "@/components/scene/Scene3D";

export default function EditorPage() {
  const search = useSearchParams();
  const projectId = search.get("project") ?? null;

  return (
    <main className="h-[calc(100vh-60px)] w-full">
      <Scene3D projectId={projectId} />
    </main>
  );
}
