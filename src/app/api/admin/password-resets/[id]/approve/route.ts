import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";
import crypto from "crypto";

function hashCode(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function genResetCode(len = 10) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const note = typeof (body as any).note === "string" ? (body as any).note : null;

  const { data: row, error: e1 } = await supabase
    .from("password_reset_requests")
    .select("id,user_id,status")
    .eq("id", params.id)
    .maybeSingle();

  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if (row.status !== "pending") return NextResponse.json({ error: "Not pending" }, { status: 400 });

  const resetCode = genResetCode(10);
  const resetHash = hashCode(resetCode);

  // force reset on user
  const { error: e2 } = await supabase
    .from("users")
    .update({ force_password_reset: true })
    .eq("id", row.user_id);

  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

  // approve request
  const { error: e3 } = await supabase
    .from("password_reset_requests")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: auth.user.id,
      reset_code_hash: resetHash,
      note,
    })
    .eq("id", row.id);

  if (e3) return NextResponse.json({ error: e3.message }, { status: 500 });

  // IMPORTANT: return code to admin (admin gives it to user out-of-band)
  return NextResponse.json({ ok: true, reset_code: resetCode });
}
