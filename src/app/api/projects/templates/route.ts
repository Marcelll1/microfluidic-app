import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Fetch accepted friend IDs
  const { data: friendsData } = await supabase
    .from("friends")
    .select("user1_id, user2_id")
    .eq("status", "accepted")
    .or(`user1_id.eq.${auth.user.id},user2_id.eq.${auth.user.id}`);

  const friendIds = (friendsData || []).map((f) =>
    f.user1_id === auth.user.id ? f.user2_id : f.user1_id
  );

  // Fetch collaboration project IDs
  const { data: colabsData } = await supabase
    .from("project_collaborators")
    .select("project_id")
    .eq("user_id", auth.user.id);

  const collabIds = (colabsData || []).map((c) => c.project_id);

  // Build the or query for visibility
  // 1. User is owner
  // 2. Project is public
  // 3. Project is friends-only AND owner is friend
  // 4. User is collaborator
  let orFilters = [
    `owner_id.eq.${auth.user.id}`,
    `visibility.eq.public`
  ];

  if (friendIds.length > 0) {
    orFilters.push(`and(visibility.eq.friends,owner_id.in.(${friendIds.join(",")}))`);
  }

  if (collabIds.length > 0) {
    orFilters.push(`id.in.(${collabIds.join(",")})`);
  }

  const { data: projects, error } = await supabase
    .from("projects")
    .select("*, owner:users!owner_id(email)")
    .eq("is_template", true)
    .or(orFilters.join(","))
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const processedProjects = (projects || []).map((p: any) => ({
    ...p,
    owner_email: p.owner?.email,
    is_collaborator: collabIds.includes(p.id)
  }));

  return NextResponse.json(processedProjects);
}
