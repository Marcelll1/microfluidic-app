import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabase } from "@/lib/supabaseServer";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => null);
  const old_password = body?.old_password;
  const new_password = body?.new_password;

  if (typeof old_password !== "string" || typeof new_password !== "string") {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (new_password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 chars" }, { status: 400 });
  }

  const { data: user, error: e1 } = await supabase
    .from("users")
    .select("id,password_hash")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const ok = await bcrypt.compare(old_password, user.password_hash);
  if (!ok) return NextResponse.json({ error: "Old password is incorrect" }, { status: 400 });

  const password_hash = await bcrypt.hash(new_password, 10);

  const { error: e2 } = await supabase
    .from("users")
    .update({ password_hash })
    .eq("id", auth.user.id);

  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
