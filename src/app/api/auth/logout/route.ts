import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseServer";
import { authCookie } from "@/lib/auth";
import { sha256 } from "@/lib/security";
import { cookies } from "next/headers";

export async function POST() {
  const token = (await cookies()).get(authCookie.name)?.value;

  if (token) {
    const tokenHash = sha256(token);
    await supabase
      .from("sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("token_hash", tokenHash);
  }

  const res = NextResponse.json({ success: true }, { status: 200 });
  res.cookies.set(authCookie.name, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
  return res;
}
