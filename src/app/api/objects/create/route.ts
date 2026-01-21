import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";

// CREATE

// regulárny výraz pre validáciu UUID
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// helper - kontrola prístupu k projektu
async function canAccessProject(projectId: string) {
  const auth = await requireUser();
  if (!auth.ok) return auth;

  // načítanie projektu
  const { data: project, error } = await supabase
    .from("projects")
    .select("id, owner_id")
    .eq("id", projectId)
    .maybeSingle();

  if (error) return { ok: false as const, status: 500 as const, error: error.message };// chyba DB
  if (!project) return { ok: false as const, status: 404 as const, error: "Project not found" };// neexistujúci projekt

  if (auth.user.role !== "admin" && project.owner_id !== auth.user.id) {
    return { ok: false as const, status: 403 as const, error: "Forbidden" };
  }

  return { ok: true as const };
}

// validácia vstupu pre CREATE 1 objektu
const CreateObjectSchema = z.object({
  project_id: z.string().regex(UUID_RE),
  type: z.string().min(1).max(50),
  pos_x: z.number(),
  pos_y: z.number(),
  pos_z: z.number(),
  rotation_y: z.number(),
  params: z.any().optional(),
});

// CREATE - vytvorí 1 objekt v DB a vráti ho (vrátane id)
export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // načítanie a validácia vstupu
  const body = await req.json().catch(() => null);
  const parsed = CreateObjectSchema.safeParse(body);// validácia payloadu
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });// neplatný payload

  const access = await canAccessProject(parsed.data.project_id);// kontrola prístupu
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });// chyba prístupu

  // vloženie objektu do DB
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
    .select("*")// vracia vložený riadok
    .single();// očakáva jeden riadok

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
