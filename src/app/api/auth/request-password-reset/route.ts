import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/auth";
import crypto from "crypto";

function hashCode(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function genResetCode(len = 10) {
  // bez podobných znakov 0/O, 1/I
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const update: Record<string, any> = {};
  if (typeof body.role === "string") update.role = body.role;
  if (typeof body.full_name === "string") update.full_name = body.full_name;
  if (typeof body.email === "string") update.email = body.email;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await supabaseServer.from("users").update(update).eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // action endpoint: { action: "approve_password_reset", note?: string }
  const body = await req.json().catch(() => null);
  if (!body?.action) {
    return NextResponse.json({ error: "Missing action" }, { status: 400 });
  }

  if (body.action !== "approve_password_reset") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  // nájdi latest pending request pre usera
  const { data: pending, error: e1 } = await supabaseServer
    .from("password_reset_requests")
    .select("id,status")
    .eq("user_id", params.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
  if (!pending) return NextResponse.json({ error: "No pending reset request" }, { status: 400 });

  const code = genResetCode(10);
  const codeHash = hashCode(code);

  // nastav force reset
  const { error: e2 } = await supabaseServer
    .from("users")
    .update({ force_password_reset: true })
    .eq("id", params.id);

  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

  // schvál request + ulož hash kódu
  const { error: e3 } = await supabaseServer
    .from("password_reset_requests")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: auth.user.id,
      reset_code_hash: codeHash,
      note: typeof body.note === "string" ? body.note : null,
    })
    .eq("id", pending.id);

  if (e3) return NextResponse.json({ error: e3.message }, { status: 500 });

  // VRÁTIME KÓD ADMINOVI (admin ho dá userovi)
  return NextResponse.json({ ok: true, reset_code: code });
}
