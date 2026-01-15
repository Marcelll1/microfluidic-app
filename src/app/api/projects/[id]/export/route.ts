import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const projectId = params.id;

  const { data: project, error: e1 } = await supabase
    .from("projects")
    .select("id,name,description,created_at,owner_id")
    .eq("id", projectId)
    .maybeSingle();

  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  if (auth.user.role !== "admin" && project.owner_id !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: objects, error: e2 } = await supabase
    .from("object3d")
    .select("type,pos_x,pos_y,pos_z,rotation_y,params,created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

  return NextResponse.json({
    exported_at: new Date().toISOString(),
    project: { name: project.name, description: project.description },
    objects: objects ?? [],
  });
}
