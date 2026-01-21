import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

export async function GET() {
  const auth = await requireUser(); //overi prihlasenie uzivatela
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status }); //ak nie je prihlaseny, vrati chybu

  return NextResponse.json({ //vrati informacie o prihlasenom uzivatelovi pre redirect/role gating
    id: auth.user.id,
    email: auth.user.email,
    role: auth.user.role,
  });
}
