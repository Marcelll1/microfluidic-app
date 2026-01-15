import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseServer";
import crypto from "crypto";
import bcrypt from "bcryptjs";

function hashCode(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  const email = body?.email;
  const reset_code = body?.reset_code;
  const new_password = body?.new_password;

  if (typeof email !== "string" || typeof reset_code !== "string" || typeof new_password !== "string") {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (new_password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 chars" }, { status: 400 });
  }

  const { data: user, error: e1 } = await supabase
    .from("users")
    .select("id")
    .eq("email", email.trim())
    .maybeSingle();

  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const codeHash = hashCode(reset_code.trim());

  const { data: reqRow, error: e2 } = await supabase
    .from("password_reset_requests")
    .select("id,reset_code_hash,status")
    .eq("user_id", user.id)
    .eq("status", "approved")
    .order("approved_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

  if (!reqRow || reqRow.reset_code_hash !== codeHash) {
    return NextResponse.json({ error: "Invalid reset code" }, { status: 400 });
  }

  const password_hash = await bcrypt.hash(new_password, 10);

  const { error: e3 } = await supabase
    .from("users")
    .update({ password_hash, force_password_reset: false })
    .eq("id", user.id);

  if (e3) return NextResponse.json({ error: e3.message }, { status: 500 });

  const { error: e4 } = await supabase
    .from("password_reset_requests")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", reqRow.id);

  if (e4) return NextResponse.json({ error: e4.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
