// src/lib/auth.ts
import { cookies } from "next/headers"; //import funkcie na prácu s cookies v Next.js
import { supabase } from "@/lib/supabaseServer";
import { sha256 } from "@/lib/security";

export type Role = "user" | "admin"; //definícia možných rolí používateľa

//definícia typu autentifikovaného používateľa
export type AuthedUser = {
  id: string;
  email: string;
  role: Role;
};

//názov cookie, ktorá uchováva session token
const COOKIE_NAME = "session_token";

//export nazvu cookie pre použitie v iných častiach aplikácie
export const authCookie = {
  name: COOKIE_NAME,
};

export async function getAuthUser(): Promise<AuthedUser | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value; //získanie hodnoty session tokenu z cookies
  if (!token) return null; //ak token neexistuje, user nieje prihlásený

  const tokenHash = sha256(token); //vytvorenie hashu tokenu pre bezpečné porovnávanie

  //získanie session a používateľa z databázy na základe token hashu
  const { data: session, error: sErr } = await supabase
    .from("sessions")
    .select("user_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();//použitie maybeSingle() pretože môže neexistovať žiadna alebo jedna session

  //ak nastala chyba pri získavaní session alebo session neexistuje, vrátiť null
  if (sErr || !session) return null;
  if (session.revoked_at) return null;
  if (new Date(session.expires_at).getTime() <= Date.now()) return null;

  //získanie používateľa na základe user_id zo session
  const { data: user, error: uErr } = await supabase
    .from("users")
    .select("id,email,role")
    .eq("id", session.user_id)
    .single();

  //ak nastala chyba pri získavaní používateľa alebo používateľ neexistuje, vrátiť null
  if (uErr || !user) return null;

  //vrátiť autentifikovaného používateľa
  return { id: user.id, email: user.email, role: user.role as Role };
}

//funkcia na vyžiadanie prihláseného používateľa, vráti chybu ak nie je prihlásený
export async function requireUser() {
  const user = await getAuthUser();
  if (!user) {
    return { ok: false as const, status: 401 as const, error: "Unauthorized" };
  }
  return { ok: true as const, user };
}

//funkcia na vyžiadanie admin používateľa, vráti chybu ak nie je prihlásený alebo nie je admin
export async function requireAdmin() {
  const res = await requireUser();
  if (!res.ok) return res;
  if (res.user.role !== "admin") {
    return { ok: false as const, status: 403 as const, error: "Forbidden" };
  }
  return res;
}
