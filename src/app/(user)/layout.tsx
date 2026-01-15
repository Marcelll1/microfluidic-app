"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import LogoutButton from "@/components/scene/LogoutButton";

type Me = { id: string; email: string; role: "user" | "admin" };

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();

  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const isEditor = useMemo(() => path === "/editor", [path]);

  useEffect(() => {
    let alive = true;

    async function loadMe() {
      setLoading(true);
      const res = await fetch("/api/auth/me").catch(() => null);

      if (!alive) return;

      if (!res || !res.ok) {
        setLoading(false);
        router.replace("/login");
        return;
      }

      const data = (await res.json().catch(() => null)) as Me | null;
      if (!data) {
        setLoading(false);
        router.replace("/login");
        return;
      }

      setMe(data);
      setLoading(false);

      // ADMIN nemá používať user sekcie:
      // - /projects a /dashboard pre admina nedávajú zmysel => redirect na /admin
      if (data.role === "admin" && path !== "/editor" && !path.startsWith("/admin")) {
        router.replace("/admin");
      }
    }

    void loadMe();

    return () => {
      alive = false;
    };
  }, [router, path]);

  if (loading) {
    return (
      <div className="app-shell bg-slate-950 text-slate-100">
        <header className="main-header">
          <h1 className="main-title">Microfluidic Designer</h1>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <p className="text-sm text-slate-400">Checking authentication…</p>
        </main>
      </div>
    );
  }

  // Ak je admin, layout sa aj tak presmeruje; render je fallback
  const role = me?.role ?? "user";

  return (
    <div className="app-shell bg-slate-950 text-slate-100">
      <header className="main-header">
        <h1 className="main-title">Microfluidic Designer</h1>

        <nav className="main-nav">
          {role === "user" && (
            <>
              <Link
                href="/dashboard"
                className={
                  "main-nav-link" + (path === "/dashboard" ? " main-nav-link--active" : "")
                }
              >
                Dashboard
              </Link>
              <Link
                href="/projects"
                className={
                  "main-nav-link" + (path.startsWith("/projects") ? " main-nav-link--active" : "")
                }
              >
                Projects
              </Link>
            </>
          )}

          <Link
            href="/editor"
            className={"main-nav-link" + (path === "/editor" ? " main-nav-link--active" : "")}
          >
            Editor
          </Link>

          {role === "admin" && (
            <Link
              href="/admin"
              className={"main-nav-link" + (path.startsWith("/admin") ? " main-nav-link--active" : "")}
            >
              Admin
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {isEditor && (
            <button
              onClick={() => document.dispatchEvent(new CustomEvent("saveScene"))}
              className="button-primary"
            >
              Save Scene
            </button>
          )}
          <LogoutButton />
        </div>
      </header>

      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
