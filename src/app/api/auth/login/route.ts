import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabaseServer";
import { generateToken, sha256, verifyPassword } from "@/lib/security";
import { authCookie } from "@/lib/auth";

const Schema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(6).max(200),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();

  const { data: user, error: uErr } = await supabase
    .from("users")
    .select("id,email,role,password_hash")
    .eq("email", email)
    .maybeSingle();

  if (uErr || !user) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const ok = await verifyPassword(parsed.data.password, user.password_hash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const token = generateToken(32);
  const tokenHash = sha256(token);
  const expires = new Date(Date.now() + 60 * 60 * 1000);

  const { error: sErr } = await supabase.from("sessions").insert({
    user_id: user.id,
    token_hash: tokenHash,
    expires_at: expires.toISOString(),
  });

  if (sErr) {
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }

  const res = NextResponse.json(
    { user: { id: user.id, email: user.email, role: user.role } },
    { status: 200 }
  );

  res.cookies.set(authCookie.name, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });

  return res;
}
