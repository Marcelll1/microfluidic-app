import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> } // In Next 15, params is a Promise
) {
  const auth = await requireUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const is_template = !!body.is_template;

  // Verify ownership or admin
  const { data: project, error: getErr } = await supabase
    .from("projects")
    .select("owner_id")
    .eq("id", id)
    .single();

  if (getErr || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (auth.user.role !== "admin" && project.owner_id !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("projects")
    .update({ is_template })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAudit({
    user_id: auth.user.id,
    action: is_template ? "make_template" : "remove_template",
    entity: "project",
    entity_id: id,
    meta: { previous: !is_template, current: is_template },
  });

  return NextResponse.json(data);
}
