import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";
import { generateToken, sha256 } from "@/lib/security";

export async function POST(
  req: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const code = generateToken(4); // krátky kód, používateľ dostane od admina
  const reset_code_hash = sha256(code);

  const { error } = await supabase
    .from("password_reset_requests")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      reset_code_hash,
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, reset_code: code });
}
