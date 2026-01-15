import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("password_reset_requests")
    .select(
      `
      id,
      status,
      created_at,
      approved_at,
      completed_at,
      note,
      user_id,
      users:user_id (
        email,
        full_name
      )
    `
    )
    .in("status", ["pending", "approved"])
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const mapped = (data ?? []).map((r: any) => ({
    id: r.id,
    status: r.status,
    created_at: r.created_at,
    approved_at: r.approved_at,
    completed_at: r.completed_at,
    note: r.note,
    user_id: r.user_id,
    user_email: r.users?.email ?? "unknown",
    user_full_name: r.users?.full_name ?? null,
  }));

  return NextResponse.json(mapped);
}
