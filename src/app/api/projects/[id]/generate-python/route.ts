import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";
import { generatePythonBoundaries } from "@/lib/pythonBoundaries";

export async function POST(
  _: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: projectId } = await params;

  const { data: project, error: e1 } = await supabase
    .from("projects")
    .select("id,owner_id,name")
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

  const code = generatePythonBoundaries(objects ?? []);
  const safeName = String(project.name ?? "project").replace(/[^a-z0-9_-]+/gi, "_");
  const filename = `boundaries_${safeName}.py`;

  const { data: inserted, error: e3 } = await supabase
    .from("generated_artifacts")
    .insert({
      project_id: projectId,
      created_by: auth.user.id,
      kind: "python_boundaries",
      filename,
      content: code,
    })
    .select("id,filename,created_at")
    .single();

  if (e3) return NextResponse.json({ error: e3.message }, { status: 500 });

  return NextResponse.json({ ok: true, artifact: inserted });
}
