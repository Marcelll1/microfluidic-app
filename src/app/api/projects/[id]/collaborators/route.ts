import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

type Ctx = { params: { id: string } | Promise<{ id: string }> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // verify owner or collaborator
  const { data: project } = await supabase
    .from("projects")
    .select("owner_id")
    .eq("id", id)
    .single();

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const isOwner = project.owner_id === auth.user.id || auth.user.role === "admin";
  
  const { data: colabs } = await supabase
    .from("project_collaborators")
    .select("user_id")
    .eq("project_id", id)
    .eq("user_id", auth.user.id);

  const isCollaborator = !!colabs?.length;

  if (!isOwner && !isCollaborator) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch collaborators with emails
  const { data, error } = await supabase
    .from("project_collaborators")
    .select(`
      user_id,
      created_at,
      users ( email )
    `)
    .eq("project_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 200 });
}

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check if owner
  const { data: project } = await supabase
    .from("projects")
    .select("owner_id")
    .eq("id", id)
    .single();
  
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (project.owner_id !== auth.user.id && auth.user.role !== "admin") {
    return NextResponse.json({ error: "Only project owner can add collaborators" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !body.user_id) return NextResponse.json({ error: "user_id is required" }, { status: 400 });

  if (body.user_id === project.owner_id) {
    return NextResponse.json({ error: "Cannot add owner as collaborator" }, { status: 400 });
  }

  const { error } = await supabase
    .from("project_collaborators")
    .insert({ project_id: id, user_id: body.user_id });

  if (error) {
    if (error.code === '23505') {
       return NextResponse.json({ error: "User is already a collaborator" }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAudit({
    user_id: auth.user.id,
    action: "add_collaborator",
    entity: "project",
    entity_id: id,
    meta: { added_user: body.user_id }
  });

  return NextResponse.json({ success: true }, { status: 200 });
}
