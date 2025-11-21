import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

interface Params {
  params: { id: string };
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = params;

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("DELETE /projects error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
