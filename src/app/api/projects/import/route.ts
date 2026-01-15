import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => null);
  if (!body?.project?.name || !Array.isArray(body?.objects)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const name = String(body.project.name).slice(0, 200);
  const description = body.project.description ? String(body.project.description).slice(0, 2000) : null;

  const { data: created, error: e1 } = await supabase
    .from("projects")
    .insert({ name, description, owner_id: auth.user.id })
    .select("id")
    .maybeSingle();

  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
  if (!created) return NextResponse.json({ error: "Create failed" }, { status: 500 });

  const project_id = created.id;

  const rows = body.objects.map((o: any) => ({
    project_id,
    type: o.type,
    pos_x: o.pos_x,
    pos_y: o.pos_y,
    pos_z: o.pos_z,
    rotation_y: o.rotation_y ?? 0,
    params: o.params ?? {},
  }));

  if (rows.length > 0) {
    const { error: e2 } = await supabase.from("object3d").insert(rows);
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, project_id });
}
