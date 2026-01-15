import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function canAccessProject(projectId: string) {
  const auth = await requireUser();
  if (!auth.ok) return auth;

  const { data: project, error } = await supabase
    .from("projects")
    .select("id, owner_id")
    .eq("id", projectId)
    .maybeSingle();

  if (error) return { ok: false as const, status: 500 as const, error: error.message };
  if (!project) return { ok: false as const, status: 404 as const, error: "Project not found" };

  if (auth.user.role !== "admin" && project.owner_id !== auth.user.id) {
    return { ok: false as const, status: 403 as const, error: "Forbidden" };
  }

  return { ok: true as const, user: auth.user };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("project_id");

  if (!projectId) return NextResponse.json({ error: "Missing project_id" }, { status: 400 });
  if (!UUID_RE.test(projectId))
    return NextResponse.json({ error: "Invalid project_id" }, { status: 400 });

  const access = await canAccessProject(projectId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { data, error } = await supabase
    .from("object3d")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const projectId = (body as any).project_id;
  const objects = (body as any).objects;

  if (typeof projectId !== "string" || !UUID_RE.test(projectId)) {
    return NextResponse.json({ error: "Invalid project_id" }, { status: 400 });
  }
  if (!Array.isArray(objects)) {
    return NextResponse.json({ error: "Invalid objects" }, { status: 400 });
  }

  const access = await canAccessProject(projectId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const normalized = objects.map((o: any) => ({
    project_id: projectId,
    type: o?.type,
    pos_x: o?.pos_x,
    pos_y: o?.pos_y,
    pos_z: o?.pos_z,
    rotation_y: o?.rotation_y,
    params: o?.params ?? {},
  }));

  const { error: delError } = await supabase.from("object3d").delete().eq("project_id", projectId);
  if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });

  const { error: insError } = await supabase.from("object3d").insert(normalized);
  if (insError) return NextResponse.json({ error: insError.message }, { status: 500 });

  return NextResponse.json({ success: true }, { status: 200 });
}
