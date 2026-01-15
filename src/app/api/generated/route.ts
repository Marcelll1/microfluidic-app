import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // admin vidí všetko
  if (auth.user.role === "admin") {
    const { data, error } = await supabase
      .from("generated_artifacts")
      .select(
        `
        id,
        kind,
        filename,
        created_at,
        project_id,
        projects:project_id ( name, owner_id ),
        users:created_by ( email )
      `
      )
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const mapped = (data ?? []).map((r: any) => ({
      id: r.id,
      kind: r.kind,
      filename: r.filename,
      created_at: r.created_at,
      project_id: r.project_id,
      project_name: r.projects?.name ?? "unknown",
      created_by_email: r.users?.email ?? "unknown",
      owner_id: r.projects?.owner_id ?? null,
    }));

    return NextResponse.json(mapped);
  }

  // user vidí svoje (generované ním)
  const { data, error } = await supabase
    .from("generated_artifacts")
    .select("id,kind,filename,created_at,project_id")
    .eq("created_by", auth.user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
