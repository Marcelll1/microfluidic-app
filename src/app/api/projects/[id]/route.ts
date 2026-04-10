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
async function canAccessProject(projectId: string, isUpdate: boolean = false) {
  const auth = await requireUser();
  if (!auth.ok) return auth;

  // načítanie projektu
  const { data: project, error } = await supabase
    .from("projects")
    .select("id, owner_id, name, description, created_at, thumbnail, visibility")
    .eq("id", projectId)
    .maybeSingle();

  if (error) return { ok: false as const, status: 500 as const, error: error.message }; // chyba DB
  if (!project) return { ok: false as const, status: 404 as const, error: "Project not found" }; // neexistujúci projekt

  const is_owner = auth.user.role === "admin" || project.owner_id === auth.user.id;

  // fetch collaborator status
  const { data: colab } = await supabase
    .from("project_collaborators")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  const is_collaborator = !!colab;
  const can_edit = is_owner || is_collaborator;

  // iba owner moze updatovat nazov, popis, visibility (PATCH) alebo mazat (DELETE)
  if (isUpdate && !is_owner) {
    return { ok: false as const, status: 403 as const, error: "Only project owner can manage project details" };
  }

  const visibility = project.visibility || "private";

  if (!can_edit) {
    if (visibility === "private") {
      return { ok: false as const, status: 403 as const, error: "Forbidden" }; // private project
    }
    if (visibility === "friends") {
      const { data: b1 } = await supabase
        .from("friends")
        .select("id")
        .eq("status", "accepted")
        .eq("user_id1", project.owner_id)
        .eq("user_id2", auth.user.id)
        .maybeSingle();

      const { data: b2 } = await supabase
        .from("friends")
        .select("id")
        .eq("status", "accepted")
        .eq("user_id1", auth.user.id)
        .eq("user_id2", project.owner_id)
        .maybeSingle();

      if (!b1 && !b2) {
        return { ok: false as const, status: 403 as const, error: "Must be a friend to view this project" };
      }
    }
  }

  // úspech
  return { ok: true as const, user: auth.user, project, is_owner, is_collaborator, can_edit };
}

// READ
// vráti detail jedného projektu
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params; // FIX: await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid project id" }, { status: 400 });// overenie formátu UUID ak nieje validný id vráti chybu 400

  const access = await canAccessProject(id, false);// kontrola prístupu
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });// chyba prístupu

  return NextResponse.json({
    ...access.project,
    is_owner: access.is_owner,
    is_collaborator: access.is_collaborator,
    can_edit: access.can_edit,
  }, { status: 200 });// vrátenie detailu projektu
}

// UPDATE
// upraví name/description/visibility projektu
export async function PATCH(req: Request, ctx: Ctx) { //zoberie id + UUID check
  const { id } = await ctx.params; // FIX: await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid project id" }, { status: 400 }); // overenie formátu UUID

  const access = await canAccessProject(id, true); // kontrola prístupu (true pre update)
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
  const thumbnail = typeof (body as any).thumbnail === "string" ? (body as any).thumbnail : undefined;
  const visibility = typeof (body as any).visibility === "string" ? (body as any).visibility : undefined;

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
  // thumbnail patch
  if (thumbnail !== undefined) {
    patch.thumbnail = thumbnail || null;
  }
  if (visibility !== undefined) {
    if (!["private", "friends", "public"].includes(visibility)) {
      return NextResponse.json({ error: "Invalid visibility." }, { status: 400 });
    }
    patch.visibility = visibility;
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
    .select("id, name, description, created_at, owner_id, thumbnail")
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
