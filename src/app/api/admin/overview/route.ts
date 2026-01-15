import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabase } from "@/lib/supabaseServer";

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [{ data: users, error: e1 }, { data: pending, error: e2 }] = await Promise.all([
    supabase
      .from("users")
      .select("id,email,role,full_name,created_at")
      .order("created_at", { ascending: true }),
    supabase
      .from("password_reset_requests")
      .select("id,user_id,created_at,note,status")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

  const pendingByUser = new Map<string, any>();
  for (const r of pending ?? []) {
    if (!pendingByUser.has(r.user_id)) pendingByUser.set(r.user_id, r);
  }

  const out = (users ?? []).map((u: any) => ({
    ...u,
    has_pending_reset: pendingByUser.has(u.id),
    pending_reset_id: pendingByUser.get(u.id)?.id ?? null,
    pending_reset_note: pendingByUser.get(u.id)?.note ?? null,
    pending_reset_created_at: pendingByUser.get(u.id)?.created_at ?? null,
  }));

  return NextResponse.json(out);
}
