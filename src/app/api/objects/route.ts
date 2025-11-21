import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("project_id");

  if (!projectId) {
    return NextResponse.json({ error: "Missing project_id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("object3d")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Supabase GET error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { project_id, objects } = body;

  if (!project_id || !Array.isArray(objects)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // delete previous objects for this project
  const { error: delError } = await supabase
    .from("object3d")
    .delete()
    .eq("project_id", project_id);

  if (delError) {
    console.error("Supabase DELETE error:", delError.message);
    return NextResponse.json({ error: delError.message }, { status: 500 });
  }

  const { error: insError } = await supabase
    .from("object3d")
    .insert(objects);

  if (insError) {
    console.error("Supabase INSERT error:", insError.message);
    return NextResponse.json({ error: insError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
