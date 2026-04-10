import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { supabase } from "@/lib/supabaseServer";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch all friend relations involving the current user
  const { data: friends, error: friendsErr } = await supabase
    .from("friends")
    .select("*")
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

  if (friendsErr) return NextResponse.json({ error: friendsErr.message }, { status: 500 });

  if (!friends || friends.length === 0) {
    return NextResponse.json({ friends: [] });
  }

  // Extract all the "other" user IDs
  const otherUserIds = friends.map((f: any) => (f.user1_id === user.id ? f.user2_id : f.user1_id));

  // Fetch their emails
  const { data: users, error: usersErr } = await supabase
    .from("users")
    .select("id, email")
    .in("id", otherUserIds);

  if (usersErr) return NextResponse.json({ error: usersErr.message }, { status: 500 });

  // Map the other users back to the friend relationship
  const result = friends.map((f: any) => {
    const isInitiator = f.user1_id === user.id;
    const otherId = isInitiator ? f.user2_id : f.user1_id;
    const otherUser = users?.find((u) => u.id === otherId);

    return {
      id: f.id,
      status: f.status,
      isInitiator,
      friend: {
        id: otherUser?.id,
        email: otherUser?.email,
      },
    };
  });

  return NextResponse.json({ friends: result });
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const targetUserId = body.target_user_id;

  if (!targetUserId) {
    return NextResponse.json({ error: "Missing target_user_id" }, { status: 400 });
  }

  if (targetUserId === user.id) {
    return NextResponse.json({ error: "Cannot add yourself" }, { status: 400 });
  }

  // Check if relation already exists
  const { data: existing, error: existErr } = await supabase
    .from("friends")
    .select("id, status")
    .or(`and(user1_id.eq.${user.id},user2_id.eq.${targetUserId}),and(user1_id.eq.${targetUserId},user2_id.eq.${user.id})`)
    .maybeSingle();

  if (existErr) return NextResponse.json({ error: existErr.message }, { status: 500 });

  if (existing) {
    return NextResponse.json({ error: "Friend request already exists or is accepted." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("friends")
    .insert({
      user1_id: user.id,
      user2_id: targetUserId,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ friend: data });
}
