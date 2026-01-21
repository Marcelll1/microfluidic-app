"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import LogoutButton from "@/components/scene/LogoutButton";

//typ dat ktore cakam z GET /api/auth/me
type Me = { id: string; email: string; role: "user" | "admin" };

//layour pre user sekcie (dashboard, projects, editor)
export default function UserLayout({ children }: { children: React.ReactNode }) {//konkretna stranka v user sekcii
  const path = usePathname();//aktualna URL cesta
  const router = useRouter();//navigacia

  const [me, setMe] = useState<Me | null>(null);//bud prihlaseny user alebo null
  const [loading, setLoading] = useState(true);//ci sa nacitava stav prihlasenia(na zaciatku true)

  const isEditor = useMemo(() => path === "/editor", [path]);//ci je aktualna stranka editor, UseMemo garantuje ze sa hodnota zmeni len ak sa zmeni path

  //overi ci je user prihlaseny a jeho rolu
  useEffect(() => {
    let alive = true;

    //spusta overenie session cez api/auth/me
    async function loadMe() {
      setLoading(true);//zacina nacitavanie (zabezpeci ze sa zobrazi loading screen)
      const res = await fetch("/api/auth/me").catch(() => null);//posle GET poziadavku na api endpoint

      if (!alive) return;//ak sa komponent unmountol, ukonci funkciu

      //ak nie je odpoved alebo odpoved nie je OK, presmeruje na login
      if (!res || !res.ok) {
        setLoading(false);
        router.replace("/login");
        return;
      }

      //spracuje odpoved zo servera
      const data = (await res.json().catch(() => null)) as Me | null;
      if (!data) {
        setLoading(false);
        router.replace("/login");//presmeruje na login
        return;
      }

      setMe(data);//zachova data o prihlasenom userovi ulozi ho do state
      setLoading(false);//vypne loading, layout sa moze vykreslit

      // ADMIN nemá používať user sekcie:
      //redirect na admin dashboard ak je admin a nie je v editori alebo admin sekcii
      if (data.role === "admin" && path !== "/editor" && !path.startsWith("/admin")) {
        router.replace("/admin");
      }
    }

    void loadMe();//spusti overenie session

    //cleanup funkcia pre pripad unmountu komponentu
    return () => {
      alive = false;
    };
  }, [router, path]);

  //zobrazi loading screen kym sa overuje session
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
