import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// regulárny výraz pre validáciu UUID
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// kontrola prístupu k projektu
async function canAccessProject(projectId: string) {
  const auth = await requireUser();
  if (!auth.ok) return auth;

  // načítanie projektu
  const { data: project, error } = await supabase
    .from("projects")
    .select("id, owner_id")
    .eq("id", projectId)
    .maybeSingle();

    // kontrola prístupu
  if (error) return { ok: false as const, status: 500 as const, error: error.message };
  if (!project) return { ok: false as const, status: 404 as const, error: "Project not found" };

  // kontrola vlastníctva alebo admin
  if (auth.user.role !== "admin" && project.owner_id !== auth.user.id) {
    return { ok: false as const, status: 403 as const, error: "Forbidden" };
  }

  return { ok: true as const, user: auth.user };
}

// validácia objektu (pre SAVE celej scény)
const ObjectSchema = z.object({
  type: z.union([z.string().min(1), z.null(), z.undefined()]).transform((v) => (v ?? "")),
  pos_x: z.number(),
  pos_y: z.number(),
  pos_z: z.number(),
  rotation_y: z.number(),
  params: z.any().optional(),
});

// validácia payloadu pre uloženie scény
const SaveSchema = z.object({
  project_id: z.string().regex(UUID_RE, "Invalid project_id"),// validácia project_id
  objects: z.array(ObjectSchema),// pole objektov
});

// READ
// vráti všetky objekty pre projekt
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);// získanie searchParams z URL
  const projectId = searchParams.get("project_id");// získanie project_id

  if (!projectId) return NextResponse.json({ error: "Missing project_id" }, { status: 400 });// kontrola prítomnosti project_id
  if (!UUID_RE.test(projectId)) return NextResponse.json({ error: "Invalid project_id" }, { status: 400 });// validácia formátu UUID

  const access = await canAccessProject(projectId);// kontrola prístupu
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });// 

  // načítanie objektov patriacich k projektu
  const { data, error } = await supabase
    .from("object3d")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// UPDATE (save scene)
// uloží celú scénu: zmaže staré a vloží nové (bulk replace)
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = SaveSchema.safeParse(body);// validácia payloadu

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // získanie údajov z validovaného payloadu
  const projectId = parsed.data.project_id;
  const objects = parsed.data.objects;

  //  kontrola prístupu
  const access = await canAccessProject(projectId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const normalized = objects.map((o) => ({
    project_id: projectId,
    type: o.type,
    pos_x: o.pos_x,
    pos_y: o.pos_y,
    pos_z: o.pos_z,
    rotation_y: o.rotation_y,
    params: o.params ?? {},
  }));

  // DELETE (bulk) – zmaže všetky objekty projektu
  const { error: delError } = await supabase.from("object3d").delete().eq("project_id", projectId);// zmaže všetky objekty patriace k projektu
  if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });// kontrola chýb pri mazání

  // CREATE (bulk) – vloží nové objekty
  if (normalized.length > 0) {
    const { error: insError } = await supabase.from("object3d").insert(normalized);// vloží nové objekty
    if (insError) return NextResponse.json({ error: insError.message }, { status: 500 });// kontrola chýb pri vkladaní
  }

  // zaznamenanie auditu uloženia scény
  await logAudit({
    user_id: access.user.id,
    action: "save_scene",
    entity: "project",
    entity_id: projectId,
    meta: { objectsCount: normalized.length },
  });

  return NextResponse.json({ success: true }, { status: 200 });
}
