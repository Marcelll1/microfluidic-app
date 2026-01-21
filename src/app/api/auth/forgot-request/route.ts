import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = body?.email;
  const note = typeof body?.note === "string" ? body.note : null;

  if (typeof email !== "string" || !email.includes("@")) {
    // vždy vraciame ok, aby sa nedalo zisťovať kto existuje
    return NextResponse.json({ ok: true });
  }
  // nájdenie používateľa podľa emailu
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("email", email.trim())
    .maybeSingle();

    // vytvorenie záznamu o požiadavke na reset hesla, ak používateľ existuje
  if (user?.id) {
    await supabase.from("password_reset_requests").insert({
      user_id: user.id,
      status: "pending",
      note,
    });
  }

  return NextResponse.json({ ok: true });
}
