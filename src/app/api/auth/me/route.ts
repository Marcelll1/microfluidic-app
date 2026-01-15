import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  return NextResponse.json({
    id: auth.user.id,
    email: auth.user.email,
    role: auth.user.role,
  });
}
