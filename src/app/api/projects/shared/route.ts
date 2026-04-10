import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const user = auth.user;

    // Fetch accepted friend IDs
    const { data: friendsData } = await supabase
      .from("friends")
      .select("user1_id, user2_id")
      .eq("status", "accepted")
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

    const friendIds = (friendsData || []).map((f) =>
      f.user1_id === user.id ? f.user2_id : f.user1_id
    );

    // Fetch collaboration project IDs
    const { data: colabsData } = await supabase
      .from("project_collaborators")
      .select("project_id")
      .eq("user_id", user.id);

    const collabIds = (colabsData || []).map((c) => c.project_id);

    // Build the query
    // Visibility = public OR (visibility = friends AND owner in friendIds) OR id in collabIds
    let orFilters = [`visibility.eq.public`];
    
    if (friendIds.length > 0) {
      orFilters.push(`and(visibility.eq.friends,owner_id.in.(${friendIds.join(",")}))`);
    }
    
    if (collabIds.length > 0) {
      orFilters.push(`id.in.(${collabIds.join(",")})`);
    }

    const { data: projects, error } = await supabase
      .from("projects")
      .select("*, owner:users!owner_id(email)")
      .neq("owner_id", user.id)
      .or(orFilters.join(","))
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    // Process to add is_collaborator based on collabIds
    const processedProjects = (projects || []).map((p: any) => ({
      ...p,
      owner_email: p.owner?.email,
      is_collaborator: collabIds.includes(p.id)
    }));

    return NextResponse.json(processedProjects);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
