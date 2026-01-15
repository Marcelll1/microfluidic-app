import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [{ count: usersCount, error: uErr }, { count: projectsCount, error: pErr }] =
    await Promise.all([
      supabase.from("users").select("*", { count: "exact", head: true }),
      supabase.from("projects").select("*", { count: "exact", head: true }),
    ]);

  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  const { data: recentProjects, error: rErr } = await supabase
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
    .order("created_at", { ascending: false })
    .limit(10);

  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });

  const mapped = (recentProjects ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    created_at: p.created_at,
    owner_id: p.owner_id,
    owner_email: p.users?.email ?? "unknown",
  }));

  return NextResponse.json({
    usersCount: usersCount ?? 0,
    projectsCount: projectsCount ?? 0,
    recentProjects: mapped,
  });
}
