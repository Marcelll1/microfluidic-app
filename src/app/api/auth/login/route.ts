import { NextResponse } from "next/server";
import { z } from "zod"; //import knižnice na validáciu dát
import { supabase } from "@/lib/supabaseServer";
import { generateToken, sha256, verifyPassword } from "@/lib/security";
import { authCookie } from "@/lib/auth";

//definícia schémy pre validáciu vstupných dát pomocou zod, email a heslo
const Schema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(6).max(200),
});

//funkcia na spracovanie POST požiadavky pre prihlasovanie používateľa
export async function POST(req: Request) {
  //získanie a validácia dát z tela požiadavky
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);

  //ak dáta nie sú validné, vráti chybu 400
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  //hľadanie používateľa v databáze podľa emailu (pretože emaily sú case insensitive, prevádzam na lowercase)
  const email = parsed.data.email.toLowerCase().trim();

  //získanie používateľa z databázy podľa emailu, beriem aj password_hash na overenie hesla
  const { data: user, error: uErr } = await supabase
    .from("users")
    .select("id,email,role,password_hash")
    .eq("email", email)
    .maybeSingle();//použitie maybeSingle() pretože môže neexistovať žiadny alebo jeden používateľ

  //ak nastala chyba pri získavaní používateľa alebo používateľ neexistuje, vrátiť chybu 401
  if (uErr || !user) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  //overenie zadaného hesla porovnaním so získaným password_hash z databázy
  const ok = await verifyPassword(parsed.data.password, user.password_hash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  //vytvorenie novej session pre používateľa
  const token = generateToken(32); //vygenerovanie náhodného tokenu
  const tokenHash = sha256(token); //vytvorenie hashu tokenu pre bezpečné uloženie v databáze
  const expires = new Date(Date.now() + 60 * 60 * 1000); //nastavenie expirácie session na 1 hodinu

  //uloženie novej session do databázy
  const { error: sErr } = await supabase.from("sessions").insert({
    user_id: user.id,
    token_hash: tokenHash,
    expires_at: expires.toISOString(),
  });

  if (sErr) {
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }

  //vytvorenie odpovede s nastavenou cookie pre session token obsahuje informácie o používateľovi nie token
  const res = NextResponse.json(
    { user: { id: user.id, email: user.email, role: user.role } },
    { status: 200 }
  );

  //nastavenie cookie s tokenom
  res.cookies.set(authCookie.name, token, {
    httpOnly: true, //cookie nie je prístupná cez JavaScript
    sameSite: "lax",//ochrana proti CSRF
    secure: process.env.NODE_ENV === "production", //cookie je posielaná len cez HTTPS v produkcii
    path: "/",
    expires, //nastavenie expirácie cookie
  });

  return res;
}
