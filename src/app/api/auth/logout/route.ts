import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  // zmaž session cookie
  res.cookies.set("session_token", "", { path: "/", maxAge: 0 });
  return res;
}
