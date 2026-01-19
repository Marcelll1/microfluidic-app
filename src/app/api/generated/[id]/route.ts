import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";

export async function GET(
  _: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;

  const { data, error } = await supabase
    .from("generated_artifacts")
    .select("id,project_id,created_by,filename,content")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (auth.user.role !== "admin" && data.created_by !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // posielame ako download
  return new NextResponse(data.content ?? "", {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${data.filename ?? "artifact.txt"}"`,
    },
  });
}
