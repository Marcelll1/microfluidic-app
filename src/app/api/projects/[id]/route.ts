import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

type Ctx = { params: { id: string } };

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

export async function DELETE(_req: Request, ctx: Ctx) {
  const id = ctx.params.id;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid project id" }, { status: 400 });

  const access = await canAccessProject(id);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { error: delObjErr } = await supabase.from("object3d").delete().eq("project_id", id);
  if (delObjErr) return NextResponse.json({ error: delObjErr.message }, { status: 500 });

  const { error: delProjErr } = await supabase.from("projects").delete().eq("id", id);
  if (delProjErr) return NextResponse.json({ error: delProjErr.message }, { status: 500 });

  await logAudit({
    user_id: access.user.id,
    action: "delete",
    entity: "project",
    entity_id: id,
  });

  return NextResponse.json({ success: true }, { status: 200 });
}
