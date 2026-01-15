import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // ADMIN: všetky projekty + owner email
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
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const mapped = (data ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      created_at: p.created_at,
      owner_id: p.owner_id,
      owner_email: p.users?.email ?? "unknown",
    }));

    return NextResponse.json(mapped);
  }

  // USER: len svoje
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, description, created_at")
    .eq("owner_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";

  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  if (name.length < 3 || name.length > 100) {
    return NextResponse.json({ error: "Name must be 3–100 chars." }, { status: 400 });
  }
  if (description.length > 500) {
    return NextResponse.json({ error: "Description max 500 chars." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({
      name,
      description: description || null,
      owner_id: auth.user.id,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
