"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();

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
          <button className="text-sm text-slate-400 hover:text-red-400">
            Logout
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
