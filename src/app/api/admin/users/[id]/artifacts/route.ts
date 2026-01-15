import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabase } from "@/lib/supabaseServer";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const userId = params.id;

  const { data, error } = await supabase
    .from("generated_artifacts")
    .select(
      `
      id,
      kind,
      filename,
      created_at,
      project_id,
      projects:project_id ( name, owner_id )
    `
    )
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const filtered = (data ?? []).filter((a: any) => a.projects?.owner_id === userId);
  const mapped = filtered.map((a: any) => ({
    id: a.id,
    kind: a.kind,
    filename: a.filename,
    created_at: a.created_at,
    project_id: a.project_id,
    project_name: a.projects?.name ?? "unknown",
  }));

  return NextResponse.json(mapped);
}
