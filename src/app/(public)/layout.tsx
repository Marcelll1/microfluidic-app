import Link from "next/link"; //import React from "react";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="app-shell bg-slate-950 text-slate-100">
      <header className="main-header">
        <h1 className="main-title">Microfluidic Designer</h1>

        <nav className="main-nav">
          <Link href="/login" className="main-nav-link">
            Login
          </Link>
          <Link href="/register" className="main-nav-link">
            Register
          </Link>
        </nav>
      </header>

      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
