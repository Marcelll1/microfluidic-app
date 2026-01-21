import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// Next.js: params môžu byť async → treba await
type Ctx = { params: { id: string } | Promise<{ id: string }> };

//regex pre validáciu UUID(vstupna validácia)
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// kontrola prístupu k projektu (owner alebo admin)
async function canAccessProject(projectId: string) {
  const auth = await requireUser();
  if (!auth.ok) return auth;

  // načítanie projektu
  const { data: project, error } = await supabase
    .from("projects")
    .select("id, owner_id, name, description, created_at")
    .eq("id", projectId)
    .maybeSingle();

  if (error) return { ok: false as const, status: 500 as const, error: error.message }; // chyba DB
  if (!project) return { ok: false as const, status: 404 as const, error: "Project not found" }; // neexistujúci projekt

  // kontrola vlastníctva alebo admin
  if (auth.user.role !== "admin" && project.owner_id !== auth.user.id) {
    return { ok: false as const, status: 403 as const, error: "Forbidden" }; // nedostatočné práva
  }

  // úspech
  return { ok: true as const, user: auth.user, project };
}

// READ
// vráti detail jedného projektu
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params; // FIX: await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid project id" }, { status: 400 });// overenie formátu UUID ak nieje validný id vráti chybu 400

  const access = await canAccessProject(id);// kontrola prístupu
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });// chyba prístupu

  return NextResponse.json(access.project, { status: 200 });// vrátenie detailu projektu
}

// UPDATE
// upraví name/description projektu
export async function PATCH(req: Request, ctx: Ctx) { //zoberie id + UUID check
  const { id } = await ctx.params; // FIX: await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid project id" }, { status: 400 }); // overenie formátu UUID

  const access = await canAccessProject(id); // kontrola prístupu
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });// chyba prístupu

  // načítanie a validácia vstupu
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {// overenie platnosti JSON musi byť objekt
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // extrakcia voliteľných polí
  const name = typeof (body as any).name === "string" ? (body as any).name.trim() : undefined;
  const description =
    typeof (body as any).description === "string" ? (body as any).description.trim() : undefined;

  const patch: any = {}; // objekt pre aktualizáciu

  // validácia + patch
  if (name !== undefined) {
    if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    if (name.length < 3 || name.length > 100)
      return NextResponse.json({ error: "Name must be 3–100 chars." }, { status: 400 });
    patch.name = name;
  }
  // validácia + patch
  if (description !== undefined) {
    if (description.length > 500)
      return NextResponse.json({ error: "Description max 500 chars." }, { status: 400 });
    patch.description = description || null;
  }
  // žiadne polia na aktualizáciu
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }
  // vykonanie aktualizácie
  const { data, error } = await supabase
    .from("projects")
    .update(patch)
    .eq("id", id)
    .select("id, name, description, created_at, owner_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // zaznamenanie auditu aktualizácie projektu
  await logAudit({
    user_id: access.user.id,
    action: "update",
    entity: "project",
    entity_id: id,
    meta: { fields: Object.keys(patch) },
  });

  return NextResponse.json(data, { status: 200 });
}

// DELETE
// zmaže projekt a jeho object3d
export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params; // FIX: await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid project id" }, { status: 400 });

  const access = await canAccessProject(id);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  // DELETE: objekty projektu
  const { error: delObjErr } = await supabase.from("object3d").delete().eq("project_id", id);
  if (delObjErr) return NextResponse.json({ error: delObjErr.message }, { status: 500 });

  // DELETE: projekt
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
