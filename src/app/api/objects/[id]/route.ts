import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";

type Ctx = { params: { id: string } };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function canAccessObject(objectId: string) {
  const auth = await requireUser();
  if (!auth.ok) return auth;

  const { data: obj, error: oErr } = await supabase
    .from("object3d")
    .select("id, project_id")
    .eq("id", objectId)
    .maybeSingle();

  if (oErr) return { ok: false as const, status: 500 as const, error: oErr.message };
  if (!obj) return { ok: false as const, status: 404 as const, error: "Object not found" };

  const { data: project, error: pErr } = await supabase
    .from("projects")
    .select("id, owner_id")
    .eq("id", obj.project_id)
    .maybeSingle();

  if (pErr) return { ok: false as const, status: 500 as const, error: pErr.message };
  if (!project) return { ok: false as const, status: 404 as const, error: "Project not found" };

  if (auth.user.role !== "admin" && project.owner_id !== auth.user.id) {
    return { ok: false as const, status: 403 as const, error: "Forbidden" };
  }

  return { ok: true as const };
}

export async function PATCH(req: Request, ctx: Ctx) {
  const id = ctx.params.id;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid object id" }, { status: 400 });

  const access = await canAccessObject(id);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object")
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const patch: any = {};
  for (const k of ["pos_x", "pos_y", "pos_z", "rotation_y"]) {
    if (k in (body as any)) {
      const v = (body as any)[k];
      if (typeof v !== "number" || !Number.isFinite(v))
        return NextResponse.json({ error: `Invalid ${k}` }, { status: 400 });
      patch[k] = v;
    }
  }
  if ("params" in (body as any)) {
    const v = (body as any).params;
    if (v !== null && typeof v !== "object")
      return NextResponse.json({ error: "Invalid params" }, { status: 400 });
    patch.params = v;
  }

  if (Object.keys(patch).length === 0)
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const { data, error } = await supabase
    .from("object3d")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 200 });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const id = ctx.params.id;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid object id" }, { status: 400 });

  const access = await canAccessObject(id);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { error } = await supabase.from("object3d").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true }, { status: 200 });
}
