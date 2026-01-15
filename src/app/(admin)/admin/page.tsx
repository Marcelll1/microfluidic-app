import { supabase } from "@/lib/supabaseServer";

export default async function AdminDashboardPage() {
  const [{ count: usersCount }, { count: projectsCount }] = await Promise.all([
    supabase.from("users").select("*", { count: "exact", head: true }),
    supabase.from("projects").select("*", { count: "exact", head: true }),
  ]);

  const { data: recentProjects } = await supabase
    .from("projects")
    .select(
      `
      id,
      name,
      description,
      created_at,
      owner_id,
      users:owner_id (
        email
      )
    `
    )
    .order("created_at", { ascending: false })
    .limit(10);

  const mapped = (recentProjects ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    created_at: p.created_at,
    owner_email: p.users?.email ?? "unknown",
  }));

  return (
    <main>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Admin dashboard</h1>
        <a className="button-secondary" href="/projects">
          Projects
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="card p-4">
          <div className="text-slate-400 text-sm">Users</div>
          <div className="text-3xl font-semibold">{usersCount ?? 0}</div>
        </div>

        <div className="card p-4">
          <div className="text-slate-400 text-sm">Projects</div>
          <div className="text-3xl font-semibold">{projectsCount ?? 0}</div>
        </div>
      </div>

      <section className="card p-4">
        <h2 className="text-lg font-medium mb-4">Recent projects</h2>

        {mapped.length === 0 ? (
          <p className="text-slate-400">No projects.</p>
        ) : (
          <ul className="space-y-3">
            {mapped.map((p) => (
              <li key={p.id} className="bg-slate-900 rounded px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-medium">{p.name}</div>
                    {p.description && (
                      <div className="text-sm text-slate-400">{p.description}</div>
                    )}
                    <div className="text-xs text-slate-500 mt-1">
                      Owner: <span className="font-mono">{p.owner_email}</span>
                    </div>
                  </div>

                  <a className="button-secondary" href={`/editor?project=${p.id}`}>
                    Open
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
