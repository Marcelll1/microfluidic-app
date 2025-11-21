import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

// GET /api/projects -> list
export async function GET() {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("GET /projects error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

// POST /api/projects -> create
export async function POST(req: Request) {
  const body = await req.json();
  const name = (body.name as string | undefined)?.trim();
  const description = (body.description as string | undefined)?.trim() ?? "";

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({ name, description })
    .select("*")
    .single();

  if (error) {
    console.error("POST /projects error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
