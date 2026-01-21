import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabaseServer";
import { hashPassword, sha256 } from "@/lib/security";

//schéma pre validáciu vstupných dát
const Schema = z.object({
  email: z.string().email().max(200),
  reset_code: z.string().min(1).max(200),
  new_password: z.string().min(6).max(200),
});

//funkcia na spracovanie POST požiadavky na nastavenie nového hesla
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();//normalizácia emailu
  const reset_code = parsed.data.reset_code.trim();//očistenie reset kódu
  const new_password = parsed.data.new_password;//nové heslo

  //nájdenie používateľa podľa emailu
  const { data: user, error: e1 } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });//chyba pri databázovej operácii
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });//používateľ neexistuje

  const codeHash = sha256(reset_code);//hashovanie reset kódu pre porovnanie

  //nájdenie platnej požiadavky na reset hesla
  const { data: reqRow, error: e2 } = await supabase
    .from("password_reset_requests")
    .select("id,reset_code_hash,status")
    .eq("user_id", user.id)
    .eq("status", "approved")
    .order("approved_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

  if (!reqRow || reqRow.reset_code_hash !== codeHash) {//overenie platnosti reset kódu
    return NextResponse.json({ error: "Invalid reset code" }, { status: 400 });//neplatný reset kód
  }

  const password_hash = await hashPassword(new_password); //hashovanie nového hesla

  //aktualizácia hesla používateľa a označenie požiadavky ako dokončenej
  const { error: e3 } = await supabase
    .from("users")
    .update({ password_hash, force_password_reset: false })//nastavenie nového hesla a zrušenie povinnosti resetu hesla
    .eq("id", user.id);

  if (e3) return NextResponse.json({ error: e3.message }, { status: 500 });//chyba pri aktualizácii hesla

  //označenie požiadavky na reset hesla ako dokončenej
  const { error: e4 } = await supabase
    .from("password_reset_requests")
    .update({ status: "completed", completed_at: new Date().toISOString() })//označenie ako dokončené
    .eq("id", reqRow.id);

  if (e4) return NextResponse.json({ error: e4.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
