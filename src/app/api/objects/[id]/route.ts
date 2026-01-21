import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// UPDATE / DELETE

// Next.js: params môžu byť async → treba await
type Ctx = { params: { id: string } | Promise<{ id: string }> };

// regulárny výraz pre validáciu UUID
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// helper - kontrola prístupu k objektu (owner projektu alebo admin)
async function canAccessObject(objectId: string) {
  const auth = await requireUser();
  if (!auth.ok) return auth;

  // načítanie objektu
  const { data: obj, error: oErr } = await supabase
    .from("object3d")
    .select("id, project_id")
    .eq("id", objectId)
    .maybeSingle();

  if (oErr) return { ok: false as const, status: 500 as const, error: oErr.message };// chyba DB
  if (!obj) return { ok: false as const, status: 404 as const, error: "Object not found" };// neexistujúci objekt

  // načítanie projektu pre kontrolu vlastníctva
  const { data: project, error: pErr } = await supabase
    .from("projects")
    .select("id, owner_id")
    .eq("id", obj.project_id)
    .maybeSingle();

    // kontrola vlastníctva alebo admin
  if (pErr) return { ok: false as const, status: 500 as const, error: pErr.message };
  if (!project) return { ok: false as const, status: 404 as const, error: "Project not found" };

  if (auth.user.role !== "admin" && project.owner_id !== auth.user.id) {
    return { ok: false as const, status: 403 as const, error: "Forbidden" };
  }

  return { ok: true as const, user: auth.user, projectId: obj.project_id };
}

// UPDATE - upraví 1 objekt v DB
export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params; // FIX
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid object id" }, { status: 400 });// overenie formátu UUID

  const access = await canAccessObject(id);// kontrola prístupu
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });// chyba prístupu

  // načítanie a validácia vstupu
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object")
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const patch: any = {};// objekt pre update

  // povolené polia na update
  for (const k of ["pos_x", "pos_y", "pos_z", "rotation_y"]) {
    if (k in (body as any)) {
      const v = (body as any)[k];// ziskanie hodnoty
      // kontrola čísla
      if (typeof v !== "number" || !Number.isFinite(v))
        return NextResponse.json({ error: `Invalid ${k}` }, { status: 400 });// kontrola čísla
      patch[k] = v;
    }
  }

  if ("params" in (body as any)) {
    patch.params = (body as any).params;
  }

  if (Object.keys(patch).length === 0)// žiadne platné polia na update
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

    // vykonanie update v DB
  const { data, error } = await supabase
    .from("object3d")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });// chyba DB

  await logAudit({
    user_id: access.user.id,
    action: "update",
    entity: "object3d",
    entity_id: id,
    meta: { project_id: access.projectId, fields: Object.keys(patch) },
  });

  return NextResponse.json(data, { status: 200 });
}

// DELETE - zmaže 1 objekt z DB
export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params; // FIX
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid object id" }, { status: 400 });// overenie formátu UUID

  const access = await canAccessObject(id);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { error } = await supabase.from("object3d").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    user_id: access.user.id,
    action: "delete",
    entity: "object3d",
    entity_id: id,
    meta: { project_id: access.projectId },
  });

  return NextResponse.json({ success: true }, { status: 200 });
}
