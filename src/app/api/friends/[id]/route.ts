import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { supabase } from "@/lib/supabaseServer";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  // We can only accept a request where we are user2_id (the recipient)
  const { data: friend, error: fetchErr } = await supabase
    .from("friends")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !friend) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (friend.user2_id !== user.id) {
    return NextResponse.json({ error: "Forbidden: Cannot accept a request not sent to you" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("friends")
    .update({ status: "accepted" })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ friend: data });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  // Must involve current user
  const { data: friend, error: fetchErr } = await supabase
    .from("friends")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !friend) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (friend.user1_id !== user.id && friend.user2_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase
    .from("friends")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
