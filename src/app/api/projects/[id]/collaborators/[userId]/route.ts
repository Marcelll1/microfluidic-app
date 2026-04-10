import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

type Ctx = { params: { id: string, userId: string } | Promise<{ id: string, userId: string }> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id, userId } = await ctx.params;
  
  if (!UUID_RE.test(id) || !UUID_RE.test(userId)) {
    return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
  }

  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project } = await supabase
    .from("projects")
    .select("owner_id")
    .eq("id", id)
    .single();

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only owner OR the collaborator themselves can remove
  if (project.owner_id !== auth.user.id && userId !== auth.user.id && auth.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase
    .from("project_collaborators")
    .delete()
    .eq("project_id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    user_id: auth.user.id,
    action: "remove_collaborator",
    entity: "project",
    entity_id: id,
    meta: { removed_user: userId }
  });

  return NextResponse.json({ success: true }, { status: 200 });
}
