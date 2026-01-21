import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// READ
// - user: vráti len jeho projekty
// - admin: vráti všetky projekty + owner email
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // READ (admin)
  if (auth.user.role === "admin") {
    const { data, error } = await supabase
      .from("projects")
      .select(
        `
        id,
        name,
        description,
        created_at,
        owner_id,
        users:owner_id (
          email
        )
      `
      )
      .order("created_at", { ascending: false });//najnovšie projekty prvé

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // mapovanie výsledkov na požadovaný formát vrátane emailu vlastníka
    const mapped = (data ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      created_at: p.created_at,
      owner_id: p.owner_id,
      owner_email: p.users?.email ?? "unknown", //priradenie emailu vlastníka alebo "unknown"
    }));

    return NextResponse.json(mapped);//vrátenie zoznamu projektov pre admina
  }

  // READ (user)
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, description, created_at")
    .eq("owner_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// CREATE
// vytvorí nový projekt pre prihláseného používateľa
export async function POST(req: Request) {
  const auth = await requireUser();//overenie prihlásenia používateľa
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // načítanie a validácia vstupu
  const body = await req.json().catch(() => null); //ošetrenie chýb pri parsovaní JSON
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";

  // validácia vstupu na serveri
  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  if (name.length < 3 || name.length > 100)
    return NextResponse.json({ error: "Name must be 3–100 chars." }, { status: 400 });
  if (description.length > 500)
    return NextResponse.json({ error: "Description max 500 chars." }, { status: 400 });

  // vloženie nového projektu do databázy
  const { data, error } = await supabase
    .from("projects")
    .insert({
      name,
      description: description || null,
      owner_id: auth.user.id,
    })
    .select("*") //vrátiť vložený riadok
    .single(); //očakáva sa len jeden vložený riadok

  if (error) return NextResponse.json({ error: error.message }, { status: 500 }); //chyba pri vložení

  // zaznamenanie auditu vytvorenia projektu
  await logAudit({
    user_id: auth.user.id,
    action: "create",
    entity: "project",
    entity_id: data.id,
    meta: { name },
  });

  return NextResponse.json(data, { status: 201 });
}
