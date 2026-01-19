import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { supabase } from "@/lib/supabaseServer";
import { hashPassword, verifyPassword } from "@/lib/security";

const Schema = z.object({
  old_password: z.string().min(1).max(200),
  new_password: z.string().min(6).max(200),
});

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  const { old_password, new_password } = parsed.data;

  const { data: user, error: e1 } = await supabase
    .from("users")
    .select("id,password_hash")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const ok = await verifyPassword(old_password, user.password_hash);
  if (!ok) return NextResponse.json({ error: "Old password is incorrect" }, { status: 400 });

  const password_hash = await hashPassword(new_password);

  const { error: e2 } = await supabase.from("users").update({ password_hash }).eq("id", auth.user.id);
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
