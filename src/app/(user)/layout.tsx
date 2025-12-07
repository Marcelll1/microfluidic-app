"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      const { data, error } = await supabase.auth.getSession();

      if (!isMounted) return;

      if (error) {
        console.error("Error checking session:", error.message);
        // aj pri error-e pustíme UI, aby si nebol natvrdo zamknutý
        setCheckingAuth(false);
        return;
      }

      if (!data.session) {
        router.replace("/login");
      } else {
        setCheckingAuth(false);
      }
    }

    void checkSession();

    return () => {
      isMounted = false;
    };
  }, [router]);

  async function handleLogout() {
    setLoggingOut(true);
    const { error } = await supabase.auth.signOut();
    setLoggingOut(false);

    if (error) {
      console.error("Logout error:", error.message);
      return;
    }

    router.replace("/login");
  }

  if (checkingAuth) {
    return (
      <div className="app-shell bg-slate-950 text-slate-100">
        <header className="main-header">
          <h1 className="main-title">Microfluidic Designer</h1>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <p className="text-sm text-slate-400">
            Checking authentication…
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell bg-slate-950 text-slate-100">
      <header className="main-header">
        <h1 className="main-title">Microfluidic Designer</h1>

        <nav className="main-nav">
          <Link
            href="/dashboard"
            className={
              "main-nav-link" +
              (path === "/dashboard" ? " main-nav-link--active" : "")
            }
          >
            Dashboard
          </Link>
          <Link
            href="/projects"
            className={
              "main-nav-link" +
              (path.startsWith("/projects") ? " main-nav-link--active" : "")
            }
          >
            Projects
          </Link>
          <Link
            href="/editor"
            className={
              "main-nav-link" +
              (path === "/editor" ? " main-nav-link--active" : "")
            }
          >
            Editor
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {path === "/editor" && (
            <button
              onClick={() =>
                document.dispatchEvent(new CustomEvent("saveScene"))
              }
              className="button-primary"
            >
              Save Scene
            </button>
          )}
          <button
            onClick={handleLogout}
            className="text-sm text-slate-400 hover:text-red-400"
            disabled={loggingOut}
          >
            {loggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
