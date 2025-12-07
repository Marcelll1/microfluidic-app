import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

interface Params {
  params: { id: string };
}

// GET /api/projects/:id -> READ
export async function GET(_req: Request, { params }: Params) {
  const { id } = params;

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("GET /projects/:id error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json(data, { status: 200 });
}

// PATCH /api/projects/:id -> UPDATE projektu
export async function PATCH(req: Request, { params }: Params) {
  const { id } = params;
  const body = await req.json();

  const rawName = body.name;
  const rawDescription = body.description;

  const name = typeof rawName === "string" ? rawName.trim() : "";
  const description =
    typeof rawDescription === "string" ? rawDescription.trim() : "";

  // rovnaká validácia ako pri POST /api/projects
  if (!name) {
    return NextResponse.json(
      { error: "Name is required." },
      { status: 400 },
    );
  }

  if (name.length < 3 || name.length > 100) {
    return NextResponse.json(
      { error: "Name must be between 3 and 100 characters." },
      { status: 400 },
    );
  }

  if (description.length > 500) {
    return NextResponse.json(
      { error: "Description must be at most 500 characters." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("projects")
    .update({
      name,
      description: description || null,
    })
    .eq("id", id)
    .select("*");

  if (error) {
    console.error("PATCH /projects/:id error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  
  if (!data || data.length === 0) {
    console.error("PATCH /projects/:id did not update any row", { id });
    return NextResponse.json(
      { error: "Project not found or not updated." },
      { status: 404 },
    );
  }


  return NextResponse.json(data[0], { status: 200 });
}



// DELETE /api/projects/:id -> zmazanie projektu
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = params;

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("DELETE /projects/:id error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
