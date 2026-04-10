import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";

export async function GET(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  try {
    let projectsQuery = supabase.from("projects").select("*", { count: "exact", head: true });
    let artifactsQuery = supabase.from("generated_artifacts").select("*", { count: "exact", head: true });
    let logsQuery = supabase
      .from("audit_log")
      .select("id, created_at, action, entity, entity_id, meta, users:user_id(email)")
      .order("created_at", { ascending: false })
      .limit(50);
      
    if (userId) {
      projectsQuery = projectsQuery.eq("owner_id", userId);
      artifactsQuery = artifactsQuery.eq("created_by", userId);
      logsQuery = logsQuery.eq("user_id", userId);
    }

    const [usersRes, projectsRes, artifactsRes, logsRes] = await Promise.all([
      userId ? Promise.resolve({ count: null }) : supabase.from("users").select("*", { count: "exact", head: true }),
      projectsQuery,
      artifactsQuery,
      logsQuery,
    ]);

    const lastActive = logsRes.data && logsRes.data.length > 0 ? logsRes.data[0].created_at : null;

    return NextResponse.json({
      stats: {
        isGlobal: !userId,
        totalUsers: usersRes.count || 0,
        totalProjects: projectsRes.count || 0,
        totalArtifacts: artifactsRes.count || 0,
        lastActive: lastActive,
      },
      logs: logsRes.data || [],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
