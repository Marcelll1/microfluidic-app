import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// kontrola prístupu k projektu
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

// validácia vstupu pre CREATE objektu
const CreateObjectSchema = z.object({
  project_id: z.string().regex(UUID_RE, "Invalid project_id"),
  type: z.string().min(1).max(50),
  pos_x: z.number(),
  pos_y: z.number(),
  pos_z: z.number(),
  rotation_y: z.number(),
  params: z.any().optional(),
});

// CREATE
// vytvorí jeden objekt v DB (explicitný CRUD CREATE pre object3d)
export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => null);
  const parsed = CreateObjectSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const access = await canAccessProject(parsed.data.project_id);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const { data, error } = await supabase
    .from("object3d")
    .insert({
      project_id: parsed.data.project_id,
      type: parsed.data.type.trim(),
      pos_x: parsed.data.pos_x,
      pos_y: parsed.data.pos_y,
      pos_z: parsed.data.pos_z,
      rotation_y: parsed.data.rotation_y,
      params: parsed.data.params ?? {},
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    user_id: access.user.id,
    action: "create",
    entity: "object3d",
    entity_id: data.id,
    meta: { project_id: parsed.data.project_id, type: data.type },
  });

  return NextResponse.json(data, { status: 201 });
}
