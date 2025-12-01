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

  const rawName = body.name;
  const rawDescription = body.description;

  const name = typeof rawName === "string" ? rawName.trim() : "";
  const description =
    typeof rawDescription === "string" ? rawDescription.trim() : "";

  // server-side validácia

  if (!name) {
    return NextResponse.json(
      { error: "Name is required." },
      { status: 400 }
    );
  }

  if (name.length < 3 || name.length > 100) {
    return NextResponse.json(
      { error: "Name must be between 3 and 100 characters." },
      { status: 400 }
    );
  }

  if (description.length > 500) {
    return NextResponse.json(
      { error: "Description must be at most 500 characters." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({
      name,
      description: description || null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("POST /projects error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
