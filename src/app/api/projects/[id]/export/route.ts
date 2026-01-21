import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";

export async function GET(
  _: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> }// pridanie typov pre params
) {
  const auth = await requireUser();//overenie prihlásenia používateľa
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // získanie id projektu z parametrov
  const { id: projectId } = await params;

  // načítanie projektu
  const { data: project, error: e1 } = await supabase
    .from("projects")
    .select("id,owner_id,name,description,created_at")
    .eq("id", projectId)
    .maybeSingle();

    // kontrola prístupu (vlastník alebo admin)
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  if (auth.user.role !== "admin" && project.owner_id !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // načítanie 3D objektov patriacich k projektu
  const { data: objects, error: e2 } = await supabase
    .from("object3d")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

    // vrátenie detailu projektu spolu s jeho 3D objektmi
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

  return NextResponse.json({ project, objects: objects ?? [] });
}
