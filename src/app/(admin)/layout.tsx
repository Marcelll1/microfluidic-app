import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import Link from "next/link";
import LogoutButton from "@/components/scene/LogoutButton";

export default async function AdminGroupLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireUser();
  if (!auth.ok) redirect("/login");
  if (auth.user.role !== "admin") redirect("/projects");

  return (
    <div className="app-shell bg-slate-950 text-slate-100">
      <header className="main-header">
        <h1 className="main-title">Microfluidic Designer (Admin)</h1>

        <nav className="main-nav">
          <Link href="/admin" className="main-nav-link">
            Dashboard
          </Link>
          <Link href="/editor" className="main-nav-link">
            Editor
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <LogoutButton />
        </div>
      </header>

      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
