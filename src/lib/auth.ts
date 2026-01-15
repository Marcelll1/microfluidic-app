// src/lib/auth.ts
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabaseServer";
import { sha256 } from "@/lib/security";

export type Role = "user" | "admin";

export type AuthedUser = {
  id: string;
  email: string;
  role: Role;
};

const COOKIE_NAME = "session_token";

export const authCookie = {
  name: COOKIE_NAME,
};

export async function getAuthUser(): Promise<AuthedUser | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;

  const tokenHash = sha256(token);

  const { data: session, error: sErr } = await supabase
    .from("sessions")
    .select("user_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (sErr || !session) return null;
  if (session.revoked_at) return null;
  if (new Date(session.expires_at).getTime() <= Date.now()) return null;

  const { data: user, error: uErr } = await supabase
    .from("users")
    .select("id,email,role")
    .eq("id", session.user_id)
    .single();

  if (uErr || !user) return null;

  return { id: user.id, email: user.email, role: user.role as Role };
}

export async function requireUser() {
  const user = await getAuthUser();
  if (!user) {
    return { ok: false as const, status: 401 as const, error: "Unauthorized" };
  }
  return { ok: true as const, user };
}

export async function requireAdmin() {
  const res = await requireUser();
  if (!res.ok) return res;
  if (res.user.role !== "admin") {
    return { ok: false as const, status: 403 as const, error: "Forbidden" };
  }
  return res;
}
