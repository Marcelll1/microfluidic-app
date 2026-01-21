"use client";

import { useSearchParams } from "next/navigation";
import Scene3D from "@/components/scene/Scene3D";//hlavny editor Three.js komponent

export default function EditorPage() {
  const search = useSearchParams();//ziska query parametre z URL
  const projectId = search.get("project") ?? null;//ziska hodnotu parametra "project"

  //rendruje Scene3D s parametrom projectId
  return (
    <main className="h-[calc(100vh-60px)] w-full">
      <Scene3D projectId={projectId} />
    </main>
  );
}
