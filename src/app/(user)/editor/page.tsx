"use client";

import { useSearchParams } from "next/navigation";
import Scene3D from "@/components/scene/Scene3D";



export default function EditorPage() {
  // Later this id will be used to load/save from DB
  const search = useSearchParams();
  const projectId = search.get("project") ?? null;

  return (
    <main className="h-[calc(100vh-0px)] w-full">
      <Scene3D projectId={projectId} />
    </main>
  );
}
