"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-900/70">
        <h1 className="text-sky-400 font-semibold text-lg">Microfluidic Designer</h1>
        <nav className="flex gap-4 text-sm">
          <Link
            href="/dashboard"
            className={path === "/dashboard" ? "text-sky-400" : "text-slate-400 hover:text-sky-300"}
          >
            Dashboard
          </Link>
          <Link
            href="/projects"
            className={path.startsWith("/projects") ? "text-sky-400" : "text-slate-400 hover:text-sky-300"}
          >
            Projects
          </Link>
          <Link
            href="/editor"
            className={path === "/editor" ? "text-sky-400" : "text-slate-400 hover:text-sky-300"}
          >
            Editor
          </Link>
        </nav>
        <div className="flex items-center gap-3">
    {path === "/editor" && (
      <button
        onClick={() => document.dispatchEvent(new CustomEvent("saveScene"))}
        className="bg-sky-600 hover:bg-sky-700 text-white text-sm px-4 py-2 rounded-md"
      >
        Save Scene
      </button>
    )}
    <button className="text-sm text-slate-400 hover:text-red-400">Logout</button>
  </div>
      </header>
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
